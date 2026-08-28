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
      plan, templates, sfxIndex, templateImpacts(), plan.source.dialogueLufs,
    );
    for (const event of events) {
      const expected = event.sfxId.startsWith('hit') ? -7.68 : -13.17;
      expect(event.gainDb, event.id).toBeCloseTo(expected, 2);
    }
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

  it('leaves the in-points alone: this session changed level, not placement', async () => {
    const plan = await readEditPlan(path.join(FOOTAGE, 'vitasilk.editplan.json'));
    const events = deriveSfxEvents(
      plan, templates, sfxIndex, templateImpacts(), plan.source.dialogueLufs,
    );
    expect(events.map((e) => e.timeS)).toEqual(plan.sfx.events.map((e) => e.timeS));
  });
});
