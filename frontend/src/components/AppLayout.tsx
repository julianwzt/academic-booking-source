import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  BookmarkCheck,
  CalendarDays,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  School,
  Users,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { fmtDate, initials, todayIso } from "@/lib/bookings";
import type { Booking, UserPublic } from "@/lib/types";
import { useLogout, useMe } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/StatusBadge";

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  testid: string;
  adminOnly?: boolean;
}

const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "General",
    items: [
      { label: "Dashboard", to: "/", icon: LayoutDashboard, testid: "sidebar-nav-dashboard" },
      { label: "Classroom Schedule", to: "/schedule", icon: CalendarDays, testid: "sidebar-nav-schedule" },
      { label: "New Reservation", to: "/new-reservation", icon: PlusCircle, testid: "sidebar-nav-new-reservation" },
      { label: "My Bookings", to: "/my-bookings", icon: BookmarkCheck, testid: "sidebar-nav-my-bookings" },
    ],
  },
  {
    heading: "Academic Admin",
    items: [
      { label: "Classroom Management", to: "/admin/classrooms", icon: School, testid: "sidebar-nav-admin-classrooms", adminOnly: true },
      { label: "Instructor Management", to: "/admin/instructors", icon: Users, testid: "sidebar-nav-admin-instructors", adminOnly: true },
      { label: "Booking Management", to: "/admin/bookings", icon: Layers, testid: "sidebar-nav-admin-bookings", adminOnly: true },
    ],
  },
];

const TITLES: { prefix: string; title: string; crumb: string }[] = [
  { prefix: "/admin/classrooms", title: "Classroom Management", crumb: "Admin Akademik" },
  { prefix: "/admin/instructors", title: "Instructor Management", crumb: "Admin Akademik" },
  { prefix: "/admin/bookings", title: "Booking Management", crumb: "Admin Akademik" },
  { prefix: "/schedule", title: "Classroom Schedule", crumb: "Scheduling" },
  { prefix: "/new-reservation", title: "New Reservation", crumb: "Reservations" },
  { prefix: "/my-bookings", title: "My Bookings", crumb: "Reservations" },
  { prefix: "/", title: "Dashboard", crumb: "Overview" },
];

function titleFor(pathname: string) {
  return TITLES.find((t) => t.prefix === pathname) ?? TITLES[TITLES.length - 1];
}

function RoleBadge({ user }: { user: UserPublic }) {
  const admin = user.access_role === "admin";
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide",
        admin ? "bg-blue-600 text-white" : "bg-white/10 text-slate-300",
      )}
    >
      {admin ? "Admin Akademik" : "Dosen / Asdos"}
    </span>
  );
}

function SidebarNav({ user, onNavigate }: { user: UserPublic; onNavigate?: () => void }) {
  const logout = useLogout();
  const isAdmin = user.access_role === "admin";
  return (
    <div className="flex h-full flex-col bg-[#142B4D] text-slate-200">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.18em] text-slate-400">TELKOM UNIVERSITY</p>
          <p className="truncate text-sm font-bold text-white">Academic Booking</p>
          <p className="text-[11px] text-slate-400">TULT Campus Schedule</p>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => !i.adminOnly || isAdmin);
          if (!items.length) return null;
          return (
            <div key={group.heading}>
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                {group.heading}
              </p>
              <div className="space-y-1">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    onClick={onNavigate}
                    data-testid={item.testid}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-[#1E3A8A] text-white shadow-sm"
                          : "text-slate-300 hover:bg-white/10 hover:text-white",
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <div className="mt-0.5">
              <RoleBadge user={user} />
            </div>
          </div>
          <button
            data-testid="sidebar-user-logout-button"
            onClick={logout}
            title="Logout"
            aria-label="Logout"
            className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Notifications() {
  const { data: bookings } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => apiGet<Booking[]>("/bookings"),
    staleTime: 30_000,
    retry: 1,
  });
  const today = todayIso();
  const upcoming = (bookings ?? [])
    .filter((b) => (b.status === "Pending" || b.status === "Confirmed") && b.date >= today)
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
    .slice(0, 5);
  return (
    <Popover>
      <PopoverTrigger
        data-testid="header-notifications-button"
        className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <Bell className="h-5 w-5" />
        {upcoming.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
            {upcoming.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" data-testid="header-notifications-popover">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-bold text-slate-900">Upcoming Reservations</p>
        </div>
        {upcoming.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">Nothing coming up — all clear.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {upcoming.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {b.classroom?.code} · {b.course_name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {fmtDate(b.date)} · {b.start_time}–{b.end_time}
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function AppLayout() {
  const { data: user } = useMe();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const logout = useLogout();
  if (!user) return null;
  const meta = titleFor(pathname);

  return (
    <div className="min-h-svh bg-[#F8FAFC]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <SidebarNav user={user} />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0" data-testid="mobile-sidebar">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav user={user} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-svh flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              data-testid="header-mobile-menu-button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400">
                {meta?.crumb} <span className="mx-1">/</span> <span className="text-slate-500">Home</span>
              </p>
              <h1 className="truncate text-base font-bold text-slate-900 md:text-lg">{meta?.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-3">
            <Notifications />
            <Link
              to="/new-reservation"
              data-testid="header-new-reservation-cta"
              className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}
            >
              <PlusCircle className="h-4 w-4" />
              New Reservation
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger
                data-testid="header-user-menu-button"
                className="flex items-center gap-2 rounded-full p-1 pr-2 transition-colors hover:bg-slate-100"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {initials(user.name)}
                </span>
                <span className="hidden text-left md:block">
                  <span className="block text-sm font-semibold leading-tight text-slate-800">{user.name}</span>
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-blue-600">
                    {user.access_role === "admin" ? "Admin Akademik" : "Dosen / Asdos"}
                  </span>
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={logout} data-testid="header-logout-button">
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
