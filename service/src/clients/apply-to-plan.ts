import { clientDefaults, type ClientMode } from '@framopia/core';
import { WATERMARK_ASSET } from '../build/measurements.js';
import type { EditPlan } from '../editplan/types.js';

/**
 * The client's own defaults, written onto a reel the first time that client is
 * chosen for it.
 *
 * **The defect this closes.** A client created with the watermark switched off
 * was watermarked on every reel. `watermarkByDefault: false` was written to the
 * client file, validated, and shown back on the client card as *"no
 * watermark"*, and nothing between there and the build ever read it — the only
 * writer of `plan.watermark` was the panel's per-reel toggle. Block 10 session
 * 43 measured it in a built comp: layer 2 was the mark, on a client who had
 * said no.
 *
 * **Why the absence could not simply mean no.** `watermarkEnabled(null)`
 * returns true on purpose: `plan.watermark` is null on every plan written
 * before the field existed, and those reels were delivered marked. A missing
 * field is "nobody has said otherwise", so an explicit no had to become
 * something on the plan rather than the lack of something.
 *
 * **A per-reel decision always wins.** This writes only when the plan has
 * recorded none, so pressing the panel's watermark control is never undone by
 * a later run of the pipeline, and no existing plan changes.
 */
export function applyClientDefaultsToPlan(plan: EditPlan, mode: ClientMode): void {
  if (plan.watermark !== null) return;
  plan.watermark = {
    assetPath: WATERMARK_ASSET,
    startS: 0,
    durationS: null,
    enabled: clientDefaults(mode).watermark,
  };
}
