"use client";

import * as React from "react";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
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
import { useTenantSession } from "@/hooks/use-tenant-session";
import { TenantApiError, tenantApi } from "@/lib/tenant-api";

interface TenantDistrictRow {
  id: string;
  systemCode: string;
  tenantBusinessId: string;
  stateId: string;
  districtName: string;
  districtNameTamil: string | null;
  districtCode: string;
  status: "ACTIVE" | "INACTIVE" | "DELETED";
  tenantBusiness?: { id: string; systemCode: string; name: string };
  state?: { id: string; stateName: string };
}

interface BusinessOption {
  id: string;
  name: string;
}

interface StateOption {
  id: string;
  stateName: string;
}

interface FormValues {
  tenantBusinessId: string;
  stateId: string;
  districtName: string;
  districtNameTamil: string;
  districtCode: string;
  status: "ACTIVE" | "INACTIVE";
}

const EMPTY_FORM: FormValues = {
  tenantBusinessId: "",
  stateId: "",
  districtName: "",
  districtNameTamil: "",
  districtCode: "",
  status: "ACTIVE",
};

export default function TenantDistrictTenantPagePage() {
  const { hasPermission } = useTenantSession();

  const canView = hasPermission("tenant-districts:list");
  const canCreate = hasPermission("tenant-districts:create");
  const canUpdate = hasPermission("tenant-districts:update");
  const canDelete = hasPermission("tenant-districts:delete");

  const list = useResourceList<TenantDistrictRow>("/tenant/districts", {}, tenantApi);

  const [businessOptions, setBusinessOptions] = React.useState<BusinessOption[] | null>(null);
  const [stateOptions, setStateOptions] = React.useState<StateOption[] | null>(null);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TenantDistrictRow | null>(null);
  const [form, setForm] = React.useState<FormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<TenantDistrictRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  function loadBusinessOptions(): Promise<BusinessOption[]> {
    if (businessOptions) return Promise.resolve(businessOptions);
    return tenantApi<BusinessOption[]>("/tenant/districts/businesses")
      .then((data) => {
        setBusinessOptions(data);
        return data;
      })
      .catch(() => {
        toast.error("Failed to load your businesses");
        return [];
      });
  }

  function loadStateOptions(tenantBusinessId: string) {
    if (!tenantBusinessId) {
      setStateOptions([]);
      return;
    }
    tenantApi<StateOption[]>(`/tenant/districts/states?tenantBusinessId=${tenantBusinessId}`)
      .then(setStateOptions)
      .catch(() => toast.error("Failed to load state list"));
  }

  // Changing the business invalidates every child below it.
  function onBusinessChange(tenantBusinessId: string) {
    setForm((f) => ({ ...f, tenantBusinessId, stateId: "" }));
    loadStateOptions(tenantBusinessId);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setStateOptions(null);
    setFormOpen(true);
    loadBusinessOptions().then((options) => {
      // One business is the common case - choose it rather than making the
      // user pick from a list of one.
      if (options.length === 1) {
        setForm((f) => ({ ...f, tenantBusinessId: options[0].id }));
        loadStateOptions(options[0].id);
      }
    });
  }

  function openEdit(row: TenantDistrictRow) {
    loadBusinessOptions();
    setEditing(row);
    setForm({
      tenantBusinessId: row.tenantBusinessId,
      stateId: row.stateId,
      districtName: row.districtName,
      districtNameTamil: row.districtNameTamil ?? "",
      districtCode: row.districtCode,
      status: row.status === "DELETED" ? "ACTIVE" : row.status,
    });
    loadStateOptions(row.tenantBusinessId);
    setFormOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        tenantBusinessId: form.tenantBusinessId,
        stateId: form.stateId,
        districtName: form.districtName,
        // "" means not given, never an empty Tamil name.
        districtNameTamil: form.districtNameTamil || undefined,
        districtCode: form.districtCode,
        ...(editing ? { status: form.status } : {}),
      };
      if (editing) {
        await tenantApi(`/tenant/districts/${editing.id}`, { method: "PATCH", body });
        toast.success("District updated");
      } else {
        await tenantApi("/tenant/districts", { method: "POST", body });
        toast.success("District created");
      }
      setFormOpen(false);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof TenantApiError ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await tenantApi(`/tenant/districts/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("District deleted");
      setDeleteTarget(null);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof TenantApiError ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<TenantDistrictRow>[] = [
    { header: "District", cell: (row) => <span className="font-medium">{row.districtName}</span> },
    { header: "Tamil Name", cell: (row) => row.districtNameTamil ?? "\u2014" },
    { header: "Code", cell: (row) => row.districtCode },
    { header: "State", cell: (row) => row.state?.stateName ?? "\u2014" },
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
      <ResourceTable<TenantDistrictRow>
        title="Districts"
        description="Districts for your business."
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
            {canCreate && (
              <Button onClick={openCreate}>
                <Plus className="size-4" /> Add District
              </Button>
            )}
          </>
        }
        renderActions={
          canUpdate || canDelete
            ? (row) => (
                <RowActionsMenu
                  actions={
                    [
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
              <DialogTitle>{editing ? "Edit District" : "Add District"}</DialogTitle>
              <DialogDescription>Districts for your business.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">

              {(businessOptions?.length ?? 0) > 1 && (
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
                <Label required>State</Label>
                <Combobox
                  options={stateOptions?.map((o) => ({ value: o.id, label: o.stateName })) ?? null}
                  value={form.stateId}
                  onValueChange={(v) => setForm((f) => ({ ...f, stateId: v }))}
                  placeholder={form.tenantBusinessId ? "Select a state" : "Select a business first"}
                  searchPlaceholder="Search states..."
                  emptyText="No states found."
                />
              </div>

              <div className="grid gap-2">
                <Label required htmlFor="districtName">District Name</Label>
                <Input
                  id="districtName"
                  required
                  value={form.districtName}
                  onChange={(e) => setForm((f) => ({ ...f, districtName: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="districtNameTamil">District Name (Tamil)</Label>
                <Input
                  id="districtNameTamil"
                  value={form.districtNameTamil}
                  onChange={(e) => setForm((f) => ({ ...f, districtNameTamil: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label required htmlFor="districtCode">District Code</Label>
                <Input
                  id="districtCode"
                  required
                  value={form.districtCode}
                  onChange={(e) => setForm((f) => ({ ...f, districtCode: e.target.value }))}
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
              <Button type="submit" disabled={saving || !form.tenantBusinessId || !form.stateId}>
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
        title="Delete district"
        description={`This will soft-delete "${deleteTarget?.districtName}".`}
        loading={deleting}
        onConfirm={onDelete}
      />
    </>
  );
}
