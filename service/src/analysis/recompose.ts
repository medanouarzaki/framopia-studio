import type { ClientMode } from '@framopia/core';
import type { EditPlan, ImageSlot } from '../editplan/types.js';
import { composeNegativePrompt, composePrompt, drawVariation } from './slot-select.js';

export interface RecomposedSlot {
  id: string;
  promptBefore: string;
  promptAfter: string;
  negativeBefore: string;
  negativeAfter: string;
  changed: boolean;
}

export interface RecomposeResult {
  slots: ImageSlot[];
  recomposed: RecomposedSlot[];
  modeVersion: number;
  changedCount: number;
}

/**
 * Re-composes every slot's prompt from the **stored** `idea` and the current
 * mode, with no model call.
 *
 * A mode bump changes the composed prompt but not the underlying idea, and
 * the idea is the only part a Gemini call produces. Re-running the analysis
 * stage to pick up a mode edit would pay for ideas that are already on disk
 * and would also replace them with different ones, since the call is not
 * reproducible. This walks the same pure path the planner used —
 * `drawVariation` on the slot's index, then `composePrompt` — so a recomposed
 * plan is byte-identical to what the planner would have written had the mode
 * been at this version when it ran.
 *
 * Pure: it returns new slots and never mutates the ones passed in.
 */
export function recomposeSlotPrompts(plan: EditPlan, mode: ClientMode): RecomposeResult {
  const recomposed: RecomposedSlot[] = [];

  const slots = plan.images.slots.map((slot, index) => {
    // Same index the planner drew on, so the draw is stable across a
    // recomposition: `drawVariation` is seeded from the plan id and the
    // slot's position, and neither moves here.
    const variation = drawVariation(mode, plan.meta.id, index);
    const promptAfter = composePrompt(mode, slot.idea, variation);
    const negativeAfter = composeNegativePrompt(mode);

    recomposed.push({
      id: slot.id,
      promptBefore: slot.prompt,
      promptAfter,
      negativeBefore: slot.negativePrompt,
      negativeAfter,
      changed: promptAfter !== slot.prompt || negativeAfter !== slot.negativePrompt,
    });

    return {
      ...slot,
      prompt: promptAfter,
      negativePrompt: negativeAfter,
      promptModeVersion: mode.version,
    };
  });

  return {
    slots,
    recomposed,
    modeVersion: mode.version,
    changedCount: recomposed.filter((r) => r.changed).length,
  };
}
