import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REPO_ROOT, loadTemplateManifest, templatesById } from '@framopia/core';
import { readEditPlan } from '../editplan/io.js';
import {
  MissingBuildMeasurementsError,
  assertRequirementsMet,
  buildRequirements,
  maskDirFor,
  missingRequirements,
  readBuildDisk,
  type BuildDisk,
} from './requirements.js';

const PRESENT: BuildDisk = { faceMasks: true, cvPython: true, watermarkFacts: true };
const ABSENT: BuildDisk = { faceMasks: false, cvPython: false, watermarkFacts: false };
const planPath = (stem: string): string =>
  path.join(REPO_ROOT, 'my files', 'test videos', `${stem}.editplan.json`);
const known = (): Set<string> => new Set(templatesById(loadTemplateManifest()).keys());

describe('what a build requires', () => {
  /*
   * The defect this exists for: with no masks, placement fell back to the frame
   * and put a 2030 px picture across the speaker, and `placementIsSafe` called
   * it safe because there was no face to clear.
   */
  it('refuses a reel with image slots and no face masks', async () => {
    const plan = await readEditPlan(planPath('vitasilk'));
    const missing = missingRequirements(buildRequirements(plan, ABSENT));
    expect(missing.map((m) => m.id)).toContain('face-masks');
    const faces = missing.find((m) => m.id === 'face-masks');
    expect(faces?.command).toContain('npm run segment');
    expect(faces?.consequence).toContain('2030 px');
  });

  /*
   * Real absence, not a stubbed boolean: a plan copied to a stem no reel has
   * resolves to a mask directory that genuinely is not there.
   */
  it('reads the real disk, and a reel it has never sampled has no masks', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-req-'));
    const copied = path.join(dir, 'a reel nobody has sampled.editplan.json');
    copyFileSync(planPath('vitasilk'), copied);
    expect(maskDirFor(copied)).toContain('a reel nobody has sampled');
    expect(readBuildDisk(copied).faceMasks).toBe(false);

    const plan = await readEditPlan(copied);
    const missing = missingRequirements(
      buildRequirements(plan, readBuildDisk(copied), { knownTemplateIds: known() }),
    );
    expect(missing.map((m) => m.id)).toEqual(['face-masks']);
  });

  /*
   * A check that always fires is as wrong as one that never can. A
   * subtitles-only reel needs no masks and no loudness.
   */
  it('asks for nothing a subtitles-only reel does not use', async () => {
    const plan = await readEditPlan(planPath('ground truth'));
    const needed = buildRequirements(plan, ABSENT).filter((n) => n.needed).map((n) => n.id);
    expect(needed).toEqual(['watermark-facts']);
  });

  it('refuses a reel that carries the mark with no watermark measurement', async () => {
    const plan = await readEditPlan(planPath('ground truth'));
    const missing = missingRequirements(buildRequirements(plan, { ...PRESENT, watermarkFacts: false }));
    expect(missing.map((m) => m.id)).toEqual(['watermark-facts']);
    expect(missing[0]?.command).toBe('npm run watermark:measure');
  });

  it('does not ask for a watermark measurement when the reel refuses the mark', async () => {
    const plan = await readEditPlan(planPath('ground truth'));
    plan.watermark = { assetPath: 'a.mov', startS: 0, durationS: 1, enabled: false };
    expect(buildRequirements(plan, ABSENT).filter((n) => n.needed)).toEqual([]);
  });

  /*
   * Every reel runs 0.0 to 0.2 dBFS true peak, so an unmeasured dialogue means
   * every sound sums past 0 dBFS. Session 26 measured all 17 events doing it.
   */
  it('refuses a reel with sounds and no dialogue loudness', async () => {
    const plan = await readEditPlan(planPath('vitasilk'));
    plan.source.dialogueLufs = null;
    const missing = missingRequirements(buildRequirements(plan, PRESENT, { modeId: 'k2-syndicalia' }));
    expect(missing.map((m) => m.id)).toEqual(['dialogue-loudness']);
    expect(missing[0]?.consequence).toContain('clips');
  });

  it('refuses a reel with images and no client on the plan or the command line', async () => {
    const plan = await readEditPlan(planPath('vitasilk'));
    plan.clientMode = null;
    const missing = missingRequirements(buildRequirements(plan, PRESENT));
    expect(missing.map((m) => m.id)).toEqual(['client-mode']);
    // The override satisfies it, which is what the builder does with --mode.
    expect(
      missingRequirements(buildRequirements(plan, PRESENT, { modeId: 'k2-syndicalia' })),
    ).toEqual([]);
  });

  it('refuses a template id the manifest does not define', async () => {
    const plan = await readEditPlan(planPath('vitasilk'));
    const group = plan.subtitles.groups[0];
    if (group !== undefined) group.templateId = 'sub_invented';
    const missing = missingRequirements(
      buildRequirements(plan, PRESENT, { modeId: 'k2-syndicalia', knownTemplateIds: known() }),
    );
    expect(missing.map((m) => m.id)).toEqual(['known-templates']);
    expect(missing[0]?.what).toContain('sub_invented');
  });

  it('names every missing thing at once, with the command for each', async () => {
    const plan = await readEditPlan(planPath('vitasilk'));
    plan.clientMode = null;
    plan.source.dialogueLufs = null;
    let thrown: MissingBuildMeasurementsError | null = null;
    try {
      assertRequirementsMet(buildRequirements(plan, ABSENT));
    } catch (e) {
      thrown = e as MissingBuildMeasurementsError;
    }
    expect(thrown?.missing.map((m) => m.id)).toEqual([
      'face-masks', 'cv-sidecar', 'watermark-facts', 'dialogue-loudness', 'client-mode',
    ]);
    expect(thrown?.message).toContain('without it:');
    expect(thrown?.message).toContain('run: ');
  });
});

/*
 * The corpus must be unaffected. Every reel here has what it needs, so this
 * session changes nothing about how any of them builds — and if that ever stops
 * being true, this is where it shows.
 */
describe('the corpus as it stands', () => {
  it('asks nothing extra of any of the five reels', async () => {
    for (const stem of ['ground truth', 'test 1', 'test 2', 'test 3', 'vitasilk']) {
      const p = planPath(stem);
      const plan = await readEditPlan(p);
      const missing = missingRequirements(
        buildRequirements(plan, readBuildDisk(p), { knownTemplateIds: known() }),
      );
      expect(`${stem}: ${missing.map((m) => m.id).join(',')}`).toBe(`${stem}: `);
    }
  });
});
