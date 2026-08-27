import { align, DEFAULT_ALIGN_COSTS, type AlignCosts, type AlignOp } from './align.js';
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
  costs: AlignCosts = DEFAULT_ALIGN_COSTS,
): AlignmentRow[] {
  const pairs = align(
    draft.map((w) => normalizeToken(w.text)),
    correctedTexts.map((t) => normalizeToken(t)),
    costs,
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

/**
 * 2 adds the `misheard` verdict. Version 1 files stay valid and are read
 * without migration — they simply contain no `misheard` rows, which is the
 * truth about them: nobody was offered the button.
 */
/**
 * 3 changes the download contract: the file carries **one entry per displayed
 * row**, in display order, an unmarked row written with `verdict: null` rather
 * than omitted, plus `rowCount` and `markedCount` in the header.
 *
 * It exists because omission was indistinguishable from absence. A sheet of 17
 * rows, all marked on screen, downloaded 3 — and nothing in the file said the
 * other 14 had ever been displayed. Versions 1 and 2 stay readable: their
 * entries are all judged, which is what "no null verdicts" means.
 */
export const ALIGN_REFERENCE_SCHEMA_VERSION = 3;
export const ALIGN_REFERENCE_READABLE_VERSIONS = [1, 2, 3] as const;

/**
 * The four judgements a reviewer can make. `two-tokens` and `no-token` exist
 * because the aligner has no operation for either: it cannot pair one
 * corrected word with two draft tokens (`ستة` + `وعشرين` → `26`), and an
 * inserted word has no token at all. A reference that could only say
 * correct/wrong would record those as ordinary errors and lose what they are.
 */
export type AlignVerdict = 'correct' | 'wrong' | 'misheard' | 'two-tokens' | 'no-token';

export const ALIGN_VERDICTS: readonly AlignVerdict[] = [
  'correct',
  'wrong',
  'misheard',
  'two-tokens',
  'no-token',
];

/**
 * Verdicts that say the aligner put the word in the right place.
 *
 * `misheard` belongs here and is still counted on its own line: the pairing is
 * correct and the draft token is a different word from the one spoken, which
 * measures Scribe, not the aligner. Folding it into `correct` would hide a
 * transcription problem inside an alignment score; calling it `wrong` would
 * blame the aligner for hearing. The user marked `msbsb`/`مصبوغ` and
 * `siri`/`ديري` first one way and then the other, and neither was what he
 * meant.
 */
export const ALIGNMENT_CORRECT_VERDICTS: readonly AlignVerdict[] = ['correct', 'misheard'];

export interface AlignReferenceEntry {
  wordId: string;
  wordText: string;
  /** The token the aligner proposed, kept so a reference records what was judged. */
  draftTokenText: string | null;
  /**
   * Null from schema 3 on: the row was displayed and left unmarked. Omitting
   * it instead is what let seventeen judgements become three.
   */
  verdict: AlignVerdict | null;
  note?: string;
}

export interface AlignReference {
  schemaVersion: number;
  reel: string;
  generatedAt: string;
  /**
   * The repo HEAD when the sheet was generated. Provenance: it says which
   * commit a human was looking at. It is a poor drift test on its own, because
   * it changes when anything in the repo changes.
   */
  headSha: string;
  /**
   * A hash of the modules that produce a pairing (`alignerHash` in
   * `core/src/aligner-hash.ts`). **Optional with a default**: references
   * written before it existed carry only `headSha` and are read without
   * migration.
   */
  alignerHash?: string;
  /**
   * Rows displayed and rows marked, from schema 3. **Written by the same walk
   * that produced the entries**, so they cannot describe a different file.
   * Optional with a default so versions 1 and 2 still read.
   */
  rowCount?: number;
  markedCount?: number;
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
  const version = raw['schemaVersion'];
  if (!(ALIGN_REFERENCE_READABLE_VERSIONS as readonly number[]).includes(version)) {
    throw new AlignReferenceError(
      `unknown schemaVersion ${String(version)}; this build reads ` +
        `${ALIGN_REFERENCE_READABLE_VERSIONS.join(' and ')}`,
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
    if (verdict === null && version < 3) {
      throw new AlignReferenceError(
        `entries[${i}].verdict is null, which schemaVersion ${version} does not define`,
      );
    }
    if (verdict !== null && (typeof verdict !== 'string' || !ALIGN_VERDICTS.includes(verdict as AlignVerdict))) {
      throw new AlignReferenceError(`entries[${i}].verdict is not one of ${ALIGN_VERDICTS.join(', ')}`);
    }
    if (verdict === 'misheard' && version < 2) {
      throw new AlignReferenceError(
        `entries[${i}].verdict is "misheard", which schemaVersion ${version} does not define`,
      );
    }
    const draftTokenText = e['draftTokenText'];
    if (draftTokenText !== null && typeof draftTokenText !== 'string') {
      throw new AlignReferenceError(`entries[${i}].draftTokenText is neither a string nor null`);
    }
    const entry: AlignReferenceEntry = {
      wordId: requireString(e['wordId'], `entries[${i}].wordId`),
      wordText: requireString(e['wordText'], `entries[${i}].wordText`),
      draftTokenText,
      verdict: verdict as AlignVerdict | null,
    };
    if (typeof e['note'] === 'string' && e['note'].length > 0) entry.note = e['note'];
    return entry;
  });

  const alignerHash = raw['alignerHash'];
  if (alignerHash !== undefined && typeof alignerHash !== 'string') {
    throw new AlignReferenceError('alignerHash is present but not a string');
  }

  /*
   * The file keeps the version it was written at. Rewriting a v1 file as v2 on
   * read would claim the reviewer was offered `misheard` when he was not.
   */
  const reference: AlignReference = {
    schemaVersion: version,
    reel,
    generatedAt,
    headSha,
    entries,
  };
  if (typeof alignerHash === 'string' && alignerHash.length > 0) {
    reference.alignerHash = alignerHash;
  }

  /*
   * The header must describe the file it arrived in. A count that disagrees
   * with the entries is the failure this version exists to prevent, so it is
   * rejected rather than corrected.
   */
  if (raw['rowCount'] !== undefined) {
    if (raw['rowCount'] !== entries.length) {
      throw new AlignReferenceError(
        `rowCount says ${String(raw['rowCount'])} but the file carries ${entries.length} entries`,
      );
    }
    reference.rowCount = entries.length;
  }
  if (raw['markedCount'] !== undefined) {
    const marked = entries.filter((e) => e.verdict !== null).length;
    if (raw['markedCount'] !== marked) {
      throw new AlignReferenceError(
        `markedCount says ${String(raw['markedCount'])} but ${marked} entries carry a verdict`,
      );
    }
    reference.markedCount = marked;
  }
  return reference;
}

export function serializeAlignReference(reference: AlignReference): string {
  return `${JSON.stringify(reference, null, 2)}\n`;
}

export { renderSheet, type SheetInputs, type SheetRow } from './align-sheet.js';
export {
  DEFAULT_ALIGN_COSTS,
  EXPENSIVE_INSERT_COSTS,
  TRANSLITERATION_COSTS,
  type AlignCosts,
} from './align.js';
