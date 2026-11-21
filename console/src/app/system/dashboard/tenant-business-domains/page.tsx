"use client";

import * as React from "react";
import { Globe, LoaderCircle, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { ResourceTable, type Column } from "@/components/resource-table";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { useResourceList } from "@/hooks/use-resource-list";
import { useSession } from "@/hooks/use-session";
import { api, ApiError, type ListResponse } from "@/lib/api";

interface DomainRow {
  id: string;
  tenantBusinessId: string;
  hostname: string;
  enabled: boolean;
  createdAt: number;
  tenantBusiness?: { id: string; systemCode: string; name: string };
}

interface BusinessOption {
  id: string;
  name: string;
}

interface DomainFormValues {
  tenantBusinessId: string;
  hostname: string;
}

const EMPTY_FORM: DomainFormValues = { tenantBusinessId: "", hostname: "" };

/**
 * The hostnames each business's portal is served on.
 *
 * System-admin only by design - there is no tenant self-service twin, because
 * claiming a hostname is a trust boundary. See docs/guide/domains.
 */
export default function TenantBusinessDomainsPage() {
  const { hasPermission } = useSession();
  const canCreate = hasPermission("tenant-business-domains:create");
  const canUpdate = hasPermission("tenant-business-domains:update");
  const canDelete = hasPermission("tenant-business-domains:delete");

  const [enabledFilter, setEnabledFilter] = React.useState<string>("");
  const list = useResourceList<DomainRow>("/system/tenant-business-domains", {
    enabled: enabledFilter || undefined,
  });

  const [businesses, setBusinesses] = React.useState<BusinessOption[] | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<DomainFormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<DomainRow | null>(null);

  const loadBusinesses = React.useCallback(() => {
    if (businesses !== null) return;
    api<ListResponse<BusinessOption>>("/system/tenant-business?page=1&limit=100")
      .then((res) => setBusinesses(res.items))
      .catch(() => {
        setBusinesses([]);
        toast.error("Could not load businesses");
      });
  }, [businesses]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
    loadBusinesses();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await api("/system/tenant-business-domains", { method: "POST", body: form });
      toast.success("Domain added. Point its DNS at this server, then open it over HTTPS.");
      setDialogOpen(false);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not add the domain");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(row: DomainRow) {
    setBusyId(row.id);
    try {
      await api(`/system/tenant-business-domains/${row.id}`, {
        method: "PATCH",
        body: { enabled: !row.enabled },
      });
      toast.success(
        row.enabled
          ? `${row.hostname} disabled — it will stop resolving to its business`
          : `${row.hostname} enabled`,
      );
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not update the domain");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api(`/system/tenant-business-domains/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(`${deleteTarget.hostname} removed`);
      setDeleteTarget(null);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not remove the domain");
    }
  }

  const columns: Column<DomainRow>[] = [
    {
      header: "Hostname",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Globe className="size-4 shrink-0 text-muted-foreground" />
          <code className="text-sm">{row.hostname}</code>
        </div>
      ),
    },
    { header: "Business", cell: (row) => row.tenantBusiness?.name ?? "—" },
    {
      header: "Status",
      cell: (row) =>
        row.enabled ? (
          <Badge variant="outline">Enabled</Badge>
        ) : (
          <Badge variant="secondary">Disabled</Badge>
        ),
    },
  ];

  return (
    <div className="grid gap-4">
      <ResourceTable
        title="Tenant Business Domains"
        description="Hostnames each business's portal is served on. Point the DNS at this server, add it here, then open it — the certificate is issued on the first visit."
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
          <div className="flex items-center gap-2">
            <Select
              value={enabledFilter || "ALL"}
              onValueChange={(value) => setEnabledFilter(value === "ALL" ? "" : value)}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="true">Enabled</SelectItem>
                <SelectItem value="false">Disabled</SelectItem>
              </SelectContent>
            </Select>
            {canCreate && (
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Add Domain
              </Button>
            )}
          </div>
        }
        renderActions={(row) => (
          <RowActionsMenu
            actions={[
              ...(canUpdate
                ? [
                    {
                      label: row.enabled ? "Disable" : "Enable",
                      icon: row.enabled ? PowerOff : Power,
                      onClick: () => void toggleEnabled(row),
                      loading: busyId === row.id,
                    },
                  ]
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
              <DialogTitle>Add Domain</DialogTitle>
              <DialogDescription>
                The hostname is stored lowercase with any scheme, port or path removed.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tenantBusinessId" required>
                  Business
                </Label>
                <Combobox
                  options={businesses?.map((b) => ({ value: b.id, label: b.name })) ?? null}
                  value={form.tenantBusinessId}
                  onValueChange={(value) => setForm((f) => ({ ...f, tenantBusinessId: value }))}
                  placeholder="Select a business"
                  onOpenChange={loadBusinesses}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hostname" required>
                  Hostname
                </Label>
                <Input
                  id="hostname"
                  value={form.hostname}
                  onChange={(e) => setForm((f) => ({ ...f, hostname: e.target.value }))}
                  placeholder="app.example.com"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  A full hostname, no scheme or port. <code>*.localhost</code> works locally
                  with no DNS at all.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !form.tenantBusinessId}>
                {saving && <LoaderCircle className="size-4 animate-spin" />}
                Add Domain
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove this domain?"
        description={
          deleteTarget
            ? `${deleteTarget.hostname} will stop resolving to ${deleteTarget.tenantBusiness?.name ?? "its business"}, and its certificate will not be renewed. The hostname becomes available to claim again. To keep the record instead, disable it.`
            : ""
        }
        confirmLabel="Remove"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
