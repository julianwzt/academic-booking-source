import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, Inbox, Pencil, Search, Trash2 } from "lucide-react";
import { apiGet, apiPatch } from "@/lib/api";
import { BOOKING_STATUSES, apiErrorMessage, fmtDate, todayIso } from "@/lib/bookings";
import type { Booking } from "@/lib/types";
import { useMe } from "@/hooks/useAuth";
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

export default function MyBookings() {
  const { data: user } = useMe();
  const queryClient = useQueryClient();
  const bookingsQ = useQuery({
    queryKey: ["bookings", "mine"],
    queryFn: () => apiGet<Booking[]>("/bookings?mine=1"),
    retry: 1,
  });

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Booking | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);

  const bookings = useMemo(() => bookingsQ.data ?? [], [bookingsQ.data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (dateFilter && b.date !== dateFilter) return false;
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (q) {
        const hay = `${b.booking_code} ${b.course_name} ${b.classroom?.code ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [bookings, search, dateFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const cancel = async () => {
    if (!cancelling) return;
    try {
      await apiPatch<Booking>(`/bookings/${cancelling.id}/cancel`);
      toast.success(`Booking ${cancelling.booking_code} cancelled — the slot is free again`);
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["availability"] });
      setCancelling(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Unable to cancel the booking."));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Bookings</h1>
        <p className="mt-1 text-slate-500">
          {user?.access_role === "admin"
            ? "Reservations made on behalf of instructors appear in Booking Management."
            : "Track, edit, and manage your classroom reservations."}
      </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search booking ID, course, room…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            data-testid="my-bookings-search-input"
          />
        </div>
        <Input
          type="date"
          className="md:w-44"
          value={dateFilter}
          onChange={(e) => {
            setDateFilter(e.target.value);
            setPage(1);
          }}
          data-testid="my-bookings-date-filter"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="md:w-40" data-testid="my-bookings-status-filter">
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
          <Table data-testid="my-bookings-table">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Booking ID</TableHead>
                <TableHead>Classroom</TableHead>
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
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-400">
                    Loading your reservations…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-400">
                    <Inbox className="mx-auto mb-2 h-6 w-6" />
                    No bookings yet — create your first reservation.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((b) => (
                  <TableRow key={b.id} data-testid={`my-booking-row-${b.booking_code}`}>
                    <TableCell className="font-mono text-xs font-bold text-slate-800">{b.booking_code}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-700">{b.classroom?.code}</TableCell>
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
                        <Button variant="ghost" size="icon-xs" onClick={() => setDetail(b)} title="View details" data-testid="my-bookings-view-btn">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {(b.status === "Pending" || b.status === "Confirmed") && (
                          <>
                            <Button variant="ghost" size="icon-xs" onClick={() => setEditing(b)} title="Edit booking" data-testid="my-bookings-edit-btn">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => setCancelling(b)}
                              title="Cancel booking"
                              className="text-red-600 hover:bg-red-50"
                              data-testid="my-bookings-cancel-btn"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 text-sm text-slate-500">
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

      <BookingDetailDialog booking={detail} open={!!detail} onOpenChange={(v) => !v && setDetail(null)} />
      <BookingEditDialog booking={editing} open={!!editing} onOpenChange={(v) => !v && setEditing(null)} />

      <Dialog open={!!cancelling} onOpenChange={(v) => !v && setCancelling(null)}>
        <DialogContent className="sm:max-w-md" data-testid="cancel-booking-dialog">
          <DialogHeader>
            <DialogTitle>Cancel this reservation?</DialogTitle>
            <DialogDescription>
              {cancelling?.classroom?.code} · {cancelling?.date} · {cancelling?.start_time}–{cancelling?.end_time} —{" "}
              {cancelling?.course_name}. The time slot will be released for other instructors.
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
    </div>
  );
}
