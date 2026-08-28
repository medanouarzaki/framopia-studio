import { describe, expect, it } from 'vitest';
import { placeSfx, snapToFrame } from './sfx-placement.js';
import { impactFrameOf } from './impact-frame.js';
import type { AuditComp } from './templates.js';

const FPS = 30000 / 1001;

describe('snapToFrame', () => {
  it('lands on the frame grid', () => {
    expect(snapToFrame(1 / FPS, FPS) * FPS).toBeCloseTo(1, 9);
    expect(snapToFrame(0.5, FPS) * FPS).toBeCloseTo(Math.round(0.5 * FPS), 9);
  });

  /*
   * A sound a fraction early reads as part of the impact; a fraction late reads
   * as a separate event. The direction only matters at the tie, and it is spent
   * on being early.
   */
  it('rounds a tie down, to the earlier frame', () => {
    const tie = 10.5 / FPS;
    expect(Math.round(snapToFrame(tie, FPS) * FPS)).toBe(10);
  });
});

describe('placeSfx', () => {
  it('puts the peak on the impact frame', () => {
    const placed = placeSfx({ elementStartS: 5, impactS: 0.2, peakOffsetS: 0.05, fps: FPS });
    expect(placed.inPointS).toBeCloseTo(snapToFrame(5.15, FPS), 9);
    expect(Math.abs(placed.snapErrorFrames)).toBeLessThanOrEqual(0.5);
    expect(placed.beforeCompS).toBe(0);
  });

  /*
   * `hit_01`'s peak is 2.0525 s in, measured. Against a template impacting a
   * fraction of a second after the card, the layer has to start well before the
   * card — which is what the old rule could never express.
   */
  it('starts the layer before the element when the peak is late in the file', () => {
    const placed = placeSfx({
      elementStartS: 10,
      impactS: 0.13,
      peakOffsetS: 2.0525,
      fps: FPS,
    });
    expect(placed.inPointS).toBeLessThan(10);
    expect(placed.peakAtS).toBeCloseTo(10.13, 1);
  });

  /*
   * **After Effects honours a negative `startTime`** — observed in the session
   * 28 probe and again in 29 — so a lead-in longer than the reel in front of
   * the element is kept rather than clamped away. This used to pin the layer at
   * zero and let the peak land late, which is the defect the whole thread was
   * about.
   */
  it('starts before the composition rather than letting the peak land late', () => {
    const placed = placeSfx({
      elementStartS: 0.5,
      impactS: 0.13,
      peakOffsetS: 2.0525,
      fps: FPS,
    });
    expect(placed.inPointS).toBeLessThan(0);
    // The peak still lands on the impact, which is the whole point.
    expect(placed.peakAtS).toBeCloseTo(0.63, 1);
    expect(Math.abs(placed.snapErrorFrames)).toBeLessThanOrEqual(0.5);
    // And the caller can see how much of the file is outside the comp.
    expect(placed.beforeCompS).toBeCloseTo(-placed.inPointS, 6);
  });

  /* The peak lands on the impact whatever the file's lead-in, by construction. */
  it('lands the peak on the impact for any anchor', () => {
    for (const peakOffsetS of [0, 0.05, 0.5581, 0.6913, 2.0525, 5]) {
      const placed = placeSfx({ elementStartS: 0.099, impactS: 0.135446, peakOffsetS, fps: FPS });
      expect(Math.abs(placed.peakAtS - 0.234446) * FPS, `${peakOffsetS}`).toBeLessThanOrEqual(0.5);
    }
  });

  it('reports zero snap error when the ideal already sits on a frame', () => {
    const onGrid = 30 / FPS;
    const placed = placeSfx({ elementStartS: onGrid, impactS: 0, peakOffsetS: 0, fps: FPS });
    expect(placed.snapErrorFrames).toBeCloseTo(0, 6);
  });
});

describe('impactFrameOf', () => {
  const comp = (animated: unknown): AuditComp =>
    ({
      name: 'kw_slam',
      frameRate: FPS,
      width: 2160,
      height: 1100,
      duration: 2.002,
      layers: [{ name: 'TXT_MAIN', kind: 'text', animated }],
    }) as unknown as AuditComp;

  it('takes the last entrance keyframe as the settle point', () => {
    const result = impactFrameOf(
      comp([
        { path: 'Transform/Position', keyframes: 2, keys: [{ index: 1, time: 0, value: null, unreadable: null }, { index: 2, time: 0.2002, value: null, unreadable: null }] },
        { path: 'Transform/Opacity', keyframes: 2, keys: [{ index: 1, time: 0, value: null, unreadable: null }, { index: 2, time: 0.1335, value: null, unreadable: null }] },
      ]),
      FPS,
    );
    expect(result.impactS).toBeCloseTo(0.2002, 6);
    expect(result.from).toBe('Transform/Position');
  });

  /*
   * An audit taken before session 21 has counts and no times. That is "not
   * recorded", not "no keyframes", and it must not resolve to zero.
   */
  it('refuses an audit that records counts without times, and says to re-run it', () => {
    const result = impactFrameOf(comp([{ path: 'Transform/Position', keyframes: 2 }]), FPS);
    expect(result.impactS).toBeNull();
    expect(result.unreadable).toContain('audit:templates');
  });

  it('refuses a comp with no animated property at all', () => {
    const result = impactFrameOf(comp([]), FPS);
    expect(result.impactS).toBeNull();
    expect(result.unreadable).toContain('no animated property');
  });

  it('ignores a property that is not part of the entrance', () => {
    const result = impactFrameOf(
      comp([
        { path: 'Effects/Fast Box Blur/Blur Radius', keyframes: 2, keys: [{ index: 1, time: 0, value: null, unreadable: null }, { index: 2, time: 1.9, value: null, unreadable: null }] },
        { path: 'Transform/Position', keyframes: 2, keys: [{ index: 1, time: 0, value: null, unreadable: null }, { index: 2, time: 0.2, value: null, unreadable: null }] },
      ]),
      FPS,
    );
    expect(result.impactS).toBeCloseTo(0.2, 6);
  });
});

/*
 * `whoosh_01` on the first image of a reel: the case the whole thread was
 * about, pinned with the figures After Effects itself reported.
 */
describe('the first image of a reel', () => {
  it('reproduces the in-point the probe asked After Effects for', () => {
    const placed = placeSfx({
      elementStartS: 0.099,
      impactS: 0.135446,
      peakOffsetS: 0.691281,
      fps: FPS,
    });
    expect(placed.inPointS).toBeCloseTo(-0.4671, 4);
    expect(placed.beforeCompS).toBeCloseTo(0.4671, 4);
    // 0.31 frames early, which is the frame grid and not a placement error:
    // the ideal in-point falls between two frames and the snap rounds early.
    expect(placed.snapErrorFrames).toBeCloseTo(-0.31, 2);
  });
});
