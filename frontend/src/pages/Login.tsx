import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarClock, GraduationCap, Loader2, LogIn, MapPinned, ShieldCheck } from "lucide-react";
import { ApiError, apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import { useMe } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserPublic } from "@/lib/types";

const DEMO_ACCOUNTS = [
  {
    label: "Instructor — Alex Hartanto",
    email: "alex.hartanto@telkom.ac.id",
    password: "password123",
    testid: "demo-role-instructor-btn",
  },
  {
    label: "Admin Akademik",
    email: "admin@telkom.ac.id",
    password: "admin123",
    testid: "demo-role-admin-btn",
  },
];

const FEATURES = [
  { icon: MapPinned, text: "TULT Floors 6 & 7 — one campus, one source of truth" },
  { icon: CalendarClock, text: "Live availability & booking-conflict prevention" },
  { icon: ShieldCheck, text: "Admin-approved reservations, full audit trail" },
];

export default function Login() {
  const { data: me, isLoading } = useMe();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && me) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const user = await apiPost<UserPublic>("/auth/login", { email: email.trim(), password });
      await beginSession();
      toast.success(`Welcome back, ${user.name.split(" ")[0] ?? "there"}!`);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && typeof (err.body as { detail?: unknown } | null)?.detail === "string"
          ? ((err.body as { detail: string }).detail)
          : "Unable to sign in — please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-[#142B4D] p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400">TELKOM UNIVERSITY</p>
            <p className="font-bold">Academic Booking</p>
          </div>
        </div>
        <div className="space-y-6">
          <h1 className="max-w-md text-4xl font-bold leading-tight tracking-tight">
            Book TULT classrooms in minutes, not mailing lists.
          </h1>
          <p className="max-w-md text-slate-300">
            Replacement classes, tutorials and practicum sessions — reserved with live availability checks and
            zero double-bookings.
          </p>
          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-sm text-slate-200">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  <f.icon className="h-4 w-4 text-blue-300" />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-500">
          Development environment — all classroom and instructor records are simulated data.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-[#F8FAFC] p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
              <GraduationCap className="h-6 w-6" />
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in to Academic Booking</h2>
          <p className="mt-1 text-sm text-slate-500">Use your Telkom University account credentials.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@telkom.ac.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email-input"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password-input"
              />
            </div>
            {error && (
              <p
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                data-testid="login-error"
              >
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting} data-testid="login-submit-button">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {submitting ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Demo accounts — click to fill</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.testid}
                  type="button"
                  data-testid={acc.testid}
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.password);
                    setError(null);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
