import {
  ALIGN_VERDICTS,
  ALIGNMENT_CORRECT_VERDICTS,
  type AlignmentRow,
  type AlignReference,
  type AlignVerdict,
} from './align-review.js';

/**
 * Turns a hand-made reference alignment into a measurement.
 *
 * **The only non-circular measure of aligner correctness in this project.**
 * Everything here compares the aligner's behaviour against a human's verdicts;
 * nothing here reads the aligner's own record of what it did as ground truth.
 * That distinction is the whole point — `align.test.ts` asserts that a word's
 * interval is the interval of the token it *records* anchoring to, which passes
 * whether or not the pairing is right, because the record is self-consistent
 * with the pairing (docs/DEFECT-alignment-script-mismatch.md §A.4).
 *
 * A reference judges one aligner, at one git sha, over one cache entry. Scoring
 * it against a different pairing without saying so re-introduces exactly the
 * circularity it exists to remove, which is why the sha check is a refusal
 * rather than a warning.
 */

export class AlignScoreError extends Error {}

export interface VerdictTally {
  total: number;
  /** Pairings the two sides of which are in different scripts — where Levenshtein had no signal. */
  cross: number;
  same: number;
}

export interface AlignScore {
  reel: string;
  rowsTotal: number;
  rowsJudged: number;
  byVerdict: Record<AlignVerdict, VerdictTally>;
  /**
   * The headline: of the pairings a human has actually judged, the share whose
   * **alignment** he confirmed — `correct` plus `misheard`. Deliberately not
   * over all rows: an unjudged row is not evidence of anything, and dividing by
   * the whole reel would report a half-finished review as a bad aligner.
   *
   * The two are never folded together in what the tool prints. `misheard`
   * measures Scribe and `correct` measures the aligner, and a number that
   * hides which is which is the reason the verdict exists.
   */
  confirmedShare: number;
  /** Of the confirmed alignments, those whose draft token is the wrong word. */
  mishearCount: number;
}

function emptyTallies(): Record<AlignVerdict, VerdictTally> {
  const out = {} as Record<AlignVerdict, VerdictTally>;
  for (const v of ALIGN_VERDICTS) out[v] = { total: 0, cross: 0, same: 0 };
  return out;
}

/**
 * Every reference entry must name a row that exists and still carries the same
 * word. A reference written against a different transcript describes pairings
 * that are not on screen any more, and scoring the overlap would report a
 * number for a reel nobody reviewed.
 */
function indexRows(rows: readonly AlignmentRow[], reference: AlignReference): Map<string, AlignmentRow> {
  const byId = new Map(rows.map((r) => [r.wordId, r]));
  const missing: string[] = [];
  const changed: string[] = [];
  for (const entry of reference.entries) {
    const row = byId.get(entry.wordId);
    if (row === undefined) {
      missing.push(entry.wordId);
      continue;
    }
    if (row.wordText !== entry.wordText) {
      changed.push(`${entry.wordId} ("${entry.wordText}" -> "${row.wordText}")`);
    }
  }
  if (missing.length > 0 || changed.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) {
      parts.push(`${missing.length} reference word id(s) are not in the current pairing: ${missing.slice(0, 5).join(', ')}`);
    }
    if (changed.length > 0) {
      parts.push(`${changed.length} word(s) changed text: ${changed.slice(0, 5).join(', ')}`);
    }
    throw new AlignScoreError(
      `${reference.reel}: the reference does not describe this pairing. ${parts.join('; ')}. ` +
        'Regenerate the sheet and re-review rather than scoring the overlap.',
    );
  }
  return byId;
}

export function scoreAlignment(
  rows: readonly AlignmentRow[],
  reference: AlignReference,
): AlignScore {
  const byId = indexRows(rows, reference);
  const byVerdict = emptyTallies();

  /*
   * Schema 3 writes every displayed row, marked or not. An unmarked row is not
   * a judgement and must not become a denominator — it is the reviewer's
   * progress, not the aligner's accuracy.
   */
  const judged = reference.entries.filter((e) => e.verdict !== null);

  for (const entry of judged) {
    const row = byId.get(entry.wordId) as AlignmentRow;
    const tally = byVerdict[entry.verdict as AlignVerdict];
    tally.total += 1;
    if (row.crossScript) tally.cross += 1;
    else tally.same += 1;
  }

  const confirmed = ALIGNMENT_CORRECT_VERDICTS.reduce((n, v) => n + byVerdict[v].total, 0);
  return {
    reel: reference.reel,
    rowsTotal: rows.length,
    rowsJudged: judged.length,
    byVerdict,
    confirmedShare: judged.length === 0 ? 0 : confirmed / judged.length,
    mishearCount: byVerdict.misheard.total,
  };
}

export interface MovedRow {
  wordId: string;
  wordText: string;
  verdict: AlignVerdict;
  /** What the aligner paired this word with when the reference was made. */
  previousDraftText: string | null;
  /** What it pairs it with now. */
  currentDraftText: string | null;
  currentDraftStart: number | null;
  currentDraftEnd: number | null;
  crossScript: boolean;
  moved: boolean;
}

export interface AlignComparison {
  reel: string;
  score: AlignScore;
  /**
   * `wrong` rows that now pair differently. **Candidates, not repairs**: the
   * reference says the old pairing was wrong, and says nothing at all about
   * whether the new one is right. Only a second human pass over the re-review
   * sheet can turn this number into a result.
   */
  repairCandidates: MovedRow[];
  /**
   * `correct` **or `misheard`** rows that now pair differently. A human
   * confirmed the alignment on both, so every one of these is a regression.
   * Non-zero here is a finding, never a footnote.
   */
  regressions: MovedRow[];
  /**
   * `two-tokens` rows the change still cannot express. While `AlignmentRow`
   * names a single draft token this is every such row by construction: the
   * aligner has no many-to-one operation, so no change to its costs can
   * express a merge. The count falls only when the operation set grows.
   */
  stillInexpressible: MovedRow[];
  /** `wrong` rows that did not move. The change left these exactly as they were. */
  unrepaired: MovedRow[];
  /** `no-token` rows, moved or not, so the arithmetic closes over the reference. */
  noToken: MovedRow[];
  /** `correct` and `misheard` rows that did not move — what the change preserved. */
  held: MovedRow[];
}

export function compareAgainstReference(
  rows: readonly AlignmentRow[],
  reference: AlignReference,
): AlignComparison {
  const byId = indexRows(rows, reference);
  const score = scoreAlignment(rows, reference);

  const all: MovedRow[] = reference.entries
    .filter((e) => e.verdict !== null)
    .map((entry) => {
    const row = byId.get(entry.wordId) as AlignmentRow;
    return {
      wordId: entry.wordId,
      wordText: entry.wordText,
      verdict: entry.verdict as AlignVerdict,
      previousDraftText: entry.draftTokenText,
      currentDraftText: row.draftText,
      currentDraftStart: row.draftStart,
      currentDraftEnd: row.draftEnd,
      crossScript: row.crossScript,
      moved: row.draftText !== entry.draftTokenText,
      };
    });

  const of = (verdicts: readonly AlignVerdict[], moved: boolean | null): MovedRow[] =>
    all.filter((r) => verdicts.includes(r.verdict) && (moved === null || r.moved === moved));

  return {
    reel: reference.reel,
    score,
    repairCandidates: of(['wrong'], true),
    regressions: of(ALIGNMENT_CORRECT_VERDICTS, true),
    stillInexpressible: of(['two-tokens'], null),
    unrepaired: of(['wrong'], false),
    noToken: of(['no-token'], null),
    held: of(ALIGNMENT_CORRECT_VERDICTS, false),
  };
}

/** Every row the change moved, for the re-review sheet. */
export function movedRows(comparison: AlignComparison): MovedRow[] {
  const seen = new Set<string>();
  const out: MovedRow[] = [];
  for (const group of [
    comparison.regressions,
    comparison.repairCandidates,
    comparison.stillInexpressible,
    comparison.noToken,
  ]) {
    for (const row of group) {
      if (!row.moved || seen.has(row.wordId)) continue;
      seen.add(row.wordId);
      out.push(row);
    }
  }
  return out.sort((a, b) => a.wordId.localeCompare(b.wordId));
}
