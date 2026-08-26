import { readEditPlan, writeEditPlan } from '../editplan/io.js';
import type { EditPlan } from '../editplan/types.js';
import { solvePlacements, type Placement } from './solve.js';

export interface WritePlacementsResult {
  changedTopLevelKeys: string[];
  placements: Placement[];
  timeOverlapConstraintFired: boolean;
}

/**
 * Persist a solved placement onto a plan, touching nothing else.
 *
 * Not routed through any cache API: placements derive from zones, which derive
 * from frames under `.local/cv/`, none of which is a cache entry.
 */
export async function writePlacementsToPlan(
  planPath: string,
  now: string,
): Promise<WritePlacementsResult> {
  const plan = await readEditPlan(planPath);
  const before = snapshot(plan);

  const solved = solvePlacements(plan);
  const byId = new Map(solved.placements.map((p) => [p.slotId, p]));
  for (const slot of plan.images.slots) {
    const placement = byId.get(slot.id);
    if (!placement) continue;
    slot.zoneId = placement.zoneId;
    slot.position = placement.position;
    slot.scale = placement.scale;
  }

  plan.pipeline.zones = {
    ...plan.pipeline.zones,
    status: 'done',
    completedAt: now,
    error: null,
  };
  plan.meta.updatedAt = now;

  await writeEditPlan(planPath, plan);
  const after = snapshot(plan);

  return {
    changedTopLevelKeys: Object.keys(before).filter((key) => before[key] !== after[key]),
    placements: solved.placements,
    timeOverlapConstraintFired: solved.timeOverlapConstraintFired,
  };
}

function snapshot(plan: EditPlan): Record<string, string> {
  return Object.fromEntries(
    Object.entries(plan as unknown as Record<string, unknown>).map(([key, value]) => [
      key,
      JSON.stringify(value),
    ]),
  );
}
