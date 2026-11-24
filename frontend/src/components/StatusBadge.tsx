import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800 border-amber-200",
  Confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
  Completed: "bg-slate-100 text-slate-600 border-slate-200",
  Available: "bg-green-100 text-green-700 border-green-200",
  Maintenance: "bg-amber-100 text-amber-800 border-amber-200",
  Booked: "bg-blue-100 text-blue-800 border-blue-200",
};

const DOT: Record<string, string> = {
  Pending: "bg-amber-500",
  Confirmed: "bg-blue-500",
  Cancelled: "bg-red-500",
  Completed: "bg-slate-400",
  Available: "bg-green-500",
  Maintenance: "bg-amber-500",
  Booked: "bg-blue-500",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        STYLES[status] ?? "bg-slate-100 text-slate-600 border-slate-200",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT[status] ?? "bg-slate-400")} />
      {status}
    </span>
  );
}
