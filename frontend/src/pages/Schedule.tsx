import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { apiGet } from "@/lib/api";
import {
  BOOKING_STATUSES,
  fmtDate,
  fmtDayShort,
  minutesSinceMidnight,
  monthGrid,
  monthLabel,
  overlaps,
  shiftDate,
  shiftMonth,
  todayIso,
  weekDates,
} from "@/lib/bookings";
import type { Booking, Classroom } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookingDetailDialog } from "@/components/BookingDetailDialog";
import { cn } from "@/lib/utils";

type ViewMode = "daily" | "weekly" | "monthly";

const START_HOUR = 7;
const END_HOUR = 18;
const PX_PER_MIN = 1;

const LEGEND = [
  { label: "Available", cls: "bg-green-100 border-green-300 text-green-700" },
  { label: "Booked", cls: "bg-blue-500 border-blue-600 text-white" },
  { label: "Pending", cls: "bg-amber-400 border-amber-500 text-amber-950" },
  { label: "Conflict / Unavailable", cls: "bg-red-100 border-red-400 text-red-700" },
];

function blockClass(status: string, conflict: boolean): string {
  if (conflict) return "bg-red-100 border-red-400 text-red-800 ring-2 ring-red-300";
  switch (status) {
    case "Confirmed":
      return "bg-blue-500/90 border-blue-600 text-white";
    case "Pending":
      return "bg-amber-400/90 border-amber-500 text-amber-950";
    case "Completed":
      return "bg-slate-300/80 border-slate-400 text-slate-700";
    default:
      return "bg-slate-100 border-slate-300 text-slate-600";
  }
}

function chipClass(status: string): string {
  switch (status) {
    case "Confirmed":
      return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200";
    case "Pending":
      return "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200";
    case "Completed":
      return "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200";
    case "Cancelled":
      return "bg-red-100 text-red-700 border-red-200 hover:bg-red-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function findConflicts(items: { id: string; start_time: string; end_time: string }[]): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a && b && overlaps(a.start_time, a.end_time, b.start_time, b.end_time)) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return ids;
}

export default function Schedule() {
  const [view, setView] = useState<ViewMode>("daily");
  const [date, setDate] = useState(todayIso());
  const [floor, setFloor] = useState("all");
  const [roomId, setRoomId] = useState("all");
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState<Booking | null>(null);

  const roomsQ = useQuery({ queryKey: ["classrooms"], queryFn: () => apiGet<Classroom[]>("/classrooms"), retry: 1 });
  const bookingsQ = useQuery({ queryKey: ["bookings"], queryFn: () => apiGet<Booking[]>("/bookings"), retry: 1 });

  const rooms = useMemo(
    () =>
      (roomsQ.data ?? [])
        .filter((r) => floor === "all" || r.floor === Number(floor))
        .filter((r) => roomId === "all" || r.id === roomId),
    [roomsQ.data, floor, roomId],
  );

  const matches = (b: Booking) => {
    if (roomId !== "all" && b.classroom_id !== roomId) return false;
    if (status !== "all" && b.status !== status) return false;
    if (floor !== "all" && b.classroom?.floor !== Number(floor)) return false;
    return true;
  };

  const bookings = bookingsQ.data ?? [];
  const activeBookings = bookings.filter((b) => b.status !== "Cancelled");
  const week = useMemo(() => weekDates(date), [date]);
  const month = useMemo(() => monthGrid(date), [date]);

  const nav = (dir: number) => {
    if (view === "daily") setDate(shiftDate(date, dir));
    else if (view === "weekly") setDate(shiftDate(date, dir * 7));
    else setDate(shiftMonth(date, dir));
  };
  const periodLabel =
    view === "daily"
      ? fmtDate(date)
      : view === "weekly"
        ? `${fmtDayShort(week[0] ?? date)} – ${fmtDayShort(week[6] ?? date)}`
        : monthLabel(date);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1" data-testid="schedule-view-switcher">
          {(["daily", "weekly", "monthly"] as const).map((v) => (
            <button
              key={v}
              data-testid={`schedule-view-${v}`}
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-sm font-medium capitalize transition-colors",
                view === v ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => nav(-1)} aria-label="Previous" data-testid="schedule-prev-button">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDate(todayIso())} data-testid="schedule-today-button">
            Today
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => nav(1)} aria-label="Next" data-testid="schedule-next-button">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-1 text-sm font-bold text-slate-800" data-testid="schedule-period-label">
            {periodLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            className="w-40"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            data-testid="schedule-date-picker"
          />
          <Select value={floor} onValueChange={setFloor}>
            <SelectTrigger className="w-32" data-testid="schedule-floor-filter">
              <SelectValue>{(v: string) => (v === "all" ? "All Floors" : `Floor ${v}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Floors</SelectItem>
              <SelectItem value="6">Floor 6</SelectItem>
              <SelectItem value="7">Floor 7</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger className="w-44" data-testid="schedule-room-filter">
              <SelectValue>
                {(v: string) => {
                  const r = roomsQ.data?.find((x) => x.id === v);
                  return r ? r.code : "All Classrooms";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classrooms</SelectItem>
              {(roomsQ.data ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36" data-testid="schedule-status-filter">
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
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className={cn("h-3 w-3 rounded border", l.cls)} />
            {l.label}
          </span>
        ))}
      </div>

      {bookingsQ.isLoading || roomsQ.isLoading ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-slate-400">Loading schedule board…</CardContent>
        </Card>
      ) : view === "daily" ? (
        <DailyBoard rooms={rooms} bookings={bookings} date={date} matches={matches} onSelect={setDetail} />
      ) : view === "weekly" ? (
        <WeeklyBoard rooms={rooms} bookings={bookings} week={week} matches={matches} onSelect={setDetail} onPickDay={(d) => { setDate(d); setView("daily"); }} />
      ) : (
        <MonthlyBoard bookings={bookings} month={month} matches={matches} onSelect={setDetail} onPickDay={(d) => { setDate(d); setView("daily"); }} selected={date} />
      )}

      <BookingDetailDialog booking={detail} open={!!detail} onOpenChange={(v) => !v && setDetail(null)} />
    </div>
  );
}

function DailyBoard({
  rooms,
  bookings,
  date,
  matches,
  onSelect,
}: {
  rooms: Classroom[];
  bookings: Booking[];
  date: string;
  matches: (b: Booking) => boolean;
  onSelect: (b: Booking) => void;
}) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const dayBookings = bookings.filter((b) => b.date === date && matches(b) && b.status !== "Cancelled");
  return (
    <Card>
      <CardContent className="p-0">
        {rooms.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">No rooms match the floor filter.</p>
        ) : (
          <div className="overflow-x-auto" data-testid="schedule-board-daily">
            <div className="flex min-w-[760px]">
              <div className="w-14 shrink-0 border-r border-slate-100 pt-12">
                {hours.map((h) => (
                  <div key={h} style={{ height: 60 * PX_PER_MIN }} className="relative">
                    <span className="absolute -top-2 right-2 text-[11px] text-slate-400">
                      {String(h).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>
              {rooms.map((room) => {
                const rb = dayBookings.filter((b) => b.classroom_id === room.id);
                const conflicts = findConflicts(rb);
                return (
                  <div key={room.id} className="min-w-[110px] flex-1 border-r border-slate-100 last:border-r-0">
                    <div className="flex h-12 items-center justify-center gap-1.5 border-b border-slate-100 bg-slate-50/70 px-2">
                      <span className="font-mono text-xs font-bold text-slate-700">{room.code}</span>
                      <span className="text-[10px] text-slate-400">F{room.floor}</span>
                    </div>
                    <div
                      className={cn("relative", rb.length === 0 ? "bg-emerald-50/50" : "bg-white")}
                      style={{ height: (END_HOUR - START_HOUR) * 60 * PX_PER_MIN }}
                    >
                      {hours.map((h, i) => (
                        <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: i * 60 * PX_PER_MIN }} />
                      ))}
                      {rb.map((b) => {
                        const top = (minutesSinceMidnight(b.start_time) - START_HOUR * 60) * PX_PER_MIN;
                        const height = Math.max(
                          26,
                          (minutesSinceMidnight(b.end_time) - minutesSinceMidnight(b.start_time)) * PX_PER_MIN,
                        );
                        const conflict = conflicts.has(b.id);
                        return (
                          <button
                            key={b.id}
                            onClick={() => onSelect(b)}
                            data-testid={`schedule-block-${b.booking_code}`}
                            style={{ top, height }}
                            className={cn(
                              "absolute inset-x-1 rounded-md border p-1.5 text-left text-[10px] leading-tight transition-transform hover:z-10 hover:scale-[1.02]",
                              blockClass(b.status, conflict),
                            )}
                          >
                            <p className="truncate font-bold">{b.course_name}</p>
                            <p className="truncate opacity-90">
                              {b.start_time}–{b.end_time}
                            </p>
                            {conflict && (
                              <p className="mt-0.5 flex items-center gap-1 font-bold text-red-600">
                                <AlertTriangle className="h-3 w-3" /> Conflict
                              </p>
                            )}
                          </button>
                        );
                      })}
                      {rb.length === 0 && (
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                          Free all day
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WeeklyBoard({
  rooms,
  bookings,
  week,
  matches,
  onSelect,
  onPickDay,
}: {
  rooms: Classroom[];
  bookings: Booking[];
  week: string[];
  matches: (b: Booking) => boolean;
  onSelect: (b: Booking) => void;
  onPickDay: (d: string) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto" data-testid="schedule-board-weekly">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-28">Room</TableHead>
                {week.map((d) => (
                  <TableHead key={d}>
                    <button onClick={() => onPickDay(d)} className="text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-blue-600">
                      {fmtDayShort(d)}
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell>
                    <span className="font-mono text-xs font-bold text-slate-800">{room.code}</span>
                    <span className="ml-1 text-[10px] text-slate-400">F{room.floor}</span>
                  </TableCell>
                  {week.map((d) => {
                    const cell = bookings
                      .filter((b) => b.classroom_id === room.id && b.date === d && matches(b) && b.status !== "Cancelled")
                      .sort((a, b) => a.start_time.localeCompare(b.start_time));
                    return (
                      <TableCell key={d} className="align-top">
                        {cell.length === 0 ? (
                          <span className="text-[11px] font-medium text-emerald-600">Free</span>
                        ) : (
                          <div className="space-y-1">
                            {cell.slice(0, 2).map((b) => (
                              <button
                                key={b.id}
                                onClick={() => onSelect(b)}
                                className={cn("block w-full rounded border px-1.5 py-1 text-left text-[10px] font-semibold leading-tight", chipClass(b.status))}
                              >
                                <span className="block truncate">
                                  {b.start_time} {b.course_name}
                                </span>
                              </button>
                            ))}
                            {cell.length > 2 && (
                              <button onClick={() => onPickDay(d)} className="text-[10px] font-semibold text-blue-600 hover:underline">
                                +{cell.length - 2} more
                              </button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyBoard({
  bookings,
  month,
  matches,
  onSelect,
  onPickDay,
  selected,
}: {
  bookings: Booking[];
  month: string[][];
  matches: (b: Booking) => boolean;
  onSelect: (b: Booking) => void;
  onPickDay: (d: string) => void;
  selected: string;
}) {
  const today = todayIso();
  return (
    <Card>
      <CardContent className="p-3" data-testid="schedule-board-monthly">
        <div className="grid grid-cols-7 gap-1">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {d}
            </div>
          ))}
          {month.flat().map((d) => {
            const inMonth = d.slice(0, 7) === selected.slice(0, 7);
            const cell = bookings.filter((b) => b.date === d && matches(b) && b.status !== "Cancelled");
            return (
              <button
                key={d}
                onClick={() => onPickDay(d)}
                className={cn(
                  "min-h-[86px] rounded-lg border p-1.5 text-left transition-colors",
                  inMonth ? "border-slate-200 bg-white hover:border-blue-300" : "border-transparent bg-slate-50 opacity-50",
                  d === today && "ring-2 ring-blue-500",
                )}
              >
                <span className={cn("text-[10px] font-bold", d === today ? "text-blue-600" : "text-slate-500")}>
                  {Number(d.slice(8, 10))}
                </span>
                <div className="mt-1 space-y-0.5">
                  {cell.slice(0, 3).map((b) => (
                    <span
                      key={b.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(b);
                      }}
                      className={cn("block truncate rounded border px-1 py-0.5 text-[9px] font-semibold leading-tight", chipClass(b.status))}
                    >
                      {b.classroom?.code} {b.start_time}
                    </span>
                  ))}
                  {cell.length > 3 && <span className="text-[9px] font-semibold text-slate-400">+{cell.length - 3} more</span>}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
