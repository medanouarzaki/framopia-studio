import { describe, expect, it } from 'vitest';
import { summariseZones, totalValidSeconds, type Zone } from './zones.js';

const zone = (id: string, kind: Zone['kind'], w: number, h: number, valid: [number, number][]) =>
  ({ id, kind, rect: { x: 0, y: 0, w, h }, valid, manual: false }) as Zone;

describe('summariseZones', () => {
  it('reports every kind even when one produced nothing', () => {
    const rows = summariseZones([zone('z_top_1', 'top', 0.5, 0.4, [[0, 10]])]);
    expect(rows.map((row) => row.kind)).toEqual(['top', 'left', 'right', 'torso']);
    expect(rows.find((row) => row.kind === 'right')).toMatchObject({
      count: 0,
      meanRectArea: 0,
      totalValidS: 0,
    });
  });

  it('averages rect area over that kind only', () => {
    const rows = summariseZones([
      zone('z_left_1', 'left', 0.2, 0.5, [[0, 4]]),
      zone('z_left_2', 'left', 0.4, 0.5, [[6, 10]]),
      zone('z_top_1', 'top', 1, 1, [[0, 10]]),
    ]);
    expect(rows.find((row) => row.kind === 'left')?.meanRectArea).toBeCloseTo(0.15);
  });

  it('sums every validity window of a zone, not just the first', () => {
    const rows = summariseZones([
      zone('z_top_1', 'top', 0.5, 0.4, [
        [0, 4],
        [6, 10],
      ]),
    ]);
    expect(rows.find((row) => row.kind === 'top')?.totalValidS).toBeCloseTo(8);
  });

  it('totals across kinds', () => {
    expect(
      totalValidSeconds([
        zone('z_top_1', 'top', 0.5, 0.4, [[0, 10]]),
        zone('z_left_1', 'left', 0.2, 0.5, [[0, 5]]),
      ]),
    ).toBeCloseTo(15);
  });
});
