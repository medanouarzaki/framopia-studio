/**
 * What colour the card frame around a generated image has to be.
 *
 * The user built `vitasilk` and reported that some images disappear: the frame
 * and the picture's own edge are the same value, so there is nothing to see. It
 * is not a per-image accident — every candidate in the corpus is generated
 * against the mode's own dark palette, so a dark frame is invisible on all of
 * them and a light frame is visible on all of them.
 *
 * The frame colour is therefore **derived from the picture**, not set by hand:
 * measure the image's outermost ring (the CV sidecar's `edge_luminance` task),
 * and take whichever palette colour separates from it best.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** WCAG 2.1 relative luminance from 8-bit sRGB. Mirrors `edge_luminance.py`. */
export function relativeLuminance(colour: Rgb): number {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(colour.r) + 0.7152 * channel(colour.g) + 0.0722 * channel(colour.b);
}

/** WCAG 2.1 contrast ratio between two luminances, 1:1 to 21:1. */
export function contrastRatio(a: number, b: number): number {
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The separation a frame must reach to read as a frame.
 *
 * **3.0:1, WCAG 2.1 success criterion 1.4.11's minimum for a non-text visual
 * boundary.** Taken from the standard rather than chosen here, because a border
 * around a picture is exactly the thing that criterion is about and inventing a
 * number would be worse than adopting one that was measured against human
 * vision.
 */
export const MIN_IMAGE_EDGE_CONTRAST = 3;

export interface CardFrame {
  /** Which palette role the frame takes. */
  role: string;
  colour: Rgb;
  /** Against the picture's own edge. */
  contrast: number;
  /** False when no palette colour separates enough; the best is used anyway. */
  meetsMinimum: boolean;
}

/**
 * Pick the frame colour for one image.
 *
 * Every palette role is a candidate, so a mode carrying a mid-tone accent can
 * win on an image the two extremes both lose. Ties break on role name, so the
 * choice is total and does not depend on object key order.
 *
 * When nothing reaches `MIN_IMAGE_EDGE_CONTRAST` the best is still returned and
 * `meetsMinimum` is false: a frame that is merely the best available is better
 * than no frame, and the caller reports it rather than the builder silently
 * settling.
 */
export function cardFrameColour(options: {
  edgeLuminance: number;
  palette: Record<string, Rgb>;
}): CardFrame {
  const entries = Object.entries(options.palette);
  if (entries.length === 0) throw new Error('cardFrameColour: the palette is empty');

  const ranked = entries
    .map(([role, colour]) => ({
      role,
      colour,
      contrast: contrastRatio(relativeLuminance(colour), options.edgeLuminance),
      meetsMinimum: false,
    }))
    .sort((a, b) => b.contrast - a.contrast || a.role.localeCompare(b.role));

  const best = ranked[0] as CardFrame;
  return { ...best, meetsMinimum: best.contrast >= MIN_IMAGE_EDGE_CONTRAST };
}

/** `#RRGGBB` as the mode files write it. */
export function parseHexColour(hex: string): Rgb {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (match?.[1] === undefined) throw new Error(`not a #RRGGBB colour: ${hex}`);
  const value = parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/** After Effects takes colour as three floats in 0..1. */
export function toAeColour(colour: Rgb): [number, number, number] {
  return [colour.r / 255, colour.g / 255, colour.b / 255];
}
