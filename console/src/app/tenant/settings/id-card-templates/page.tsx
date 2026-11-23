"use client";

import * as React from "react";
import Link from "next/link";
import { CreditCard, LoaderCircle, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTenantSession } from "@/hooks/use-tenant-session";
import { TenantApiError, tenantApi } from "@/lib/tenant-api";

interface TemplateRow {
  id: string;
  systemCode: string;
  tenantBusinessId: string;
  name: string;
  description: string | null;
  widthMm: string;
  heightMm: string;
  isDefault: boolean;
  status: "ACTIVE" | "INACTIVE" | "DELETED";
}

interface BusinessOption {
  id: string;
  name: string;
}

interface ListResponse<T> {
  items: T[];
  meta: { total: number };
}

/** CR80, the standard ID card. */
const DEFAULT_SIZE = { widthMm: 85.6, heightMm: 54 };

export default function IdCardTemplatesPage() {
  const { hasPermission } = useTenantSession();
  const canList = hasPermission("tenant-id-card-templates:list");
  const canCreate = hasPermission("tenant-id-card-templates:create");
  const canUpdate = hasPermission("tenant-id-card-templates:update");
  const canDelete = hasPermission("tenant-id-card-templates:delete");

  const [rows, setRows] = React.useState<TemplateRow[] | null>(null);
  const [businesses, setBusinesses] = React.useState<BusinessOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", description: "" });
  const [saving, setSaving] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<TemplateRow | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    tenantApi<ListResponse<TemplateRow>>("/tenant/id-card-templates?limit=100")
      .then((data) => setRows(data.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load templates"))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    if (!canList) {
      setLoading(false);
      return;
    }
    load();
    tenantApi<BusinessOption[]>("/tenant/id-card-templates/businesses")
      .then(setBusinesses)
      .catch(() => setBusinesses([]));
  }, [canList, load]);

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    // A caller mapped to exactly one business needs no picker; more than one
    // and the first is still the only sensible default on this screen.
    const tenantBusinessId = businesses[0]?.id;
    if (!tenantBusinessId) {
      toast.error("No business is mapped to your account");
      return;
    }
    setSaving(true);
    try {
      const created = await tenantApi<TemplateRow>("/tenant/id-card-templates", {
        method: "POST",
        body: {
          tenantBusinessId,
          name: form.name,
          description: form.description || undefined,
          ...DEFAULT_SIZE,
        },
      });
      toast.success(`${created.name} created`);
      setCreateOpen(false);
      setForm({ name: "", description: "" });
      load();
    } catch (e) {
      toast.error(e instanceof TenantApiError ? e.message : "Could not create the template");
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault(row: TemplateRow) {
    try {
      await tenantApi(`/tenant/id-card-templates/${row.id}/default`, { method: "PATCH" });
      toast.success(`${row.name} is now the default`);
      load();
    } catch (e) {
      toast.error(e instanceof TenantApiError ? e.message : "Could not set the default");
    }
  }

  async function onDelete() {
    if (!pendingDelete) return;
    try {
      await tenantApi(`/tenant/id-card-templates/${pendingDelete.id}`, { method: "DELETE" });
      toast.success(`${pendingDelete.name} deleted`);
      setPendingDelete(null);
      load();
    } catch (e) {
      toast.error(e instanceof TenantApiError ? e.message : "Could not delete the template");
    }
  }

  if (!canList) {
    return (
      <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
        You don&apos;t have permission to view ID card templates.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ID Card Templates</h1>
          <p className="text-sm text-muted-foreground">
            Design the membership card. A template holds fields, not values — the
            member&apos;s own details are filled in when a card is generated.
          </p>
        </div>
        {canCreate && (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New template
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" /> Loading…
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && rows?.length === 0 && (
        <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
          No templates yet. Create one to start designing.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows?.map((row) => (
          <div key={row.id} className="flex flex-col rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate font-medium">
                  <CreditCard className="size-4 shrink-0 text-muted-foreground" />
                  {row.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {Number(row.widthMm)} × {Number(row.heightMm)} mm
                </p>
              </div>
              {row.isDefault && <Badge>Default</Badge>}
            </div>

            {row.description && (
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                {row.description}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/tenant/settings/id-card-templates/${row.id}`}>
                  <Pencil className="size-3.5" /> {canUpdate ? "Design" : "View"}
                </Link>
              </Button>
              {canUpdate && !row.isDefault && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => makeDefault(row)}
                >
                  <Star className="size-3.5" /> Make default
                </Button>
              )}
              {canDelete && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPendingDelete(row)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={onCreate}>
            <DialogHeader>
              <DialogTitle>New ID card template</DialogTitle>
              <DialogDescription>
                Starts as an empty {DEFAULT_SIZE.widthMm} × {DEFAULT_SIZE.heightMm} mm
                card — the standard ID card size. The first template a business creates
                becomes its default.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-1">
                <Label htmlFor="tpl-name">Name</Label>
                <Input
                  id="tpl-name"
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tpl-desc">Description</Label>
                <Input
                  id="tpl-desc"
                  maxLength={255}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !form.name}>
                {saving && <LoaderCircle className="size-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name ?? ""}?`}
        description="Cards already generated from it keep working and stay downloadable. The template stops being available for new cards."
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={onDelete}
      />
    </div>
  );
}
