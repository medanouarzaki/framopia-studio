import { align, normalizeToken } from '@framopia/core';
import type { TranscriptWord } from './types.js';

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
): TranscriptWord[] {
  const pairs = align(
    draftWords.map((w) => normalizeToken(w.text)),
    correctedTexts.map((t) => normalizeToken(t)),
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
