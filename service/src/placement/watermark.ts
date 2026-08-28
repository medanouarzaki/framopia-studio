import {
  FRAME_ASPECT,
  SUBTITLE_BAND,
  WATERMARK_DURATION_S,
  WATERMARK_MARGIN,
  WATERMARK_WIDTH_FRACTION,
} from './constants.js';
import { type Rect } from './geometry.js';
import { unitStream } from './solve.js';

/**
 * Where the watermark sits, and for how long.
 *
 * PROJECT_SPEC §4: the watermark is overlaid at t=0, the same file for every
 * client, and it does not extend the video. It is small — the user's ruling is
 * about a tenth of the frame width — sits in a free area near the start, and
 * goes.
 *
 * The corner is chosen by a seeded shuffle over the candidates that are
 * actually free, on the Block 3 decision 10 precedent: the same reel always
 * puts it in the same place and different reels differ, without a second
 * randomness mechanism being invented.
 */
export interface WatermarkPlacement {
  rect: Rect;
  corner: string;
  /** What ruled out the corners that were not taken. */
  rejected: { corner: string; reason: string }[];
  outPointS: number;
}

export interface WatermarkInput {
  /** Union of the face mask over the watermark's own window, in frame fractions. */
  faceBox: Rect | null;
  /** Anything else on screen while the watermark is up — images, mostly. */
  occupied: Rect[];
  /** Aspect of the artwork itself; the width is fitted and the height follows. */
  sourceWidth: number;
  sourceHeight: number;
  /** Measured, and only checked against the duration — it no longer sets it. */
  lastBeepEndS: number | null;
  durationS?: number;
  seed: string;
}

function clampToFrame(r: Rect): Rect {
  const w = Math.min(r.w, 1);
  const h = Math.min(r.h, 1);
  return {
    x: Math.min(Math.max(r.x, 0), 1 - w),
    y: Math.min(Math.max(r.y, 0), 1 - h),
    w,
    h,
  };
}

export class WatermarkBeepsRunLongError extends Error {
  constructor(
    readonly lastBeepEndS: number,
    readonly durationS: number,
  ) {
    super(
      `the watermark's last beep ends at ${lastBeepEndS.toFixed(3)}s but the mark leaves at ` +
        `${durationS.toFixed(3)}s, so its sound would be cut off. Either the duration is wrong ` +
        'for this file or the file is wrong for this duration.',
    );
    this.name = 'WatermarkBeepsRunLongError';
  }
}

/**
 * The duration no longer follows the beeps, so nothing would notice a file
 * whose beeps run past it — the sound would simply be cut mid-beep and look
 * like a taste decision. This is the check that keeps the measurement useful
 * after it stopped setting the number.
 */
export function assertBeepsFitWatermark(
  lastBeepEndS: number | null,
  durationS: number = WATERMARK_DURATION_S,
): void {
  if (lastBeepEndS === null) return;
  if (lastBeepEndS > durationS + 1e-9) {
    throw new WatermarkBeepsRunLongError(lastBeepEndS, durationS);
  }
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * The four corners, at the margin. A corner is a candidate only if the whole
 * mark fits there without touching the face, anything already on screen, or the
 * subtitle band — a watermark under a subtitle card reads as a mistake even
 * though neither is wrong on its own.
 */
export function placeWatermark(input: WatermarkInput): WatermarkPlacement {
  const w = WATERMARK_WIDTH_FRACTION;
  // Height in frame-height fractions, from the artwork's own aspect ratio.
  const h = ((w * input.sourceHeight) / input.sourceWidth) / FRAME_ASPECT;
  const m = WATERMARK_MARGIN;
  const mY = m * FRAME_ASPECT;

  const candidates: { corner: string; rect: Rect }[] = [
    { corner: 'top-left', rect: { x: m, y: mY, w, h } },
    { corner: 'top-right', rect: { x: 1 - m - w, y: mY, w, h } },
    { corner: 'bottom-left', rect: { x: m, y: 1 - mY - h, w, h } },
    { corner: 'bottom-right', rect: { x: 1 - m - w, y: 1 - mY - h, w, h } },
  ];

  const band: Rect = { x: 0, y: SUBTITLE_BAND.y, w: 1, h: SUBTITLE_BAND.h };
  const rejected: { corner: string; reason: string }[] = [];
  const free: { corner: string; rect: Rect }[] = [];
  for (const c of candidates) {
    if (input.faceBox !== null && overlaps(c.rect, input.faceBox)) {
      rejected.push({ corner: c.corner, reason: 'overlaps the face' });
      continue;
    }
    if (overlaps(c.rect, band)) {
      rejected.push({ corner: c.corner, reason: 'sits in the subtitle band' });
      continue;
    }
    const clash = input.occupied.find((o) => overlaps(c.rect, o));
    if (clash !== undefined) {
      rejected.push({ corner: c.corner, reason: 'overlaps something already on screen' });
      continue;
    }
    free.push(c);
  }

  // Seeded shuffle over what is free, so the choice is deterministic per reel
  // and not simply "always the first corner that works".
  const pool = free.length > 0 ? free : candidates;
  const next = unitStream(`${input.seed}:watermark`);
  const order = [...pool].sort((a, b) => (a.corner < b.corner ? -1 : 1));
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j] as (typeof order)[number], order[i] as (typeof order)[number]];
  }
  const chosen = order[0] as { corner: string; rect: Rect };

  return {
    // Clamped as a rectangle, not through `fitInsideFrame`: that returns a
    // square, and the artwork is 1924 x 2154, so a square would misrecord the
    // height and put the bottom corners a little wrong.
    rect: clampToFrame(chosen.rect),
    corner: chosen.corner,
    rejected,
    outPointS: input.durationS ?? WATERMARK_DURATION_S,
  };
}

/**
 * Whether a plan asks for a watermark.
 *
 * Absent means yes: `plan.watermark` is null on every plan written before this
 * became a decision, and the reels those plans describe were built marked. A
 * missing field is therefore "nobody has said otherwise", not "no".
 */
export function watermarkEnabled(watermark: { enabled?: boolean } | null): boolean {
  return watermark?.enabled !== false;
}
