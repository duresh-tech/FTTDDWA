"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FillEditor } from "./fill-editor";
import {
  clamp,
  elementLabel,
  type IdCardElement,
  type IdCardLayout,
  type IdCardShape,
} from "./types";

/**
 * The selected element's properties.
 *
 * There is deliberately no `z` field here: stacking is the layers panel's job,
 * and offering two ways to set it is how they end up disagreeing.
 */
export function Inspector({
  element,
  layout,
  shapes,
  labelFor,
  disabled,
  onPatch,
  onRemove,
}: {
  element: IdCardElement;
  layout: IdCardLayout;
  shapes: IdCardShape[];
  labelFor: (token?: string) => string;
  disabled?: boolean;
  onPatch: (patch: Partial<IdCardElement>) => void;
  onRemove: () => void;
}) {
  const num = (value: string, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const shapeLabel = (name: string) => shapes.find((s) => s.name === name)?.label ?? "Shape";
  const locked = disabled || element.locked;

  return (
    <div className="space-y-3 p-3">
      <div>
        <p className="truncate text-sm font-medium">
          {elementLabel(element, labelFor, shapeLabel)}
        </p>
        <p className="text-xs text-muted-foreground">
          {element.type === "rect" ? "shape" : element.type}
          {element.locked ? " · locked" : ""}
          {element.hidden ? " · hidden" : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["xMm", "yMm", "wMm", "hMm"] as const).map((key) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs">
              {key === "xMm" ? "X" : key === "yMm" ? "Y" : key === "wMm" ? "W" : "H"} (mm)
            </Label>
            <Input
              type="number"
              step={0.5}
              value={element[key]}
              disabled={locked}
              onChange={(e) => {
                const value = num(e.target.value, element[key]);
                const limit =
                  key === "xMm" || key === "wMm" ? layout.card.widthMm : layout.card.heightMm;
                onPatch({ [key]: clamp(value, 0, limit) } as Partial<IdCardElement>);
              }}
            />
          </div>
        ))}
      </div>

      {element.type === "text" && (
        <>
          {element.token === undefined && (
            <div className="space-y-1">
              <Label className="text-xs">Fixed text</Label>
              <Input
                value={element.staticText ?? ""}
                disabled={locked}
                onChange={(e) => onPatch({ staticText: e.target.value })}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Size (pt)</Label>
              <Input
                type="number"
                step={0.5}
                value={element.fontSize}
                disabled={locked}
                onChange={(e) =>
                  onPatch({ fontSize: clamp(num(e.target.value, element.fontSize), 3, 96) })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max lines</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={element.maxLines}
                disabled={locked}
                onChange={(e) =>
                  onPatch({ maxLines: clamp(num(e.target.value, element.maxLines), 1, 10) })
                }
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Align</Label>
            <Select
              value={element.align}
              disabled={locked}
              onValueChange={(v) => onPatch({ align: v as "left" | "center" | "right" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Colour</Label>
            <div className="flex gap-2">
              <input
                type="color"
                className="h-9 w-12 rounded border"
                value={element.color}
                disabled={locked}
                onChange={(e) => onPatch({ color: e.target.value })}
              />
              <Input
                value={element.color}
                disabled={locked}
                onChange={(e) => onPatch({ color: e.target.value })}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-normal">
            <Checkbox
              checked={element.bold}
              disabled={locked}
              onCheckedChange={(v) => onPatch({ bold: v === true })}
            />
            Bold
          </label>
        </>
      )}

      {element.type === "image" && (
        <div className="space-y-1">
          <Label className="text-xs">Fit</Label>
          <Select
            value={element.fit}
            disabled={locked}
            onValueChange={(v) => onPatch({ fit: v as "contain" | "cover" })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="contain">Contain (whole image)</SelectItem>
              <SelectItem value="cover">Cover (fill and crop)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {element.type === "rect" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Shape</Label>
            <Select
              value={element.shape}
              disabled={locked}
              onValueChange={(v) => onPatch({ shape: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {shapes.map((shape) => (
                  <SelectItem key={shape.name} value={shape.name}>
                    {shape.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <FillEditor
            label="Fill"
            value={element.fill}
            allowNone
            disabled={locked}
            onChange={(fill) => onPatch({ fill })}
          />

          <div className="space-y-1">
            <Label className="text-xs">Border</Label>
            <div className="flex gap-2">
              <input
                type="color"
                className="h-9 w-12 rounded border"
                value={element.borderColor ?? "#000000"}
                disabled={locked}
                onChange={(e) => onPatch({ borderColor: e.target.value })}
              />
              <Input
                type="number"
                step={0.1}
                min={0}
                value={element.borderWidthMm}
                disabled={locked}
                onChange={(e) =>
                  onPatch({
                    borderWidthMm: clamp(num(e.target.value, element.borderWidthMm), 0, 20),
                  })
                }
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={locked}
                onClick={() => onPatch({ borderColor: null })}
              >
                None
              </Button>
            </div>
          </div>

          {/* Rounded corners only mean anything on a rectangle; every other
              shape comes from a path. */}
          {element.shape === "rect" && (
            <div className="space-y-1">
              <Label className="text-xs">Corner radius (mm)</Label>
              <Input
                type="number"
                step={0.5}
                value={element.radiusMm}
                disabled={locked}
                onChange={(e) =>
                  onPatch({ radiusMm: clamp(num(e.target.value, element.radiusMm), 0, 50) })
                }
              />
            </div>
          )}
        </>
      )}

      {element.type === "line" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Direction</Label>
            <Select
              value={element.direction}
              disabled={locked}
              onValueChange={(v) =>
                onPatch({ direction: v as "horizontal" | "vertical" | "diagonal" })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="horizontal">Horizontal</SelectItem>
                <SelectItem value="vertical">Vertical</SelectItem>
                <SelectItem value="diagonal">Diagonal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Style</Label>
            <Select
              value={element.dash}
              disabled={locked}
              onValueChange={(v) => onPatch({ dash: v as "solid" | "dashed" | "dotted" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Solid</SelectItem>
                <SelectItem value="dashed">Dashed</SelectItem>
                <SelectItem value="dotted">Dotted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Thickness (mm)</Label>
              <Input
                type="number"
                step={0.1}
                min={0.05}
                value={element.widthMm}
                disabled={locked}
                onChange={(e) =>
                  onPatch({ widthMm: clamp(num(e.target.value, element.widthMm), 0.05, 20) })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Colour</Label>
              <input
                type="color"
                className="h-9 w-full rounded border"
                value={element.color}
                disabled={locked}
                onChange={(e) => onPatch({ color: e.target.value })}
              />
            </div>
          </div>
        </>
      )}

      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="w-full"
        disabled={disabled}
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" /> Remove
      </Button>
    </div>
  );
}
