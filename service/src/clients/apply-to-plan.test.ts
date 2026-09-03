import { describe, expect, it } from 'vitest';
import type { ClientMode } from '@framopia/core';
import { applyClientDefaultsToPlan } from './apply-to-plan.js';
import type { EditPlan } from '../editplan/types.js';

/**
 * **A client's own defaults reach the reel, and a per-reel decision outlives
 * them.**
 *
 * Block 10 session 43 built a comp for a client who had switched the watermark
 * off and found the mark on layer 2. Nothing here reads a reel: these are
 * plans invented in the test.
 */
const client = (watermarkByDefault?: boolean): ClientMode =>
  ({ id: 'c', name: 'C', ...(watermarkByDefault === undefined ? {} : { watermarkByDefault }) }) as ClientMode;

const planWith = (watermark: EditPlan['watermark']): EditPlan => ({ watermark }) as EditPlan;

describe('a client’s defaults on a reel', () => {
  it('writes an explicit no for a client who switched the watermark off', () => {
    const plan = planWith(null);
    applyClientDefaultsToPlan(plan, client(false));
    expect(plan.watermark?.enabled).toBe(false);
  });

  it('writes an explicit yes for a client who left it on', () => {
    const plan = planWith(null);
    applyClientDefaultsToPlan(plan, client(true));
    expect(plan.watermark?.enabled).toBe(true);
  });

  /**
   * The back-compatibility this could have broken: a client that names no
   * preference is "nobody has said otherwise", which has always meant marked.
   */
  it('marks a reel for a client who never said', () => {
    const plan = planWith(null);
    applyClientDefaultsToPlan(plan, client(undefined));
    expect(plan.watermark?.enabled).toBe(true);
  });

  it('never overwrites a decision the reel already carries', () => {
    for (const enabled of [true, false]) {
      const plan = planWith({ assetPath: '/a', startS: 0, durationS: null, enabled, size: 'large' });
      applyClientDefaultsToPlan(plan, client(!enabled));
      expect(plan.watermark?.enabled).toBe(enabled);
      // And the size the user chose survives with it.
      expect(plan.watermark?.size).toBe('large');
    }
  });

  it('leaves the asset and the start where every other writer puts them', () => {
    const plan = planWith(null);
    applyClientDefaultsToPlan(plan, client(false));
    expect(plan.watermark?.startS).toBe(0);
    expect(plan.watermark?.durationS).toBeNull();
    expect(plan.watermark?.assetPath.endsWith('assets/watermark/intro.mov')).toBe(true);
  });
});
