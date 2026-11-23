"use client";

import * as React from "react";
import { Image as ImageIcon, QrCode } from "lucide-react";

import { fillToCss, type IdCardElement, type IdCardShape } from "./types";

/**
 * How one element looks on the canvas.
 *
 * A shape is drawn as an SVG using the path the SERVER served, with
 * `viewBox="0 0 1 1"` and `preserveAspectRatio="none"` - the same unit-square
 * path the PDF renderer scales. One geometry, two renderers, so what you drag
 * is what prints.
 *
 * A gradient inside an SVG would need a `<defs>` entry per element, so shapes
 * paint the gradient as a CSS background on a wrapper and use the SVG purely
 * as a clip path. That keeps one code path for every shape, rectangles
 * included.
 */
export function ElementPreview({
  element,
  pxPerMm,
  shapes,
  sampleFor,
  labelFor,
}: {
  element: IdCardElement;
  pxPerMm: number;
  shapes: IdCardShape[];
  sampleFor: (token?: string) => string;
  labelFor: (token?: string) => string;
}) {
  if (element.type === "rect") {
    const path = shapes.find((s) => s.name === element.shape)?.path;
    const isPlainRect = element.shape === "rect" || !path;
    // A unique id per element, so two shapes never share a clip path.
    const clipId = `clip-${element.id}`;

    if (isPlainRect) {
      return (
        <div
          className="size-full"
          style={{
            background: fillToCss(element.fill),
            border: element.borderColor
              ? `${Math.max(1, element.borderWidthMm * pxPerMm)}px solid ${element.borderColor}`
              : undefined,
            borderRadius: element.radiusMm * pxPerMm,
          }}
        />
      );
    }

    return (
      <div className="relative size-full">
        <svg className="absolute size-0" aria-hidden>
          <defs>
            <clipPath id={clipId} clipPathUnits="objectBoundingBox">
              <path d={path} />
            </clipPath>
          </defs>
        </svg>
        <div
          className="size-full"
          style={{
            background: fillToCss(element.fill),
            clipPath: `url(#${clipId})`,
          }}
        />
        {element.borderColor && (
          <svg
            className="absolute inset-0 size-full"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              d={path}
              fill="none"
              stroke={element.borderColor}
              // Non-scaling so a 0.2mm border does not stretch with the box.
              strokeWidth={Math.max(1, element.borderWidthMm * pxPerMm)}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>
    );
  }

  if (element.type === "line") {
    const [x1, y1, x2, y2] =
      element.direction === "horizontal"
        ? [0, 0.5, 1, 0.5]
        : element.direction === "vertical"
          ? [0.5, 0, 0.5, 1]
          : [0, 0, 1, 1];
    const width = Math.max(1, element.widthMm * pxPerMm);
    return (
      <svg
        className="size-full overflow-visible"
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        aria-hidden
      >
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={element.color}
          strokeWidth={width}
          vectorEffect="non-scaling-stroke"
          strokeDasharray={
            element.dash === "dashed"
              ? `${width * 3} ${width * 2}`
              : element.dash === "dotted"
                ? `${width} ${width * 1.5}`
                : undefined
          }
          strokeLinecap={element.dash === "dotted" ? "round" : "butt"}
        />
      </svg>
    );
  }

  if (element.type === "qr") {
    return (
      <div className="flex size-full items-center justify-center bg-foreground/10 text-muted-foreground">
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

  // Text. The SAMPLE value, not the token: a Tamil name is wider than
  // {{memberName}}, and previewing the token produces cards that overflow on
  // the first print run.
  const value = element.token ? sampleFor(element.token) : (element.staticText ?? "");
  return (
    <div
      className="size-full overflow-hidden leading-tight"
      style={{
        // Points to canvas pixels: 1pt is 25.4/72 mm, and the canvas draws
        // `pxPerMm` pixels per mm. Going via CSS's 96dpi would be wrong here -
        // the canvas is not at 96dpi - and made preview text noticeably
        // smaller than it prints.
        fontSize: element.fontSize * (25.4 / 72) * pxPerMm,
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
