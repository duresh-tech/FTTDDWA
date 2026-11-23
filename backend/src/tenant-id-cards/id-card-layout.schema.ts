import { z } from 'zod';

/**
 * The shape of a template's `layout` column.
 *
 * Validated here, on write, rather than trusted by the renderer. A layout is
 * JSON in a Text column, so without this the first bad shape would surface as
 * a crash halfway through generating somebody's card - and in a bulk run, part
 * way through a few hundred of them.
 *
 * **Every measurement is in MILLIMETRES.** A card is a physical object printed
 * at a fixed size; pixels are a property of whatever screen drew it. Storing
 * pixels is how a layout ends up pixel-perfect on the designer's monitor and
 * wrong on the printer. Font sizes are the one exception and are in points,
 * because that is what type is measured in and what PDF expects.
 */

const mm = z.number().min(0).max(1000);
const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a hex colour');

const baseElement = {
  id: z.string().min(1).max(64),
  xMm: mm,
  yMm: mm,
  wMm: mm,
  hMm: mm,
  /** Paint order. Equal values fall back to array order. */
  z: z.number().int().min(0).max(999).default(0),
};

/**
 * A text block.
 *
 * There is deliberately no `script` field. Noto Sans Tamil contains no Latin
 * letters, so a line like "Member: ரமேஷ்" cannot be drawn with one font at
 * all - the renderer splits text into same-script runs and picks the font per
 * run. Asking the designer to label a block "Tamil" or "Latin" would both
 * duplicate that decision and get it wrong on mixed content.
 */
const textElement = z.object({
  ...baseElement,
  type: z.literal('text'),
  /** Bound to a field. Mutually exclusive with staticText in practice. */
  token: z.string().max(100).optional(),
  staticText: z.string().max(500).optional(),
  fontSize: z.number().min(3).max(96).default(10),
  bold: z.boolean().default(false),
  color: hexColor.default('#000000'),
  align: z.enum(['left', 'center', 'right']).default('left'),
  lineHeight: z.number().min(0.8).max(3).default(1.2),
  /** Clipped with an ellipsis past this. A long Tamil name runs off a card. */
  maxLines: z.number().int().min(1).max(10).default(1),
});

const imageElement = z.object({
  ...baseElement,
  type: z.literal('image'),
  token: z.string().max(100).optional(),
  /** A storage path, for an image that is not bound to a field. */
  staticPath: z.string().max(255).optional(),
  fit: z.enum(['contain', 'cover']).default('contain'),
});

const qrElement = z.object({
  ...baseElement,
  type: z.literal('qr'),
  token: z.string().max(100).default('member.qr'),
});

const rectElement = z.object({
  ...baseElement,
  type: z.literal('rect'),
  fill: hexColor.nullable().default(null),
  borderColor: hexColor.nullable().default(null),
  borderWidthMm: z.number().min(0).max(20).default(0),
  radiusMm: z.number().min(0).max(50).default(0),
});

export const IdCardElementSchema = z.discriminatedUnion('type', [
  textElement,
  imageElement,
  qrElement,
  rectElement,
]);

const sideSchema = z.object({
  background: z.object({
    color: hexColor.default('#ffffff'),
    imagePath: z.string().max(255).nullable().default(null),
  }),
  elements: z.array(IdCardElementSchema).max(100),
});

export const IdCardLayoutSchema = z.object({
  /** Bumped only if the shape changes incompatibly; the renderer may branch. */
  version: z.literal(1),
  card: z.object({
    widthMm: z.number().min(20).max(500),
    heightMm: z.number().min(20).max(500),
  }),
  sides: z.object({
    front: sideSchema,
    /** A back side always exists in the JSON; an empty one emits no page. */
    back: sideSchema,
  }),
});

export type IdCardLayout = z.infer<typeof IdCardLayoutSchema>;
export type IdCardElement = z.infer<typeof IdCardElementSchema>;
export type IdCardSide = z.infer<typeof sideSchema>;

/** CR80, the standard ID card, and the default for a new template. */
export const CARD_WIDTH_MM = 85.6;
export const CARD_HEIGHT_MM = 54;

export function emptyLayout(
  widthMm = CARD_WIDTH_MM,
  heightMm = CARD_HEIGHT_MM,
): IdCardLayout {
  const side = () => ({
    background: { color: '#ffffff', imagePath: null },
    elements: [],
  });
  return {
    version: 1,
    card: { widthMm, heightMm },
    sides: { front: side(), back: side() },
  };
}

/**
 * Parses a stored layout, or null when it cannot be read.
 *
 * Null rather than a throw because this runs on the READ path too, and a row
 * that somehow holds bad JSON should render as an empty design the operator
 * can fix, not as a 500 on the list screen.
 */
export function parseLayout(raw: string): IdCardLayout | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = IdCardLayoutSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
