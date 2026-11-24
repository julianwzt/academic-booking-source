import { format, parseISO } from "date-fns";
import { ApiError } from "./api";

export const BOOKING_STATUSES = ["Pending", "Confirmed", "Cancelled", "Completed"] as const;
export const PURPOSES = [
  "Replacement Class",
  "Additional Class",
  "Tutorial",
  "Practicum / Responsi",
  "Other",
] as const;

// Bookable 20-minute steps from 07:00 to 18:00 — the 08:00–09:40 / 10:00–11:40 /
// 13:00–14:40 / 15:00–16:40 lecture slots land exactly on these boundaries.
function buildTimeOptions(): string[] {
  const out: string[] = [];
  for (let m = 7 * 60; m <= 18 * 60; m += 20) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}
export const TIME_OPTIONS = buildTimeOptions();

export const FACILITY_OPTIONS = ["Projector", "Whiteboard", "AC", "WiFi", "Computers"] as const;

/** Half-open interval overlap: [aStart, aEnd) meets [bStart, bEnd). */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function minutesSinceMidnight(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

export function fmtDate(iso: string): string {
  try {
    return format(parseISO(iso), "EEE, d MMM yyyy");
  } catch {
    return iso;
  }
}

export function fmtDayShort(iso: string): string {
  try {
    return format(parseISO(iso), "EEE d");
  } catch {
    return iso;
  }
}

export function monthLabel(iso: string): string {
  try {
    return format(parseISO(iso), "MMMM yyyy");
  } catch {
    return iso;
  }
}

export function todayIso(): string {
  // Display-level default only — the server anchors real business "today" (APP_TZ).
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The Monday-start week containing `iso`, as 7 YYYY-MM-DD strings. */
export function weekDates(iso: string): string[] {
  const d = parseISO(iso);
  const offset = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const m = new Date(monday);
    m.setDate(monday.getDate() + i);
    return format(m, "yyyy-MM-dd");
  });
}

/** 6×7 grid of YYYY-MM-DD strings covering the month of `iso` (Monday start). */
export function monthGrid(iso: string): string[][] {
  const d = parseISO(iso);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) {
    const m = new Date(start);
    m.setDate(start.getDate() + i);
    cells.push(format(m, "yyyy-MM-dd"));
  }
  return Array.from({ length: 6 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

export function shiftDate(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return format(d, "yyyy-MM-dd");
}

export function shiftMonth(iso: string, delta: number): string {
  const d = parseISO(iso);
  d.setMonth(d.getMonth() + delta);
  return format(d, "yyyy-MM-dd");
}

export function initials(name: string): string {
  return name
    .replace(/^(Dr\.|Ir\.|Prof\.)\s+/i, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

/** Pull a human message out of an ApiError (FastAPI {detail} bodies). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const detail = (err.body as { detail?: unknown } | null)?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const parts = detail
        .map((d) => (d && typeof d === "object" ? String((d as { msg?: unknown }).msg ?? "") : String(d)))
        .filter(Boolean);
      if (parts.length) return parts.join("; ");
    }
  }
  return fallback;
}
