import { describe, expect, it } from 'vitest';
import type { ClientMode, TemplateEntry } from '@framopia/core';
import { loadSfxIndex, loadTemplateManifest, templatesById } from '@framopia/core';
import {
  assignTemplates,
  longestRun,
  NoTemplateVariantError,
  pickVariant,
  variantDistribution,
} from './assign.js';
import { deriveSfxEvents, UnknownSfxError } from './sfx.js';
import { checkBuildability } from './buildability.js';
import { cardMinimumDurationS } from '../build/short-card.js';
import { createEditPlan } from '../editplan/io.js';
import type { EditPlan, PlanWord } from '../editplan/types.js';

const template = (o: Partial<TemplateEntry> = {}): TemplateEntry => ({
  id: 'sub_pop',
  file: 'library.aep',
  type: 'subtitle',
  placeholders: ['TXT_MAIN'],
  introS: 0.1,
  outroS: 0.1,
  minHoldS: 0.1,
  anchor: 'center',
  imagePresentation: null,
  sfx: [],
  notes: 'n',
  ...o,
});

/**
 * The fixture the goal asks for: several variants per element type, so the
 * multi-variant path is exercised now rather than discovered broken in
 * Block 9 when real modes arrive.
 */
const MULTI_VARIANT_TEMPLATES: TemplateEntry[] = [
  template({ id: 'sub_pop' }),
  template({ id: 'sub_slide' }),
  template({ id: 'sub_wipe' }),
  template({ id: 'kw_slam', type: 'keyword', sfx: [{ sfxId: 'hit_01', offsetS: 0.1, gainDb: -6 }] }),
  template({ id: 'kw_glitch', type: 'keyword', sfx: [{ sfxId: 'hit_01', offsetS: 0, gainDb: -3 }] }),
  template({ id: 'img_slide_left', type: 'image', imagePresentation: 'cutout' }),
  template({ id: 'img_float', type: 'image', imagePresentation: 'card' }),
  template({ id: 'img_pan', type: 'image', imagePresentation: 'cutout' }),
  template({ id: 'img_zoom', type: 'image', imagePresentation: 'cutout' }),
];

const templates = (entries = MULTI_VARIANT_TEMPLATES): Map<string, TemplateEntry> =>
  new Map(entries.map((t) => [t.id, t]));

const mode = (overrides: Partial<ClientMode> = {}): ClientMode =>
  ({
    id: 'fixture',
    name: 'Fixture',
    version: 1,
    palette: { background: '#1A0000', primary: '#820000', accent: '#C9A96E', light: '#F8F6F2' },
    fonts: { status: 'tbd', note: 'n' },
    imageStyle: { stylePrompt: ['s'], negativePrompt: ['n'] },
    imageVariation: { note: 'n', axes: { crop: ['wide', 'close'] } },
    allowedTemplates: {
      subtitle: ['sub_pop', 'sub_slide', 'sub_wipe'],
      keyword: ['kw_slam', 'kw_glitch'],
      image: ['img_slide_left', 'img_float', 'img_pan', 'img_zoom'],
    },
    vocabulary: [],
    ...overrides,
  }) satisfies ClientMode;

const word = (id: string, start: number): PlanWord => ({
  id,
  start,
  end: start + 0.5,
  text: id,
  sourceText: id,
  lang: 'darija',
  script: 'latin',
  confidence: 0.9,
  removed: false,
  removedReason: null,
  edited: false,
});

function plan(groupCount = 8, keywordCount = 3, slotCount = 5): EditPlan {
  const p = createEditPlan({
    source: {
      videoPath: '/v.mov',
      sha256: 'a'.repeat(64),
      durationS: 30,
      fps: 30,
      width: 2160,
      height: 3840,
      audioPath: '/a.wav',
    },
    appVersion: '0.1.0',
    now: '2026-08-25T00:00:00.000Z',
    id: 'plan-fixture',
  });
  p.transcript.words = Array.from({ length: groupCount }, (_, i) => word(`w${i}`, i * 2));
  p.subtitles.groups = p.transcript.words.map((w, i) => ({
    id: `g${String(i + 1).padStart(3, '0')}`,
    wordIds: [w.id],
    start: w.start,
    end: w.end,
    templateId: null,
    supersededBy: i < keywordCount ? `k${String(i + 1).padStart(3, '0')}` : null,
  }));
  p.keywords = {
    mode: 'auto',
    items: Array.from({ length: keywordCount }, (_, i) => ({
      id: `k${String(i + 1).padStart(3, '0')}`,
      wordIds: [`w${i}`],
      text: `w${i}`,
      score: 0.9,
      reason: 'r',
      approved: true,
      templateId: null,
      start: i * 2,
      end: i * 2 + 0.5,
    })),
  };
  p.images = {
    slots: Array.from({ length: slotCount }, (_, i) => ({
      id: `img${String(i + 1).padStart(3, '0')}`,
      wordIds: [`w${i}`],
      start: i * 3,
      end: i * 3 + 2,
      contextText: 'c',
      idea: 'i',
      prompt: 'p',
      negativePrompt: 'n',
      candidates: [],
      chosenCandidateId: null,
      presentation: null,
      zoneId: null,
      templateId: null,
      status: 'pending' as const,
    })),
  };
  return p;
}

describe('pickVariant', () => {
  it('returns the only variant when a mode offers one', () => {
    expect(pickVariant(['sub_pop'], 'p', 'subtitle', 7)).toBe('sub_pop');
  });

  it('is deterministic for the same plan, type and index', () => {
    expect(pickVariant(['a', 'b', 'c'], 'p', 'subtitle', 4)).toBe(
      pickVariant(['a', 'b', 'c'], 'p', 'subtitle', 4),
    );
  });

  it('never repeats a variant back to back, over a long sequence', () => {
    const assigned = Array.from({ length: 60 }, (_, i) => pickVariant(['a', 'b', 'c'], 'p', 'sub', i));
    expect(longestRun(assigned)).toBe(1);
  });

  it('does not repeat its opening run when the sequence outruns the variants', () => {
    const assigned = Array.from({ length: 4 }, (_, i) => pickVariant(['a', 'b', 'c'], 'p', 'sub', i));
    expect(assigned[3]).not.toBe(assigned[0]);
  });

  it('uses every variant it is given', () => {
    const assigned = Array.from({ length: 12 }, (_, i) => pickVariant(['a', 'b', 'c'], 'p', 'sub', i));
    expect(Object.keys(variantDistribution(assigned)).sort()).toEqual(['a', 'b', 'c']);
  });

  it('draws differently for a different plan', () => {
    const a = Array.from({ length: 6 }, (_, i) => pickVariant(['a', 'b', 'c'], 'plan-a', 'sub', i));
    const b = Array.from({ length: 6 }, (_, i) => pickVariant(['a', 'b', 'c'], 'plan-b', 'sub', i));
    expect(a).not.toEqual(b);
  });

  it('does not lay the variants out as a visible repeating cycle', () => {
    // Session 4's coprime walk gave A,B,C,A,B,C — even, but machine-uniform,
    // which PROJECT_SPEC §1 rules out. A shuffled sequence must not repeat
    // its own first block.
    const variants = ['a', 'b', 'c', 'd'];
    const assigned = Array.from({ length: 16 }, (_, i) => pickVariant(variants, 'p', 'sub', i));
    const first = assigned.slice(0, 4).join('');
    const blocks = [1, 2, 3].map((b) => assigned.slice(b * 4, b * 4 + 4).join(''));
    expect(blocks.every((b) => b === first)).toBe(false);
  });

  it('still uses every variant exactly once per block', () => {
    const variants = ['a', 'b', 'c', 'd'];
    const assigned = Array.from({ length: 12 }, (_, i) => pickVariant(variants, 'p', 'sub', i));
    for (const b of [0, 1, 2]) {
      expect(new Set(assigned.slice(b * 4, b * 4 + 4)).size).toBe(4);
    }
  });

  it('draws differently for different element types on one plan', () => {
    const subs = Array.from({ length: 6 }, (_, i) => pickVariant(['a', 'b', 'c'], 'p', 'subtitle', i));
    const kws = Array.from({ length: 6 }, (_, i) => pickVariant(['a', 'b', 'c'], 'p', 'keyword', i));
    expect(subs).not.toEqual(kws);
  });
});

describe('assignTemplates on a multi-variant mode', () => {
  it('assigns every element and repeats nothing back to back', () => {
    const p = plan();
    const result = assignTemplates(p, mode(), templates());

    expect(p.subtitles.groups.every((g) => g.templateId !== null)).toBe(true);
    expect(p.keywords.items.every((k) => k.templateId !== null)).toBe(true);
    expect(p.images.slots.every((s) => s.templateId !== null)).toBe(true);

    for (const ids of Object.values(result.assigned)) expect(longestRun(ids)).toBe(1);
    expect(result.issues).toEqual([]);
  });

  it('spreads across the variants rather than favouring one', () => {
    const result = assignTemplates(plan(9, 4, 8), mode(), templates());
    expect(Object.keys(variantDistribution(result.assigned.subtitle)).sort()).toEqual([
      'sub_pop',
      'sub_slide',
      'sub_wipe',
    ]);
    expect(Object.keys(variantDistribution(result.assigned.image)).length).toBeGreaterThan(1);
  });

  it('is deterministic across runs of the same plan', () => {
    const a = assignTemplates(plan(), mode(), templates());
    const b = assignTemplates(plan(), mode(), templates());
    expect(b.assigned).toEqual(a.assigned);
  });

  it('assigns a template to a superseded group too, so the pairing stays legible', () => {
    const p = plan();
    assignTemplates(p, mode(), templates());
    const superseded = p.subtitles.groups.filter((g) => g.supersededBy !== null);
    expect(superseded.length).toBeGreaterThan(0);
    expect(superseded.every((g) => g.templateId !== null)).toBe(true);
  });

  it('leaves image presentation unset for the Block 4 quality gate', () => {
    const p = plan();
    assignTemplates(p, mode(), templates());
    expect(p.images.slots.every((s) => s.presentation === null)).toBe(true);
  });

  it('fails loudly when a mode allows no variant for a type', () => {
    const broken = mode({
      allowedTemplates: { subtitle: [], keyword: ['kw_slam'], image: ['img_float'] },
    });
    expect(() => assignTemplates(plan(), broken, templates())).toThrow(NoTemplateVariantError);
    expect(() => assignTemplates(plan(), broken, templates())).toThrow(/allows no subtitle template/);
  });

  it('reports an image template that declares no presentation', () => {
    const entries = MULTI_VARIANT_TEMPLATES.map((t) =>
      t.id === 'img_float' ? { ...t, imagePresentation: null } : t,
    );
    const single = mode({
      allowedTemplates: { subtitle: ['sub_pop'], keyword: ['kw_slam'], image: ['img_float'] },
    });
    const result = assignTemplates(plan(), single, templates(entries));
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0]?.message).toContain('declares no imagePresentation');
  });

  it('reports a mode naming a template the manifest does not have', () => {
    const ghost = mode({
      allowedTemplates: { subtitle: ['sub_ghost'], keyword: ['kw_slam'], image: ['img_float'] },
    });
    const result = assignTemplates(plan(), ghost, templates());
    expect(result.issues.some((i) => i.message.includes('not in the manifest'))).toBe(true);
  });
});

describe('deriveSfxEvents', () => {
  /*
   * The chain Block 7 session 3 found broken end to end. `assignTemplates`
   * always handled keywords correctly, so its own tests passed — but the
   * keyword stage never called it, wrote every keyword with a null templateId,
   * and derivation silently produced nothing to attach a hit to. The unit that
   * was wrong was the composition, so that is what this pins.
   */
  it('produces no keyword event while templateIds are null, and one each once assigned', () => {
    const p = plan();
    const index = {
      schemaVersion: 1,
      stub: false,
      sfx: [{ id: 'hit_01', file: 'a.wav', defaultGainDb: -6 }],
    };
    expect(p.keywords.items.every((k) => k.templateId === null)).toBe(true);
    expect(deriveSfxEvents(p, templates(), index)).toEqual([]);

    assignTemplates(p, mode(), templates());
    expect(p.keywords.items.every((k) => k.templateId !== null)).toBe(true);
    expect(deriveSfxEvents(p, templates(), index)).toHaveLength(p.keywords.items.length);
  });

  it('derives one event per binding, in time order, and nothing for subtitles', () => {
    const p = plan();
    assignTemplates(p, mode(), templates());
    const events = deriveSfxEvents(p, templates(), {
      schemaVersion: 1,
      stub: true,
      sfx: [{ id: 'hit_01', file: 'a.wav', defaultGainDb: -6 }],
    });

    expect(events).toHaveLength(p.keywords.items.length);
    expect(events.every((e) => e.sourceElementId.startsWith('k'))).toBe(true);
    for (let i = 1; i < events.length; i += 1) {
      expect(events[i]!.timeS).toBeGreaterThanOrEqual(events[i - 1]!.timeS);
    }
    expect(events.map((e) => e.id)).toEqual(['sfx001', 'sfx002', 'sfx003']);
  });

  it('fires at the element start plus the manifest offset, at the binding gain', () => {
    const p = plan(2, 1, 0);
    const single = mode({
      allowedTemplates: { subtitle: ['sub_pop'], keyword: ['kw_slam'], image: ['img_float'] },
    });
    assignTemplates(p, single, templates());
    const [event] = deriveSfxEvents(p, templates(), {
      schemaVersion: 1,
      stub: true,
      sfx: [{ id: 'hit_01', file: 'a.wav', defaultGainDb: -99 }],
    });
    expect(event?.timeS).toBeCloseTo(0.1, 10);
    expect(event?.gainDb).toBe(-6);
  });

  it('is recomputed, never merged with what the plan already carried', () => {
    const p = plan();
    assignTemplates(p, mode(), templates());
    p.sfx = { events: [{ id: 'stale', sourceElementId: 'gone', sfxId: 'x', timeS: 99, gainDb: 0 }] };
    const events = deriveSfxEvents(p, templates(), {
      schemaVersion: 1,
      stub: true,
      sfx: [{ id: 'hit_01', file: 'a.wav', defaultGainDb: -6 }],
    });
    expect(events.some((e) => e.id === 'stale')).toBe(false);
  });

  it('fails loudly on a binding the sfx index does not define', () => {
    const p = plan();
    assignTemplates(p, mode(), templates());
    expect(() =>
      deriveSfxEvents(p, templates(), { schemaVersion: 1, stub: true, sfx: [] }),
    ).toThrow(UnknownSfxError);
  });
});

describe('checkBuildability', () => {
  const short = template({ id: 'sub_pop', introS: 1, minHoldS: 1, outroS: 1 });

  it('passes a plan whose elements are long enough', () => {
    const p = plan();
    assignTemplates(p, mode(), templates());
    p.sfx = { events: deriveSfxEvents(p, templates(), { schemaVersion: 1, stub: true, sfx: [{ id: 'hit_01', file: 'a.wav', defaultGainDb: -6 }] }) };
    expect(checkBuildability(p, templates()).issues).toEqual([]);
  });

  it('reports a too-short element and by how much, without changing it', () => {
    const p = plan(2, 0, 0);
    const single = mode({
      allowedTemplates: { subtitle: ['sub_pop'], keyword: ['kw_slam'], image: ['img_float'] },
    });
    assignTemplates(p, single, templates([short, ...MULTI_VARIANT_TEMPLATES.slice(3)]));
    const before = p.subtitles.groups.map((g) => g.end - g.start);
    const report = checkBuildability(p, templates([short, ...MULTI_VARIANT_TEMPLATES.slice(3)]));
    expect(report.issues.length).toBe(2);
    // Against `cardMinimumDurationS`, not the nominal intro+hold: the entrance
    // compresses, so the floor a card has to clear is lower than the sum.
    const floor = cardMinimumDurationS(short.introS, short.minHoldS) + short.outroS;
    expect(report.issues[0]?.shortByS).toBeCloseTo(floor - 0.5, 10);
    expect(p.subtitles.groups.map((g) => g.end - g.start)).toEqual(before);
  });

  // At one word per card a two-word span legitimately covers two cards; what
  // is still a defect is a card inside the span not marked as superseded.
  it('reports a card the span covers but does not supersede', () => {
    const p = plan();
    assignTemplates(p, mode(), templates());
    p.keywords.items[0]!.wordIds = ['w0', 'w1'];
    expect(
      checkBuildability(p, templates()).issues.some((i) =>
        i.message.includes('not marked superseded by k001'),
      ),
    ).toBe(true);
  });

  it('accepts a two-word span when both cards it covers are superseded', () => {
    const p = plan();
    assignTemplates(p, mode(), templates());
    p.keywords.items[0]!.wordIds = ['w0', 'w1'];
    p.subtitles.groups[0]!.supersededBy = 'k001';
    p.subtitles.groups[1]!.supersededBy = 'k001';
    p.keywords.items = [p.keywords.items[0]!];
    expect(
      checkBuildability(p, templates()).issues.filter((i) => i.path.startsWith('keywords')),
    ).toEqual([]);
  });

  it('reports a group that matches a span but is not marked superseded', () => {
    const p = plan();
    assignTemplates(p, mode(), templates());
    p.subtitles.groups[0]!.supersededBy = null;
    expect(
      checkBuildability(p, templates()).issues.some((i) => i.message.includes('not marked superseded')),
    ).toBe(true);
  });

  it('reports an unresolvable slot word id and an overlap', () => {
    const p = plan();
    assignTemplates(p, mode(), templates());
    p.images.slots[0]!.wordIds = ['w99'];
    p.images.slots[1]!.start = 0;
    const issues = checkBuildability(p, templates()).issues;
    expect(issues.some((i) => i.message.includes('no transcript word has id w99'))).toBe(true);
    expect(issues.some((i) => i.message.includes('overlaps the previous slot'))).toBe(true);
  });

  it('reports a templateId the manifest does not have', () => {
    const p = plan();
    assignTemplates(p, mode(), templates());
    p.keywords.items[0]!.templateId = 'kw_ghost';
    expect(
      checkBuildability(p, templates()).issues.some((i) => i.message.includes('not in the manifest')),
    ).toBe(true);
  });

  it('reports an element with no template at all', () => {
    const p = plan();
    expect(checkBuildability(p, templates()).issues.some((i) => i.message === 'no templateId assigned')).toBe(
      true,
    );
  });
});

/*
 * Block 7 session 4. The draw used to ignore script and would have put
 * `sub_pop_ar` under 20 of vitasilk's 41 Latin cards — a comp rendered in the
 * wrong face, which nothing downstream would have flagged.
 */
describe('assignTemplates respects script', () => {
  // The fixture makes one single-word group per word, so flipping a word's
  // script flips its group's.
  const scripted = (): ReturnType<typeof plan> => {
    const p = plan(8, 2, 0);
    p.transcript.words.forEach((w, i) => {
      w.script = i >= 4 ? 'arabic' : 'latin';
    });
    p.keywords.items[0]!.wordIds = ['w0'];
    p.keywords.items[1]!.wordIds = ['w6'];
    return p;
  };

  const bothScripts = () => ({
    ...mode(),
    allowedTemplates: {
      subtitle: ['sub_pop', 'sub_pop_ar'],
      keyword: ['kw_slam', 'kw_slam_ar'],
      image: ['img_float'],
    },
  });

  it('gives a Latin element a Latin variant and an Arabic element the _ar one', () => {
    const p = scripted();
    assignTemplates(p, bothScripts(), templates());
    const wordScript = new Map(p.transcript.words.map((w) => [w.id, w.script]));
    for (const g of p.subtitles.groups) {
      const isArabic = wordScript.get(g.wordIds[0]!) === 'arabic';
      expect(g.templateId?.endsWith('_ar')).toBe(isArabic);
    }
    for (const k of p.keywords.items) {
      const isArabic = wordScript.get(k.wordIds[0]!) === 'arabic';
      expect(k.templateId?.endsWith('_ar')).toBe(isArabic);
    }
  });

  it('is still deterministic across runs', () => {
    const a = scripted();
    const b = scripted();
    assignTemplates(a, bothScripts(), templates());
    assignTemplates(b, bothScripts(), templates());
    expect(a.subtitles.groups.map((g) => g.templateId)).toEqual(
      b.subtitles.groups.map((g) => g.templateId),
    );
  });

  it('reports a mixed-script span rather than silently picking a face', () => {
    const p = scripted();
    p.keywords.items[0]!.wordIds = ['w0', 'w6'];
    const result = assignTemplates(p, bothScripts(), templates());
    expect(result.issues.some((i) => /more than one script/.test(i.message))).toBe(true);
  });
});

/*
 * Block 7 session 3 found stored events carrying gains of −12, −9 and −6 dB,
 * from a stub manifest that stopped existing in Block 6. Derivation takes its
 * gain from the binding, and every binding's gain is pinned equal to its index
 * default by a test in core — so a value absent from the index can only reach
 * a plan by being carried over from an older run, never by being derived.
 */
describe('derived gains come from the real index', () => {
  it('cannot produce a gain the sfx index does not declare', () => {
    const index = loadSfxIndex();
    const declared = new Set(index.sfx.map((s) => s.defaultGainDb));
    const p = plan();
    assignTemplates(p, mode(), templatesById(loadTemplateManifest()));
    const events = deriveSfxEvents(p, templatesById(loadTemplateManifest()), index);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) expect(declared.has(e.gainDb)).toBe(true);
    for (const stubEra of [-12, -9, -6]) expect(declared.has(stubEra)).toBe(false);
  });
});
