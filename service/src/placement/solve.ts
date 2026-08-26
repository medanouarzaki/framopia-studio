import { createHash } from 'node:crypto';
import type { EditPlan, ImageSlot, Zone } from '../editplan/types.js';
import {
  BOTTOM_EXCLUSION,
  CARD_EDGE_CLEARANCE,
  CUTOUT_EDGE_CLEARANCE,
  COMP_SIDE_PX,
  FILL_FRACTION,
  FRAME_ASPECT,
  FRAME_WIDTH,
  MIN_PLACED_SHORT_EDGE,
  SCALE_JITTER,
  SUBTITLE_BAND,
  TORSO_ZONE_IS_LAST_RESORT,
} from './constants.js';
import {
  intersects,
  insideFrame,
  largestSquare,
  inset,
  square,
  usableRegions,
  type Rect,
} from './geometry.js';

export class NoZonesError extends Error {
  constructor(planId: string) {
    super(
      `plan ${planId} carries no zones, so no slot can be placed. Run ` +
        '`npm run zones -- --reel <label> --write-plan` first.',
    );
    this.name = 'NoZonesError';
  }
}

export class UnplaceableSlotError extends Error {
  constructor(
    readonly slotId: string,
    readonly reason: string,
  ) {
    super(
      `slot ${slotId} cannot be placed: ${reason}. This is a finding about the ` +
        'footage and the constants, not something to relax a constraint for.',
    );
    this.name = 'UnplaceableSlotError';
  }
}

export interface Placement {
  slotId: string;
  zoneId: string;
  /** Top-left of the placed square, normalized against the frame. */
  position: { x: number; y: number };
  /** Uniform scale of the 1200x1200 comp. TEMPLATE_LIBRARY_GUIDE §6. */
  scale: number;
  presentation: 'cutout' | 'card';
  rect: Rect;
}

/**
 * Deterministic unit values from a seed, on the Block 3 `assign.ts` precedent:
 * a sha256 chain read four bytes at a time, so the same seed always yields the
 * same sequence and nothing depends on call order elsewhere.
 */
function unitStream(seed: string): () => number {
  let digest = createHash('sha256').update(seed).digest();
  let cursor = 0;
  return () => {
    if (cursor + 4 > digest.length) {
      digest = createHash('sha256').update(digest).digest();
      cursor = 0;
    }
    const value = digest.readUInt32BE(cursor);
    cursor += 4;
    return value / 0x100000000;
  };
}

/**
 * A slot's presentation decides its footprint. A slot whose presentation is
 * still null is treated as a **card**, the more demanding of the two: the
 * quality gate sets it only when every candidate agrees, and guessing the
 * cheaper footprint would place a bordered image tight against a zone edge.
 */
export function footprintOf(slot: ImageSlot): 'cutout' | 'card' {
  return slot.presentation === 'cutout' ? 'cutout' : 'card';
}

export function clearanceFor(presentation: 'cutout' | 'card'): number {
  return presentation === 'cutout' ? CUTOUT_EDGE_CLEARANCE : CARD_EDGE_CLEARANCE;
}

function windowContains(zone: Zone, startS: number, endS: number): boolean {
  // The whole span, not an overlap: an image that appears while its zone is
  // still occupied is exactly what the validity window exists to prevent.
  return zone.valid.some(([from, to]) => from <= startS && endS <= to);
}

/** The largest usable region of a zone for this footprint, or null. */
export function regionFor(zone: Zone, presentation: 'cutout' | 'card'): Rect | null {
  const cleared = inset(zone.rect, clearanceFor(presentation));
  if (cleared.w <= 0 || cleared.h <= 0) return null;
  const regions = usableRegions(cleared);
  let best: Rect | null = null;
  for (const region of regions) {
    if (best === null || largestSquare(region) > largestSquare(best)) best = region;
  }
  return best;
}

/**
 * The placed square for one slot in one zone.
 *
 * The side is chosen first, then the position is drawn from the travel the
 * side leaves inside the region. Jitter therefore cannot leave the region by
 * construction rather than by a clamp afterwards, which is the difference
 * between a bound and a hope. The result is still re-validated by the caller.
 */
export function placeIn(
  zone: Zone,
  slot: ImageSlot,
  presentation: 'cutout' | 'card',
  seed: string,
): Placement | null {
  const region = regionFor(zone, presentation);
  if (region === null) return null;

  const next = unitStream(seed);
  const maxSide = largestSquare(region);
  const side = maxSide * FILL_FRACTION * (1 + SCALE_JITTER * (2 * next() - 1));
  if (side < MIN_PLACED_SHORT_EDGE) return null;

  const height = side / FRAME_ASPECT;
  const travelX = Math.max(0, region.w - side);
  const travelY = Math.max(0, region.h - height);
  const rect = square(region.x + travelX * next(), region.y + travelY * next(), side);

  return {
    slotId: slot.id,
    zoneId: zone.id,
    position: { x: rect.x, y: rect.y },
    scale: (side * FRAME_WIDTH) / COMP_SIDE_PX,
    presentation,
    rect,
  };
}

function timeOverlaps(a: ImageSlot, b: ImageSlot): boolean {
  return a.start < b.end && b.start < a.end;
}

export interface SolveResult {
  placements: Placement[];
  /** True if two time-overlapping slots ever had to be kept apart. */
  timeOverlapConstraintFired: boolean;
}

/**
 * Assign every image slot a zone, a position and a uniform scale.
 *
 * Deterministic: the candidate order is a seeded permutation of the zones that
 * can hold the slot, and the geometry is drawn from a hash of the plan id and
 * the slot id. The same plan always produces the same placements.
 */
export function solvePlacements(plan: EditPlan): SolveResult {
  const zones = plan.zones.zones;
  if (zones.length === 0) throw new NoZonesError(plan.meta.id);

  const slots = [...plan.images.slots].sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : 1));
  const placements: Placement[] = [];
  let timeOverlapConstraintFired = false;
  let previousZoneId: string | null = null;

  for (const slot of slots) {
    const presentation = footprintOf(slot);
    const seed = `${plan.meta.id}:${slot.id}`;

    const eligible = zones.filter((zone) => windowContains(zone, slot.start, slot.end));
    if (eligible.length === 0) {
      throw new UnplaceableSlotError(
        slot.id,
        `no zone is valid for the whole span ${slot.start.toFixed(3)}-${slot.end.toFixed(3)}s`,
      );
    }

    // A seeded order, then a preference for not repeating the previous slot's
    // zone: a run of images in one band is the machine-uniform look
    // PROJECT_SPEC §1 rules out, and where an alternative exists it is taken.
    const ordered = seededOrder(eligible, seed);
    const spread = ordered.filter((zone) => zone.id !== previousZoneId);
    const ranked = [...spread, ...ordered.filter((zone) => zone.id === previousZoneId)];
    // Torso zones sit on the speaker rather than beside them, so they are a
    // departure from the spec taken only when nothing else fits.
    const attempts = TORSO_ZONE_IS_LAST_RESORT
      ? [...ranked.filter((zone) => zone.kind !== 'torso'), ...ranked.filter((zone) => zone.kind === 'torso')]
      : ranked;

    let chosen: Placement | null = null;
    let lastReason = 'no zone left a usable region';
    for (const zone of attempts) {
      const candidate = placeIn(zone, slot, presentation, seed);
      if (candidate === null) {
        lastReason = `zone ${zone.id} leaves no square of at least ${MIN_PLACED_SHORT_EDGE} of frame width`;
        continue;
      }
      if (!satisfiesHardConstraints(candidate)) {
        lastReason = `zone ${zone.id} produced a rect breaking a hard constraint`;
        continue;
      }
      const clash = placements.find(
        (other) =>
          timeOverlaps(slotById(slots, other.slotId), slot) && intersects(other.rect, candidate.rect),
      );
      if (clash) {
        timeOverlapConstraintFired = true;
        lastReason = `zone ${zone.id} collides with concurrent slot ${clash.slotId}`;
        continue;
      }
      chosen = candidate;
      break;
    }

    if (chosen === null) throw new UnplaceableSlotError(slot.id, lastReason);
    placements.push(chosen);
    previousZoneId = chosen.zoneId;
  }

  return { placements, timeOverlapConstraintFired };
}

function slotById(slots: ImageSlot[], id: string): ImageSlot {
  const slot = slots.find((s) => s.id === id);
  if (!slot) throw new Error(`no slot ${id}`);
  return slot;
}

/** Every hard constraint, re-checked on the finished rect. */
export function satisfiesHardConstraints(placement: Placement): boolean {
  const { rect } = placement;
  if (!insideFrame(rect)) return false;
  if (intersects(rect, SUBTITLE_BAND)) return false;
  if (rect.y + rect.h > 1 - BOTTOM_EXCLUSION + 1e-9) return false;
  if (rect.w < MIN_PLACED_SHORT_EDGE - 1e-9) return false;
  return true;
}

function seededOrder(zones: Zone[], seed: string): Zone[] {
  const out = [...zones].sort((a, b) => (a.id < b.id ? -1 : 1));
  const next = unitStream(`${seed}:zones`);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j] as Zone, out[i] as Zone];
  }
  return out;
}
