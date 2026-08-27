import {
  align,
  DEFAULT_ALIGN_COSTS,
  normalizeToken,
  TRANSLITERATION_COSTS,
  type AlignCosts,
} from '@framopia/core';
import type { TranscriptWord } from './types.js';

/**
 * Which substitution cost the anchoring uses.
 *
 * **`transliteration` is the default, adopted 2026-08-28 on the user's ruling.**
 * Scribe returns Arabic script and the correction pass returns Arabizi, so
 * under a flat cost every cross-script pair scores exactly 1: the comparison
 * carries no information at all, whole runs tie, and the backtrace's
 * preference order decides which draft token each word gets. Scoring the pair
 * against ORTHOGRAPHY_GUIDE §2's character table gives it a minimum to find —
 * `mn`/`من` costs 0.2 where `mn`/`غير` costs 1.
 *
 * The evidence is the two hand-made references in `benchmarks/references/align/`:
 * the change moved 16 of the 18 pairings the user had marked wrong and **not
 * one** of the 54 he had marked correct, and his second pass over those 17 rows
 * returned 7 correct, 2 misheard, 7 wrong and 1 left unjudged — nine repaired,
 * none damaged.
 *
 * **`legacy` is the flat model, kept selectable** the way prompt version 2
 * stays selectable in `correction.ts`: it is what every figure recorded before
 * Block 8 part 2 was measured with, and a comparison against those numbers has
 * to be able to reproduce them. Nothing in the pipeline passes it.
 */
export type AlignCostModel = 'transliteration' | 'legacy';

export const ALIGN_COST_MODELS: Record<AlignCostModel, AlignCosts> = {
  transliteration: TRANSLITERATION_COSTS,
  legacy: DEFAULT_ALIGN_COSTS,
};

export const ACTIVE_ALIGN_COST_MODEL: AlignCostModel = 'transliteration';

/**
 * Places the corrected word texts onto the draft's timings.
 *
 * Anchoring is Levenshtein alignment over normalized tokens. A corrected word
 * that matched or substituted a draft word inherits that word's timing
 * directly — a spelling fix does not move a word in time. A run of corrected
 * words with no draft anchor (the correction pass split or inserted) is spread
 * linearly across the gap between the surviving anchors on either side.
 * Draft words the correction pass deleted simply do not appear.
 *
 * The substitution cost is transliteration-aware — see `ACTIVE_ALIGN_COST_MODEL`
 * above. A caller may pass `legacy` to reproduce a figure recorded before that
 * was adopted, and nothing in the pipeline does.
 *
 * Confidence is Scribe's acoustic confidence for the slot the word anchored
 * to, carried through unchanged. It describes how clearly that stretch of
 * audio was heard, not how right the corrected spelling is — a substitution
 * is almost always transliteration, and the slot was still measured. A word
 * with no anchor was never measured, so its confidence is **null** rather
 * than an interpolated number: interpolating a timing between two anchors is
 * arithmetic, interpolating a confidence would be invention.
 */
export function alignCorrectedOntoDraft(
  draftWords: TranscriptWord[],
  correctedTexts: string[],
  costModel: AlignCostModel = ACTIVE_ALIGN_COST_MODEL,
): TranscriptWord[] {
  const pairs = align(
    draftWords.map((w) => normalizeToken(w.text)),
    correctedTexts.map((t) => normalizeToken(t)),
    ALIGN_COST_MODELS[costModel],
  );

  const output: (TranscriptWord | null)[] = new Array(correctedTexts.length).fill(null);

  for (const pair of pairs) {
    if (pair.hypIndex === null) continue;
    if (pair.op !== 'match' && pair.op !== 'substitute') continue;
    const anchor = draftWords[pair.refIndex as number];
    if (anchor === undefined) continue;
    output[pair.hypIndex] = {
      text: correctedTexts[pair.hypIndex]!,
      start: anchor.start,
      end: anchor.end,
      confidence: anchor.confidence,
      sourceText: anchor.text,
    };
  }

  for (let i = 0; i < output.length; i += 1) {
    if (output[i] !== null) continue;

    let prevIdx = i - 1;
    while (prevIdx >= 0 && output[prevIdx] === null) prevIdx -= 1;
    let nextIdx = i + 1;
    while (nextIdx < output.length && output[nextIdx] === null) nextIdx += 1;

    const prevWord = prevIdx >= 0 ? output[prevIdx] : null;
    const nextWord = nextIdx < output.length ? output[nextIdx] : null;

    let timing: number | null;
    if (prevWord?.end != null && nextWord?.start != null) {
      const gapSteps = nextIdx - prevIdx;
      const position = i - prevIdx;
      const span = nextWord.start - prevWord.end;
      timing = prevWord.end + (span * position) / gapSteps;
    } else if (prevWord?.end != null) {
      timing = prevWord.end;
    } else if (nextWord?.start != null) {
      timing = nextWord.start;
    } else {
      timing = null;
    }

    output[i] = { text: correctedTexts[i]!, start: timing, end: timing, confidence: null };
  }

  return output as TranscriptWord[];
}
