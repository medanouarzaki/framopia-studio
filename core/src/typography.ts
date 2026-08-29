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
 * is set larger to match it optically. **Measured by the user's eye, not from
 * the metrics**: it is a judgement about how the two faces read side by side.
 *
 * Block 9 session 5 measured the two faces in After Effects and the metrics do
 * **not** reproduce 1.07: Inter's cap height over Almarai's is **1.0161** and
 * its x-height over Almarai's is **1.0300**, both at 343 and at 425. That is
 * recorded rather than applied. The figure came from a person looking at a
 * delivered reel, a metric ratio is not evidence his eye was wrong, and
 * lowering every Arabic word on every build by 4% is a change he should see
 * before it happens.
 *
 * **Cormorant does not bear on it.** The Arabic companion is sized against the
 * ordinary Latin face: subtitles pair Inter with Almarai, and an Arabic keyword
 * takes `kw_slam_ar`, which is Almarai again. The emphasis face never sits
 * beside Arabic, so adding it leaves this ratio's reference unchanged.
 */
export const ARABIC_SIZE_RATIO = 1.07;

/**
 * The emphasis face's size against the ordinary Latin one.
 *
 * **Measured 2026-08-29 in After Effects 26.0x67 on the user's machine**,
 * through `sourceRectAtTime` on real text — `tools/ae/measure-fonts.jsx`, and
 * the run is `.local/build/font-measurements.json`. Inter-SemiBold is the
 * reference and CormorantGaramondItalic-SemiBoldItalic is the emphasis face.
 *
 * **Derived from the x-height proxy**, the rendered height of a lowercase `x`.
 * The three candidate quantities do not agree, and which one is right is a
 * question about what the eye reads as "the same size":
 *
 * | quantity | ratio |
 * |---|---|
 * | cap height, rendered `H` | 1.1641 |
 * | **x-height, rendered `x`** | **1.3479** |
 * | advance width, one word and a phrase | 1.3562 and 1.3730 |
 *
 * x-height wins because **the corpus is lowercase**: subtitle cards are one
 * Arabizi or French word each, and apparent size in lowercase text is governed
 * by the x-height rather than by the capitals. Advance width, an independent
 * measure of the same thing, lands within 1.2% of it; cap height is the
 * outlier, and it is low because Cormorant is an old-style face whose capitals
 * are large relative to its lowercase. Two measures agreeing against one is the
 * reason, not a preference.
 *
 * Identical at 343 and at 425 to five decimal places, so the ratio is a
 * property of the faces rather than of a size.
 *
 * **It is still a judgement the user can overturn by looking at a build.** If
 * an emphasized word reads too large, cap height's 1.1641 is the other end of
 * the range and the number to try.
 */
export const EMPHASIS_SIZE_RATIO = 1.3479;

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
 * The widest a rendered line may be inside a 2160-wide text comp: 1940 px,
 * leaving 110 px clear on each side.
 *
 * **CHOSEN, NOT MEASURED.** Nothing was fitted to the corpus; it is a margin
 * that looked right against a 2160 frame. What would change it is the user's
 * eye on a built reel — a card that reads as crowded at the edge argues the
 * number down, one that reads as needlessly narrow argues it up.
 *
 * It is compared against a width **After Effects reports**, not one this repo
 * computes: `sourceRectAtTime` on the populated text layer. Block 7 session 4
 * established that no font-metrics library in this repo can answer the
 * question — advance widths, kerning and Arabic positional shaping would all
 * have to be modelled, and a model of what AE will draw is not what AE draws.
 */
export const SUBTITLE_SAFE_WIDTH = 1940;

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
 * **These are real glyph bounding boxes, not OS/2 table values** — Block 6
 * session 4. Session 3 used OS/2 usWinAscent/usWinDescent, which describe the
 * tallest and deepest glyph anywhere in the font; those figures were Inter
 * 2269/660 and Almarai 1108/453. What replaced them is the extent over every
 * glyph the orthography can actually produce, measured through a pen so
 * composites resolve, following only the layout features a shaper turns on
 * without an application opting in. Stylistic sets are excluded: After Effects
 * does not enable them, and including them put Inter's maximum on a circled
 * slashed zero.
 *
 * The measured set is deliberately wider than the corpus, which is five reels
 * of one client and reaches only 800 units of Almarai ascent. It carries every
 * unvocalized Arabic letter in all four positional forms, Arabic punctuation,
 * printable ASCII, and the accented French set §5 permits. The widening is the
 * safety margin and it is worth +300 Almarai ascent units over the corpus
 * alone, a 37.5% increase; no further pad is added, because a number on top of
 * a set that already covers every permitted glyph would have no evidence
 * behind it.
 *
 * Almarai's ascent is the Allah ligature ﷲ, which `rlig` builds from لله. The
 * corpus contains no such sequence, but §6(b) permits religious formulas so it
 * is carried. Full vocalization cannot exceed it: the harakat outlines top out
 * at 747, Almarai's highest GPOS base anchor is 407 against a highest mark
 * anchor of 390, so an attached mark's ink cannot pass 764 against 1100.
 *
 * Inter ships as a variable font and Semi-Bold is an instance of it. Its MVAR
 * table varies only xhgt, stro, strs, undo and unds — no vertical metric tag —
 * and the measured extents are identical at both ends of the opsz axis.
 *
 * Measuring this way shrinks the band by 1.5% and recovers nothing; see
 * benchmarks/RESULTS-block6-band-repertoire.md. It is here because it is
 * better founded, not because it changed an outcome.
 */
export const FONT_METRICS = {
  latin: { unitsPerEm: 2048, ascent: 1970, descent: 480 },
  arabic: { unitsPerEm: 1000, ascent: 1100, descent: 427 },
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
 * Almarai wins both directions at the keyword size — 500.23 against 408.81
 * above, 194.18 against 99.61 below — because the 1.07 ratio and its heavier
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
