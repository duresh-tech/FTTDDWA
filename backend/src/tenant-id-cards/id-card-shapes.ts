/**
 * Every shape the designer offers, as an SVG path in a UNIT SQUARE.
 *
 * One definition, two renderers. The canvas draws the path with
 * `viewBox="0 0 1 1" preserveAspectRatio="none"` and the PDF renderer with
 * `doc.scale()` + `doc.path()`, so both get non-uniform scaling for free and
 * the geometry itself is written once.
 *
 * It is served by `GET …/id-card-templates/shapes` rather than copied into the
 * console, the same way the field catalogue is: the server owns the list, so
 * adding a shape is a change to THIS FILE and nothing else. A second copy in
 * the console would be a second copy to keep in step.
 *
 * Only `M L H V C Z` are used. pdfkit parses arcs too, but béziers avoid
 * depending on its arc implementation for something as visible as a circle.
 */
export interface IdCardShape {
  name: string;
  label: string;
  group: string;
  /** SVG path data inside the box (0,0) to (1,1). */
  path: string;
}

/** Bézier circle constant, scaled to a 0.5 radius. */
const K = 0.27614;

export const ID_CARD_SHAPES: IdCardShape[] = [
  { name: 'rect', label: 'Rectangle', group: 'Basic', path: 'M0,0 H1 V1 H0 Z' },
  {
    name: 'ellipse',
    label: 'Ellipse',
    group: 'Basic',
    path:
      `M0.5,0 C${0.5 + K},0 1,${0.5 - K} 1,0.5 ` +
      `C1,${0.5 + K} ${0.5 + K},1 0.5,1 ` +
      `C${0.5 - K},1 0,${0.5 + K} 0,0.5 ` +
      `C0,${0.5 - K} ${0.5 - K},0 0.5,0 Z`,
  },
  { name: 'triangle', label: 'Triangle', group: 'Basic', path: 'M0.5,0 L1,1 L0,1 Z' },

  { name: 'diamond', label: 'Diamond', group: 'Decorative', path: 'M0.5,0 L1,0.5 L0.5,1 L0,0.5 Z' },
  {
    name: 'pentagon',
    label: 'Pentagon',
    group: 'Decorative',
    path: 'M0.5,0 L0.9755,0.3455 L0.7939,0.9045 L0.2061,0.9045 L0.0245,0.3455 Z',
  },
  {
    name: 'hexagon',
    label: 'Hexagon',
    group: 'Decorative',
    path: 'M0.25,0 L0.75,0 L1,0.5 L0.75,1 L0.25,1 L0,0.5 Z',
  },
  {
    name: 'star',
    label: 'Star',
    group: 'Decorative',
    path:
      'M0.5,0 L0.6123,0.3455 L0.9755,0.3455 L0.6817,0.559 L0.7939,0.9045 ' +
      'L0.5,0.691 L0.2061,0.9045 L0.3183,0.559 L0.0245,0.3455 L0.3877,0.3455 Z',
  },

  {
    name: 'arrow',
    label: 'Arrow',
    group: 'Arrows',
    path: 'M0,0.3 H0.6 V0 L1,0.5 L0.6,1 V0.7 H0 Z',
  },
  {
    name: 'chevron',
    label: 'Chevron',
    group: 'Arrows',
    path: 'M0,0 L0.6,0 L1,0.5 L0.6,1 L0,1 L0.4,0.5 Z',
  },
];

export const ID_CARD_SHAPE_NAMES = ID_CARD_SHAPES.map((s) => s.name) as [
  string,
  ...string[],
];

export function shapePath(name: string): string {
  // Falls back to a rectangle rather than throwing: a layout may name a shape
  // this build no longer has, and one card element is not worth a 500.
  return (ID_CARD_SHAPES.find((s) => s.name === name) ?? ID_CARD_SHAPES[0]).path;
}

/**
 * Rewrites a unit-square path into a box, by transforming its COORDINATES.
 *
 * Not by scaling the canvas. PDF requires path-construction operators to be
 * followed directly by a painting operator, so inserting a `cm` between
 * `doc.path()` and `doc.fill()` produces a content stream that renderers
 * quietly discard - the shape simply does not appear, with no error anywhere.
 * Transforming the numbers avoids that, and also keeps stroke widths uniform
 * and gradient coordinates in page space.
 *
 * Only the operators the table above uses are handled: M, L, H, V, C, Z.
 */
export function scaleUnitPath(
  path: string,
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  const fx = (value: number) => x + value * w;
  const fy = (value: number) => y + value * h;

  // Split into [command, ...numbers] runs.
  const tokens = path.match(/[MLHVCZ][^MLHVCZ]*/gi) ?? [];
  return tokens
    .map((token) => {
      const command = token[0].toUpperCase();
      if (command === 'Z') return 'Z';
      const nums = (token.slice(1).match(/-?\d*\.?\d+/g) ?? []).map(Number);
      if (command === 'H') return `H ${nums.map(fx).join(' ')}`;
      if (command === 'V') return `V ${nums.map(fy).join(' ')}`;
      // M, L and C are all sequences of x,y pairs.
      const mapped = nums.map((value, index) =>
        index % 2 === 0 ? fx(value) : fy(value),
      );
      return `${command} ${mapped.join(' ')}`;
    })
    .join(' ');
}
