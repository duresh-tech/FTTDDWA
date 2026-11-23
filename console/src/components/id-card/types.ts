/**
 * The ID card layout, mirroring `id-card-layout.schema.ts` on the server.
 *
 * **Everything is in millimetres.** A card is a physical object printed at a
 * fixed size; pixels belong to whatever screen drew it. The canvas multiplies
 * by a px-per-mm scale on the way out and divides on the way in, and nothing
 * that gets saved ever sees a pixel.
 */

export type IdCardFieldKind = "text" | "image" | "qr";

export interface IdCardField {
  token: string;
  label: string;
  group: string;
  kind: IdCardFieldKind;
  sample: string;
}

/** A shape, as the server's catalogue serves it: an SVG path in a unit square. */
export interface IdCardShape {
  name: string;
  label: string;
  group: string;
  path: string;
}

export interface GradientStop {
  offset: number;
  color: string;
}

export interface GradientFill {
  type: "linear" | "radial";
  /** Degrees clockwise from left-to-right. Linear only. */
  angle: number;
  stops: GradientStop[];
}

/**
 * A hex string or a gradient. The plain string arm is what keeps every
 * template saved before gradients existed valid, with no migration.
 */
export type Fill = string | GradientFill;

export function isGradient(fill: Fill | null | undefined): fill is GradientFill {
  return typeof fill === "object" && fill !== null;
}

/** A Fill as a CSS value, for the canvas. */
export function fillToCss(fill: Fill | null | undefined): string {
  if (!fill) return "transparent";
  if (!isGradient(fill)) return fill;
  const stops = [...fill.stops]
    .sort((a, b) => a.offset - b.offset)
    .map((stop) => `${stop.color} ${Math.round(stop.offset * 100)}%`)
    .join(", ");
  return fill.type === "radial"
    ? `radial-gradient(circle at 50% 50%, ${stops})`
    : // CSS measures from "to top" clockwise; the stored angle is from
      // left-to-right, so 0deg here must point right. Hence the +90.
      `linear-gradient(${fill.angle + 90}deg, ${stops})`;
}

interface BaseElement {
  id: string;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  z: number;
  /** Skipped by the renderer as well as the canvas. */
  hidden?: boolean;
  /** Cannot be dragged on the canvas. Still prints. */
  locked?: boolean;
}

export type TextElement = BaseElement & {
  type: "text";
  token?: string;
  staticText?: string;
  fontSize: number;
  bold: boolean;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  maxLines: number;
};

export type ImageElement = BaseElement & {
  type: "image";
  token?: string;
  staticPath?: string;
  fit: "contain" | "cover";
};

export type QrElement = BaseElement & { type: "qr"; token: string };

/**
 * A filled shape. The discriminator stays `rect` and the shape is a separate
 * field, so a layout written before shapes existed parses with `shape`
 * defaulting to a rectangle.
 */
export type ShapeElement = BaseElement & {
  type: "rect";
  shape: string;
  fill: Fill | null;
  borderColor: string | null;
  borderWidthMm: number;
  /** Rounded corners, honoured for `shape: "rect"` only. */
  radiusMm: number;
};

export type LineElement = BaseElement & {
  type: "line";
  direction: "horizontal" | "vertical" | "diagonal";
  color: string;
  widthMm: number;
  dash: "solid" | "dashed" | "dotted";
};

export type IdCardElement =
  | TextElement
  | ImageElement
  | QrElement
  | ShapeElement
  | LineElement;

export interface IdCardSide {
  background: { color: Fill; imagePath: string | null };
  elements: IdCardElement[];
}

export interface IdCardLayout {
  version: 1;
  card: { widthMm: number; heightMm: number };
  sides: { front: IdCardSide; back: IdCardSide };
}

export type SideName = "front" | "back";

/* ------------------------------------------------------------- card sizes */

export interface CardPreset {
  name: string;
  label: string;
  widthMm: number;
  heightMm: number;
}

/** Landscape dimensions; the orientation toggle swaps them. */
export const CARD_PRESETS: CardPreset[] = [
  { name: "cr80", label: "CR80 — standard ID card", widthMm: 85.6, heightMm: 54 },
  { name: "cr79", label: "CR79 — adhesive card", widthMm: 84, heightMm: 52 },
  { name: "a7", label: "A7", widthMm: 105, heightMm: 74 },
  { name: "a6", label: "A6", widthMm: 148, heightMm: 105 },
];

export const DEFAULT_PRESET = CARD_PRESETS[0];

/** The preset matching these dimensions in either orientation, or null. */
export function matchPreset(widthMm: number, heightMm: number): CardPreset | null {
  const near = (a: number, b: number) => Math.abs(a - b) < 0.05;
  return (
    CARD_PRESETS.find(
      (preset) =>
        (near(preset.widthMm, widthMm) && near(preset.heightMm, heightMm)) ||
        (near(preset.heightMm, widthMm) && near(preset.widthMm, heightMm)),
    ) ?? null
  );
}

/* ---------------------------------------------------------------- helpers */

/** Positions snap to this; arrow keys step by it. */
export const SNAP_MM = 0.5;
export const COARSE_MM = 5;

export const snap = (value: number) => Math.round(value / SNAP_MM) * SNAP_MM;
export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

let elementCounter = 0;
export function nextElementId(): string {
  elementCounter += 1;
  return `el-${Date.now().toString(36)}-${elementCounter}`;
}

export function emptySide(): IdCardSide {
  return { background: { color: "#ffffff", imagePath: null }, elements: [] };
}

export function emptyLayout(
  widthMm = DEFAULT_PRESET.widthMm,
  heightMm = DEFAULT_PRESET.heightMm,
): IdCardLayout {
  return {
    version: 1,
    card: { widthMm, heightMm },
    sides: { front: emptySide(), back: emptySide() },
  };
}

/** The highest z on a side, so a new element lands on top. */
export function topZ(side: IdCardSide): number {
  return side.elements.reduce((max, element) => Math.max(max, element.z), 0) + 1;
}

/** A new element of the right type for a field's kind. */
export function elementForField(
  field: IdCardField,
  xMm: number,
  yMm: number,
  z: number,
): IdCardElement {
  const base = { id: nextElementId(), xMm, yMm, z };
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

export function elementForShape(shape: string, xMm: number, yMm: number, z: number): ShapeElement {
  return {
    id: nextElementId(),
    type: "rect",
    shape,
    xMm,
    yMm,
    wMm: 20,
    hMm: 20,
    z,
    fill: "#e2e8f0",
    borderColor: null,
    borderWidthMm: 0,
    radiusMm: 0,
  };
}

export function newLine(xMm: number, yMm: number, z: number): LineElement {
  return {
    id: nextElementId(),
    type: "line",
    xMm,
    yMm,
    wMm: 40,
    hMm: 2,
    z,
    direction: "horizontal",
    color: "#111111",
    widthMm: 0.4,
    dash: "solid",
  };
}

/** A human name for an element, for the layers list and the inspector. */
export function elementLabel(
  element: IdCardElement,
  labelForToken: (token?: string) => string,
  shapeLabel: (name: string) => string,
): string {
  if (element.type === "line") return "Line";
  if (element.type === "rect") return shapeLabel(element.shape);
  if (element.type === "text" && !element.token) {
    return element.staticText?.slice(0, 30) || "Text";
  }
  return labelForToken((element as { token?: string }).token);
}

/**
 * Pulls every element back inside a resized card.
 *
 * Returns the new elements and how many moved, because a silent reflow is
 * exactly the kind of change that is noticed at the printer rather than on
 * screen.
 */
export function clampToCard(
  layout: IdCardLayout,
  widthMm: number,
  heightMm: number,
): { layout: IdCardLayout; moved: number } {
  let moved = 0;
  const fixSide = (side: IdCardSide): IdCardSide => ({
    ...side,
    elements: side.elements.map((element) => {
      const wMm = Math.min(element.wMm, widthMm);
      const hMm = Math.min(element.hMm, heightMm);
      const xMm = clamp(element.xMm, 0, widthMm - wMm);
      const yMm = clamp(element.yMm, 0, heightMm - hMm);
      if (wMm !== element.wMm || hMm !== element.hMm || xMm !== element.xMm || yMm !== element.yMm) {
        moved += 1;
        return { ...element, xMm, yMm, wMm, hMm };
      }
      return element;
    }),
  });

  return {
    layout: {
      ...layout,
      card: { widthMm, heightMm },
      sides: { front: fixSide(layout.sides.front), back: fixSide(layout.sides.back) },
    },
    moved,
  };
}
