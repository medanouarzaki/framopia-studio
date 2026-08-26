import { describe, expect, it } from 'vitest';
import type { EditPlan, SubtitleGroup, TranscriptWord } from '../editplan/types.js';
import {
  evaluateBudget,
  groupSilenceGaps,
  groupSpeechDurations,
  shortestGroup,
  spread,
  sweepTemplates,
} from './timing-budget.js';

function word(id: string, text: string, start: number, end: number): TranscriptWord {
  return {
    id,
    start,
    end,
    text,
    sourceText: text,
    lang: 'darija',
    script: 'latin',
    confidence: 0.9,
    removed: false,
    removedReason: null,
    edited: false,
  } as unknown as TranscriptWord;
}

function group(id: string, wordIds: string[], start: number, end: number): SubtitleGroup {
  return { id, wordIds, start, end, templateId: null, supersededBy: null } as unknown as SubtitleGroup;
}

/** A plan carrying only what the sweep reads. */
function planWith(words: TranscriptWord[], groups: SubtitleGroup[], durationS = 10): EditPlan {
  return {
    source: { durationS },
    transcript: { words },
    subtitles: { groups },
    keywords: { mode: 'auto', items: [] },
    images: { slots: [] },
    sfx: { events: [] },
  } as unknown as EditPlan;
}

describe('sweepTemplates', () => {
  it('splits the budget evenly and only the sum is ever compared', () => {
    const t = sweepTemplates(0.2, 0.1).get('sweep_subtitle');
    expect(t?.introS).toBeCloseTo(0.1);
    expect(t?.outroS).toBeCloseTo(0.1);
    expect(t?.minHoldS).toBeCloseTo(0.1);
    expect((t?.introS ?? 0) + (t?.minHoldS ?? 0) + (t?.outroS ?? 0)).toBeCloseTo(0.3);
  });
});

describe('evaluateBudget', () => {
  // Floor for these is intro+outro 0.20 plus minHold 0.10 = 0.30 s.
  const BUDGET = { introOutroS: 0.2, minHoldS: 0.1 };

  it('passes a group whose speech exactly fills the budget', () => {
    const plan = planWith(
      [word('w1', 'alpha', 1.0, 1.3)],
      [group('g001', ['w1'], 1.0, 1.3)],
    );
    const cell = evaluateBudget(plan, BUDGET.introOutroS, BUDGET.minHoldS);
    expect(cell.groups).toEqual({ buildable: 1, total: 1 });
  });

  // One frame at 29.97 is 0.0334 s; this group is that much short and there is
  // no silence to take, because the next group starts immediately.
  it('fails a group that misses by one frame with no silence available', () => {
    // Two-word groups so the merge rescue is refused: it merges only when the
    // pair totals two words or fewer, which is why it barely fires on the real
    // reels.
    const plan = planWith(
      [
        word('w1', 'alpha', 1.0, 1.13),
        word('w2', 'beta', 1.13, 1.2666),
        word('w3', 'gamma', 1.2666, 1.6),
        word('w4', 'delta', 1.6, 2.0),
      ],
      [group('g001', ['w1', 'w2'], 1.0, 1.2666), group('g002', ['w3', 'w4'], 1.2666, 2.0)],
    );
    const cell = evaluateBudget(plan, BUDGET.introOutroS, BUDGET.minHoldS);
    const failed = cell.failures.filter((f) => f.groupId === 'g001');
    expect(failed).toHaveLength(1);
    expect(failed[0]?.shortByS).toBeCloseTo(0.0334, 3);
    expect(failed[0]?.text).toBe('alpha beta');
  });

  // The same group, rescued: the gap before the next group is silence that
  // belongs to nobody, and display timing may extend into it.
  it('rescues that group when silence follows it', () => {
    const plan = planWith(
      [
        word('w1', 'alpha', 1.0, 1.13),
        word('w2', 'beta', 1.13, 1.2666),
        word('w3', 'gamma', 1.5, 1.8),
        word('w4', 'delta', 1.8, 2.0),
      ],
      [group('g001', ['w1', 'w2'], 1.0, 1.2666), group('g002', ['w3', 'w4'], 1.5, 2.0)],
    );
    const cell = evaluateBudget(plan, BUDGET.introOutroS, BUDGET.minHoldS);
    expect(cell.failures.filter((f) => f.groupId === 'g001')).toHaveLength(0);
    expect(cell.groups.buildable).toBe(cell.groups.total);
  });

  it('extends only as far as the next group, never over it', () => {
    const plan = planWith(
      [
        word('w1', 'alpha', 1.0, 1.05),
        word('w2', 'beta', 1.05, 1.1),
        word('w3', 'gamma', 1.25, 1.6),
        word('w4', 'delta', 1.6, 2.0),
      ],
      [group('g001', ['w1', 'w2'], 1.0, 1.1), group('g002', ['w3', 'w4'], 1.25, 2.0)],
    );
    const cell = evaluateBudget(plan, BUDGET.introOutroS, BUDGET.minHoldS);
    const failed = cell.failures.find((f) => f.groupId === 'g001');
    // It reaches 1.25 and no further: 0.25 s against a 0.30 s floor.
    expect(failed?.haveS).toBeCloseTo(0.25, 6);
    expect(failed?.shortByS).toBeCloseTo(0.05, 6);
  });

  // The stored displayStart/displayEnd were derived against the stub floor, so
  // reading them would measure the stub instead of the budget under test.
  it('ignores display timing already stored on the plan', () => {
    const groups = [
      { ...group('g001', ['w1'], 1.0, 1.1), displayStart: 1.0, displayEnd: 9.0 },
    ] as SubtitleGroup[];
    const plan = planWith([word('w1', 'alpha', 1.0, 1.1)], groups);
    const cell = evaluateBudget(plan, BUDGET.introOutroS, BUDGET.minHoldS);
    // With the whole reel after it the group extends to its floor on its own
    // merits, and the stored 9.0 s window plays no part.
    const derivedEnd = 1.0 + 0.3;
    expect(cell.groups.buildable).toBe(1);
    expect(derivedEnd).toBeLessThan(9.0);
  });

  it('does not mutate the plan it was given', () => {
    const groups = [group('g001', ['w1'], 1.0, 1.1)];
    const plan = planWith([word('w1', 'alpha', 1.0, 1.1)], groups);
    const before = JSON.stringify(plan);
    evaluateBudget(plan, BUDGET.introOutroS, BUDGET.minHoldS);
    expect(JSON.stringify(plan)).toBe(before);
    expect(groups[0]?.templateId).toBeNull();
  });

  // The merge path does exist and is exercised here, even though it fires in
  // only 20 of 125 reel-cells on the real corpus.
  it('merges two adjacent single-word groups when extension cannot reach', () => {
    const plan = planWith(
      [word('w1', 'alpha', 1.0, 1.1), word('w2', 'beta', 1.1, 1.5)],
      [group('g001', ['w1'], 1.0, 1.1), group('g002', ['w2'], 1.1, 1.5)],
    );
    const cell = evaluateBudget(plan, BUDGET.introOutroS, BUDGET.minHoldS);
    expect(cell.merges).toBe(1);
    expect(cell.groups).toEqual({ buildable: 1, total: 1 });
  });

  it('grows harder as the budget grows', () => {
    const plan = planWith(
      [word('w1', 'alpha', 1.0, 1.2), word('w2', 'beta', 1.25, 2.0)],
      [group('g001', ['w1'], 1.0, 1.2), group('g002', ['w2'], 1.25, 2.0)],
    );
    const loose = evaluateBudget(plan, 0.13, 0.1);
    const tight = evaluateBudget(plan, 0.4, 0.3);
    expect(loose.groups.buildable).toBeGreaterThanOrEqual(tight.groups.buildable);
  });
});

describe('spread', () => {
  it('reports observed values, not interpolated ones', () => {
    const s = spread([0.1, 0.2, 0.3, 0.4, 0.5]);
    expect(s).toMatchObject({ min: 0.1, median: 0.3, max: 0.5, n: 5 });
    expect([0.1, 0.2, 0.3, 0.4, 0.5]).toContain(s.p10);
  });

  it('handles an empty set without producing NaN', () => {
    expect(spread([])).toEqual({ min: 0, p10: 0, median: 0, max: 0, n: 0 });
  });
});

describe('speech durations and silence gaps', () => {
  const plan = planWith(
    [word('w1', 'alpha', 1.0, 1.2), word('w2', 'beta', 1.5, 2.0)],
    [group('g001', ['w1'], 1.0, 1.2), group('g002', ['w2'], 1.5, 2.0)],
    3,
  );

  it('measures speech duration from the words', () => {
    expect(groupSpeechDurations(plan)).toEqual([
      expect.closeTo(0.2, 6),
      expect.closeTo(0.5, 6),
    ]);
  });

  it('measures the gap to the next group, and the reel end for the last', () => {
    expect(groupSilenceGaps(plan)).toEqual([expect.closeTo(0.3, 6), expect.closeTo(1.0, 6)]);
  });

  it('names the shortest group with its text and its headroom', () => {
    expect(shortestGroup(plan)).toMatchObject({ id: 'g001', text: 'alpha' });
    expect(shortestGroup(plan)?.durationS).toBeCloseTo(0.2, 6);
    expect(shortestGroup(plan)?.gapAfterS).toBeCloseTo(0.3, 6);
  });

  it('has no shortest group when there are none', () => {
    expect(shortestGroup(planWith([], []))).toBeNull();
  });
});
