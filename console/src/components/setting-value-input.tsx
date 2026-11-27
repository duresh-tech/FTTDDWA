"use client";

import * as React from "react";
import { LoaderCircle, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { uploadUrl } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SettingValueType =
  | "STRING"
  | "INTEGER"
  | "DECIMAL"
  | "BOOLEAN"
  | "JSON"
  | "ARRAY"
  | "OBJECT"
  | "DATE"
  | "DATETIME"
  | "TIME"
  | "COLOR"
  | "FILE"
  | "URL"
  | "EMAIL"
  | "PHONE";

export const SETTING_VALUE_TYPES: SettingValueType[] = [
  "STRING",
  "INTEGER",
  "DECIMAL",
  "BOOLEAN",
  "JSON",
  "ARRAY",
  "OBJECT",
  "DATE",
  "DATETIME",
  "TIME",
  "COLOR",
  "FILE",
  "URL",
  "EMAIL",
  "PHONE",
];

interface ValidationRules {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: string[];
  /** Several of these may be chosen; the value is a comma-separated subset. */
  multiEnum?: string[];
  /** FILE only: the file picker's filter, ex. ".png,.webp". The server rule is the control. */
  accept?: string;
  /** STRING only: render a textarea rather than a one-line input. */
  multiline?: boolean;
  /**
   * STRING only: the value is another resource's id, so render a picker of
   * that resource's records instead of a box to paste a UUID into. The name is
   * resolved by the server (`GET …/business-settings/options/:ref`), which owns
   * the mapping from a ref name to a table.
   */
  ref?: string;
  /**
   * STRING + `ref` only: the settingKey whose value narrows this picker. With
   * no parent chosen the picker offers nothing rather than listing every
   * record — an unfiltered list is what lets a district from one state be
   * chosen under another.
   */
  refParent?: string;
  /**
   * Hide this setting unless another one currently reads `equals`. A rendering
   * hint only: the API still accepts the value when the condition is false, so
   * whatever READS this setting has to check the condition itself.
   */
  showIf?: { key: string; equals: string };
}

/** One choice in a `ref` setting's picker, as the options endpoint returns it. */
export interface RefOption {
  id: string;
  label: string;
  labelTamil: string | null;
}

/**
 * The two scripts in one line, because a state named only in English is one
 * the operator has to translate in their head, and this app treats Tamil as a
 * rendering of the value rather than a translation of it. The Combobox
 * searches against this whole string, so either script finds the record.
 */
/**
 * A ref name as an operator would say it: `associationPositions` ->
 * "association positions". The names are camelCase because they are catalogue
 * keys, and printing one raw in an empty-state message shows the operator an
 * identifier they have never seen anywhere else in the product.
 */
function humanizeRef(refName: string): string {
  return refName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

function refOptionLabel(option: RefOption): string {
  return option.labelTamil ? `${option.label} — ${option.labelTamil}` : option.label;
}

/**
 * Reads a `showIf` hint. Exported because the DECISION belongs to the screen,
 * not to this component: a row that fails the test is dropped from the form
 * entirely, which this component cannot do from inside itself.
 */
export function settingShowIf(
  validationRules?: string | null,
): { key: string; equals: string } | null {
  return parseValidationRules(validationRules)?.showIf ?? null;
}

/**
 * The settingKey that narrows this setting's picker, or null. Exported for the
 * same reason as `settingShowIf`: the hint names a SIBLING setting, and only
 * the screen holds sibling values.
 */
export function settingRefParent(validationRules?: string | null): string | null {
  return parseValidationRules(validationRules)?.refParent ?? null;
}

function parseValidationRules(json?: string | null): ValidationRules | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as ValidationRules;
  } catch {
    return null;
  }
}

interface SettingValueInputProps {
  valueType: SettingValueType;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  validationRules?: string | null;
  /**
   * Uploads a chosen file and resolves to its stored path. Each portal has its
   * own upload endpoint, so the caller supplies this rather than the component
   * choosing. Without it a FILE setting stays a plain path box.
   */
  upload?: (file: File) => Promise<{ path: string }>;
  /**
   * Loads the choices for a `ref` setting. Supplied by the page for the same
   * reason `upload` is: the endpoint is per portal and a client cannot choose.
   * Without it a `ref` setting stays a plain text box.
   */
  loadRefOptions?: (ref: string, parentId: string) => Promise<RefOption[]>;
  /**
   * The current value of the setting named by this one's `refParent`, and a
   * human name for it. Both come from the page, which is the only place that
   * can see a sibling setting.
   */
  refParentValue?: string;
  refParentLabel?: string;
}

/**
 * Renders the right control for a setting, from its `valueType` and
 * `validationRules` alone.
 *
 * This is what makes adding a setting a catalogue change rather than a UI
 * change: an `enum` rule arrives as a dropdown, a `multiEnum` as a checkbox
 * list, a BOOLEAN as true/false, and anything unrecognised as a text box. No
 * setting is named anywhere in this file.
 */
export function SettingValueInput({
  valueType,
  value,
  onChange,
  disabled,
  validationRules,
  upload,
  loadRefOptions,
  refParentValue,
  refParentLabel,
}: SettingValueInputProps) {
  const rules = parseValidationRules(validationRules);

  switch (valueType) {
    case "JSON":
    case "ARRAY":
    case "OBJECT":
      return (
        <Textarea
          className="font-mono text-xs"
          rows={5}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "INTEGER":
      return (
        <Input
          type="number"
          step={1}
          min={rules?.min}
          max={rules?.max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "DECIMAL":
      return (
        <Input
          type="number"
          step="any"
          min={rules?.min}
          max={rules?.max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "BOOLEAN":
      return (
        <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Select a value" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">True</SelectItem>
            <SelectItem value="false">False</SelectItem>
          </SelectContent>
        </Select>
      );
    case "DATE":
      return (
        <Input
          type="date"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "DATETIME":
      return (
        <Input
          type="datetime-local"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "TIME":
      return (
        <Input
          type="time"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "COLOR":
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={/^#([0-9a-fA-F]{6})$/.test(value) ? value : "#000000"}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-12 shrink-0 rounded border"
          />
          <Input
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#RRGGBB"
          />
        </div>
      );
    case "URL":
      return (
        <Input
          type="url"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com"
        />
      );
    case "EMAIL":
      return (
        <Input
          type="email"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "PHONE":
      return (
        <Input
          type="tel"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "FILE":
      if (!upload) {
        // No uploader supplied, so the only honest control is the path itself.
        return (
          <Input
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Stored file path"
          />
        );
      }
      return (
        <FileValueInput
          value={value}
          onChange={onChange}
          disabled={disabled}
          upload={upload}
          accept={rules?.accept}
        />
      );
    case "STRING":
    default:
      // Most specific first. A `ref` setting is a STRING holding someone
      // else's id, so without this it would render as a UUID box.
      if (rules?.ref && loadRefOptions) {
        return (
          <RefValueInput
            refName={rules.ref}
            value={value}
            onChange={onChange}
            disabled={disabled}
            loadRefOptions={loadRefOptions}
            requiresParent={Boolean(rules.refParent)}
            parentId={refParentValue ?? ""}
            parentLabel={refParentLabel}
          />
        );
      }
      if (rules?.multiEnum && rules.multiEnum.length > 0) {
        const chosen = value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
        const toggle = (option: string, on: boolean) => {
          // Rebuilt from the declared order rather than the click order, so
          // the stored value does not depend on which box was ticked first.
          const next = rules.multiEnum!.filter((o) =>
            o === option ? on : chosen.includes(o),
          );
          onChange(next.join(","));
        };
        return (
          <div className="grid gap-2 rounded-lg border p-3">
            {rules.multiEnum.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm font-normal">
                <Checkbox
                  checked={chosen.includes(option)}
                  disabled={disabled}
                  onCheckedChange={(v) => toggle(option, v === true)}
                />
                {option}
              </label>
            ))}
            {chosen.length === 0 && (
              <p className="text-xs text-muted-foreground">None selected.</p>
            )}
          </div>
        );
      }
      if (rules?.enum && rules.enum.length > 0) {
        return (
          <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Select a value" />
            </SelectTrigger>
            <SelectContent>
              {rules.enum.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      if (rules?.multiline) {
        return (
          <Textarea
            rows={3}
            value={value}
            disabled={disabled}
            maxLength={rules.maxLength}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      }
      return (
        <Input
          value={value}
          disabled={disabled}
          maxLength={rules?.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

/**
 * A `ref` setting's value: a picker of another resource's records.
 *
 * Options load on first open rather than on mount, because a settings screen
 * may carry several of these and most will never be touched. `null` means "not
 * loaded yet" and shows the Combobox's spinner; `[]` means "loaded, and there
 * is nothing to choose" - a distinction worth keeping, since the second case
 * needs to tell the operator to go and create some records first.
 */
function RefValueInput({
  refName,
  value,
  onChange,
  disabled,
  loadRefOptions,
  requiresParent,
  parentId,
  parentLabel,
}: {
  refName: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  loadRefOptions: (ref: string, parentId: string) => Promise<RefOption[]>;
  requiresParent: boolean;
  parentId: string;
  parentLabel?: string;
}) {
  const [options, setOptions] = React.useState<ComboboxOption[] | null>(null);
  // Which parent the loaded options belong to. Compared rather than counted,
  // so going back to a parent already fetched still refetches - its records
  // may have changed - while a re-render with the same parent does not.
  const loadedFor = React.useRef<string | null>(null);

  const blocked = requiresParent && !parentId;

  const load = React.useCallback(() => {
    if (blocked || loadedFor.current === parentId) return;
    loadedFor.current = parentId;
    loadRefOptions(refName, parentId)
      .then((rows) =>
        setOptions(rows.map((row) => ({ value: row.id, label: refOptionLabel(row) }))),
      )
      .catch(() => {
        // Clear the marker so re-opening retries, rather than leaving a
        // permanently empty dropdown with no way to recover.
        loadedFor.current = null;
        setOptions([]);
        toast.error("Couldn't load the options for this setting");
      });
  }, [blocked, loadRefOptions, parentId, refName]);

  // When the parent changes, the loaded records belong to the OLD parent.
  // Dropping them back to null is what matters here: leaving them would keep
  // the previous state's districts on screen and selectable.
  React.useEffect(() => {
    if (loadedFor.current !== null && loadedFor.current !== parentId) {
      loadedFor.current = null;
      setOptions(null);
    }
  }, [parentId]);

  // A stored value must resolve to a label before the list is ever opened, or
  // an already-configured setting reads as "Select a record".
  React.useEffect(() => {
    if (value) load();
  }, [value, load]);

  if (blocked) {
    // The placeholder doubles as the hint, as the child picker on the streets
    // screen does. Not `disabled`, which would read as "you may not edit this".
    return (
      <Combobox
        options={[]}
        value=""
        onValueChange={onChange}
        placeholder={`Select a ${parentLabel ?? "parent"} first`}
      />
    );
  }

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      onOpenChange={(open) => {
        if (open) load();
      }}
      placeholder="Select a record…"
      searchPlaceholder="Search…"
      emptyText={`No ${humanizeRef(refName)} to choose from yet — add some first.`}
    />
  );
}

/**
 * A FILE setting's value: upload, preview, replace, remove.
 *
 * The uploader comes from the page because the upload scope is decided by the
 * endpoint the request hits - the system console posts to /system/uploads and
 * the tenant console to /tenant/uploads, and a client cannot choose. The
 * preview is a thumbnail rather than only a link: these settings are pictures,
 * and a storage path tells the operator nothing about what is set.
 *
 * Note the upload happens immediately but the VALUE is only persisted when the
 * page saves, so an abandoned pick leaves an unreferenced file behind.
 */
function FileValueInput({
  value,
  onChange,
  disabled,
  upload,
  accept,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  upload: (file: File) => Promise<{ path: string }>;
  accept?: string;
}) {
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Cleared so picking the same file twice still fires a change.
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { path } = await upload(file);
      onChange(path);
      toast.success("Image uploaded");
    } catch (error) {
      // The server names the accepted types and the size cap, so show its words.
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onFileSelected}
      />
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {value ? "Replace image" : "Upload image"}
        </Button>
        {value && !disabled && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            <X className="size-4" /> Remove
          </Button>
        )}
      </div>
      {value && (
        <div className="flex items-center gap-3">
          {/* Checkered behind the image, so a transparent logo is visible. */}
          <span className="flex size-16 shrink-0 items-center justify-center rounded border bg-[length:12px_12px] bg-[position:0_0,6px_6px] bg-[image:linear-gradient(45deg,var(--muted)_25%,transparent_25%,transparent_75%,var(--muted)_75%),linear-gradient(45deg,var(--muted)_25%,transparent_25%,transparent_75%,var(--muted)_75%)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={uploadUrl(value)} alt="" className="max-h-14 max-w-14 object-contain" />
          </span>
          <a
            href={uploadUrl(value)}
            target="_blank"
            rel="noreferrer"
            className="truncate text-xs text-muted-foreground underline"
            title={value}
          >
            {value.split("/").pop()}
          </a>
        </div>
      )}
    </div>
  );
}
