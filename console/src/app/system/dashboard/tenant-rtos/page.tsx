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

interface TenantRtoRow {
  id: string;
  systemCode: string;
  tenantBusinessId: string;
  tenantDistrictId: string;
  rtoName: string;
  rtoNameTamil: string | null;
  rtoCode: string;
  status: "ACTIVE" | "INACTIVE" | "DELETED";
  tenantBusiness?: { id: string; systemCode: string; name: string };
  district?: { id: string; districtName: string; districtNameTamil: string | null };
}

interface BusinessOption {
  id: string;
  name: string;
}

interface DistrictOption {
  id: string;
  districtName: string;
}

interface FormValues {
  tenantBusinessId: string;
  tenantDistrictId: string;
  rtoName: string;
  rtoNameTamil: string;
  rtoCode: string;
  status: "ACTIVE" | "INACTIVE";
}

const EMPTY_FORM: FormValues = {
  tenantBusinessId: "",
  tenantDistrictId: "",
  rtoName: "",
  rtoNameTamil: "",
  rtoCode: "",
  status: "ACTIVE",
};

export default function TenantRtosSystemPage() {
  const { hasPermission } = useSession();

  const canView = hasPermission("tenant-rtos:list");
  const canCreate = hasPermission("tenant-rtos:create");
  const canUpdate = hasPermission("tenant-rtos:update");
  const canDelete = hasPermission("tenant-rtos:delete");
  const canRestore = hasPermission("tenant-rtos:restore");

  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const list = useResourceList<TenantRtoRow>("/system/tenant-rtos", {
    status: statusFilter || undefined,
  });

  const [businessOptions, setBusinessOptions] = React.useState<BusinessOption[] | null>(null);
  const [districtOptions, setDistrictOptions] = React.useState<DistrictOption[] | null>(null);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TenantRtoRow | null>(null);
  const [form, setForm] = React.useState<FormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<TenantRtoRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);

  function loadBusinessOptions(): Promise<BusinessOption[]> {
    if (businessOptions) return Promise.resolve(businessOptions);
    return api<ListResponse<BusinessOption>>("/system/tenant-business?limit=100&page=1")
      .then((data) => {
        setBusinessOptions(data.items);
        return data.items;
      })
      .catch(() => {
        toast.error("Failed to load business list");
        return [];
      });
  }

  function loadDistrictOptions(tenantBusinessId: string) {
    if (!tenantBusinessId) {
      setDistrictOptions([]);
      return;
    }
    api<DistrictOption[]>(`/system/tenant-rtos/districts?tenantBusinessId=${tenantBusinessId}`)
      .then(setDistrictOptions)
      .catch(() => toast.error("Failed to load district list"));
  }

  // Changing the business invalidates the district below it. An RTO hangs off
  // the district directly, so there is no state in between.
  function onBusinessChange(tenantBusinessId: string) {
    setForm((f) => ({ ...f, tenantBusinessId, tenantDistrictId: "" }));
    loadDistrictOptions(tenantBusinessId);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDistrictOptions(null);
    setFormOpen(true);
    loadBusinessOptions().then((options) => {
      // One business is the common case - choose it rather than making the
      // user pick from a list of one.
      if (options.length === 1) {
        setForm((f) => ({ ...f, tenantBusinessId: options[0].id }));
        loadDistrictOptions(options[0].id);
      }
    });
  }

  function openEdit(row: TenantRtoRow) {
    loadBusinessOptions();
    setEditing(row);
    setForm({
      tenantBusinessId: row.tenantBusinessId,
      tenantDistrictId: row.tenantDistrictId,
      rtoName: row.rtoName,
      rtoNameTamil: row.rtoNameTamil ?? "",
      rtoCode: row.rtoCode,
      status: row.status === "DELETED" ? "ACTIVE" : row.status,
    });
    loadDistrictOptions(row.tenantBusinessId);
    setFormOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        tenantBusinessId: form.tenantBusinessId,
        tenantDistrictId: form.tenantDistrictId,
        rtoName: form.rtoName,
        // "" means not given, never an empty Tamil name.
        rtoNameTamil: form.rtoNameTamil || undefined,
        rtoCode: form.rtoCode,
        ...(editing ? { status: form.status } : {}),
      };
      if (editing) {
        await api(`/system/tenant-rtos/${editing.id}`, { method: "PATCH", body });
        toast.success("RTO updated");
      } else {
        await api("/system/tenant-rtos", { method: "POST", body });
        toast.success("RTO created");
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
      await api(`/system/tenant-rtos/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("RTO deleted");
      setDeleteTarget(null);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function onRestore(row: TenantRtoRow) {
    setRestoringId(row.id);
    try {
      await api(`/system/tenant-rtos/${row.id}/restore`, { method: "PATCH" });
      toast.success("RTO restored");
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Restore failed");
    } finally {
      setRestoringId(null);
    }
  }

  const columns: Column<TenantRtoRow>[] = [
    { header: "Business", cell: (row) => row.tenantBusiness?.name ?? "\u2014" },
    { header: "Code", cell: (row) => <span className="font-mono text-xs">{row.rtoCode}</span> },
    { header: "RTO", cell: (row) => <span className="font-medium">{row.rtoName}</span> },
    { header: "Tamil Name", cell: (row) => row.rtoNameTamil ?? "—" },
    { header: "District", cell: (row) => row.district?.districtName ?? "—" },
    { header: "Status", cell: (row) => <StatusBadgeText status={row.status} /> },
  ];

  if (!canView) {
    return (
      <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
        You don&apos;t have permission to view this.
      </div>
    );
  }

  return (
    <>
      <ResourceTable<TenantRtoRow>
        title="RTOs"
        description="Regional Transport Offices across every tenant business."
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
                <Plus className="size-4" /> Add RTO
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
              <DialogTitle>{editing ? "Edit RTO" : "Add RTO"}</DialogTitle>
              <DialogDescription>
                Regional Transport Offices, filed under a district.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Always shown: a system admin has no "own" business to
                  default to, unlike the tenant surface. */}
              {true && (
                <div className="grid gap-2">
                  <Label required>Business</Label>
                  <Combobox
                    options={businessOptions?.map((b) => ({ value: b.id, label: b.name })) ?? null}
                    value={form.tenantBusinessId}
                    onValueChange={onBusinessChange}
                    placeholder="Select a business"
                    searchPlaceholder="Search businesses..."
                    emptyText="No businesses found."
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label required>District</Label>
                <Combobox
                  options={districtOptions?.map((o) => ({ value: o.id, label: o.districtName })) ?? null}
                  value={form.tenantDistrictId}
                  onValueChange={(v) => setForm((f) => ({ ...f, tenantDistrictId: v }))}
                  placeholder={
                    form.tenantBusinessId ? "Select a district" : "Select a business first"
                  }
                  searchPlaceholder="Search districts..."
                  emptyText="No districts found."
                />
              </div>

              <div className="grid gap-2">
                <Label required htmlFor="rtoCode">RTO Code</Label>
                <Input
                  id="rtoCode"
                  required
                  maxLength={10}
                  placeholder="TN38"
                  value={form.rtoCode}
                  onChange={(e) => setForm((f) => ({ ...f, rtoCode: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label required htmlFor="rtoName">RTO Name</Label>
                <Input
                  id="rtoName"
                  required
                  maxLength={100}
                  value={form.rtoName}
                  onChange={(e) => setForm((f) => ({ ...f, rtoName: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="rtoNameTamil">RTO Name (Tamil)</Label>
                <Input
                  id="rtoNameTamil"
                  maxLength={100}
                  value={form.rtoNameTamil}
                  onChange={(e) => setForm((f) => ({ ...f, rtoNameTamil: e.target.value }))}
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !form.tenantBusinessId || !form.tenantDistrictId}
              >
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
        title="Delete RTO"
        description={`This will soft-delete "${deleteTarget?.rtoName}".`}
        loading={deleting}
        onConfirm={onDelete}
      />
    </>
  );
}
