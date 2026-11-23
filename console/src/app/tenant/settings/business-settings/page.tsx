"use client";

import * as React from "react";
import { Lock, LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  SettingValueInput,
  settingShowIf,
  type RefOption,
  type SettingValueType,
} from "@/components/setting-value-input";
import { useTenantSession } from "@/hooks/use-tenant-session";
import { TenantApiError, tenantApi, uploadTenantFile } from "@/lib/tenant-api";

type SettingStatus = "ACTIVE" | "INACTIVE" | "DELETED";

interface TenantBusinessSettingRow {
  id: string;
  category: string;
  subCategory: string | null;
  settingKey: string;
  settingLabel: string;
  description: string | null;
  valueType: SettingValueType;
  settingValue: string | null;
  validationRules: string | null;
  /**
   * A setting the app still reads but the business does not manage here. The
   * API deliberately keeps serving these - only this screen leaves them out.
   */
  isVisible: boolean;
  isEncrypted: boolean;
  isReadonly: boolean;
  status: SettingStatus;
}

/**
 * A stored value as it should read in the confirmation.
 *
 * An encrypted setting is never shown: the row comes back masked, so the old
 * value is unknowable here anyway, and printing the NEW one would put a live
 * credential on screen in the one place the user is looking away from the
 * field.
 */
function displayValue(
  row: TenantBusinessSettingRow,
  value: string | null,
): React.ReactNode {
  if (row.isEncrypted) return <span className="text-muted-foreground">••••••</span>;
  if (value == null || value === "") {
    return <span className="text-muted-foreground">not set</span>;
  }
  if (row.valueType === "BOOLEAN") return value === "true" ? "On" : "Off";
  // A storage path is unreadable in a diff; the file name identifies it.
  if (row.valueType === "FILE") return value.split("/").pop();
  return value;
}

export default function TenantBusinessSettingsPage() {
  const { hasPermission } = useTenantSession();
  const canView = hasPermission("tenant-business-settings:view");
  const canUpdate = hasPermission("tenant-business-settings:update");

  const [settings, setSettings] = React.useState<TenantBusinessSettingRow[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    tenantApi<TenantBusinessSettingRow[]>("/tenant/business-settings")
      .then(setSettings)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    if (canView) load();
    else setLoading(false);
  }, [canView, load]);

  /**
   * What each setting currently reads: the pending edit if there is one, else
   * the stored value. `showIf` is evaluated against this rather than against
   * the stored values alone, so ticking a flag reveals its dependent field
   * immediately instead of after a save.
   */
  const effective = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of settings ?? []) {
      map[row.settingKey] = dirty[row.settingKey] ?? row.settingValue ?? "";
    }
    return map;
  }, [settings, dirty]);

  const isShown = React.useCallback(
    (row: TenantBusinessSettingRow) => {
      const condition = settingShowIf(row.validationRules);
      return !condition || effective[condition.key] === condition.equals;
    },
    [effective],
  );

  /**
   * Drop a pending edit on a row that has since been hidden. Without this the
   * save would carry a value the user can no longer see, and the confirmation
   * dialog would list a setting that is not on the form.
   */
  React.useEffect(() => {
    if (!settings) return;
    const orphaned = settings.filter(
      (row) => dirty[row.settingKey] !== undefined && !isShown(row),
    );
    if (orphaned.length === 0) return;
    setDirty((d) => {
      const next = { ...d };
      for (const row of orphaned) delete next[row.settingKey];
      return next;
    });
  }, [settings, dirty, isShown]);

  const loadRefOptions = React.useCallback(
    (ref: string) =>
      tenantApi<RefOption[]>(`/tenant/business-settings/options/${encodeURIComponent(ref)}`),
    [],
  );

  /**
   * Categories come from the data, not an enum, so a setting in a new category
   * groups itself with no change here. Insertion order is the API's sortOrder.
   */
  const grouped = React.useMemo(() => {
    if (!settings) return [];
    const map = new Map<string, TenantBusinessSettingRow[]>();
    for (const row of settings) {
      // Hidden settings are still served and still read by the app - they are
      // just not managed from this screen.
      if (row.isVisible === false) continue;
      // A `showIf` row waits for its condition. The API still accepts it, so
      // this hides the field rather than disabling the setting.
      if (!isShown(row)) continue;
      const list = map.get(row.category) ?? [];
      list.push(row);
      map.set(row.category, list);
    }
    return [...map.entries()];
  }, [settings, isShown]);

  const dirtyCount = Object.keys(dirty).length;

  /**
   * What is about to change, in the order the screen shows it. Built from the
   * loaded rows rather than from `dirty` alone, so the confirmation names each
   * setting the way the form labels it rather than by its key.
   */
  const pendingChanges = React.useMemo(() => {
    if (!settings) return [];
    return settings
      .filter((row) => dirty[row.settingKey] !== undefined)
      .map((row) => ({ row, from: row.settingValue, to: dirty[row.settingKey] }));
  }, [settings, dirty]);

  async function onSaveAll() {
    if (!settings || dirtyCount === 0) return;
    setConfirmOpen(false);
    setSaving(true);
    try {
      const updates = Object.entries(dirty).map(([settingKey, settingValue]) => ({
        settingKey,
        settingValue,
      }));
      await tenantApi("/tenant/business-settings", { method: "PATCH", body: { updates } });
      toast.success("Settings updated");
      setDirty({});
      // Refetched rather than patched locally: the server is what applied the
      // batch, and a rejected one leaves nothing changed.
      load();
    } catch (e) {
      toast.error(e instanceof TenantApiError ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (!canView) {
    return (
      <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
        You don&apos;t have permission to view business settings.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Business Settings</h1>
          <p className="text-sm text-muted-foreground">
            Settings for your business. Locked settings are managed by the platform and
            cannot be edited here.
          </p>
        </div>
        {canUpdate && (
          <Button
            type="button"
            disabled={dirtyCount === 0 || saving}
            onClick={() => setConfirmOpen(true)}
          >
            {saving ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save Changes{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" /> Loading settings...
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && grouped.length === 0 && (
        <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
          No settings configured for this business yet.
        </div>
      )}

      {!loading &&
        grouped.map(([category, rows]) => (
          <div key={category} className="rounded-lg border">
            <div className="border-b bg-muted/40 px-4 py-2 text-sm font-medium">
              {category}
            </div>
            <div className="divide-y">
              {rows.map((row) => {
                const currentValue = dirty[row.settingKey] ?? row.settingValue ?? "";
                const locked = row.isReadonly || !canUpdate;
                return (
                  <div
                    key={row.id}
                    className="grid gap-2 p-4 sm:grid-cols-3 sm:items-start sm:gap-4"
                  >
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        {row.settingLabel}
                        {row.isReadonly && (
                          <Lock className="size-3.5 text-muted-foreground" />
                        )}
                      </p>
                      {row.description && (
                        <p className="text-xs text-muted-foreground">{row.description}</p>
                      )}
                      {row.isEncrypted && (
                        <Badge variant="secondary" className="mt-1">
                          Encrypted
                        </Badge>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <SettingValueInput
                        valueType={row.valueType}
                        value={
                          // An encrypted value reads back masked, so the field
                          // starts blank rather than showing the mask as if it
                          // were the value.
                          row.isEncrypted && dirty[row.settingKey] === undefined
                            ? ""
                            : currentValue
                        }
                        onChange={(v) => setDirty((d) => ({ ...d, [row.settingKey]: v }))}
                        disabled={locked}
                        validationRules={row.validationRules}
                        upload={locked ? undefined : (file) => uploadTenantFile(file)}
                        loadRefOptions={loadRefOptions}
                      />
                      {row.isEncrypted && dirty[row.settingKey] === undefined && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Value hidden - leave blank to keep unchanged, or type a new
                          value to replace it.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Save ${dirtyCount} setting${dirtyCount === 1 ? "" : "s"}?`}
        description="These take effect immediately for everyone in this business."
        confirmLabel="Save changes"
        confirmVariant="default"
        loading={saving}
        onConfirm={onSaveAll}
      >
        <div className="max-h-80 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-2 font-medium">Setting</th>
                <th className="p-2 font-medium">From</th>
                <th className="p-2 font-medium">To</th>
              </tr>
            </thead>
            <tbody>
              {pendingChanges.map(({ row, from, to }) => (
                <tr key={row.settingKey} className="border-b align-top last:border-0">
                  <td className="p-2">
                    <div>{row.settingLabel}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {row.settingKey}
                    </div>
                  </td>
                  <td className="p-2 text-muted-foreground line-through decoration-muted-foreground/50">
                    {displayValue(row, from)}
                  </td>
                  <td className="p-2 font-medium">{displayValue(row, to)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pendingChanges.some((c) => c.row.isEncrypted) && (
          <p className="text-xs text-muted-foreground">
            A secret is shown as dots — its value is never displayed, here or anywhere
            else.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
