import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadSfxIndex, loadTemplateManifest, REPO_ROOT, templatesById } from '@framopia/core';
import { deriveSfxEvents } from './sfx.js';
import { templateImpacts } from './template-impacts.js';
import { readEditPlan, writeEditPlan } from '../editplan/io.js';
import { removeKeyword } from '../keyword-view.js';

const FPS = 30000 / 1001;
/** Every comp crosses here; asserted against the audit above rather than typed. */
const IMPACT_S = 0.135446;
const FOOTAGE = path.join(REPO_ROOT, 'my files', 'test videos');
const templates = templatesById(loadTemplateManifest());
const sfxIndex = loadSfxIndex();

describe('templateImpacts', () => {
  it('derives an impact for all six comps from the audit on disk', () => {
    const impacts = templateImpacts();
    expect([...impacts.keys()].sort()).toEqual([
      'img_float',
      'img_slide_left',
      'kw_slam',
      'kw_slam_ar',
      'sub_pop',
      'sub_pop_ar',
    ]);
  });

  /*
   * Every template the user built crosses at the same frame, which is what one
   * shared easing preset should produce. It is the **crossing**, not the last
   * keyframe: those settle at 12 frames, and sound placed there was the 8-frame
   * error the user heard.
   */
  it('reads 0.1354s — 4.06 frames — for every one of them', () => {
    for (const [id, impactS] of templateImpacts()) {
      expect(impactS * FPS, id).toBeCloseTo(4.06, 1);
    }
  });

  it('returns an empty map for an audit that records counts without easing', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-audit-'));
    const file = path.join(dir, 'old.audit.json');
    const old = {
      ok: true,
      comps: [
        {
          name: 'kw_slam',
          frameRate: FPS,
          width: 2160,
          height: 1100,
          duration: 2,
          layers: [{ name: 'TXT_MAIN', kind: 'text', animated: [{ path: 'Transform/Position', keyframes: 2 }] }],
        },
      ],
    };
    writeFileSync(file, JSON.stringify(old), 'utf8');
    expect(templateImpacts(file).size).toBe(0);
  });

  it('returns an empty map when there is no audit at all', () => {
    expect(templateImpacts(path.join(tmpdir(), 'nothing-here.json')).size).toBe(0);
  });
});

describe('deriveSfxEvents under the measured rule', () => {
  async function plan(reel: string) {
    return readEditPlan(path.join(FOOTAGE, `${reel}.editplan.json`));
  }

  /*
   * The whole point. `hit_01`'s anchor is 2.0525 s into the file and the impact
   * is 0.1354 s after the card, so the layer starts 1.9171 s *before* the card
   * — where the old rule started it 0.13 s after.
   */
  it('starts a hit before its keyword, so the anchor lands on the impact', async () => {
    const events = deriveSfxEvents(await plan('test 2'), templates, sfxIndex, templateImpacts());
    const keywords = (await plan('test 2')).keywords.items;
    for (const event of events.filter((e) => e.sfxId.startsWith('hit'))) {
      const keyword = keywords.find((k) => k.id === event.sourceElementId);
      if (keyword === undefined) continue;
      expect(event.timeS).toBeLessThan(keyword.start);
      // Within half a frame: the in-point is snapped to the 29.97 grid, so the
      // anchor cannot land exactly and the rule does not claim it does.
      const errorFrames = Math.abs(((event.anchorAtS ?? 0) - (keyword.start + IMPACT_S)) * FPS);
      expect(errorFrames, event.id).toBeLessThanOrEqual(0.5);
    }
  });

  it('lands the anchor on the impact frame, within half a frame of snapping', async () => {
    const p = await plan('test 2');
    const events = deriveSfxEvents(p, templates, sfxIndex, templateImpacts());
    for (const event of events) {
      if (event.clamped === true || event.anchorAtS === undefined) continue;
      const element = [...p.keywords.items, ...p.images.slots].find(
        (e) => e.id === event.sourceElementId,
      );
      if (element === undefined) continue;
      const error = Math.abs((event.anchorAtS - (element.start + IMPACT_S)) * FPS);
      expect(error, event.id).toBeLessThanOrEqual(0.5);
    }
  });

  /*
   * A layer cannot start before the composition. The event says how late its
   * anchor then lands rather than absorbing it silently.
   */
  it('clamps at zero and reports how late the anchor is', async () => {
    const events = deriveSfxEvents(await plan('vitasilk'), templates, sfxIndex, templateImpacts());
    const clampedEvents = events.filter((e) => e.clamped === true);
    expect(clampedEvents.length).toBeGreaterThan(0);
    for (const event of clampedEvents) {
      expect(event.timeS).toBe(0);
      expect(event.clampedByS).toBeGreaterThan(0);
    }
  });

  it('takes each file’s derived gain, not the binding’s flat one', async () => {
    const events = deriveSfxEvents(await plan('vitasilk'), templates, sfxIndex, templateImpacts());
    for (const event of events) {
      const measured = sfxIndex.sfx.find((s) => s.id === event.sfxId)?.measured;
      expect(event.gainDb, event.id).toBe(measured?.gainDb);
    }
  });

  /*
   * Without a measurement there is no derivation, and the old rule is the
   * honest fallback — not a placement resting on a number nobody took.
   */
  it('falls back to the manifest offset when no impact is known', async () => {
    const p = await plan('vitasilk');
    const events = deriveSfxEvents(p, templates, sfxIndex, new Map());
    const keyword = p.keywords.items[0];
    if (keyword === undefined) throw new Error('fixture has no keywords');
    const event = events.find((e) => e.sourceElementId === keyword.id);
    expect(event?.timeS).toBeCloseTo(keyword.start + 0.13, 6);
    expect(event?.anchorAtS).toBeUndefined();
  });

  it('is still the single generator: subtitles silent, hits on keywords', async () => {
    const p = await plan('vitasilk');
    const events = deriveSfxEvents(p, templates, sfxIndex, templateImpacts());
    const cardIds = new Set(p.subtitles.groups.map((g) => g.id));
    expect(events.some((e) => cardIds.has(e.sourceElementId))).toBe(false);
    const keywordIds = new Set(p.keywords.items.map((k) => k.id));
    for (const event of events.filter((e) => e.sfxId.startsWith('hit'))) {
      expect(keywordIds.has(event.sourceElementId), event.id).toBe(true);
    }
  });
});

/**
 * Session 21's removal marker is a human decision and the SFX block is
 * generated. Re-deriving one must not touch the other.
 */
describe('the removed-keyword marker', () => {
  it('survives a re-derivation of the sfx block', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-sfx-'));
    const planPath = path.join(dir, 'vitasilk.editplan.json');
    copyFileSync(path.join(FOOTAGE, 'vitasilk.editplan.json'), planPath);

    const keyword = (await readEditPlan(planPath)).keywords.items[0];
    if (keyword === undefined) throw new Error('fixture has no keywords');
    await removeKeyword({ planPath, keywordId: keyword.id });
    const marked = (await readEditPlan(planPath)).keywords.removedWordIds ?? [];
    expect(marked.length).toBeGreaterThan(0);

    const plan = await readEditPlan(planPath);
    plan.sfx = { events: deriveSfxEvents(plan, templates, sfxIndex, templateImpacts()) };
    await writeEditPlan(planPath, plan);

    expect((await readEditPlan(planPath)).keywords.removedWordIds).toEqual(marked);
  });
});

/**
 * The plans on disk carry the measured placement now. If a later change moves
 * them back to the old rule this fails rather than passing quietly.
 */
describe('the corpus', () => {
  it('carries anchor times on every event that was placed by measurement', async () => {
    for (const reel of ['test 1', 'test 2', 'vitasilk']) {
      const p = await readEditPlan(path.join(FOOTAGE, `${reel}.editplan.json`));
      expect(p.sfx.events.length, reel).toBeGreaterThan(0);
      for (const event of p.sfx.events) {
        expect(event.anchorAtS, `${reel}/${event.id}`).toBeDefined();
      }
    }
  });

  /*
   * How far a hit moves from the old rule is the file's own anchor, so the
   * bound cannot be one figure for every hit: `hit_01`'s anchor is 2.05 s in
   * and `hit_02`'s is 0.54 s, and both are now in use. What every hit has in
   * common is that it starts before its keyword, which the old rule never did.
   */
  it('places no hit at its old card-plus-0.13s position', async () => {
    const p = await readEditPlan(path.join(FOOTAGE, 'vitasilk.editplan.json'));
    const hits = p.sfx.events.filter((e) => e.sfxId.startsWith('hit'));
    expect(hits.length).toBeGreaterThan(0);
    for (const event of hits) {
      const keyword = p.keywords.items.find((k) => k.id === event.sourceElementId);
      if (keyword === undefined) continue;
      expect(event.timeS, event.id).toBeLessThan(keyword.start);
      expect(Math.abs(event.timeS - (keyword.start + 0.13)) * FPS, event.id).toBeGreaterThan(1);
    }
  });
});
