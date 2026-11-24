"""Instructor (Dosen / Asdos) directory models."""

from pydantic import BaseModel, EmailStr, Field

INSTRUCTOR_ROLES = ("Lecturer", "Assistant Lecturer")


class InstructorCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    role: str
    department: str = Field(min_length=2, max_length=120)
    password: str = Field(default="booking123", min_length=6)


class InstructorUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    role: str | None = None
    department: str | None = None
    password: str | None = Field(default=None, min_length=6)


class Instructor(BaseModel):
    id: str
    code: str
    name: str
    email: str
    role: str
    department: str
