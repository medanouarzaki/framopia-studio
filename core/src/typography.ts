/**
 * Global subtitle typography, PROJECT_SPEC §5.
 *
 * §5 puts subtitle position and base style outside the mode — "Global (not
 * per-mode): subtitle position, subtitle base style, SFX set" — and names the
 * Latin face directly. The Arabic companion was left as `TBD_ARABIC_FONT` to
 * be "collected at the start of Block 6 and recorded here by amendment";
 * Block 6 session 3 collected it and the spec is amended alongside this file.
 *
 * Every number here was measured off a delivered reel by the user, not chosen.
 * The comp they were read from runs its text layers at 90% scale and read
 * 381.1 / 472.1 / 359; these are the same sizes at 100%, which is what the
 * templates are authored at.
 */

/** Latin face. Named directly by PROJECT_SPEC §5. */
export const LATIN_FONT = 'Inter Semi-Bold';

/** Arabic face, the §5 amendment this session records. */
export const ARABIC_FONT = 'Almarai Bold';

/**
 * Almarai runs smaller than Inter at the same nominal size, so the Arabic face
 * is set larger to match it optically. Measured by the user, not derived from
 * the metrics: it is a judgement about how the two faces read side by side.
 */
export const ARABIC_SIZE_RATIO = 1.07;

export const SUBTITLE_FONT_SIZE = 343;
export const KEYWORD_FONT_SIZE = 425;

/** Baseline-to-baseline distance when either track wraps to a second line. */
export const LINE_SPACING = 323;

/**
 * Where the first baseline sits in the 2160x3840 frame. `y` is the **text
 * baseline**, not the top of the type: the layer's anchor point is 0,0 in the
 * source comp, so glyphs extend upward from it and descenders hang below.
 */
export const SUBTITLE_ANCHOR_X = 1080;
export const SUBTITLE_ANCHOR_BASELINE_Y = 2480.4;

/** Both tracks may wrap. The band below has to cover the second line. */
export const MAX_SUBTITLE_LINES = 2;

/**
 * Extra lines render **below** the first, which is what a point-text layer
 * anchored at 0,0 does in After Effects: the anchor is the first line's
 * baseline and subsequent lines descend by the leading. The band is built on
 * this and it is the one part of the geometry that is a reading of AE's
 * behaviour rather than a measurement — if the templates turn out to grow
 * upward instead, this flips and the band moves up by exactly LINE_SPACING.
 */
export const EXTRA_LINES_RENDER_BELOW = true;

/**
 * Vertical ink extents read from the installed font files with fontTools,
 * in font units, alongside the units-per-em they are expressed in.
 *
 *   ~/Library/Fonts/Inter-VariableFont_opsz,wght.ttf
 *   ~/Library/Fonts/Almarai-Bold.ttf
 *
 * Both figures are OS/2 usWinAscent / usWinDescent, the font's own statement
 * of its maximum ink extent, which for both files equals or exceeds the head
 * table's global glyph bounding box. Typo metrics are deliberately not used:
 * they describe comfortable line spacing, not how far a glyph can reach, and
 * a placement exclusion has to cover the reach.
 *
 * Inter ships as a variable font and Semi-Bold is an instance of it. Its MVAR
 * table varies only xhgt, stro, strs, undo and unds — no vertical metric tag —
 * and instantiating at wght=600 across both ends of the opsz axis reproduces
 * 2269 / -660 exactly, so the extents below hold for Semi-Bold.
 */
export const FONT_METRICS = {
  latin: { unitsPerEm: 2048, ascent: 2269, descent: 660 },
  arabic: { unitsPerEm: 1000, ascent: 1108, descent: 453 },
} as const;

/** Ink extent in pixels above and below the baseline at a given size. */
export function inkExtent(
  face: keyof typeof FONT_METRICS,
  sizePx: number,
): { ascentPx: number; descentPx: number } {
  const m = FONT_METRICS[face];
  return {
    ascentPx: (m.ascent / m.unitsPerEm) * sizePx,
    descentPx: (m.descent / m.unitsPerEm) * sizePx,
  };
}

/**
 * The worst case the subtitle band has to clear: the larger of the two track
 * sizes, in whichever face reaches further from the baseline.
 *
 * Almarai wins both directions at the keyword size — 503.86 against 470.86
 * above, 206.00 against 136.96 below — because the 1.07 ratio and its heavier
 * descenders more than cover Inter's taller nominal ascent.
 */
export function worstCaseExtent(): { ascentPx: number; descentPx: number } {
  const latin = inkExtent('latin', KEYWORD_FONT_SIZE);
  const arabic = inkExtent('arabic', KEYWORD_FONT_SIZE * ARABIC_SIZE_RATIO);
  return {
    ascentPx: Math.max(latin.ascentPx, arabic.ascentPx),
    descentPx: Math.max(latin.descentPx, arabic.descentPx),
  };
}
