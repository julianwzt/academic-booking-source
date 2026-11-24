"""Import semua file JSON di folder ini ke MongoDB lokal (database: academic_booking)."""
import asyncio
import json
from datetime import datetime
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "academic_booking"

def parse_extended_json(obj):
    if isinstance(obj, dict):
        if list(obj.keys()) == ["$date"]:
            return datetime.fromisoformat(obj["$date"].replace("Z", "+00:00"))
        return {k: parse_extended_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [parse_extended_json(v) for v in obj]
    return obj

async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    base = Path(__file__).parent
    for col in ["classrooms", "instructors", "users", "bookings", "counters"]:
        data = parse_extended_json(json.loads((base / f"{col}.json").read_text(encoding="utf-8")))
        await db[col].delete_many({})
        if data:
            await db[col].insert_many(data)
        print(f"Imported {col}: {len(data)} dokumen")
    client.close()
    print("Selesai! Database academic_booking siap dipakai.")

if __name__ == "__main__":
    asyncio.run(main())
