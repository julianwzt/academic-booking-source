"""Password hashing + httpOnly-cookie session creation."""

import secrets
from datetime import datetime, timedelta

from passlib.context import CryptContext

from lib.db import db

pwd_context = CryptContext(schemes=["pbkdf2_sha256"])

SESSION_COOKIE = "cb_session"
SESSION_TTL_DAYS = 7


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


async def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    await db.sessions.insert_one({
        "token": token,
        "user_id": user_id,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(days=SESSION_TTL_DAYS),
    })
    return token
