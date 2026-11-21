"use client";

import * as React from "react";
import { Ban, KeyRound, LoaderCircle, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { ApiKeySecretDialog, type IssuedApiKey } from "@/components/api-key-secret-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useTenantSession } from "@/hooks/use-tenant-session";
import { TenantApiError, tenantApi } from "@/lib/tenant-api";

interface ApiKeyRow {
  id: string;
  systemCode: string;
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
}

interface IssueResponse extends ApiKeyRow {
  secret: string;
  token: string;
}

interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
  scopes: string[];
  /** False when this account's role does not hold every scope in it. */
  grantable: boolean;
  missingScopes: string[];
}

interface FormValues {
  title: string;
  description: string;
  keyType: "LIVE" | "TEST";
  templateId: string;
  expiresOn: string;
}

const EMPTY_FORM: FormValues = {
  title: "",
  description: "",
  keyType: "TEST",
  templateId: "",
  expiresOn: "",
};

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
 * This business's own API keys.
 *
 * Templates only, deliberately: there is no raw scope checkbox list here. The
 * person issuing a key should be choosing "Reporting client", not assembling
 * a bundle out of permission keys they have no reason to understand - and the
 * server would refuse anything their own role does not hold anyway.
 *
 * See docs/guide/api-keys.
 */
export default function TenantApiKeysPage() {
  const { hasPermission } = useTenantSession();
  const canCreate = hasPermission("api-keys:create");
  const canRotate = hasPermission("api-keys:rotate");
  const canRevoke = hasPermission("api-keys:revoke");

  const list = useResourceList<ApiKeyRow>("/tenant/api-keys", {}, tenantApi);

  const [templates, setTemplates] = React.useState<TemplateOption[] | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [issued, setIssued] = React.useState<IssuedApiKey | null>(null);
  const [rotateTarget, setRotateTarget] = React.useState<ApiKeyRow | null>(null);
  const [revokeTarget, setRevokeTarget] = React.useState<ApiKeyRow | null>(null);

  const loadTemplates = React.useCallback(() => {
    if (templates !== null) return;
    tenantApi<{ items: TemplateOption[] }>("/tenant/api-key-scope-templates")
      .then((res) => setTemplates(res.items))
      .catch(() => {
        setTemplates([]);
        toast.error("Could not load the available key types");
      });
  }, [templates]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
    loadTemplates();
  }

  const selectedTemplate = templates?.find((t) => t.id === form.templateId) ?? null;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTemplate) {
      toast.error("Choose what this key is for");
      return;
    }
    setSaving(true);
    try {
      const created = await tenantApi<IssueResponse>("/tenant/api-keys", {
        method: "POST",
        body: {
          title: form.title,
          description: form.description || undefined,
          keyType: form.keyType,
          // The template's scopes are sent as a plain list: the server checks
          // every one against this account's own permissions, so the template
          // is a convenience here and not a privilege.
          scopes: selectedTemplate.scopes,
          expiresAt: toUnixSeconds(form.expiresOn),
        },
      });
      setDialogOpen(false);
      setIssued({ title: created.title, keyPrefix: created.keyPrefix, token: created.token });
      list.refresh();
    } catch (error) {
      toast.error(
        error instanceof TenantApiError ? error.message : "Could not issue the key",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmRotate() {
    if (!rotateTarget) return;
    try {
      const rotated = await tenantApi<IssueResponse>(
        `/tenant/api-keys/${rotateTarget.id}/rotate`,
        { method: "PATCH" },
      );
      setRotateTarget(null);
      setIssued({ title: rotated.title, keyPrefix: rotated.keyPrefix, token: rotated.token });
      list.refresh();
    } catch (error) {
      toast.error(
        error instanceof TenantApiError ? error.message : "Could not rotate the key",
      );
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    try {
      await tenantApi(`/tenant/api-keys/${revokeTarget.id}/revoke`, {
        method: "PATCH",
        body: {},
      });
      toast.success(`${revokeTarget.title} revoked`);
      setRevokeTarget(null);
      list.refresh();
    } catch (error) {
      toast.error(
        error instanceof TenantApiError ? error.message : "Could not revoke the key",
      );
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
          </div>
          <code className="text-xs text-muted-foreground">
            {row.keyPrefix}.&hellip;{row.secretLast4}
          </code>
        </div>
      ),
    },
    {
      header: "Type",
      cell: (row) => (
        <Badge variant={row.keyType === "LIVE" ? "default" : "outline"}>{row.keyType}</Badge>
      ),
    },
    {
      header: "Status",
      cell: (row) => {
        if (row.status === "REVOKED") return <Badge variant="destructive">Revoked</Badge>;
        // Expiry is derived from the clock, never stored, so a key can be
        // ACTIVE and expired at once - the list has to say so.
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
        description="Credentials for applications that call this business's data. The key identifies the application, not a person — treat it like a password."
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
              Issue Key
            </Button>
          ) : undefined
        }
        renderActions={(row) => {
          const revoked = row.status === "REVOKED";
          return (
            <RowActionsMenu
              actions={[
                ...(canRotate && !revoked
                  ? [
                      {
                        label: "Rotate secret",
                        icon: RefreshCw,
                        onClick: () => setRotateTarget(row),
                      },
                    ]
                  : []),
                ...(canRevoke && !revoked
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
              <DialogTitle>Issue API Key</DialogTitle>
              <DialogDescription>
                The key is shown once, immediately after this. It is never shown again.
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
                  placeholder="Billing export"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="templateId" required>
                  What is this key for?
                </Label>
                <Select
                  value={form.templateId}
                  onValueChange={(value) => setForm((f) => ({ ...f, templateId: value }))}
                >
                  <SelectTrigger id="templateId">
                    <SelectValue
                      placeholder={templates === null ? "Loading…" : "Choose a key type"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(templates ?? []).map((template) => (
                      // Shown disabled rather than hidden: an option that
                      // quietly vanishes leaves someone wondering why a
                      // colleague can see it.
                      <SelectItem
                        key={template.id}
                        value={template.id}
                        disabled={!template.grantable}
                      >
                        {template.name}
                        {!template.grantable && " — not available to your role"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates !== null && templates.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No key types have been published yet. Ask your provider to add one.
                  </p>
                )}
                {selectedTemplate && (
                  <p className="text-xs text-muted-foreground">
                    {selectedTemplate.description ??
                      `Grants ${selectedTemplate.scopes.length} permissions.`}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Notes</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Which application uses this, and who looks after it"
                  rows={2}
                />
              </div>

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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiresOn">Expires on</Label>
                  <Input
                    id="expiresOn"
                    type="date"
                    value={form.expiresOn}
                    onChange={(e) => setForm((f) => ({ ...f, expiresOn: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Empty means it never expires.</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !selectedTemplate || !selectedTemplate.grantable}
              >
                {saving && <LoaderCircle className="size-4 animate-spin" />}
                Issue Key
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
            ? `A new key is issued for "${rotateTarget.title}" and the current one stops working immediately. Anything still using it will start failing until you update it. The new key is shown once.`
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
            ? `"${revokeTarget.title}" stops working immediately and cannot be restored. Issue a new key instead.`
            : ""
        }
        confirmLabel="Revoke"
        onConfirm={confirmRevoke}
      />
    </div>
  );
}
