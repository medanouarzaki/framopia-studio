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
    // all on their kind's target. `whoosh_01` is the only sound bound to
    // anything since the hits were removed, so it is also what the mix makes
    // room for: the attenuation is 3.07 dB, not the 3.80 the hits needed.
    const expected: Record<string, number> = { whoosh_01: -13.24 };
    for (const event of events) {
      expect(event.gainDb, `${event.id} ${event.sfxId}`).toBeCloseTo(
        expected[event.sfxId] as number,
        2,
      );
    }
  });

  /*
   * Every whoosh in the corpus arrives at the same peak, whatever its file's
   * own level. That is what makes the balance a rule rather than a number.
   */
  it('lands every sound on the same peak', async () => {
    const plan = await readEditPlan(path.join(FOOTAGE, 'vitasilk.editplan.json'));
    const events = deriveSfxEvents(
      plan,
      templates,
      sfxIndex,
      templateImpacts(),
      plan.source.dialogueLufs,
      plan.source.dialoguePeakDbfs,
    );
    expect(events.length).toBeGreaterThan(0);
    const peaks = new Set(
      events.map((event) => {
        const file = sfxIndex.sfx.find((f) => f.id === event.sfxId);
        return Number(((file?.measured?.peakDbfs as number) + event.gainDb).toFixed(1));
      }),
    );
    expect(peaks.size).toBe(1);
  });

  /*
   * Without a measured loudness the absolute figure is the fallback: a guessed
   * loudness would be worse than a known-quiet sound.
   */
  it('falls back to the file’s absolute gain when the reel is unmeasured', async () => {
    const plan = await readEditPlan(path.join(FOOTAGE, 'vitasilk.editplan.json'));
    const events = deriveSfxEvents(plan, templates, sfxIndex, templateImpacts(), undefined);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) expect(event.gainDb).toBeCloseTo(-22.77, 2);
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
