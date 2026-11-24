// Hand-written mirrors of the backend Pydantic models (backend/models/*).
// Nothing infers across the HTTP boundary — keep these in sync in the same edit.

export type AccessRole = "instructor" | "admin";
export type BookingStatus = "Pending" | "Confirmed" | "Cancelled" | "Completed";

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  access_role: AccessRole;
  instructor_id: string | null;
  instructor_code: string | null;
  department: string | null;
}

export interface Instructor {
  id: string;
  code: string;
  name: string;
  email: string;
  role: string; // "Lecturer" | "Assistant Lecturer"
  department: string;
}

export interface Classroom {
  id: string;
  code: string;
  name: string;
  building: string;
  floor: number;
  capacity: number;
  type: string; // "Classroom" | "Laboratory"
  facilities: string[];
  status: string; // "Available" | "Maintenance"
}

export interface InstructorRef {
  id: string;
  name: string;
  code: string;
}

export interface ClassroomRef {
  id: string;
  code: string;
  name: string;
  floor: number;
  type: string;
}

export interface Booking {
  id: string;
  booking_code: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string;
  course_name: string;
  purpose: string;
  notes: string;
  status: BookingStatus;
  created_at: string;
  instructor_id: string;
  classroom_id: string;
  instructor: InstructorRef | null;
  classroom: ClassroomRef | null;
}

export interface DayBooking {
  id: string;
  booking_code: string;
  start_time: string;
  end_time: string;
  course_name: string;
  purpose: string;
  status: string;
  instructor_name: string;
}

export interface Availability {
  classroom_id: string;
  date: string;
  room_status: string;
  bookings: DayBooking[];
}

export interface Stats {
  total_classrooms: number;
  available_classrooms: number;
  active_bookings: number;
  my_reservations: number;
  total_capacity: number;
  floor6_count: number;
  floor7_count: number;
}
