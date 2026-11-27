"use client";

import * as React from "react";
import { ArrowDownAZ, ArrowUpAZ, LoaderCircle, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ResourceTable, StatusBadgeText, type Column } from "@/components/resource-table";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { useResourceList } from "@/hooks/use-resource-list";
import { useSession } from "@/hooks/use-session";
import { api, ApiError, type ListResponse } from "@/lib/api";

type PositionStatus = "ACTIVE" | "INACTIVE" | "BLOCKED" | "DELETED";

interface TenantAssociationPositionRow {
  id: string;
  systemCode: string;
  tenantBusinessId: string;
  positionName: string;
  positionNameTamil: string | null;
  remark: string | null;
  /** Whether a public APPLICANT may claim this position. */
  showOnApplicationForm: boolean;
  /** How many members may hold it. 0 means unlimited. */
  maxMembers: number;
  status: PositionStatus;
  tenantBusiness?: { id: string; systemCode: string; name: string };
}

interface TenantBusinessOption {
  id: string;
  name: string;
}

interface PositionFormValues {
  tenantBusinessId: string;
  positionName: string;
  positionNameTamil: string;
  remark: string;
  showOnApplicationForm: boolean;
  /** A string, as the number input gives it. "" reads as 0, i.e. unlimited. */
  maxMembers: string;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
}

const EMPTY_FORM: PositionFormValues = {
  tenantBusinessId: "",
  positionName: "",
  positionNameTamil: "",
  remark: "",
  // Offered on the application form unless somebody says otherwise,
  // matching the column default.
  showOnApplicationForm: true,
  // Unlimited until somebody says otherwise, matching the column default.
  maxMembers: "",
  status: "ACTIVE",
};

export default function TenantAssociationPositionsPage() {
  const { hasPermission } = useSession();

  const canCreate = hasPermission("tenant-association-positions:create");
  const canUpdate = hasPermission("tenant-association-positions:update");
  const canDelete = hasPermission("tenant-association-positions:delete");
  const canRestore = hasPermission("tenant-association-positions:restore");

  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [businessFilter] = React.useState<string>("");
  const [sortBy, setSortBy] = React.useState("createdAt");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");

  const list = useResourceList<TenantAssociationPositionRow>(
    "/system/tenant-association-positions",
    {
      status: statusFilter || undefined,
      tenantBusinessId: businessFilter || undefined,
      sortBy,
      sortOrder,
    },
  );

  const [businessOptions, setBusinessOptions] = React.useState<TenantBusinessOption[] | null>(null);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TenantAssociationPositionRow | null>(null);
  const [form, setForm] = React.useState<PositionFormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<TenantAssociationPositionRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);

  function ensureBusinessOptions() {
    if (businessOptions) return;
    api<ListResponse<TenantBusinessOption>>("/system/tenant-business?limit=100&page=1")
      .then((data) => setBusinessOptions(data.items))
      .catch(() => toast.error("Failed to load business list"));
  }

  function openCreate() {
    ensureBusinessOptions();
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(row: TenantAssociationPositionRow) {
    ensureBusinessOptions();
    setEditing(row);
    setForm({
      tenantBusinessId: row.tenantBusinessId,
      positionName: row.positionName,
      positionNameTamil: row.positionNameTamil ?? "",
      remark: row.remark ?? "",
      showOnApplicationForm: row.showOnApplicationForm,
      // 0 is "unlimited", and an empty box says that more plainly than
      // a zero does.
      maxMembers: row.maxMembers > 0 ? String(row.maxMembers) : "",
      status: row.status === "DELETED" ? "ACTIVE" : row.status,
    });
    setFormOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        tenantBusinessId: form.tenantBusinessId,
        positionName: form.positionName,
        // "" means "not given", never an empty Tamil name.
        positionNameTamil: form.positionNameTamil || undefined,
        remark: form.remark || undefined,
        showOnApplicationForm: form.showOnApplicationForm,
        maxMembers: form.maxMembers === "" ? 0 : Number(form.maxMembers),
        ...(editing ? { status: form.status } : {}),
      };
      if (editing) {
        await api(`/system/tenant-association-positions/${editing.id}`, { method: "PATCH", body });
        toast.success("Position updated");
      } else {
        await api("/system/tenant-association-positions", { method: "POST", body });
        toast.success("Position created");
      }
      setFormOpen(false);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/system/tenant-association-positions/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Position deleted");
      setDeleteTarget(null);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function onRestore(row: TenantAssociationPositionRow) {
    setRestoringId(row.id);
    try {
      await api(`/system/tenant-association-positions/${row.id}/restore`, { method: "PATCH" });
      toast.success("Position restored");
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Restore failed");
    } finally {
      setRestoringId(null);
    }
  }

  const columns: Column<TenantAssociationPositionRow>[] = [
    {
      header: "Position",
      cell: (row) => <span className="font-medium">{row.positionName}</span>,
    },
    { header: "Tamil Name", cell: (row) => row.positionNameTamil ?? "—" },
    { header: "Business", cell: (row) => row.tenantBusiness?.name ?? "—" },
    { header: "Remark", cell: (row) => row.remark ?? "—" },
    {
      header: "On application form",
      cell: (row) => (row.showOnApplicationForm ? "Yes" : "No"),
    },
    {
      header: "Max members",
      // The word, not the number: "0" in this column would read as "nobody
      // may hold this", which is the opposite of what it means.
      cell: (row) => (row.maxMembers > 0 ? String(row.maxMembers) : "Unlimited"),
    },
    { header: "Status", cell: (row) => <StatusBadgeText status={row.status} /> },
  ];

  return (
    <>
      <ResourceTable<TenantAssociationPositionRow>
        title="Association Positions"
        description="Positions members hold, per tenant business. Search matches either name."
        columns={columns}
        rows={list.rows}
        error={list.error}
        page={list.page}
        totalPages={list.totalPages}
        onPageChange={list.setPage}
        search={list.search}
        onSearchChange={list.setSearch}
        onSearchSubmit={list.applySearch}
        toolbarAction={
          <>
            <Select
              value={statusFilter || "ALL"}
              onValueChange={(v) => {
                setStatusFilter(v === "ALL" ? "" : v);
                list.setPage(1);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
                <SelectItem value="DELETED">Deleted</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sortBy}
              onValueChange={(v) => {
                setSortBy(v);
                list.setPage(1);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Created</SelectItem>
                <SelectItem value="positionName">Position</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Toggle sort order"
              onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
            >
              {sortOrder === "asc" ? (
                <ArrowUpAZ className="size-4" />
              ) : (
                <ArrowDownAZ className="size-4" />
              )}
            </Button>
            {canCreate && (
              <Button onClick={openCreate}>
                <Plus className="size-4" /> Add Position
              </Button>
            )}
          </>
        }
        renderActions={
          canUpdate || canDelete || canRestore
            ? (row) => (
                <RowActionsMenu
                  actions={
                    row.status === "DELETED"
                      ? canRestore
                        ? [
                            {
                              label: "Restore",
                              icon: RotateCcw,
                              onClick: () => onRestore(row),
                              loading: restoringId === row.id,
                              disabled: restoringId === row.id,
                            },
                          ]
                        : []
                      : [
                          ...(canUpdate
                            ? [{ label: "Edit", icon: Pencil, onClick: () => openEdit(row) }]
                            : []),
                          ...(canDelete
                            ? [
                                {
                                  label: "Delete",
                                  icon: Trash2,
                                  onClick: () => setDeleteTarget(row),
                                  destructive: true,
                                },
                              ]
                            : []),
                        ]
                  }
                />
              )
            : undefined
        }
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Position" : "Add Position"}</DialogTitle>
              <DialogDescription>
                A position members hold, recorded against a tenant business.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label required>Business</Label>
                <Combobox
                  options={businessOptions?.map((biz) => ({ value: biz.id, label: biz.name })) ?? null}
                  value={form.tenantBusinessId}
                  onValueChange={(v) => setForm((f) => ({ ...f, tenantBusinessId: v }))}
                  onOpenChange={(open) => open && ensureBusinessOptions()}
                  placeholder="Select a business"
                  searchPlaceholder="Search businesses..."
                  emptyText="No businesses found."
                />
              </div>

              <div className="grid gap-2">
                <Label required htmlFor="positionName">Position Name</Label>
                <Input
                  id="positionName"
                  required
                  value={form.positionName}
                  onChange={(e) => setForm((f) => ({ ...f, positionName: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="positionNameTamil">Position Name (Tamil)</Label>
                <Input
                  id="positionNameTamil"
                  value={form.positionNameTamil}
                  onChange={(e) => setForm((f) => ({ ...f, positionNameTamil: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="remark">Remark</Label>
                <Textarea
                  id="remark"
                  value={form.remark}
                  onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
                />
              </div>

              {/* Governs the PUBLIC form only. Staff always see every position
                  here, because an association has to be able to record a
                  Treasurer even if no stranger may claim to be one. */}
              <div className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  id="showOnApplicationForm"
                  checked={form.showOnApplicationForm}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, showOnApplicationForm: checked === true }))
                  }
                />
                <div className="grid gap-1">
                  <Label htmlFor="showOnApplicationForm">Show on application form</Label>
                  <p className="text-xs text-muted-foreground">
                    Applicants may choose this position when registering. Staff
                    enrolling a member directly always see every position.
                  </p>
                </div>
              </div>


              {/* 0 = unlimited. The cap counts ACTIVE members only, so a
                  suspended holder frees a seat and a pending enrolment takes
                  none. */}
              <div className="grid gap-2">
                <Label htmlFor="maxMembers">Maximum members</Label>
                <Input
                  id="maxMembers"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.maxMembers}
                  onChange={(e) => setForm((f) => ({ ...f, maxMembers: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  How many members may hold this position. <strong>0 means no
                  limit.</strong> Only active members count, and lowering the
                  limit below the number already holding it removes nobody - it
                  only refuses the next one.
                </p>
              </div>

              {editing && (
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, status: v as PositionFormValues["status"] }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="BLOCKED">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !form.tenantBusinessId}>
                {saving && <LoaderCircle className="size-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete position"
        description={`This will soft-delete "${deleteTarget?.positionName}".`}
        loading={deleting}
        onConfirm={onDelete}
      />
    </>
  );
}
