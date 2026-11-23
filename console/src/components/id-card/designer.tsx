"use client";

import * as React from "react";
import { Image as ImageIcon, Minus, QrCode, RotateCw, Type } from "lucide-react";
import { toast } from "sonner";

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
import { cn } from "@/lib/utils";
import { Canvas } from "./canvas";
import { FillEditor } from "./fill-editor";
import { Inspector } from "./inspector";
import { LayersPanel } from "./layers-panel";
import {
  CARD_PRESETS,
  COARSE_MM,
  SNAP_MM,
  clamp,
  clampToCard,
  elementForField,
  elementForShape,
  matchPreset,
  newLine,
  snap,
  topZ,
  type IdCardElement,
  type IdCardField,
  type IdCardLayout,
  type IdCardShape,
  type SideName,
} from "./types";

/** Fixed zoom steps, plus "fit", which is computed from the pane's width. */
const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2];
/** Pixels per millimetre at 100%. */
const BASE_PX_PER_MM = 6;

export function IdCardDesigner({
  layout,
  onChange,
  fields,
  shapes,
  disabled,
}: {
  layout: IdCardLayout;
  onChange: (layout: IdCardLayout) => void;
  fields: IdCardField[];
  shapes: IdCardShape[];
  disabled?: boolean;
}) {
  const [side, setSide] = React.useState<SideName>("front");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState<number | "fit">("fit");
  const [fitScale, setFitScale] = React.useState(1);
  const stageRef = React.useRef<HTMLDivElement>(null);

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

  // "Fit" is recomputed whenever the stage or the card changes size, so the
  // whole card stays visible as the window is resized.
  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const recompute = () => {
      const padding = 48;
      const scaleX = (stage.clientWidth - padding) / (layout.card.widthMm * BASE_PX_PER_MM);
      const scaleY = (stage.clientHeight - padding) / (layout.card.heightMm * BASE_PX_PER_MM);
      setFitScale(clamp(Math.min(scaleX, scaleY), 0.2, 4));
    };
    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [layout.card.widthMm, layout.card.heightMm]);

  const pxPerMm = BASE_PX_PER_MM * (zoom === "fit" ? fitScale : zoom);

  const setSideValue = (next: typeof current) =>
    onChange({ ...layout, sides: { ...layout.sides, [side]: next } });

  const addElement = (element: IdCardElement) => {
    setSideValue({ ...current, elements: [...current.elements, element] });
    setSelectedId(element.id);
  };

  const patchElement = React.useCallback(
    (id: string, patch: Partial<IdCardElement>) => {
      const next = layout.sides[side];
      onChange({
        ...layout,
        sides: {
          ...layout.sides,
          [side]: {
            ...next,
            elements: next.elements.map((e) =>
              e.id === id ? ({ ...e, ...patch } as IdCardElement) : e,
            ),
          },
        },
      });
    },
    [layout, side, onChange],
  );

  const removeElement = (id: string) => {
    setSideValue({ ...current, elements: current.elements.filter((e) => e.id !== id) });
    setSelectedId(null);
  };

  /** The layers list hands back ids topmost-first; z is derived from that. */
  const reorder = (idsTopFirst: string[]) => {
    const zOf = new Map(idsTopFirst.map((id, index) => [id, idsTopFirst.length - index]));
    setSideValue({
      ...current,
      elements: current.elements.map((e) => ({ ...e, z: zOf.get(e.id) ?? e.z })),
    });
  };

  /** Resizes the card and pulls any stranded element back inside. */
  const resizeCard = (widthMm: number, heightMm: number) => {
    const result = clampToCard(layout, widthMm, heightMm);
    onChange(result.layout);
    if (result.moved > 0) {
      toast.info(
        `${result.moved} element${result.moved === 1 ? "" : "s"} moved to stay on the card`,
      );
    }
  };

  // Arrow keys nudge the selection; Shift makes the step coarse. Typing in the
  // inspector must not move the card, hence the target check.
  React.useEffect(() => {
    if (!selected || disabled || selected.locked) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (!selected) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeElement(selected.id);
        return;
      }
      const step = event.shiftKey ? COARSE_MM : SNAP_MM;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
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

  const groupedFields = React.useMemo(() => {
    const map = new Map<string, IdCardField[]>();
    for (const field of fields) {
      const list = map.get(field.group) ?? [];
      list.push(field);
      map.set(field.group, list);
    }
    return [...map.entries()];
  }, [fields]);

  const groupedShapes = React.useMemo(() => {
    const map = new Map<string, IdCardShape[]>();
    for (const shape of shapes) {
      const list = map.get(shape.group) ?? [];
      list.push(shape);
      map.set(shape.group, list);
    }
    return [...map.entries()];
  }, [shapes]);

  const preset = matchPreset(layout.card.widthMm, layout.card.heightMm);
  const isPortrait = layout.card.heightMm > layout.card.widthMm;

  return (
    <div className="flex min-h-0 flex-1">
      {/* ---- Palette ---- */}
      <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r">
        <div className="border-b p-2">
          <p className="pb-1 text-xs font-medium text-muted-foreground">Add</p>
          <div className="grid grid-cols-2 gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() =>
                addElement({
                  id: `el-${Date.now().toString(36)}`,
                  type: "text",
                  staticText: "Text",
                  xMm: 4,
                  yMm: 4,
                  wMm: 30,
                  hMm: 6,
                  z: topZ(current),
                  fontSize: 9,
                  bold: false,
                  color: "#111111",
                  align: "left",
                  lineHeight: 1.2,
                  maxLines: 1,
                })
              }
            >
              <Type className="size-3.5" /> Text
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => addElement(newLine(4, 4, topZ(current)))}
            >
              <Minus className="size-3.5" /> Line
            </Button>
          </div>
        </div>

        <div className="border-b p-2">
          <p className="pb-1 text-xs font-medium text-muted-foreground">Shapes</p>
          {groupedShapes.map(([group, items]) => (
            <div key={group} className="pb-2">
              <p className="px-1 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {group}
              </p>
              <div className="grid grid-cols-4 gap-1">
                {items.map((shape) => (
                  <button
                    key={shape.name}
                    type="button"
                    title={shape.label}
                    disabled={disabled}
                    onClick={() => addElement(elementForShape(shape.name, 4, 4, topZ(current)))}
                    className="flex aspect-square items-center justify-center rounded border p-1 hover:bg-accent disabled:opacity-50"
                  >
                    <svg viewBox="0 0 1 1" className="size-full" aria-hidden>
                      <path d={shape.path} className="fill-foreground/70" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 p-2">
          <p className="pb-1 text-xs text-muted-foreground">
            Drag a field onto the card, or click to drop it top-left.
          </p>
          {groupedFields.map(([group, items]) => (
            <div key={group} className="pb-2">
              <p className="px-1 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {group}
              </p>
              <div className="space-y-1">
                {items.map((field) => (
                  <button
                    key={field.token}
                    type="button"
                    draggable={!disabled}
                    disabled={disabled}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", field.token)}
                    onClick={() =>
                      addElement(elementForField(field, 4, 4, topZ(current)))
                    }
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
      </aside>

      {/* ---- Stage ---- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
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

          <div className="ml-auto flex items-center gap-2">
            <Select
              value={preset?.name ?? "custom"}
              disabled={disabled}
              onValueChange={(name) => {
                const next = CARD_PRESETS.find((p) => p.name === name);
                if (!next) return;
                // Keep the current orientation when switching preset.
                resizeCard(
                  isPortrait ? next.heightMm : next.widthMm,
                  isPortrait ? next.widthMm : next.heightMm,
                );
              }}
            >
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CARD_PRESETS.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.label}
                  </SelectItem>
                ))}
                {!preset && <SelectItem value="custom">Custom</SelectItem>}
              </SelectContent>
            </Select>

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              title="Swap width and height"
              // Orientation IS the dimensions. There is no separate field to
              // drift out of step with them.
              onClick={() => resizeCard(layout.card.heightMm, layout.card.widthMm)}
            >
              <RotateCw className="size-3.5" />
              {isPortrait ? "Portrait" : "Landscape"}
            </Button>

            <div className="flex items-center gap-1">
              <Input
                type="number"
                step={0.1}
                className="h-8 w-20"
                value={layout.card.widthMm}
                disabled={disabled}
                onChange={(e) =>
                  resizeCard(
                    clamp(Number(e.target.value) || layout.card.widthMm, 20, 500),
                    layout.card.heightMm,
                  )
                }
              />
              <span className="text-xs text-muted-foreground">×</span>
              <Input
                type="number"
                step={0.1}
                className="h-8 w-20"
                value={layout.card.heightMm}
                disabled={disabled}
                onChange={(e) =>
                  resizeCard(
                    layout.card.widthMm,
                    clamp(Number(e.target.value) || layout.card.heightMm, 20, 500),
                  )
                }
              />
              <span className="text-xs text-muted-foreground">mm</span>
            </div>

            <Select
              value={zoom === "fit" ? "fit" : String(zoom)}
              onValueChange={(v) => setZoom(v === "fit" ? "fit" : Number(v))}
            >
              <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fit">Fit</SelectItem>
                {ZOOM_STEPS.map((step) => (
                  <SelectItem key={step} value={String(step)}>
                    {Math.round(step * 100)}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div
          ref={stageRef}
          className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/40 p-6"
        >
          <Canvas
            layout={layout}
            side={current}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onPatch={patchElement}
            onDropField={(token, xMm, yMm) => {
              const field = fields.find((f) => f.token === token);
              if (field) addElement(elementForField(field, xMm, yMm, topZ(current)));
            }}
            pxPerMm={pxPerMm}
            shapes={shapes}
            sampleFor={sampleFor}
            labelFor={labelFor}
            disabled={disabled}
          />
        </div>

        <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
          Bound text shows a sample value, so the layout is judged at realistic width.
          Arrow keys nudge, Shift+arrow moves further, Delete removes.
        </p>
      </div>

      {/* ---- Layers + inspector ---- */}
      <aside className="flex w-72 shrink-0 flex-col border-l">
        <div className="flex min-h-0 flex-[2] flex-col overflow-hidden">
          <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">
            Layers <span className="text-muted-foreground">(top first)</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <LayersPanel
              elements={current.elements}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onReorder={reorder}
              onPatch={patchElement}
              shapes={shapes}
              labelFor={labelFor}
              disabled={disabled}
            />
          </div>
        </div>

        <div className={cn("flex min-h-0 flex-[3] flex-col overflow-hidden border-t")}>
          <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">
            {selected ? "Element" : `${side === "front" ? "Front" : "Back"} side`}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {selected ? (
              <Inspector
                element={selected}
                layout={layout}
                shapes={shapes}
                labelFor={labelFor}
                disabled={disabled}
                onPatch={(patch) => patchElement(selected.id, patch)}
                onRemove={() => removeElement(selected.id)}
              />
            ) : (
              <div className="space-y-3 p-3">
                <FillEditor
                  label="Background"
                  value={current.background.color}
                  disabled={disabled}
                  onChange={(fill) =>
                    setSideValue({
                      ...current,
                      background: { ...current.background, color: fill ?? "#ffffff" },
                    })
                  }
                />
                <div className="space-y-1">
                  <Label className="text-xs">Card size</Label>
                  <p className="text-xs text-muted-foreground">
                    {layout.card.widthMm} × {layout.card.heightMm} mm
                    {preset ? ` · ${preset.label}` : " · custom"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select an element to edit it. The back side prints only when it has
                  something on it, so an untouched back costs no page.
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
