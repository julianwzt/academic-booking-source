"""Booking models + dashboard stats + availability payloads."""

from datetime import datetime

from pydantic import BaseModel, Field

PURPOSES = ("Replacement Class", "Additional Class", "Tutorial", "Practicum / Responsi", "Other")
STATUSES = ("Pending", "Confirmed", "Cancelled", "Completed")
# Statuses that block a room's slot — a Cancelled booking frees it again.
BLOCKING = ("Pending", "Confirmed")


class BookingCreate(BaseModel):
    instructor_id: str | None = None  # admin picks the instructor; instructors are stamped from the session
    classroom_id: str
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    start_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    course_name: str = Field(min_length=2, max_length=160)
    purpose: str
    notes: str = ""


class BookingUpdate(BaseModel):
    classroom_id: str | None = None
    date: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    course_name: str | None = None
    purpose: str | None = None
    notes: str | None = None


class BookingStatusChange(BaseModel):
    status: str


class InstructorRef(BaseModel):
    id: str
    name: str
    code: str


class ClassroomRef(BaseModel):
    id: str
    code: str
    name: str
    floor: int
    type: str


class BookingOut(BaseModel):
    id: str
    booking_code: str
    date: str
    start_time: str
    end_time: str
    course_name: str
    purpose: str
    notes: str
    status: str
    created_at: datetime
    instructor_id: str
    classroom_id: str
    instructor: InstructorRef | None = None
    classroom: ClassroomRef | None = None


class DayBooking(BaseModel):
    id: str
    booking_code: str
    start_time: str
    end_time: str
    course_name: str
    purpose: str
    status: str
    instructor_name: str


class Availability(BaseModel):
    classroom_id: str
    date: str
    room_status: str
    bookings: list[DayBooking]


class Stats(BaseModel):
    total_classrooms: int
    available_classrooms: int
    active_bookings: int
    my_reservations: int
    total_capacity: int
    floor6_count: int
    floor7_count: int
