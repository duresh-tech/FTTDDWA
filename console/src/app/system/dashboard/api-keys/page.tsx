"use client";

import * as React from "react";
import { Ban, KeyRound, LoaderCircle, Pencil, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { ApiKeyScopePicker, type ScopeTemplateOption } from "@/components/api-key-scope-picker";
import { ApiKeySecretDialog, type IssuedApiKey } from "@/components/api-key-secret-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { ResourceTable, type Column } from "@/components/resource-table";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { useResourceList } from "@/hooks/use-resource-list";
import { useSession } from "@/hooks/use-session";
import { api, ApiError, type ListResponse } from "@/lib/api";

interface ApiKeyRow {
  id: string;
  systemCode: string;
  tenantBusinessId: string | null;
  title: string;
  description: string | null;
  keyType: "LIVE" | "TEST";
  keyPrefix: string;
  secretLast4: string;
  status: "ACTIVE" | "SUSPENDED" | "REVOKED";
  expiresAt: number | null;
  isExpired: boolean;
  lastUsedAt: number | null;
  usageCount: number;
  scopes: string[];
  tenantBusiness?: { id: string; name: string; systemCode: string } | null;
}

interface IssueResponse extends ApiKeyRow {
  secret: string;
  token: string;
}

interface ScopeOption {
  permissionKey: string;
  moduleName: string;
  displayName: string;
}

interface FormValues {
  title: string;
  description: string;
  keyType: "LIVE" | "TEST";
  tenantBusinessId: string;
  /** `yyyy-mm-dd` from the date input, or "" for no expiry. */
  expiresOn: string;
  scopes: string[];
}

const EMPTY_FORM: FormValues = {
  title: "",
  description: "",
  keyType: "TEST",
  tenantBusinessId: "",
  expiresOn: "",
  scopes: [],
};

/**
 * The console's own key, issued by the setup wizard. Must match
 * CONSOLE_KEY_TITLE in backend/src/common/bootstrap/bootstrap.ts.
 *
 * Marking it is advisory, not a lock: it is an ordinary key and revoking it is
 * allowed. It is just worth knowing that it is the credential this very page
 * is using, and that recovering from that takes `npm run console-key` on the
 * server.
 */
const CONSOLE_KEY_TITLE = "System Console";

function toUnixSeconds(date: string): number | undefined {
  if (!date) return undefined;
  // End of the chosen day, so "expires on the 5th" includes the 5th.
  const parsed = Date.parse(`${date}T23:59:59`);
  return Number.isNaN(parsed) ? undefined : Math.floor(parsed / 1000);
}

function formatDate(seconds: number | null): string {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleDateString();
}

/**
 * Machine credentials for external applications.
 *
 * A key authenticates the calling application. On console routes the
 * signed-in user's RBAC is still what authorises the request, which is why a
 * key with no scopes is useful and normal. See docs/guide/api-keys.
 */
export default function ApiKeysPage() {
  const { user, hasPermission } = useSession();
  const canCreate = hasPermission("api-keys:create");
  const canUpdate = hasPermission("api-keys:update");
  const canRotate = hasPermission("api-keys:rotate");
  const canRevoke = hasPermission("api-keys:revoke");

  const [statusFilter, setStatusFilter] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const list = useResourceList<ApiKeyRow>("/system/api-keys", {
    status: statusFilter || undefined,
    keyType: typeFilter || undefined,
  });

  const [businesses, setBusinesses] = React.useState<{ id: string; name: string }[] | null>(null);
  const [scopeOptions, setScopeOptions] = React.useState<ScopeOption[] | null>(null);
  const [templates, setTemplates] = React.useState<ScopeTemplateOption[] | null>(null);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ApiKeyRow | null>(null);
  const [form, setForm] = React.useState<FormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [issued, setIssued] = React.useState<IssuedApiKey | null>(null);
  const [rotateTarget, setRotateTarget] = React.useState<ApiKeyRow | null>(null);
  const [revokeTarget, setRevokeTarget] = React.useState<ApiKeyRow | null>(null);

  const loadBusinesses = React.useCallback(() => {
    if (businesses !== null) return;
    api<ListResponse<{ id: string; name: string }>>("/system/tenant-business?page=1&limit=100")
      .then((res) => setBusinesses(res.items))
      .catch(() => {
        setBusinesses([]);
        toast.error("Could not load businesses");
      });
  }, [businesses]);

  /**
   * The scope list is the operator's OWN permissions.
   *
   * The server refuses to grant a scope the issuer does not hold, so offering
   * the full catalogue would just be a list of options that fail on save. The
   * display names come from the catalogue endpoint, and fall back to the
   * permission key itself when that endpoint is not readable.
   */
  const loadScopeOptions = React.useCallback(() => {
    if (scopeOptions !== null) return;
    const held = new Set(user?.permissions ?? []);
    api<{ items: ScopeOption[] }>("/system/api-key-scope-templates/permission-catalogue")
      .then((res) => setScopeOptions(res.items.filter((item) => held.has(item.permissionKey))))
      .catch(() =>
        setScopeOptions(
          [...held].sort().map((permissionKey) => ({
            permissionKey,
            moduleName: permissionKey.split(":")[0],
            displayName: permissionKey,
          })),
        ),
      );
  }, [scopeOptions, user]);

  const loadTemplates = React.useCallback(() => {
    if (templates !== null) return;
    api<ListResponse<ScopeTemplateOption>>(
      "/system/api-key-scope-templates?page=1&limit=100&status=ACTIVE",
    )
      .then((res) => setTemplates(res.items))
      // Templates are a convenience; the checkbox list works without them.
      .catch(() => setTemplates([]));
  }, [templates]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
    loadBusinesses();
    loadScopeOptions();
    loadTemplates();
  }

  function openEdit(row: ApiKeyRow) {
    setEditing(row);
    setForm({
      title: row.title,
      description: row.description ?? "",
      keyType: row.keyType,
      tenantBusinessId: row.tenantBusinessId ?? "",
      expiresOn: row.expiresAt ? new Date(row.expiresAt * 1000).toISOString().slice(0, 10) : "",
      scopes: row.scopes,
    });
    setDialogOpen(true);
    loadScopeOptions();
    loadTemplates();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api(`/system/api-keys/${editing.id}`, {
          method: "PATCH",
          body: {
            title: form.title,
            description: form.description || undefined,
            scopes: form.scopes,
            // null clears the expiry; undefined would leave it unchanged.
            expiresAt: toUnixSeconds(form.expiresOn) ?? null,
          },
        });
        toast.success("Key updated");
        setDialogOpen(false);
        list.refresh();
      } else {
        const created = await api<IssueResponse>("/system/api-keys", {
          method: "POST",
          body: {
            title: form.title,
            description: form.description || undefined,
            keyType: form.keyType,
            tenantBusinessId: form.tenantBusinessId || undefined,
            scopes: form.scopes,
            expiresAt: toUnixSeconds(form.expiresOn),
          },
        });
        setDialogOpen(false);
        // The secret dialog opens BEFORE the list refreshes: this is the only
        // moment the secret exists outside the caller's memory, so nothing
        // else gets to interrupt it.
        setIssued({ title: created.title, keyPrefix: created.keyPrefix, token: created.token });
        list.refresh();
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save the key");
    } finally {
      setSaving(false);
    }
  }

  async function confirmRotate() {
    if (!rotateTarget) return;
    try {
      const rotated = await api<IssueResponse>(`/system/api-keys/${rotateTarget.id}/rotate`, {
        method: "PATCH",
      });
      setRotateTarget(null);
      setIssued({ title: rotated.title, keyPrefix: rotated.keyPrefix, token: rotated.token });
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not rotate the key");
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    try {
      await api(`/system/api-keys/${revokeTarget.id}/revoke`, { method: "PATCH", body: {} });
      toast.success(`${revokeTarget.title} revoked`);
      setRevokeTarget(null);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not revoke the key");
    }
  }

  const columns: Column<ApiKeyRow>[] = [
    {
      header: "Key",
      cell: (row) => (
        <div className="grid gap-0.5">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">{row.title}</span>
            {row.title === CONSOLE_KEY_TITLE && row.tenantBusinessId === null && (
              <Badge variant="secondary">This console</Badge>
            )}
          </div>
          <code className="text-xs text-muted-foreground">
            {row.keyPrefix}.&hellip;{row.secretLast4}
          </code>
        </div>
      ),
    },
    { header: "Owner", cell: (row) => row.tenantBusiness?.name ?? "Platform" },
    {
      header: "Type",
      cell: (row) => (
        <Badge variant={row.keyType === "LIVE" ? "default" : "outline"}>{row.keyType}</Badge>
      ),
    },
    {
      header: "Scopes",
      cell: (row) =>
        row.scopes.length === 0 ? (
          <span className="text-xs text-muted-foreground">None (session RBAC applies)</span>
        ) : (
          <span className="text-xs">{row.scopes.length}</span>
        ),
    },
    {
      header: "Status",
      cell: (row) => {
        if (row.status === "REVOKED") return <Badge variant="destructive">Revoked</Badge>;
        // Expiry is derived from the clock, never stored - so a key can be
        // ACTIVE and expired at the same time, and the list must say so.
        if (row.isExpired) return <Badge variant="destructive">Expired</Badge>;
        if (row.status === "SUSPENDED") return <Badge variant="secondary">Suspended</Badge>;
        return <Badge variant="outline">Active</Badge>;
      },
    },
    { header: "Expires", cell: (row) => formatDate(row.expiresAt) },
    { header: "Last used", cell: (row) => formatDate(row.lastUsedAt) },
  ];

  return (
    <div className="grid gap-4">
      <ResourceTable
        title="API Keys"
        description="Machine credentials for external applications. A key authenticates the calling application; on console routes the signed-in user's permissions still decide what it may do."
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
              value={typeFilter || "ALL"}
              onValueChange={(value) => setTypeFilter(value === "ALL" ? "" : value)}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                <SelectItem value="LIVE">Live</SelectItem>
                <SelectItem value="TEST">Test</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter || "ALL"}
              onValueChange={(value) => setStatusFilter(value === "ALL" ? "" : value)}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="REVOKED">Revoked</SelectItem>
              </SelectContent>
            </Select>
            {canCreate && (
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Issue Key
              </Button>
            )}
          </div>
        }
        renderActions={(row) => {
          const revoked = row.status === "REVOKED";
          const editable = !revoked;
          return (
            <RowActionsMenu
              actions={[
                ...(canUpdate && editable
                  ? [{ label: "Edit", icon: Pencil, onClick: () => openEdit(row) }]
                  : []),
                ...(canRotate && editable
                  ? [
                      {
                        label: "Rotate secret",
                        icon: RefreshCw,
                        onClick: () => setRotateTarget(row),
                      },
                    ]
                  : []),
                ...(canRevoke && editable
                  ? [
                      {
                        label: "Revoke",
                        icon: Ban,
                        destructive: true,
                        onClick: () => setRevokeTarget(row),
                      },
                    ]
                  : []),
              ]}
            />
          );
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit API Key" : "Issue API Key"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "The key type and owning business are fixed — issue a new key to change either."
                  : "The secret is shown once, immediately after this. A key can only carry scopes you hold yourself."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title" required>
                  Title
                </Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
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
                  placeholder="Which application uses this, and who owns it"
                  rows={2}
                />
              </div>

              {!editing && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="keyType" required>
                      Type
                    </Label>
                    <Select
                      value={form.keyType}
                      onValueChange={(value) =>
                        setForm((f) => ({ ...f, keyType: value as "LIVE" | "TEST" }))
                      }
                    >
                      <SelectTrigger id="keyType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TEST">Test</SelectItem>
                        <SelectItem value="LIVE">Live</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Baked into the key prefix, so it cannot change later.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tenantBusinessId">Business</Label>
                    <Combobox
                      options={businesses?.map((b) => ({ value: b.id, label: b.name })) ?? null}
                      value={form.tenantBusinessId}
                      onValueChange={(value) => setForm((f) => ({ ...f, tenantBusinessId: value }))}
                      placeholder="Platform-level"
                      onOpenChange={loadBusinesses}
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty for a platform key. A business key is confined to that
                      business&apos;s data.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="expiresOn">Expires on</Label>
                <Input
                  id="expiresOn"
                  type="date"
                  value={form.expiresOn}
                  onChange={(e) => setForm((f) => ({ ...f, expiresOn: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Empty means it never expires. A bounded life is the safer default.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Scopes</Label>
                <ApiKeyScopePicker
                  options={scopeOptions}
                  templates={templates}
                  value={form.scopes}
                  onChange={(scopes) => setForm((f) => ({ ...f, scopes }))}
                  emptyHint="the key authenticates the application only"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <LoaderCircle className="size-4 animate-spin" />}
                {editing ? "Save" : "Issue Key"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ApiKeySecretDialog issued={issued} onClose={() => setIssued(null)} />

      <ConfirmDialog
        open={rotateTarget !== null}
        onOpenChange={(open) => !open && setRotateTarget(null)}
        title="Rotate this secret?"
        description={
          rotateTarget
            ? `A new secret is issued for "${rotateTarget.title}" and the current one stops working immediately. Anything still using it will start failing until you update it. The new secret is shown once.` +
              (rotateTarget.title === CONSOLE_KEY_TITLE
                ? " This is the key this console itself is using: rotating it here does not update the stored copy, so run `npm run console-key` on the server instead."
                : "")
            : ""
        }
        confirmLabel="Rotate"
        onConfirm={confirmRotate}
      />

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke this key?"
        description={
          revokeTarget
            ? `"${revokeTarget.title}" stops working immediately and cannot be restored — the stored hash is scrubbed. Issue a new key instead.` +
              (revokeTarget.title === CONSOLE_KEY_TITLE
                ? " This is the key this console itself is using: revoking it locks the console out until someone runs `npm run console-key` on the server."
                : "")
            : ""
        }
        confirmLabel="Revoke"
        onConfirm={confirmRevoke}
      />
    </div>
  );
}
