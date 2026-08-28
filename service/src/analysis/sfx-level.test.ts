import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { loadSfxIndex, loadTemplateManifest, REPO_ROOT, templatesById } from '@framopia/core';
import { deriveSfxEvents } from './sfx.js';
import { templateImpacts } from './template-impacts.js';
import { readEditPlan } from '../editplan/io.js';

const FOOTAGE = path.join(REPO_ROOT, 'my files', 'test videos');
const templates = templatesById(loadTemplateManifest());
const sfxIndex = loadSfxIndex();

describe('sfx gain on a real plan', () => {
  it('carries each reel’s measured dialogue loudness', async () => {
    for (const [file, lufs] of [
      ['vitasilk', -14.4],
      ['test 1', -14.0],
      ['test 2', -14.6],
    ] as const) {
      const plan = await readEditPlan(path.join(FOOTAGE, `${file}.editplan.json`));
      expect(plan.source.dialogueLufs, file).toBeCloseTo(lufs, 1);
    }
  });

  it('derives a gain from the reel rather than a constant', async () => {
    const plan = await readEditPlan(path.join(FOOTAGE, 'vitasilk.editplan.json'));
    const events = deriveSfxEvents(
      plan,
      templates,
      sfxIndex,
      templateImpacts(),
      plan.source.dialogueLufs,
      plan.source.dialoguePeakDbfs,
    );
    // Per file, because the gain compensates each file's own peak to put them
    // all on their kind's target.
    const expected: Record<string, number> = {
      hit_01: -11.48,
      hit_02: -12.17,
      whoosh_01: -13.97,
    };
    for (const event of events) {
      expect(event.gainDb, `${event.id} ${event.sfxId}`).toBeCloseTo(
        expected[event.sfxId] as number,
        2,
      );
    }
  });

  /*
   * The gains differ per file and the peaks must not: that is what makes the
   * balance a rule rather than four numbers.
   */
  it('lands every sound of a kind on the same peak', async () => {
    const plan = await readEditPlan(path.join(FOOTAGE, 'vitasilk.editplan.json'));
    const events = deriveSfxEvents(
      plan,
      templates,
      sfxIndex,
      templateImpacts(),
      plan.source.dialogueLufs,
      plan.source.dialoguePeakDbfs,
    );
    const peaks = new Map<string, number>();
    for (const event of events) {
      const file = sfxIndex.sfx.find((f) => f.id === event.sfxId);
      const peak = (file?.measured?.peakDbfs as number) + event.gainDb;
      peaks.set(event.sfxId, Number(peak.toFixed(1)));
    }
    expect(peaks.get('hit_01')).toBe(peaks.get('hit_02'));
    expect(peaks.get('hit_01')).toBeGreaterThan(peaks.get('whoosh_01') as number);
  });

  /*
   * Without a measured loudness the absolute figure is the fallback: a guessed
   * loudness would be worse than a known-quiet sound.
   */
  it('falls back to the file’s absolute gain when the reel is unmeasured', async () => {
    const plan = await readEditPlan(path.join(FOOTAGE, 'vitasilk.editplan.json'));
    const events = deriveSfxEvents(plan, templates, sfxIndex, templateImpacts(), undefined);
    const hit = events.find((e) => e.sfxId.startsWith('hit'));
    expect(hit?.gainDb).toBeCloseTo(-19.28, 2);
  });

  it('reproduces the in-points stored on the plan', async () => {
    const plan = await readEditPlan(path.join(FOOTAGE, 'vitasilk.editplan.json'));
    const events = deriveSfxEvents(
      plan,
      templates,
      sfxIndex,
      templateImpacts(),
      plan.source.dialogueLufs,
      plan.source.dialoguePeakDbfs,
    );
    expect(events.map((e) => e.timeS)).toEqual(plan.sfx.events.map((e) => e.timeS));
  });
});
