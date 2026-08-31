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
  it('drops every excluded field, measured or ruled', () => {
    const out = normaliseCensus(census, REPO) as Record<string, unknown>;
    expect(out['measuredAt']).toBeUndefined();
    expect(out['aepSha256']).toBeUndefined();
    // Ruled out in session 15: they describe the machine, not the comp.
    expect(out['aeVersion']).toBeUndefined();
    expect(out['fontNameCount']).toBeUndefined();
    // What is left is the built thing itself.
    expect(out['masters']).toBeDefined();
  });

  it('makes a repo path relative instead of dropping it', () => {
    const out = normaliseCensus(census, REPO) as {
      aepPath: string;
      masters: { layers: { sourceFile: string }[] }[];
      imageComps: { layers: { sourceFile: string }[] }[];
    };
    expect(out.aepPath).toBe('.local/build/vitasilk-full.aep');
    expect(out.masters[0]?.layers[0]?.sourceFile).toBe('my files/test videos/vitasilk.mov');
    expect(out.imageComps[0]?.layers[0]?.sourceFile).toBe('.local/cache/x/image.jpg');
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

  it('every exclusion carries its reason and what it was observed to take', () => {
    expect(GOLDEN_EXCLUDED_FIELDS.length).toBeGreaterThan(0);
    for (const field of GOLDEN_EXCLUDED_FIELDS) {
      expect(field.reason).not.toBe('');
      expect(field.observed).not.toBe('');
    }
  });

  /**
   * The exclusion list is the one place this harness can be quietly weakened:
   * adding a path here makes a real difference invisible. It stays two until a
   * measurement says otherwise.
   */
  it('excludes exactly these four, and says which are measured and which are ruled', () => {
    expect(GOLDEN_EXCLUDED_FIELDS.map((f) => f.path).sort()).toEqual([
      'aeVersion',
      'aepSha256',
      'fontNameCount',
      'measuredAt',
    ]);
    const measured = GOLDEN_EXCLUDED_FIELDS.filter((f) => f.because === 'measured');
    const ruled = GOLDEN_EXCLUDED_FIELDS.filter((f) => f.because === 'not-about-the-comp');
    expect(measured.map((f) => f.path).sort()).toEqual(['aepSha256', 'measuredAt']);
    expect(ruled.map((f) => f.path).sort()).toEqual(['aeVersion', 'fontNameCount']);
  });

  /**
   * A field excluded because it was measured to vary must carry the builds
   * behind it; one excluded by ruling must not claim a measurement it never had.
   */
  it('a measured exclusion has runs behind it and a ruled one does not', () => {
    for (const f of GOLDEN_EXCLUDED_FIELDS) {
      if (f.because === 'measured') expect(f.runs).toBeGreaterThanOrEqual(3);
      else expect(f.runs).toBe(0);
    }
    const lines = excludedFieldsSummary();
    expect(lines.filter((l) => l.includes('measured varying across'))).toHaveLength(2);
    expect(lines.filter((l) => l.includes('recorded as a run input instead'))).toHaveLength(2);
  });

  /**
   * The face on each text layer is what replaced `fontNameCount`. If that ever
   * stopped being compared, dropping the count would have removed a check
   * rather than moved one.
   */
  it('still compares the face set on every text layer', () => {
    const withFont = {
      textComps: [{ layers: [{ name: 'TXT_MAIN', font: 'Inter-SemiBold' }] }],
      fontNameCount: 1198,
    };
    const other = {
      textComps: [{ layers: [{ name: 'TXT_MAIN', font: 'Almarai-Bold' }] }],
      fontNameCount: 42,
    };
    const diffs = compareCensus(normaliseCensus(withFont, REPO), normaliseCensus(other, REPO));
    expect(diffs).toEqual([
      { path: 'textComps[0].layers[0].font', expected: 'Inter-SemiBold', actual: 'Almarai-Bold' },
    ]);
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
