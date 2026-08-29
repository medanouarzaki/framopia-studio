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

export interface FrameReference {
  /** The luminance the frame has to differ from. */
  luminance: number;
  /** What was measured, for the report. */
  measured: 'the picture’s own edge' | 'the lit part of the subject';
}

/**
 * Which measurement the frame colour is chosen against, given how the slot
 * renders.
 *
 * **A whole picture meets the frame at its own outer ring.** That is what
 * session 25 measured and it is right for the eight of ten candidates that
 * render whole.
 *
 * **A cut-out has no ring.** Its surround is transparent — measured at alpha 0
 * across the whole ring on every cutout in the corpus — so what shows behind
 * the subject *is the frame*, and the ring reads as black only because dropping
 * an alpha channel makes it black. Choosing from that picked a light frame for
 * a subject whose lit half is nearly white, and the picture disappeared into
 * its own frame. What has to be told apart from the frame is the subject.
 */
export function frameReferenceLuminance(options: {
  rendersAsCutout: boolean;
  edgeLuminance: number;
  subjectLitLuminance: number | null;
}): FrameReference {
  if (options.rendersAsCutout && options.subjectLitLuminance !== null) {
    return {
      luminance: options.subjectLitLuminance,
      measured: 'the lit part of the subject',
    };
  }
  return { luminance: options.edgeLuminance, measured: 'the picture’s own edge' };
}

export interface CardColours {
  /**
   * The ground the subject sits on, when the picture does not bring one — a
   * cut-out. Null for a whole picture, which is its own fill.
   */
  fill: CardFrame | null;
  /** The card's border. */
  frame: CardFrame;
  /** True when every contrast the design needs reaches the minimum. */
  meetsMinimum: boolean;
  /** Said out loud when it does not, rather than quietly settling. */
  fallback: string | null;
}

/**
 * The two colours a framed picture needs, and why there are two.
 *
 * `img_float` has exactly two layers: the picture, and a card behind it that
 * shows as a 40 px border. **For a whole picture that reads as a frame** — the
 * border sits against the picture, and one colour choice is enough.
 *
 * **For a cut-out it does not.** The picture is transparent, so the card shows
 * through the whole square and the frame and the fill become the same layer;
 * the border cannot be seen because there is nothing else in the square. That
 * is what the user saw: a dark red square with a bottle on it and no border,
 * beside four slots with a clear white frame. Choosing a frame that contrasts
 * with the subject — Block 8 session 34 — satisfied one constraint of two.
 *
 * So a cut-out is given a ground of its own, and two contrasts have to hold:
 * the **subject against the fill**, and the **frame against the fill**. Both
 * are WCAG 2.1's 3:1 for a non-text boundary, unchanged. The pair is chosen to
 * maximise the *smaller* of the two, because a design with one comfortable
 * contrast and one that fails is a design that fails.
 */
export function cardColours(options: {
  rendersAsCutout: boolean;
  edgeLuminance: number;
  subjectLitLuminance: number | null;
  palette: Record<string, Rgb>;
}): CardColours {
  const reference = frameReferenceLuminance(options);

  if (!options.rendersAsCutout || options.subjectLitLuminance === null) {
    const frame = cardFrameColour({ edgeLuminance: reference.luminance, palette: options.palette });
    return {
      fill: null,
      frame,
      meetsMinimum: frame.meetsMinimum,
      fallback: frame.meetsMinimum
        ? null
        : 'no colour in the palette separates from this picture; the closest is used',
    };
  }

  const entries = Object.entries(options.palette);
  if (entries.length < 2) throw new Error('cardColours: two colours are needed for a cut-out');

  let best: { fill: CardFrame; frame: CardFrame; worst: number } | null = null;
  for (const [fillRole, fillColour] of entries) {
    const fillLuminance = relativeLuminance(fillColour);
    const subject = contrastRatio(fillLuminance, options.subjectLitLuminance);
    for (const [frameRole, frameColour] of entries) {
      if (frameRole === fillRole) continue;
      const border = contrastRatio(relativeLuminance(frameColour), fillLuminance);
      const worst = Math.min(subject, border);
      // Ties break on role name so the choice is total and does not depend on
      // the order the palette happens to be written in.
      const better =
        best === null ||
        worst > best.worst + 1e-9 ||
        (Math.abs(worst - best.worst) <= 1e-9 &&
          `${fillRole}/${frameRole}`.localeCompare(`${best.fill.role}/${best.frame.role}`) < 0);
      if (!better) continue;
      best = {
        fill: { role: fillRole, colour: fillColour, contrast: subject, meetsMinimum: subject >= MIN_IMAGE_EDGE_CONTRAST },
        frame: { role: frameRole, colour: frameColour, contrast: border, meetsMinimum: border >= MIN_IMAGE_EDGE_CONTRAST },
        worst,
      };
    }
  }

  const chosen = best as { fill: CardFrame; frame: CardFrame; worst: number };
  const meetsMinimum = chosen.worst >= MIN_IMAGE_EDGE_CONTRAST;
  return {
    fill: chosen.fill,
    frame: chosen.frame,
    meetsMinimum,
    fallback: meetsMinimum
      ? null
      : `no pair in the palette gives both the subject and the border ${MIN_IMAGE_EDGE_CONTRAST}:1; ` +
        `the best available is ${chosen.worst.toFixed(2)}:1`,
  };
}
