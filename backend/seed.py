"""Idempotent seed: 8 TULT rooms (floors 6-7), 5 instructors + 1 admin, realistic bookings.

Run: cd /app/backend && python seed.py
Safe to re-run — non-empty collections are left untouched so admin-made CRUD
changes survive.
"""

import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone

from lib.db import db, ensure_indexes
from lib.security import hash_password

INSTRUCTOR_PASSWORD = "password123"
ADMIN_EMAIL = "admin@telkom.ac.id"
ADMIN_PASSWORD = "admin123"

CLASSROOMS = [
    {"code": "TULT-06-01", "name": "Ruang Kelas 601", "building": "TULT", "floor": 6, "capacity": 40,
     "type": "Classroom", "facilities": ["Projector", "Whiteboard", "AC", "WiFi"], "status": "Available"},
    {"code": "TULT-06-02", "name": "Ruang Kelas 602", "building": "TULT", "floor": 6, "capacity": 40,
     "type": "Classroom", "facilities": ["Projector", "Whiteboard", "AC", "WiFi"], "status": "Available"},
    {"code": "TULT-06-03", "name": "Ruang Kelas 603", "building": "TULT", "floor": 6, "capacity": 50,
     "type": "Classroom", "facilities": ["Projector", "Whiteboard", "AC", "WiFi"], "status": "Available"},
    {"code": "TULT-06-04", "name": "Laboratorium 604", "building": "TULT", "floor": 6, "capacity": 30,
     "type": "Laboratory", "facilities": ["Computers", "Projector", "AC", "WiFi"], "status": "Available"},
    {"code": "TULT-07-01", "name": "Ruang Kelas 701", "building": "TULT", "floor": 7, "capacity": 40,
     "type": "Classroom", "facilities": ["Projector", "Whiteboard", "AC", "WiFi"], "status": "Available"},
    {"code": "TULT-07-02", "name": "Ruang Kelas 702", "building": "TULT", "floor": 7, "capacity": 40,
     "type": "Classroom", "facilities": ["Projector", "Whiteboard", "AC", "WiFi"], "status": "Available"},
    {"code": "TULT-07-03", "name": "Ruang Kelas 703", "building": "TULT", "floor": 7, "capacity": 50,
     "type": "Classroom", "facilities": ["Projector", "Whiteboard", "AC", "WiFi"], "status": "Available"},
    {"code": "TULT-07-04", "name": "Laboratorium 704", "building": "TULT", "floor": 7, "capacity": 30,
     "type": "Laboratory", "facilities": ["Computers", "Projector", "AC", "WiFi"], "status": "Available"},
]

INSTRUCTORS = [
    {"code": "INST001", "name": "Dr. Andi Pratama", "email": "andi.pratama@telkom.ac.id",
     "role": "Lecturer", "department": "Informatics Engineering"},
    {"code": "INST002", "name": "Siti Rahmawati, S.T.", "email": "siti.rahmawati@telkom.ac.id",
     "role": "Lecturer", "department": "Information Systems"},
    {"code": "INST003", "name": "Budi Santoso", "email": "budi.santoso@telkom.ac.id",
     "role": "Assistant Lecturer", "department": "Computer Science"},
    {"code": "INST004", "name": "Nadia Putri", "email": "nadia.putri@telkom.ac.id",
     "role": "Assistant Lecturer", "department": "Information Systems"},
    {"code": "INST005", "name": "Alex Hartanto", "email": "alex.hartanto@telkom.ac.id",
     "role": "Lecturer", "department": "Informatics Engineering"},
]

# (room_code, instructor_code, day_offset, start, end, course, purpose, status)
BOOKINGS = [
    ("TULT-06-01", "INST001", -10, "08:00", "09:40", "Object Oriented Programming", "Replacement Class", "Completed"),
    ("TULT-06-01", "INST002", +2, "10:00", "11:40", "Database Management Systems", "Additional Class", "Confirmed"),
    ("TULT-06-01", "INST003", +5, "13:00", "14:40", "Human Computer Interaction", "Tutorial", "Pending"),
    ("TULT-06-02", "INST004", -7, "13:00", "14:40", "Web Programming", "Replacement Class", "Completed"),
    ("TULT-06-02", "INST005", +1, "08:00", "09:40", "Data Structures", "Additional Class", "Confirmed"),
    ("TULT-06-02", "INST005", +8, "10:00", "11:40", "Software Engineering", "Tutorial", "Pending"),
    ("TULT-06-02", "INST001", +8, "15:00", "16:40", "Information Systems", "Additional Class", "Cancelled"),
    ("TULT-06-03", "INST002", -3, "10:00", "11:40", "Computer Networks", "Replacement Class", "Completed"),
    ("TULT-06-03", "INST003", +3, "08:00", "09:40", "Software Engineering", "Additional Class", "Confirmed"),
    ("TULT-06-03", "INST004", +6, "10:00", "11:40", "Object Oriented Programming", "Additional Class", "Confirmed"),
    ("TULT-06-04", "INST005", -5, "08:00", "09:40", "Database Management Systems", "Practicum / Responsi", "Completed"),
    ("TULT-06-04", "INST002", +2, "13:00", "14:40", "Computer Networks", "Practicum / Responsi", "Pending"),
    ("TULT-06-04", "INST005", +4, "15:00", "16:40", "Object Oriented Programming", "Tutorial", "Confirmed"),
    ("TULT-07-01", "INST003", -2, "10:00", "11:40", "Information Systems", "Replacement Class", "Completed"),
    ("TULT-07-01", "INST001", +1, "13:00", "14:40", "Human Computer Interaction", "Additional Class", "Confirmed"),
    ("TULT-07-01", "INST005", +9, "08:00", "09:40", "Web Programming", "Replacement Class", "Pending"),
    ("TULT-07-02", "INST004", -8, "15:00", "16:40", "Data Structures", "Additional Class", "Completed"),
    ("TULT-07-02", "INST005", +3, "10:00", "11:40", "Database Management Systems", "Additional Class", "Confirmed"),
    ("TULT-07-02", "INST003", +7, "13:00", "14:40", "Software Engineering", "Tutorial", "Pending"),
    ("TULT-07-03", "INST001", -4, "08:00", "09:40", "Computer Networks", "Replacement Class", "Completed"),
    ("TULT-07-03", "INST002", +2, "08:00", "09:40", "Human Computer Interaction", "Additional Class", "Confirmed"),
    ("TULT-07-03", "INST004", +5, "15:00", "16:40", "Database Management Systems", "Tutorial", "Confirmed"),
    ("TULT-07-04", "INST003", -6, "13:00", "14:40", "Object Oriented Programming", "Practicum / Responsi", "Completed"),
    ("TULT-07-04", "INST001", +4, "08:00", "09:40", "Data Structures", "Practicum / Responsi", "Confirmed"),
    ("TULT-07-04", "INST005", +10, "13:00", "14:40", "Web Programming", "Tutorial", "Pending"),
]


async def seed_classrooms() -> None:
    if await db.classrooms.count_documents({}) > 0:
        print("classrooms: already seeded, skipping")
        return
    for room in CLASSROOMS:
        await db.classrooms.insert_one({**room, "id": str(uuid.uuid4())})
    print(f"classrooms: seeded {len(CLASSROOMS)}")


async def seed_instructors() -> dict:
    codes: dict[str, str] = {}
    if await db.instructors.count_documents({}) > 0:
        print("instructors: already seeded, skipping")
        async for doc in db.instructors.find({}, {"_id": 0, "code": 1, "id": 1}):
            codes[doc["code"]] = doc["id"]
        return codes
    for ins in INSTRUCTORS:
        iid = str(uuid.uuid4())
        codes[ins["code"]] = iid
        await db.instructors.insert_one({**ins, "id": iid})
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ins["email"],
            "name": ins["name"],
            "password_hash": hash_password(INSTRUCTOR_PASSWORD),
            "access_role": "instructor",
            "instructor_id": iid,
            "created_at": datetime.now(timezone.utc),
        })
    print(f"instructors: seeded {len(INSTRUCTORS)} (+ login accounts, password '{INSTRUCTOR_PASSWORD}')")
    return codes


async def seed_admin() -> None:
    if await db.users.find_one({"email": ADMIN_EMAIL}):
        print("admin: already seeded, skipping")
        return
    await db.users.insert_one({
        "id": str(uuid.uuid4()),
        "email": ADMIN_EMAIL,
        "name": "Rina Wijaya",
        "password_hash": hash_password(ADMIN_PASSWORD),
        "access_role": "admin",
        "instructor_id": None,
        "created_at": datetime.now(timezone.utc),
    })
    print(f"admin: seeded ({ADMIN_EMAIL} / {ADMIN_PASSWORD})")


async def seed_bookings(codes: dict[str, str]) -> None:
    if await db.bookings.count_documents({}) > 0:
        print("bookings: already seeded, skipping")
        return
    rooms = {d["code"]: d["id"] async for d in db.classrooms.find({}, {"_id": 0, "code": 1, "id": 1})}
    today = date.today()
    year = datetime.now(timezone.utc).year
    now = datetime.now(timezone.utc)
    for n, (room_code, ins_code, offset, start, end, course, purpose, status) in enumerate(BOOKINGS, start=1):
        await db.bookings.insert_one({
            "id": str(uuid.uuid4()),
            "booking_code": f"BK-{year}-{n:04d}",
            "instructor_id": codes[ins_code],
            "classroom_id": rooms[room_code],
            "date": (today + timedelta(days=offset)).isoformat(),
            "start_time": start,
            "end_time": end,
            "course_name": course,
            "purpose": purpose,
            "notes": "",
            "status": status,
            "created_at": now - timedelta(days=abs(offset) // 2 + 1),
        })
    await db.counters.update_one(
        {"_id": f"bookings-{year}"}, {"$set": {"seq": len(BOOKINGS)}}, upsert=True
    )
    print(f"bookings: seeded {len(BOOKINGS)}")


async def main() -> None:
    await ensure_indexes()
    await seed_classrooms()
    codes = await seed_instructors()
    await seed_admin()
    await seed_bookings(codes)
    print("seed complete")


if __name__ == "__main__":
    asyncio.run(main())
