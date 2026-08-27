import { FRAME_ASPECT, HEAD_CLEARANCE, TOP_LEFT_JITTER, TOP_LEFT_MARGIN } from './constants.js';
import { fitInsideFrame, type Rect } from './geometry.js';
import { unitStream } from './solve.js';

/**
 * Images sit in the top-left corner, on every reel.
 *
 * **A user ruling from Block 7 session 9**, and a deliberate departure from
 * PROJECT_SPEC §4 and ARCHITECTURE §5.5, both of which place images in
 * automatically-found negative space. His reason: in a vertical talking-head
 * reel the top-left corner is reliably empty, and the only thing an image must
 * genuinely avoid is the speaker's face. Measured before implementing — the
 * corner clears the face mask by 834 to 995 px on all five reels.
 *
 * The zone machinery is **retired for automatic image placement, not removed**.
 * Manual zones still round-trip and the derivation stays for a future format,
 * the way Block 6 kept torso geometry after retiring its derivation.
 */
export interface TopLeftInput {
  /** Union of the face mask over the frames this slot is on screen, in frame fractions. */
  faceBox: Rect | null;
  /** Deterministic per slot, so two runs place identically. */
  seed: string;
  marginW?: number;
  clearanceW?: number;
  jitter?: number;
}

/**
 * The largest square anchored at the margin that clears the face, then a
 * one-sided shrink so a run of images is not identical.
 *
 * One-sided is the point: jitter can only make the square smaller, so it can
 * never push the image onto the face or past the frame. Block 5 established
 * that a bound has to hold by construction rather than by a clamp afterwards;
 * the result is still passed through `fitInsideFrame`.
 */
export function topLeftPlacement(input: TopLeftInput): Rect {
  const margin = input.marginW ?? TOP_LEFT_MARGIN;
  const clearance = input.clearanceW ?? HEAD_CLEARANCE;
  const jitter = input.jitter ?? TOP_LEFT_JITTER;

  // Without a face to avoid, the corner is limited only by the frame.
  let side = Math.min(1 - 2 * margin, FRAME_ASPECT - 2 * margin * FRAME_ASPECT);

  if (input.faceBox !== null) {
    const faceLeft = input.faceBox.x - clearance;
    const faceTop = input.faceBox.y - clearance * FRAME_ASPECT;
    // Stop before the face's left edge, or above its top edge, whichever
    // leaves the larger square. Both are measured from the margin, not zero.
    const byLeft = faceLeft - margin;
    const byTop = (faceTop - margin * FRAME_ASPECT) * FRAME_ASPECT;
    side = Math.min(side, Math.max(byLeft, byTop));
  }
  side = Math.max(0, side);

  const shrink = 1 - jitter * unitStream(`${input.seed}:topleft`)();
  return fitInsideFrame(
    margin + (side * shrink) / 2,
    margin * FRAME_ASPECT + (side * shrink) / (2 * FRAME_ASPECT),
    side * shrink,
  );
}
