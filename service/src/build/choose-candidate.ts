import type { ImageSlot } from '../editplan/types.js';

/**
 * Which candidate a slot builds with.
 *
 * **The gate advises; it never blocks** (user ruling, Block 8 session 31). A
 * verdict answers one question — is this matte clean enough to render as a
 * cutout — and ARCHITECTURE §5.4 makes its consequence a *presentation
 * fallback*, not a refusal. A rejected candidate is built exactly like any
 * other; on `vitasilk` eight of ten are rejected and all five slots build.
 *
 * The rule is written once because it is read twice: by the builder, which
 * places the file, and by the picker, which tells the user what the builder
 * would do. Those two disagreeing is how a build comes to differ from what the
 * screen says it will be.
 */
export type BuildChoiceReason = 'chosen' | 'first candidate, nothing chosen' | 'no candidates';

export interface BuildChoice {
  candidateId: string | null;
  reason: BuildChoiceReason;
}

/**
 * With nothing chosen the first candidate is used, whatever its verdict.
 *
 * That is a **documented placeholder from Block 7**, when the picker did not
 * exist — not a judgement that the first is best. Callers say which of the two
 * happened so a build nobody chose for is never mistaken for a choice.
 */
export function buildChoiceFor(slot: Pick<ImageSlot, 'candidates' | 'chosenCandidateId'>): BuildChoice {
  const chosen =
    slot.chosenCandidateId === null
      ? undefined
      : slot.candidates.find((c) => c.id === slot.chosenCandidateId);
  if (chosen !== undefined) return { candidateId: chosen.id, reason: 'chosen' };
  const first = slot.candidates[0];
  if (first === undefined) return { candidateId: null, reason: 'no candidates' };
  return { candidateId: first.id, reason: 'first candidate, nothing chosen' };
}
