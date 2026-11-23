import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { StorageService } from '../storage/storage.service';
import {
  IdCardContext,
  resolveToken,
} from './id-card-fields';
import { Fill, IdCardElement, IdCardLayout, IdCardSide } from './id-card-layout.schema';
import { scaleUnitPath, shapePath } from './id-card-shapes';

/**
 * The ONLY file that knows about pdfkit.
 *
 * Everything else - the template JSON, the field registry, the models, the
 * storage, the designer - is renderer-agnostic, so swapping in a different
 * engine is a change to this file alone.
 *
 * Tamil is the reason any of this is careful. Its vowel signs reorder around
 * the base consonant and clusters form ligatures, which needs real OpenType
 * shaping. pdfkit lays out through fontkit, whose Indic shaper is a port of
 * HarfBuzz's, and that was verified against this font before the feature was
 * built: க + ொ emits [ெ, க, ா], and ஸ்ரீ collapses four codepoints into one
 * glyph.
 */

/** PDF user space is 72 points to the inch. */
const PT_PER_MM = 72 / 25.4;
const mmToPt = (mm: number) => mm * PT_PER_MM;

const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts');

type Script = 'latin' | 'tamil';

/**
 * The Tamil block, plus the zero-width joiners that belong to a Tamil run
 * rather than to the Latin text around them.
 */
const TAMIL_RE = /[஀-௿‌‍]/;

/** Neutral characters join whatever run precedes them, so a line of mixed
 *  text does not fragment into one run per space. */
const NEUTRAL_RE = /[\s\d.,:;/()[\]{}+_@&#%*=<>|~^$!?'"`\\-]/;

interface TextRun {
  script: Script;
  text: string;
}

/**
 * Splits a string into same-script runs.
 *
 * Required, not an optimisation: **Noto Sans Tamil contains no Latin
 * letters.** Drawing "Member: ரமேஷ்" with the Tamil font renders the Latin
 * half as .notdef boxes, and drawing it with the Latin font loses the Tamil.
 * No single bundled font covers both, so the font is chosen per run.
 */
export function splitScriptRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  for (const ch of text) {
    const script: Script = TAMIL_RE.test(ch) ? 'tamil' : 'latin';
    const last = runs[runs.length - 1];
    if (last && (last.script === script || NEUTRAL_RE.test(ch))) last.text += ch;
    else runs.push({ script, text: ch });
  }
  return runs;
}

@Injectable()
export class IdCardRendererService {
  private readonly logger = new Logger(IdCardRendererService.name);

  constructor(private readonly storage: StorageService) {}

  private fontPath(script: Script, bold: boolean): string {
    const family = script === 'tamil' ? 'NotoSansTamil' : 'NotoSans';
    return path.join(FONT_DIR, `${family}-${bold ? 'Bold' : 'Regular'}.ttf`);
  }

  /**
   * Renders one or more cards into a single PDF.
   *
   * A bulk run is the same call with many contexts: one document, two pages
   * per member, which is what a print shop wants. A single card is just the
   * one-element case.
   */
  async render(layout: IdCardLayout, contexts: IdCardContext[]): Promise<Buffer> {
    const widthPt = mmToPt(layout.card.widthMm);
    const heightPt = mmToPt(layout.card.heightMm);

    const doc = new PDFDocument({
      size: [widthPt, heightPt],
      margin: 0,
      autoFirstPage: false,
      info: { Title: 'Membership ID card', Producer: 'FTTDDWA' },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<void>((resolve) => doc.on('end', () => resolve()));

    for (const ctx of contexts) {
      await this.drawSide(doc, layout, layout.sides.front, ctx, true);
      // An untouched back side would otherwise print a blank page per member,
      // which a print shop charges for.
      if (layout.sides.back.elements.length > 0) {
        await this.drawSide(doc, layout, layout.sides.back, ctx, true);
      }
    }

    doc.end();
    await done;
    return Buffer.concat(chunks);
  }

  private async drawSide(
    doc: PDFKit.PDFDocument,
    layout: IdCardLayout,
    side: IdCardSide,
    ctx: IdCardContext,
    newPage: boolean,
  ): Promise<void> {
    const widthPt = mmToPt(layout.card.widthMm);
    const heightPt = mmToPt(layout.card.heightMm);
    if (newPage) doc.addPage({ size: [widthPt, heightPt], margin: 0 });

    doc
      .rect(0, 0, widthPt, heightPt)
      .fill(this.paint(doc, side.background.color, 0, 0, widthPt, heightPt));
    if (side.background.imagePath) {
      await this.drawImageAt(doc, side.background.imagePath, 0, 0, widthPt, heightPt, 'cover');
    }

    // Painted in z order, with array order as the tiebreak, so the designer's
    // "bring to front" means the same thing here as on the canvas. Hidden
    // elements are dropped HERE rather than only on the canvas, or the PDF
    // would disagree with the preview the design was approved from.
    const ordered = [...side.elements]
      .filter((element) => !element.hidden)
      .sort((a, b) => a.z - b.z);
    for (const element of ordered) {
      try {
        await this.drawElement(doc, element, ctx);
      } catch (error) {
        // One bad element must not cost the whole card, let alone a bulk run.
        this.logger.warn(
          `Skipped ${element.type} element ${element.id}: ${(error as Error).message}`,
        );
      }
    }
  }

  private async drawElement(
    doc: PDFKit.PDFDocument,
    element: IdCardElement,
    ctx: IdCardContext,
  ): Promise<void> {
    const x = mmToPt(element.xMm);
    const y = mmToPt(element.yMm);
    const w = mmToPt(element.wMm);
    const h = mmToPt(element.hMm);

    switch (element.type) {
      case 'rect': {
        doc.save();
        this.traceShape(doc, element.shape, x, y, w, h, mmToPt(element.radiusMm));
        const fill = element.fill
          ? this.paint(doc, element.fill, x, y, w, h)
          : null;
        if (fill && element.borderColor) {
          doc.lineWidth(mmToPt(element.borderWidthMm)).fillAndStroke(fill, element.borderColor);
        } else if (fill) {
          doc.fill(fill);
        } else if (element.borderColor) {
          doc.lineWidth(mmToPt(element.borderWidthMm)).stroke(element.borderColor);
        }
        doc.restore();
        return;
      }

      case 'line': {
        // Drawn inside the element's own box: the horizontal or vertical
        // midline, or corner to corner. Keeping the box model is what makes
        // dragging and resizing a line behave like everything else.
        const [x1, y1, x2, y2] =
          element.direction === 'horizontal'
            ? [x, y + h / 2, x + w, y + h / 2]
            : element.direction === 'vertical'
              ? [x + w / 2, y, x + w / 2, y + h]
              : [x, y, x + w, y + h];
        const stroke = mmToPt(element.widthMm);
        doc.save().lineWidth(stroke).strokeColor(element.color);
        if (element.dash === 'dashed') doc.dash(stroke * 3, { space: stroke * 2 });
        else if (element.dash === 'dotted') doc.dash(stroke, { space: stroke * 1.5 });
        doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
        doc.undash().restore();
        return;
      }

      case 'text': {
        const value = element.token
          ? resolveToken(element.token, ctx)
          : (element.staticText ?? '');
        if (!value) return;
        this.drawText(doc, value, element, x, y, w, h);
        return;
      }

      case 'image': {
        const storagePath = element.token
          ? resolveToken(element.token, ctx)
          : (element.staticPath ?? '');
        if (!storagePath) return;
        await this.drawImageAt(doc, storagePath, x, y, w, h, element.fit);
        return;
      }

      case 'qr': {
        const value = resolveToken(element.token, ctx);
        if (!value) return;
        // 600px is well past what a 15mm square needs at print resolution,
        // and costs nothing worth measuring.
        const png = await QRCode.toBuffer(value, { margin: 0, width: 600 });
        doc.image(png, x, y, { width: w, height: h });
        return;
      }
    }
  }

  /**
   * Traces a shape's outline into the current path, ready to fill or stroke.
   *
   * A rectangle is drawn directly so `radiusMm` can use pdfkit's own rounded
   * rect. Every other shape comes from the unit-square table, with its
   * COORDINATES scaled into the box - never by transforming the canvas.
   *
   * That distinction is not stylistic. PDF requires path construction to be
   * followed directly by a painting operator, so changing the CTM between
   * `path()` and `fill()` yields a stream renderers silently discard: the
   * shape just does not appear, with nothing logged anywhere. Scaling the
   * numbers also keeps stroke widths uniform and gradients in page space.
   */
  private traceShape(
    doc: PDFKit.PDFDocument,
    shape: string,
    x: number,
    y: number,
    w: number,
    h: number,
    radiusPt: number,
  ): void {
    if (shape === 'rect') {
      if (radiusPt > 0) doc.roundedRect(x, y, w, h, radiusPt);
      else doc.rect(x, y, w, h);
      return;
    }
    doc.path(scaleUnitPath(shapePath(shape), x, y, w, h));
  }

  /**
   * Turns a Fill into something pdfkit can fill with: a colour string, or a
   * gradient object anchored to the element's own box.
   *
   * A gradient is positioned per element rather than per page, so the same
   * fill reads the same whether the shape is a 5mm dot or the whole card.
   */
  private paint(
    doc: PDFKit.PDFDocument,
    fill: Fill,
    x: number,
    y: number,
    w: number,
    h: number,
  ): string | PDFKit.PDFGradient {
    if (typeof fill === 'string') return fill;

    const gradient =
      fill.type === 'radial'
        ? doc.radialGradient(
            x + w / 2,
            y + h / 2,
            0,
            x + w / 2,
            y + h / 2,
            Math.max(w, h) / 2,
          )
        : (() => {
            // The angle is measured clockwise from "left to right", and the
            // line is taken across the box's centre so 0deg spans its full
            // width and 90deg its full height.
            const radians = (fill.angle * Math.PI) / 180;
            const dx = (Math.cos(radians) * w) / 2;
            const dy = (Math.sin(radians) * h) / 2;
            const cx = x + w / 2;
            const cy = y + h / 2;
            return doc.linearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
          })();

    for (const stop of fill.stops) gradient.stop(stop.offset, stop.color);
    return gradient;
  }

  /**
   * Draws a text block, one script run at a time.
   *
   * Lines are broken by hand rather than through pdfkit's own wrapping,
   * because a line may span several fonts and pdfkit measures against the one
   * currently selected.
   */
  private drawText(
    doc: PDFKit.PDFDocument,
    value: string,
    element: Extract<IdCardElement, { type: 'text' }>,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const lines = this.wrap(doc, value, element, w);
    const lineHeightPt = element.fontSize * element.lineHeight;

    doc.fillColor(element.color);
    lines.forEach((line, index) => {
      const lineY = y + index * lineHeightPt;
      // Never draw past the block's own height; the designer sized it.
      if (lineY + element.fontSize > y + h + 0.5) return;

      const runs = splitScriptRuns(line);
      const lineWidth = runs.reduce((sum, run) => {
        doc.font(this.fontPath(run.script, element.bold)).fontSize(element.fontSize);
        return sum + doc.widthOfString(run.text);
      }, 0);

      let cursor = x;
      if (element.align === 'center') cursor = x + (w - lineWidth) / 2;
      else if (element.align === 'right') cursor = x + w - lineWidth;

      for (const run of runs) {
        doc.font(this.fontPath(run.script, element.bold)).fontSize(element.fontSize);
        doc.text(run.text, cursor, lineY, { lineBreak: false });
        cursor += doc.widthOfString(run.text);
      }
    });
  }

  /** Greedy word wrap, measured run by run so mixed scripts measure right. */
  private wrap(
    doc: PDFKit.PDFDocument,
    value: string,
    element: Extract<IdCardElement, { type: 'text' }>,
    w: number,
  ): string[] {
    const measure = (text: string) =>
      splitScriptRuns(text).reduce((sum, run) => {
        doc.font(this.fontPath(run.script, element.bold)).fontSize(element.fontSize);
        return sum + doc.widthOfString(run.text);
      }, 0);

    const words = value.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && measure(candidate) > w) {
        lines.push(current);
        current = word;
        if (lines.length === element.maxLines) break;
      } else {
        current = candidate;
      }
    }
    if (current && lines.length < element.maxLines) lines.push(current);

    // Past maxLines the text is cut, with an ellipsis so the reader can see
    // that it was. A long Tamil name otherwise runs off an 85.6mm card.
    if (lines.length === element.maxLines) {
      const joined = lines.join(' ');
      const consumed = joined.split(/\s+/).length;
      if (consumed < words.length) {
        let last = lines[lines.length - 1];
        while (last.length > 1 && measure(`${last}…`) > w) last = last.slice(0, -1);
        lines[lines.length - 1] = `${last}…`;
      }
    }
    return lines;
  }

  /**
   * Draws a stored image, or nothing.
   *
   * A missing file is a warning and not an error on purpose: one member
   * without a passport photo must not fail a run of several hundred cards,
   * and a card without a photo is still a usable card.
   */
  private async drawImageAt(
    doc: PDFKit.PDFDocument,
    storagePath: string,
    x: number,
    y: number,
    w: number,
    h: number,
    fit: 'contain' | 'cover',
  ): Promise<void> {
    const buffer = await this.storage.readBuffer(storagePath, 'public');
    if (!buffer) {
      this.logger.warn(`ID card image not found in storage: ${storagePath}`);
      return;
    }
    try {
      if (fit === 'cover') {
        doc.save().rect(x, y, w, h).clip();
        doc.image(buffer, x, y, { cover: [w, h], align: 'center', valign: 'center' });
        doc.restore();
      } else {
        doc.image(buffer, x, y, { fit: [w, h], align: 'center', valign: 'center' });
      }
    } catch (error) {
      // pdfkit reads only JPEG and PNG. Uploads are not MIME-checked, so a
      // WebP or SVG logo reaches us and must not take the card down.
      this.logger.warn(
        `Unsupported image for ID card (${storagePath}): ${(error as Error).message}`,
      );
    }
  }
}
