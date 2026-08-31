import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GOLDEN_EXCLUDED_FIELDS,
  GOLDEN_REELS,
  GOLDEN_REELS_EXCLUDED,
  GOLDEN_SCHEMA_VERSION,
  GoldenReferenceError,
  compareCensus,
  countFields,
  excludedFieldsSummary,
  normaliseCensus,
  parseGoldenReference,
} from './golden.js';

const REPO = '/somewhere/framopia-studio';

const census = {
  measuredAt: '2026-08-31T00:00:00.000Z',
  aepSha256: 'aaaa',
  aepPath: `${REPO}/.local/build/vitasilk-full.aep`,
  aeVersion: '26.0x67',
  masters: [
    {
      name: 'master_final',
      numLayers: 83,
      layers: [{ name: 'img001', sourceFile: `${REPO}/my files/test videos/vitasilk.mov`, position: [1, 2] }],
    },
  ],
  imageComps: [
    { compName: 'img001__img_float', layers: [{ name: 'IMG_MAIN', sourceFile: `${REPO}/.local/cache/x/image.jpg` }] },
  ],
};

describe('normalising a census', () => {
  it('drops exactly the fields measured to vary', () => {
    const out = normaliseCensus(census, REPO) as Record<string, unknown>;
    expect(out['measuredAt']).toBeUndefined();
    expect(out['aepSha256']).toBeUndefined();
    expect(out['aeVersion']).toBe('26.0x67');
  });

  it('makes a repo path relative instead of dropping it', () => {
    const out = normaliseCensus(census, REPO) as Record<string, never>;
    expect(out['aepPath']).toBe('.local/build/vitasilk-full.aep');
    expect(out['masters'][0]['layers'][0]['sourceFile']).toBe('my files/test videos/vitasilk.mov');
    expect(out['imageComps'][0]['layers'][0]['sourceFile']).toBe('.local/cache/x/image.jpg');
  });

  it('two roots that differ only by prefix normalise equal', () => {
    const other = JSON.parse(JSON.stringify(census).split(REPO).join('/elsewhere/copy'));
    expect(normaliseCensus(other, '/elsewhere/copy')).toEqual(normaliseCensus(census, REPO));
  });

  it('leaves a path outside the repository alone, so it can still differ', () => {
    const out = normaliseCensus({ aepPath: '/Applications/Adobe/x.aep' }, REPO) as Record<string, unknown>;
    expect(out['aepPath']).toBe('/Applications/Adobe/x.aep');
  });

  it('does not care what order the keys were written in', () => {
    const reordered = JSON.parse(JSON.stringify({ aepPath: census.aepPath, masters: census.masters }));
    const straight = { masters: census.masters, aepPath: census.aepPath };
    expect(normaliseCensus(reordered, REPO)).toEqual(normaliseCensus(straight, REPO));
  });
});

describe('comparing two censuses', () => {
  const base = normaliseCensus(census, REPO);
  const changed = (mutate: (c: typeof census) => void): unknown => {
    const copy = JSON.parse(JSON.stringify(census)) as typeof census;
    mutate(copy);
    return normaliseCensus(copy, REPO);
  };

  it('finds nothing when the two agree', () => {
    expect(compareCensus(base, normaliseCensus(JSON.parse(JSON.stringify(census)), REPO))).toEqual([]);
  });

  it('names the field path and both values', () => {
    const diffs = compareCensus(base, changed((c) => { c.masters[0]!.numLayers = 99; }), 'vitasilk');
    expect(diffs).toEqual([{ path: 'vitasilk.masters[0].numLayers', expected: 83, actual: 99 }]);
  });

  it('catches a different picture in an image comp', () => {
    const diffs = compareCensus(
      base,
      changed((c) => { c.imageComps[0]!.layers[0]!.sourceFile = `${REPO}/.local/cache/y/image.jpg`; }),
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.path).toBe('imageComps[0].layers[0].sourceFile');
    expect(diffs[0]!.expected).toBe('.local/cache/x/image.jpg');
    expect(diffs[0]!.actual).toBe('.local/cache/y/image.jpg');
  });

  it('reports a length change and does not read past the shorter side', () => {
    const diffs = compareCensus(base, changed((c) => { c.masters[0]!.layers = []; }));
    expect(diffs.map((d) => d.path)).toEqual(['masters[0].layers.length']);
  });

  it('reports a key present on one side only, rather than skipping it', () => {
    const diffs = compareCensus({ a: 1 }, { b: 2 });
    expect(diffs).toEqual([
      { path: 'a', expected: 1, actual: '<absent>' },
      { path: 'b', expected: '<absent>', actual: 2 },
    ]);
  });

  it('a type change is a difference, not a coincidence', () => {
    expect(compareCensus({ a: 1 }, { a: '1' })).toEqual([{ path: 'a', expected: 1, actual: '1' }]);
    expect(compareCensus({ a: [1] }, { a: { 0: 1 } })).toHaveLength(1);
  });
});

describe('the golden reference', () => {
  it('refuses a reference that is not an object', () => {
    expect(() => parseGoldenReference([], 'x.json')).toThrow(GoldenReferenceError);
  });

  it('refuses a schema version it does not read', () => {
    expect(() => parseGoldenReference({ schemaVersion: 99, reels: {} }, 'x.json')).toThrow(/schemaVersion 99/);
  });

  it('refuses a reference missing a reel, naming it', () => {
    const reels = Object.fromEntries(GOLDEN_REELS.filter((r) => r !== 'test-3').map((r) => [r, {}]));
    expect(() => parseGoldenReference({ schemaVersion: GOLDEN_SCHEMA_VERSION, reels }, 'x.json')).toThrow(
      /no census for test-3/,
    );
  });

  it('excludes ground-truth and says why', () => {
    expect(GOLDEN_REELS).not.toContain('ground-truth');
    expect(GOLDEN_REELS_EXCLUDED['ground-truth']).toContain('pre-flight');
  });

  it('every exclusion carries the measurement behind it', () => {
    expect(GOLDEN_EXCLUDED_FIELDS.length).toBeGreaterThan(0);
    for (const field of GOLDEN_EXCLUDED_FIELDS) {
      expect(field.reason).not.toBe('');
      expect(field.observed).not.toBe('');
      expect(field.runs).toBeGreaterThanOrEqual(3);
    }
    for (const line of excludedFieldsSummary()) expect(line).toMatch(/measured varying across \d+ builds/);
  });

  /**
   * The exclusion list is the one place this harness can be quietly weakened:
   * adding a path here makes a real difference invisible. It stays two until a
   * measurement says otherwise.
   */
  it('excludes only the two fields measured to vary', () => {
    expect(GOLDEN_EXCLUDED_FIELDS.map((f) => f.path).sort()).toEqual(['aepSha256', 'measuredAt']);
  });

  it('counts leaves, so a match reports its own weight', () => {
    expect(countFields({ a: 1, b: [2, 3], c: { d: 4 } })).toBe(4);
  });
});

describe('the golden harness cannot spend', () => {
  /**
   * The guarantee is structural: the harness builds and censuses, and there is
   * no path from either to a paid API. Read from the file rather than asserted,
   * the way the align-review tools are pinned read-only.
   */
  it('imports nothing that bills', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const cli = readFileSync(path.join(here, '..', '..', 'tools', 'golden', 'cli.ts'), 'utf8');
    const stripped = cli.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const forbidden of ['appendCost', 'generateImages', 'runPipeline', 'transcribeHybrid', 'GoogleGenAI', '@google/genai']) {
      expect(stripped).not.toContain(forbidden);
    }
  });
});
