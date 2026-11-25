"use client";

import * as React from "react";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
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
import { useTenantSession } from "@/hooks/use-tenant-session";
import { TenantApiError, tenantApi } from "@/lib/tenant-api";

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
  status: PositionStatus;
  tenantBusiness?: { id: string; systemCode: string; name: string };
}

interface BusinessOption {
  id: string;
  name: string;
}

interface PositionFormValues {
  tenantBusinessId: string;
  positionName: string;
  positionNameTamil: string;
  remark: string;
  showOnApplicationForm: boolean;
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
  status: "ACTIVE",
};

export default function TenantAssociationPositionsSettingsPage() {
  const { hasPermission } = useTenantSession();

  const canView = hasPermission("tenant-association-positions:list");
  const canCreate = hasPermission("tenant-association-positions:create");
  const canUpdate = hasPermission("tenant-association-positions:update");
  const canDelete = hasPermission("tenant-association-positions:delete");

  // The third argument swaps the fetcher to the tenant client.
  const list = useResourceList<TenantAssociationPositionRow>(
    "/tenant/association-positions",
    {},
    tenantApi,
  );

  const [businessOptions, setBusinessOptions] = React.useState<BusinessOption[] | null>(null);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TenantAssociationPositionRow | null>(null);
  const [form, setForm] = React.useState<PositionFormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<TenantAssociationPositionRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  function loadBusinessOptions(): Promise<BusinessOption[]> {
    if (businessOptions) return Promise.resolve(businessOptions);
    return tenantApi<BusinessOption[]>("/tenant/association-positions/businesses")
      .then((data) => {
        setBusinessOptions(data);
        return data;
      })
      .catch(() => {
        toast.error("Failed to load your businesses");
        return [];
      });
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
    // One business is the common case, so choose it rather than making the
    // user pick from a list of one.
    loadBusinessOptions().then((options) => {
      if (options.length === 1) {
        setForm((f) => ({ ...f, tenantBusinessId: options[0].id }));
      }
    });
  }

  function openEdit(row: TenantAssociationPositionRow) {
    loadBusinessOptions();
    setEditing(row);
    setForm({
      tenantBusinessId: row.tenantBusinessId,
      positionName: row.positionName,
      positionNameTamil: row.positionNameTamil ?? "",
      remark: row.remark ?? "",
      showOnApplicationForm: row.showOnApplicationForm,
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
        ...(editing ? { status: form.status } : {}),
      };
      if (editing) {
        await tenantApi(`/tenant/association-positions/${editing.id}`, { method: "PATCH", body });
        toast.success("Position updated");
      } else {
        await tenantApi("/tenant/association-positions", { method: "POST", body });
        toast.success("Position created");
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
      await tenantApi(`/tenant/association-positions/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Position deleted");
      setDeleteTarget(null);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof TenantApiError ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<TenantAssociationPositionRow>[] = [
    {
      header: "Position",
      cell: (row) => <span className="font-medium">{row.positionName}</span>,
    },
    { header: "Tamil Name", cell: (row) => row.positionNameTamil ?? "—" },
    { header: "Remark", cell: (row) => row.remark ?? "—" },
    {
      header: "On application form",
      cell: (row) => (row.showOnApplicationForm ? "Yes" : "No"),
    },
    { header: "Status", cell: (row) => <StatusBadgeText status={row.status} /> },
  ];

  if (!canView) {
    return (
      <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
        You don&apos;t have permission to view association positions.
      </div>
    );
  }

  return (
    <>
      <ResourceTable<TenantAssociationPositionRow>
        title="Association Positions"
        description="Positions your members hold. Search matches either name."
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
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Add Position
            </Button>
          ) : undefined
        }
        renderActions={
          canUpdate || canDelete
            ? (row) => (
                <RowActionsMenu
                  actions={[
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
                  ]}
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
              <DialogDescription>A position members of your business hold.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Only worth showing when there is a genuine choice to make. */}
              {(businessOptions?.length ?? 0) > 1 && (
                <div className="grid gap-2">
                  <Label required>Business</Label>
                  <Combobox
                    options={businessOptions?.map((biz) => ({ value: biz.id, label: biz.name })) ?? null}
                    value={form.tenantBusinessId}
                    onValueChange={(v) => setForm((f) => ({ ...f, tenantBusinessId: v }))}
                    onOpenChange={(open) => open && loadBusinessOptions()}
                    placeholder="Select a business"
                    searchPlaceholder="Search businesses..."
                    emptyText="No businesses found."
                  />
                </div>
              )}

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
