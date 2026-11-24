"""Auth boundary models — request/response bodies for login and identity."""

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class UserPublic(BaseModel):
    """The only user shape the frontend ever sees — never the password hash."""

    id: str
    email: str
    name: str
    access_role: str  # "instructor" | "admin"
    instructor_id: str | None = None
    instructor_code: str | None = None
    department: str | None = None
