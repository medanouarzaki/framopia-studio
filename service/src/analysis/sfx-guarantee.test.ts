import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { loadSfxIndex, loadTemplateManifest, REPO_ROOT, templatesById } from '@framopia/core';
import { deriveSfxDetail, SilentImageSlotError } from './sfx.js';
import { templateImpacts } from './template-impacts.js';
import { readEditPlan } from '../editplan/io.js';

const FOOTAGE = path.join(REPO_ROOT, 'my files', 'test videos');
const REELS = ['ground truth', 'test 1', 'test 2', 'test 3', 'vitasilk'];
const templates = templatesById(loadTemplateManifest());
const sfxIndex = loadSfxIndex();

const derive = async (reel: string) => {
  const plan = await readEditPlan(path.join(FOOTAGE, `${reel}.editplan.json`));
  return {
    plan,
    detail: deriveSfxDetail(
      plan,
      templates,
      sfxIndex,
      templateImpacts(),
      plan.source.dialogueLufs,
      plan.source.dialoguePeakDbfs,
    ),
  };
};

describe('every image gets a sound', () => {
  it('holds on every reel in the corpus', async () => {
    for (const reel of REELS) {
      const { plan, detail } = await derive(reel);
      const sounded = new Set(detail.events.map((e) => e.sourceElementId));
      for (const slot of plan.images.slots) {
        expect(sounded.has(slot.id), `${reel} ${slot.id}`).toBe(true);
      }
    }
  });

  /*
   * It was true of the corpus before this rule existed, but only because both
   * image templates happen to bind a whoosh. Removing the binding must fail the
   * build rather than produce a silent image nothing reports.
   */
  it('refuses a build where a template stopped binding one', async () => {
    const { plan } = await derive('vitasilk');
    const stripped = new Map(
      [...templates].map(([id, t]) => [id, t.type === 'image' ? { ...t, sfx: [] } : t]),
    );
    expect(() =>
      deriveSfxDetail(plan, stripped, sfxIndex, templateImpacts(), plan.source.dialogueLufs),
    ).toThrow(SilentImageSlotError);
  });

  it('refuses a slot left without a template', async () => {
    const { plan } = await derive('vitasilk');
    const slots = plan.images.slots.map((s, i) => (i === 0 ? { ...s, templateId: null } : s));
    expect(() =>
      deriveSfxDetail(
        { ...plan, images: { ...plan.images, slots } },
        templates,
        sfxIndex,
        templateImpacts(),
        plan.source.dialogueLufs,
      ),
    ).toThrow(/img001/);
  });
});

describe('the corpus under the spacing and variation rules', () => {
  it('thins the three hits the user heard as mechanical', async () => {
    const { detail } = await derive('vitasilk');
    const hits = detail.events.filter((e) => e.sfxId.startsWith('hit'));
    expect(hits).toHaveLength(2);
    expect(new Set(hits.map((h) => h.sfxId)).size).toBe(2);
    expect(detail.dropped.map((d) => d.elementId)).toEqual(['k002']);
  });

  it('drops one on test-2 and varies nothing, its pair being far apart', async () => {
    const { detail } = await derive('test 2');
    expect(detail.dropped.map((d) => d.elementId)).toEqual(['k003']);
    expect(detail.varied).toEqual([]);
  });

  it('leaves test-1 alone: two keywords four seconds apart', async () => {
    const { detail } = await derive('test 1');
    expect(detail.dropped).toEqual([]);
    expect(detail.varied).toEqual([]);
  });

  /* No two images in this corpus are close enough for either rule to fire. */
  it('never varies or drops a whoosh anywhere in the corpus', async () => {
    for (const reel of REELS) {
      const { detail } = await derive(reel);
      expect(detail.dropped.filter((d) => d.sfxId.startsWith('whoosh')), reel).toEqual([]);
      expect(detail.varied.filter((v) => v.bound.startsWith('whoosh')), reel).toEqual([]);
    }
  });

  it('is stable: deriving twice gives the same events', async () => {
    const a = await derive('vitasilk');
    const b = await derive('vitasilk');
    expect(JSON.stringify(a.detail)).toBe(JSON.stringify(b.detail));
  });
});
