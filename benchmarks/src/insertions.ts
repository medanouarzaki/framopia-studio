import { align } from '@framopia/core';
import { normalizeToken, splitScriptBoundaries } from './normalize.js';

/**
 * `normalizeForWer` flat-maps and filters, so a normalized index no longer
 * addresses the token it came from. Alignment reports its edits in normalized
 * space; naming the tokens behind them needs the provenance the normalizer
 * throws away, so it is rebuilt here by repeating the same steps one token at
 * a time. Kept beside the analysis rather than pushed into `normalize.ts`:
 * scoring has no use for it, and a second return value there would be read as
 * something WER depends on.
 */
export interface NormalizedWithProvenance {
  normalized: string[];
  /** For each normalized slot, the index of the source token it came from. */
  sourceIndex: number[];
}

export function normalizeWithProvenance(
  words: string[],
  numeralMap: (token: string) => string,
): NormalizedWithProvenance {
  const normalized: string[] = [];
  const sourceIndex: number[] = [];
  words.forEach((word, index) => {
    for (const piece of splitScriptBoundaries(word)) {
      const token = normalizeToken(piece);
      if (token.length === 0) continue;
      normalized.push(numeralMap(token));
      sourceIndex.push(index);
    }
  });
  return { normalized, sourceIndex };
}

export interface EditToken {
  /** The token as written, before normalization. */
  text: string;
  /** What alignment actually compared, which is what made this an edit. */
  normalized: string;
  index: number;
  before: string[];
  after: string[];
}

export interface InsertedToken extends EditToken {
  startS: number | null;
  endS: number | null;
  lang: string | null;
  script: string;
  onFreezeList: boolean;
  /**
   * True where alignment interpolated the timing instead of inheriting a
   * Scribe slot. Every inserted token is a candidate for this by definition —
   * Scribe did not emit it — so the flag says whether the timestamp is
   * measured or inferred, which decides how tightly the audio can be cued.
   */
  interpolatedTiming: boolean;
}

export interface EditAnalysis {
  inserted: InsertedToken[];
  deleted: EditToken[];
  matches: number;
  substitutions: number;
}

export interface AnalysisWord {
  text: string;
  startS: number | null;
  endS: number | null;
  lang: string | null;
  script: string;
  confidence: number | null;
}

const CONTEXT = 3;

function context(words: string[], index: number): { before: string[]; after: string[] } {
  return {
    before: words.slice(Math.max(0, index - CONTEXT), index),
    after: words.slice(index + 1, index + 1 + CONTEXT),
  };
}

export interface AnalyseOptions {
  hypothesis: AnalysisWord[];
  reference: string[];
  freezeList: Set<string>;
  numeralMap: (token: string) => string;
}

/**
 * Insertions and deletions named in source tokens rather than in normalized
 * slots. Substitutions are counted but not listed: a substitution has a
 * reference word behind it, so it is a spelling or hearing question rather
 * than the "did the model invent this" question the analysis exists for.
 */
export function analyseEdits(options: AnalyseOptions): EditAnalysis {
  const { hypothesis, reference, freezeList, numeralMap } = options;
  const hypText = hypothesis.map((w) => w.text);
  const hyp = normalizeWithProvenance(hypText, numeralMap);
  const ref = normalizeWithProvenance(reference, numeralMap);

  const inserted: InsertedToken[] = [];
  const deleted: EditToken[] = [];
  let matches = 0;
  let substitutions = 0;

  for (const pair of align(ref.normalized, hyp.normalized)) {
    if (pair.op === 'match') {
      matches += 1;
    } else if (pair.op === 'substitute') {
      substitutions += 1;
    } else if (pair.op === 'insert' && pair.hypIndex !== null) {
      const source = hyp.sourceIndex[pair.hypIndex] as number;
      const word = hypothesis[source] as AnalysisWord;
      const normalized = hyp.normalized[pair.hypIndex] as string;
      inserted.push({
        text: word.text,
        normalized,
        index: source,
        ...context(hypText, source),
        startS: word.startS,
        endS: word.endS,
        lang: word.lang,
        script: word.script,
        onFreezeList: freezeList.has(normalized) || freezeList.has(normalizeToken(word.text)),
        interpolatedTiming: word.confidence === null,
      });
    } else if (pair.op === 'delete' && pair.refIndex !== null) {
      const source = ref.sourceIndex[pair.refIndex] as number;
      deleted.push({
        text: reference[source] as string,
        normalized: ref.normalized[pair.refIndex] as string,
        index: source,
        ...context(reference, source),
      });
    }
  }

  return { inserted, deleted, matches, substitutions };
}
