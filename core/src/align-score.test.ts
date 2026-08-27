import { describe, expect, it } from 'vitest';
import {
  buildAlignmentRows,
  parseAlignReference,
  AlignReferenceError,
  type AlignReference,
  type AlignmentRow,
} from './align-review.js';
import {
  AlignScoreError,
  compareAgainstReference,
  movedRows,
  scoreAlignment,
} from './align-score.js';

const SHA = 'dcc3b1d7392a4c0bd2248cc37ed7966c75c5aaa6';

const draft = [
  { text: 'Vita', start: 8.2, end: 8.5 },
  { text: 'من', start: 8.9, end: 9.0 },
  { text: 'غير', start: 9.1, end: 9.2 },
  { text: 'أنه', start: 9.3, end: 9.8 },
];

/*
 * `w` has no draft token — the aligner emits an insert — so the corrected
 * sequence is one longer than the draft and every Arabizi word pairs across
 * scripts. This is the shape of a real Darija run in miniature.
 */
const corrected = ['Vita', 'w', 'mn', 'ghir', 'anno'];
const rows: AlignmentRow[] = buildAlignmentRows(draft, corrected);

const entry = (
  wordId: string,
  wordText: string,
  draftTokenText: string | null,
  verdict: AlignReference['entries'][number]['verdict'],
): AlignReference['entries'][number] => ({ wordId, wordText, draftTokenText, verdict });

function reference(entries: AlignReference['entries'], headSha = SHA): AlignReference {
  return { schemaVersion: 1, reel: 'vitasilk', generatedAt: '2026-08-27T00:00:00.000Z', headSha, entries };
}

describe('the rows this fixture produces', () => {
  it('pairs as the aligner really does, so the tests below score a real pairing', () => {
    expect(rows.map((r) => [r.wordText, r.op, r.draftText, r.crossScript])).toEqual([
      ['Vita', 'match', 'Vita', false],
      ['w', 'insert', null, false],
      ['mn', 'substitute', 'من', true],
      ['ghir', 'substitute', 'غير', true],
      ['anno', 'substitute', 'أنه', true],
    ]);
  });
});

describe('scoreAlignment', () => {
  it('tallies every verdict and splits each by script', () => {
    const score = scoreAlignment(
      rows,
      reference([
        entry('w0000', 'Vita', 'Vita', 'correct'),
        entry('w0001', 'w', null, 'no-token'),
        entry('w0002', 'mn', 'من', 'wrong'),
        entry('w0003', 'ghir', 'غير', 'correct'),
        entry('w0004', 'anno', 'أنه', 'two-tokens'),
      ]),
    );

    expect(score.rowsTotal).toBe(5);
    expect(score.rowsJudged).toBe(5);
    expect(score.byVerdict.correct).toEqual({ total: 2, cross: 1, same: 1 });
    expect(score.byVerdict.wrong).toEqual({ total: 1, cross: 1, same: 0 });
    expect(score.byVerdict['two-tokens']).toEqual({ total: 1, cross: 1, same: 0 });
    expect(score.byVerdict['no-token']).toEqual({ total: 1, cross: 0, same: 1 });
    expect(score.confirmedShare).toBeCloseTo(2 / 5);
  });

  /*
   * A half-finished review is not evidence that the aligner is half wrong.
   * Dividing by the whole reel would report the reviewer's progress as the
   * aligner's accuracy.
   */
  it('takes the headline over judged rows, not over the whole reel', () => {
    const score = scoreAlignment(rows, reference([entry('w0000', 'Vita', 'Vita', 'correct')]));
    expect(score.rowsTotal).toBe(5);
    expect(score.rowsJudged).toBe(1);
    expect(score.confirmedShare).toBe(1);
  });

  it('reports zero rather than dividing by nothing on an empty reference', () => {
    expect(scoreAlignment(rows, reference([])).confirmedShare).toBe(0);
  });

  it('rejects a reference naming a word id the pairing does not have', () => {
    expect(() => scoreAlignment(rows, reference([entry('w0099', 'nope', null, 'wrong')]))).toThrow(
      AlignScoreError,
    );
    expect(() => scoreAlignment(rows, reference([entry('w0099', 'nope', null, 'wrong')]))).toThrow(
      /w0099/,
    );
  });

  it('rejects a reference whose word text has changed under the same id', () => {
    expect(() =>
      scoreAlignment(rows, reference([entry('w0002', 'something-else', 'من', 'correct')])),
    ).toThrow(/changed text.*w0002/s);
  });

  it('rejects rather than scoring the overlap', () => {
    const mixed = reference([
      entry('w0000', 'Vita', 'Vita', 'correct'),
      entry('w0099', 'nope', null, 'wrong'),
    ]);
    expect(() => scoreAlignment(rows, mixed)).toThrow(AlignScoreError);
  });
});

describe('compareAgainstReference', () => {
  /*
   * The reference was judged when `mn` paired with `Vita` and `ghir` with
   * `من`; today they pair with `من` and `غير`. So the wrong row moved (a
   * candidate repair) and the correct row moved (a regression).
   */
  const older = reference(
    [
      entry('w0000', 'Vita', 'Vita', 'correct'),
      entry('w0001', 'w', null, 'no-token'),
      entry('w0002', 'mn', 'Vita', 'wrong'),
      entry('w0003', 'ghir', 'من', 'correct'),
      entry('w0004', 'anno', 'أنه', 'two-tokens'),
    ],
    '0000000000000000000000000000000000000000',
  );

  it('buckets every row by the human verdict on it', () => {
    const c = compareAgainstReference(rows, older);

    expect(c.repairCandidates.map((r) => r.wordId)).toEqual(['w0002']);
    expect(c.regressions.map((r) => r.wordId)).toEqual(['w0003']);
    expect(c.stillInexpressible.map((r) => r.wordId)).toEqual(['w0004']);
    expect(c.unrepaired).toEqual([]);
    expect(c.held.map((r) => r.wordId)).toEqual(['w0000']);
    expect(c.noToken.map((r) => r.wordId)).toEqual(['w0001']);
  });

  it('carries both pairings on a moved row', () => {
    const [repair] = compareAgainstReference(rows, older).repairCandidates;
    expect(repair?.previousDraftText).toBe('Vita');
    expect(repair?.currentDraftText).toBe('من');
    expect(repair?.moved).toBe(true);
  });

  it('counts a wrong row that did not move as unrepaired, not as a repair', () => {
    const unmoved = reference([entry('w0002', 'mn', 'من', 'wrong')]);
    const c = compareAgainstReference(rows, unmoved);
    expect(c.repairCandidates).toEqual([]);
    expect(c.unrepaired.map((r) => r.wordId)).toEqual(['w0002']);
  });

  /*
   * `two-tokens` is inexpressible while a row names a single draft token, so
   * the bucket holds every such row whether or not the pairing moved. It can
   * only fall when the aligner gains a many-to-one operation.
   */
  it('keeps a two-tokens row inexpressible even when its pairing moved', () => {
    const moved = reference([entry('w0004', 'anno', 'Vita', 'two-tokens')]);
    const c = compareAgainstReference(rows, moved);
    expect(c.stillInexpressible.map((r) => r.wordId)).toEqual(['w0004']);
  });

  it('lists every moved row once, for the re-review sheet', () => {
    expect(movedRows(compareAgainstReference(rows, older)).map((r) => r.wordId)).toEqual([
      'w0002',
      'w0003',
    ]);
  });

  it('applies the same id check as scoring', () => {
    expect(() =>
      compareAgainstReference(rows, reference([entry('w0099', 'nope', null, 'wrong')])),
    ).toThrow(AlignScoreError);
  });
});

describe('a malformed reference is rejected with the fault named', () => {
  const good = {
    schemaVersion: 2,
    reel: 'vitasilk',
    generatedAt: '2026-08-27T00:00:00.000Z',
    headSha: SHA,
    entries: [{ wordId: 'w0000', wordText: 'Vita', draftTokenText: 'Vita', verdict: 'correct' }],
  };

  it('rejects a missing git sha', () => {
    const { headSha, ...rest } = good;
    expect(headSha).toBe(SHA);
    expect(() => parseAlignReference(rest)).toThrow(AlignReferenceError);
    expect(() => parseAlignReference(rest)).toThrow(/headSha/);
  });

  it('rejects a missing schema version', () => {
    const { schemaVersion, ...rest } = good;
    expect(schemaVersion).toBe(2);
    expect(() => parseAlignReference(rest)).toThrow(/schemaVersion/);
  });

  it('rejects a verdict outside the five, naming them', () => {
    const bad = { ...good, entries: [{ ...good.entries[0], verdict: 'probably' }] };
    expect(() => parseAlignReference(bad)).toThrow(
      /verdict is not one of correct, wrong, misheard, two-tokens, no-token/,
    );
  });

  it('never silently skips a bad entry', () => {
    const bad = {
      ...good,
      entries: [good.entries[0], { wordId: 'w0001', wordText: 'w', draftTokenText: null }],
    };
    expect(() => parseAlignReference(bad)).toThrow(/entries\[1\]\.verdict/);
  });
});

/**
 * `misheard` is the fifth verdict: the pairing is in the right place and the
 * draft token is a different word from the one spoken. It counts as a correct
 * alignment because that is what it is, and it is reported separately because
 * it measures Scribe rather than the aligner.
 */
describe('the misheard verdict', () => {
  const withMisheard = reference([
    entry('w0000', 'Vita', 'Vita', 'correct'),
    entry('w0002', 'mn', 'من', 'misheard'),
    entry('w0003', 'ghir', 'غير', 'wrong'),
  ]);

  it('counts towards the confirmed alignment and is tallied on its own', () => {
    const score = scoreAlignment(rows, withMisheard);

    expect(score.byVerdict.misheard).toEqual({ total: 1, cross: 1, same: 0 });
    expect(score.mishearCount).toBe(1);
    expect(score.confirmedShare).toBeCloseTo(2 / 3);
    expect(score.byVerdict.correct.total).toBe(1);
  });

  it('is a regression when the change moves it, exactly like correct', () => {
    const older = reference(
      [entry('w0002', 'mn', 'Vita', 'misheard')],
      '0000000000000000000000000000000000000000',
    );
    const c = compareAgainstReference(rows, older);

    expect(c.regressions.map((r) => r.wordId)).toEqual(['w0002']);
    expect(c.repairCandidates).toEqual([]);
  });

  it('is held, not repaired, when the change leaves it alone', () => {
    const c = compareAgainstReference(rows, withMisheard);
    expect(c.held.map((r) => r.wordId).sort()).toEqual(['w0000', 'w0002']);
  });

  it('is refused in a version 1 file, which never offered the button', () => {
    expect(() =>
      parseAlignReference({
        schemaVersion: 1,
        reel: 'vitasilk',
        generatedAt: '2026-08-27T00:00:00.000Z',
        headSha: SHA,
        entries: [{ wordId: 'w0000', wordText: 'Vita', draftTokenText: 'Vita', verdict: 'misheard' }],
      }),
    ).toThrow(/schemaVersion 1 does not define/);
  });
});

describe('reading a version 1 reference', () => {
  const v1 = {
    schemaVersion: 1,
    reel: 'vitasilk',
    generatedAt: '2026-08-27T00:00:00.000Z',
    headSha: SHA,
    entries: [{ wordId: 'w0000', wordText: 'Vita', draftTokenText: 'Vita', verdict: 'correct' }],
  };

  it('is read without migration and keeps the version it was written at', () => {
    const parsed = parseAlignReference(v1);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.alignerHash).toBeUndefined();
  });

  it('carries an alignerHash through when one is present', () => {
    expect(parseAlignReference({ ...v1, schemaVersion: 2, alignerHash: 'abc' }).alignerHash).toBe('abc');
  });

  it('rejects an alignerHash that is not a string', () => {
    expect(() => parseAlignReference({ ...v1, alignerHash: 7 })).toThrow(/alignerHash/);
  });

  it('rejects a schema version this build cannot read, naming what it can', () => {
    expect(() => parseAlignReference({ ...v1, schemaVersion: 9 })).toThrow(/reads 1 and 2/);
  });
});
