import { readEditPlan, writeEditPlan } from '../editplan/io.js';
import type { EditPlan, Zone, Zones } from '../editplan/types.js';

/**
 * Zones onto an Edit Plan, ARCHITECTURE §3 and §5.5.
 *
 * The rule that shapes all of this: a manual zone is ground truth. §3 requires
 * an automated re-run never to overwrite a human-flagged item, so a
 * recomputation replaces the automatic zones and leaves every `manual: true`
 * one exactly as it was — not merged, not adjusted, not re-derived.
 */

export class ManualZoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManualZoneError';
  }
}

export interface MergeResult {
  zones: Zones;
  /** Computed zones dropped because a manual zone already claims the id. */
  droppedForCollision: string[];
}

export function manualZonesOf(zones: Zones): Zone[] {
  return zones.zones.filter((zone) => zone.manual);
}

/**
 * A recomputation's result merged onto what the plan already holds.
 *
 * Manual zones are carried across by reference and are listed first, so a
 * reader sees the ground truth before the derived rectangles. A computed zone
 * whose id a manual zone already claims is dropped rather than renamed: the id
 * is what the panel and the solver refer to, and silently moving it would
 * break a reference that already exists.
 */
export function mergeZones(existing: Zones, computed: Zone[], sampleFps: number): MergeResult {
  const manual = manualZonesOf(existing);
  const claimed = new Set(manual.map((zone) => zone.id));
  const droppedForCollision: string[] = [];

  const kept = computed.filter((zone) => {
    if (claimed.has(zone.id)) {
      droppedForCollision.push(zone.id);
      return false;
    }
    return true;
  });

  return {
    zones: { sampleFps, zones: [...manual, ...kept] },
    droppedForCollision,
  };
}

function assertPlaceable(zone: Zone): void {
  const { x, y, w, h } = zone.rect;
  for (const [name, value] of Object.entries({ x, y, w, h })) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ManualZoneError(`rect.${name} must be a number`);
    }
  }
  if (w <= 0 || h <= 0) throw new ManualZoneError('rect must have a positive width and height');
  if (x < 0 || y < 0 || x + w > 1.0000001 || y + h > 1.0000001) {
    throw new ManualZoneError('rect must lie inside the normalized frame');
  }
  if (!['top', 'left', 'right'].includes(zone.kind)) {
    throw new ManualZoneError(`unknown zone kind ${zone.kind}`);
  }
  if (zone.valid.some(([start, end]) => start < 0 || end < start)) {
    throw new ManualZoneError('every validity window must be a non-negative [startS, endS]');
  }
}

/**
 * Set a manual zone, replacing one of the same id.
 *
 * A manual zone is deliberately allowed to break MIN_ZONE_SHORT_EDGE: the
 * predicate exists to stop the derivation offering an unusable rectangle, and
 * an editor who places one anyway has decided something the derivation cannot.
 */
export function setManualZone(zones: Zones, zone: Zone): Zones {
  assertPlaceable(zone);
  const flagged: Zone = { ...zone, manual: true };
  const existing = zones.zones.findIndex((z) => z.id === zone.id);
  if (existing === -1) {
    return { ...zones, zones: [...zones.zones, flagged] };
  }
  // Taking over a derived zone's id is how an editor overrides that specific
  // zone, so it replaces rather than being refused; the flag records it.
  const next = [...zones.zones];
  next[existing] = flagged;
  return { ...zones, zones: next };
}

export function clearManualZone(zones: Zones, zoneId: string): Zones {
  const zone = zones.zones.find((z) => z.id === zoneId);
  if (!zone) throw new ManualZoneError(`no zone ${zoneId} on this plan`);
  if (!zone.manual) throw new ManualZoneError(`zone ${zoneId} is not manual`);
  return { ...zones, zones: zones.zones.filter((z) => z.id !== zoneId) };
}

export interface WriteZonesResult {
  changedTopLevelKeys: string[];
  droppedForCollision: string[];
  manualKept: number;
  automaticWritten: number;
}

/**
 * Persist computed zones onto a plan, touching nothing else.
 *
 * Deliberately not routed through any cache API: zones are derived from frames
 * under `.local/cv/`, which is not a cache entry and must stay out of reach of
 * the eviction pass.
 */
export async function writeZonesToPlan(
  planPath: string,
  computed: Zone[],
  sampleFps: number,
  now: string,
): Promise<WriteZonesResult> {
  const plan = await readEditPlan(planPath);
  const before = snapshot(plan);

  const merged = mergeZones(plan.zones, computed, sampleFps);
  plan.zones = merged.zones;
  plan.pipeline.zones = {
    ...plan.pipeline.zones,
    status: 'done',
    costUsd: 0,
    cached: false,
    completedAt: now,
    error: null,
  };
  plan.meta.updatedAt = now;

  await writeEditPlan(planPath, plan);
  const after = snapshot(plan);

  return {
    changedTopLevelKeys: Object.keys(before).filter((key) => before[key] !== after[key]),
    droppedForCollision: merged.droppedForCollision,
    manualKept: manualZonesOf(merged.zones).length,
    automaticWritten: merged.zones.zones.filter((zone) => !zone.manual).length,
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
