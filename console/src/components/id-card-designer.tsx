"use client";

import * as React from "react";
import { Image as ImageIcon, QrCode, Square, Trash2, Type } from "lucide-react";

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
import { cn } from "@/lib/utils";

/**
 * The ID card designer.
 *
 * **Everything is in millimetres.** A card is a physical object printed at a
 * fixed size; pixels belong to whatever screen drew it. The canvas multiplies
 * by `SCALE` on the way out and divides on the way in, and nothing but that
 * conversion ever sees pixels. Storing pixels is how a layout ends up
 * pixel-perfect here and wrong on the printer.
 *
 * Drag and drop is plain pointer events rather than a library. The console has
 * no DnD dependency and deliberately no form library either, and the
 * list-oriented libraries are a poor fit for free positioning on a canvas:
 * pointerdown -> setPointerCapture -> pointermove is less code and behaves
 * better here.
 */

export type IdCardFieldKind = "text" | "image" | "qr";

export interface IdCardField {
  token: string;
  label: string;
  group: string;
  kind: IdCardFieldKind;
  sample: string;
}

interface BaseElement {
  id: string;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  z: number;
}

export type IdCardElement =
  | (BaseElement & {
      type: "text";
      token?: string;
      staticText?: string;
      fontSize: number;
      bold: boolean;
      color: string;
      align: "left" | "center" | "right";
      lineHeight: number;
      maxLines: number;
    })
  | (BaseElement & { type: "image"; token?: string; staticPath?: string; fit: "contain" | "cover" })
  | (BaseElement & { type: "qr"; token: string })
  | (BaseElement & {
      type: "rect";
      fill: string | null;
      borderColor: string | null;
      borderWidthMm: number;
      radiusMm: number;
    });

export interface IdCardSide {
  background: { color: string; imagePath: string | null };
  elements: IdCardElement[];
}

export interface IdCardLayout {
  version: 1;
  card: { widthMm: number; heightMm: number };
  sides: { front: IdCardSide; back: IdCardSide };
}

export type SideName = "front" | "back";

/** Pixels per millimetre on the canvas. 6 makes a CR80 card ~514px wide. */
const SCALE = 6;
const mm = (value: number) => value * SCALE;

/** Positions snap to this, and arrow keys step by it. */
const SNAP_MM = 0.5;
const COARSE_MM = 5;

const snap = (value: number) => Math.round(value / SNAP_MM) * SNAP_MM;
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

let elementCounter = 0;
function nextElementId(): string {
  elementCounter += 1;
  return `el-${Date.now().toString(36)}-${elementCounter}`;
}

export function emptySide(): IdCardSide {
  return { background: { color: "#ffffff", imagePath: null }, elements: [] };
}

export function emptyLayout(widthMm = 85.6, heightMm = 54): IdCardLayout {
  return {
    version: 1,
    card: { widthMm, heightMm },
    sides: { front: emptySide(), back: emptySide() },
  };
}

/** A new element of the right type for a field's kind. */
function elementForField(field: IdCardField, xMm: number, yMm: number): IdCardElement {
  const base = { id: nextElementId(), xMm, yMm, z: 1 };
  if (field.kind === "image") {
    return { ...base, type: "image", token: field.token, wMm: 18, hMm: 22, fit: "contain" };
  }
  if (field.kind === "qr") {
    return { ...base, type: "qr", token: field.token, wMm: 15, hMm: 15 };
  }
  return {
    ...base,
    type: "text",
    token: field.token,
    wMm: 40,
    hMm: 6,
    fontSize: 9,
    bold: false,
    color: "#111111",
    align: "left",
    lineHeight: 1.2,
    maxLines: 1,
  };
}

function shapeElement(type: "rect", xMm: number, yMm: number): IdCardElement {
  return {
    id: nextElementId(),
    type,
    xMm,
    yMm,
    wMm: 30,
    hMm: 10,
    z: 0,
    fill: "#e2e8f0",
    borderColor: null,
    borderWidthMm: 0,
    radiusMm: 0,
  };
}

interface DesignerProps {
  layout: IdCardLayout;
  onChange: (layout: IdCardLayout) => void;
  fields: IdCardField[];
  disabled?: boolean;
}

export function IdCardDesigner({ layout, onChange, fields, disabled }: DesignerProps) {
  const [side, setSide] = React.useState<SideName>("front");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const current = layout.sides[side];
  const selected = current.elements.find((e) => e.id === selectedId) ?? null;

  const sampleFor = React.useCallback(
    (token?: string) => fields.find((f) => f.token === token)?.sample ?? "",
    [fields],
  );
  const labelFor = React.useCallback(
    (token?: string) => fields.find((f) => f.token === token)?.label ?? token ?? "",
    [fields],
  );

  const setSide_ = (next: IdCardSide) =>
    onChange({ ...layout, sides: { ...layout.sides, [side]: next } });

  const addElement = (element: IdCardElement) => {
    setSide_({ ...current, elements: [...current.elements, element] });
    setSelectedId(element.id);
  };

  const patchElement = (id: string, patch: Partial<IdCardElement>) => {
    setSide_({
      ...current,
      elements: current.elements.map((e) =>
        e.id === id ? ({ ...e, ...patch } as IdCardElement) : e,
      ),
    });
  };

  const removeElement = (id: string) => {
    setSide_({ ...current, elements: current.elements.filter((e) => e.id !== id) });
    setSelectedId(null);
  };

  // Arrow keys nudge the selection; shift makes the step coarse. Typing in the
  // inspector must not move the card, hence the target check.
  React.useEffect(() => {
    if (!selected || disabled) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (!selected) return;

      const step = event.shiftKey ? COARSE_MM : SNAP_MM;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeElement(selected.id);
        return;
      }
      const move = moves[event.key];
      if (!move) return;
      event.preventDefault();
      patchElement(selected.id, {
        xMm: clamp(snap(selected.xMm + move[0]), 0, layout.card.widthMm - selected.wMm),
        yMm: clamp(snap(selected.yMm + move[1]), 0, layout.card.heightMm - selected.hMm),
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const grouped = React.useMemo(() => {
    const map = new Map<string, IdCardField[]>();
    for (const field of fields) {
      const list = map.get(field.group) ?? [];
      list.push(field);
      map.set(field.group, list);
    }
    return [...map.entries()];
  }, [fields]);

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
      {/* ---- Palette ---- */}
      <div className="space-y-3">
        <div className="rounded-lg border">
          <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">Shapes</div>
          <div className="p-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start"
              disabled={disabled}
              onClick={() => addElement(shapeElement("rect", 4, 4))}
            >
              <Square className="size-3.5" /> Box
            </Button>
          </div>
        </div>

        <div className="max-h-[32rem] space-y-3 overflow-y-auto rounded-lg border p-2">
          <p className="px-1 text-xs text-muted-foreground">
            Drag a field onto the card, or click to drop it top-left.
          </p>
          {grouped.map(([group, items]) => (
            <div key={group}>
              <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">{group}</p>
              <div className="space-y-1">
                {items.map((field) => (
                  <button
                    key={field.token}
                    type="button"
                    draggable={!disabled}
                    disabled={disabled}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", field.token)}
                    onClick={() => addElement(elementForField(field, 4, 4))}
                    className="flex w-full items-center gap-1.5 rounded border px-2 py-1 text-left text-xs hover:bg-accent disabled:opacity-50"
                  >
                    {field.kind === "image" ? (
                      <ImageIcon className="size-3 shrink-0 text-muted-foreground" />
                    ) : field.kind === "qr" ? (
                      <QrCode className="size-3 shrink-0 text-muted-foreground" />
                    ) : (
                      <Type className="size-3 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{field.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Canvas ---- */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {(["front", "back"] as SideName[]).map((name) => (
            <Button
              key={name}
              type="button"
              size="sm"
              variant={side === name ? "default" : "outline"}
              onClick={() => {
                setSide(name);
                setSelectedId(null);
              }}
            >
              {name === "front" ? "Front" : "Back"}
              {layout.sides[name].elements.length > 0 && (
                <span className="ml-1 text-xs opacity-70">
                  ({layout.sides[name].elements.length})
                </span>
              )}
            </Button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {layout.card.widthMm} × {layout.card.heightMm} mm
          </span>
        </div>

        <Canvas
          layout={layout}
          side={current}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onPatch={patchElement}
          onDropField={(token, xMm, yMm) => {
            const field = fields.find((f) => f.token === token);
            if (field) addElement(elementForField(field, xMm, yMm));
          }}
          sampleFor={sampleFor}
          labelFor={labelFor}
          disabled={disabled}
        />

        <p className="text-xs text-muted-foreground">
          Bound text shows a sample value, so the layout is judged at realistic width —
          a Tamil name is wider than its token. Arrow keys nudge, Shift+arrow moves
          further, Delete removes.
        </p>
      </div>

      {/* ---- Inspector ---- */}
      <div className="rounded-lg border">
        <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">
          {selected ? "Element" : "Card"}
        </div>
        <div className="space-y-3 p-3">
          {selected ? (
            <Inspector
              element={selected}
              layout={layout}
              labelFor={labelFor}
              disabled={disabled}
              onPatch={(patch) => patchElement(selected.id, patch)}
              onRemove={() => removeElement(selected.id)}
            />
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Background</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    className="h-9 w-12 rounded border"
                    value={current.background.color}
                    disabled={disabled}
                    onChange={(e) =>
                      setSide_({
                        ...current,
                        background: { ...current.background, color: e.target.value },
                      })
                    }
                  />
                  <Input
                    value={current.background.color}
                    disabled={disabled}
                    onChange={(e) =>
                      setSide_({
                        ...current,
                        background: { ...current.background, color: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Select an element to edit it. The back side prints only when it has
                something on it, so an untouched back costs no page.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ canvas */

type Handle = "nw" | "ne" | "sw" | "se";

function Canvas({
  layout,
  side,
  selectedId,
  onSelect,
  onPatch,
  onDropField,
  sampleFor,
  labelFor,
  disabled,
}: {
  layout: IdCardLayout;
  side: IdCardSide;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPatch: (id: string, patch: Partial<IdCardElement>) => void;
  onDropField: (token: string, xMm: number, yMm: number) => void;
  sampleFor: (token?: string) => string;
  labelFor: (token?: string) => string;
  disabled?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  // Held in a ref, not state: a drag updates on every pointermove and the
  // start point must not be recomputed by a re-render mid-gesture.
  const drag = React.useRef<{
    id: string;
    handle: Handle | null;
    startX: number;
    startY: number;
    origin: { xMm: number; yMm: number; wMm: number; hMm: number };
  } | null>(null);

  function beginDrag(
    event: React.PointerEvent,
    element: IdCardElement,
    handle: Handle | null,
  ) {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    onSelect(element.id);
    drag.current = {
      id: element.id,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      origin: { xMm: element.xMm, yMm: element.yMm, wMm: element.wMm, hMm: element.hMm },
    };
  }

  function onPointerMove(event: React.PointerEvent) {
    const state = drag.current;
    if (!state) return;
    const dxMm = (event.clientX - state.startX) / SCALE;
    const dyMm = (event.clientY - state.startY) / SCALE;
    const { xMm, yMm, wMm, hMm } = state.origin;
    const maxW = layout.card.widthMm;
    const maxH = layout.card.heightMm;

    if (!state.handle) {
      onPatch(state.id, {
        xMm: clamp(snap(xMm + dxMm), 0, maxW - wMm),
        yMm: clamp(snap(yMm + dyMm), 0, maxH - hMm),
      });
      return;
    }

    // Resizing from a corner moves the opposite edge's origin too, which is
    // why x/y are recomputed rather than left alone.
    const east = state.handle === "ne" || state.handle === "se";
    const south = state.handle === "se" || state.handle === "sw";
    const nextW = clamp(snap(east ? wMm + dxMm : wMm - dxMm), 2, maxW);
    const nextH = clamp(snap(south ? hMm + dyMm : hMm - dyMm), 2, maxH);
    onPatch(state.id, {
      wMm: nextW,
      hMm: nextH,
      xMm: clamp(east ? xMm : snap(xMm + (wMm - nextW)), 0, maxW - nextW),
      yMm: clamp(south ? yMm : snap(yMm + (hMm - nextH)), 0, maxH - nextH),
    });
  }

  function endDrag() {
    drag.current = null;
  }

  const ordered = [...side.elements].sort((a, b) => a.z - b.z);

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-lg border shadow-sm select-none"
      style={{
        width: mm(layout.card.widthMm),
        height: mm(layout.card.heightMm),
        background: side.background.color,
        // A faint grid at the snap interval, so alignment is visible.
        backgroundImage:
          "linear-gradient(to right, rgba(0,0,0,.05) 1px, transparent 1px)," +
          "linear-gradient(to bottom, rgba(0,0,0,.05) 1px, transparent 1px)",
        backgroundSize: `${mm(5)}px ${mm(5)}px`,
      }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={() => onSelect(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const token = e.dataTransfer.getData("text/plain");
        const box = ref.current?.getBoundingClientRect();
        if (!token || !box) return;
        onDropField(
          token,
          clamp(snap((e.clientX - box.left) / SCALE), 0, layout.card.widthMm - 5),
          clamp(snap((e.clientY - box.top) / SCALE), 0, layout.card.heightMm - 3),
        );
      }}
    >
      {ordered.map((element) => {
        const isSelected = element.id === selectedId;
        return (
          <div
            key={element.id}
            onPointerDown={(e) => beginDrag(e, element, null)}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "absolute cursor-move",
              isSelected ? "outline outline-2 outline-primary" : "hover:outline hover:outline-1 hover:outline-primary/40",
            )}
            style={{
              left: mm(element.xMm),
              top: mm(element.yMm),
              width: mm(element.wMm),
              height: mm(element.hMm),
              zIndex: element.z,
            }}
          >
            <ElementPreview element={element} sampleFor={sampleFor} labelFor={labelFor} />
            {isSelected && !disabled &&
              (["nw", "ne", "sw", "se"] as Handle[]).map((handle) => (
                <span
                  key={handle}
                  onPointerDown={(e) => beginDrag(e, element, handle)}
                  className="absolute size-2 rounded-sm border border-background bg-primary"
                  style={{
                    cursor: handle === "nw" || handle === "se" ? "nwse-resize" : "nesw-resize",
                    left: handle.includes("w") ? -4 : undefined,
                    right: handle.includes("e") ? -4 : undefined,
                    top: handle.startsWith("n") ? -4 : undefined,
                    bottom: handle.startsWith("s") ? -4 : undefined,
                  }}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}

function ElementPreview({
  element,
  sampleFor,
  labelFor,
}: {
  element: IdCardElement;
  sampleFor: (token?: string) => string;
  labelFor: (token?: string) => string;
}) {
  if (element.type === "rect") {
    return (
      <div
        className="size-full"
        style={{
          background: element.fill ?? "transparent",
          border: element.borderColor
            ? `${mm(element.borderWidthMm)}px solid ${element.borderColor}`
            : undefined,
          borderRadius: mm(element.radiusMm),
        }}
      />
    );
  }
  if (element.type === "qr") {
    return (
      <div className="flex size-full items-center justify-center bg-foreground/10 text-[9px] text-muted-foreground">
        <QrCode className="size-1/2" />
      </div>
    );
  }
  if (element.type === "image") {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-0.5 border border-dashed border-muted-foreground/40 bg-muted/40 text-[8px] text-muted-foreground">
        <ImageIcon className="size-4" />
        <span className="truncate px-1">{labelFor(element.token)}</span>
      </div>
    );
  }
  const value = element.token ? sampleFor(element.token) : (element.staticText ?? "");
  return (
    <div
      className="size-full overflow-hidden leading-tight"
      style={{
        // pt -> px at 96dpi, so on-screen size matches the printed size.
        fontSize: element.fontSize * (96 / 72),
        fontWeight: element.bold ? 700 : 400,
        color: element.color,
        textAlign: element.align,
        lineHeight: element.lineHeight,
      }}
    >
      {value || labelFor(element.token) || "Text"}
    </div>
  );
}

/* --------------------------------------------------------------- inspector */

function Inspector({
  element,
  layout,
  labelFor,
  disabled,
  onPatch,
  onRemove,
}: {
  element: IdCardElement;
  layout: IdCardLayout;
  labelFor: (token?: string) => string;
  disabled?: boolean;
  onPatch: (patch: Partial<IdCardElement>) => void;
  onRemove: () => void;
}) {
  const num = (value: string, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">
          {element.type === "rect" ? "Box" : labelFor((element as { token?: string }).token)}
        </p>
        <p className="text-xs text-muted-foreground">{element.type}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["xMm", "yMm", "wMm", "hMm"] as const).map((key) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs">
              {key === "xMm" ? "X" : key === "yMm" ? "Y" : key === "wMm" ? "Width" : "Height"} (mm)
            </Label>
            <Input
              type="number"
              step={0.5}
              value={element[key]}
              disabled={disabled}
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
                disabled={disabled}
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
                disabled={disabled}
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
                disabled={disabled}
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
              disabled={disabled}
              onValueChange={(v) => onPatch({ align: v as "left" | "center" | "right" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
                disabled={disabled}
                onChange={(e) => onPatch({ color: e.target.value })}
              />
              <Input
                value={element.color}
                disabled={disabled}
                onChange={(e) => onPatch({ color: e.target.value })}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-normal">
            <Checkbox
              checked={element.bold}
              disabled={disabled}
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
            disabled={disabled}
            onValueChange={(v) => onPatch({ fit: v as "contain" | "cover" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
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
            <Label className="text-xs">Fill</Label>
            <div className="flex gap-2">
              <input
                type="color"
                className="h-9 w-12 rounded border"
                value={element.fill ?? "#ffffff"}
                disabled={disabled}
                onChange={(e) => onPatch({ fill: e.target.value })}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => onPatch({ fill: null })}
              >
                None
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Corner radius (mm)</Label>
            <Input
              type="number"
              step={0.5}
              value={element.radiusMm}
              disabled={disabled}
              onChange={(e) =>
                onPatch({ radiusMm: clamp(num(e.target.value, element.radiusMm), 0, 50) })
              }
            />
          </div>
        </>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Layer</Label>
        <Input
          type="number"
          min={0}
          max={999}
          value={element.z}
          disabled={disabled}
          onChange={(e) => onPatch({ z: clamp(num(e.target.value, element.z), 0, 999) })}
        />
      </div>

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
