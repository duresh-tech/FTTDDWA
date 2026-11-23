"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  IdCardDesigner,
  emptyLayout,
  type IdCardField,
  type IdCardLayout,
} from "@/components/id-card-designer";
import { useTenantSession } from "@/hooks/use-tenant-session";
import { TenantApiError, tenantApi } from "@/lib/tenant-api";

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  widthMm: string;
  heightMm: string;
  isDefault: boolean;
  layout: string;
}

export default function IdCardTemplateDesignerPage() {
  const params = useParams<{ id: string }>();
  const templateId = params.id;

  const { hasPermission } = useTenantSession();
  const canView = hasPermission("tenant-id-card-templates:view");
  const canUpdate = hasPermission("tenant-id-card-templates:update");

  const [template, setTemplate] = React.useState<TemplateRow | null>(null);
  const [fields, setFields] = React.useState<IdCardField[]>([]);
  const [layout, setLayout] = React.useState<IdCardLayout | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      tenantApi<TemplateRow>(`/tenant/id-card-templates/${templateId}`),
      // The field catalogue comes from the SERVER, never a hardcoded list
      // here: the server owns which tokens exist and what each resolves to.
      tenantApi<IdCardField[]>("/tenant/id-card-templates/fields"),
    ])
      .then(([row, catalogue]) => {
        setTemplate(row);
        setFields(catalogue);
        // A row whose JSON cannot be read opens as an empty card of the right
        // size rather than a crash - the operator can then redesign it.
        try {
          setLayout(JSON.parse(row.layout) as IdCardLayout);
        } catch {
          setLayout(emptyLayout(Number(row.widthMm), Number(row.heightMm)));
          toast.error("This template's saved design could not be read; starting empty.");
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load the template"))
      .finally(() => setLoading(false));
  }, [canView, templateId]);

  // Browser-level guard only. A React-router navigation inside the console
  // will not hit this, which is why Save is prominent rather than implicit.
  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function onSave() {
    if (!layout) return;
    setSaving(true);
    try {
      // The whole layout goes in one PATCH: the canvas is the single source of
      // truth while editing, and a deep merge of positioned elements has no
      // sensible meaning.
      await tenantApi(`/tenant/id-card-templates/${templateId}`, {
        method: "PATCH",
        body: { layout },
      });
      toast.success("Design saved");
      setDirty(false);
    } catch (e) {
      toast.error(e instanceof TenantApiError ? e.message : "Could not save the design");
    } finally {
      setSaving(false);
    }
  }

  if (!canView) {
    return (
      <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
        You don&apos;t have permission to view ID card templates.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild size="sm" variant="outline">
            <Link href="/tenant/settings/id-card-templates">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{template?.name ?? "Designer"}</h1>
            <p className="text-xs text-muted-foreground">
              {template
                ? `${Number(template.widthMm)} × ${Number(template.heightMm)} mm`
                : "Loading…"}
            </p>
          </div>
        </div>
        {canUpdate && (
          <Button type="button" onClick={onSave} disabled={saving || !layout || !dirty}>
            {saving ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save design{dirty ? " •" : ""}
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" /> Loading the design…
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && layout && (
        <IdCardDesigner
          layout={layout}
          fields={fields}
          disabled={!canUpdate}
          onChange={(next) => {
            setLayout(next);
            setDirty(true);
          }}
        />
      )}
    </div>
  );
}
