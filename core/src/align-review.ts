import { align, type AlignOp } from './align.js';
import { normalizeToken } from './normalize.js';

/**
 * The data behind the alignment review sheet: what the current aligner paired
 * with what, so a human can say whether each pairing is real.
 *
 * This exists because no checker reading the aligner's own output can tell
 * whether the pairing is right — see docs/DEFECT-alignment-script-mismatch.md
 * §4. The aligner always gives a word the interval of the token it records
 * anchoring to; it records the wrong token. The only non-circular measure is a
 * human correspondence, and this module produces the rows that get judged and
 * parses the file that comes back.
 *
 * Nothing here decides whether a pairing is correct. It reports the aligner's
 * own operations and leaves the verdict empty.
 */

/**
 * The same class tagging.ts uses to derive `script` on a plan word. Arabic
 * script and Arabizi are the only two the corpus contains; a token with no
 * letter of either falls to `latin`, which is what a bare numeral is.
 */
const ARABIC_SCRIPT_RE = /[؀-ۿݐ-ݿ]/;

export type TokenScript = 'arabic' | 'latin';

export function tokenScript(text: string): TokenScript {
  return ARABIC_SCRIPT_RE.test(text) ? 'arabic' : 'latin';
}

/** A `type: "word"` entry of a cached Scribe response. */
export interface DraftToken {
  text: string;
  start: number;
  end: number;
}

export interface AlignmentRow {
  /** Index into the corrected words, which is also the plan's word order. */
  index: number;
  /** `w0000`-style, matching plan-builder's ids so a row names a plan word. */
  wordId: string;
  wordText: string;
  wordScript: TokenScript;
  /**
   * The operation the aligner emitted for this corrected word. `insert` means
   * it paired the word with no draft token at all, so every draft field below
   * is null — that is the aligner's answer, not a missing measurement.
   */
  op: AlignOp;
  draftIndex: number | null;
  draftText: string | null;
  draftScript: TokenScript | null;
  draftStart: number | null;
  draftEnd: number | null;
  /**
   * True when the two sides are in different scripts. Those are the pairings
   * Levenshtein had no signal on: `normalizeToken('mn')` and
   * `normalizeToken('من')` are never equal, so every candidate in such a run
   * costs the same and the path among the ties is arbitrary.
   */
  crossScript: boolean;
}

export function wordId(index: number): string {
  return `w${String(index).padStart(4, '0')}`;
}

/**
 * Runs the current aligner, unmodified, and reports what it did per corrected
 * word. A corrected word the aligner deleted cannot appear here — a delete
 * consumes a draft token and produces no corrected word — so the row count is
 * always the corrected word count.
 */
export function buildAlignmentRows(
  draft: readonly DraftToken[],
  correctedTexts: readonly string[],
): AlignmentRow[] {
  const pairs = align(
    draft.map((w) => normalizeToken(w.text)),
    correctedTexts.map((t) => normalizeToken(t)),
  );

  const rows: AlignmentRow[] = correctedTexts.map((text, index) => ({
    index,
    wordId: wordId(index),
    wordText: text,
    wordScript: tokenScript(text),
    op: 'insert',
    draftIndex: null,
    draftText: null,
    draftScript: null,
    draftStart: null,
    draftEnd: null,
    crossScript: false,
  }));

  for (const pair of pairs) {
    if (pair.hypIndex === null) continue;
    const row = rows[pair.hypIndex];
    if (row === undefined) continue;
    row.op = pair.op;
    if (pair.op !== 'match' && pair.op !== 'substitute') continue;
    const anchor = pair.refIndex === null ? undefined : draft[pair.refIndex];
    if (anchor === undefined) continue;
    row.draftIndex = pair.refIndex;
    row.draftText = anchor.text;
    row.draftScript = tokenScript(anchor.text);
    row.draftStart = anchor.start;
    row.draftEnd = anchor.end;
    row.crossScript = row.draftScript !== row.wordScript;
  }

  return rows;
}

export const ALIGN_REFERENCE_SCHEMA_VERSION = 1;

/**
 * The four judgements a reviewer can make. `two-tokens` and `no-token` exist
 * because the aligner has no operation for either: it cannot pair one
 * corrected word with two draft tokens (`ستة` + `وعشرين` → `26`), and an
 * inserted word has no token at all. A reference that could only say
 * correct/wrong would record those as ordinary errors and lose what they are.
 */
export type AlignVerdict = 'correct' | 'wrong' | 'two-tokens' | 'no-token';

export const ALIGN_VERDICTS: readonly AlignVerdict[] = [
  'correct',
  'wrong',
  'two-tokens',
  'no-token',
];

export interface AlignReferenceEntry {
  wordId: string;
  wordText: string;
  /** The token the aligner proposed, kept so a reference records what was judged. */
  draftTokenText: string | null;
  verdict: AlignVerdict;
  note?: string;
}

export interface AlignReference {
  schemaVersion: number;
  reel: string;
  generatedAt: string;
  /**
   * The repo HEAD when the sheet was generated. A reference judges one
   * aligner; without this the file cannot say which one, and a later reader
   * would take a judgement of the old pairing as a judgement of the new.
   */
  headSha: string;
  entries: AlignReferenceEntry[];
}

export class AlignReferenceError extends Error {}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AlignReferenceError(`${field} is missing or not a non-empty string`);
  }
  return value;
}

export function parseAlignReference(input: unknown): AlignReference {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new AlignReferenceError('reference is not an object');
  }
  const raw = input as Record<string, unknown>;

  if (typeof raw['schemaVersion'] !== 'number') {
    throw new AlignReferenceError('schemaVersion is missing or not a number');
  }
  if (raw['schemaVersion'] !== ALIGN_REFERENCE_SCHEMA_VERSION) {
    throw new AlignReferenceError(
      `unknown schemaVersion ${String(raw['schemaVersion'])}; this build reads ${ALIGN_REFERENCE_SCHEMA_VERSION}`,
    );
  }

  const reel = requireString(raw['reel'], 'reel');
  const generatedAt = requireString(raw['generatedAt'], 'generatedAt');
  const headSha = requireString(raw['headSha'], 'headSha');

  if (!Array.isArray(raw['entries'])) {
    throw new AlignReferenceError('entries is missing or not an array');
  }

  const entries = raw['entries'].map((item, i): AlignReferenceEntry => {
    if (typeof item !== 'object' || item === null) {
      throw new AlignReferenceError(`entries[${i}] is not an object`);
    }
    const e = item as Record<string, unknown>;
    const verdict = e['verdict'];
    if (typeof verdict !== 'string' || !ALIGN_VERDICTS.includes(verdict as AlignVerdict)) {
      throw new AlignReferenceError(`entries[${i}].verdict is not one of ${ALIGN_VERDICTS.join(', ')}`);
    }
    const draftTokenText = e['draftTokenText'];
    if (draftTokenText !== null && typeof draftTokenText !== 'string') {
      throw new AlignReferenceError(`entries[${i}].draftTokenText is neither a string nor null`);
    }
    const entry: AlignReferenceEntry = {
      wordId: requireString(e['wordId'], `entries[${i}].wordId`),
      wordText: requireString(e['wordText'], `entries[${i}].wordText`),
      draftTokenText,
      verdict: verdict as AlignVerdict,
    };
    if (typeof e['note'] === 'string' && e['note'].length > 0) entry.note = e['note'];
    return entry;
  });

  return { schemaVersion: ALIGN_REFERENCE_SCHEMA_VERSION, reel, generatedAt, headSha, entries };
}

export function serializeAlignReference(reference: AlignReference): string {
  return `${JSON.stringify(reference, null, 2)}\n`;
}

export { renderSheet, type SheetInputs, type SheetRow } from './align-sheet.js';
