"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clamp, fillToCss, isGradient, type Fill } from "./types";

/**
 * Solid colour, linear gradient or radial gradient.
 *
 * The three modes write the same `Fill` field, and switching between them
 * keeps whatever colours were already chosen rather than resetting to black -
 * changing your mind about the mode should not cost you the palette.
 */
export function FillEditor({
  label,
  value,
  onChange,
  allowNone = false,
  disabled,
}: {
  label: string;
  value: Fill | null;
  onChange: (fill: Fill | null) => void;
  allowNone?: boolean;
  disabled?: boolean;
}) {
  const mode = value === null ? "none" : isGradient(value) ? value.type : "solid";

  /** The colours currently in play, so a mode switch can reuse them. */
  const colors = React.useMemo(() => {
    if (isGradient(value)) return value.stops.map((stop) => stop.color);
    if (typeof value === "string") return [value, "#ffffff"];
    return ["#1e3a8a", "#ffffff"];
  }, [value]);

  function setMode(next: string) {
    if (next === "none") return onChange(null);
    if (next === "solid") return onChange(colors[0]);
    onChange({
      type: next as "linear" | "radial",
      angle: isGradient(value) ? value.angle : 0,
      stops: [
        { offset: 0, color: colors[0] },
        { offset: 1, color: colors[1] ?? "#ffffff" },
      ],
    });
  }

  function patchGradient(patch: Partial<Exclude<Fill, string>>) {
    if (!isGradient(value)) return;
    onChange({ ...value, ...patch });
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>

      <div className="flex items-center gap-2">
        <span
          className="size-9 shrink-0 rounded border"
          style={{ background: fillToCss(value) }}
          aria-hidden
        />
        <Select value={mode} onValueChange={setMode} disabled={disabled}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowNone && <SelectItem value="none">None</SelectItem>}
            <SelectItem value="solid">Solid</SelectItem>
            <SelectItem value="linear">Linear gradient</SelectItem>
            <SelectItem value="radial">Radial gradient</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === "solid" && typeof value === "string" && (
        <div className="flex gap-2">
          <input
            type="color"
            className="h-9 w-12 rounded border"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
          <Input
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )}

      {isGradient(value) && (
        <div className="space-y-2 rounded border p-2">
          {value.type === "linear" && (
            <div className="space-y-1">
              <Label className="text-xs">Angle ({value.angle}°)</Label>
              <input
                type="range"
                min={0}
                max={360}
                step={5}
                className="w-full"
                value={value.angle}
                disabled={disabled}
                onChange={(e) => patchGradient({ angle: Number(e.target.value) })}
              />
            </div>
          )}

          <div className="space-y-1">
            {value.stops.map((stop, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <input
                  type="color"
                  className="h-8 w-9 shrink-0 rounded border"
                  value={stop.color}
                  disabled={disabled}
                  onChange={(e) => {
                    const stops = [...value.stops];
                    stops[index] = { ...stop, color: e.target.value };
                    patchGradient({ stops });
                  }}
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="h-8"
                  value={Math.round(stop.offset * 100)}
                  disabled={disabled}
                  onChange={(e) => {
                    const stops = [...value.stops];
                    stops[index] = {
                      ...stop,
                      offset: clamp(Number(e.target.value) / 100, 0, 1),
                    };
                    patchGradient({ stops });
                  }}
                />
                <span className="text-xs text-muted-foreground">%</span>
                {/* Two stops is the minimum a gradient can have. */}
                {value.stops.length > 2 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 shrink-0"
                    disabled={disabled}
                    onClick={() =>
                      patchGradient({ stops: value.stops.filter((_, i) => i !== index) })
                    }
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {value.stops.length < 8 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full"
              disabled={disabled}
              onClick={() =>
                patchGradient({
                  stops: [...value.stops, { offset: 1, color: "#ffffff" }],
                })
              }
            >
              <Plus className="size-3.5" /> Add stop
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
