"""Dashboard statistics — computed server-side against the APP_TZ clock."""

import os
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends

from lib.db import db
from lib.dates import today_iso
from lib.deps import get_current_user
from models.bookings import BLOCKING, Stats

router = APIRouter(prefix="/stats", tags=["stats"])


def _now_hhmm() -> str:
    zone = ZoneInfo(os.environ.get("APP_TZ", "UTC"))
    return datetime.now(zone).strftime("%H:%M")


@router.get("", response_model=Stats)
async def stats(user: dict = Depends(get_current_user)):
    today = today_iso()
    now_hm = _now_hhmm()

    classrooms = await db.classrooms.find({}, {"_id": 0}).to_list(500)
    busy_now = set(
        await db.bookings.distinct(
            "classroom_id",
            {
                "date": today,
                "status": {"$in": list(BLOCKING)},
                "start_time": {"$lte": now_hm},
                "end_time": {"$gt": now_hm},
            },
        )
    )
    available = sum(1 for r in classrooms if r.get("status") == "Available" and r["id"] not in busy_now)
    active = await db.bookings.count_documents({"status": {"$in": list(BLOCKING)}, "date": {"$gte": today}})
    if user.get("access_role") == "admin":
        mine = await db.bookings.count_documents({"status": {"$ne": "Cancelled"}})
    else:
        mine = await db.bookings.count_documents(
            {"instructor_id": user.get("instructor_id"), "status": {"$ne": "Cancelled"}}
        )

    return Stats(
        total_classrooms=len(classrooms),
        available_classrooms=available,
        active_bookings=active,
        my_reservations=mine,
        total_capacity=sum(r.get("capacity", 0) for r in classrooms),
        floor6_count=sum(1 for r in classrooms if r.get("floor") == 6),
        floor7_count=sum(1 for r in classrooms if r.get("floor") == 7),
    )
