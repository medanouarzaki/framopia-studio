import type { RemovedReason } from '../editplan/types.js';

/**
 * ORTHOGRAPHY_GUIDE §7, applied as flags. Nothing here deletes a word: a
 * marked word stays in the plan, keeps its timing, and simply does not
 * display. The panel can unmark it.
 */

/** §7 fillers. Only the two the guide names outright. */
const FILLERS = new Set(['euh', 'eh']);

/**
 * §7 also lists `ya3ni`/`za3ma` as fillers "used as hesitation", kept when
 * they introduce an actual explanation. That distinction is semantic and
 * nothing in the data available here — text, timings, Scribe confidence —
 * separates the two uses. They are therefore never marked: leaving a
 * hesitation visible is a smaller error than deleting an explanation, and a
 * coin flip dressed as a rule is worse than both.
 */
export const UNJUDGED_FILLERS = new Set(['ya3ni', 'za3ma']);

const EDGE_PUNCTUATION_RE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(EDGE_PUNCTUATION_RE, '');
}

/** A trailing hyphen is how a cut-off fragment is written: `l-` before `lmochkil`. */
function isCutOffFragment(text: string): boolean {
  return /-$/.test(text.trim());
}

export interface CleaningMark {
  index: number;
  reason: RemovedReason;
}

export interface CleaningResult {
  marks: CleaningMark[];
  /** Words left alone that a semantic pass might still want to judge. */
  unjudged: { index: number; text: string }[];
}

/**
 * Marks fillers and immediate stutters. Abandoned false starts that are not
 * an immediate repetition — a speaker starting a different sentence and
 * restarting — need to know what the speaker meant, so they are not
 * attempted; §7's own example of a false start is the repetition case, which
 * is covered.
 */
export function findCleaningMarks(texts: string[]): CleaningResult {
  const marks: CleaningMark[] = [];
  const unjudged: { index: number; text: string }[] = [];

  for (let i = 0; i < texts.length; i += 1) {
    const raw = texts[i]!;
    const text = normalize(raw);
    if (text.length === 0) continue;

    if (FILLERS.has(text)) {
      marks.push({ index: i, reason: 'filler' });
      continue;
    }
    if (UNJUDGED_FILLERS.has(text)) {
      unjudged.push({ index: i, text: raw });
      continue;
    }

    // A cut-off fragment is a stutter when the word it was reaching for
    // follows it: "l- l- lmochkil" marks both fragments, keeps lmochkil.
    if (isCutOffFragment(raw)) {
      const stem = text;
      const next = texts.slice(i + 1).find((t) => normalize(t).length > 0 && !isCutOffFragment(t));
      if (next !== undefined && normalize(next).startsWith(stem)) {
        marks.push({ index: i, reason: 'stutter' });
      }
      continue;
    }

    // An immediate repetition of the same word: mark the earlier one, keep
    // the last, so the surviving word carries the timing the speaker landed on.
    const next = texts[i + 1];
    if (next !== undefined && normalize(next) === text) {
      marks.push({ index: i, reason: 'stutter' });
    }
  }

  return { marks, unjudged };
}
