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
 * Where the subtitle track sits. **PROVISIONAL and the only declaration of
 * it.** PROJECT_SPEC §5 fixes the subtitle position as global but no document
 * states its coordinates, so this is full frame width, 600 px tall per
 * TEMPLATE_LIBRARY_GUIDE §3's 2160x600 subtitle comps, centred at 0.75 of the
 * frame height. CHOSEN, NOT MEASURED. Block 6 replaces it with the real value
 * once the templates exist, and changing it must remain this one edit.
 */
export const SUBTITLE_BAND_HEIGHT_PX = 600;
export const SUBTITLE_BAND_CENTRE = 0.75;
export const SUBTITLE_BAND = {
  x: 0,
  y: SUBTITLE_BAND_CENTRE - SUBTITLE_BAND_HEIGHT_PX / FRAME_HEIGHT / 2,
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
