"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "academic_booking")]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "users": [IndexModel([("email", ASCENDING)], name="email", unique=True)],
    "sessions": [
        IndexModel([("token", ASCENDING)], name="token", unique=True),
        IndexModel([("expires_at", ASCENDING)], name="expires_at", expireAfterSeconds=0),
    ],
    "instructors": [
        IndexModel([("code", ASCENDING)], name="code", unique=True),
        IndexModel([("email", ASCENDING)], name="email", unique=True),
    ],
    "classrooms": [
        IndexModel([("code", ASCENDING)], name="code", unique=True),
        IndexModel([("building", ASCENDING), ("floor", ASCENDING)], name="building_floor"),
    ],
    "bookings": [
        IndexModel([("booking_code", ASCENDING)], name="booking_code", unique=True),
        IndexModel([("classroom_id", ASCENDING), ("date", ASCENDING)], name="room_date"),
        IndexModel([("instructor_id", ASCENDING), ("date", DESCENDING)], name="instructor_date"),
    ],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
