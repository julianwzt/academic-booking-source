import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { apiErrorMessage, initials } from "@/lib/bookings";
import type { Booking, Instructor } from "@/lib/types";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ROLES = ["Lecturer", "Assistant Lecturer"];

export default function Instructors() {
  const queryClient = useQueryClient();
  const instructorsQ = useQuery({ queryKey: ["instructors"], queryFn: () => apiGet<Instructor[]>("/instructors"), retry: 1 });
  const bookingsQ = useQuery({ queryKey: ["bookings"], queryFn: () => apiGet<Booking[]>("/bookings"), retry: 1 });

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [editing, setEditing] = useState<Instructor | "new" | null>(null);
  const [viewing, setViewing] = useState<Instructor | null>(null);
  const [deleting, setDeleting] = useState<Instructor | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: ROLES[0] as string, department: "", password: "" });
  const [saving, setSaving] = useState(false);

  const instructors = instructorsQ.data ?? [];
  const bookingCount = (id: string) => (bookingsQ.data ?? []).filter((b) => b.instructor_id === id && b.status !== "Cancelled").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return instructors.filter((i) => {
      if (roleFilter !== "all" && i.role !== roleFilter) return false;
      if (q && !`${i.code} ${i.name} ${i.email} ${i.department}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [instructors, search, roleFilter]);

  const openAdd = () => {
    setForm({ name: "", email: "", role: ROLES[0] ?? "Lecturer", department: "", password: "" });
    setEditing("new");
  };
  const openEdit = (i: Instructor) => {
    setForm({ name: i.name, email: i.email, role: i.role, department: i.department, password: "" });
    setEditing(i);
  };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.department.trim()) {
      toast.error("Name, email and department are required.");
      return;
    }
    setSaving(true);
    try {
      if (editing === "new") {
        await apiPost<Instructor>("/instructors", { ...form, password: form.password || "booking123" });
        toast.success(`Instructor ${form.name} added — account ready with ${form.password ? "the chosen" : "the default"} password`);
      } else if (editing) {
        const payload: Record<string, string> = {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          department: form.department.trim(),
        };
        if (form.password) payload.password = form.password;
        await apiPut<Instructor>(`/instructors/${editing.id}`, payload);
        toast.success(`Instructor ${form.name} updated`);
      }
      queryClient.invalidateQueries({ queryKey: ["instructors"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setEditing(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Unable to save the instructor."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      const res = await apiDelete<{ ok: boolean; removed_bookings: number }>(`/instructors/${deleting.id}`);
      toast.success(
        `${deleting.name} deleted${res.removed_bookings ? ` — ${res.removed_bookings} booking(s) removed` : ""}`,
      );
      queryClient.invalidateQueries({ queryKey: ["instructors"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setDeleting(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Unable to delete the instructor."));
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Instructor Management</h1>
          <p className="mt-1 text-slate-500">Faculty & assistant lecturer directory (Dosen / Asdos).</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search name, email, department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="instructor-search-input"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="md:w-48" data-testid="instructor-role-filter">
            <SelectValue>{(v: string) => (v === "all" ? "All Roles" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openAdd} data-testid="admin-instructor-add-btn">
          <Plus className="h-4 w-4" /> Add Instructor
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table data-testid="instructor-table">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Instructor ID</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Active Bookings</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instructorsQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-400">
                    Loading instructors…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-400">
                    No instructors match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((i) => (
                  <TableRow key={i.id} data-testid={`instructor-row-${i.code}`}>
                    <TableCell className="font-mono text-xs font-bold text-slate-800">{i.code}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                          {initials(i.name)}
                        </span>
                        <span className="font-medium text-slate-800">{i.name}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600">{i.email}</TableCell>
                    <TableCell>
                      <span
                        className={
                          i.role === "Lecturer"
                            ? "rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700"
                            : "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"
                        }
                      >
                        {i.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600">{i.department}</TableCell>
                    <TableCell className="text-slate-600">{bookingCount(i.id)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-xs" onClick={() => setViewing(i)} title="View profile" data-testid="instructor-view-btn">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => openEdit(i)} title="Edit instructor" data-testid="instructor-edit-btn">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setDeleting(i)}
                          title="Delete instructor"
                          className="text-red-600 hover:bg-red-50"
                          data-testid="instructor-delete-btn"
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

      {/* Add / edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-md" data-testid="instructor-form-dialog">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add Instructor" : "Edit Instructor"}</DialogTitle>
            <DialogDescription>
              {editing === "new"
                ? "A login account is created with the same email (default password: booking123)."
                : "Update the directory record and the linked login account."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Full Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Dr. Jane Doe"
                data-testid="instructor-form-name-input"
              />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="jane.doe@telkom.ac.id"
                data-testid="instructor-form-email-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                  <SelectTrigger data-testid="instructor-form-role-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Department</Label>
                <Input
                  value={form.department}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                  placeholder="Informatics Engineering"
                  data-testid="instructor-form-department-input"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{editing === "new" ? "Password (optional)" : "Reset Password (optional)"}</Label>
              <Input
                type="text"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={editing === "new" ? "Default: booking123" : "Leave blank to keep current"}
                data-testid="instructor-form-password-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} data-testid="instructor-form-cancel-button">
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} data-testid="instructor-form-save-button">
              {editing === "new" ? "Add Instructor" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View profile dialog */}
      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="sm:max-w-md" data-testid="instructor-profile-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {viewing ? initials(viewing.name) : ""}
              </span>
              {viewing?.name}
            </DialogTitle>
            <DialogDescription>Instructor profile</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {[
              ["Instructor ID", viewing?.code],
              ["Email", viewing?.email],
              ["Role", viewing?.role],
              ["Department", viewing?.department],
              ["Active bookings", viewing ? String(bookingCount(viewing.id)) : ""],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-slate-100 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</span>
                <span className="font-medium text-slate-800">{v}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="sm:max-w-md" data-testid="instructor-delete-dialog">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              This removes their login account and all of their reservations. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} data-testid="confirm-dialog-cancel-button">
              Keep Instructor
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
