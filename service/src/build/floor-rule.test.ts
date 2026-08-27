import { describe, expect, it } from 'vitest';
import { loadTemplateManifest, templatesById, type TemplateEntry } from '@framopia/core';
import { cardHoldFits, cardMinimumDurationS, shortCardTiming } from './short-card.js';
import { MIN_INTRO_S } from './short-card-constants.js';
import { checkBuildability } from '../analysis/buildability.js';
import { evaluateBudget } from '../analysis/timing-budget.js';
import { createEditPlan } from '../editplan/io.js';
import type { EditPlan, PlanWord, SubtitleGroup } from '../editplan/types.js';

/*
 * The builder, `validate-plan` and `timing-budget` all decide whether a card
 * is long enough. They disagreed for two sessions — the reporting tools said
 * 120 cards were unbuildable while the builder placed all 343 — because each
 * restated the arithmetic. `cardMinimumDurationS` is the single declaration
 * now, and this pins that all three land on it.
 *
 * The mirrored-constant rule, applied to a rule rather than a number.
 */
const sub = templatesById(loadTemplateManifest()).get('sub_pop') as TemplateEntry;

function planWith(durations: number[]): EditPlan {
  const plan = createEditPlan({
    source: {
      videoPath: '/v.mov',
      sha256: 'a'.repeat(64),
      durationS: 60,
      fps: 30000 / 1001,
      width: 2160,
      height: 3840,
      audioPath: '/a.wav',
    },
    appVersion: '0.1.0',
    now: '2026-08-27T00:00:00.000Z',
    id: 'floor-rule',
  });
  // Back to back, so a card's window is its own word and there is no silence
  // for the hold rule to extend into. With a gap, extension rescues every card
  // and the floor is never exercised.
  let cursor = 0;
  const starts = durations.map((d) => {
    const at = cursor;
    cursor += d;
    return at;
  });
  const words: PlanWord[] = durations.map((d, i) => ({
    id: `w${i}`,
    start: starts[i] as number,
    end: (starts[i] as number) + d,
    text: `w${i}`,
    sourceText: `w${i}`,
    lang: 'darija',
    script: 'latin',
    confidence: 0.9,
    removed: false,
    removedReason: null,
    edited: false,
  }));
  plan.transcript.words = words;
  plan.subtitles.groups = words.map((w, i) => ({
    id: `g${String(i + 1).padStart(3, '0')}`,
    wordIds: [w.id],
    start: w.start,
    end: w.end,
    displayStart: w.start,
    displayEnd: w.end,
    templateId: 'sub_pop',
    supersededBy: null,
  })) as SubtitleGroup[];
  return plan;
}

describe('one floor rule, read by everything that reports one', () => {
  const minimum = cardMinimumDurationS(sub.introS, sub.minHoldS);

  it('is the nominal floor scaled by how far the entrance may compress', () => {
    expect(minimum).toBeCloseTo((sub.introS + sub.minHoldS) * (MIN_INTRO_S / sub.introS), 10);
    // The built templates: 0.13 + 0.10 compresses to 0.118, not 0.230.
    expect(minimum).toBeCloseTo(0.1181, 4);
  });

  it('agrees with the entrance the builder would actually give the shortest card', () => {
    const t = shortCardTiming({ cardDurationS: minimum, introS: sub.introS, minHoldS: sub.minHoldS });
    expect(t.introS).toBeCloseTo(MIN_INTRO_S, 10);
    // Exactly at the minimum the hold still fits; a hair under and it does not.
    expect(cardHoldFits(minimum, sub.introS, sub.minHoldS)).toBe(true);
    expect(cardHoldFits(minimum - 0.001, sub.introS, sub.minHoldS)).toBe(false);
  });

  it('is the floor validate-plan reports against', () => {
    const plan = planWith([minimum - 0.01, minimum + 0.01, 0.6]);
    const issues = checkBuildability(plan, templatesById(loadTemplateManifest())).issues.filter(
      (i) => i.shortByS !== undefined,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('subtitles.groups[0]');
  });

  it('is the floor timing-budget sweeps against', () => {
    const plan = planWith([minimum - 0.01, minimum + 0.01, 0.6]);
    const cell = evaluateBudget(plan, sub.introS, sub.minHoldS);
    expect(cell.floorS).toBeCloseTo(minimum, 10);
    expect(cell.groups.total - cell.groups.buildable).toBe(1);
  });

  it('never reports a card unbuildable that the builder would still place', () => {
    // Everything between the old nominal floor and the new one used to be
    // called unbuildable and was being built all along.
    for (const d of [0.12, 0.15, 0.2, 0.229]) {
      expect(cardHoldFits(d, sub.introS, sub.minHoldS)).toBe(true);
      expect(shortCardTiming({ cardDurationS: d, introS: sub.introS, minHoldS: sub.minHoldS }).stretchPercent)
        .toBeLessThanOrEqual(100);
    }
  });
});
