"use client";

import * as React from "react";
import { Lock, LoaderCircle, Save, Unlock } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InfoPopover } from "@/components/ui/info-popover";
import { SystemBusinessPicker } from "@/components/system-business-picker";
import {
  SettingValueInput,
  settingRefParent,
  type RefOption,
  type SettingValueType,
} from "@/components/setting-value-input";
import { useSession } from "@/hooks/use-session";
import { api, ApiError, uploadFile, type ListResponse } from "@/lib/api";

/** Longer than this and the description is trimmed, with the rest behind (i). */
const SHORT_DESCRIPTION = 110;

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
  isEncrypted: boolean;
  isReadonly: boolean;
  status: SettingStatus;
}

export default function TenantBusinessSettingsSupportPage() {
  const { hasPermission } = useSession();
  const canView = hasPermission("tenant-business-settings:list");
  const canUpdate = hasPermission("tenant-business-settings:update");

  const [businessId, setBusinessId] = React.useState("");
  const [settings, setSettings] = React.useState<TenantBusinessSettingRow[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  // Keyed by row id, not settingKey: this screen saves one row at a time.
  const [dirty, setDirty] = React.useState<Record<string, string>>({});
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [lockingId, setLockingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!businessId) {
      setSettings(null);
      return;
    }
    setLoading(true);
    setDirty({});
    api<ListResponse<TenantBusinessSettingRow>>(
      `/system/tenant-business-settings?tenantBusinessId=${businessId}&limit=200`,
    )
      .then((data) => setSettings(data.items))
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, [businessId]);

  async function saveRow(row: TenantBusinessSettingRow) {
    const nextValue = dirty[row.id];
    if (nextValue === undefined) return;
    setSavingId(row.id);
    try {
      const updated = await api<TenantBusinessSettingRow>(
        `/system/tenant-business-settings/${row.id}`,
        { method: "PATCH", body: { settingValue: nextValue } },
      );
      // The server's row replaces the local one, rather than assuming the
      // submitted value is what was stored.
      setSettings((rows) => rows?.map((r) => (r.id === row.id ? updated : r)) ?? null);
      setDirty((d) => {
        const next = { ...d };
        delete next[row.id];
        return next;
      });
      toast.success(`${row.settingLabel} updated`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Update failed");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleReadonly(row: TenantBusinessSettingRow) {
    setLockingId(row.id);
    try {
      const updated = await api<TenantBusinessSettingRow>(
        `/system/tenant-business-settings/${row.id}`,
        { method: "PATCH", body: { isReadonly: !row.isReadonly } },
      );
      setSettings((rows) => rows?.map((r) => (r.id === row.id ? updated : r)) ?? null);
      toast.success(
        updated.isReadonly
          ? `${row.settingLabel} locked for this tenant`
          : `${row.settingLabel} unlocked for this tenant`,
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Update failed");
    } finally {
      setLockingId(null);
    }
  }

  const loadRefOptions = React.useCallback(
    (ref: string, parentId: string) =>
      api<RefOption[]>(
        `/system/tenant-business-settings/options/${encodeURIComponent(ref)}` +
          `?tenantBusinessId=${encodeURIComponent(businessId)}` +
          (parentId ? `&parentId=${encodeURIComponent(parentId)}` : ""),
      ),
    [businessId],
  );

  /**
   * A `ref` picker here is narrowed by its parent too, so it needs the parent's
   * value by settingKey - and `dirty` on this screen is keyed by ROW ID,
   * because it saves one row at a time. Hence a second map.
   *
   * It deliberately stops at narrowing. This screen does NOT cascade-clear a
   * child when its parent changes: with a save button per row, queueing an
   * edit to a row the operator never touched would be a surprise write. The
   * values stay as stored, which is also what makes a mismatched pair visible
   * here - the thing a support screen is for.
   */
  const refContext = React.useMemo(() => {
    const parentOf: Record<string, string> = {};
    const label: Record<string, string> = {};
    const effective: Record<string, string> = {};
    for (const row of settings ?? []) {
      const parent = settingRefParent(row.validationRules);
      if (parent) parentOf[row.settingKey] = parent;
      label[row.settingKey] = row.settingLabel;
      effective[row.settingKey] = dirty[row.id] ?? row.settingValue ?? "";
    }
    return { parentOf, label, effective };
  }, [settings, dirty]);

  /**
   * Every row, in sortOrder, grouped by category.
   *
   * This screen deliberately applies NEITHER of the filters the tenant screen
   * applies - not `isVisible`, and not `showIf`. It is the support view: an
   * operator looking into a tenant's configuration needs to see a value that
   * is stored while its condition is false, because that contradiction is
   * exactly the kind of thing they are here to find.
   */
  const grouped = React.useMemo(() => {
    if (!settings) return [];
    const map = new Map<string, TenantBusinessSettingRow[]>();
    for (const row of settings) {
      const list = map.get(row.category) ?? [];
      list.push(row);
      map.set(row.category, list);
    }
    return [...map.entries()];
  }, [settings]);

  if (!canView) {
    return (
      <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
        You don&apos;t have permission to view tenant business settings.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tenant Business Settings</h1>
        <p className="text-sm text-muted-foreground">
          Cross-tenant view for support — pick a business to view or edit its settings,
          including hidden and read-only ones. The lock icon grants or revokes{" "}
          <em>this one</em> tenant&apos;s edit access to <em>this one</em> setting,
          independent of every other tenant.
        </p>
      </div>

      <div className="max-w-md">
        <Label>Business</Label>
        <SystemBusinessPicker
          value={businessId}
          onChange={setBusinessId}
          className="w-full"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" /> Loading settings...
        </div>
      )}

      {!loading && businessId && settings && settings.length === 0 && (
        <p className="text-sm text-muted-foreground">
          This business has no settings yet — it may predate a definition. Run a sync
          from the Setting Definitions page to backfill it.
        </p>
      )}

      {!loading &&
        grouped.map(([category, rows]) => (
          <div key={category} className="rounded-lg border">
            <div className="border-b bg-muted/40 px-4 py-2 text-sm font-medium">
              {category}
            </div>
            <div className="divide-y">
              {rows.map((row) => {
                const currentValue = dirty[row.id] ?? row.settingValue ?? "";
                const isDirty =
                  dirty[row.id] !== undefined && dirty[row.id] !== (row.settingValue ?? "");
                return (
                  <div
                    key={row.id}
                    className="grid gap-2 p-4 sm:grid-cols-3 sm:items-start sm:gap-4"
                  >
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        {row.settingLabel}
                        {/* Long explanations go behind the (i); the paragraph
                            below carries the essential one. */}
                        {row.description && row.description.length > SHORT_DESCRIPTION && (
                          <InfoPopover label={`More about ${row.settingLabel}`}>
                            {row.description}
                          </InfoPopover>
                        )}
                      </p>
                      <code className="text-xs text-muted-foreground">{row.settingKey}</code>
                      {row.description && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.description.length > SHORT_DESCRIPTION
                            ? `${row.description.slice(0, SHORT_DESCRIPTION).trimEnd()}…`
                            : row.description}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {row.isEncrypted && <Badge variant="secondary">Encrypted</Badge>}
                        {row.isReadonly && (
                          <Badge variant="secondary">Readonly (tenant-locked)</Badge>
                        )}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <SettingValueInput
                            valueType={row.valueType}
                            value={
                              row.isEncrypted && dirty[row.id] === undefined
                                ? ""
                                : currentValue
                            }
                            onChange={(v) => setDirty((d) => ({ ...d, [row.id]: v }))}
                            disabled={!canUpdate}
                            validationRules={row.validationRules}
                            upload={canUpdate ? (file) => uploadFile(file) : undefined}
                            loadRefOptions={loadRefOptions}
                            refParentValue={
                              refContext.effective[
                                refContext.parentOf[row.settingKey] ?? ""
                              ] ?? ""
                            }
                            refParentLabel={
                              refContext.label[refContext.parentOf[row.settingKey] ?? ""]
                            }
                          />
                          {row.isEncrypted && dirty[row.id] === undefined && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Value hidden - leave blank to keep unchanged, or type a new
                              value to replace it.
                            </p>
                          )}
                        </div>
                        {canUpdate && (
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            disabled={lockingId === row.id}
                            onClick={() => toggleReadonly(row)}
                            aria-label={
                              row.isReadonly
                                ? `Unlock ${row.settingLabel} for this tenant`
                                : `Lock ${row.settingLabel} for this tenant`
                            }
                            title={
                              row.isReadonly
                                ? "Tenant cannot edit this - click to unlock"
                                : "Tenant can edit this - click to lock"
                            }
                          >
                            {lockingId === row.id ? (
                              <LoaderCircle className="size-4 animate-spin" />
                            ) : row.isReadonly ? (
                              <Lock className="size-4" />
                            ) : (
                              <Unlock className="size-4" />
                            )}
                          </Button>
                        )}
                        {canUpdate && (
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            disabled={!isDirty || savingId === row.id}
                            onClick={() => saveRow(row)}
                            aria-label={`Save ${row.settingLabel}`}
                          >
                            {savingId === row.id ? (
                              <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                              <Save className="size-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
