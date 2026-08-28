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

  /*
   * `build` is available whenever there are cards, so the furthest available
   * step would open a reel with no keywords straight on Build and hide the gap
   * that is the actual next thing to do.
   */
  it('resumes at the end of the unbroken run, not the furthest available step', () => {
    expect(stepsFor('test-3', 'k2-syndicalia').resumeAt).toBe('transcript');
    expect(stepsFor('test-2', 'k2-syndicalia').resumeAt).toBe('keywords');
    expect(stepsFor('vitasilk', 'k2-syndicalia').resumeAt).toBe('build');
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
