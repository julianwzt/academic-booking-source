"""Login / logout / who-am-i. Sessions are httpOnly cookies — never tokens in JSON."""

from fastapi import APIRouter, Depends, HTTPException, Response

from lib.db import db
from lib.deps import get_current_user
from lib.security import SESSION_COOKIE, SESSION_TTL_DAYS, create_session, verify_password
from models.auth import LoginRequest, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_public(user: dict, instructor: dict | None = None) -> UserPublic:
    return UserPublic(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        access_role=user.get("access_role", "instructor"),
        instructor_id=user.get("instructor_id"),
        instructor_code=(instructor or {}).get("code"),
        department=(instructor or {}).get("department"),
    )


async def _instructor_for(user: dict) -> dict | None:
    iid = user.get("instructor_id")
    if not iid:
        return None
    return await db.instructors.find_one({"id": iid}, {"_id": 0})


@router.post("/login", response_model=UserPublic)
async def login(body: LoginRequest, response: Response):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = await create_session(user["id"])
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        max_age=SESSION_TTL_DAYS * 24 * 3600,
        path="/",
    )
    return _user_public(user, await _instructor_for(user))


@router.post("/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    await db.sessions.delete_many({"user_id": user["id"]})
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return _user_public(user, await _instructor_for(user))
