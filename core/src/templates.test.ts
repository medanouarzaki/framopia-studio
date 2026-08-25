import { describe, expect, it } from 'vitest';
import {
  assertRenderable,
  loadSfxIndex,
  loadTemplateManifest,
  StubTemplatesError,
  templatesById,
  validateSfxIndex,
  validateTemplateManifest,
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
    expect(loadSfxIndex().sfx.map((s) => s.id)).toEqual(['hit_01', 'whoosh_01']);
  });

  it('are both still marked as stubs', () => {
    expect(loaded.stub).toBe(true);
    expect(loadSfxIndex().stub).toBe(true);
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
    expect(() => assertRenderable(loadTemplateManifest(), 'build')).toThrow(StubTemplatesError);
    expect(() => assertRenderable(loadTemplateManifest(), 'build')).toThrow(/stage "build" renders/);
  });

  it('allows a manifest that says it is real', () => {
    const real = { ...loadTemplateManifest(), stub: false } as TemplateManifest;
    expect(() => assertRenderable(real, 'build')).not.toThrow();
  });
});
