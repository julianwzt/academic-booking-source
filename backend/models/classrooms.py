"""Classroom models — TULT building, floors 6 & 7 only."""

from pydantic import BaseModel, Field

BUILDING = "TULT"
VALID_FLOORS = (6, 7)
VALID_TYPES = ("Classroom", "Laboratory")
VALID_STATUSES = ("Available", "Maintenance")
VALID_FACILITIES = ("Projector", "Whiteboard", "AC", "WiFi", "Computers")


class ClassroomCreate(BaseModel):
    code: str = Field(min_length=3, max_length=30)
    name: str = Field(min_length=2, max_length=120)
    building: str = BUILDING
    floor: int
    capacity: int = Field(ge=1, le=500)
    type: str
    facilities: list[str] = []
    status: str = "Available"


class ClassroomUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    building: str | None = None
    floor: int | None = None
    capacity: int | None = Field(default=None, ge=1, le=500)
    type: str | None = None
    facilities: list[str] | None = None
    status: str | None = None


class Classroom(BaseModel):
    id: str
    code: str
    name: str
    building: str
    floor: int
    capacity: int
    type: str
    facilities: list[str]
    status: str
