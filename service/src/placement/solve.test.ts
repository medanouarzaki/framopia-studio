import { describe, expect, it } from 'vitest';
import { createEditPlan } from '../editplan/io.js';
import type { EditPlan, ImageSlot, Zone } from '../editplan/types.js';
import {
  BOTTOM_EXCLUSION,
  CARD_EDGE_CLEARANCE,
  CUTOUT_EDGE_CLEARANCE,
  FRAME_ASPECT,
  MIN_PLACED_SHORT_EDGE,
  SUBTITLE_BAND,
} from './constants.js';
import { intersects, largestSquare } from './geometry.js';
import {
  NoZonesError,
  UnplaceableSlotError,
  regionFor as regionOfZone,
  satisfiesHardConstraints,
  solvePlacements,
} from './solve.js';

function zone(id: string, kind: Zone['kind'], rect: Zone['rect'], valid: [number, number][]): Zone {
  return { id, kind, rect, valid, manual: false };
}

function slot(id: string, start: number, end: number, presentation: ImageSlot['presentation']) {
  return {
    id,
    wordIds: [],
    start,
    end,
    contextText: '',
    idea: '',
    prompt: '',
    negativePrompt: '',
    candidates: [],
    chosenCandidateId: null,
    presentation,
    zoneId: null,
    templateId: null,
    status: 'generated',
  } as unknown as ImageSlot;
}

function planWith(zones: Zone[], slots: ImageSlot[], id = 'plan-1'): EditPlan {
  const plan = createEditPlan({
    source: {
      videoPath: '/tmp/x.mov',
      sha256: 'a'.repeat(64),
      durationS: 25,
      fps: 29.97,
      width: 2160,
      height: 3840,
      audioPath: '/tmp/x.wav',
    },
    appVersion: '0.1.0',
    now: '2026-08-26T00:00:00.000Z',
    id,
  });
  plan.zones = { sampleFps: 2, zones };
  plan.images = { slots };
  return plan;
}

/** A generous top zone, like every reel's. */
const TOP = zone('z_top_1', 'top', { x: 0.03, y: 0, w: 0.94, h: 0.3 }, [[0, 25]]);

describe('validity windows', () => {
  it('places a slot whose span the window contains', () => {
    const { placements } = solvePlacements(planWith([TOP], [slot('img001', 1, 3, 'card')]));
    expect(placements[0]?.zoneId).toBe('z_top_1');
  });

  // The whole span, not an overlap: an image appearing while its zone is still
  // occupied is what the window exists to prevent.
  it('fails loudly when no window contains the whole span', () => {
    const narrow = zone('z_top_1', 'top', TOP.rect, [[0, 2]]);
    expect(() => solvePlacements(planWith([narrow], [slot('img001', 1, 3, 'card')]))).toThrow(
      UnplaceableSlotError,
    );
  });

  it('rejects a window that merely overlaps the span', () => {
    const narrow = zone('z_top_1', 'top', TOP.rect, [[2, 5]]);
    expect(() => solvePlacements(planWith([narrow], [slot('img001', 1, 3, 'card')]))).toThrow(
      /no zone is valid for the whole span/,
    );
  });
});

describe('hard constraints', () => {
  it('never places a rect intersecting the subtitle band', () => {
    // A side zone spans the band; the solver must use the piece above it.
    const side = zone('z_left_1', 'left', { x: 0, y: 0.05, w: 0.3, h: 0.8 }, [[0, 25]]);
    const { placements } = solvePlacements(planWith([side], [slot('img001', 1, 3, 'card')]));
    expect(intersects(placements[0]!.rect, SUBTITLE_BAND)).toBe(false);
  });

  it('never places a rect inside the bottom exclusion', () => {
    const side = zone('z_left_1', 'left', { x: 0, y: 0.05, w: 0.3, h: 0.8 }, [[0, 25]]);
    const { placements } = solvePlacements(planWith([side], [slot('img001', 1, 3, 'card')]));
    const rect = placements[0]!.rect;
    expect(rect.y + rect.h).toBeLessThanOrEqual(1 - BOTTOM_EXCLUSION + 1e-9);
  });

  it('refuses a zone too small to hold the minimum placed square', () => {
    const tiny = zone('z_left_1', 'left', { x: 0, y: 0.05, w: 0.08, h: 0.4 }, [[0, 25]]);
    expect(() => solvePlacements(planWith([tiny], [slot('img001', 1, 3, 'card')]))).toThrow(
      UnplaceableSlotError,
    );
  });
});

describe('jitter stays inside every bound', () => {
  // A zone barely large enough to hold the minimum square, so the travel
  // jitter draws from is at its most dangerous. Jitter is applied inside the
  // safe region rather than applied and clamped, and this is what proves it.
  it('holds for many seeds on a minimum-sized zone', () => {
    const side = MIN_PLACED_SHORT_EDGE / 0.88 / 0.92 + CARD_EDGE_CLEARANCE * 2 + 1e-6;
    const tight = zone(
      'z_left_1',
      'left',
      { x: 0.01, y: 0.04, w: side, h: (side * 1.02) / FRAME_ASPECT },
      [[0, 25]],
    );
    for (let i = 0; i < 200; i += 1) {
      const plan = planWith([tight], [slot(`img${i}`, 1, 3, 'card')], `plan-${i}`);
      const { placements } = solvePlacements(plan);
      const placement = placements[0]!;
      expect(satisfiesHardConstraints(placement)).toBe(true);
      // and inside its own zone, not merely inside the frame
      expect(placement.rect.x).toBeGreaterThanOrEqual(tight.rect.x - 1e-9);
      expect(placement.rect.y).toBeGreaterThanOrEqual(tight.rect.y - 1e-9);
      expect(placement.rect.x + placement.rect.w).toBeLessThanOrEqual(
        tight.rect.x + tight.rect.w + 1e-9,
      );
      expect(placement.rect.y + placement.rect.h).toBeLessThanOrEqual(
        tight.rect.y + tight.rect.h + 1e-9,
      );
    }
  });
});

describe('concurrent slots', () => {
  it('rejects two time-overlapping slots forced into one zone', () => {
    const plan = planWith([TOP], [slot('img001', 1, 5, 'card'), slot('img002', 2, 6, 'card')]);
    expect(() => solvePlacements(plan)).toThrow(UnplaceableSlotError);
  });

  it('reports whether the constraint fired', () => {
    const sequential = planWith([TOP], [slot('img001', 1, 3, 'card'), slot('img002', 4, 6, 'card')]);
    expect(solvePlacements(sequential).timeOverlapConstraintFired).toBe(false);
  });
});

describe('determinism', () => {
  it('produces byte-identical placements across two runs', () => {
    const build = () =>
      planWith([TOP], [slot('img001', 1, 3, 'card'), slot('img002', 4, 6, 'cutout')]);
    const first = solvePlacements(build()).placements;
    const second = solvePlacements(build()).placements;
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('gives different plans different placements', () => {
    const a = solvePlacements(planWith([TOP], [slot('img001', 1, 3, 'card')], 'plan-a'));
    const b = solvePlacements(planWith([TOP], [slot('img001', 1, 3, 'card')], 'plan-b'));
    expect(JSON.stringify(a.placements)).not.toBe(JSON.stringify(b.placements));
  });
});

describe('a plan without zones', () => {
  it('is an explicit error naming what to run, not a crash', () => {
    expect(() => solvePlacements(planWith([], [slot('img001', 1, 3, 'card')]))).toThrow(NoZonesError);
    expect(() => solvePlacements(planWith([], [slot('img001', 1, 3, 'card')]))).toThrow(
      /npm run zones/,
    );
  });
});

describe('card and cutout footprints differ', () => {
  it('card clearance reduces the usable square', () => {
    const card = regionOfZone(TOP, 'card');
    const cutout = regionOfZone(TOP, 'cutout');
    expect(largestSquare(card!)).toBeLessThan(largestSquare(cutout!));
  });

  it('the difference is exactly twice the clearance on the binding axis', () => {
    const card = regionOfZone(TOP, 'card')!;
    const cutout = regionOfZone(TOP, 'cutout')!;
    // The top zone's height binds, so the loss is two vertical insets.
    const expected = (2 * (CARD_EDGE_CLEARANCE - CUTOUT_EDGE_CLEARANCE)) / FRAME_ASPECT;
    expect(cutout.h - card.h).toBeCloseTo(expected, 9);
  });

  it('a cutout is placed larger than a card in the same zone', () => {
    const asCard = solvePlacements(planWith([TOP], [slot('img001', 1, 3, 'card')], 'p'));
    const asCutout = solvePlacements(planWith([TOP], [slot('img001', 1, 3, 'cutout')], 'p'));
    expect(asCutout.placements[0]!.scale).toBeGreaterThan(asCard.placements[0]!.scale);
  });

  // The gate sets presentation only when every candidate agrees, so a null is
  // "not yet decided" and must take the more demanding footprint.
  it('treats an undecided presentation as a card', () => {
    const undecided = solvePlacements(planWith([TOP], [slot('img001', 1, 3, null)], 'p'));
    const asCard = solvePlacements(planWith([TOP], [slot('img001', 1, 3, 'card')], 'p'));
    expect(undecided.placements[0]!.presentation).toBe('card');
    expect(undecided.placements[0]!.scale).toBe(asCard.placements[0]!.scale);
  });
});
