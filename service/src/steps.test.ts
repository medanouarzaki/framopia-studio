import { describe, expect, it } from 'vitest';
import { stepsFor, STEP_IDS, StepsError } from './steps.js';

/**
 * Against the real plans on this machine, not a fixture: the whole point of
 * this module is that step state comes from the Edit Plan on disk, and a
 * fixture would test the shape while saying nothing about the derivation.
 */
describe('stepsFor', () => {
  it('returns the five steps in order for every reel', () => {
    for (const reel of ['ground-truth', 'test-1', 'test-2', 'test-3', 'vitasilk']) {
      expect(stepsFor(reel, 'k2-syndicalia').steps.map((s) => s.id), reel).toEqual([...STEP_IDS]);
    }
  });

  it('opens a transcribed reel at least as far as Transcript', () => {
    const steps = stepsFor('vitasilk', 'k2-syndicalia');
    expect(steps.steps.find((s) => s.id === 'transcript')?.available).toBe(true);
  });

  it('reports the real word and card counts, not a placeholder', () => {
    const summary = stepsFor('vitasilk', 'k2-syndicalia').steps.find(
      (s) => s.id === 'transcript',
    )?.summary;
    expect(summary).toContain('73 words');
    expect(summary).toContain('68 rendered');
  });

  it('locks a step the reel has not reached, and says why', () => {
    const steps = stepsFor('test-3', 'k2-syndicalia').steps;
    const keywords = steps.find((s) => s.id === 'keywords');
    expect(keywords?.available).toBe(false);
    expect(keywords?.reason).toContain('Keyword analysis has not run');
  });

  it('counts image candidates that are really on disk', () => {
    const summary = stepsFor('vitasilk', 'k2-syndicalia').steps.find(
      (s) => s.id === 'images',
    )?.summary;
    expect(summary).toBe('5 slots, 10 candidates, 10 on disk.');
  });

  it('names the fonts a build would use', () => {
    const summary = stepsFor('vitasilk', 'k2-syndicalia').steps.find(
      (s) => s.id === 'build',
    )?.summary;
    expect(summary).toContain('Inter Semi-Bold');
    expect(summary).toContain('global fallback');
  });

  it('refuses an unknown reel and an unknown mode by name', () => {
    expect(() => stepsFor('nope', 'k2-syndicalia')).toThrow(StepsError);
    expect(() => stepsFor('vitasilk', 'nope')).toThrow(StepsError);
  });
});


/**
 * The images figure used to be a flat $1.55 — `vitasilk`'s five-slot actual —
 * reported for every reel whatever its slot count. It is computed per reel now,
 * as a budgeted ceiling rather than a forecast.
 */
describe('the image estimate', () => {
  it('scales with the reel\'s own slot count, and is the budgeted ceiling', async () => {
    const { dryRun } = await import('./dry-run.js');
    const { DEFAULT_IMAGE_CONFIG } = await import('./images/config.js');
    const { estimateImageRunCost } = await import('@framopia/core');

    const plan = await dryRun('test-1', 'k2-syndicalia');
    const images = plan.stages.find((s) => s.id === 'images');
    const expected = estimateImageRunCost({
      modelId: DEFAULT_IMAGE_CONFIG.modelId,
      resolution: DEFAULT_IMAGE_CONFIG.resolution,
      slots: 4,
      candidatesPerSlot: DEFAULT_IMAGE_CONFIG.candidatesPerSlot,
    }).usd;

    expect(images?.estimateUsd).toBeCloseTo(expected, 6);
    expect(images?.estimateUsd).not.toBeCloseTo(1.55, 2);
    expect(images?.note).toContain('budgeted at most');
  });

  it('charges nothing for a reel whose candidates are all cached', async () => {
    const { dryRun } = await import('./dry-run.js');
    const plan = await dryRun('vitasilk', 'k2-syndicalia');
    const images = plan.stages.find((s) => s.id === 'images');
    expect(images?.estimateUsd).toBeNull();
    expect(images?.note).toContain('bill nothing');
  });
});

/**
 * Build opens on cards, and that is a stated rule rather than an accident.
 * Session 15's brief said "the plan-completeness check passes" and the code
 * shipped "there are cards" without declaring the difference.
 */
describe('Build availability', () => {
  it('opens for a reel with cards but no keywords, images or sfx', () => {
    const build = stepsFor('ground-truth', 'k2-syndicalia').steps.find((s) => s.id === 'build');
    expect(build?.available).toBe(true);
  });

  it('says what the comp would and would not contain', () => {
    const build = stepsFor('ground-truth', 'k2-syndicalia').steps.find((s) => s.id === 'build');
    expect(build?.summary).toContain('76 subtitle cards');
    expect(build?.summary).toContain('no emphasised keywords');
    expect(build?.summary).toContain('no images');
  });

  it('lists what is in the comp when the reel has been through every stage', () => {
    const build = stepsFor('vitasilk', 'k2-syndicalia').steps.find((s) => s.id === 'build');
    expect(build?.summary).toContain('73 subtitle cards');
    expect(build?.summary).toContain('3 emphasised keywords');
    expect(build?.summary).toContain('5 images');
    expect(build?.summary).not.toContain('no ');
  });

  /* "5 buildability issue(s)" tells a user a number and nothing to act on. */
  it('names the buildability issues rather than counting them', () => {
    const build = stepsFor('vitasilk', 'k2-syndicalia').steps.find((s) => s.id === 'build');
    expect(build?.issues).toHaveLength(5);
    expect(build?.issues?.[0]).toContain('subtitles.groups[');
    expect(build?.issues?.[0]).toContain('short by');
  });
});

/**
 * A stage that has never run still costs money. Reading zero for it is the
 * defect session 14 fixed one stage earlier, in a second place.
 */
describe('the estimate for a reel with nothing planned', () => {
  it('prices the image slots a run would plan, not the zero it has today', async () => {
    const { dryRun } = await import('./dry-run.js');
    const { imageSlotCountFor } = await import('./analysis/count.js');
    const { DEFAULT_IMAGE_CONFIG } = await import('./images/config.js');
    const { estimateImageRunCost } = await import('@framopia/core');

    const plan = await dryRun('ground-truth', 'k2-syndicalia');
    const images = plan.stages.find((s) => s.id === 'images');
    const expected = estimateImageRunCost({
      modelId: DEFAULT_IMAGE_CONFIG.modelId,
      resolution: DEFAULT_IMAGE_CONFIG.resolution,
      slots: imageSlotCountFor(23.256567),
      candidatesPerSlot: DEFAULT_IMAGE_CONFIG.candidatesPerSlot,
    }).usd;

    expect(images?.estimateUsd).toBeCloseTo(expected, 4);
    expect(plan.estimateUsd).toBeGreaterThan(1);
  });

  it('says the slot count is one a run would plan, not one that exists', async () => {
    const { dryRun } = await import('./dry-run.js');
    const note = (await dryRun('test-3', 'k2-syndicalia')).stages.find((s) => s.id === 'images')
      ?.note;
    expect(note).toContain('no image slots planned yet');
    expect(note).toContain('a run would plan about');
    expect(note).toContain('budgeted at most');
  });

  /* The density rule has one home; the estimate must not carry a second. */
  it('takes its slot count from the planner’s own rule', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const source = readFileSync(
      fileURLToPath(new URL('./dry-run.ts', import.meta.url)),
      'utf8',
    );
    expect(source).toContain('imageSlotCountFor');
    expect(source).not.toContain('5.5');
  });
});
