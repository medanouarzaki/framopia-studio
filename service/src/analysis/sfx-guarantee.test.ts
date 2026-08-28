import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { loadSfxIndex, loadTemplateManifest, REPO_ROOT, templatesById } from '@framopia/core';
import { deriveSfxDetail, SilentImageSlotError } from './sfx.js';
import { templateImpacts } from './template-impacts.js';
import { readEditPlan } from '../editplan/io.js';
import { checkBuildability } from './buildability.js';

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

describe('every image gets a sound, or is reported as unreachable', () => {
  it('holds on every reel in the corpus, one way or the other', async () => {
    for (const reel of REELS) {
      const { plan, detail } = await derive(reel);
      const sounded = new Set(detail.events.map((e) => e.sourceElementId));
      const refused = new Set(detail.unplaceable.map((u) => u.elementId));
      for (const slot of plan.images.slots) {
        expect(sounded.has(slot.id) || refused.has(slot.id), `${reel} ${slot.id}`).toBe(true);
      }
    }
  });

  /*
   * `whoosh_01`'s anchor is 0.69 s into the file and the impact is 0.135 s
   * after the element, so it needs 0.556 s of reel in front of the image.
   * `img001` sits at 0.099 s on both reels that have one, and the sound used to
   * clamp to zero and play 14 frames behind the picture — which is what the
   * user heard as "clearly separate".
   */
  it('refuses the sound on the first image rather than playing it late', async () => {
    for (const reel of ['test 1', 'vitasilk']) {
      const { detail } = await derive(reel);
      expect(detail.unplaceable.map((u) => u.elementId), reel).toEqual(['img001']);
      expect(detail.unplaceable[0]?.lateByS, reel).toBeCloseTo(0.467, 3);
      expect(detail.events.some((e) => e.sourceElementId === 'img001'), reel).toBe(false);
    }
  });

  it('leaves nothing clamped anywhere in the corpus', async () => {
    for (const reel of REELS) {
      const { detail } = await derive(reel);
      expect(detail.events.filter((e) => e.clamped === true), reel).toEqual([]);
    }
  });

  /* An image far enough into the reel keeps its sound, exactly as before. */
  it('places every image that has room in front of it', async () => {
    const { detail } = await derive('vitasilk');
    expect(detail.events.map((e) => e.sourceElementId)).toEqual([
      'img002', 'img003', 'img004', 'img005',
    ]);
  });

  /*
   * It was true of the corpus before this rule existed, but only because both
   * image templates happen to bind a whoosh. Removing the binding must fail the
   * build rather than produce a silent image nothing reports.
   */
  it('still refuses a build where a template stopped binding one', async () => {
    const { plan } = await derive('vitasilk');
    const stripped = new Map(
      [...templates].map(([id, t]) => [id, t.type === 'image' ? { ...t, sfx: [] } : t]),
    );
    expect(() =>
      deriveSfxDetail(plan, stripped, sfxIndex, templateImpacts(), plan.source.dialogueLufs),
    ).toThrow(SilentImageSlotError);
  });

  /*
   * A slot with no template is a different defect and deliberately not this
   * one: the builder drops it rather than building a silent image, and
   * `checkBuildability` names it. The plan also passes through that state
   * legitimately, before templates are assigned.
   */
  it('leaves a slot with no template to the buildability check', async () => {
    const { plan } = await derive('vitasilk');
    const slots = plan.images.slots.map((s, i) => (i === 0 ? { ...s, templateId: null } : s));
    const stripped = { ...plan, images: { ...plan.images, slots } };
    expect(() =>
      deriveSfxDetail(stripped, templates, sfxIndex, templateImpacts(), plan.source.dialogueLufs),
    ).not.toThrow();
    expect(
      checkBuildability(stripped, templates).issues.some(
        (i) => i.path === 'images.slots[0]' && /no templateId/.test(i.message),
      ),
    ).toBe(true);
  });
});

describe('the corpus, with keywords silent', () => {
  /*
   * The user removed the hits in Block 8 session 27: he heard them on a built
   * reel and ruled that the sound fought the animation. No keyword template
   * binds anything, so no keyword produces an event.
   */
  it('produces no keyword event anywhere', async () => {
    for (const reel of REELS) {
      const { plan, detail } = await derive(reel);
      const keywordIds = new Set(plan.keywords.items.map((k) => k.id));
      expect(detail.events.filter((e) => keywordIds.has(e.sourceElementId)), reel).toEqual([]);
      expect(detail.events.filter((e) => e.sfxId.startsWith('hit')), reel).toEqual([]);
    }
  });

  it('leaves the whooshes as the only sound in the corpus', async () => {
    let total = 0;
    for (const reel of REELS) {
      const { detail } = await derive(reel);
      total += detail.events.length;
      expect(detail.events.every((e) => e.sfxId.startsWith('whoosh')), reel).toBe(true);
    }
    // Nine image slots, less the two first-in-reel ones no sound can reach.
    expect(total).toBe(7);
  });

  it('is stable: deriving twice gives the same events', async () => {
    const a = await derive('vitasilk');
    const b = await derive('vitasilk');
    expect(JSON.stringify(a.detail)).toBe(JSON.stringify(b.detail));
  });
});
