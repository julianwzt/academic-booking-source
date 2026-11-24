"""Booking CRUD — overlap validation, role-scoped visibility, human booking codes."""

import os
import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument

from lib.db import db
from lib.dates import today_iso
from lib.deps import get_current_user, require_admin
from models.bookings import (
    BLOCKING,
    PURPOSES,
    STATUSES,
    Availability,
    BookingCreate,
    BookingOut,
    BookingStatusChange,
    BookingUpdate,
    ClassroomRef,
    DayBooking,
    InstructorRef,
)

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _clean(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "_id"}


def _can_manage(user: dict, booking: dict) -> bool:
    """Deny by default: admins manage all; instructors manage only their own rows."""
    if user.get("access_role") == "admin":
        return True
    return bool(user.get("instructor_id")) and booking.get("instructor_id") == user["instructor_id"]


async def _refs():
    instructors = {d["id"]: d for d in await db.instructors.find({}, {"_id": 0}).to_list(500)}
    classrooms = {d["id"]: d for d in await db.classrooms.find({}, {"_id": 0}).to_list(500)}
    return instructors, classrooms


def _with_refs(doc: dict, instructors: dict, classrooms: dict) -> BookingOut:
    ins = instructors.get(doc.get("instructor_id"))
    room = classrooms.get(doc.get("classroom_id"))
    out = _clean(doc) | {
        "instructor": InstructorRef(id=ins["id"], name=ins["name"], code=ins["code"]) if ins else None,
        "classroom": ClassroomRef(
            id=room["id"], code=room["code"], name=room["name"], floor=room["floor"], type=room["type"]
        ) if room else None,
    }
    return BookingOut(**out)


async def _next_booking_code() -> str:
    year = datetime.now(timezone.utc).year
    doc = await db.counters.find_one_and_update(
        {"_id": f"bookings-{year}"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return f"BK-{year}-{doc['seq']:04d}"


async def _assert_slot_free(
    classroom_id: str, date: str, start: str, end: str, exclude_id: str | None = None
) -> None:
    if end <= start:
        raise HTTPException(status_code=422, detail="End time must be later than start time")
    query: dict = {
        "classroom_id": classroom_id,
        "date": date,
        "status": {"$in": list(BLOCKING)},  # Cancelled bookings no longer block a slot
        "start_time": {"$lt": end},
        "end_time": {"$gt": start},
    }
    if exclude_id:
        query["id"] = {"$ne": exclude_id}
    clash = await db.bookings.find_one(
        query, {"_id": 0, "booking_code": 1, "start_time": 1, "end_time": 1}
    )
    if clash:
        room = await db.classrooms.find_one({"id": classroom_id}, {"_id": 0, "code": 1})
        code = (room or {}).get("code", "The room")
        raise HTTPException(
            status_code=409,
            detail=f"Conflict: {code} is already booked {clash['start_time']}\u2013{clash['end_time']} on {date} ({clash['booking_code']})",
        )


def _validate_purpose(purpose: str) -> None:
    if purpose not in PURPOSES:
        raise HTTPException(status_code=422, detail="Invalid booking purpose")


@router.get("/availability", response_model=Availability)
async def availability(classroom_id: str, date: str, user: dict = Depends(get_current_user)):
    room = await db.classrooms.find_one({"id": classroom_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Classroom not found")
    docs = await db.bookings.find(
        {"classroom_id": classroom_id, "date": date, "status": {"$in": list(BLOCKING)}}, {"_id": 0}
    ).sort("start_time", 1).to_list(500)
    instructors, _ = await _refs()
    items = [
        DayBooking(
            id=d["id"],
            booking_code=d["booking_code"],
            start_time=d["start_time"],
            end_time=d["end_time"],
            course_name=d["course_name"],
            purpose=d["purpose"],
            status=d["status"],
            instructor_name=instructors.get(d["instructor_id"], {}).get("name", "Unknown"),
        )
        for d in docs
    ]
    return Availability(classroom_id=classroom_id, date=date, room_status=room.get("status", "Available"), bookings=items)


@router.get("", response_model=list[BookingOut])
async def list_bookings(
    date: str | None = None,
    classroom_id: str | None = None,
    status: str | None = None,
    instructor_id: str | None = None,
    mine: int = 0,
    user: dict = Depends(get_current_user),
):
    query: dict = {}
    # Role scope: admins see everything; instructors may browse the shared schedule,
    # but any "mine" list is forced to their own rows on the server.
    if mine:
        if user.get("access_role") == "admin" or not user.get("instructor_id"):
            return []
        query["instructor_id"] = user["instructor_id"]
    elif user.get("access_role") != "admin":
        # instructors hitting the shared schedule still cannot strip ownership filters
        if instructor_id and instructor_id != user.get("instructor_id"):
            instructor_id = user.get("instructor_id")
    if instructor_id:
        query["instructor_id"] = instructor_id
    if date:
        query["date"] = date
    if classroom_id:
        query["classroom_id"] = classroom_id
    if status:
        query["status"] = status
    docs = await db.bookings.find(query, {"_id": 0}).sort([("date", -1), ("start_time", -1)]).to_list(2000)
    instructors, classrooms = await _refs()
    return [_with_refs(d, instructors, classrooms) for d in docs]


@router.post("", response_model=BookingOut, status_code=201)
async def create_booking(body: BookingCreate, user: dict = Depends(get_current_user)):
    _validate_purpose(body.purpose)
    if body.end_time <= body.start_time:
        raise HTTPException(status_code=422, detail="End time must be later than start time")
    room = await db.classrooms.find_one({"id": body.classroom_id})
    if not room:
        raise HTTPException(status_code=404, detail="Classroom not found")
    if room.get("status") != "Available":
        raise HTTPException(status_code=409, detail=f"{room['code']} is under maintenance and cannot be booked")
    # The instructor on a booking is stamped server-side — never taken from the body for instructors.
    if user.get("access_role") == "admin":
        instructor_id = body.instructor_id or user.get("instructor_id")
        if not instructor_id:
            raise HTTPException(status_code=422, detail="Select an instructor for this reservation")
        if not await db.instructors.find_one({"id": instructor_id}):
            raise HTTPException(status_code=404, detail="Instructor not found")
    else:
        instructor_id = user.get("instructor_id")
        if not instructor_id:
            raise HTTPException(status_code=403, detail="This account has no instructor profile")
    if body.date < today_iso():
        raise HTTPException(status_code=422, detail="Reservation date cannot be in the past")
    await _assert_slot_free(body.classroom_id, body.date, body.start_time, body.end_time)
    doc = {
        "id": str(uuid.uuid4()),
        "booking_code": await _next_booking_code(),
        "instructor_id": instructor_id,
        "classroom_id": body.classroom_id,
        "date": body.date,
        "start_time": body.start_time,
        "end_time": body.end_time,
        "course_name": body.course_name.strip(),
        "purpose": body.purpose,
        "notes": (body.notes or "").strip(),
        "status": "Pending",
        "created_at": datetime.now(timezone.utc),
    }
    await db.bookings.insert_one(doc)
    instructors, classrooms = await _refs()
    return _with_refs(doc, instructors, classrooms)


@router.get("/{booking_id}", response_model=BookingOut)
async def get_booking(booking_id: str, user: dict = Depends(get_current_user)):
    doc = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    visible = doc is not None and (
        user.get("access_role") == "admin" or doc.get("instructor_id") == user.get("instructor_id")
    )
    if not visible:
        raise HTTPException(status_code=404, detail="Booking not found")  # 404, not 403: hides existence
    instructors, classrooms = await _refs()
    return _with_refs(doc, instructors, classrooms)


@router.put("/{booking_id}", response_model=BookingOut)
async def update_booking(booking_id: str, body: BookingUpdate, user: dict = Depends(get_current_user)):
    doc = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    if not _can_manage(user, doc):
        raise HTTPException(status_code=404, detail="Booking not found")
    if doc["status"] == "Cancelled":
        raise HTTPException(status_code=409, detail="Cancelled bookings cannot be edited — create a new reservation")
    if doc["status"] == "Completed" and user.get("access_role") != "admin":
        raise HTTPException(status_code=409, detail="Completed bookings cannot be edited")
    changes = body.model_dump(exclude_unset=True)
    merged = {**doc, **changes}
    if "purpose" in changes:
        _validate_purpose(merged["purpose"])
    if merged["end_time"] <= merged["start_time"]:
        raise HTTPException(status_code=422, detail="End time must be later than start time")
    if "classroom_id" in changes:
        room = await db.classrooms.find_one({"id": merged["classroom_id"]})
        if not room:
            raise HTTPException(status_code=404, detail="Classroom not found")
        if room.get("status") != "Available":
            raise HTTPException(status_code=409, detail=f"{room['code']} is under maintenance and cannot be booked")
    if {"classroom_id", "date", "start_time", "end_time"} & set(changes):
        await _assert_slot_free(
            merged["classroom_id"], merged["date"], merged["start_time"], merged["end_time"], exclude_id=booking_id
        )
    await db.bookings.update_one({"id": booking_id}, {"$set": {k: merged[k] for k in changes}})
    instructors, classrooms = await _refs()
    return _with_refs(merged, instructors, classrooms)


@router.patch("/{booking_id}/status", response_model=BookingOut)
async def change_status(booking_id: str, body: BookingStatusChange, user: dict = Depends(require_admin)):
    if body.status not in STATUSES:
        raise HTTPException(status_code=422, detail="Invalid status")
    doc = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": body.status}})
    instructors, classrooms = await _refs()
    return _with_refs({**doc, "status": body.status}, instructors, classrooms)


@router.patch("/{booking_id}/cancel", response_model=BookingOut)
async def cancel_booking(booking_id: str, user: dict = Depends(get_current_user)):
    doc = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    if not _can_manage(user, doc):
        raise HTTPException(status_code=404, detail="Booking not found")
    if doc["status"] in ("Cancelled", "Completed"):
        raise HTTPException(status_code=409, detail=f"Booking is already {doc['status'].lower()}")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "Cancelled"}})
    instructors, classrooms = await _refs()
    return _with_refs({**doc, "status": "Cancelled"}, instructors, classrooms)


@router.delete("/{booking_id}")
async def delete_booking(booking_id: str, user: dict = Depends(require_admin)):
    res = await db.bookings.delete_one({"id": booking_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"ok": True}
