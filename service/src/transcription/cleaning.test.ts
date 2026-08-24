import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findCleaningMarks } from './cleaning.js';
import { parseCorrectionResponse } from './correction.js';

const FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'fixtures',
);

describe('findCleaningMarks — fillers', () => {
  it('marks the fillers §7 names', () => {
    const { marks } = findCleaningMarks(['euh', 'bghit', 'eh', 'nhdr']);
    expect(marks).toEqual([
      { index: 0, reason: 'filler' },
      { index: 2, reason: 'filler' },
    ]);
  });

  it('ignores case and trailing punctuation on a filler', () => {
    expect(findCleaningMarks(['Euh,']).marks).toEqual([{ index: 0, reason: 'filler' }]);
  });

  it('leaves ya3ni and za3ma in place and reports them as unjudged', () => {
    const { marks, unjudged } = findCleaningMarks(['ya3ni', 'l7el', 'za3ma']);
    expect(marks).toEqual([]);
    expect(unjudged).toEqual([
      { index: 0, text: 'ya3ni' },
      { index: 2, text: 'za3ma' },
    ]);
  });
});

describe('findCleaningMarks — stutters', () => {
  it('marks the guide§7 example, keeping the completed word', () => {
    const { marks } = findCleaningMarks(['l-', 'l-', 'lmochkil']);
    expect(marks).toEqual([
      { index: 0, reason: 'stutter' },
      { index: 1, reason: 'stutter' },
    ]);
  });

  it('marks the earlier of an immediate repetition so the later timing survives', () => {
    const { marks } = findCleaningMarks(['bghit', 'bghit', 'nhdr']);
    expect(marks).toEqual([{ index: 0, reason: 'stutter' }]);
  });

  it('does not mark a repetition that is not immediate', () => {
    expect(findCleaningMarks(['bghit', 'nhdr', 'bghit']).marks).toEqual([]);
  });

  it('leaves a cut-off fragment alone when nothing completes it', () => {
    expect(findCleaningMarks(['l-', 'daba']).marks).toEqual([]);
  });
});

describe('findCleaningMarks — never removes content', () => {
  it('marks nothing in a real correction output', () => {
    const raw = JSON.parse(
      readFileSync(path.join(FIXTURES_DIR, 'correction-response.json'), 'utf8'),
    ) as { text: string };
    const texts = parseCorrectionResponse(raw.text).map((w) => w.text);
    const { marks, unjudged } = findCleaningMarks(texts);
    // The vitasilk opening is clean speech; nothing in it is a filler or a
    // stutter, and a rule that fired here would be over-eager.
    expect(marks).toEqual([]);
    expect(unjudged).toEqual([]);
    expect(texts.length).toBeGreaterThan(5);
  });

  it('never marks every word, even for a repeated content word', () => {
    const texts = ['dial', 'dial', 'dial'];
    const { marks } = findCleaningMarks(texts);
    expect(marks.length).toBeLessThan(texts.length);
    expect(marks.map((m) => m.index)).toEqual([0, 1]);
  });
});
