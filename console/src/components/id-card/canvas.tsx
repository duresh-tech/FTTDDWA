"use client";

import * as React from "react";
import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { ElementPreview } from "./element-preview";
import {
  clamp,
  fillToCss,
  snap,
  type IdCardElement,
  type IdCardLayout,
  type IdCardShape,
  type IdCardSide,
} from "./types";

type Handle = "nw" | "ne" | "sw" | "se";

/**
 * The card, at `pxPerMm` pixels per millimetre.
 *
 * Drag and resize are plain pointer events: pointerdown ->
 * setPointerCapture -> pointermove. No DnD dependency, which would be a poor
 * fit anyway - those libraries are built for sortable lists, not free
 * positioning.
 *
 * `pxPerMm` is a VIEW concern. It converts on the way in and out and never
 * reaches anything that gets saved.
 */
export function Canvas({
  layout,
  side,
  selectedId,
  onSelect,
  onPatch,
  onDropField,
  pxPerMm,
  shapes,
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
  pxPerMm: number;
  shapes: IdCardShape[];
  sampleFor: (token?: string) => string;
  labelFor: (token?: string) => string;
  disabled?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  // Held in a ref, not state: a drag updates on every pointermove, and the
  // start point must not be recomputed by a re-render mid-gesture.
  const drag = React.useRef<{
    id: string;
    handle: Handle | null;
    startX: number;
    startY: number;
    origin: { xMm: number; yMm: number; wMm: number; hMm: number };
  } | null>(null);

  const px = (value: number) => value * pxPerMm;

  function beginDrag(
    event: React.PointerEvent,
    element: IdCardElement,
    handle: Handle | null,
  ) {
    if (disabled) return;
    // A locked element is still selectable, so its properties can be read and
    // it can be unlocked - it just cannot be moved by accident. This is what
    // makes a full-bleed background usable instead of a click sponge.
    onSelect(element.id);
    if (element.locked) return;
    event.preventDefault();
    event.stopPropagation();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
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
    const dxMm = (event.clientX - state.startX) / pxPerMm;
    const dyMm = (event.clientY - state.startY) / pxPerMm;
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

  const endDrag = () => {
    drag.current = null;
  };

  const ordered = [...side.elements]
    .filter((element) => !element.hidden)
    .sort((a, b) => a.z - b.z);

  // Grid lines every 5mm, faint, so alignment is visible without a ruler.
  const grid = px(5);

  return (
    <div
      ref={ref}
      className="relative shrink-0 overflow-hidden rounded-lg border shadow-sm select-none"
      style={{
        width: px(layout.card.widthMm),
        height: px(layout.card.heightMm),
        background: fillToCss(side.background.color),
        backgroundImage:
          `linear-gradient(to right, rgba(0,0,0,.05) 1px, transparent 1px),` +
          `linear-gradient(to bottom, rgba(0,0,0,.05) 1px, transparent 1px)`,
        backgroundSize: `${grid}px ${grid}px`,
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
          clamp(snap((e.clientX - box.left) / pxPerMm), 0, layout.card.widthMm - 5),
          clamp(snap((e.clientY - box.top) / pxPerMm), 0, layout.card.heightMm - 3),
        );
      }}
    >
      {/* A gradient background needs its own layer: the element's own
          background-image slot is taken by the alignment grid. */}
      {typeof side.background.color !== "string" && (
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: fillToCss(side.background.color) }}
        />
      )}

      {ordered.map((element) => {
        const isSelected = element.id === selectedId;
        return (
          <div
            key={element.id}
            onPointerDown={(e) => beginDrag(e, element, null)}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "absolute",
              element.locked ? "cursor-default" : "cursor-move",
              isSelected
                ? "outline outline-2 outline-primary"
                : "hover:outline hover:outline-1 hover:outline-primary/40",
            )}
            style={{
              left: px(element.xMm),
              top: px(element.yMm),
              width: px(element.wMm),
              height: px(element.hMm),
              zIndex: element.z,
            }}
          >
            <ElementPreview
              element={element}
              pxPerMm={pxPerMm}
              shapes={shapes}
              sampleFor={sampleFor}
              labelFor={labelFor}
            />
            {isSelected && element.locked && (
              <span className="absolute -top-2 -left-2 rounded-full bg-muted p-0.5 shadow">
                <Lock className="size-2.5" />
              </span>
            )}
            {isSelected &&
              !disabled &&
              !element.locked &&
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
