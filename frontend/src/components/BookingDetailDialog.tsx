import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate } from "@/lib/bookings";
import type { Booking } from "@/lib/types";

function Row({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`text-right text-sm font-medium text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

export function BookingDetailDialog({
  booking,
  open,
  onOpenChange,
  footer,
}: {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  footer?: ReactNode;
}) {
  if (!booking) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="booking-detail-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span className="font-mono">{booking.booking_code}</span>
            <StatusBadge status={booking.status} />
          </DialogTitle>
          <DialogDescription>Reservation details</DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-slate-100">
          <Row
            label="Classroom"
            value={
              booking.classroom
                ? `${booking.classroom.code} — ${booking.classroom.name} (Floor ${booking.classroom.floor})`
                : booking.classroom_id
            }
          />
          <Row label="Instructor" value={booking.instructor ? `${booking.instructor.name} · ${booking.instructor.code}` : booking.instructor_id} />
          <Row label="Course" value={booking.course_name} />
          <Row label="Date" value={fmtDate(booking.date)} />
          <Row label="Time" value={`${booking.start_time} – ${booking.end_time}`} mono />
          <Row label="Purpose" value={<Badge variant="secondary">{booking.purpose}</Badge>} />
          {booking.notes ? <Row label="Notes" value={booking.notes} /> : null}
          <Row label="Created" value={fmtDate(booking.created_at.slice(0, 10))} />
        </div>
        {footer}
      </DialogContent>
    </Dialog>
  );
}
