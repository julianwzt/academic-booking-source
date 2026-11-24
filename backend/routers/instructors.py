"""Instructor (Dosen/Asdos) directory CRUD — admin-only writes.

Each directory record is backed by a login account (same email) so seeded
instructors can sign in. Deleting an instructor removes their account and
their bookings (the confirm dialog in the UI states this).
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument

from lib.db import db
from lib.deps import get_current_user, require_admin
from lib.security import hash_password
from models.instructors import INSTRUCTOR_ROLES, Instructor, InstructorCreate, InstructorUpdate

router = APIRouter(prefix="/instructors", tags=["instructors"])


def _clean(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "_id"}


def _validate_role(role: str) -> None:
    if role not in INSTRUCTOR_ROLES:
        raise HTTPException(status_code=422, detail="Role must be Lecturer or Assistant Lecturer")


async def _next_code() -> str:
    doc = await db.counters.find_one_and_update(
        {"_id": "instructors"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return f"INST{doc['seq']:03d}"


@router.get("", response_model=list[Instructor])
async def list_instructors(user: dict = Depends(get_current_user)):
    docs = await db.instructors.find({}, {"_id": 0}).sort("code", 1).to_list(500)
    return [Instructor(**d) for d in docs]


@router.post("", response_model=Instructor, status_code=201)
async def create_instructor(body: InstructorCreate, user: dict = Depends(require_admin)):
    _validate_role(body.role)
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    iid = str(uuid.uuid4())
    doc = {
        "id": iid,
        "code": await _next_code(),
        "name": body.name,
        "email": email,
        "role": body.role,
        "department": body.department,
    }
    await db.instructors.insert_one(doc)
    await db.users.insert_one({
        "id": str(uuid.uuid4()),
        "email": email,
        "name": body.name,
        "password_hash": hash_password(body.password),
        "access_role": "instructor",
        "instructor_id": iid,
        "created_at": datetime.now(timezone.utc),
    })
    return Instructor(**doc)


@router.put("/{instructor_id}", response_model=Instructor)
async def update_instructor(instructor_id: str, body: InstructorUpdate, user: dict = Depends(require_admin)):
    doc = await db.instructors.find_one({"id": instructor_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Instructor not found")
    changes = body.model_dump(exclude_unset=True)
    if "role" in changes:
        _validate_role(changes["role"])
    email = (changes.get("email") or doc["email"]).lower()
    clash = await db.users.find_one({"email": email, "instructor_id": {"$ne": instructor_id}})
    if clash:
        raise HTTPException(status_code=409, detail="Another account already uses this email")
    merged = {**doc, **changes, "email": email}
    await db.instructors.update_one(
        {"id": instructor_id},
        {"$set": {**{k: merged[k] for k in changes}, "email": email}},
    )
    user_set: dict = {"name": merged["name"], "email": email}
    if changes.get("password"):
        user_set["password_hash"] = hash_password(changes["password"])
    await db.users.update_many({"instructor_id": instructor_id}, {"$set": user_set})
    return Instructor(**_clean(merged))


@router.delete("/{instructor_id}")
async def delete_instructor(instructor_id: str, user: dict = Depends(require_admin)):
    doc = await db.instructors.find_one({"id": instructor_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Instructor not found")
    removed = await db.bookings.delete_many({"instructor_id": instructor_id})
    await db.users.delete_many({"instructor_id": instructor_id})
    await db.instructors.delete_one({"id": instructor_id})
    return {"ok": True, "removed_bookings": removed.deleted_count}
