import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertRenderable,
  loadSfxIndex,
  loadTemplateManifest,
  StubTemplatesError,
  templatesById,
  validateSfxIndex,
  validateTemplateManifest,
  validateTemplates,
  SFX_DIR,
  type AuditComp,
  type AuditLayer,
  type AuditProperty,
  type TemplateManifest,
} from './templates.js';

const sfxIds = new Set(['hit_01', 'whoosh_01']);

const entry = (o: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'kw_slam',
  file: 'library.aep',
  type: 'keyword',
  placeholders: ['TXT_MAIN'],
  introS: 0.2,
  outroS: 0.15,
  minHoldS: 0.3,
  anchor: 'center',
  imagePresentation: null,
  sfx: [{ sfxId: 'hit_01', offsetS: 0.1, gainDb: -6 }],
  notes: 'n',
  ...o,
});

const manifest = (templates: unknown[]): Record<string, unknown> => ({
  schemaVersion: 1,
  stub: true,
  templates,
});

const paths = (issues: { path: string }[]): string[] => issues.map((i) => i.path);

describe('validateTemplateManifest', () => {
  it('accepts the §8 shape', () => {
    expect(validateTemplateManifest(manifest([entry()]), sfxIds)).toEqual([]);
  });

  it('rejects an sfxId the index does not define', () => {
    const issues = validateTemplateManifest(
      manifest([entry({ sfx: [{ sfxId: 'nope', offsetS: 0, gainDb: -6 }] })]),
      sfxIds,
    );
    expect(paths(issues)).toEqual(['templates[0].sfx[0].sfxId']);
    expect(issues[0]?.message).toContain('no sfx with id nope');
  });

  it('rejects an id that disagrees with its type', () => {
    expect(paths(validateTemplateManifest(manifest([entry({ type: 'subtitle' })]), sfxIds))).toEqual(
      ['templates[0].id'],
    );
  });

  it('rejects a duplicate id', () => {
    expect(
      paths(validateTemplateManifest(manifest([entry(), entry()]), sfxIds)),
    ).toEqual(['templates[1].id']);
  });

  it('requires an image template to declare a presentation', () => {
    expect(
      paths(
        validateTemplateManifest(
          manifest([entry({ id: 'img_float', type: 'image', imagePresentation: null })]),
          sfxIds,
        ),
      ),
    ).toEqual(['templates[0].imagePresentation']);
  });

  it('refuses a presentation on a non-image template', () => {
    expect(
      paths(validateTemplateManifest(manifest([entry({ imagePresentation: 'card' })]), sfxIds)),
    ).toEqual(['templates[0].imagePresentation']);
  });

  it('requires the stub flag, so a manifest always says whether it is real', () => {
    const m = manifest([entry()]);
    delete m.stub;
    expect(paths(validateTemplateManifest(m, sfxIds))).toEqual(['stub']);
  });

  it('rejects a negative timing', () => {
    expect(paths(validateTemplateManifest(manifest([entry({ introS: -1 })]), sfxIds))).toEqual([
      'templates[0].introS',
    ]);
  });
});

describe('validateSfxIndex', () => {
  it('accepts the stub shape', () => {
    expect(
      validateSfxIndex({
        schemaVersion: 1,
        stub: true,
        sfx: [{ id: 'hit_01', file: 'hit_01.wav', defaultGainDb: -6 }],
      }),
    ).toEqual([]);
  });

  it('rejects a duplicate id and a missing gain', () => {
    const issues = validateSfxIndex({
      schemaVersion: 1,
      stub: true,
      sfx: [
        { id: 'hit_01', file: 'a.wav', defaultGainDb: -6 },
        { id: 'hit_01', file: 'b.wav' },
      ],
    });
    expect(paths(issues)).toEqual(['sfx[1].id', 'sfx[1].defaultGainDb']);
  });
});

describe('the files on disk', () => {
  const loaded = loadTemplateManifest();

  it('load and validate together', () => {
    expect(loaded.templates.length).toBeGreaterThan(0);
    expect(loadSfxIndex().sfx.map((s) => s.id)).toEqual([
      'hit_01', 'hit_02', 'whoosh_01', 'whoosh_02',
    ]);
  });

  // The manifest stopped being a stub in Block 6 session 7 when the six comps
  // were built; the SFX index stopped being one in Block 7 session 2 when the
  // four audio files arrived.
  it('describe real comps and a real sfx index', () => {
    expect(loaded.stub).toBe(false);
    expect(loadSfxIndex().stub).toBe(false);
  });

  it('name a file that is actually on disk for every sfx id', () => {
    for (const s of loadSfxIndex().sfx) {
      expect(existsSync(path.join(SFX_DIR, s.file))).toBe(true);
    }
  });

  // The Block 7 session 3 ruling: keywords punctuate with a hit, images lead
  // with a whoosh, subtitles stay silent because they fire ~190 times a reel
  // and any sound there becomes noise.
  it('bind sfx by element type, and leave subtitles silent', () => {
    const byType: Record<string, string[]> = {};
    for (const t of loaded.templates) {
      byType[t.type] = (byType[t.type] ?? []).concat(t.sfx.map((b) => b.sfxId));
    }
    expect(byType.subtitle).toEqual([]);
    expect(byType.keyword).toEqual(['hit_01', 'hit_01']);
    expect(byType.image).toEqual(['whoosh_01', 'whoosh_01']);
  });

  /*
   * gainDb now lives in two files: the binding in templates/manifest.json and
   * the default in assets/sfx/sfx.json. Two copies of one number drift, and a
   * drift here is inaudible until someone plays a built comp — so it is pinned
   * rather than trusted.
   *
   * The rule is deliberately equality, not "the binding may override". A
   * binding that genuinely wants a different level is a real possibility and
   * this test is what will force that decision to be made explicitly.
   */
  it('keep every binding gain equal to its sfx index default', () => {
    const defaults = new Map(loadSfxIndex().sfx.map((s) => [s.id, s.defaultGainDb]));
    for (const t of loaded.templates) {
      for (const b of t.sfx) {
        expect(defaults.get(b.sfxId)).toBe(b.gainDb);
      }
    }
  });

  // The hit lands where the animation lands, on frame 4; a whoosh leads the
  // motion rather than punctuating it, so it starts with the element.
  it('offset the hit to the animation and start the whoosh at zero', () => {
    for (const t of loaded.templates) {
      for (const b of t.sfx) {
        expect(b.offsetS).toBe(t.type === 'keyword' ? t.introS : 0);
      }
    }
  });

  it('carry both script variants of each text template', () => {
    const ids = loaded.templates.map((t) => t.id);
    expect(ids).toContain('sub_pop_ar');
    expect(ids).toContain('kw_slam_ar');
  });

  it('declare no sfx on the subtitle template, per §10', () => {
    expect(templatesById(loaded).get('sub_pop')?.sfx).toEqual([]);
  });

  it('cover one template per element type', () => {
    const types = loaded.templates.map((t) => t.type);
    expect(new Set(types)).toEqual(new Set(['subtitle', 'keyword', 'image']));
  });
});

describe('assertRenderable', () => {
  it('refuses a stub manifest and names the stage', () => {
    const stub = { ...loadTemplateManifest(), stub: true } as TemplateManifest;
    expect(() => assertRenderable(stub, 'build')).toThrow(StubTemplatesError);
    expect(() => assertRenderable(stub, 'build')).toThrow(/stage "build" renders/);
  });

  it('allows the manifest on disk, which is no longer a stub', () => {
    expect(() => assertRenderable(loadTemplateManifest(), 'build')).not.toThrow();
  });
});

describe('validateTemplates', () => {
  const SHA = 'a'.repeat(64);
  const prop = (value: unknown): AuditProperty => ({
    value,
    valueAtSampleTime: value,
    keyframes: 0,
    unreadable: null,
  });
  const layer = (over: Partial<AuditLayer> = {}): AuditLayer => ({
    name: 'TXT_MAIN',
    kind: 'text',
    position: prop([1080, 700, 0]),
    anchorPoint: prop([0, 0, 0]),
    ...over,
  });
  const comp = (name: string, over: Partial<AuditComp> = {}): AuditComp => ({
    name,
    frameRate: 29.97,
    width: 2160,
    height: 1100,
    duration: 2.002,
    layers: [layer()],
    ...over,
  });
  const entry = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    file: 'library.aep',
    type: 'subtitle',
    placeholders: ['TXT_MAIN'],
    introS: 0.13,
    outroS: 0,
    minHoldS: 0.1,
    anchor: 'center',
    imagePresentation: null,
    sfx: [],
    notes: '',
    ...over,
  });
  const run = (comps: AuditComp[], templates: Record<string, unknown>[], sfx: string[] = []) =>
    validateTemplates({
      audit: { ok: true, aepSha256: SHA, comps },
      manifest: { stub: false, templates },
      sfxIds: new Set(sfx),
      aepSha256: SHA,
    });

  // The audit is what measures geometry, so a stale audit file must fail
  // loudly rather than let a build read a default. The wording is asserted,
  // not just the count: a message that stops naming the comp, the layer or the
  // field stops being actionable, and this repo has messages pinned only by
  // reading elsewhere.
  describe('placeholder geometry', () => {
    it('names comp, layer and field when position was never audited', () => {
      const stale = comp('sub_pop', { layers: [{ name: 'TXT_MAIN', kind: 'text' }] });
      expect(run([stale], [entry('sub_pop')])).toEqual([
        'comp "sub_pop" layer "TXT_MAIN" has no audited position: ' +
          'templates/library.audit.json predates layer geometry. ' +
          'Re-run: npm run audit:templates (After Effects must be open)',
        'comp "sub_pop" layer "TXT_MAIN" has no audited anchorPoint: ' +
          'templates/library.audit.json predates layer geometry. ' +
          'Re-run: npm run audit:templates (After Effects must be open)',
      ]);
    });

    it('reports the reason AE gave when a field was audited but unreadable', () => {
      const broken = comp('sub_pop', {
        layers: [layer({
          anchorPoint: {
            value: null, valueAtSampleTime: null, keyframes: null,
            unreadable: 'valueAtTime threw: Error',
          },
        })],
      });
      expect(run([broken], [entry('sub_pop')])).toEqual([
        'comp "sub_pop" layer "TXT_MAIN" has an unreadable anchorPoint: valueAtTime threw: Error',
      ]);
    });

    it('checks only declared placeholders, not decorative layers', () => {
      const withCard = comp('sub_pop', {
        layers: [layer(), { name: 'CARD', kind: 'solid' }],
      });
      expect(run([withCard], [entry('sub_pop')])).toEqual([]);
    });
  });

  it('passes a manifest that matches the audit', () => {
    expect(run([comp('sub_pop')], [entry('sub_pop')])).toEqual([]);
  });

  it('reports a stale audit rather than validating against it', () => {
    const problems = validateTemplates({
      audit: { ok: true, aepSha256: SHA, comps: [comp('sub_pop')] },
      manifest: { stub: false, templates: [entry('sub_pop')] },
      sfxIds: new Set(),
      aepSha256: 'b'.repeat(64),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/stale/);
  });

  it('refuses to pass a failed audit', () => {
    const problems = validateTemplates({
      audit: { ok: false, error: 'AE said no' },
      manifest: { stub: false, templates: [entry('sub_pop')] },
      sfxIds: new Set(),
      aepSha256: SHA,
    });
    expect(problems[0]).toMatch(/AE said no/);
  });

  it('names a manifest id with no comp', () => {
    expect(run([], [entry('sub_pop')])[0]).toMatch(/"sub_pop" has no comp/);
  });

  it('names a template-looking comp with no manifest entry', () => {
    expect(run([comp('sub_pop'), comp('sub_ghost')], [entry('sub_pop')])[0]).toMatch(
      /"sub_ghost" looks like a template/,
    );
  });

  it('ignores a non-template comp with no manifest entry', () => {
    expect(run([comp('sub_pop'), comp('precomp_bg')], [entry('sub_pop')])).toEqual([]);
  });

  it('names the comp and the missing placeholder layer', () => {
    const problems = run([comp('sub_pop', { layers: [] })], [entry('sub_pop')]);
    expect(problems[0]).toContain('comp "sub_pop"');
    expect(problems[0]).toContain('"TXT_MAIN"');
  });

  it('rejects a placeholder of the wrong kind', () => {
    const problems = run(
      [comp('sub_pop', { layers: [{ name: 'TXT_MAIN', kind: 'solid' }] })],
      [entry('sub_pop')],
    );
    expect(problems[0]).toMatch(/is a solid layer; an editable text layer is required/);
  });

  // The built comps use solids for IMG_MAIN rather than the still §4 suggests,
  // and a solid replaces exactly as well.
  it('accepts a solid or a footage layer for IMG_MAIN', () => {
    for (const kind of ['solid', 'footage']) {
      const problems = run(
        [comp('img_float', { layers: [layer({ name: 'IMG_MAIN', kind })] })],
        [entry('img_float', { type: 'image', placeholders: ['IMG_MAIN'], imagePresentation: 'card' })],
      );
      expect(problems).toEqual([]);
    }
  });

  it('rejects 30 fps and accepts 29.97 and 30000/1001', () => {
    expect(run([comp('sub_pop', { frameRate: 30 })], [entry('sub_pop')])[0]).toMatch(/30 fps/);
    expect(run([comp('sub_pop', { frameRate: 29.97 })], [entry('sub_pop')])).toEqual([]);
    expect(run([comp('sub_pop', { frameRate: 30000 / 1001 })], [entry('sub_pop')])).toEqual([]);
  });

  it('rejects timings that do not fit the comp duration', () => {
    const problems = run(
      [comp('sub_pop', { duration: 0.2 })],
      [entry('sub_pop', { introS: 0.13, minHoldS: 0.1, outroS: 0 })],
    );
    expect(problems[0]).toMatch(/is 0.200s long but its manifest timings need 0.230s/);
  });

  it('rejects intro+outro over the measured budget', () => {
    const problems = run([comp('sub_pop')], [entry('sub_pop', { outroS: 0.15 })]);
    expect(problems[0]).toMatch(/exceeds the intro\+outro budget/);
    expect(problems[0]).toContain('reduce introS+outroS by 0.150s');
    expect(problems[0]).toContain('introS 0.13 + outroS 0.15 = 0.280s');
    expect(problems[0]).toContain('Allowed: 0.130s');
  });

  // outroS 0 is a legitimate value, not a missing one: the card hard-cuts.
  it('accepts outroS of zero', () => {
    expect(run([comp('sub_pop')], [entry('sub_pop', { outroS: 0 })])).toEqual([]);
  });

  it('rejects an sfxId the index does not define', () => {
    const problems = run(
      [comp('sub_pop')],
      [entry('sub_pop', { sfx: [{ sfxId: 'hit_99' }] })],
      ['hit_01'],
    );
    expect(problems[0]).toMatch(/binds sfxId "hit_99"/);
  });

  it('reports every problem at once rather than the first', () => {
    const problems = run(
      [comp('sub_pop', { frameRate: 30, layers: [] })],
      [entry('sub_pop', { outroS: 0.15 })],
    );
    expect(problems.length).toBeGreaterThanOrEqual(3);
  });
});
