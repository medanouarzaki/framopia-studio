import type { ImageCandidate, ImageSlot } from '../editplan/types.js';

/**
 * What the quality gate has to say about a candidate, given what its slot
 * actually renders.
 *
 * **`edge_halo`, `hole_ratio` and `alpha_edge_noise` measure one thing: how
 * cleanly the background came away.** That matters only where the build shows
 * the subject cut out of its background. Four of `vitasilk`'s five slots show
 * the whole picture inside a frame, and on those the matte is never drawn — so
 * a threshold it misses says nothing about what the user will see. All eight of
 * the corpus's rejections are of exactly that kind, which is why the picker read
 * as 8 of 10 failing when nothing was wrong with the build.
 *
 * **The measurement still happens, and still decides the presentation.**
 * ARCHITECTURE §5.4 makes a poor matte fall back to a card, so the metrics are
 * what turn a slot into a card slot in the first place; removing them would
 * remove the fallback. What is scoped here is the **verdict** — whether a
 * candidate is reported as failing something — because past that fallback the
 * metric has no consequence.
 */
export interface CandidateVerdict {
  /** Whether the cutout measurement bears on what this candidate would build. */
  applies: boolean;
  /** Null when it does not apply: there is nothing to have an opinion about. */
  backgroundCameAwayCleanly: boolean | null;
  /** What the matte failed, when the matte matters. Empty otherwise. */
  problems: string[];
}

/** True when the build shows this slot's subject cut out of its background. */
export function rendersAsCutout(slot: Pick<ImageSlot, 'presentation'>): boolean {
  return slot.presentation === 'cutout';
}

export function verdictFor(
  slot: Pick<ImageSlot, 'presentation'>,
  candidate: Pick<ImageCandidate, 'gate'>,
): CandidateVerdict {
  const gate = candidate.gate;
  if (!rendersAsCutout(slot) || gate === undefined || gate === null) {
    return { applies: false, backgroundCameAwayCleanly: null, problems: [] };
  }
  return {
    applies: true,
    backgroundCameAwayCleanly: gate.passed,
    problems: gate.passed ? [] : [...gate.failures],
  };
}

/**
 * **Nothing is measured about a candidate on a slot that shows the whole
 * picture**, and saying so is more use than inventing a number.
 *
 * The gate owns cutout quality and nothing else exists: no check compares the
 * picture against the idea it was generated from. That is recorded as the
 * substantive image defect in `docs/DECISION-image-config.md` and belongs to
 * Block 9, which owns the prompts.
 */
export function nothingIsMeasured(slot: Pick<ImageSlot, 'presentation'>): boolean {
  return !rendersAsCutout(slot);
}
