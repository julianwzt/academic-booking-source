import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useCallback } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiGet } from "@/lib/api";
import type { UserPublic } from "@/lib/types";
import { endSession } from "@/lib/session";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<UserPublic>("/auth/me"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogout() {
  const navigate = useNavigate();
  return useCallback(async () => {
    await endSession();
    toast.success("Signed out");
    navigate("/login", { replace: true });
  }, [navigate]);
}

function Splash() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50">
      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
    </div>
  );
}

/** Guards the dashboard shell: unauthenticated visitors bounce to /login. */
export function RequireAuth() {
  const { data, isLoading, isError } = useMe();
  if (isLoading) return <Splash />;
  if (isError || !data) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** Guards the admin-only pages: instructors bounce back to their dashboard. */
export function RequireAdmin() {
  const { data, isLoading, isError } = useMe();
  if (isLoading) return <Splash />;
  if (isError || !data) return <Navigate to="/login" replace />;
  if (data.access_role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}
