import { describe, expect, it } from 'vitest';
import { createEditPlan } from './io.js';
import {
  humanFlaggedItems,
  mergeIntoExistingPlan,
  PlanMergeBlockedError,
  transcriptContentHash,
} from './merge.js';
import type { EditPlan, ImageSlot, KeywordItem, PlanWord } from './types.js';

const word = (id: string, text: string, start: number): PlanWord => ({
  id,
  start,
  end: start + 0.4,
  text,
  sourceText: text,
  lang: 'darija',
  script: 'latin',
  confidence: 0.9,
  removed: false,
  removedReason: null,
  edited: false,
});

const keyword = (o: Partial<KeywordItem> = {}): KeywordItem => ({
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

const slot = (o: Partial<ImageSlot> = {}): ImageSlot => ({
  id: 's001',
  start: 0,
  end: 2,
  contextText: 'ctx',
  idea: 'an idea',
  prompt: 'p',
  negativePrompt: 'n',
  candidates: [],
  chosenCandidateId: null,
  presentation: 'cutout',
  zoneId: null,
  templateId: null,
  status: 'pending',
  ...o,
});

function plan(words: PlanWord[], now = '2026-08-25T00:00:00.000Z'): EditPlan {
  const p = createEditPlan({
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
    now,
    id: 'plan-id',
  });
  p.transcript.words = words;
  return p;
}

function enriched(words: PlanWord[]): EditPlan {
  const p = plan(words);
  p.transcript.contentHash = transcriptContentHash(p);
  p.keywords = { mode: 'auto', items: [keyword()] };
  p.images = { slots: [slot()] };
  p.sfx = { events: [{ id: 'e1', sourceElementId: 'k001', sfxId: 'hit', timeS: 1, gainDb: 0 }] };
  p.pipeline.analysis = {
    status: 'done',
    config: 'keywords-prompt-v1',
    costUsd: 0.05,
    cached: false,
    completedAt: '2026-08-25T00:00:00.000Z',
    error: null,
  };
  p.costs = { totalUsd: 0.15, byStage: { transcription: 0.1, analysis: 0.05 } };
  p.build = { status: 'built', aepPath: '/x.aep', builtAt: '2026-08-25T00:00:00.000Z' };
  return p;
}

const words = [word('w0', 'bghiti', 0), word('w1', 'chd', 0.5)];

function freshFrom(ws: PlanWord[], cost = 0.1): EditPlan {
  const f = plan(ws, '2026-08-25T09:00:00.000Z');
  f.meta.id = 'a-different-id';
  f.pipeline.transcription = {
    status: 'done',
    config: 'hybrid-prompt-v3',
    costUsd: cost,
    cached: false,
    completedAt: '2026-08-25T09:00:00.000Z',
    error: null,
  };
  f.costs = { totalUsd: cost, byStage: { transcription: cost } };
  return f;
}

describe('transcriptContentHash', () => {
  it('is stable and covers text, timing and the removed flag', () => {
    const base = plan(words);
    expect(transcriptContentHash(base)).toBe(transcriptContentHash(plan(words)));

    const retext = plan([{ ...words[0]!, text: 'bghit' }, words[1]!]);
    expect(transcriptContentHash(retext)).not.toBe(transcriptContentHash(base));

    const retimed = plan([{ ...words[0]!, start: 0.1 }, words[1]!]);
    expect(transcriptContentHash(retimed)).not.toBe(transcriptContentHash(base));

    const removed = plan([{ ...words[0]!, removed: true }, words[1]!]);
    expect(transcriptContentHash(removed)).not.toBe(transcriptContentHash(base));
  });
});

describe('mergeIntoExistingPlan', () => {
  it('returns the fresh plan when nothing is on disk', () => {
    const fresh = freshFrom(words);
    const result = mergeIntoExistingPlan({ existing: null, fresh });
    expect(result.plan).toBe(fresh);
    expect(result.cleared).toEqual([]);
    expect(result.plan.transcript.contentHash).toBe(transcriptContentHash(fresh));
  });

  it('preserves keywords, images and sfx when the transcript is unchanged', () => {
    const existing = enriched(words);
    const result = mergeIntoExistingPlan({ existing, fresh: freshFrom(words) });

    expect(result.transcriptChanged).toBe(false);
    expect(result.cleared).toEqual([]);
    expect(result.plan.keywords.items).toHaveLength(1);
    expect(result.plan.images.slots).toHaveLength(1);
    expect(result.plan.sfx.events).toHaveLength(1);
    expect(result.plan.pipeline.analysis.status).toBe('done');
    expect(result.plan.build.status).toBe('built');
  });

  it('keeps the plan identity and birth date across a merge', () => {
    const existing = enriched(words);
    const result = mergeIntoExistingPlan({ existing, fresh: freshFrom(words) });
    expect(result.plan.meta.id).toBe('plan-id');
    expect(result.plan.meta.createdAt).toBe('2026-08-25T00:00:00.000Z');
    expect(result.plan.meta.updatedAt).toBe('2026-08-25T09:00:00.000Z');
  });

  it('keeps every byStage key and adds the new transcription cost', () => {
    const existing = enriched(words);
    const result = mergeIntoExistingPlan({ existing, fresh: freshFrom(words, 0.2) });
    expect(result.plan.costs.byStage).toEqual({ transcription: 0.2, analysis: 0.05 });
    expect(result.plan.costs.totalUsd).toBeCloseTo(0.25, 10);
  });

  it('clears transcript-dependent blocks and resets their stages when it changed', () => {
    const existing = enriched(words);
    const changed = [word('w0', 'bghiti', 0), word('w1', 'chdd', 0.5)];
    const result = mergeIntoExistingPlan({ existing, fresh: freshFrom(changed) });

    expect(result.transcriptChanged).toBe(true);
    expect(result.cleared).toEqual(['keywords', 'images', 'sfx']);
    expect(result.plan.keywords.items).toEqual([]);
    expect(result.plan.images.slots).toEqual([]);
    expect(result.plan.sfx.events).toEqual([]);
    expect(result.plan.pipeline.analysis.status).toBe('pending');
    expect(result.plan.pipeline.analysis.costUsd).toBeNull();
    expect(result.plan.pipeline.images.status).toBe('pending');
    expect(result.plan.costs.byStage).toEqual({ transcription: 0.1 });
    expect(result.plan.build.status).toBe('stale');
  });

  it('answers from the words when a plan predates contentHash, not by assuming stale', () => {
    const existing = enriched(words);
    delete existing.transcript.contentHash;
    const result = mergeIntoExistingPlan({ existing, fresh: freshFrom(words) });
    expect(result.transcriptChanged).toBe(false);
    expect(result.plan.keywords.items).toHaveLength(1);
    expect(result.plan.transcript.contentHash).toBe(transcriptContentHash(existing));
  });

  it('still detects a real change on a plan that predates contentHash', () => {
    const existing = enriched(words);
    delete existing.transcript.contentHash;
    const result = mergeIntoExistingPlan({
      existing,
      fresh: freshFrom([word('w0', 'bghit', 0), word('w1', 'chd', 0.5)]),
    });
    expect(result.transcriptChanged).toBe(true);
    expect(result.plan.keywords.items).toEqual([]);
  });

  it('never leaves a keyword pointing at a word id the transcript lost', () => {
    const existing = enriched(words);
    const result = mergeIntoExistingPlan({ existing, fresh: freshFrom([word('x0', 'bghiti', 0)]) });
    const ids = new Set(result.plan.transcript.words.map((w) => w.id));
    for (const item of result.plan.keywords.items) {
      for (const id of item.wordIds) expect(ids.has(id)).toBe(true);
    }
    expect(result.plan.keywords.items).toEqual([]);
  });

  it('refuses to clear a human-edited keyword without force', () => {
    const existing = enriched(words);
    existing.keywords.items = [keyword({ edited: true })];
    const changed = [word('w0', 'bghit', 0)];
    expect(() => mergeIntoExistingPlan({ existing, fresh: freshFrom(changed) })).toThrow(
      PlanMergeBlockedError,
    );
    expect(() => mergeIntoExistingPlan({ existing, fresh: freshFrom(changed) })).toThrow(
      /Re-run with --force/,
    );
  });

  it('refuses to clear an image slot whose candidate a human chose', () => {
    const existing = enriched(words);
    existing.images.slots = [slot({ chosenCandidateId: 'c1' })];
    expect(() =>
      mergeIntoExistingPlan({ existing, fresh: freshFrom([word('w0', 'bghit', 0)]) }),
    ).toThrow(PlanMergeBlockedError);
  });

  it('clears and reports the discarded flags under force', () => {
    const existing = enriched(words);
    existing.keywords.items = [keyword({ edited: true })];
    const result = mergeIntoExistingPlan({
      existing,
      fresh: freshFrom([word('w0', 'bghit', 0)]),
      force: true,
    });
    expect(result.plan.keywords.items).toEqual([]);
    expect(result.discarded).toEqual([
      { block: 'keywords', itemId: 'k001', detail: 'edited by a human' },
    ]);
  });

  it('does not refuse when the transcript is unchanged, flagged items or not', () => {
    const existing = enriched(words);
    existing.keywords.items = [keyword({ edited: true })];
    const result = mergeIntoExistingPlan({ existing, fresh: freshFrom(words) });
    expect(result.plan.keywords.items[0]?.edited).toBe(true);
  });
});

describe('humanFlaggedItems', () => {
  it('finds nothing in an untouched plan', () => {
    expect(humanFlaggedItems(enriched(words))).toEqual([]);
  });
});

/*
 * The brief for this change asked that the watermark size be a human-flagged
 * marker, "the same treatment the on/off control has". Neither is flagged, and
 * neither needs to be: `clearBlocks` clears keywords, images and sfx and never
 * touches `plan.watermark`, so a re-run cannot lose either setting. Flagging
 * them would be worse than useless — `PlanMergeBlockedError` throws whenever a
 * flag is present, so any reel whose watermark had been set would refuse an
 * ordinary re-transcription until it was forced.
 *
 * This is the test that says the protection is real, since it is a property of
 * the merge rather than a field anyone can point at.
 */
describe('the watermark survives a re-run', () => {
  it('keeps enabled and size through a transcript change that clears everything else', () => {
    const existing = enriched(words);
    existing.watermark = {
      assetPath: 'assets/watermark/intro.mov',
      startS: 0,
      durationS: 1,
      enabled: false,
      size: 'large',
    };
    const changed = words.map((w, i) => (i === 0 ? { ...w, text: 'different' } : w));
    const result = mergeIntoExistingPlan({
      existing,
      fresh: freshFrom(changed),
      force: true,
    });

    expect(result.transcriptChanged).toBe(true);
    expect(result.cleared).toContain('images');
    expect(result.plan.watermark).toEqual({
      assetPath: 'assets/watermark/intro.mov',
      startS: 0,
      durationS: 1,
      enabled: false,
      size: 'large',
    });
  });

  it('is not a human-flagged item, so setting it cannot block a re-run', () => {
    const existing = enriched(words);
    existing.keywords.items = [];
    existing.images.slots = [];
    existing.keywords.removedWordIds = [];
    existing.watermark = {
      assetPath: 'a.mov',
      startS: 0,
      durationS: 1,
      enabled: false,
      size: 'small',
    };
    expect(humanFlaggedItems(existing)).toEqual([]);
  });
});
