import { createHash } from 'node:crypto';
import { renderNegativePrompt, renderStylePrompt, type ClientMode } from '@framopia/core';
import type { AnalysisWord } from './types.js';

/**
 * A slot every model call must clear before it reaches the plan. Nothing here
 * is asked of the model, because a model that forgets one produces a plan
 * that validates and builds wrong.
 */
export interface SlotCandidate {
  wordIds: string[];
  idea: string;
}

export interface SlotFailure {
  candidate: SlotCandidate;
  reason: 'unknown-word-id' | 'empty-word-ids' | 'overlaps-a-selected-slot' | 'too-close' | 'window-taken';
}

export interface PlannedSlot {
  wordIds: string[];
  start: number;
  end: number;
  contextText: string;
  idea: string;
  variation: Record<string, string>;
  prompt: string;
  negativePrompt: string;
}

export interface SlotSelectionResult {
  slots: PlannedSlot[];
  failures: SlotFailure[];
  requestedCount: number;
  /** Windows the candidates left empty. Reported, never padded. */
  shortfall: number;
  /** Seconds between the end of each slot and the start of the next. */
  gaps: number[];
  /** Reel time no slot covers. */
  uncoveredS: number;
}

/**
 * Absolute floor between one slot ending and the next beginning. Chosen, not
 * measured: two images butting up against each other read as one long
 * dissolve rather than two ideas, and the window rule below already does most
 * of the spreading. Revisit once a reel has actually been built.
 */
export const MIN_SLOT_GAP_S = 0.5;

/**
 * Deterministic per-axis draw. The user ruled that the palette stays dominant
 * across every slot while composition, lighting and crop vary, so the set
 * reads as designed rather than batched.
 *
 * The offset and the stride both come from a hash of the plan id and the axis
 * name, so the same plan always draws the same values and two different reels
 * do not march through the axes in lockstep. The stride is chosen from the
 * values coprime to the axis length, which guarantees two things at once:
 * consecutive slots never land on the same value, and the draw walks the
 * whole axis instead of ping-ponging between two of its values.
 */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function drawVariation(
  mode: ClientMode,
  planId: string,
  slotIndex: number,
): Record<string, string> {
  const drawn: Record<string, string> = {};
  for (const [axis, values] of Object.entries(mode.imageVariation.axes)) {
    if (values.length === 0) continue;
    const digest = createHash('sha256').update(`${planId}:${axis}`).digest();
    const offset = digest.readUInt32BE(0) % values.length;
    const strides =
      values.length === 1
        ? [0]
        : Array.from({ length: values.length - 1 }, (_, i) => i + 1).filter(
            (s) => gcd(s, values.length) === 1,
          );
    const stride = strides[digest.readUInt32BE(4) % strides.length] as number;
    drawn[axis] = values[(offset + stride * slotIndex) % values.length] as string;
  }
  return drawn;
}

/**
 * The §5.3 composition, entirely from mode data. `stylePrompt` is the
 * invariant half and every slot gets all of it — that is what keeps the mode
 * palette dominant across the set — followed by this slot's variation draw.
 * No colour and no composition term is written here.
 */
export function composePrompt(
  mode: ClientMode,
  idea: string,
  variation: Record<string, string>,
): string {
  return [idea, ...renderStylePrompt(mode), ...Object.values(variation)].join('. ');
}

export function composeNegativePrompt(mode: ClientMode): string {
  return renderNegativePrompt(mode).join(', ');
}

export interface PlanSlotsOptions {
  candidates: SlotCandidate[];
  words: AnalysisWord[];
  mode: ClientMode;
  planId: string;
  requestedCount: number;
  durationS: number;
}

/**
 * Turns slot candidates into planned slots. Pure, and the only place the
 * count, the no-overlap rule and the spread rule are decided.
 *
 * Spread is enforced by dividing the reel into `requestedCount` equal windows
 * and keeping at most one slot per window, chosen by the slot's midpoint.
 * That guarantees coverage across the reel without a tuned constant, and it
 * degrades honestly: a window no candidate reached becomes a shortfall rather
 * than a second slot crammed next to the first.
 *
 * Images are independent of keywords per PROJECT_SPEC §5, so a span that is
 * also a keyword is neither preferred nor excluded.
 */
export function planSlots(options: PlanSlotsOptions): SlotSelectionResult {
  const { candidates, words, mode, planId, requestedCount, durationS } = options;
  const byId = new Map(words.map((w) => [w.id, w]));
  const failures: SlotFailure[] = [];

  const resolved: { wordIds: string[]; start: number; end: number; contextText: string; idea: string }[] = [];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate.wordIds) || candidate.wordIds.length === 0) {
      failures.push({ candidate, reason: 'empty-word-ids' });
      continue;
    }
    const hit = candidate.wordIds.map((id) => byId.get(id));
    // Never fuzzy-matched onto a nearby word: a slot illustrating the wrong
    // sentence is worse than a reel with one fewer image.
    if (hit.some((w) => w === undefined)) {
      failures.push({ candidate, reason: 'unknown-word-id' });
      continue;
    }
    const ordered = (hit as AnalysisWord[]).slice().sort((a, b) => a.start - b.start);
    resolved.push({
      wordIds: ordered.map((w) => w.id),
      start: ordered[0]?.start ?? 0,
      end: ordered[ordered.length - 1]?.end ?? 0,
      contextText: ordered.map((w) => w.text).join(' '),
      idea: candidate.idea,
    });
  }

  resolved.sort((a, b) => a.start - b.start || a.end - b.end);

  const windowLength = requestedCount > 0 ? durationS / requestedCount : durationS;
  const takenWindows = new Set<number>();
  const accepted: typeof resolved = [];

  for (const slot of resolved) {
    const previous = accepted[accepted.length - 1];
    const asCandidate: SlotCandidate = { wordIds: slot.wordIds, idea: slot.idea };
    if (previous !== undefined && slot.start < previous.end) {
      failures.push({ candidate: asCandidate, reason: 'overlaps-a-selected-slot' });
      continue;
    }
    if (previous !== undefined && slot.start - previous.end < MIN_SLOT_GAP_S) {
      failures.push({ candidate: asCandidate, reason: 'too-close' });
      continue;
    }
    const midpoint = (slot.start + slot.end) / 2;
    const window = Math.min(requestedCount - 1, Math.floor(midpoint / windowLength));
    if (takenWindows.has(window)) {
      failures.push({ candidate: asCandidate, reason: 'window-taken' });
      continue;
    }
    takenWindows.add(window);
    accepted.push(slot);
    if (accepted.length >= requestedCount) break;
  }

  const slots: PlannedSlot[] = accepted.map((slot, i) => {
    const variation = drawVariation(mode, planId, i);
    return {
      ...slot,
      variation,
      prompt: composePrompt(mode, slot.idea, variation),
      negativePrompt: composeNegativePrompt(mode),
    };
  });

  const gaps: number[] = [];
  for (let i = 1; i < slots.length; i += 1) {
    gaps.push((slots[i]?.start ?? 0) - (slots[i - 1]?.end ?? 0));
  }
  const covered = slots.reduce((n, s) => n + (s.end - s.start), 0);

  return {
    slots,
    failures,
    requestedCount,
    shortfall: Math.max(0, requestedCount - slots.length),
    gaps,
    uncoveredS: Math.max(0, durationS - covered),
  };
}
