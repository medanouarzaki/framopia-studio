import { normalizeToken, normalizeWords, splitScriptBoundaries } from './normalize.js';
import type { GroundTruthWord, Lang } from './types.js';

export type AlignOp = 'match' | 'substitute' | 'insert' | 'delete';

export interface AlignedPair {
  op: AlignOp;
  // Index into the reference array, or null for an insertion.
  refIndex: number | null;
  // Index into the hypothesis array, or null for a deletion.
  hypIndex: number | null;
}

/**
 * Standard Levenshtein alignment with backtrace, operating on already
 * normalized tokens. Substitution/insertion/deletion all cost 1; matches
 * cost 0. Ties in backtrace prefer match > substitute > delete > insert,
 * which keeps alignments intuitive for the hybrid anchor logic.
 */
export function align(reference: string[], hypothesis: string[]): AlignedPair[] {
  const n = reference.length;
  const m = hypothesis.length;

  const dist: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i += 1) dist[i]![0] = i;
  for (let j = 0; j <= m; j += 1) dist[0]![j] = j;

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      if (reference[i - 1] === hypothesis[j - 1]) {
        dist[i]![j] = dist[i - 1]![j - 1]!;
      } else {
        dist[i]![j] = 1 + Math.min(dist[i - 1]![j - 1]!, dist[i - 1]![j]!, dist[i]![j - 1]!);
      }
    }
  }

  const pairs: AlignedPair[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && reference[i - 1] === hypothesis[j - 1]) {
      pairs.push({ op: 'match', refIndex: i - 1, hypIndex: j - 1 });
      i -= 1;
      j -= 1;
    } else if (i > 0 && j > 0 && dist[i]![j] === dist[i - 1]![j - 1]! + 1) {
      pairs.push({ op: 'substitute', refIndex: i - 1, hypIndex: j - 1 });
      i -= 1;
      j -= 1;
    } else if (i > 0 && dist[i]![j] === dist[i - 1]![j]! + 1) {
      pairs.push({ op: 'delete', refIndex: i - 1, hypIndex: null });
      i -= 1;
    } else {
      pairs.push({ op: 'insert', refIndex: null, hypIndex: j - 1 });
      j -= 1;
    }
  }

  return pairs.reverse();
}

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
  return scoreAlignment(align(normalizeWords(reference), normalizeWords(hypothesis)));
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
  const normRef = splitReference.map((w) => normalizeToken(w.text));
  const normHyp = normalizeWords(hypothesis);

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
