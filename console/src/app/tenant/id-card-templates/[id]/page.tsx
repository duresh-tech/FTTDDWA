"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { IdCardDesigner } from "@/components/id-card/designer";
import {
  emptyLayout,
  type IdCardField,
  type IdCardLayout,
  type IdCardShape,
} from "@/components/id-card/types";
import { TenantSessionProvider, useTenantSession } from "@/hooks/use-tenant-session";
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

/**
 * The full-screen designer.
 *
 * It provides its own TenantSessionProvider because it sits outside
 * TenantShell - which is what gives it the whole viewport - and the session
 * hook is what the permission checks read.
 */
export default function IdCardTemplateEditorPage() {
  return (
    <TenantSessionProvider>
      <Editor />
    </TenantSessionProvider>
  );
}

function Editor() {
  const params = useParams<{ id: string }>();
  const templateId = params.id;

  const { hasPermission, loading: sessionLoading } = useTenantSession();
  const canView = hasPermission("tenant-id-card-templates:view");
  const canUpdate = hasPermission("tenant-id-card-templates:update");

  const [template, setTemplate] = React.useState<TemplateRow | null>(null);
  const [fields, setFields] = React.useState<IdCardField[]>([]);
  const [shapes, setShapes] = React.useState<IdCardShape[]>([]);
  const [layout, setLayout] = React.useState<IdCardLayout | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (sessionLoading) return;
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      tenantApi<TemplateRow>(`/tenant/id-card-templates/${templateId}`),
      // Both catalogues come from the SERVER, never a hardcoded list here:
      // it owns which tokens exist and what each shape's geometry is.
      tenantApi<IdCardField[]>("/tenant/id-card-templates/fields"),
      tenantApi<IdCardShape[]>("/tenant/id-card-templates/shapes"),
    ])
      .then(([row, fieldList, shapeList]) => {
        setTemplate(row);
        setFields(fieldList);
        setShapes(shapeList);
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
  }, [canView, sessionLoading, templateId]);

  // Browser-level guard only; an in-app navigation will not hit it, which is
  // why Save is prominent rather than implicit.
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
      // Width and height go with the layout. The service reconciles the two
      // with the COLUMNS winning, so sending only the layout would silently
      // keep the old card size.
      await tenantApi(`/tenant/id-card-templates/${templateId}`, {
        method: "PATCH",
        body: {
          layout,
          widthMm: layout.card.widthMm,
          heightMm: layout.card.heightMm,
        },
      });
      toast.success("Design saved");
      setDirty(false);
    } catch (e) {
      toast.error(e instanceof TenantApiError ? e.message : "Could not save the design");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b px-3 py-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/tenant/settings/id-card-templates">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">
            {template?.name ?? "ID card designer"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {template ? `${Number(template.widthMm)} × ${Number(template.heightMm)} mm saved` : "Loading…"}
          </p>
        </div>
        {canUpdate && (
          <Button
            type="button"
            size="sm"
            className="ml-auto"
            onClick={onSave}
            disabled={saving || !layout || !dirty}
          >
            {saving ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save{dirty ? " •" : ""}
          </Button>
        )}
      </header>

      {(loading || sessionLoading) && (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" /> Loading the design…
        </div>
      )}

      {!sessionLoading && !canView && (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          You don&apos;t have permission to view ID card templates.
        </div>
      )}

      {error && (
        <div className="flex flex-1 items-center justify-center text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && layout && (
        <IdCardDesigner
          layout={layout}
          fields={fields}
          shapes={shapes}
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
