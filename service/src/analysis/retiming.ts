import type { SubtitleGroup } from '../editplan/types.js';
import { displayWindow } from './display-timing.js';

/**
 * Two readings of TEMPLATE_LIBRARY_GUIDE §5's retiming rule, and what each
 * costs in overlapping cards.
 *
 * §5 says the system "places the instance so the intro ends when the element
 * should be fully on". With `outroS: 0` the structure is intro + hold and the
 * card hard-cuts out, so that reading puts the layer's in point `introS`
 * *before* the display window opens — and every subtitle card sits at the same
 * place on screen, so a card whose intro starts while the previous card is
 * still held is two cards stacked on one another.
 *
 * The alternative reading starts the layer at the display window and spends
 * the intro inside it, which never overlaps but means the words are not fully
 * legible until `introS` after they are spoken.
 *
 * This module only counts. Which reading is right is a judgement on a built
 * comp, not something the numbers settle.
 */
export type RetimingReading = 'intro-before' | 'intro-inside';

export interface RetimedGroup {
  id: string;
  inPointS: number;
  outPointS: number;
}

export function retime(
  group: SubtitleGroup,
  introS: number,
  reading: RetimingReading,
): RetimedGroup {
  const w = displayWindow(group);
  return {
    id: group.id,
    inPointS: reading === 'intro-before' ? w.start - introS : w.start,
    outPointS: w.end,
  };
}

export interface OverlapPair {
  earlier: string;
  later: string;
  overlapS: number;
}

/**
 * Consecutive pairs only. Subtitle groups are built from a single word
 * sequence and never reorder, so a card can only ever collide with its
 * neighbour; sorting by in point would invent an ordering the plan does not
 * have.
 */
export function overlaps(
  groups: SubtitleGroup[],
  introFor: (group: SubtitleGroup) => number,
  reading: RetimingReading,
): OverlapPair[] {
  const found: OverlapPair[] = [];
  for (let i = 0; i + 1 < groups.length; i += 1) {
    const first = groups[i];
    const second = groups[i + 1];
    if (first === undefined || second === undefined) continue;
    const a = retime(first, introFor(first), reading);
    const b = retime(second, introFor(second), reading);
    const overlap = a.outPointS - b.inPointS;
    if (overlap > 0) found.push({ earlier: a.id, later: b.id, overlapS: overlap });
  }
  return found;
}

export interface OverlapSummary {
  pairs: number;
  overlapping: number;
  minS: number | null;
  medianS: number | null;
  maxS: number | null;
}

export function summarise(groups: SubtitleGroup[], found: OverlapPair[]): OverlapSummary {
  const pairs = Math.max(0, groups.length - 1);
  if (found.length === 0) {
    return { pairs, overlapping: 0, minS: null, medianS: null, maxS: null };
  }
  const sorted = found.map((o) => o.overlapS).sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  const at = (i: number): number => sorted[i] as number;
  return {
    pairs,
    overlapping: found.length,
    minS: at(0),
    medianS: sorted.length % 2 === 1 ? at(mid) : (at(mid - 1) + at(mid)) / 2,
    maxS: at(sorted.length - 1),
  };
}
