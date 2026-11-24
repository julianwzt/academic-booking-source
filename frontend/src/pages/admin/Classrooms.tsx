import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { apiErrorMessage, FACILITY_OPTIONS } from "@/lib/bookings";
import type { Classroom, Stats } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { StatusBadge } from "@/components/StatusBadge";

type Editing = Classroom | "new" | null;

const EMPTY_FORM = {
  code: "",
  name: "",
  floor: "6",
  capacity: "40",
  type: "Classroom",
  status: "Available",
  facilities: ["Projector", "Whiteboard", "AC", "WiFi"] as string[],
};

export default function Classrooms() {
  const queryClient = useQueryClient();
  const classroomsQ = useQuery({ queryKey: ["classrooms"], queryFn: () => apiGet<Classroom[]>("/classrooms"), retry: 1 });
  const statsQ = useQuery({ queryKey: ["stats"], queryFn: () => apiGet<Stats>("/stats"), retry: 1 });

  const [search, setSearch] = useState("");
  const [floor, setFloor] = useState("all");
  const [type, setType] = useState("all");
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Classroom | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const classrooms = classroomsQ.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return classrooms.filter((r) => {
      if (floor !== "all" && r.floor !== Number(floor)) return false;
      if (type !== "all" && r.type !== type) return false;
      if (q && !`${r.code} ${r.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [classrooms, search, floor, type]);

  const stats = statsQ.data;

  const openEdit = (room: Classroom) => {
    setForm({
      code: room.code,
      name: room.name,
      floor: String(room.floor),
      capacity: String(room.capacity),
      type: room.type,
      status: room.status,
      facilities: [...room.facilities],
    });
    setEditing(room);
  };
  const openAdd = () => {
    setForm({ ...EMPTY_FORM });
    setEditing("new");
  };

  const toggleFacility = (f: string, on: boolean) =>
    setForm((prev) => ({
      ...prev,
      facilities: on ? [...prev.facilities, f] : prev.facilities.filter((x) => x !== f),
    }));

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Classroom code and name are required.");
      return;
    }
    if (Number(form.capacity) < 1) {
      toast.error("Capacity must be at least 1.");
      return;
    }
    setSaving(true);
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      building: "TULT",
      floor: Number(form.floor),
      capacity: Number(form.capacity),
      type: form.type,
      status: form.status,
      facilities: form.facilities,
    };
    try {
      if (editing === "new") {
        await apiPost<Classroom>("/classrooms", payload);
        toast.success(`Classroom ${payload.code} added`);
      } else if (editing) {
        await apiPut<Classroom>(`/classrooms/${editing.id}`, payload);
        toast.success(`Classroom ${payload.code} updated`);
      }
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setEditing(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Unable to save the classroom."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await apiDelete(`/classrooms/${deleting.id}`);
      toast.success(`Classroom ${deleting.code} deleted`);
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setDeleting(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Unable to delete the classroom."));
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Classroom Management</h1>
        <p className="mt-1 text-slate-500">Manage classroom information and availability — TULT floors 6 & 7 only.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: "Total Classrooms", value: stats?.total_classrooms ?? "…" },
          { label: "Total Capacity", value: stats ? `${stats.total_capacity} seats` : "…" },
          { label: "Floor 6 Classrooms", value: stats?.floor6_count ?? "…" },
          { label: "Floor 7 Classrooms", value: stats?.floor7_count ?? "…" },
        ].map((s) => (
          <Card key={s.label} size="sm">
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900" data-testid={`classroom-stat-${s.label.toLowerCase().replace(/ /g, "-")}`}>
                {s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search classroom code or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="classroom-search-input"
          />
        </div>
        <Select value={floor} onValueChange={setFloor}>
          <SelectTrigger className="md:w-36" data-testid="classroom-floor-filter">
            <SelectValue>{(v: string) => (v === "all" ? "All Floors" : `Floor ${v}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Floors</SelectItem>
            <SelectItem value="6">Floor 6</SelectItem>
            <SelectItem value="7">Floor 7</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="md:w-40" data-testid="classroom-type-filter">
            <SelectValue>{(v: string) => (v === "all" ? "All Types" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Classroom">Classroom</SelectItem>
            <SelectItem value="Laboratory">Laboratory</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openAdd} data-testid="admin-classroom-add-btn">
          <Plus className="h-4 w-4" /> Add Classroom
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table data-testid="classroom-table">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Building</TableHead>
                <TableHead>Floor</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Facilities</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classroomsQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-slate-400">
                    Loading classrooms…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-slate-400">
                    No classrooms match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id} data-testid={`classroom-row-${r.code}`}>
                    <TableCell className="font-mono text-xs font-bold text-slate-800">{r.code}</TableCell>
                    <TableCell className="font-medium text-slate-800">{r.name}</TableCell>
                    <TableCell className="text-slate-600">{r.building}</TableCell>
                    <TableCell className="text-slate-600">{r.floor}</TableCell>
                    <TableCell className="text-slate-600">{r.capacity}</TableCell>
                    <TableCell>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{r.type}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.facilities.slice(0, 3).map((f) => (
                          <span key={f} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            {f}
                          </span>
                        ))}
                        {r.facilities.length > 3 && (
                          <span className="text-[10px] font-semibold text-slate-400">+{r.facilities.length - 3}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-xs" onClick={() => openEdit(r)} title="Edit classroom" data-testid="classroom-edit-btn">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setDeleting(r)}
                          title="Delete classroom"
                          className="text-red-600 hover:bg-red-50"
                          data-testid="classroom-delete-btn"
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

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg" data-testid="classroom-form-dialog">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add Classroom" : "Edit Classroom"}</DialogTitle>
            <DialogDescription>Only TULT building, floors 6 and 7 are allowed.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Classroom Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="TULT-06-05"
                  data-testid="classroom-form-code-input"
                />
              </div>
              <div className="grid gap-2">
                <Label>Building</Label>
                <Input value="TULT" readOnly disabled />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Classroom Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ruang Kelas 605"
                data-testid="classroom-form-name-input"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Floor</Label>
                <Select value={form.floor} onValueChange={(v) => setForm((f) => ({ ...f, floor: v }))}>
                  <SelectTrigger data-testid="classroom-form-floor-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">Floor 6</SelectItem>
                    <SelectItem value="7">Floor 7</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                  data-testid="classroom-form-capacity-input"
                />
              </div>
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger data-testid="classroom-form-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Classroom">Classroom</SelectItem>
                    <SelectItem value="Laboratory">Laboratory</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger data-testid="classroom-form-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Facilities</Label>
              <div className="flex flex-wrap gap-4">
                {FACILITY_OPTIONS.map((f) => (
                  <label key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <Checkbox checked={form.facilities.includes(f)} onCheckedChange={(v) => toggleFacility(f, Boolean(v))} />
                    {f}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} data-testid="classroom-form-cancel-button">
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} data-testid="classroom-form-save-button">
              {editing === "new" ? "Add Classroom" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="sm:max-w-md" data-testid="classroom-delete-dialog">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.code}?</DialogTitle>
            <DialogDescription>
              This permanently removes {deleting?.name} and its historical bookings. Rooms with active reservations
              cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} data-testid="confirm-dialog-cancel-button">
              Keep Classroom
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
