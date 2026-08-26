import { describe, expect, it } from 'vitest';
import type { SubtitleGroup } from '../editplan/types.js';
import { overlaps, retime, summarise } from './retiming.js';

function group(id: string, start: number, end: number, display?: [number, number]): SubtitleGroup {
  return {
    id,
    wordIds: [`${id}w`],
    start,
    end,
    templateId: 'sub_pop',
    supersededBy: null,
    ...(display ? { displayStart: display[0], displayEnd: display[1] } : {}),
  } as SubtitleGroup;
}

const INTRO = 0.13;
const introFor = (): number => INTRO;

describe('retime', () => {
  it('puts the in point introS before the window under intro-before', () => {
    expect(retime(group('g1', 1, 2), INTRO, 'intro-before')).toEqual({
      id: 'g1', inPointS: 0.87, outPointS: 2,
    });
  });

  it('starts at the window under intro-inside', () => {
    expect(retime(group('g1', 1, 2), INTRO, 'intro-inside')).toEqual({
      id: 'g1', inPointS: 1, outPointS: 2,
    });
  });

  it('prefers display timing over speech timing when the group carries it', () => {
    expect(retime(group('g1', 1, 2, [0.9, 2.4]), INTRO, 'intro-inside')).toEqual({
      id: 'g1', inPointS: 0.9, outPointS: 2.4,
    });
  });
});

describe('overlaps', () => {
  it('finds an overlap the intro creates and none without it', () => {
    const gs = [group('g1', 1, 2), group('g2', 2.05, 3)];
    expect(overlaps(gs, introFor, 'intro-before')).toEqual([
      { earlier: 'g1', later: 'g2', overlapS: expect.closeTo(0.08, 10) },
    ]);
    expect(overlaps(gs, introFor, 'intro-inside')).toEqual([]);
  });

  it('reports an overlap that exists under both readings', () => {
    const gs = [group('g1', 1, 2.5), group('g2', 2, 3)];
    expect(overlaps(gs, introFor, 'intro-inside')).toEqual([
      { earlier: 'g1', later: 'g2', overlapS: expect.closeTo(0.5, 10) },
    ]);
  });

  it('compares neighbours only, never every pair', () => {
    const gs = [group('g1', 0, 5), group('g2', 1, 2), group('g3', 3, 4)];
    expect(overlaps(gs, introFor, 'intro-inside').map((o) => [o.earlier, o.later])).toEqual([
      ['g1', 'g2'],
    ]);
  });
});

describe('summarise', () => {
  it('is empty-safe and counts pairs, not groups', () => {
    expect(summarise([group('g1', 0, 1)], [])).toEqual({
      pairs: 0, overlapping: 0, minS: null, medianS: null, maxS: null,
    });
  });

  it('takes the median of an even count as the mean of the middle two', () => {
    const s = summarise([group('a', 0, 1), group('b', 0, 1), group('c', 0, 1)], [
      { earlier: 'a', later: 'b', overlapS: 0.1 },
      { earlier: 'b', later: 'c', overlapS: 0.3 },
    ]);
    expect(s).toEqual({ pairs: 2, overlapping: 2, minS: 0.1, medianS: 0.2, maxS: 0.3 });
  });
});
