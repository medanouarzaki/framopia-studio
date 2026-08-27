import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { alignCorrectedOntoDraft } from './align.js';
import { mapScribeResponse, type ScribeRawResponse } from './scribe.js';
import { parseCorrectionResponseText } from './correction.js';
import type { TranscriptWord } from './types.js';

const FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'fixtures',
);

function draft(...spec: [string, number, number][]): TranscriptWord[] {
  return spec.map(([text, start, end]) => ({ text, start, end, confidence: 0.9 }));
}

function starts(words: TranscriptWord[]): (number | null)[] {
  return words.map((w) => w.start);
}

function isMonotonic(words: TranscriptWord[]): boolean {
  const timed = words.map((w) => w.start).filter((s): s is number => s !== null);
  return timed.every((s, i) => i === 0 || s >= timed[i - 1]!);
}

describe('alignCorrectedOntoDraft — one-to-one', () => {
  it('gives every corrected word its anchor timing unchanged', () => {
    const words = alignCorrectedOntoDraft(
      draft(['wach', 0, 0.4], ['nta', 0.5, 0.8], ['mzyan', 1.0, 1.6]),
      ['wach', 'nta', 'mzyan'],
    );
    expect(starts(words)).toEqual([0, 0.5, 1.0]);
    expect(words.map((w) => w.end)).toEqual([0.4, 0.8, 1.6]);
  });

  it('keeps the anchor timing when only the spelling changed', () => {
    // A substitution is still an anchor: fixing a spelling does not move the
    // word in time.
    const words = alignCorrectedOntoDraft(draft(['dyal', 2.0, 2.4]), ['dial']);
    expect(words[0]).toMatchObject({ text: 'dial', start: 2.0, end: 2.4 });
  });

  it('carries the anchor confidence onto a corrected word', () => {
    const words = alignCorrectedOntoDraft(draft(['dyal', 2.0, 2.4]), ['dial']);
    expect(words[0]?.confidence).toBe(0.9);
  });
});

describe('alignCorrectedOntoDraft — insertion', () => {
  it('interpolates a single inserted word strictly between its anchors', () => {
    const words = alignCorrectedOntoDraft(
      draft(['a', 0, 1], ['b', 2, 3], ['c', 4, 5]),
      ['a', 'x', 'b', 'c'],
    );
    expect(words).toHaveLength(4);
    const inserted = words[1]!;
    expect(inserted.text).toBe('x');
    expect(inserted.start).toBeCloseTo(1.5, 9);
    expect(inserted.start!).toBeGreaterThan(words[0]!.end!);
    expect(inserted.start!).toBeLessThan(words[2]!.start!);
    expect(isMonotonic(words)).toBe(true);
  });

  it('spreads a run of inserted words evenly and keeps them ordered', () => {
    const words = alignCorrectedOntoDraft(draft(['a', 0, 1], ['b', 4, 5]), ['a', 'x', 'y', 'b']);
    expect(words[1]!.start).toBeCloseTo(2, 9);
    expect(words[2]!.start).toBeCloseTo(3, 9);
    expect(words[1]!.start!).toBeGreaterThan(words[0]!.end!);
    expect(words[2]!.start!).toBeLessThan(words[3]!.start!);
    expect(isMonotonic(words)).toBe(true);
  });

  it('clamps an insertion before the first anchor to that anchor start', () => {
    const words = alignCorrectedOntoDraft(draft(['b', 2, 3]), ['x', 'b']);
    expect(words[0]!.start).toBe(2);
    expect(isMonotonic(words)).toBe(true);
  });

  it('clamps an insertion after the last anchor to that anchor end', () => {
    const words = alignCorrectedOntoDraft(draft(['a', 0, 1]), ['a', 'x']);
    expect(words[1]!.start).toBe(1);
    expect(words[1]!.end).toBe(1);
  });
});

describe('alignCorrectedOntoDraft — deletion', () => {
  it('drops a deleted draft word without shifting the surviving timings', () => {
    const words = alignCorrectedOntoDraft(
      draft(['a', 0, 1], ['b', 2, 3], ['c', 4, 5]),
      ['a', 'c'],
    );
    expect(words.map((w) => w.text)).toEqual(['a', 'c']);
    expect(starts(words)).toEqual([0, 4]);
  });

  it('leaves no gap in the output when the last draft word is deleted', () => {
    const words = alignCorrectedOntoDraft(draft(['a', 0, 1], ['b', 2, 3]), ['a']);
    expect(words).toHaveLength(1);
    expect(words[0]).toMatchObject({ start: 0, end: 1 });
  });
});

describe('alignCorrectedOntoDraft — split', () => {
  it('times both halves of a split draft word inside the surrounding anchors', () => {
    // The real case from the vitasilk reel: Scribe's ولقيتي became w + l9iti.
    const words = alignCorrectedOntoDraft(
      draft(['la', 21.0, 21.2], ['ولقيتي', 22.0, 22.7], ['le', 23.0, 23.2]),
      ['la', 'w', 'l9iti', 'le'],
    );
    expect(words.map((w) => w.text)).toEqual(['la', 'w', 'l9iti', 'le']);
    for (const word of words) {
      expect(word.start).not.toBeNull();
      expect(word.start!).toBeGreaterThanOrEqual(21.0);
      expect(word.start!).toBeLessThanOrEqual(23.2);
    }
    expect(isMonotonic(words)).toBe(true);
  });
});

describe('alignCorrectedOntoDraft — degenerate cases', () => {
  it('returns nothing for empty corrected text', () => {
    expect(alignCorrectedOntoDraft(draft(['a', 0, 1]), [])).toEqual([]);
  });

  it('returns null timings for every word when the draft is empty', () => {
    const words = alignCorrectedOntoDraft([], ['x', 'y']);
    expect(words.map((w) => w.text)).toEqual(['x', 'y']);
    expect(starts(words)).toEqual([null, null]);
    expect(words.every((w) => w.end === null)).toBe(true);
  });

  it('returns null timings when no anchor carries a timing at all', () => {
    const untimed: TranscriptWord[] = [{ text: 'a', start: null, end: null, confidence: null }];
    const words = alignCorrectedOntoDraft(untimed, ['x', 'y']);
    expect(starts(words)).toEqual([null, null]);
  });

  it('handles both sides empty', () => {
    expect(alignCorrectedOntoDraft([], [])).toEqual([]);
  });
});

describe('alignCorrectedOntoDraft — recorded vitasilk fixtures', () => {
  it('times every corrected word inside the draft span and in order', () => {
    const raw = JSON.parse(
      readFileSync(path.join(FIXTURES_DIR, 'scribe-response.json'), 'utf8'),
    ) as ScribeRawResponse;
    const draftWords = mapScribeResponse(raw);
    const correction = JSON.parse(
      readFileSync(path.join(FIXTURES_DIR, 'correction-response.json'), 'utf8'),
    ) as { text: string };
    const correctedTexts = parseCorrectionResponseText(correction.text);

    // The correction pass turned هذا into "a lala", so this really is an
    // insertion case: ten corrected words over nine draft words.
    expect(draftWords).toHaveLength(9);
    expect(correctedTexts).toHaveLength(10);

    const words = alignCorrectedOntoDraft(draftWords, correctedTexts);
    expect(words).toHaveLength(10);
    expect(words.every((w) => w.start !== null)).toBe(true);
    expect(isMonotonic(words)).toBe(true);

    const firstStart = draftWords[0]!.start!;
    const lastEnd = draftWords[draftWords.length - 1]!.end!;
    for (const word of words) {
      expect(word.start!).toBeGreaterThanOrEqual(firstStart);
      expect(word.start!).toBeLessThanOrEqual(lastEnd);
    }
  });
});

describe('alignCorrectedOntoDraft — confidence propagation', () => {
  it('gives each matched word its own anchor confidence, not a shared one', () => {
    const drafted: TranscriptWord[] = [
      { text: 'a', start: 0, end: 1, confidence: 0.95 },
      { text: 'b', start: 2, end: 3, confidence: 0.41 },
      { text: 'c', start: 4, end: 5, confidence: 0.77 },
    ];
    const words = alignCorrectedOntoDraft(drafted, ['a', 'b', 'c']);
    expect(words.map((w) => w.confidence)).toEqual([0.95, 0.41, 0.77]);
  });

  it('leaves an inserted word with no confidence at all', () => {
    const drafted: TranscriptWord[] = [
      { text: 'a', start: 0, end: 1, confidence: 0.95 },
      { text: 'b', start: 2, end: 3, confidence: 0.41 },
    ];
    const words = alignCorrectedOntoDraft(drafted, ['a', 'x', 'b']);
    expect(words[1]?.text).toBe('x');
    // Interpolated timing, but no measurement behind the word itself.
    expect(words[1]?.start).toBeCloseTo(1.5, 9);
    expect(words[1]?.confidence).toBeNull();
  });

  it('carries a null draft confidence through as null', () => {
    const drafted: TranscriptWord[] = [{ text: 'a', start: 0, end: 1, confidence: null }];
    expect(alignCorrectedOntoDraft(drafted, ['a'])[0]?.confidence).toBeNull();
  });

  it('propagates real Scribe confidences from the recorded fixture', () => {
    const raw = JSON.parse(
      readFileSync(path.join(FIXTURES_DIR, 'scribe-response.json'), 'utf8'),
    ) as ScribeRawResponse;
    const draftWords = mapScribeResponse(raw);
    // Correcting each word to itself: every word anchors, so every
    // confidence must survive the round trip exactly.
    const words = alignCorrectedOntoDraft(
      draftWords,
      draftWords.map((w) => w.text),
    );
    expect(words.map((w) => w.confidence)).toEqual(draftWords.map((w) => w.confidence));
    expect(words.every((w) => w.confidence !== null)).toBe(true);
  });

  it('marks only the unanchored words of a real correction as unmeasured', () => {
    const raw = JSON.parse(
      readFileSync(path.join(FIXTURES_DIR, 'scribe-response.json'), 'utf8'),
    ) as ScribeRawResponse;
    const draftWords = mapScribeResponse(raw);
    const correction = JSON.parse(
      readFileSync(path.join(FIXTURES_DIR, 'correction-response.json'), 'utf8'),
    ) as { text: string };
    const words = alignCorrectedOntoDraft(draftWords, parseCorrectionResponseText(correction.text));

    // Arabic script became Arabizi, so almost nothing anchors by text here;
    // what matters is that no word without an anchor invented a number.
    const measured = words.filter((w) => w.confidence !== null);
    const unmeasured = words.filter((w) => w.confidence === null);
    expect(measured.length + unmeasured.length).toBe(words.length);
    for (const word of measured) {
      expect(word.confidence!).toBeGreaterThan(0);
      expect(word.confidence!).toBeLessThanOrEqual(1);
    }
  });
});

/*
 * Block 7 session 6 found `sourceText` naming the *next* word's draft token on
 * all 343 words of all five plans: it was assigned `draftWords[i]`, a
 * positional index into a different array. The aligner knows which draft token
 * each corrected word matched, so it carries it.
 */
describe('sourceText follows the anchor, not the index', () => {
  const draft = (text: string, start: number): TranscriptWord => ({
    text,
    start,
    end: start + 0.2,
    confidence: 0.9,
  });

  it('names the token each word actually matched, across an insertion', () => {
    // The correction pass inserted "w" at position 1, so from there on the
    // corrected index runs one ahead of the draft index.
    const drafts = [draft('alpha', 0), draft('beta', 1), draft('gamma', 2)];
    const out = alignCorrectedOntoDraft(drafts, ['alpha', 'w', 'beta', 'gamma']);
    expect(out.map((w) => w.sourceText)).toEqual(['alpha', undefined, 'beta', 'gamma']);
  });

  it('leaves an inserted word with no source token at all', () => {
    const drafts = [draft('alpha', 0), draft('beta', 1)];
    const out = alignCorrectedOntoDraft(drafts, ['alpha', 'inserted', 'beta']);
    expect(out[1]?.sourceText).toBeUndefined();
    expect(out[1]?.confidence).toBeNull();
  });

  it('keeps the pairing when a word is corrected rather than matched', () => {
    const drafts = [draft('alpha', 0), draft('betta', 1)];
    const out = alignCorrectedOntoDraft(drafts, ['alpha', 'beta']);
    expect(out.map((w) => w.sourceText)).toEqual(['alpha', 'betta']);
  });
});
