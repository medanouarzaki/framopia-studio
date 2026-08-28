import {
  FRAME_ASPECT,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  HEAD_CLEARANCE,
  MIN_PLACED_SHORT_EDGE,
  SUBTITLE_BAND,
  TOP_LEFT_JITTER,
  TOP_LEFT_MARGIN,
} from './constants.js';
import { fitInsideFrame, type Rect } from './geometry.js';
import { unitStream } from './solve.js';

/**
 * Images sit in the largest free band around the speaker's face, preferring the
 * one above it.
 *
 * **Supersedes Block 7 session 9's top-left corner** (user ruling, Block 8
 * session 33). The corner was chosen before anyone had seen a build, and
 * `benchmarks/RESULTS-block8-image-placement.md` measured what it costs: the
 * corner places 749–818 px where the band above the face holds 905–937 on eight
 * of the corpus's nine slots. Anchoring at the corner wastes the width above the
 * head. The corner ruling's own evidence — that the corner clears the face by
 * 834–995 px — is still true; it simply is not the largest place that does.
 *
 * **It does not reach the 140% the mode asks for, and nothing here pretends
 * to.** 140% wants 1076–1172 px and the largest face-clearing square anywhere
 * on the frame is 765–937. This recovers the ≈1.17× the corner was costing; the
 * rest is where the speaker's face sits, and getting past it means letting a
 * picture bleed off the frame or overlap him.
 *
 * All arithmetic here is in **source pixels**, converted to frame fractions once
 * at the end. The x and y fractions have different denominators — 2160 and 3840
 * — and converting between them in the middle of a calculation is how the
 * watermark came to sit 65 px from the side and 205 px from the top.
 */
export type PlacementBand = 'above the face' | 'left of the face' | 'right of the face' | 'the frame';

export interface ImagePlacementInput {
  /** Union of the face mask over the frames this slot is on screen, in fractions. */
  faceBox: Rect | null;
  /** Deterministic per slot, so two runs place identically. */
  seed: string;
  marginW?: number;
  clearanceW?: number;
  jitter?: number;
  /** The client mode's `imageScale`, default 1.0. */
  scale?: number;
  /**
   * The side of the speaker a human chose. Absent takes the largest band, which
   * is the normal case. A band too small to hold anything is refused rather
   * than honoured — see `bandChoices`.
   */
  prefer?: 'above' | 'left' | 'right';
}

/** The key a human's choice uses, for each band. */
export const BAND_KEY: Record<PlacementBand, 'above' | 'left' | 'right' | null> = {
  'above the face': 'above',
  'left of the face': 'left',
  'right of the face': 'right',
  'the frame': null,
};

export interface ImagePlacementDetail {
  rect: Rect;
  /** Where it went, in words. */
  band: PlacementBand;
  /** The side the mode asked for, in pixels, before the face and frame had their say. */
  wantedSidePx: number;
  /** The largest square that band could hold, before jitter. */
  bandSidePx: number;
  /** True when the frame could not hold what the mode asked for. */
  clamped: boolean;
}

interface Band {
  name: PlacementBand;
  /** Source pixels. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function sideOf(band: Band): number {
  return Math.max(0, Math.min(band.x1 - band.x0, band.y1 - band.y0));
}

/**
 * The free bands around the face, in source pixels.
 *
 * An image never reaches the subtitle band, so the side bands stop there. The
 * band above the face has no such bound — it is above the face, which is above
 * the subtitles — and may use the frame's whole width, which is the space the
 * corner rule was leaving unused.
 */
export function bandsAround(
  faceBox: Rect | null,
  marginPx: number,
  clearancePx: number,
): Band[] {
  const right = FRAME_WIDTH - marginPx;
  const bottom = SUBTITLE_BAND.y * FRAME_HEIGHT;
  if (faceBox === null) {
    return [{ name: 'the frame', x0: marginPx, y0: marginPx, x1: right, y1: bottom }];
  }
  const fx0 = faceBox.x * FRAME_WIDTH;
  const fy0 = faceBox.y * FRAME_HEIGHT;
  const fx1 = (faceBox.x + faceBox.w) * FRAME_WIDTH;
  return [
    { name: 'above the face', x0: marginPx, y0: marginPx, x1: right, y1: fy0 - clearancePx },
    { name: 'left of the face', x0: marginPx, y0: marginPx, x1: fx0 - clearancePx, y1: bottom },
    { name: 'right of the face', x0: fx1 + clearancePx, y0: marginPx, x1: right, y1: bottom },
  ];
}

/**
 * The largest square in the best band, positioned within it.
 *
 * The bands are tried **in order** and the largest wins, so a tie goes to the
 * one above the face — which is the ruling, and which wins outright on eight of
 * the corpus's nine slots. `img002` on `vitasilk` is the exception: the speaker's
 * face reaches higher there, so the band beside him is larger and taking it is
 * what earns the measured 1.17×.
 *
 * **The square cannot touch the face by construction.** Every band is bounded
 * away from the face box by the clearance, so wherever inside a band the square
 * sits, it clears. Jitter is a one-sided shrink applied **last**, so it cannot
 * push a clamped square onto the boundary at any scale — the defect session 25
 * found and fixed.
 */
export function placeImageDetail(input: ImagePlacementInput): ImagePlacementDetail {
  const marginPx = (input.marginW ?? TOP_LEFT_MARGIN) * FRAME_WIDTH;
  const clearancePx = (input.clearanceW ?? HEAD_CLEARANCE) * FRAME_WIDTH;
  const jitter = input.jitter ?? TOP_LEFT_JITTER;
  const scale = input.scale ?? 1;

  const bands = bandsAround(input.faceBox, marginPx, clearancePx);
  const preferred =
    input.prefer === undefined
      ? undefined
      : bands.find((b) => BAND_KEY[b.name] === input.prefer && sideOf(b) > 0);
  const best = preferred ?? bands.reduce((a, b) => (sideOf(b) > sideOf(a) ? b : a));
  const bandSidePx = sideOf(best);

  const wantedSidePx = bandSidePx * scale;
  const draw = unitStream(`${input.seed}:image-placement`);
  const allowedPx = Math.min(wantedSidePx, bandSidePx) * (1 - jitter * draw());

  // Whatever slack the square leaves in the band, spent deterministically so a
  // run of images is not lined up. Neither axis can reach the face: the band is
  // already bounded away from it.
  const x = best.x0 + (best.x1 - best.x0 - allowedPx) * draw();
  const y = best.y0 + (best.y1 - best.y0 - allowedPx) * draw();

  return {
    rect: fitInsideFrame(
      (x + allowedPx / 2) / FRAME_WIDTH,
      (y + allowedPx / 2) / FRAME_HEIGHT,
      allowedPx / FRAME_WIDTH,
    ),
    band: best.name,
    wantedSidePx,
    bandSidePx,
    clamped: wantedSidePx > bandSidePx + 1e-9,
  };
}

export function placeImage(input: ImagePlacementInput): Rect {
  return placeImageDetail(input).rect;
}

/**
 * Whether a placement clears the face and stays in the frame.
 *
 * The two hard stops, asserted rather than eyeballed. The face box is grown by
 * the clearance first, so "clears" means clears with room, not merely misses.
 */
export function placementIsSafe(
  rect: Rect,
  faceBox: Rect | null,
  clearanceW: number = HEAD_CLEARANCE,
): { insideFrame: boolean; clearsFace: boolean } {
  const epsilon = 1e-9;
  const insideFrame =
    rect.x >= -epsilon &&
    rect.y >= -epsilon &&
    rect.x + rect.w <= 1 + epsilon &&
    rect.y + rect.h <= 1 + epsilon;
  if (faceBox === null) return { insideFrame, clearsFace: true };
  const grown = {
    x: faceBox.x - clearanceW,
    y: faceBox.y - clearanceW / FRAME_ASPECT,
    w: faceBox.w + 2 * clearanceW,
    h: faceBox.h + (2 * clearanceW) / FRAME_ASPECT,
  };
  const overlaps =
    rect.x < grown.x + grown.w - epsilon &&
    grown.x < rect.x + rect.w - epsilon &&
    rect.y < grown.y + grown.h - epsilon &&
    grown.y < rect.y + rect.h - epsilon;
  return { insideFrame, clearsFace: !overlaps };
}

export interface BandChoice {
  /** The value a human's choice stores. */
  key: 'above' | 'left' | 'right';
  /** Which side of the speaker, in words. */
  label: string;
  /** The largest square this band could hold, in source pixels. */
  sidePx: number;
  /** False when the band is too narrow to hold a picture at all. */
  usable: boolean;
}

/**
 * The sides of the speaker this slot could sit on, and how big a picture each
 * would take.
 *
 * **This is what the zone editor can honestly offer.** The stored zones — 20 on
 * `vitasilk`, derived from the person mask — have not been read by placement
 * since Block 7 session 9, and the placement is derived from the face mask
 * rather than chosen from a list. So the real choice is not which of twenty
 * rectangles, it is which side of the speaker; offering the rectangles would be
 * a control pretending to a choice that no longer exists.
 */
export function bandChoices(
  faceBox: Rect | null,
  options: { marginW?: number; clearanceW?: number } = {},
): BandChoice[] {
  const marginPx = (options.marginW ?? TOP_LEFT_MARGIN) * FRAME_WIDTH;
  const clearancePx = (options.clearanceW ?? HEAD_CLEARANCE) * FRAME_WIDTH;
  const labels: Record<string, string> = {
    above: 'above you',
    left: 'to your left',
    right: 'to your right',
  };
  return bandsAround(faceBox, marginPx, clearancePx)
    .map((band) => ({ band, key: BAND_KEY[band.name] }))
    .filter((b): b is { band: Band; key: 'above' | 'left' | 'right' } => b.key !== null)
    .map(({ band, key }) => {
      const sidePx = sideOf(band);
      return {
        key,
        label: labels[key] as string,
        sidePx,
        /*
         * `MIN_PLACED_SHORT_EDGE` — 324 px — is the project's own answer to how
         * small a placed image may be before it stops being worth showing,
         * settled in Block 5 against the zone predicate and stated in terms of
         * the picture a viewer sees. `vitasilk`'s `img002` has 205 px to the
         * speaker's right, which is a strip rather than a picture.
         */
        usable: sidePx >= MIN_PLACED_SHORT_EDGE * FRAME_WIDTH,
      };
    });
}
