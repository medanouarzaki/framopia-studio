import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REPO_ROOT, loadTemplateManifest, templatesById } from '@framopia/core';
import { readEditPlan } from '../editplan/io.js';
import { resolveClientIdentity } from './client-identity.js';
import { reelMasksDir } from '../frames/segment.js';
import { videoOf } from '../video-identity.js';
import {
  MissingBuildMeasurementsError,
  assertRequirementsMet,
  buildRequirements,
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
   * Real absence, not a stubbed boolean: a plan whose **video** nothing has
   * sampled resolves to a mask directory that genuinely is not there.
   *
   * Rewritten in session 32. It used to copy the plan to a new *filename* and
   * expect no masks, which passed only because the check derived the directory
   * from the plan's name while everything that writes masks derives it from the
   * video's. Those agreed until a browsed video's plan moved to `.local/plans/`,
   * and then the build refused a reel whose 82 face masks were on disk.
   */
  it('reads the real disk, and a video it has never sampled has no masks', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-req-'));
    const copied = path.join(dir, 'copied.editplan.json');
    const raw = JSON.parse(readFileSync(planPath('vitasilk'), 'utf8')) as {
      source: { videoPath: string };
    };
    raw.source.videoPath = path.join(dir, 'a reel nobody has sampled.mov');
    writeFileSync(copied, JSON.stringify(raw), 'utf8');

    const plan = await readEditPlan(copied);
    expect(reelMasksDir(videoOf(plan.source))).toContain('a reel nobody has sampled');
    expect(readBuildDisk(plan).faceMasks).toBe(false);

    const missing = missingRequirements(
      buildRequirements(plan, readBuildDisk(plan), { knownTemplateIds: known() }),
    );
    expect(missing.map((m) => m.id)).toEqual(['face-masks']);
  });

  /*
   * The masks a build looks for are the masks the mask stage writes, and there
   * is one function that decides where those are. `CLAUDE_CODE_GUIDELINES.md`
   * §3: a rule with more than one implementation is pinned by a test, because
   * the second copy is the one nobody remembers — here it was arithmetic on a
   * filename in two places.
   */
  it('asks one function where the masks are, and it is keyed on the video', async () => {
    const plan = await readEditPlan(planPath('vitasilk'));
    expect(readBuildDisk(plan).faceMasks).toBe(true);
    expect(reelMasksDir(videoOf(plan.source))).toBe(
      path.join(
        REPO_ROOT,
        '.local',
        'cv',
        `vitasilk-${plan.source.sha256.slice(0, 12)}`,
        'masks-2fps',
      ),
    );

    const src = path.join(REPO_ROOT, 'service', 'src');
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.name.endsWith('.ts') || entry.name.includes('.test.')) continue;
        if (full.endsWith(path.join('frames', 'segment.ts'))) continue;
        // The migration reads directories written before `reelMasksDir` was
        // keyed on the video's content, so it is the one tool that has to spell
        // the old layout: it is what it is moving.
        if (full.endsWith(path.join('frames', 'migrate-cv-dirs-cli.ts'))) continue;
        const text = readFileSync(full, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '');
        if (/'masks-\$\{|'masks-2fps'/.test(text)) offenders.push(path.relative(REPO_ROOT, full));
      }
    };
    walk(src);
    expect(offenders).toEqual([]);
  });

  /*
   * A check that always fires is as wrong as one that never can. A
   * subtitles-only reel needs no masks and no loudness.
   */
  // `ground truth` was the subtitles-only reel until session 6 planned its
  // slots and its sounds; `test 3` is that reel now.
  it('asks for nothing a subtitles-only reel does not use', async () => {
    const plan = await readEditPlan(planPath('test 3'));
    const needed = buildRequirements(plan, ABSENT).filter((n) => n.needed).map((n) => n.id);
    // client-identity is unconditional; every card has type to set.
    expect(needed).toEqual(['client-identity', 'watermark-facts']);
    expect(needed).not.toContain('face-masks');
    expect(needed).not.toContain('dialogue-loudness');
  });

  it('refuses a reel that carries the mark with no watermark measurement', async () => {
    const plan = await readEditPlan(planPath('test 3'));
    const missing = missingRequirements(buildRequirements(plan, { ...PRESENT, watermarkFacts: false }));
    expect(missing.map((m) => m.id)).toEqual(['watermark-facts']);
    // The pipeline measures the watermark itself since Block 9 session 13, so
    // the in-panel action comes first and the terminal command follows it.
    expect(missing[0]?.command).toContain('press Run pipeline');
    expect(missing[0]?.command).toContain('npm run watermark:measure');
  });

  it('does not ask for a watermark measurement when the reel refuses the mark', async () => {
    const plan = await readEditPlan(planPath('test 3'));
    plan.watermark = { assetPath: 'a.mov', startS: 0, durationS: 1, enabled: false };
    const needed = buildRequirements(plan, ABSENT).filter((n) => n.needed).map((n) => n.id);
    expect(needed).toEqual(['client-identity']);
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
/*
 * A client mode is what decides the type and the colour. Falling through to the
 * template's own left two of five corpus reels drawing #F4F4F4 where every
 * other reel drew #F8F6F2, for a whole block, with nothing saying so.
 */
describe('a video with no client', () => {
  it('refuses when no identity resolved', async () => {
    const plan = await readEditPlan(planPath('vitasilk'));
    const missing = missingRequirements(
      buildRequirements(plan, PRESENT, { knownTemplateIds: known(), clientSource: 'none' }),
    );
    expect(missing.map((m) => m.id)).toContain('client-identity');
  });

  it('names the client, the control and what would happen otherwise', async () => {
    const plan = await readEditPlan(planPath('vitasilk'));
    const missing = missingRequirements(
      buildRequirements(plan, PRESENT, { knownTemplateIds: known(), clientSource: 'none' }),
    );
    const client = missing.find((m) => m.id === 'client-identity');
    expect(client?.what).toContain('no client mode and no saved client look');
    expect(client?.command).toContain('choose the client for this video');
    expect(client?.consequence).toContain('#F4F4F4');
    expect(client?.consequence).toContain('#F8F6F2');
  });

  it.each(['plan', 'live-mode', 'override'] as const)(
    'is satisfied by an identity resolved from %s',
    async (source) => {
      const plan = await readEditPlan(planPath('vitasilk'));
      const missing = missingRequirements(
        buildRequirements(plan, PRESENT, { knownTemplateIds: known(), clientSource: source }),
      );
      expect(missing.map((m) => m.id)).not.toContain('client-identity');
    },
  );

  /*
   * Every other requirement here is conditional on what the comp contains. This
   * one is not: a reel with cards has type to set, and every reel has cards.
   */
  it('applies to a reel with no images and no sounds', async () => {
    const plan = await readEditPlan(planPath('test 3'));
    const needs = buildRequirements(plan, ABSENT, {
      knownTemplateIds: known(),
      clientSource: 'none',
    });
    expect(needs.find((n) => n.id === 'client-identity')?.needed).toBe(true);
  });

  /* A caller that never resolves an identity cannot be told it has the wrong one. */
  it('is reported as met when the caller did not ask', async () => {
    const plan = await readEditPlan(planPath('vitasilk'));
    const needs = buildRequirements(plan, PRESENT, { knownTemplateIds: known() });
    expect(needs.find((n) => n.id === 'client-identity')?.present).toBe(true);
  });

  it('throws with the sentence when asserted', async () => {
    const plan = await readEditPlan(planPath('vitasilk'));
    expect(() =>
      assertRequirementsMet(
        buildRequirements(plan, PRESENT, { knownTemplateIds: known(), clientSource: 'none' }),
      ),
    ).toThrow(MissingBuildMeasurementsError);
  });
});

describe('the corpus as it stands', () => {
  /*
   * Resolved for real rather than left unasked: the point of the client-identity
   * requirement is that a reel without one refuses, so a corpus check that never
   * supplies a source would pass whatever the corpus looked like.
   */
  it('asks nothing extra of any of the five reels', async () => {
    for (const stem of ['ground truth', 'test 1', 'test 2', 'test 3', 'vitasilk']) {
      const p = planPath(stem);
      const plan = await readEditPlan(p);
      const missing = missingRequirements(
        buildRequirements(plan, readBuildDisk(plan), {
          knownTemplateIds: known(),
          clientSource: resolveClientIdentity(plan, {}).source,
        }),
      );
      expect(`${stem}: ${missing.map((m) => m.id).join(',')}`).toBe(`${stem}: `);
    }
  });
});
