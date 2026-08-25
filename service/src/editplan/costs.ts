import type { EditPlan } from './types.js';

/**
 * Records what a stage cost, in both senses the plan tracks.
 *
 * `byStage` takes the figure as the last run's cost — replaced, and zero on a
 * cached run so the key never vanishes. `spentByStage` **accumulates**,
 * because the money was spent whether or not the next run repeats it.
 *
 * Both are written here rather than at each call site so the two cannot drift:
 * a stage that updated one and forgot the other would leave the panel's spend
 * alarm reading a number that is quietly wrong.
 */
export function recordStageSpend(plan: EditPlan, stage: string, thisRunUsd: number): void {
  plan.costs.byStage[stage] = thisRunUsd;
  plan.costs.totalUsd = Object.values(plan.costs.byStage).reduce((a, b) => a + b, 0);

  const spentByStage = { ...(plan.costs.spentByStage ?? {}) };
  spentByStage[stage] = (spentByStage[stage] ?? 0) + thisRunUsd;
  plan.costs.spentByStage = spentByStage;
  plan.costs.spentUsd = Object.values(spentByStage).reduce((a, b) => a + b, 0);
}
