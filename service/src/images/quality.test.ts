import { describe, expect, it } from 'vitest';
import { cutoutQuality, slotPresentation, THRESHOLDS, FOREGROUND_AREA_BAND } from './quality.js';
import type { CutoutMetricsJson, SidecarGate } from './sidecar.js';

const metrics = (o: Partial<CutoutMetricsJson> = {}): CutoutMetricsJson => ({
  alpha_edge_noise: 0,
  hole_ratio: 0,
  foreground_area: (FOREGROUND_AREA_BAND.min + FOREGROUND_AREA_BAND.max) / 2,
  edge_halo: 0,
  ...o,
});

const gate = (passed: boolean): SidecarGate => ({
  presentation: passed ? 'cutout' : 'card',
  passed,
  failures: passed ? [] : ['something'],
});

describe('cutoutQuality', () => {
  it('is 1 for a matte at zero on every bound', () => {
    expect(cutoutQuality(metrics())).toBeCloseTo(1, 10);
  });

  it('is 0 for a matte sitting exactly on a bound', () => {
    expect(cutoutQuality(metrics({ hole_ratio: THRESHOLDS.hole_ratio }))).toBe(0);
  });

  it('is 0, not negative, past a bound', () => {
    expect(cutoutQuality(metrics({ edge_halo: 10 }))).toBe(0);
  });

  /**
   * The minimum, not the mean. A matte with one bad metric and three perfect
   * ones is a bad matte, and averaging would hide exactly the candidate an
   * editor needs to see.
   */
  it('takes the worst metric, not the average', () => {
    const oneBad = metrics({ edge_halo: THRESHOLDS.edge_halo * 0.9 });
    expect(cutoutQuality(oneBad)).toBeCloseTo(0.1, 6);
  });

  it('falls off toward both ends of the area band', () => {
    const low = cutoutQuality(metrics({ foreground_area: FOREGROUND_AREA_BAND.min + 0.01 }));
    const high = cutoutQuality(metrics({ foreground_area: FOREGROUND_AREA_BAND.max - 0.01 }));
    expect(low).toBeLessThan(0.1);
    expect(high).toBeLessThan(0.1);
  });

  it('scores the real corpus values comfortably', () => {
    // gemini-3-pro-image-1, measured.
    const real = metrics({ foreground_area: 0.1228, edge_halo: 0.0749 });
    const q = cutoutQuality(real);
    expect(q).toBeGreaterThan(0);
    expect(q).toBeLessThan(0.5);
  });
});

describe('slotPresentation', () => {
  /**
   * Null unless the candidates agree. `presentation` follows whichever
   * candidate the editor picks, and nobody has picked; session 1 made the
   * field nullable so a guess could not read as a decision.
   */
  it('is cutout when every candidate passes', () => {
    expect(slotPresentation([gate(true), gate(true)])).toBe('cutout');
  });

  it('is card when every candidate fails', () => {
    expect(slotPresentation([gate(false), gate(false)])).toBe('card');
  });

  it('is null when they disagree, because it depends on the pick', () => {
    expect(slotPresentation([gate(true), gate(false)])).toBeNull();
  });

  it('is null with no candidates', () => {
    expect(slotPresentation([])).toBeNull();
  });
});

describe('threshold mirroring', () => {
  /**
   * These are duplicated from tools/cv/framopia_cv/gate.py. The gate decision
   * is made in Python and never re-decided here, but a drift would move a
   * number a human reads, so it is pinned.
   */
  it('matches the sidecar gate', async () => {
    const { readFileSync } = await import('node:fs');
    const { REPO_ROOT } = await import('@framopia/core');
    const path = await import('node:path');
    const source = readFileSync(
      path.join(REPO_ROOT, 'tools', 'cv', 'framopia_cv', 'gate.py'),
      'utf8',
    );
    const read = (name: string): number =>
      Number(new RegExp(`^${name} = ([0-9.]+)$`, 'm').exec(source)?.[1]);

    expect(read('MAX_ALPHA_EDGE_NOISE')).toBe(THRESHOLDS.alpha_edge_noise);
    expect(read('MAX_HOLE_RATIO')).toBe(THRESHOLDS.hole_ratio);
    expect(read('MAX_EDGE_HALO')).toBe(THRESHOLDS.edge_halo);
    expect(read('MIN_FOREGROUND_AREA')).toBe(FOREGROUND_AREA_BAND.min);
    expect(read('MAX_FOREGROUND_AREA')).toBe(FOREGROUND_AREA_BAND.max);
  });
});
