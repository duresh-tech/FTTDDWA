import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

/**
 * Stamps a card's status across its pages, at DOWNLOAD time.
 *
 * Why stamp rather than re-render: the stored PDF is the evidence of what was
 * actually in circulation. Rebuilding the card from today's template and
 * today's member record would quietly change history - a name corrected last
 * month would appear on a card that was printed before the correction. So the
 * stored bytes are loaded and drawn over, never regenerated and never written
 * back.
 *
 * This is the only file that touches `pdf-lib`. The renderer stays pdfkit-only:
 * pdfkit writes PDFs and cannot open one, which is the whole reason a second
 * library is here at all.
 */

/** What a card is stamped with, or null when it is served clean. */
export type WatermarkReason = 'SUSPENDED' | 'REVOKED' | 'EXPIRED';

/**
 * Decides whether a card needs a stamp, and which one.
 *
 * EXPIRED is not a stored status - a card past its date still reads ACTIVE,
 * because expiry is derived from `expiryAt` and the clock. That makes it the
 * case most likely to be missed and the most useful to stamp: an expired card
 * in somebody's hand looks exactly like a valid one.
 */
export function watermarkFor(
  status: string,
  expired: boolean,
): WatermarkReason | null {
  if (status === 'SUSPENDED') return 'SUSPENDED';
  if (status === 'REVOKED') return 'REVOKED';
  if (expired) return 'EXPIRED';
  return null;
}

/**
 * Returns the PDF with `reason` drawn diagonally across every page.
 *
 * The text is ASCII, so it uses a standard PDF font: none of the Tamil shaping
 * the card renderer needs, and nothing to embed.
 *
 * On any failure the ORIGINAL buffer is returned rather than throwing. A
 * corrupt or unusual PDF should still download - refusing to serve somebody
 * their own card because a decoration could not be applied is the worse
 * outcome, and the record already says the card is not valid.
 */
export async function applyWatermark(
  pdf: Buffer,
  reason: WatermarkReason,
): Promise<Buffer> {
  try {
    const doc = await PDFDocument.load(pdf);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);

    for (const page of doc.getPages()) {
      const { width, height } = page.getSize();

      // Sized to the page rather than fixed: a card is ~86mm wide and a bulk
      // sheet is A4, and one hard-coded size would either overflow the card or
      // vanish on the sheet.
      //
      // MEASURED, and against the right limit.
      //
      // Two wrong answers came before this one. Sizing from character count
      // overflowed, because glyph widths vary and "SUSPENDED" is nothing like
      // nine average characters. Sizing to the DIAGONAL overflowed too, which
      // is the subtler error: text rotated 45 degrees occupies a bounding box
      // of (W + H) / sqrt(2) in BOTH axes, so what it has to fit inside is the
      // page's SHORTER side - on an 86x54mm card that is the height, nowhere
      // near the diagonal.
      //
      // Width and height both scale linearly with font size, so measuring once
      // at a trial size gives the exact scale factor for any word on any page.
      // `descender: false` because these words are ALL CAPS and have no
      // descender. Including it overstates the height, which both shrinks the
      // text and - because the same figure positions it - pushes it off centre
      // by half the error. That was worth two points of overflow on the
      // shorter word.
      const capHeight = (s: number) => font.heightAtSize(s, { descender: false });

      const limit = Math.min(width, height) * Math.SQRT2 * 0.88;
      const trial = 100;
      const trialSpan = font.widthOfTextAtSize(reason, trial) + capHeight(trial);
      const size = trialSpan > 0 ? (trial * limit) / trialSpan : trial;

      const textWidth = font.widthOfTextAtSize(reason, size);
      const textHeight = capHeight(size);

      // Centred, then rotated about that centre. The offsets walk back along
      // the 45-degree baseline so the text is centred ON the diagonal rather
      // than starting at the middle of the page.
      const radians = Math.PI / 4;
      const x = width / 2 - (textWidth / 2) * Math.cos(radians) + (textHeight / 2) * Math.sin(radians);
      const y = height / 2 - (textWidth / 2) * Math.sin(radians) - (textHeight / 2) * Math.cos(radians);

      page.drawText(reason, {
        x,
        y,
        size,
        font,
        rotate: degrees(45),
        color: rgb(0.75, 0.1, 0.1),
        // Legible over the card's own content without hiding it: the point is
        // that the card reads as void, not that it becomes unreadable.
        opacity: 0.28,
      });
    }

    return Buffer.from(await doc.save());
  } catch {
    return pdf;
  }
}
