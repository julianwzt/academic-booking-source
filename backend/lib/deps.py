"""Request principals — the only place a route learns who is calling.

Trust nothing from the request body/path/query for identity: the principal is
derived from the session cookie and looked up against the users collection.
"""

from datetime import datetime

from fastapi import Depends, HTTPException, Request

from lib.db import db


async def get_current_user(request: Request) -> dict:
    from lib.security import SESSION_COOKIE  # local import avoids a cycle

    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.sessions.find_one({"token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Session expired — please sign in again")
    expires_at = session.get("expires_at")
    if isinstance(expires_at, datetime) and expires_at < datetime.utcnow():
        await db.sessions.delete_one({"token": token})
        raise HTTPException(status_code=401, detail="Session expired — please sign in again")
    user = await db.users.find_one({"id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="Account not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("access_role") != "admin":
        raise HTTPException(status_code=403, detail="Admin Akademik access required")
    return user
