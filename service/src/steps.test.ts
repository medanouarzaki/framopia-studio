import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
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
  /*
   * Rewritten in session 17. It used to price `test-1`'s eight uncached
   * candidates — but `test-1`'s plan records the images stage as done, so a run
   * skips it and the estimate is now null. Pricing work a run will not do is
   * the same defect as failing to price work it will; the rule that survives is
   * that the figure is derived from the reel, never a constant.
   */
  it('derives the figure from the reel rather than a flat constant', async () => {
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

    expect(images?.estimateUsd).toBeCloseTo(expected, 6);
    expect(images?.estimateUsd).not.toBeCloseTo(1.55, 2);
    expect(images?.note).toContain('budgeted at most');
  });

  /*
   * A stage the plan records as done will be skipped, so it cannot bill however
   * its cache resolves. `vitasilk`'s keyword entry sits at an older analysis
   * prompt version and the dry run priced it at $0.18 while a run skipped it.
   */
  it('prices nothing for a stage a run would skip', async () => {
    const { dryRun } = await import('./dry-run.js');
    const plan = await dryRun('vitasilk', 'k2-syndicalia');
    expect(plan.estimateUsd).toBe(0);
    const analysis = plan.stages.find((s) => s.id === 'analysis');
    expect(analysis?.estimateUsd).toBeNull();
    expect(analysis?.note).toContain('Already on the plan, so a run skips it');
  });

  /*
   * And images cannot bill when nothing will ever plan a slot for them:
   * `test-2`'s analysis has run and planned none, so a run reaches no image
   * call at all. It read $1.45.
   */
  it('prices nothing for images when no slot will ever be planned', async () => {
    const { dryRun } = await import('./dry-run.js');
    const plan = await dryRun('test-2', 'k2-syndicalia');
    const images = plan.stages.find((s) => s.id === 'images');
    expect(images?.estimateUsd).toBeNull();
    expect(images?.note).toContain('analysis has already run without planning any');
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
    // Five short subtitle cards, and nothing else: an sfx event starting
    // before the composition stopped being an issue in session 29.
    expect(build?.issues).toHaveLength(5);
    expect(build?.issues?.some((i) => i.includes('sfx.events'))).toBe(false);
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

/*
 * What the Build pane says before he presses it. Read from the real plans, so
 * a figure here is one the build would actually produce.
 */
describe('the build preview', () => {
  it('names the reel, the client, the output and what the comp holds', () => {
    const preview = stepsFor('vitasilk', 'k2-syndicalia').build;
    expect(preview?.reel).toBe('vitasilk');
    expect(preview?.modeId).toBe('k2-syndicalia');
    expect(preview?.modeSource).toBe('the plan');
    expect(preview?.outputPath).toBe(
      path.join(REPO_ROOT, '.local', 'build', 'vitasilk-full.aep'),
    );
    expect(preview?.subtitleCards).toBe(73);
    expect(preview?.keywords).toBe(3);
    expect(preview?.images).toBe(5);
    expect(preview?.sfxEvents).toBeGreaterThan(0);
    expect(preview?.free).toBe(true);
  });

  /*
   * `plan.clientMode` is null on a reel whose analysis has never run, and the
   * build then falls back to the picker — so the preview has to say which one
   * it landed on rather than echo the picker back as if it were the plan's.
   */
  it('says when the client came from the picker rather than the plan', () => {
    const preview = stepsFor('ground-truth', 'k2-syndicalia').build;
    expect(preview?.modeSource).toBe('the picker');
    expect(preview?.keywords).toBe(0);
    expect(preview?.images).toBe(0);
  });

  it('reports the watermark the plan asks for, at its real size', () => {
    const preview = stepsFor('vitasilk', 'k2-syndicalia').build;
    expect(preview?.watermark).toEqual({ size: 'medium', widthPx: 324, heightPx: 363 });
  });

  it('names the faces a build would set the type in', () => {
    const preview = stepsFor('vitasilk', 'k2-syndicalia').build;
    expect(preview?.fonts.latin).toBe('Inter Semi-Bold');
    expect(preview?.fonts.arabic).toBe('Almarai Bold');
    expect(preview?.fonts.globalFallback).toBe(true);
  });
});
