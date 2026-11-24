import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AppLayout from "@/components/AppLayout";
import { RequireAdmin, RequireAuth } from "@/hooks/useAuth";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Schedule from "@/pages/Schedule";
import NewReservation from "@/pages/NewReservation";
import MyBookings from "@/pages/MyBookings";
import Classrooms from "@/pages/admin/Classrooms";
import Instructors from "@/pages/admin/Instructors";
import AdminBookings from "@/pages/admin/Bookings";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/new-reservation" element={<NewReservation />} />
            <Route path="/my-bookings" element={<MyBookings />} />
            <Route element={<RequireAdmin />}>
              <Route path="/admin/classrooms" element={<Classrooms />} />
              <Route path="/admin/instructors" element={<Instructors />} />
              <Route path="/admin/bookings" element={<AdminBookings />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors position="bottom-right" />
    </>
  );
}
