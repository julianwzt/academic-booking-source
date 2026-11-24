import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Eye, Inbox, Pencil, Search, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPatch } from "@/lib/api";
import { BOOKING_STATUSES, apiErrorMessage, fmtDate } from "@/lib/bookings";
import type { Booking, Classroom, Instructor } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookingDetailDialog } from "@/components/BookingDetailDialog";
import { BookingEditDialog } from "@/components/BookingEditDialog";
import { StatusBadge } from "@/components/StatusBadge";

const PAGE_SIZE = 8;

export default function AdminBookings() {
  const queryClient = useQueryClient();
  const bookingsQ = useQuery({ queryKey: ["bookings"], queryFn: () => apiGet<Booking[]>("/bookings"), retry: 1 });
  const classroomsQ = useQuery({ queryKey: ["classrooms"], queryFn: () => apiGet<Classroom[]>("/classrooms"), retry: 1 });
  const instructorsQ = useQuery({ queryKey: ["instructors"], queryFn: () => apiGet<Instructor[]>("/instructors"), retry: 1 });

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("all");
  const [instructorFilter, setInstructorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Booking | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [deleting, setDeleting] = useState<Booking | null>(null);

  const bookings = bookingsQ.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (dateFilter && b.date !== dateFilter) return false;
      if (roomFilter !== "all" && b.classroom_id !== roomFilter) return false;
      if (instructorFilter !== "all" && b.instructor_id !== instructorFilter) return false;
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (q && !`${b.booking_code} ${b.course_name} ${b.instructor?.name ?? ""} ${b.classroom?.code ?? ""}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [bookings, search, dateFilter, roomFilter, instructorFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    queryClient.invalidateQueries({ queryKey: ["availability"] });
  };

  const approve = async (b: Booking) => {
    try {
      await apiPatch<Booking>(`/bookings/${b.id}/status`, { status: "Confirmed" });
      toast.success(`Booking ${b.booking_code} confirmed`);
      invalidate();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Unable to approve the booking."));
    }
  };

  const cancel = async () => {
    if (!cancelling) return;
    try {
      await apiPatch<Booking>(`/bookings/${cancelling.id}/cancel`);
      toast.success(`Booking ${cancelling.booking_code} cancelled`);
      invalidate();
      setCancelling(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Unable to cancel the booking."));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await apiDelete(`/bookings/${deleting.id}`);
      toast.success(`Booking ${deleting.booking_code} deleted`);
      invalidate();
      setDeleting(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Unable to delete the booking."));
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Booking Management</h1>
        <p className="mt-1 text-slate-500">Monitor, approve, and manage every reservation across TULT floors 6 & 7.</p>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search booking, course, instructor…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            data-testid="admin-bookings-search-input"
          />
        </div>
        <Input
          type="date"
          className="xl:w-40"
          value={dateFilter}
          onChange={(e) => {
            setDateFilter(e.target.value);
            setPage(1);
          }}
          data-testid="admin-bookings-date-filter"
        />
        <Select
          value={roomFilter}
          onValueChange={(v) => {
            setRoomFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="xl:w-40" data-testid="admin-bookings-room-filter">
            <SelectValue>
              {(v: string) => classroomsQ.data?.find((r) => r.id === v)?.code ?? "All Classrooms"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classrooms</SelectItem>
            {(classroomsQ.data ?? []).map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={instructorFilter}
          onValueChange={(v) => {
            setInstructorFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="xl:w-48" data-testid="admin-bookings-instructor-filter">
            <SelectValue>
              {(v: string) => instructorsQ.data?.find((i) => i.id === v)?.name ?? "All Instructors"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Instructors</SelectItem>
            {(instructorsQ.data ?? []).map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="xl:w-36" data-testid="admin-bookings-status-filter">
            <SelectValue>{(v: string) => (v === "all" ? "All Statuses" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {BOOKING_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table data-testid="admin-bookings-table">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Booking ID</TableHead>
                <TableHead>Classroom</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookingsQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-slate-400">
                    Loading reservations…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-slate-400">
                    <Inbox className="mx-auto mb-2 h-6 w-6" />
                    No reservations match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((b) => (
                  <TableRow key={b.id} data-testid={`admin-booking-row-${b.booking_code}`}>
                    <TableCell className="font-mono text-xs font-bold text-slate-800">{b.booking_code}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-700">{b.classroom?.code}</TableCell>
                    <TableCell className="text-slate-600">{b.instructor?.name}</TableCell>
                    <TableCell className="text-slate-600">{fmtDate(b.date)}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">
                      {b.start_time}–{b.end_time}
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">{b.course_name}</TableCell>
                    <TableCell className="text-xs text-slate-500">{b.purpose}</TableCell>
                    <TableCell>
                      <StatusBadge status={b.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {b.status === "Pending" && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => approve(b)}
                            title="Approve booking"
                            className="text-green-600 hover:bg-green-50"
                            data-testid="admin-booking-approve-btn"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-xs" onClick={() => setDetail(b)} title="View details" data-testid="admin-booking-view-btn">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {(b.status === "Pending" || b.status === "Confirmed") && (
                          <Button variant="ghost" size="icon-xs" onClick={() => setEditing(b)} title="Edit booking" data-testid="admin-booking-edit-btn">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {(b.status === "Pending" || b.status === "Confirmed") && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setCancelling(b)}
                            title="Cancel booking"
                            className="text-amber-600 hover:bg-amber-50"
                            data-testid="admin-booking-cancel-btn"
                          >
                            ✕
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setDeleting(b)}
                          title="Delete booking"
                          className="text-red-600 hover:bg-red-50"
                          data-testid="admin-booking-delete-btn"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {filtered.length} reservation{filtered.length === 1 ? "" : "s"}
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="xs" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              Prev
            </Button>
            <span className="text-xs">
              Page {safePage} of {pageCount}
            </span>
            <Button variant="outline" size="xs" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>
              Next
            </Button>
          </div>
        )}
      </div>

      <BookingDetailDialog booking={detail} open={!!detail} onOpenChange={(v) => !v && setDetail(null)} />
      <BookingEditDialog booking={editing} open={!!editing} onOpenChange={(v) => !v && setEditing(null)} />

      <Dialog open={!!cancelling} onOpenChange={(v) => !v && setCancelling(null)}>
        <DialogContent className="sm:max-w-md" data-testid="admin-cancel-dialog">
          <DialogHeader>
            <DialogTitle>Cancel booking {cancelling?.booking_code}?</DialogTitle>
            <DialogDescription>
              {cancelling?.classroom?.code} · {cancelling?.date} · {cancelling?.start_time}–{cancelling?.end_time}. The
              instructor keeps the record but the slot is released.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)} data-testid="confirm-dialog-cancel-button">
              Keep Booking
            </Button>
            <Button variant="destructive" onClick={cancel} data-testid="confirm-dialog-submit-button">
              Yes, Cancel Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="sm:max-w-md" data-testid="admin-delete-dialog">
          <DialogHeader>
            <DialogTitle>Delete booking {deleting?.booking_code}?</DialogTitle>
            <DialogDescription>
              This permanently removes the reservation record for {deleting?.classroom?.code} on {deleting?.date}. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} data-testid="confirm-dialog-cancel-button">
              Keep Booking
            </Button>
            <Button variant="destructive" onClick={remove} data-testid="confirm-dialog-submit-button">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
