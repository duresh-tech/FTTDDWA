"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ScopeOption {
  permissionKey: string;
  moduleName: string;
  displayName: string;
}

export interface ScopeTemplateOption {
  id: string;
  name: string;
  description?: string | null;
  scopes: string[];
  /** False when the caller does not hold every scope in it. */
  grantable?: boolean;
  missingScopes?: string[];
}

/** "tenant-places:create" -> "tenant-places". */
function moduleOf(option: ScopeOption): string {
  return option.moduleName || option.permissionKey.split(":")[0];
}

/**
 * The scope checkbox list, grouped by module and searchable.
 *
 * `options` is the set the caller may actually grant. On the key form that is
 * the operator's **own** permissions, not the whole catalogue: a key can only
 * ever be a subset of its issuer (the server enforces it), so offering the
 * rest would just be a list of things that fail on save.
 *
 * Template buttons REPLACE the selection rather than adding to it, and report
 * what they could not grant - silently dropping scopes would hand out a key
 * that looks like the template but is not.
 */
export function ApiKeyScopePicker({
  options,
  templates,
  value,
  onChange,
  emptyHint,
}: {
  options: ScopeOption[] | null;
  templates?: ScopeTemplateOption[] | null;
  value: string[];
  onChange: (scopes: string[]) => void;
  emptyHint?: string;
}) {
  const [filter, setFilter] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);
  const selected = React.useMemo(() => new Set(value), [value]);

  const groups = React.useMemo(() => {
    if (!options) return null;
    const needle = filter.trim().toLowerCase();
    const matched = needle
      ? options.filter(
          (o) =>
            o.permissionKey.toLowerCase().includes(needle) ||
            o.displayName.toLowerCase().includes(needle),
        )
      : options;

    const byModule = new Map<string, ScopeOption[]>();
    for (const option of matched) {
      const key = moduleOf(option);
      const bucket = byModule.get(key);
      if (bucket) bucket.push(option);
      else byModule.set(key, [option]);
    }
    return [...byModule.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [options, filter]);

  function toggle(permissionKey: string, checked: boolean) {
    onChange(
      checked
        ? [...value, permissionKey]
        : value.filter((scope) => scope !== permissionKey),
    );
  }

  function applyTemplate(template: ScopeTemplateOption) {
    const grantable = new Set(options?.map((o) => o.permissionKey) ?? []);
    const kept = template.scopes.filter((scope) => grantable.has(scope));
    const skipped = template.scopes.length - kept.length;
    onChange(kept);
    setFilter("");
    if (skipped > 0) {
      // Stated, not silent: a template that quietly dropped scopes would hand
      // out a key that looks like the template but is not.
      setNotice(
        `${template.name}: ${kept.length} applied, ${skipped} skipped — you do not hold ${skipped === 1 ? "that scope" : "those scopes"}.`,
      );
    } else {
      setNotice(`${template.name}: ${kept.length} scopes applied.`);
    }
  }

  if (options === null) {
    return <p className="text-sm text-muted-foreground">Loading scopes…</p>;
  }

  return (
    <div className="grid gap-3">
      {templates && templates.length > 0 && (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">
            Start from a template, then adjust:
          </p>
          <div className="flex flex-wrap gap-2">
            {templates.map((template) => (
              <Button
                key={template.id}
                type="button"
                variant="outline"
                size="sm"
                title={template.description ?? undefined}
                onClick={() => applyTemplate(template)}
              >
                {template.name}
                <Badge variant="secondary">{template.scopes.length}</Badge>
              </Button>
            ))}
          </div>
        </div>
      )}

      {notice && <p className="text-xs text-muted-foreground">{notice}</p>}

      <div className="relative">
        <Search className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter scopes"
          className="pl-8"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {value.length} selected
          {value.length === 0 && emptyHint ? ` — ${emptyHint}` : ""}
        </span>
        {value.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
            Clear
          </Button>
        )}
      </div>

      <div className="max-h-72 overflow-y-auto rounded-md border p-3">
        {groups === null || groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scope matches that filter.</p>
        ) : (
          <div className="grid gap-4">
            {groups.map(([module, items]) => (
              <div key={module} className="grid gap-2">
                <p className="text-xs font-semibold tracking-wide uppercase">{module}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map((option) => (
                    <div key={option.permissionKey} className="flex items-start gap-2">
                      <Checkbox
                        id={`scope-${option.permissionKey}`}
                        checked={selected.has(option.permissionKey)}
                        onCheckedChange={(checked) =>
                          toggle(option.permissionKey, checked === true)
                        }
                      />
                      <Label
                        htmlFor={`scope-${option.permissionKey}`}
                        className="text-xs font-normal leading-tight"
                      >
                        {option.displayName}
                        <code className="block text-[10px] text-muted-foreground">
                          {option.permissionKey}
                        </code>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
