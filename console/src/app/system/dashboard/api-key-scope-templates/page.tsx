"use client";

import * as React from "react";
import { LayoutList, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ApiKeyScopePicker } from "@/components/api-key-scope-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { ResourceTable, type Column } from "@/components/resource-table";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { useResourceList } from "@/hooks/use-resource-list";
import { useSession } from "@/hooks/use-session";
import { api, ApiError } from "@/lib/api";

interface TemplateRow {
  id: string;
  systemCode: string;
  name: string;
  description: string | null;
  isTenant: boolean;
  displayOrder: number;
  status: "ACTIVE" | "INACTIVE" | "DELETED";
  scopes: string[];
}

interface ScopeOption {
  permissionKey: string;
  moduleName: string;
  displayName: string;
}

interface FormValues {
  name: string;
  description: string;
  isTenant: boolean;
  displayOrder: string;
  scopes: string[];
}

const EMPTY_FORM: FormValues = {
  name: "",
  description: "",
  isTenant: false,
  displayOrder: "0",
  scopes: [],
};

/**
 * Named bundles of scopes, so nobody assembles a key out of the whole
 * permission catalogue.
 *
 * Curated here and nowhere else: tenants read these to fill their own key
 * form but cannot write them, which is what lets an operator offer
 * "Reporting client" as a choice without also offering every permission in
 * the system as a checkbox. See docs/guide/api-keys.
 */
export default function ApiKeyScopeTemplatesPage() {
  const { hasPermission } = useSession();
  const canCreate = hasPermission("api-key-scope-templates:create");
  const canUpdate = hasPermission("api-key-scope-templates:update");
  const canDelete = hasPermission("api-key-scope-templates:delete");

  const list = useResourceList<TemplateRow>("/system/api-key-scope-templates");

  // The FULL catalogue here, not the operator's own permissions: a template
  // is a definition, and the key form intersects it with the issuer's
  // authority at the moment it is used.
  const [scopeOptions, setScopeOptions] = React.useState<ScopeOption[] | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TemplateRow | null>(null);
  const [form, setForm] = React.useState<FormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<TemplateRow | null>(null);

  const loadScopeOptions = React.useCallback(() => {
    if (scopeOptions !== null) return;
    // permission-catalogue, NOT the paged permission list: that caps at 100,
    // and a silently truncated catalogue produces templates missing scopes
    // nobody noticed were absent.
    api<{ items: ScopeOption[] }>("/system/api-key-scope-templates/permission-catalogue")
      .then((res) => setScopeOptions(res.items))
      .catch(() => {
        setScopeOptions([]);
        toast.error("Could not load the permission catalogue");
      });
  }, [scopeOptions]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
    loadScopeOptions();
  }

  function openEdit(row: TemplateRow) {
    setEditing(row);
    setForm({
      name: row.name,
      description: row.description ?? "",
      isTenant: row.isTenant,
      displayOrder: String(row.displayOrder),
      scopes: row.scopes,
    });
    setDialogOpen(true);
    loadScopeOptions();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.scopes.length === 0) {
      toast.error("A template needs at least one scope");
      return;
    }
    setSaving(true);
    const body = {
      name: form.name,
      description: form.description || undefined,
      isTenant: form.isTenant,
      displayOrder: Number(form.displayOrder) || 0,
      scopes: form.scopes,
    };
    try {
      if (editing) {
        await api(`/system/api-key-scope-templates/${editing.id}`, { method: "PATCH", body });
        toast.success("Template updated. Keys already issued from it keep their scopes.");
      } else {
        await api("/system/api-key-scope-templates", { method: "POST", body });
        toast.success("Template created");
      }
      setDialogOpen(false);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save the template");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api(`/system/api-key-scope-templates/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(`${deleteTarget.name} removed`);
      setDeleteTarget(null);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not remove the template");
    }
  }

  const columns: Column<TemplateRow>[] = [
    {
      header: "Template",
      cell: (row) => (
        <div className="grid gap-0.5">
          <div className="flex items-center gap-2">
            <LayoutList className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">{row.name}</span>
          </div>
          {row.description && (
            <span className="text-xs text-muted-foreground">{row.description}</span>
          )}
        </div>
      ),
    },
    { header: "Scopes", cell: (row) => <span className="text-xs">{row.scopes.length}</span> },
    {
      header: "Offered to",
      cell: (row) =>
        row.isTenant ? (
          <Badge variant="outline">Tenants and system</Badge>
        ) : (
          <Badge variant="secondary">System only</Badge>
        ),
    },
    { header: "Order", cell: (row) => row.displayOrder },
    {
      header: "Status",
      cell: (row) =>
        row.status === "ACTIVE" ? (
          <Badge variant="outline">Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        ),
    },
  ];

  return (
    <div className="grid gap-4">
      <ResourceTable
        title="API Key Scope Templates"
        description="Reusable scope bundles for the key form. A template is a shortcut at creation time, not a live link — changing one never alters a key already issued from it."
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
              <Plus className="size-4" />
              New Template
            </Button>
          ) : undefined
        }
        renderActions={(row) => (
          <RowActionsMenu
            actions={[
              ...(canUpdate
                ? [{ label: "Edit", icon: Pencil, onClick: () => openEdit(row) }]
                : []),
              ...(canDelete
                ? [
                    {
                      label: "Remove",
                      icon: Trash2,
                      destructive: true,
                      onClick: () => setDeleteTarget(row),
                    },
                  ]
                : []),
            ]}
          />
        )}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Template" : "New Template"}</DialogTitle>
              <DialogDescription>
                Name it for the job it does, not for the permissions it holds — the person
                picking it is choosing a kind of client.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name" required>
                  Name
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Reporting client"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What this kind of client does"
                  rows={2}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="displayOrder">Display order</Label>
                  <Input
                    id="displayOrder"
                    type="number"
                    min={0}
                    max={10000}
                    value={form.displayOrder}
                    onChange={(e) => setForm((f) => ({ ...f, displayOrder: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="isTenant">Availability</Label>
                  <div className="flex items-start gap-2 pt-2">
                    <Checkbox
                      id="isTenant"
                      checked={form.isTenant}
                      onCheckedChange={(value) =>
                        setForm((f) => ({ ...f, isTenant: value === true }))
                      }
                    />
                    <Label htmlFor="isTenant" className="text-sm font-normal leading-tight">
                      Offer this in the tenant portal
                      <span className="block text-xs text-muted-foreground">
                        A tenant can only use it if their own role holds every scope in it.
                      </span>
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label required>Scopes</Label>
                <ApiKeyScopePicker
                  options={scopeOptions}
                  value={form.scopes}
                  onChange={(scopes) => setForm((f) => ({ ...f, scopes }))}
                  emptyHint="a template needs at least one"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || form.scopes.length === 0}>
                {saving && <LoaderCircle className="size-4 animate-spin" />}
                {editing ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove this template?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will no longer be offered on the key form. Keys already issued from it keep their scopes — a template is a shortcut, not a live link.`
            : ""
        }
        confirmLabel="Remove"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
