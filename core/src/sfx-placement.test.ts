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
    expect(placed.clamped).toBe(false);
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
   * A layer cannot begin before the composition does. The sound is clamped and
   * lands late by a stated amount, rather than being silently absorbed.
   */
  it('clamps at the composition start and says by how much it is late', () => {
    const placed = placeSfx({
      elementStartS: 0.5,
      impactS: 0.13,
      peakOffsetS: 2.0525,
      fps: FPS,
      compStartS: 0,
    });
    expect(placed.clamped).toBe(true);
    expect(placed.inPointS).toBe(0);
    expect(placed.clampedByS).toBeGreaterThan(1.4);
    expect(placed.peakAtS).toBeCloseTo(2.0525, 6);
    // Late, and the caller can see exactly how late.
    expect(placed.snapErrorFrames).toBeGreaterThan(0);
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
