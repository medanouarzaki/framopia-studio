import { describe, expect, it } from 'vitest';
import { assertValidEditPlan, EditPlanValidationError } from '../editplan/validate.js';
import { createEditPlan } from '../editplan/io.js';
import type { EditPlan, TranscriptWord } from '../editplan/types.js';
import { analysisConfigLabel, planWordsForAnalysis } from './job.js';

const word = (id: string, text: string, start: number, removed = false): TranscriptWord => ({
  id,
  start,
  end: start + 0.4,
  text,
  sourceText: text,
  lang: 'darija',
  script: 'latin',
  confidence: 0.9,
  removed,
  removedReason: removed ? 'filler' : null,
  edited: false,
});

function planWith(items: unknown[]): EditPlan {
  const plan = createEditPlan({
    source: {
      videoPath: '/v.mov',
      sha256: 'a'.repeat(64),
      durationS: 22,
      fps: 29.97,
      width: 2160,
      height: 3840,
      audioPath: '/a.wav',
    },
    appVersion: '0.1.0',
    now: '2026-08-25T00:00:00.000Z',
    id: 'x',
  });
  plan.transcript.words = [
    word('w0', 'bghiti', 0),
    word('w1', 'chd', 0.5),
    word('w2', 'euh', 1.0, true),
  ];
  plan.keywords = { mode: 'auto', items: items as EditPlan['keywords']['items'] };
  return plan;
}

const keyword = (o: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'k001',
  wordIds: ['w0'],
  text: 'bghiti',
  score: 0.9,
  reason: 'carries the claim',
  approved: true,
  templateId: null,
  start: 0,
  end: 0.4,
  ...o,
});

const paths = (plan: EditPlan): string[] => {
  try {
    assertValidEditPlan(plan);
    return [];
  } catch (err) {
    return (err as EditPlanValidationError).issues.map((i) => i.path);
  }
};

describe('keyword validation', () => {
  it('accepts a well-formed keyword block', () => {
    expect(paths(planWith([keyword()]))).toEqual([]);
  });

  it('keeps a keyword naming an unknown word off disk', () => {
    expect(paths(planWith([keyword({ wordIds: ['w99'] })]))).toEqual([
      'keywords.items[0].wordIds[0]',
    ]);
  });

  it('keeps a keyword on a removed word off disk', () => {
    const issues = paths(planWith([keyword({ wordIds: ['w2'] })]));
    expect(issues).toEqual(['keywords.items[0].wordIds[0]']);
  });

  it('keeps two keywords claiming the same word off disk', () => {
    expect(
      paths(planWith([keyword(), keyword({ id: 'k002', wordIds: ['w0'] })])),
    ).toEqual(['keywords.items[1].wordIds[0]']);
  });

  it('rejects a score outside 0-1', () => {
    expect(paths(planWith([keyword({ score: 1.2 })]))).toEqual(['keywords.items[0].score']);
    expect(paths(planWith([keyword({ score: 'high' })]))).toEqual(['keywords.items[0].score']);
  });

  it('rejects an empty wordIds list', () => {
    expect(paths(planWith([keyword({ wordIds: [] })]))).toEqual(['keywords.items[0].wordIds']);
  });

  it('rejects a missing required keyword field', () => {
    const k = keyword();
    delete k.reason;
    expect(paths(planWith([k]))).toEqual(['keywords.items[0].reason']);
  });

  it('rejects an unknown keywords mode', () => {
    const plan = planWith([keyword()]);
    (plan.keywords as { mode: string }).mode = 'whatever';
    expect(paths(plan)).toEqual(['keywords.mode']);
  });

  it('accepts templateId still null, which session 4 fills', () => {
    expect(paths(planWith([keyword({ templateId: null })]))).toEqual([]);
  });
});

describe('planWordsForAnalysis', () => {
  it('carries the removed flag through so the prompt can drop those words', () => {
    const words = planWordsForAnalysis(planWith([]));
    expect(words.map((w) => w.removed)).toEqual([false, false, true]);
    expect(words[0]).toEqual({ id: 'w0', text: 'bghiti', start: 0, end: 0.4, removed: false });
  });
});

describe('analysisConfigLabel', () => {
  it('names the prompt version and the mode version', () => {
    expect(
      analysisConfigLabel(1, { id: 'k2-syndicalia', version: 2 } as never),
    ).toBe('keywords-prompt-v1-k2-syndicalia-v2');
  });
});
