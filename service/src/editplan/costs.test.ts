import { describe, expect, it } from 'vitest';
import type { EditPlan } from './types.js';
import { recordStageSpend } from './costs.js';

const plan = (): EditPlan =>
  ({ costs: { totalUsd: 0, byStage: {} } }) as unknown as EditPlan;

describe('recordStageSpend', () => {
  it('records a first run in both senses', () => {
    const p = plan();
    recordStageSpend(p, 'images', 1.55);
    expect(p.costs.byStage.images).toBe(1.55);
    expect(p.costs.spentByStage?.images).toBe(1.55);
    expect(p.costs.spentUsd).toBe(1.55);
  });

  /**
   * The case that prompted this. `byStage` read 0 for images immediately
   * after a $1.55 run, because a cached re-run replaces it — and Block 8's
   * panel shows a running total against a $2.00 alarm.
   */
  it('a cached re-run zeroes byStage and leaves spent alone', () => {
    const p = plan();
    recordStageSpend(p, 'images', 1.55);
    recordStageSpend(p, 'images', 0);
    expect(p.costs.byStage.images).toBe(0);
    expect(p.costs.spentByStage?.images).toBe(1.55);
    expect(p.costs.spentUsd).toBe(1.55);
  });

  // The money really was spent, so this can exceed one clean run.
  it('a regenerated run adds rather than replaces', () => {
    const p = plan();
    recordStageSpend(p, 'images', 1.55);
    recordStageSpend(p, 'images', 0.31);
    expect(p.costs.byStage.images).toBe(0.31);
    expect(p.costs.spentByStage?.images).toBeCloseTo(1.86, 10);
    expect(p.costs.spentUsd).toBeCloseTo(1.86, 10);
  });

  it('keeps stages in separate buckets', () => {
    const p = plan();
    recordStageSpend(p, 'transcription', 0.16);
    recordStageSpend(p, 'analysis', 0.05);
    recordStageSpend(p, 'images', 1.55);
    expect(p.costs.spentByStage).toEqual({ transcription: 0.16, analysis: 0.05, images: 1.55 });
    expect(p.costs.spentUsd).toBeCloseTo(1.76, 10);
  });

  it('does not mutate a previous spentByStage object', () => {
    const p = plan();
    recordStageSpend(p, 'images', 1);
    const first = p.costs.spentByStage;
    recordStageSpend(p, 'images', 1);
    expect(first).not.toBe(p.costs.spentByStage);
    expect(first?.images).toBe(1);
  });

  it('starts from absent, which means unknown rather than zero', () => {
    const p = plan();
    expect(p.costs.spentUsd).toBeUndefined();
    recordStageSpend(p, 'images', 0);
    expect(p.costs.spentUsd).toBe(0);
  });
});
