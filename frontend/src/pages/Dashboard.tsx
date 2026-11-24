import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookmarkCheck,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Inbox,
  PlusCircle,
  School,
  Search,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { BOOKING_STATUSES, fmtDate, greeting, todayIso } from "@/lib/bookings";
import type { Booking, Classroom, Stats } from "@/lib/types";
import { useMe } from "@/hooks/useAuth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookingDetailDialog } from "@/components/BookingDetailDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 6;

function StatCard({
  testid,
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  testid: string;
  label: string;
  value: string | number;
  sub: string;
  icon: typeof School;
  tone: string;
}) {
  return (
    <Card size="sm" data-testid={testid}>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
        </div>
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", tone)}>
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: user } = useMe();
  const statsQ = useQuery({ queryKey: ["stats"], queryFn: () => apiGet<Stats>("/stats"), retry: 1 });
  const bookingsQ = useQuery({ queryKey: ["bookings"], queryFn: () => apiGet<Booking[]>("/bookings"), retry: 1 });
  const classroomsQ = useQuery({ queryKey: ["classrooms"], queryFn: () => apiGet<Classroom[]>("/classrooms"), retry: 1 });

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Booking | null>(null);

  const bookings = bookingsQ.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (dateFilter && b.date !== dateFilter) return false;
      if (roomFilter !== "all" && b.classroom_id !== roomFilter) return false;
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (q) {
        const hay = `${b.booking_code} ${b.course_name} ${b.instructor?.name ?? ""} ${b.classroom?.code ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [bookings, search, dateFilter, roomFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const upcoming = useMemo(() => {
    const today = todayIso();
    return bookings
      .filter((b) => (b.status === "Pending" || b.status === "Confirmed") && b.date >= today)
      .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
      .slice(0, 4);
  }, [bookings]);

  const stats = statsQ.data;
  const firstName = user?.name.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            {greeting()}, {firstName}!
          </h1>
          <p className="mt-1 text-slate-500">Manage your classroom reservations with ease.</p>
        </div>
        <Link to="/new-reservation" data-testid="dashboard-new-reservation-cta" className={buttonVariants()}>
          <PlusCircle className="h-4 w-4" />
          New Reservation
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          testid="dashboard-stat-total-rooms"
          label="Total Classrooms"
          value={stats ? stats.total_classrooms : "…"}
          sub="TULT · Floors 6 & 7"
          icon={School}
          tone="bg-blue-50 text-blue-600"
        />
        <StatCard
          testid="dashboard-stat-available-rooms"
          label="Available Right Now"
          value={stats ? stats.available_classrooms : "…"}
          sub="Free at this moment"
          icon={CheckCircle2}
          tone="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          testid="dashboard-stat-active-bookings"
          label="Active Bookings"
          value={stats ? stats.active_bookings : "…"}
          sub="Pending & confirmed"
          icon={CalendarClock}
          tone="bg-amber-50 text-amber-600"
        />
        <StatCard
          testid="dashboard-stat-my-reservations"
          label="My Reservations"
          value={stats ? stats.my_reservations : "…"}
          sub={user?.access_role === "admin" ? "All active records" : "Your active bookings"}
          icon={BookmarkCheck}
          tone="bg-indigo-50 text-indigo-600"
        />
      </div>

      {/* Booking schedule table */}
      <Card>
        <CardHeader>
          <CardTitle>Classroom Booking Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search course, instructor, room…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                data-testid="dashboard-search-input"
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
              data-testid="dashboard-date-filter"
            />
            <Select
              value={roomFilter}
              onValueChange={(v) => {
                setRoomFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="md:w-52" data-testid="dashboard-room-filter">
                <SelectValue>
                  {(v: string) => {
                    const r = classroomsQ.data?.find((x) => x.id === v);
                    return r ? r.code : "All Classrooms";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classrooms</SelectItem>
                {(classroomsQ.data ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.code} · Floor {r.floor}
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
              <SelectTrigger className="md:w-40" data-testid="dashboard-status-filter">
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

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <Table data-testid="dashboard-schedule-table">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Classroom Code</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time Slot</TableHead>
                  <TableHead>Instructor</TableHead>
                  <TableHead>Course / Purpose</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookingsQ.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-400">
                      Loading schedule…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-400">
                      <Inbox className="mx-auto mb-2 h-6 w-6" />
                      No reservations match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((b) => (
                    <TableRow key={b.id} data-testid={`booking-row-${b.booking_code}`}>
                      <TableCell className="font-mono text-xs font-bold text-slate-800">{b.classroom?.code}</TableCell>
                      <TableCell className="text-slate-600">{fmtDate(b.date)}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">
                        {b.start_time}–{b.end_time}
                      </TableCell>
                      <TableCell className="text-slate-600">{b.instructor?.name}</TableCell>
                      <TableCell>
                        <p className="font-medium text-slate-800">{b.course_name}</p>
                        <p className="text-xs text-slate-400">{b.purpose}</p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={b.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="xs" onClick={() => setDetail(b)} data-testid="dashboard-view-details-btn">
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              {filtered.length} reservation{filtered.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                data-testid="dashboard-prev-page"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <span className="text-xs">
                Page {safePage} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="xs"
                disabled={safePage >= pageCount}
                onClick={() => setPage(safePage + 1)}
                data-testid="dashboard-next-page"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming reservations */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Upcoming Reservations</h2>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Next up</span>
        </div>
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-400">
              <Inbox className="h-6 w-6" />
              No upcoming reservations — book a classroom to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {upcoming.map((b) => (
              <Card key={b.id} size="sm" data-testid={`upcoming-reservation-card-${b.booking_code}`}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-[#142B4D] px-2 py-1 font-mono text-xs font-bold text-white">
                      {b.classroom?.code}
                    </span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div>
                    <p className="truncate font-semibold text-slate-900">{b.course_name}</p>
                    <p className="text-xs text-slate-400">
                      {fmtDate(b.date)} · {b.start_time}–{b.end_time}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <span className="truncate text-xs text-slate-500">{b.instructor?.name}</span>
                    <Button variant="outline" size="xs" onClick={() => setDetail(b)} data-testid="upcoming-view-details-btn">
                      Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BookingDetailDialog booking={detail} open={!!detail} onOpenChange={(v) => !v && setDetail(null)} />
    </div>
  );
}
