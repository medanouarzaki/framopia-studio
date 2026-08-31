import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, loadTemplateManifest } from '@framopia/core';
import { readEditPlan } from '../editplan/io.js';
import { plannedCards } from './planned-cards.js';
import { buildReel } from './reel-plan.js';
import { stepsFor } from '../steps.js';

const STEM: Record<string, string> = {
  'ground-truth': 'ground truth',
  'test-1': 'test 1',
  'test-2': 'test 2',
  'test-3': 'test 3',
  vitasilk: 'vitasilk',
};

const planFor = async (reel: string) =>
  readEditPlan(path.join(REPO_ROOT, 'my files', 'test videos', `${STEM[reel]}.editplan.json`));

/**
 * The panel's pre-build figure and the build's own must not drift.
 *
 * They did: the panel read `plan.subtitles.groups.length` and promised 73
 * subtitle cards for `vitasilk` against a comp carrying 68, because a keyword
 * supersedes the group it covers. Both sides go through `plannedCards` now, and
 * this pins that against what the builder actually emits.
 */
describe('the pre-build card count', () => {
  const audit =
    (
      JSON.parse(readFileSync(path.join(REPO_ROOT, 'templates', 'library.audit.json'), 'utf8')) as {
        comps?: Parameters<typeof buildReel>[0]['audit'];
      }
    ).comps ?? [];
  const entries = new Map(loadTemplateManifest().templates.map((t) => [t.id, t]));

  for (const reel of Object.keys(STEM)) {
    it(`${reel}: matches the elements buildReel emits`, async () => {
      const plan = await planFor(reel);
      const built = buildReel({
        plan,
        audit,
        cardTemplateId: 'img_float',
        introFor: (id) => entries.get(id)?.introS ?? 0,
        minHoldFor: (id) => entries.get(id)?.minHoldS ?? 0,
        sfxFileFor: (id) => `${id}.wav`,
        candidateFileFor: () => null,
        topLeftFor: () => undefined,
      });
      const counts = plannedCards(plan);
      const subtitles = built.elements.filter((e) => e.kind === 'subtitle').length;
      const keywords = built.elements.filter((e) => e.kind === 'keyword').length;
      expect(counts.subtitleCards).toBe(subtitles);
      expect(counts.keywordCards).toBe(keywords);
    });

    it(`${reel}: is what the panel is told`, async () => {
      const plan = await planFor(reel);
      const steps = await stepsFor(reel, 'k2-syndicalia');
      expect(steps.build?.subtitleCards).toBe(plannedCards(plan).subtitleCards);
      expect(steps.build?.words).toBe(plan.transcript.words.length);
    });
  }

  /**
   * Against the recorded golden census, which was measured inside After Effects
   * from four real builds — the only non-derived evidence of what the comp
   * actually contains.
   */
  it('matches the comps the golden reference recorded', async () => {
    const census = JSON.parse(
      readFileSync(path.join(REPO_ROOT, 'benchmarks', 'references', 'golden', 'census.json'), 'utf8'),
    ) as { reels: Record<string, { textComps: { templateId: string }[] }> };
    for (const [reel, recorded] of Object.entries(census.reels)) {
      const counts = plannedCards(await planFor(reel));
      const subs = recorded.textComps.filter((t) => t.templateId.startsWith('sub_')).length;
      const kws = recorded.textComps.filter((t) => t.templateId.startsWith('kw_')).length;
      expect({ reel, subs: counts.subtitleCards, kws: counts.keywordCards }).toEqual({
        reel,
        subs,
        kws,
      });
    }
  });

  it('a superseded group is not a card, and that is the whole difference', async () => {
    const plan = await planFor('vitasilk');
    const counts = plannedCards(plan);
    expect(plan.subtitles.groups.length).toBe(73);
    expect(counts.superseded).toBe(5);
    expect(counts.unbuildable).toBe(0);
    expect(counts.subtitleCards).toBe(68);
  });
});
