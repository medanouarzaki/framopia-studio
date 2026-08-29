import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { chooseRatio, ratioTable, type FaceMeasurement } from './font-ratios.js';
import { REPO_ROOT } from './paths.js';
import { EMPHASIS_SIZE_RATIO, RULED_EMPHASIS_QUANTITY } from './typography.js';

/* The real numbers, from After Effects 26.0x67 on 2026-08-29. */
const INTER: FaceMeasurement = {
  role: 'latin',
  fontUsed: 'Inter-SemiBold',
  subtitle: {
    size: 343,
    capHeight: 249.5459,
    xHeight: 187.2432,
    oneWordText: 'glow',
    oneWordAdvance: 773.5923,
    phraseText: 'dernière génération',
    phraseAdvance: 3228.186,
  },
  keyword: {
    size: 425,
    capHeight: 309.2041,
    xHeight: 232.0068,
    oneWordText: 'glow',
    oneWordAdvance: 958.5327,
    phraseText: 'dernière génération',
    phraseAdvance: 3999.939,
  },
};

const CORMORANT: FaceMeasurement = {
  role: 'emphasis',
  fontUsed: 'CormorantGaramondItalic-SemiBoldItalic',
  subtitle: {
    size: 343,
    capHeight: 214.375,
    xHeight: 138.915,
    oneWordText: 'glow',
    oneWordAdvance: 570.4036,
    phraseText: 'dernière génération',
    phraseAdvance: 2351.265,
  },
  keyword: {
    size: 425,
    capHeight: 265.625,
    xHeight: 172.125,
    oneWordText: 'glow',
    oneWordAdvance: 706.7684,
    phraseText: 'dernière génération',
    phraseAdvance: 2913.3752,
  },
};

const ALMARAI: FaceMeasurement = {
  role: 'arabic',
  fontUsed: 'Almarai-Bold',
  subtitle: {
    size: 343,
    capHeight: 245.588,
    xHeight: 181.79,
    oneWordText: 'شنو',
    oneWordAdvance: 639.695,
    phraseText: 'ترطيب عميق للبشرة',
    phraseAdvance: 2962.834,
  },
  keyword: {
    size: 425,
    capHeight: 304.3,
    xHeight: 225.25,
    oneWordText: 'شنو',
    oneWordAdvance: 792.625,
    phraseText: 'ترطيب عميق للبشرة',
    phraseAdvance: 3671.1501,
  },
};

describe('ratioTable', () => {
  it('gives the same ratio at both sizes, which is what makes it a property of the faces', () => {
    for (const row of ratioTable(INTER, CORMORANT).rows) {
      expect(row.sizeDisagreement, row.quantity).toBeLessThan(1e-4);
    }
  });

  /*
   * An advance width compared across different text says nothing. Inter was
   * measured on `glow` and Almarai on `شنو`, so their widths are two strings
   * rather than one string in two faces — and the ratio, 1.209, is a fact about
   * the sample and not about the faces.
   */
  it('knows an advance is only a comparison when both faces set the same string', () => {
    const latin = ratioTable(INTER, CORMORANT).rows;
    expect(latin.find((r) => r.quantity === 'oneWordAdvance')?.comparable).toBe(true);
    expect(latin.find((r) => r.quantity === 'phraseAdvance')?.comparable).toBe(true);

    const arabic = ratioTable(INTER, ALMARAI).rows;
    expect(arabic.find((r) => r.quantity === 'oneWordAdvance')?.comparable).toBe(false);
    expect(arabic.find((r) => r.quantity === 'xHeight')?.comparable).toBe(true);
  });
});

describe('chooseRatio', () => {
  /*
   * The defect this exists for: session 5 wrote the x-height ratio and gated on
   * the two advance samples, which are a different quantity. The gate passed and
   * had tested nothing about the number written beside it.
   */
  it('gates the quantity it returns, not another one in the same file', () => {
    const verdict = chooseRatio(ratioTable(INTER, CORMORANT), 'xHeight', 'oneWordAdvance');

    expect(verdict.passed).toBe(true);
    expect(verdict.ratio).toBeCloseTo(1.3479, 4);
    expect(verdict.quantity).toBe('xHeight');
    expect(verdict.corroborationDisagreement).toBeLessThan(0.01);
    expect(verdict.reason).toContain('xHeight');
    expect(verdict.reason).toContain('oneWordAdvance');
  });

  /*
   * Cap height is what the user ruled, and the gate still refuses it on the
   * numbers alone — correctly. The gate stops an underived number reaching the
   * code; it was never a vote. `RULED_EMPHASIS_QUANTITY` is the named way past
   * it, and the test below pins the constant against that quantity.
   */
  it('still refuses cap height on the numbers alone, which a ruling overrides', () => {
    const verdict = chooseRatio(ratioTable(INTER, CORMORANT), 'capHeight', 'oneWordAdvance');

    expect(verdict.passed).toBe(false);
    expect(verdict.ratio).toBeNull();
    expect(verdict.corroborationDisagreement).toBeGreaterThan(0.16);
  });

  it('refuses a corroboration taken on different strings rather than believing it', () => {
    const verdict = chooseRatio(ratioTable(INTER, ALMARAI), 'xHeight', 'oneWordAdvance');

    expect(verdict.passed).toBe(false);
    expect(verdict.reason).toContain('different strings');
  });

  it('refuses a ratio that moves with the size', () => {
    const drifting: FaceMeasurement = {
      ...CORMORANT,
      keyword: { ...CORMORANT.keyword, xHeight: CORMORANT.keyword.xHeight * 0.8 },
    };
    const verdict = chooseRatio(ratioTable(INTER, drifting), 'xHeight', null);

    expect(verdict.passed).toBe(false);
    expect(verdict.reason).toContain('does not move with the size');
  });

  it('returns a ratio with no corroboration, and says nothing confirmed it', () => {
    const verdict = chooseRatio(ratioTable(INTER, CORMORANT), 'capHeight', null);

    expect(verdict.passed).toBe(true);
    expect(verdict.ratio).toBeCloseTo(1.16406, 5);
    expect(verdict.reason).toContain('nothing independent');
  });
});

/**
 * The constant against the file it came from.
 *
 * Skipped rather than failed when the measurement is absent: `.local/` is
 * gitignored, so a second machine — Block 10's golden run — has no such file
 * and must not fail for it.
 */
describe('EMPHASIS_SIZE_RATIO, ruled, against the measurement on disk', () => {
  const file = path.join(REPO_ROOT, '.local', 'build', 'font-measurements.json');

  /*
   * The ruling settles **which** measure to use; it does not settle what the
   * measurement said. So the constant is pinned against a derivation from the
   * ruled quantity, and a re-measurement that moved cap height would fail here
   * rather than leave a stale number in place.
   */
  it('is what the ruled quantity gives on the measurement on disk', () => {
    if (!existsSync(file)) {
      console.warn(`font ratios: skipping — ${file} is not on this machine`);
      return;
    }
    const measured = JSON.parse(readFileSync(file, 'utf8')) as {
      measurements: FaceMeasurement[];
    };
    const by = new Map(measured.measurements.map((m) => [m.role, m]));
    const reference = by.get('latin');
    const emphasis = by.get('emphasis');
    if (reference === undefined || emphasis === undefined) {
      throw new Error('the measurement on disk has no latin or no emphasis face');
    }

    const row = ratioTable(reference, emphasis).rows.find(
      (r) => r.quantity === RULED_EMPHASIS_QUANTITY,
    );
    if (row === undefined) throw new Error(`no ${RULED_EMPHASIS_QUANTITY} row`);
    const mean = (row.atSubtitleSize + row.atKeywordSize) / 2;

    expect(RULED_EMPHASIS_QUANTITY).toBe('capHeight');
    expect(Number(mean.toFixed(4))).toBe(EMPHASIS_SIZE_RATIO);
    // The ruled quantity is still the same at both sizes, which is the one
    // property a ruling cannot excuse.
    expect(row.sizeDisagreement).toBeLessThan(1e-4);
  });
});
