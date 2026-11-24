"""Classroom CRUD — admin-only writes, every authenticated user can read."""

import uuid

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from lib.dates import today_iso
from lib.deps import get_current_user, require_admin
from models.bookings import BLOCKING
from models.classrooms import (
    BUILDING,
    VALID_FLOORS,
    VALID_STATUSES,
    VALID_TYPES,
    Classroom,
    ClassroomCreate,
    ClassroomUpdate,
)

router = APIRouter(prefix="/classrooms", tags=["classrooms"])


def _clean(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "_id"}


def _validate_fields(building: str, floor: int, type_: str, status: str) -> None:
    if building.upper() != BUILDING:
        raise HTTPException(status_code=422, detail="Only TULT (Telkom University Landmark Tower) rooms are allowed")
    if floor not in VALID_FLOORS:
        raise HTTPException(status_code=422, detail="Only TULT floors 6 and 7 are allowed")
    if type_ not in VALID_TYPES:
        raise HTTPException(status_code=422, detail="Type must be Classroom or Laboratory")
    if status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail="Status must be Available or Maintenance")


async def _code_taken(code: str, exclude_id: str | None = None) -> bool:
    query: dict = {"code": code.upper()}
    if exclude_id:
        query["id"] = {"$ne": exclude_id}
    return await db.classrooms.find_one(query) is not None


@router.get("", response_model=list[Classroom])
async def list_classrooms(user: dict = Depends(get_current_user)):
    docs = await db.classrooms.find({}, {"_id": 0}).sort("code", 1).to_list(500)
    return [Classroom(**d) for d in docs]


@router.post("", response_model=Classroom, status_code=201)
async def create_classroom(body: ClassroomCreate, user: dict = Depends(require_admin)):
    _validate_fields(body.building, body.floor, body.type, body.status)
    if await _code_taken(body.code):
        raise HTTPException(status_code=409, detail=f"Classroom code {body.code.upper()} already exists")
    doc = body.model_dump()
    doc.update(id=str(uuid.uuid4()), code=doc["code"].upper(), building=doc["building"].upper())
    await db.classrooms.insert_one(doc)
    return Classroom(**doc)


@router.get("/{classroom_id}", response_model=Classroom)
async def get_classroom(classroom_id: str, user: dict = Depends(get_current_user)):
    doc = await db.classrooms.find_one({"id": classroom_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Classroom not found")
    return Classroom(**doc)


@router.put("/{classroom_id}", response_model=Classroom)
async def update_classroom(classroom_id: str, body: ClassroomUpdate, user: dict = Depends(require_admin)):
    doc = await db.classrooms.find_one({"id": classroom_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Classroom not found")
    changes = body.model_dump(exclude_unset=True)
    merged = {**doc, **changes}
    _validate_fields(merged["building"], merged["floor"], merged["type"], merged["status"])
    if "code" in changes and await _code_taken(merged["code"], exclude_id=classroom_id):
        raise HTTPException(status_code=409, detail=f"Classroom code {merged['code'].upper()} already exists")
    if "code" in changes:
        merged["code"] = merged["code"].upper()
    merged["building"] = merged["building"].upper()
    await db.classrooms.update_one({"id": classroom_id}, {"$set": {k: merged[k] for k in changes}})
    return Classroom(**_clean(merged))


@router.delete("/{classroom_id}")
async def delete_classroom(classroom_id: str, user: dict = Depends(require_admin)):
    doc = await db.classrooms.find_one({"id": classroom_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Classroom not found")
    active = await db.bookings.count_documents({
        "classroom_id": classroom_id,
        "status": {"$in": list(BLOCKING)},
        "date": {"$gte": today_iso()},
    })
    if active:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete {doc['code']}: it still has {active} active booking(s). Cancel or move them first.",
        )
    await db.bookings.delete_many({"classroom_id": classroom_id})  # historical records go with the room
    await db.classrooms.delete_one({"id": classroom_id})
    return {"ok": True}
