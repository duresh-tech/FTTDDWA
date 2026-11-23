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

interface TenantTalukRow {
  id: string;
  systemCode: string;
  tenantBusinessId: string;
  stateId: string;
  districtId: string;
  talukName: string;
  talukNameTamil: string | null;
  status: "ACTIVE" | "INACTIVE" | "DELETED";
  tenantBusiness?: { id: string; systemCode: string; name: string };
  state?: { id: string; stateName: string };
  district?: { id: string; districtName: string };
}

interface BusinessOption {
  id: string;
  name: string;
}

interface StateOption {
  id: string;
  stateName: string;
}

interface DistrictOption {
  id: string;
  districtName: string;
}

interface FormValues {
  tenantBusinessId: string;
  stateId: string;
  districtId: string;
  talukName: string;
  talukNameTamil: string;
  status: "ACTIVE" | "INACTIVE";
}

const EMPTY_FORM: FormValues = {
  tenantBusinessId: "",
  stateId: "",
  districtId: "",
  talukName: "",
  talukNameTamil: "",
  status: "ACTIVE",
};

export default function TenantTalukTenantPagePage() {
  const { hasPermission } = useTenantSession();

  const canView = hasPermission("tenant-taluks:list");
  const canCreate = hasPermission("tenant-taluks:create");
  const canUpdate = hasPermission("tenant-taluks:update");
  const canDelete = hasPermission("tenant-taluks:delete");

  const list = useResourceList<TenantTalukRow>("/tenant/taluks", {}, tenantApi);

  const [businessOptions, setBusinessOptions] = React.useState<BusinessOption[] | null>(null);
  const [stateOptions, setStateOptions] = React.useState<StateOption[] | null>(null);
  const [districtOptions, setDistrictOptions] = React.useState<DistrictOption[] | null>(null);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TenantTalukRow | null>(null);
  const [form, setForm] = React.useState<FormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<TenantTalukRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  function loadBusinessOptions(): Promise<BusinessOption[]> {
    if (businessOptions) return Promise.resolve(businessOptions);
    return tenantApi<BusinessOption[]>("/tenant/taluks/businesses")
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
    tenantApi<StateOption[]>(`/tenant/taluks/states?tenantBusinessId=${tenantBusinessId}`)
      .then(setStateOptions)
      .catch(() => toast.error("Failed to load state list"));
  }

  function loadDistrictOptions(tenantBusinessId: string, stateId: string) {
    if (!(tenantBusinessId && stateId)) {
      setDistrictOptions([]);
      return;
    }
    tenantApi<DistrictOption[]>(`/tenant/taluks/districts?tenantBusinessId=${tenantBusinessId}&stateId=${stateId}`)
      .then(setDistrictOptions)
      .catch(() => toast.error("Failed to load district list"));
  }

  // Changing the business invalidates every child below it.
  function onBusinessChange(tenantBusinessId: string) {
    setForm((f) => ({ ...f, tenantBusinessId, stateId: "", districtId: "" }));
    loadStateOptions(tenantBusinessId);
    setDistrictOptions(null);
  }

  function onStateChange(stateId: string) {
    setForm((f) => ({ ...f, stateId, districtId: "" }));
    loadDistrictOptions(form.tenantBusinessId, stateId);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setStateOptions(null);
    setDistrictOptions(null);
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

  function openEdit(row: TenantTalukRow) {
    loadBusinessOptions();
    setEditing(row);
    setForm({
      tenantBusinessId: row.tenantBusinessId,
      stateId: row.stateId,
      districtId: row.districtId,
      talukName: row.talukName,
      talukNameTamil: row.talukNameTamil ?? "",
      status: row.status === "DELETED" ? "ACTIVE" : row.status,
    });
    loadStateOptions(row.tenantBusinessId);
    loadDistrictOptions(row.tenantBusinessId, row.stateId);
    setFormOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        tenantBusinessId: form.tenantBusinessId,
        stateId: form.stateId,
        districtId: form.districtId,
        talukName: form.talukName,
        // "" means not given, never an empty Tamil name.
        talukNameTamil: form.talukNameTamil || undefined,
        ...(editing ? { status: form.status } : {}),
      };
      if (editing) {
        await tenantApi(`/tenant/taluks/${editing.id}`, { method: "PATCH", body });
        toast.success("Taluk updated");
      } else {
        await tenantApi("/tenant/taluks", { method: "POST", body });
        toast.success("Taluk created");
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
      await tenantApi(`/tenant/taluks/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Taluk deleted");
      setDeleteTarget(null);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof TenantApiError ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<TenantTalukRow>[] = [
    { header: "Taluk", cell: (row) => <span className="font-medium">{row.talukName}</span> },
    { header: "Tamil Name", cell: (row) => row.talukNameTamil ?? "\u2014" },
    { header: "State", cell: (row) => row.state?.stateName ?? "\u2014" },
    { header: "District", cell: (row) => row.district?.districtName ?? "\u2014" },
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
      <ResourceTable<TenantTalukRow>
        title="Taluks"
        description="Taluks for your business."
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
                <Plus className="size-4" /> Add Taluk
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
              <DialogTitle>{editing ? "Edit Taluk" : "Add Taluk"}</DialogTitle>
              <DialogDescription>Taluks for your business.</DialogDescription>
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
                  onValueChange={onStateChange}
                  placeholder={form.tenantBusinessId ? "Select a state" : "Select a business first"}
                  searchPlaceholder="Search states..."
                  emptyText="No states found."
                />
              </div>

              <div className="grid gap-2">
                <Label required>District</Label>
                <Combobox
                  options={districtOptions?.map((o) => ({ value: o.id, label: o.districtName })) ?? null}
                  value={form.districtId}
                  onValueChange={(v) => setForm((f) => ({ ...f, districtId: v }))}
                  placeholder={form.stateId ? "Select a district" : "Select a state first"}
                  searchPlaceholder="Search districts..."
                  emptyText="No districts found."
                />
              </div>

              <div className="grid gap-2">
                <Label required htmlFor="talukName">Taluk Name</Label>
                <Input
                  id="talukName"
                  required
                  value={form.talukName}
                  onChange={(e) => setForm((f) => ({ ...f, talukName: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="talukNameTamil">Taluk Name (Tamil)</Label>
                <Input
                  id="talukNameTamil"
                  value={form.talukNameTamil}
                  onChange={(e) => setForm((f) => ({ ...f, talukNameTamil: e.target.value }))}
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
              <Button type="submit" disabled={saving || !form.tenantBusinessId || !form.stateId || !form.districtId}>
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
        title="Delete taluk"
        description={`This will soft-delete "${deleteTarget?.talukName}".`}
        loading={deleting}
        onConfirm={onDelete}
      />
    </>
  );
}
