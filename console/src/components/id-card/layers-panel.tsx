"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Lock,
  Minus,
  QrCode,
  Square,
  Type,
  Unlock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { elementLabel, type IdCardElement, type IdCardShape } from "./types";

/**
 * The stacking order of one side, topmost first.
 *
 * `z` is DERIVED from position in this list on every reorder, and the
 * inspector no longer carries a z field. Two ways to set the same thing is
 * how they end up disagreeing.
 *
 * Reordering uses the same pointer-event idiom as the canvas rather than a
 * drag-and-drop library, with ▲▼ buttons alongside because a four-pixel drop
 * target is a poor way to move one layer by one place.
 */
export function LayersPanel({
  elements,
  selectedId,
  onSelect,
  onReorder,
  onPatch,
  shapes,
  labelFor,
  disabled,
}: {
  elements: IdCardElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Receives the ids topmost-first; the caller turns that into `z`. */
  onReorder: (idsTopFirst: string[]) => void;
  onPatch: (id: string, patch: Partial<IdCardElement>) => void;
  shapes: IdCardShape[];
  labelFor: (token?: string) => string;
  disabled?: boolean;
}) {
  const [dragId, setDragId] = React.useState<string | null>(null);

  // Topmost first, which is how a layers list reads everywhere else.
  const ordered = React.useMemo(
    () => [...elements].sort((a, b) => b.z - a.z),
    [elements],
  );

  const shapeLabel = React.useCallback(
    (name: string) => shapes.find((s) => s.name === name)?.label ?? "Shape",
    [shapes],
  );

  function move(id: string, delta: number) {
    const ids = ordered.map((e) => e.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    onReorder(ids);
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = ordered.map((e) => e.id);
    const from = ids.indexOf(dragId);
    ids.splice(from, 1);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    onReorder(ids);
  }

  if (ordered.length === 0) {
    return (
      <p className="p-3 text-xs text-muted-foreground">
        Nothing on this side yet. Drag a field or a shape onto the card.
      </p>
    );
  }

  return (
    <div className="divide-y">
      {ordered.map((element, index) => {
        const Icon =
          element.type === "text"
            ? Type
            : element.type === "image"
              ? ImageIcon
              : element.type === "qr"
                ? QrCode
                : element.type === "line"
                  ? Minus
                  : Square;

        return (
          <div
            key={element.id}
            draggable={!disabled}
            onDragStart={() => setDragId(element.id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dropOn(element.id)}
            onClick={() => onSelect(element.id)}
            className={cn(
              "flex items-center gap-1 px-2 py-1.5 text-xs",
              element.id === selectedId ? "bg-accent" : "hover:bg-accent/50",
              element.hidden && "opacity-50",
              dragId === element.id && "opacity-30",
            )}
          >
            <GripVertical className="size-3 shrink-0 cursor-grab text-muted-foreground" />
            <Icon className="size-3 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">
              {elementLabel(element, labelFor, shapeLabel)}
            </span>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6 shrink-0"
              disabled={disabled || index === 0}
              title="Bring forward"
              onClick={(e) => {
                e.stopPropagation();
                move(element.id, -1);
              }}
            >
              <ChevronUp className="size-3" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6 shrink-0"
              disabled={disabled || index === ordered.length - 1}
              title="Send backward"
              onClick={(e) => {
                e.stopPropagation();
                move(element.id, 1);
              }}
            >
              <ChevronDown className="size-3" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6 shrink-0"
              disabled={disabled}
              title={element.hidden ? "Show (it will print)" : "Hide (it will not print)"}
              onClick={(e) => {
                e.stopPropagation();
                onPatch(element.id, { hidden: !element.hidden });
              }}
            >
              {element.hidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6 shrink-0"
              disabled={disabled}
              title={element.locked ? "Unlock" : "Lock position"}
              onClick={(e) => {
                e.stopPropagation();
                onPatch(element.id, { locked: !element.locked });
              }}
            >
              {element.locked ? <Lock className="size-3" /> : <Unlock className="size-3 opacity-40" />}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
