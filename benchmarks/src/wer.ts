import { align, type AlignedPair } from '@framopia/core';
import { normalizeForWer, splitScriptBoundaries } from './normalize.js';
import type { GroundTruthWord, Lang } from './types.js';

// Re-exported so the benchmark keeps one import path for alignment.
export { align };
export type { AlignedPair, AlignOp } from '@framopia/core';

export interface WerResult {
  wer: number;
  substitutions: number;
  insertions: number;
  deletions: number;
  matches: number;
  referenceCount: number;
}

export function scoreAlignment(pairs: AlignedPair[]): WerResult {
  let substitutions = 0;
  let insertions = 0;
  let deletions = 0;
  let matches = 0;

  for (const pair of pairs) {
    if (pair.op === 'match') matches += 1;
    else if (pair.op === 'substitute') substitutions += 1;
    else if (pair.op === 'insert') insertions += 1;
    else deletions += 1;
  }

  const referenceCount = matches + substitutions + deletions;
  const wer = referenceCount === 0 ? 0 : (substitutions + insertions + deletions) / referenceCount;

  return { wer, substitutions, insertions, deletions, matches, referenceCount };
}

export function computeWer(reference: string[], hypothesis: string[]): WerResult {
  return scoreAlignment(align(normalizeForWer(reference), normalizeForWer(hypothesis)));
}

const ARABIC_SCRIPT_RE = /[؀-ۿ]/;

/**
 * Splits any reference word that joins two scripts into one entry per script,
 * mirroring what normalizeWords does to the hypothesis. Each piece keeps the
 * original lang tag unless it is Arabic script, which is msa by definition.
 * The tagger already emits split words, so this is normally a no-op — it
 * exists so a hand-edited ground truth cannot silently desynchronize the
 * lang index mapping below.
 */
function splitReferenceWords(referenceWords: GroundTruthWord[]): GroundTruthWord[] {
  return referenceWords.flatMap((word) =>
    splitScriptBoundaries(word.text).map((piece) =>
      ARABIC_SCRIPT_RE.test(piece)
        ? { text: piece, lang: 'msa' as Lang, script: 'arabic' as const }
        : { ...word, text: piece },
    ),
  );
}

/**
 * WER restricted to reference words with the given lang tags, e.g. the
 * code-switched (fr/en) subset or the darija subset. Alignment still runs
 * over the full sequences (so context around a code-switch is preserved),
 * but only reference positions matching `langs` count toward the score;
 * insertions are excluded since they have no reference lang tag.
 */
export function computeSubsetWer(
  referenceWords: GroundTruthWord[],
  hypothesis: string[],
  langs: Lang[],
): WerResult {
  const splitReference = splitReferenceWords(referenceWords);
  // Each reference word maps to exactly one normalized slot here (empty ones
  // filtered below), so the reference goes through normalizeForWer one word
  // at a time — splitReference has already done the script splitting.
  const normRef = splitReference.map((w) => normalizeForWer([w.text])[0] ?? '');
  const normHyp = normalizeForWer(hypothesis);

  // Track which normalized-reference indices survive the empty-token filter
  // used by computeWer, so refIndex from align() still maps to langs.
  const keptRefIndices: number[] = [];
  const filteredNormRef: string[] = [];
  normRef.forEach((token, idx) => {
    if (token.length > 0) {
      keptRefIndices.push(idx);
      filteredNormRef.push(token);
    }
  });

  const pairs = align(filteredNormRef, normHyp);
  const langSet = new Set<Lang>(langs);

  const subsetPairs = pairs.filter((pair) => {
    if (pair.refIndex === null) return false;
    const originalIndex = keptRefIndices[pair.refIndex];
    const word = splitReference[originalIndex as number];
    return word !== undefined && langSet.has(word.lang);
  });

  return scoreAlignment(subsetPairs);
}
