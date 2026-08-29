import {
  FRAME_ASPECT,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  HEAD_CLEARANCE,
  TOP_LEFT_POSITION_JITTER,
  TOP_LEFT_MARGIN,
} from './constants.js';
import { fitInsideFrame, type Rect } from './geometry.js';
import { unitStream } from './solve.js';

/**
 * Images sit in the top-left corner, on every reel.
 *
 * **A user ruling from Block 7 session 9, and his again after Block 8 session
 * 33 moved them off it and he saw the result.** In a vertical talking-head reel
 * the top-left corner is reliably empty, and the only thing an image must
 * genuinely avoid is the speaker's face. He asked for the pictures **bigger**,
 * not moved; session 33 read that as a placement question and it was not.
 *
 * The zone machinery is **retired for automatic image placement, not removed**.
 * Manual zones still round-trip and the derivation stays for a future format,
 * the way Block 6 kept torso geometry after retiring its derivation.
 *
 * **Every figure here is in source pixels, converted to frame fractions once at
 * the end.** The x and y fractions have different denominators — 2160 and 3840 —
 * and this file had the conversion backwards until session 34: it multiplied by
 * the frame's aspect ratio where a width fraction becomes a height fraction by
 * dividing. That cost the corner **327 px of vertical room** on every slot and
 * is the third time in this block the same mistake has been found.
 */
export interface TopLeftInput {
  /** Union of the face mask over the frames this slot is on screen, in fractions. */
  faceBox: Rect | null;
  /** Deterministic per slot, so two runs place identically. */
  seed: string;
  marginW?: number;
  clearanceW?: number;
  jitter?: number;
  /** The client mode's `imageScale`, default 1.0. */
  scale?: number;
}

export interface TopLeftDetail {
  rect: Rect;
  /** The side the mode asked for, in pixels, before the face and frame had their say. */
  wantedSidePx: number;
  /** The largest square the corner can hold, in pixels, before jitter. */
  cornerSidePx: number;
  /** Which bound decided it, for the report. */
  boundBy: 'the space beside the speaker' | 'the space above the speaker' | 'the frame';
  /** How far jitter nudged the square from the corner, in pixels. */
  offsetPx: { x: number; y: number };
  /** True when the corner could not hold what the mode asked for. */
  clamped: boolean;
}

/**
 * The largest square in the corner that clears the face, nudged a few pixels so
 * a run of images is not pixel-identical.
 *
 * The square is anchored at the margin and grows down and right until it meets
 * either the speaker's left edge or the top of his head, whichever leaves the
 * larger picture — so it never overlaps the face, whichever bound wins. **Every
 * slot then takes that whole size**; jitter varies where the square sits, never
 * how big it is (user ruling, 2026-08-29 — see `TOP_LEFT_POSITION_JITTER`).
 *
 * **The move holds by construction, not by a clamp afterwards**, which is Block
 * 5's rule. A square bounded *above* the face may move right, because sliding
 * it sideways cannot change that it sits above him; one bounded *beside* him
 * may move down, for the mirror reason. Each axis is offered only the move its
 * own bound already guarantees, and the second is measured after the first has
 * been applied, so the two together cannot walk onto the face.
 */
export function topLeftPlacement(input: TopLeftInput): Rect {
  return topLeftPlacementDetail(input).rect;
}

export function topLeftPlacementDetail(input: TopLeftInput): TopLeftDetail {
  const marginPx = (input.marginW ?? TOP_LEFT_MARGIN) * FRAME_WIDTH;
  const clearancePx = (input.clearanceW ?? HEAD_CLEARANCE) * FRAME_WIDTH;
  const jitter = input.jitter ?? TOP_LEFT_POSITION_JITTER;
  const scale = input.scale ?? 1;

  const byFramePx = Math.min(FRAME_WIDTH - 2 * marginPx, FRAME_HEIGHT - 2 * marginPx);
  let cornerSidePx = byFramePx;
  let boundBy: TopLeftDetail['boundBy'] = 'the frame';

  if (input.faceBox !== null) {
    // Stop before the speaker's left edge, or above the top of his head,
    // whichever leaves the larger square. Both measured from the margin.
    const besidePx = input.faceBox.x * FRAME_WIDTH - clearancePx - marginPx;
    const abovePx = input.faceBox.y * FRAME_HEIGHT - clearancePx - marginPx;
    const bestPx = Math.max(besidePx, abovePx);
    if (bestPx < cornerSidePx) {
      cornerSidePx = bestPx;
      boundBy =
        abovePx >= besidePx ? 'the space above the speaker' : 'the space beside the speaker';
    }
  }
  cornerSidePx = Math.max(0, cornerSidePx);

  const wantedSidePx = cornerSidePx * scale;
  const sidePx = Math.min(wantedSidePx, cornerSidePx);

  // The face box grown by the clearance, in pixels. The grow is the same figure
  // on both axes here; it is only the fractions that have different denominators.
  const faceX0Px =
    input.faceBox === null ? null : input.faceBox.x * FRAME_WIDTH - clearancePx;
  const faceY0Px =
    input.faceBox === null ? null : input.faceBox.y * FRAME_HEIGHT - clearancePx;

  const draw = unitStream(`${input.seed}:topleft`);
  const jitterPx = jitter * FRAME_WIDTH;
  const epsilonPx = 1e-9;

  const sitsAboveFace = faceY0Px === null || marginPx + sidePx <= faceY0Px + epsilonPx;
  const roomRightPx = FRAME_WIDTH - 2 * marginPx - sidePx;
  const offsetXPx = sitsAboveFace ? Math.min(jitterPx, Math.max(0, roomRightPx)) * draw() : 0;

  const sitsLeftOfFace =
    faceX0Px === null || marginPx + offsetXPx + sidePx <= faceX0Px + epsilonPx;
  const roomDownPx = FRAME_HEIGHT - 2 * marginPx - sidePx;
  const offsetYPx = sitsLeftOfFace ? Math.min(jitterPx, Math.max(0, roomDownPx)) * draw() : 0;

  return {
    rect: fitInsideFrame(
      (marginPx + offsetXPx + sidePx / 2) / FRAME_WIDTH,
      (marginPx + offsetYPx + sidePx / 2) / FRAME_HEIGHT,
      sidePx / FRAME_WIDTH,
    ),
    wantedSidePx,
    cornerSidePx,
    boundBy,
    offsetPx: { x: offsetXPx, y: offsetYPx },
    clamped: wantedSidePx > cornerSidePx + 1e-9,
  };
}

/**
 * Whether a placement clears the face and stays in the frame.
 *
 * The two hard bounds, asserted rather than eyeballed. The face box is grown by
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
