import { describe, expect, it } from 'vitest';
import { regroupForKeywords } from './regroup.js';
import { groupWordsIntoSubtitles } from '../transcription/grouping.js';
import type { PlanWord, SubtitleGroup } from '../editplan/types.js';

const word = (id: string, text: string, start: number, removed = false): PlanWord => ({
  id,
  start,
  end: start + 0.3,
  text,
  sourceText: text,
  lang: 'darija',
  script: 'latin',
  confidence: 0.9,
  removed,
  removedReason: removed ? 'filler' : null,
  edited: false,
});

// Six words tight enough that grouping pairs them: g001=[w0,w1] g002=[w2,w3] g003=[w4,w5]
const words: PlanWord[] = ['a', 'b', 'c', 'd', 'e', 'f'].map((t, i) =>
  word(`w${i}`, t, i * 0.4),
);

const baseGroups = (): SubtitleGroup[] => groupWordsIntoSubtitles(words);

const shape = (groups: SubtitleGroup[]): string[] =>
  groups.map((g) => `${g.wordIds.join('+')}${g.supersededBy ? `>${g.supersededBy}` : ''}`);

describe('the fixture groups the way transcription would', () => {
  it('pairs into three two-word groups', () => {
    expect(shape(baseGroups())).toEqual(['w0+w1', 'w2+w3', 'w4+w5']);
  });
});

describe('regroupForKeywords', () => {
  it('leaves a plan with no keywords exactly as it found it', () => {
    const result = regroupForKeywords({ groups: baseGroups(), words, keywords: [] });
    expect(shape(result.groups)).toEqual(['w0+w1', 'w2+w3', 'w4+w5']);
    expect(result.dropped).toEqual([]);
  });

  it('marks a span that already is a group, without re-cutting anything', () => {
    const result = regroupForKeywords({
      groups: baseGroups(),
      words,
      keywords: [{ id: 'k001', wordIds: ['w2', 'w3'] }],
    });
    expect(shape(result.groups)).toEqual(['w0+w1', 'w2+w3>k001', 'w4+w5']);
    expect(result.keptKeywordIds).toEqual(['k001']);
  });

  it('splits a two-word group when the span sits inside it', () => {
    const result = regroupForKeywords({
      groups: baseGroups(),
      words,
      keywords: [{ id: 'k001', wordIds: ['w3'] }],
    });
    expect(shape(result.groups)).toEqual(['w0+w1', 'w2', 'w3>k001', 'w4+w5']);
  });

  it('re-cuts around a span that straddles two groups', () => {
    // w1+w2 crosses the g001/g002 boundary, which is what vitasilk did twice.
    const result = regroupForKeywords({
      groups: baseGroups(),
      words,
      keywords: [{ id: 'k001', wordIds: ['w1', 'w2'] }],
    });
    expect(shape(result.groups)).toEqual(['w0', 'w1+w2>k001', 'w3', 'w4+w5']);
    expect(result.groups.every((g) => g.wordIds.length <= 2)).toBe(true);
  });

  it('never lets a re-group exceed two words', () => {
    const result = regroupForKeywords({
      groups: baseGroups(),
      words,
      keywords: [
        { id: 'k001', wordIds: ['w1', 'w2'] },
        { id: 'k002', wordIds: ['w4', 'w5'] },
      ],
    });
    for (const g of result.groups) expect(g.wordIds.length).toBeLessThanOrEqual(2);
    expect(shape(result.groups)).toEqual(['w0', 'w1+w2>k001', 'w3', 'w4+w5>k002']);
  });

  it('drops a keyword whose span is longer than a group may be', () => {
    const result = regroupForKeywords({
      groups: baseGroups(),
      words,
      keywords: [{ id: 'k001', wordIds: ['w1', 'w2', 'w3'] }],
    });
    expect(result.keptKeywordIds).toEqual([]);
    expect(result.dropped).toEqual([
      { keywordId: 'k001', reason: 'would-exceed-group-size' },
    ]);
    expect(shape(result.groups)).toEqual(['w0+w1', 'w2+w3', 'w4+w5']);
  });

  it('drops a keyword whose words are not adjacent in the transcript', () => {
    const result = regroupForKeywords({
      groups: baseGroups(),
      words,
      keywords: [{ id: 'k001', wordIds: ['w0', 'w3'] }],
    });
    expect(result.dropped).toEqual([{ keywordId: 'k001', reason: 'span-not-contiguous' }]);
  });

  it('drops a keyword rather than re-deriving a human-edited group', () => {
    const groups = baseGroups().map((g) => (g.id === 'g001' ? { ...g, edited: true } : g));
    const result = regroupForKeywords({
      groups,
      words,
      keywords: [{ id: 'k001', wordIds: ['w1', 'w2'] }],
    });
    expect(result.keptKeywordIds).toEqual([]);
    expect(result.dropped).toEqual([{ keywordId: 'k001', reason: 'group-is-human-edited' }]);
    expect(shape(result.groups)).toEqual(['w0+w1', 'w2+w3', 'w4+w5']);
    expect(result.groups[0]?.edited).toBe(true);
  });

  it('does not block on a human-edited group the span exactly matches', () => {
    const groups = baseGroups().map((g) => (g.id === 'g001' ? { ...g, edited: true } : g));
    const result = regroupForKeywords({
      groups,
      words,
      keywords: [{ id: 'k001', wordIds: ['w0', 'w1'] }],
    });
    expect(result.keptKeywordIds).toEqual(['k001']);
    expect(result.groups[0]?.edited).toBe(true);
  });

  it('keeps every displayable word and skips removed ones', () => {
    const withFiller = [...words.slice(0, 3), word('wx', 'euh', 1.25, true), ...words.slice(3)];
    const groups = groupWordsIntoSubtitles(withFiller);
    const result = regroupForKeywords({
      groups,
      words: withFiller,
      keywords: [{ id: 'k001', wordIds: ['w3'] }],
    });
    const covered = result.groups.flatMap((g) => g.wordIds);
    expect(covered).toHaveLength(6);
    expect(covered).not.toContain('wx');
  });

  it('is deterministic: the same input always gives the same groups', () => {
    const once = regroupForKeywords({
      groups: baseGroups(),
      words,
      keywords: [{ id: 'k001', wordIds: ['w1', 'w2'] }],
    });
    const again = regroupForKeywords({
      groups: baseGroups(),
      words,
      keywords: [{ id: 'k001', wordIds: ['w1', 'w2'] }],
    });
    expect(JSON.stringify(again)).toBe(JSON.stringify(once));
  });
});

describe('script-aware grouping', () => {
  const scripted = (
    specs: [id: string, text: string, script: 'latin' | 'arabic'][],
  ): PlanWord[] =>
    specs.map(([id, text, script], i) => ({
      ...word(id, text, i * 0.4),
      script,
      lang: script === 'arabic' ? 'msa' : 'darija',
    }));

  const regroup = (ws: PlanWord[], keywords: { id: string; wordIds: string[] }[] = []) =>
    regroupForKeywords({ groups: groupWordsIntoSubtitles(ws), words: ws, keywords });

  it('splits a Latin word away from an Arabic-script word', () => {
    const ws = scripted([
      ['w0', 'jawdat', 'latin'],
      ['w1', 'البشرة', 'arabic'],
    ]);
    expect(shape(regroup(ws).groups)).toEqual(['w0', 'w1']);
  });

  // Session 1 found three mixed groups whose Arabic word comes first, so the
  // cut must not depend on which side the Latin word sits.
  it('splits when the Arabic-script word comes first', () => {
    const ws = scripted([
      ['w0', 'البشرة', 'arabic'],
      ['w1', 'dialek', 'latin'],
    ]);
    expect(shape(regroup(ws).groups)).toEqual(['w0', 'w1']);
  });

  it('leaves an all-Latin pair alone', () => {
    const ws = scripted([
      ['w0', 'wa7d', 'latin'],
      ['w1', 'cocktail', 'latin'],
    ]);
    expect(shape(regroup(ws).groups)).toEqual(['w0+w1']);
  });

  it('leaves an all-Arabic pair alone', () => {
    const ws = scripted([
      ['w0', 'محفزات', 'arabic'],
      ['w1', 'الكولاجين', 'arabic'],
    ]);
    expect(shape(regroup(ws).groups)).toEqual(['w0+w1']);
  });

  it('cuts every boundary in an alternating sequence', () => {
    const ws = scripted([
      ['w0', 'a', 'latin'],
      ['w1', 'البشرة', 'arabic'],
      ['w2', 'b', 'latin'],
      ['w3', 'الوجه', 'arabic'],
    ]);
    expect(shape(regroup(ws).groups)).toEqual(['w0', 'w1', 'w2', 'w3']);
  });

  it('keeps a same-script keyword span aligned to exactly one group', () => {
    const ws = scripted([
      ['w0', 'a', 'latin'],
      ['w1', 'b', 'latin'],
      ['w2', 'محفزات', 'arabic'],
      ['w3', 'الكولاجين', 'arabic'],
    ]);
    const result = regroup(ws, [{ id: 'k001', wordIds: ['w2', 'w3'] }]);
    expect(result.keptKeywordIds).toEqual(['k001']);
    expect(shape(result.groups)).toEqual(['w0+w1', 'w2+w3>k001']);
  });

  it('preserves supersededBy across a split elsewhere in the reel', () => {
    const ws = scripted([
      ['w0', 'a', 'latin'],
      ['w1', 'البشرة', 'arabic'],
      ['w2', 'c', 'latin'],
      ['w3', 'd', 'latin'],
    ]);
    const result = regroup(ws, [{ id: 'k001', wordIds: ['w2', 'w3'] }]);
    expect(shape(result.groups)).toEqual(['w0', 'w1', 'w2+w3>k001']);
    expect(result.groups.find((g) => g.supersededBy === 'k001')?.wordIds).toEqual(['w2', 'w3']);
  });

  // test-1's k003 "jawdat البشرة" is exactly this and is the one real conflict
  // between the script rule and keyword alignment in the corpus.
  it('drops a keyword whose span straddles a script boundary', () => {
    const ws = scripted([
      ['w0', 'jawdat', 'latin'],
      ['w1', 'البشرة', 'arabic'],
    ]);
    const result = regroup(ws, [{ id: 'k003', wordIds: ['w0', 'w1'] }]);
    expect(result.keptKeywordIds).toEqual([]);
    expect(result.dropped).toEqual([{ keywordId: 'k003', reason: 'span-is-mixed-script' }]);
    expect(shape(result.groups)).toEqual(['w0', 'w1']);
  });

  it('never enlarges a group', () => {
    const ws = scripted([
      ['w0', 'a', 'latin'],
      ['w1', 'البشرة', 'arabic'],
      ['w2', 'الوجه', 'arabic'],
    ]);
    for (const group of regroup(ws).groups) {
      expect(group.wordIds.length).toBeLessThanOrEqual(2);
    }
  });
});
