import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { apiGet, apiPut } from "@/lib/api";
import { apiErrorMessage, overlaps, PURPOSES, TIME_OPTIONS } from "@/lib/bookings";
import type { Availability, Booking, Classroom, Instructor } from "@/lib/types";
import { useMe } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function BookingEditDialog({
  booking,
  open,
  onOpenChange,
}: {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: user } = useMe();
  const isAdmin = user?.access_role === "admin";

  const [form, setForm] = useState({
    classroom_id: "",
    date: "",
    start_time: "",
    end_time: "",
    course_name: "",
    purpose: PURPOSES[0] as string,
    notes: "",
  });

  useEffect(() => {
    if (booking && open) {
      setForm({
        classroom_id: booking.classroom_id,
        date: booking.date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        course_name: booking.course_name,
        purpose: booking.purpose,
        notes: booking.notes,
      });
    }
  }, [booking, open]);

  const classroomsQ = useQuery({
    queryKey: ["classrooms"],
    queryFn: () => apiGet<Classroom[]>("/classrooms"),
    enabled: open,
  });
  const availQ = useQuery({
    queryKey: ["availability", form.classroom_id, form.date],
    queryFn: () => apiGet<Availability>(`/bookings/availability?classroom_id=${form.classroom_id}&date=${form.date}`),
    enabled: open && !!form.classroom_id && !!form.date,
  });

  const room = classroomsQ.data?.find((r) => r.id === form.classroom_id);
  const clash = (availQ.data?.bookings ?? []).find(
    (b) => b.id !== booking?.id && overlaps(form.start_time, form.end_time, b.start_time, b.end_time),
  );
  const roomLabel = (v: string) => {
    const r = classroomsQ.data?.find((x) => x.id === v);
    return r ? `${r.code} · Floor ${r.floor} · ${r.capacity} seats` : "Select classroom";
  };

  const save = async () => {
    if (!booking) return;
    if (!form.classroom_id || !form.date || !form.course_name.trim()) {
      toast.error("Classroom, date and course name are required.");
      return;
    }
    if (form.end_time <= form.start_time) {
      toast.error("End time must be later than start time.");
      return;
    }
    if (clash) {
      toast.error(`Conflict: ${clash.booking_code} occupies ${clash.start_time}–${clash.end_time} on that date.`);
      return;
    }
    try {
      await apiPut<Booking>(`/bookings/${booking.id}`, {
        classroom_id: form.classroom_id,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        course_name: form.course_name.trim(),
        purpose: form.purpose,
        notes: form.notes.trim(),
      });
      toast.success(`Booking ${booking.booking_code} updated`);
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["availability"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Unable to update the booking."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg" data-testid="booking-edit-dialog">
        <DialogHeader>
          <DialogTitle>
            Edit Booking <span className="font-mono text-slate-500">{booking?.booking_code}</span>
          </DialogTitle>
          <DialogDescription>Changes are re-validated against existing reservations.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Classroom</Label>
            <Select value={form.classroom_id} onValueChange={(v) => setForm((f) => ({ ...f, classroom_id: v }))}>
              <SelectTrigger data-testid="booking-edit-room-select">
                <SelectValue>{roomLabel(form.classroom_id)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(classroomsQ.data ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.code} · Floor {r.floor} · {r.capacity} seats
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                min={booking?.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                data-testid="booking-edit-date-input"
              />
            </div>
            <div className="grid gap-2">
              <Label>Start</Label>
              <Select value={form.start_time} onValueChange={(v) => setForm((f) => ({ ...f, start_time: v }))}>
                <SelectTrigger data-testid="booking-edit-start-time">
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
              <Label>End</Label>
              <Select value={form.end_time} onValueChange={(v) => setForm((f) => ({ ...f, end_time: v }))}>
                <SelectTrigger data-testid="booking-edit-end-time">
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
              value={form.course_name}
              onChange={(e) => setForm((f) => ({ ...f, course_name: e.target.value }))}
              data-testid="booking-edit-course-input"
            />
          </div>
          <div className="grid gap-2">
            <Label>Purpose</Label>
            <Select value={form.purpose} onValueChange={(v) => setForm((f) => ({ ...f, purpose: v }))}>
              <SelectTrigger data-testid="booking-edit-purpose-select">
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
            <Label>Notes (optional)</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              data-testid="booking-edit-notes-input"
            />
          </div>

          {availQ.isFetching ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking availability…
            </p>
          ) : clash ? (
            <p
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"
              data-testid="booking-edit-conflict-warning"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Conflict: {clash.course_name} occupies {clash.start_time}–{clash.end_time} ({clash.booking_code}).
            </p>
          ) : (
            <p className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              {room ? `${room.code} is free at ${form.start_time}–${form.end_time}.` : "Selected slot is available."}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="booking-edit-cancel-button">
            Cancel
          </Button>
          <Button onClick={save} data-testid="booking-edit-save-button">
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
