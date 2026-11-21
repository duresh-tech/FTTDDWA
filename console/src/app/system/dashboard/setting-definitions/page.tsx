"use client";

import * as React from "react";
import { Lock, LoaderCircle, Pencil, Plus, RefreshCw, Unlock } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { SettingValueInput, SETTING_VALUE_TYPES, type SettingValueType } from "@/components/setting-value-input";
import { useResourceList } from "@/hooks/use-resource-list";
import { useSession } from "@/hooks/use-session";
import { api, ApiError } from "@/lib/api";

type DefinitionStatus = "ACTIVE" | "INACTIVE";

interface SettingDefinitionRow {
  id: string;
  category: string;
  subCategory: string | null;
  settingKey: string;
  settingLabel: string;
  description: string | null;
  valueType: SettingValueType;
  defaultValue: string | null;
  validationRules: string | null;
  isRequired: boolean;
  isEncrypted: boolean;
  isReadonly: boolean;
  isVisible: boolean;
  autoSyncToExistingTenants: boolean;
  sortOrder: number;
  status: DefinitionStatus;
}

interface FormValues {
  category: string;
  subCategory: string;
  settingKey: string;
  settingLabel: string;
  description: string;
  valueType: SettingValueType;
  defaultValue: string;
  validationRules: string;
  isRequired: boolean;
  isEncrypted: boolean;
  isReadonly: boolean;
  isVisible: boolean;
  autoSyncToExistingTenants: boolean;
  sortOrder: string;
  status: DefinitionStatus;
}

const EMPTY_FORM: FormValues = {
  category: "",
  subCategory: "",
  settingKey: "",
  settingLabel: "",
  description: "",
  valueType: "STRING",
  defaultValue: "",
  validationRules: "",
  isRequired: false,
  isEncrypted: false,
  isReadonly: false,
  isVisible: true,
  autoSyncToExistingTenants: false,
  sortOrder: "0",
  status: "ACTIVE",
};

export default function SettingDefinitionsPage() {
  const { hasPermission } = useSession();
  const canCreate = hasPermission("setting-definitions:create");
  const canUpdate = hasPermission("setting-definitions:update");
  const canSync = hasPermission("settings-sync:run");

  const [statusFilter, setStatusFilter] = React.useState<string>("");

  const list = useResourceList<SettingDefinitionRow>("/system/setting-definitions", {
    status: statusFilter || undefined,
  });

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SettingDefinitionRow | null>(null);
  const [form, setForm] = React.useState<FormValues>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [lockingId, setLockingId] = React.useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(row: SettingDefinitionRow) {
    setEditing(row);
    setForm({
      category: row.category,
      subCategory: row.subCategory ?? "",
      settingKey: row.settingKey,
      settingLabel: row.settingLabel,
      description: row.description ?? "",
      valueType: row.valueType,
      defaultValue: row.defaultValue ?? "",
      validationRules: row.validationRules ?? "",
      isRequired: row.isRequired,
      isEncrypted: row.isEncrypted,
      isReadonly: row.isReadonly,
      isVisible: row.isVisible,
      autoSyncToExistingTenants: row.autoSyncToExistingTenants,
      sortOrder: String(row.sortOrder),
      status: row.status,
    });
    setFormOpen(true);
  }

  /**
   * Flips `isReadonly` on the definition, i.e. whether tenants may edit the
   * setting at all.
   *
   * This is the DEFAULT applied to businesses created from here on. It does
   * not reach back into businesses that already hold a copy - their per-row
   * lock is toggled from the Business Settings screen, which is deliberate:
   * a tenant granted an exception should not silently lose it because the
   * catalog changed.
   */
  async function toggleReadonly(row: SettingDefinitionRow) {
    setLockingId(row.id);
    try {
      await api(`/system/setting-definitions/${row.id}`, {
        method: "PATCH",
        body: { isReadonly: !row.isReadonly },
      });
      toast.success(
        row.isReadonly
          ? `${row.settingLabel} unlocked for new businesses`
          : `${row.settingLabel} locked for new businesses`,
      );
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Update failed");
    } finally {
      setLockingId(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const base = {
        category: form.category,
        subCategory: form.subCategory || undefined,
        settingLabel: form.settingLabel,
        description: form.description || undefined,
        defaultValue: form.defaultValue || undefined,
        validationRules: form.validationRules || undefined,
        isRequired: form.isRequired,
        isEncrypted: form.isEncrypted,
        isReadonly: form.isReadonly,
        isVisible: form.isVisible,
        autoSyncToExistingTenants: form.autoSyncToExistingTenants,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editing) {
        await api(`/system/setting-definitions/${editing.id}`, {
          method: "PATCH",
          body: { ...base, status: form.status },
        });
        toast.success("Setting definition updated");
      } else {
        await api("/system/setting-definitions", {
          method: "POST",
          body: { ...base, settingKey: form.settingKey, valueType: form.valueType },
        });
        toast.success("Setting definition created");
      }
      setFormOpen(false);
      list.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onSyncAll() {
    setSyncing(true);
    try {
      const result = await api<{ inserted: number; skipped: number; failed: number; businessesProcessed: number }>(
        "/system/settings-sync",
        { method: "POST", body: { mode: "ALL", dryRun: false } },
      );
      toast.success(
        `Synced ${result.businessesProcessed} business(es): ${result.inserted} inserted, ${result.skipped} already present`,
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const columns: Column<SettingDefinitionRow>[] = [
    {
      header: "Key",
      cell: (row) => (
        <div>
          <code className="text-xs">{row.settingKey}</code>
          <p className="text-xs text-muted-foreground">{row.settingLabel}</p>
        </div>
      ),
    },
    { header: "Category", cell: (row) => <Badge variant="outline">{row.category}</Badge> },
    { header: "Type", cell: (row) => <Badge variant="secondary">{row.valueType}</Badge> },
    {
      header: "Default",
      cell: (row) => (
        <span className="block max-w-40 truncate font-mono text-xs" title={row.defaultValue ?? ""}>
          {row.isEncrypted ? "••••••" : (row.defaultValue ?? "—")}
        </span>
      ),
    },
    {
      header: "Flags",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.isRequired && <Badge variant="outline">Required</Badge>}
          {row.isEncrypted && <Badge variant="outline">Encrypted</Badge>}
          {row.isReadonly && (
            <Badge variant="outline" className="gap-1">
              <Lock className="size-3" />
              Locked
            </Badge>
          )}
        </div>
      ),
    },
    { header: "Status", cell: (row) => <StatusBadgeText status={row.status} /> },
  ];

  return (
    <>
      <ResourceTable<SettingDefinitionRow>
        title="Setting Definitions"
        description="The catalogue of settings copied to every new tenant business. The shipped ones are declared in src/common/constants/setting-definitions.ts and applied by the seed; anything added here is additional."
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
          <>
            <Select
              value={statusFilter || "ALL"}
              onValueChange={(v) => {
                setStatusFilter(v === "ALL" ? "" : v);
                list.setPage(1);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {canSync && (
              <Button type="button" variant="outline" disabled={syncing} onClick={onSyncAll}>
                {syncing ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Sync to all tenants
              </Button>
            )}
            {canCreate && (
              <Button onClick={openCreate}>
                <Plus className="size-4" /> Add Definition
              </Button>
            )}
          </>
        }
        renderActions={
          canUpdate
            ? (row) => (
                <RowActionsMenu
                  actions={[
                    { label: "Edit", icon: Pencil, onClick: () => openEdit(row) },
                    {
                      label: row.isReadonly ? "Unlock for tenants" : "Lock for tenants",
                      icon: row.isReadonly ? Unlock : Lock,
                      onClick: () => toggleReadonly(row),
                      loading: lockingId === row.id,
                      disabled: lockingId === row.id,
                    },
                  ]}
                />
              )
            : undefined
        }
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Setting Definition" : "Add Setting Definition"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "settingKey and valueType are locked after creation: businesses hold copies keyed by the one and validated against the other."
                  : "settingKey must be unique (e.g. customer.codePrefix)."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label required>Category</Label>
                  <Input
                    required
                    maxLength={50}
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Sub-category</Label>
                  <Input
                    maxLength={50}
                    value={form.subCategory}
                    onChange={(e) => setForm((f) => ({ ...f, subCategory: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label required>Setting Key</Label>
                  <Input
                    required
                    disabled={!!editing}
                    maxLength={150}
                    placeholder="customer.codePrefix"
                    value={form.settingKey}
                    onChange={(e) => setForm((f) => ({ ...f, settingKey: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label required>Label</Label>
                  <Input
                    required
                    maxLength={150}
                    value={form.settingLabel}
                    onChange={(e) => setForm((f) => ({ ...f, settingLabel: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label required>Value Type</Label>
                  <Select
                    value={form.valueType}
                    onValueChange={(v) => setForm((f) => ({ ...f, valueType: v as SettingValueType, defaultValue: "" }))}
                    disabled={!!editing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SETTING_VALUE_TYPES.map((vt) => (
                        <SelectItem key={vt} value={vt}>
                          {vt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Sort Order</Label>
                  <Input
                    type="number"
                    step={1}
                    value={form.sortOrder}
                    onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Default Value</Label>
                <SettingValueInput
                  valueType={form.valueType}
                  value={form.defaultValue}
                  onChange={(v) => setForm((f) => ({ ...f, defaultValue: v }))}
                  validationRules={form.validationRules}
                />
              </div>

              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea
                  maxLength={255}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label>Validation Rules (JSON)</Label>
                <Textarea
                  className="font-mono text-xs"
                  rows={2}
                  placeholder='{"min":0,"max":100,"maxLength":50,"enum":["A","B"]}'
                  value={form.validationRules}
                  onChange={(e) => setForm((f) => ({ ...f, validationRules: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(
                  [
                    ["isRequired", "Required"],
                    ["isEncrypted", "Encrypted"],
                    ["isReadonly", "Readonly by default"],
                    ["isVisible", "Visible to tenants"],
                    ["autoSyncToExistingTenants", "Auto-sync to existing tenants"],
                  ] as [keyof FormValues, string][]
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={key}
                      checked={form[key] as boolean}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, [key]: v === true }))}
                    />
                    <Label htmlFor={key} className="font-normal">
                      {label}
                    </Label>
                  </div>
                ))}
              </div>

              {editing && (
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((f) => ({ ...f, status: v as DefinitionStatus }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !form.category || !form.settingKey || !form.settingLabel}>
                {saving && <LoaderCircle className="size-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
