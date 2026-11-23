"use client";

import * as React from "react";
import { LoaderCircle, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { ResourceTable, StatusBadgeText, type Column } from "@/components/resource-table";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { useResourceList } from "@/hooks/use-resource-list";
import { useSession } from "@/hooks/use-session";
import { api, ApiError, type ListResponse } from "@/lib/api";

interface TenantStateRow {
  id: string;
  systemCode: string;
  tenantBusinessId: string;
  stateName: string;
  stateNameTamil: string | null;
  stateCode: string;
  country: string;
  status: "ACTIVE" | "INACTIVE" | "DELETED";
  tenantBusiness?: { id: string; systemCode: string; name: string };
}

interface BusinessOption {
  id: string;
  name: string;
}

interface FormValues {
  tenantBusinessId: string;
  stateName: string;
  stateNameTamil: string;
  stateCode: string;
  country: string;
  status: "ACTIVE" | "INACTIVE";
}

const EMPTY_FORM: FormValues = {
  tenantBusinessId: "",
  stateName: "",
  stateNameTamil: "",
  stateCode: "",
  country: "India",
  status: "ACTIVE",
};

export default function TenantStatePagePage() {
  const { hasPermission } = useSession();

  const canCreate = hasPermission("tenant-states:create");
  const canUpdate = hasPermission("tenant-states:update");
  const canDelete = hasPermission("tenant-states:delete");
  const canRestore = hasPermission("tenant-states:restore");

  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [sortBy] = React.useState("createdAt");
  const [sortOrder] = React.useState<"asc" | "desc">("desc");
  const list = useResourceList<TenantStateRow>("/system/tenant-states", {
    status: statusFilter || undefined,
    sortBy,
    sortOrder,
  });

  const [businessOptions, setBusinessOptions] = React.useState<BusinessOption[] | null>(null);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TenantStateRow | null>(null);
  const [form, setForm] = React.useState<FormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<TenantStateRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);

  function ensureBusinessOptions() {
    if (businessOptions) return;
    api<ListResponse<BusinessOption>>("/system/tenant-business?limit=100&page=1")
      .then((data) => setBusinessOptions(data.items))
      .catch(() => toast.error("Failed to load business list"));
  }

  function openCreate() {
    ensureBusinessOptions();
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(row: TenantStateRow) {
    ensureBusinessOptions();
    setEditing(row);
    setForm({
      tenantBusinessId: row.tenantBusinessId,
      stateName: row.stateName,
      stateNameTamil: row.stateNameTamil ?? "",
      stateCode: row.stateCode,
      country: row.country,
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
        stateName: form.stateName,
        // "" means not given, never an empty Tamil name.
        stateNameTamil: form.stateNameTamil || undefined,
        stateCode: form.stateCode,
        country: form.country,
        ...(editing ? { status: form.status } : {}),
      };
      if (editing) {
        await api(`/system/tenant-states/${editing.id}`, { method: "PATCH", body });
        toast.success("State updated");
      } else {
        await api("/system/tenant-states", { method: "POST", body });
        toast.success("State created");
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
      await api(`/system/tenant-states/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("State deleted");
      setDeleteTarget(null);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function onRestore(row: TenantStateRow) {
    setRestoringId(row.id);
    try {
      await api(`/system/tenant-states/${row.id}/restore`, { method: "PATCH" });
      toast.success("State restored");
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Restore failed");
    } finally {
      setRestoringId(null);
    }
  }

  const columns: Column<TenantStateRow>[] = [
    { header: "State", cell: (row) => <span className="font-medium">{row.stateName}</span> },
    { header: "Tamil Name", cell: (row) => row.stateNameTamil ?? "\u2014" },
    { header: "Code", cell: (row) => row.stateCode },
    { header: "Country", cell: (row) => row.country },
    { header: "Business", cell: (row) => row.tenantBusiness?.name ?? "\u2014" },
    { header: "Status", cell: (row) => <StatusBadgeText status={row.status} /> },
  ];

  return (
    <>
      <ResourceTable<TenantStateRow>
        title="States"
        description="States for tenant businesses."
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
                <SelectItem value="DELETED">Deleted</SelectItem>
              </SelectContent>
            </Select>
            {canCreate && (
              <Button onClick={openCreate}>
                <Plus className="size-4" /> Add State
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit State" : "Add State"}</DialogTitle>
              <DialogDescription>States for tenant businesses.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">

              <div className="grid gap-2">
                <Label required>Business</Label>
                <Combobox
                  options={businessOptions?.map((b) => ({ value: b.id, label: b.name })) ?? null}
                  value={form.tenantBusinessId}
                  onValueChange={(v) => setForm((f) => ({ ...f, tenantBusinessId: v }))}
                  onOpenChange={(open) => open && ensureBusinessOptions()}
                  placeholder="Select a business"
                  searchPlaceholder="Search businesses..."
                  emptyText="No businesses found."
                />
              </div>

              <div className="grid gap-2">
                <Label required htmlFor="stateName">State Name</Label>
                <Input
                  id="stateName"
                  required
                  value={form.stateName}
                  onChange={(e) => setForm((f) => ({ ...f, stateName: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="stateNameTamil">State Name (Tamil)</Label>
                <Input
                  id="stateNameTamil"
                  value={form.stateNameTamil}
                  onChange={(e) => setForm((f) => ({ ...f, stateNameTamil: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label required htmlFor="stateCode">State Code</Label>
                <Input
                  id="stateCode"
                  required
                  value={form.stateCode}
                  onChange={(e) => setForm((f) => ({ ...f, stateCode: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label required htmlFor="country">Country</Label>
                <Input
                  id="country"
                  required
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                />
              </div>

              {editing && (
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, status: v as FormValues["status"] }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
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
        title="Delete state"
        description={`This will soft-delete "${deleteTarget?.stateName}".`}
        loading={deleting}
        onConfirm={onDelete}
      />
    </>
  );
}
