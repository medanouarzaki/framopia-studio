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
  /**
   * The client mode's `imageScale`, default 1.0.
   *
   * **Under the 2026-09-01 ruling it can only make a picture smaller.** Every
   * slot is drawn at its own corner's maximum, and the size is clamped to that
   * corner afterwards, so any value at or above 1 asks for something the corner
   * refuses and changes nothing. Below 1 it still draws smaller than the corner,
   * which is why the field is kept. `k2-syndicalia` carries 1.4 and it has never
   * done anything on any reel.
   */
  scale?: number;
  /**
   * The size to place at, in source pixels, overriding what this slot's own
   * corner could hold. This is how a reel gives every picture one size; it is
   * still bounded by the corner, so an override larger than the corner can hold
   * is refused rather than granted over the speaker.
   */
  sidePx?: number;
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
  const sidePx = Math.min(input.sidePx ?? wantedSidePx, cornerSidePx);

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
 *
 * **The face box is required, and that is the point.** It used to be nullable
 * and answered `clearsFace: true` when it was null — so a reel with no masks on
 * disk got a 2030 px picture placed across the speaker and this function said it
 * was safe. A check that cannot fail is not a check. A caller with no face box
 * has to refuse before it gets here; `buildRequirements` is what refuses.
 */
export function placementIsSafe(
  rect: Rect,
  faceBox: Rect,
  clearanceW: number = HEAD_CLEARANCE,
): { insideFrame: boolean; clearsFace: boolean } {
  const epsilon = 1e-9;
  const insideFrame =
    rect.x >= -epsilon &&
    rect.y >= -epsilon &&
    rect.x + rect.w <= 1 + epsilon &&
    rect.y + rect.h <= 1 + epsilon;
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

export interface ReelSlotInput {
  id: string;
  faceBox: Rect | null;
  seed: string;
}

export interface ReelSlotPlacement extends TopLeftDetail {
  id: string;
  /** The largest square this slot's own corner could hold, in pixels. */
  ownMaxPx: number;
  /**
   * Always zero since the 2026-09-01 ruling — every slot now takes its own
   * maximum. Kept so the panel and the placement report, which read it, do not
   * have to change in the same breath as the rule.
   */
  givesUpPx: number;
}

export interface ReelPlacements {
  slots: ReelSlotPlacement[];
  /** The smallest and largest a picture is drawn at in this reel, in pixels. */
  smallestSidePx: number;
  largestSidePx: number;
}

/**
 * Every picture is drawn as large as its own corner allows.
 *
 * **User ruling, 2026-09-01**, replacing the one-size-per-reel rule he gave on
 * 2026-08-29 after looking at the same reel built at three sizes. The old rule
 * drew every picture at the size the *tightest* slot could hold, and Block 10
 * session 36 measured what that costs: a minimum only ever falls as slots are
 * added, so a longer reel is a smaller-pictured reel by construction. `sora`'s
 * eleven slots could hold 669 to 1085 px and every one was drawn at 669 —
 * 31% of the frame where its own geometry allowed a mean of 45.9% — while
 * `test-1`'s four slots spread over 20 px and never showed it.
 *
 * **This rule depends on nothing but the reel's own geometry.** Not the slot
 * count, not the duration, not what any other reel needed. What varies between
 * pictures is what varies in the footage: where the speaker is when each one is
 * on screen.
 *
 * The cost is stated rather than hidden: **the set is as varied as the speaker
 * is.** On `sora` that is 669 to 1085 px, and the one small picture is small
 * because that is genuinely all the corner holds while he leans forward. He
 * looked at exactly that and preferred it to eleven small ones.
 */
export function reelPlacements(
  slots: ReelSlotInput[],
  options: { scale?: number; jitter?: number } = {},
): ReelPlacements {
  if (slots.length === 0) return { slots: [], smallestSidePx: 0, largestSidePx: 0 };

  const placed = slots.map((slot) => {
    const own = topLeftPlacementDetail({ ...slot, ...options });
    return { id: slot.id, ownMaxPx: own.rect.w * FRAME_WIDTH, givesUpPx: 0, ...own };
  });
  const sides = placed.map((p) => p.ownMaxPx);

  return {
    slots: placed,
    smallestSidePx: Math.min(...sides),
    largestSidePx: Math.max(...sides),
  };
}
