import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Users,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { apiErrorMessage, overlaps, PURPOSES, TIME_OPTIONS, todayIso } from "@/lib/bookings";
import type { Availability, Booking, Classroom, Instructor, UserPublic } from "@/lib/types";
import { useMe } from "@/hooks/useAuth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/ui/textarea";

function computeFreeSlots(items: { start_time: string; end_time: string }[]): { start: string; end: string }[] {
  const sorted = [...items].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const free: { start: string; end: string }[] = [];
  let cursor = "07:00";
  for (const b of sorted) {
    if (b.start_time > cursor) free.push({ start: cursor, end: b.start_time });
    if (b.end_time > cursor) cursor = b.end_time;
  }
  if (cursor < "18:00") free.push({ start: cursor, end: "18:00" });
  return free.filter((s) => s.end > s.start);
}

const COURSE_SUGGESTIONS = [
  "Object Oriented Programming",
  "Database Management Systems",
  "Software Engineering",
  "Computer Networks",
  "Data Structures",
  "Human Computer Interaction",
  "Information Systems",
  "Web Programming",
];

export default function NewReservation() {
  const { data: user } = useMe();
  const queryClient = useQueryClient();
  const isAdmin = user?.access_role === "admin";

  const instructorsQ = useQuery({
    queryKey: ["instructors"],
    queryFn: () => apiGet<Instructor[]>("/instructors"),
    enabled: !!isAdmin,
  });
  const classroomsQ = useQuery({ queryKey: ["classrooms"], queryFn: () => apiGet<Classroom[]>("/classrooms"), retry: 1 });

  const [instructorId, setInstructorId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("09:40");
  const [course, setCourse] = useState("");
  const [purpose, setPurpose] = useState<string>(PURPOSES[0] ?? "Other");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<Booking | null>(null);

  // Instructors always book as themselves — the field is locked for them.
  useEffect(() => {
    if (!isAdmin && user?.instructor_id) setInstructorId(user.instructor_id);
  }, [isAdmin, user?.instructor_id]);

  const availQ = useQuery({
    queryKey: ["availability", roomId, date],
    queryFn: () => apiGet<Availability>(`/bookings/availability?classroom_id=${roomId}&date=${date}`),
    enabled: !!roomId && !!date,
  });

  const room = classroomsQ.data?.find((r) => r.id === roomId);
  const dayItems = availQ.data?.bookings ?? [];
  const clash = dayItems.find((b) => overlaps(start, end, b.start_time, b.end_time));
  const freeSlots = useMemo(() => computeFreeSlots(dayItems), [dayItems]);

  const instructorLabel = (v: string) => {
    const i = instructorsQ.data?.find((x) => x.id === v);
    return i ? `${i.name} · ${i.code}` : user?.name ?? "Select instructor";
  };

  const reset = () => {
    setInstructorId(user?.instructor_id ?? "");
    setRoomId("");
    setDate(todayIso());
    setStart("08:00");
    setEnd("09:40");
    setCourse("");
    setPurpose(PURPOSES[0] ?? "Other");
    setNotes("");
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let problem: string | null = null;
    if (isAdmin && !instructorId) problem = "Select the instructor for this reservation.";
    else if (!roomId) problem = "Select a classroom.";
    else if (!date) problem = "Pick a reservation date.";
    else if (date < todayIso()) problem = "Reservation date cannot be in the past.";
    else if (course.trim().length < 2) problem = "Enter the course name.";
    else if (end <= start) problem = "End time must be later than start time.";
    else if (clash)
      problem = `Conflict: ${clash.course_name} already occupies ${clash.start_time}–${clash.end_time} on that date.`;
    if (problem) {
      setError(problem);
      toast.error(problem);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const created = await apiPost<Booking>("/bookings", {
        instructor_id: isAdmin ? instructorId : undefined,
        classroom_id: roomId,
        date,
        start_time: start,
        end_time: end,
        course_name: course.trim(),
        purpose,
        notes: notes.trim(),
      });
      setSuccess(created);
      toast.success(`Reservation ${created.booking_code} created`);
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["availability"] });
    } catch (err) {
      const msg = apiErrorMessage(err, "Unable to create the reservation.");
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-xl">
        <Card data-testid="booking-success-panel">
          <CardContent className="space-y-5 p-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Reservation Confirmed for Review</h2>
              <p className="mt-1 text-sm text-slate-500">
                Your booking was created with status <strong>Pending</strong> — Admin Akademik will confirm it.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
              <p className="mb-3 text-center font-mono text-lg font-bold text-blue-600">{success.booking_code}</p>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Classroom</dt>
                  <dd className="font-medium text-slate-800">
                    {success.classroom?.code} — {success.classroom?.name}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Date</dt>
                  <dd className="font-medium text-slate-800">{success.date}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Time</dt>
                  <dd className="font-mono text-slate-800">
                    {success.start_time}–{success.end_time}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Course</dt>
                  <dd className="font-medium text-slate-800">{success.course_name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Status</dt>
                  <dd>
                    <StatusBadge status={success.status} />
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <Link to="/schedule" className={buttonVariants({ variant: "outline" })} data-testid="booking-success-schedule-link">
                View Schedule
              </Link>
              <Button onClick={reset} data-testid="booking-success-again-button">
                <CalendarPlus className="h-4 w-4" /> Make Another Booking
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create New Reservation</h1>
        <p className="mt-1 text-slate-500">Reserve a classroom for your replacement class or additional session.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Form */}
        <Card className="lg:col-span-3">
          <CardContent className="p-6">
            <form onSubmit={submit} className="grid gap-5" data-testid="booking-form">
              <div className="grid gap-2">
                <Label>Instructor Name</Label>
                {isAdmin ? (
                  <Select value={instructorId} onValueChange={setInstructorId}>
                    <SelectTrigger data-testid="booking-form-instructor-select">
                      <SelectValue>{(v: string) => instructorLabel(v)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(instructorsQ.data ?? []).map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name} · {i.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={user?.name ?? ""} readOnly disabled data-testid="booking-form-instructor-locked" />
                )}
              </div>

              <div className="grid gap-2">
                <Label>Select Classroom</Label>
                <Select value={roomId} onValueChange={setRoomId}>
                  <SelectTrigger data-testid="booking-form-room-select">
                    <SelectValue>
                      {(v: string) => {
                        const r = classroomsQ.data?.find((x) => x.id === v);
                        return r ? `${r.code} · Floor ${r.floor} · ${r.capacity} seats` : "Select a TULT classroom";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(classroomsQ.data ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.code} · Floor {r.floor} · {r.capacity} seats · {r.type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Reservation Date</Label>
                  <Input
                    type="date"
                    min={todayIso()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    data-testid="booking-form-date-input"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Start Time</Label>
                  <Select value={start} onValueChange={setStart}>
                    <SelectTrigger data-testid="booking-form-start-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>End Time</Label>
                  <Select value={end} onValueChange={setEnd}>
                    <SelectTrigger data-testid="booking-form-end-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Course Name</Label>
                <Input
                  list="course-suggestions"
                  placeholder="e.g. Database Management Systems"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  data-testid="booking-form-course-input"
                />
                <datalist id="course-suggestions">
                  {COURSE_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div className="grid gap-2">
                <Label>Booking Purpose</Label>
                <Select value={purpose} onValueChange={setPurpose}>
                  <SelectTrigger data-testid="booking-form-purpose-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PURPOSES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Additional Notes (optional)</Label>
                <Textarea
                  rows={3}
                  placeholder="Special equipment requests, student instructions…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  data-testid="booking-form-notes-input"
                />
              </div>

              {error && (
                <p
                  className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"
                  data-testid="booking-form-error"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={reset} data-testid="booking-form-cancel-button">
                  <RotateCcw className="h-4 w-4" /> Cancel
                </Button>
                <Button type="submit" disabled={submitting} data-testid="booking-form-submit-button">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {submitting ? "Booking…" : "Confirm Booking"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Availability radar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Classroom Availability Radar</CardTitle>
            <CardDescription>Check open slots before you book — conflicts are blocked automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4" data-testid="availability-radar">
            {!roomId ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                Select a classroom to check its availability.
              </p>
            ) : (
              <>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">{room?.code}</span>
                    <StatusBadge status={availQ.data?.room_status ?? room?.status ?? "Available"} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{room?.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Floor {room?.floor} · {room?.capacity} seats · {room?.type}
                  </p>
                </div>

                {availQ.isFetching ? (
                  <p className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Checking existing reservations…
                  </p>
                ) : (
                  <>
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                        Occupied slots ({dayItems.length})
                      </p>
                      {dayItems.length === 0 ? (
                        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">
                          Fully free on {date} — every slot until 18:00 is open.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {dayItems.map((b) => (
                            <div
                              key={b.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs"
                              data-testid={`occupied-slot-${b.booking_code}`}
                            >
                              <div className="min-w-0">
                                <p className="truncate font-bold text-blue-900">
                                  {b.start_time}–{b.end_time} · {b.course_name}
                                </p>
                                <p className="truncate text-blue-600">
                                  {b.instructor_name} · {b.booking_code}
                                </p>
                              </div>
                              <StatusBadge status={b.status} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Open slots (click to use)</p>
                      <div className="flex flex-wrap gap-2">
                        {freeSlots.map((s) => (
                          <button
                            key={`${s.start}-${s.end}`}
                            type="button"
                            onClick={() => {
                              setStart(s.start);
                              setEnd(s.end);
                            }}
                            className="rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100"
                            data-testid={`free-slot-${s.start}-${s.end}`}
                          >
                            {s.start}–{s.end}
                          </button>
                        ))}
                        {freeSlots.length === 0 && (
                          <p className="text-sm text-slate-400">
                            No open slots left on this date — try another day or room.
                          </p>
                        )}
                      </div>
                    </div>

                    {clash ? (
                      <p
                        className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"
                        data-testid="availability-radar-conflict"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        Conflict: your selected {start}–{end} overlaps {clash.course_name} ({clash.start_time}–
                        {clash.end_time}). Pick a green slot instead.
                      </p>
                    ) : (
                      <p
                        className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700"
                        data-testid="availability-radar-status"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {start}–{end} is available — you're good to book.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
            <p className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-400">
              <Users className="h-3.5 w-3.5" />
              New bookings start as Pending until Admin Akademik confirms them.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
