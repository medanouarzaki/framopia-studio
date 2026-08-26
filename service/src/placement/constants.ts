import {
  LINE_SPACING,
  MAX_SUBTITLE_LINES,
  SUBTITLE_ANCHOR_BASELINE_Y,
  worstCaseExtent,
} from '@framopia/core';

/**
 * Placement constants, ARCHITECTURE §5.5 and TEMPLATE_LIBRARY_GUIDE §6.
 *
 * Coordinates are normalized against the frame: x and w against its width, y
 * and h against its height. The frames are 2160x3840, so the two axes are not
 * interchangeable and anything measured as a length is quoted in units of
 * frame **width**, converting through the aspect ratio.
 */

/** Source geometry of every reel in the catalogue. */
export const FRAME_WIDTH = 2160;
export const FRAME_HEIGHT = 3840;
export const FRAME_ASPECT = FRAME_HEIGHT / FRAME_WIDTH;

/**
 * Where the subtitle track sits: a placement exclusion, so no image may enter
 * it and it has to cover the worst case rather than the typical one.
 *
 * **Derived, not chosen** — Block 6 session 3. It falls out of the user's
 * measured anchor and the ink extents read from the installed font files (see
 * FONT_METRICS in @framopia/core, which names the files and the raw values).
 * The worst case is two lines at the keyword size in whichever face reaches
 * further from the baseline, which is Almarai Bold in both directions:
 *
 *   top    = 2480.4 - 500.2250                = 1980.1750 px
 *   bottom = 2480.4 + 323 (line 2) + 194.1782 = 2997.5783 px
 *
 * Three values have stood here; both predecessors are kept so the history is
 * auditable.
 *
 *   provisional (Block 5)  y 0.671875     h 0.15625      2580.0000-3180.0000
 *   usWin       (B6 s3)    y 0.5147231771 h 0.2689751953 1976.5370-3009.4017
 *   repertoire  (B6 s4)    y 0.5156705729 h 0.2649487630 1980.1750-2997.5783
 *
 * The provisional value was a guess: full width, 600 px tall, centred at 0.75
 * of frame height. It sat 600 px too low and was 1.7x too short, leaving the
 * whole of the first line's ascent unprotected.
 *
 * The usWin value took the fonts' OS/2 maximum-ink figures, which cover the
 * tallest glyph anywhere in the font. The repertoire value measures the glyphs
 * the orthography can actually produce. It is **1.50% shorter and recovers
 * nothing** — in particular it does not bring back the torso zones the usWin
 * band closed, and no honest measurement of this font at this size would; see
 * benchmarks/RESULTS-block6-band-repertoire.md.
 *
 * Full frame width is kept. The anchor is centred and a wrapped keyword can
 * run wide, and nothing measures the horizontal extent of a string yet.
 */
export const SUBTITLE_BAND_TOP_PX =
  SUBTITLE_ANCHOR_BASELINE_Y - worstCaseExtent().ascentPx;
export const SUBTITLE_BAND_BOTTOM_PX =
  SUBTITLE_ANCHOR_BASELINE_Y +
  (MAX_SUBTITLE_LINES - 1) * LINE_SPACING +
  worstCaseExtent().descentPx;
export const SUBTITLE_BAND_HEIGHT_PX =
  SUBTITLE_BAND_BOTTOM_PX - SUBTITLE_BAND_TOP_PX;
export const SUBTITLE_BAND = {
  x: 0,
  y: SUBTITLE_BAND_TOP_PX / FRAME_HEIGHT,
  w: 1,
  h: SUBTITLE_BAND_HEIGHT_PX / FRAME_HEIGHT,
} as const;

/**
 * Keyword templates place at the emphasized word's subtitle position
 * (TEMPLATE_LIBRARY_GUIDE §6), so on current evidence a keyword occupies the
 * subtitle band and needs no exclusion of its own. **This assumption breaks
 * the moment a keyword template declares an offset from that position**, and
 * Block 6 has to know that when it authors them.
 */
export const KEYWORDS_ARE_INSIDE_SUBTITLE_BAND = true;

/**
 * Mirrors BOTTOM_EXCLUSION in tools/cv/framopia_cv/zones.py, which is the
 * authority. A test parses that file and fails if the two drift. Zones are
 * already clipped to it; placement re-checks rather than trusting the input.
 */
export const BOTTOM_EXCLUSION = 0.15;

/**
 * Clearance kept between an image and the speaker's head, as a fraction of
 * frame width. **Mirrors HEAD_CLEARANCE in tools/cv/framopia_cv/zones.py**,
 * which is the authority; a test pins the two equal.
 */
export const HEAD_CLEARANCE = 0.04;

/**
 * Mirrors MIN_ZONE_SHORT_EDGE in the same file, and is applied here to the
 * **placed square** rather than to the zone. The constant's stated reason is
 * about the image a viewer sees, and after clearance and fill a placed square
 * is materially smaller than the zone that holds it.
 */
export const MIN_PLACED_SHORT_EDGE = 0.15;

/**
 * A card is a framed image with a visible border, so it is inset from the zone
 * edge: a border touching the boundary reads as a second frame cropped by the
 * subject. A cutout's edge is the subject's own silhouette, which is meant to
 * sit against the background, so it needs no inset. Both in units of frame
 * width, and both CHOSEN, NOT MEASURED.
 */
export const CARD_EDGE_CLEARANCE = 0.02;
export const CUTOUT_EDGE_CLEARANCE = 0;

/**
 * How much of the largest inscribable square a placed image takes before
 * jitter. The remainder is the travel jitter moves within, which is why
 * jitter can never leave the region: the position is chosen inside it rather
 * than applied and clamped. CHOSEN, NOT MEASURED.
 */
export const FILL_FRACTION = 0.88;

/**
 * Scale varies by up to this fraction either side of FILL_FRACTION, so a run
 * of slots in one zone does not read as a repeated stamp (PROJECT_SPEC §1).
 * 0.88 * 1.08 stays under 1, so the largest jittered square still fits.
 * CHOSEN, NOT MEASURED.
 */
export const SCALE_JITTER = 0.08;

/** TEMPLATE_LIBRARY_GUIDE §3: image comps are authored at 1200x1200. */
export const COMP_SIDE_PX = 1200;


/**
 * Torso zones are tried only after every background zone that fits.
 *
 * PROJECT_SPEC §4 and ARCHITECTURE §5.5 both place images in negative space;
 * placing one over the speaker is a deliberate departure the user ruled in,
 * and taking it only when negative space does not serve keeps the default
 * behaviour closest to the spec. CHOSEN, NOT MEASURED.
 */
export const TORSO_ZONE_IS_LAST_RESORT = true;

/**
 * Whether a cutout or a card sits better over a body is **undecided**: with
 * torso zones last-resort a slot only reaches one when nothing else fits, and
 * refusing it there on presentation grounds would leave the slot unplaced.
 * What would decide it is the user's eye on a built comp in Block 7, with a
 * cutout and a card over the same torso.
 */
export const TORSO_PRESENTATION_IS_UNDECIDED = true;
