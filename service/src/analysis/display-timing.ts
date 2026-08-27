import type { TemplateEntry } from '@framopia/core';
import { MAX_WORDS_PER_CARD } from '../transcription/grouping.js';
import type { SubtitleGroup } from '../editplan/types.js';

/**
 * Word timings are the single timing authority (ARCHITECTURE §3) and are never
 * modified here or anywhere else. A subtitle group's `start`/`end` stay
 * exactly what the words say.
 *
 * Display timing is a different question: how long the card is on screen. A
 * word spoken in 0.08 s still needs its animation to play, and holding the
 * card a little past the word is what every subtitle system does. So the group
 * gains `displayStart`/`displayEnd` alongside its speech timing rather than
 * instead of it.
 *
 * Both fields are **optional with a default** — absent means "same as
 * start/end". Session 5 learned that a required schema addition makes every
 * previously written plan unopenable, including for migration, because
 * `readEditPlan` validates on read.
 */
export function displayWindow(group: SubtitleGroup): { start: number; end: number } {
  return { start: group.displayStart ?? group.start, end: group.displayEnd ?? group.end };
}

export interface DisplayTimingMerge {
  /** The ids the merged group was built from, before renumbering. */
  from: [string, string];
  wordIds: string[];
}

export interface DisplayTimingUnbuildable {
  groupId: string;
  wordIds: string[];
  haveS: number;
  needS: number;
  reason: 'no-room-before-next-group' | 'merge-would-exceed-two-words' | 'merge-blocked-by-keyword';
}

export interface DisplayTimingResult {
  groups: SubtitleGroup[];
  merged: DisplayTimingMerge[];
  unbuildable: DisplayTimingUnbuildable[];
}

function floorFor(templates: Map<string, TemplateEntry>, templateId: string | null): number | null {
  if (templateId === null) return null;
  const t = templates.get(templateId);
  return t === undefined ? null : t.introS + t.minHoldS + t.outroS;
}

/**
 * A merge may not build a card larger than the grouping rule allows. At
 * `MAX_WORDS_PER_CARD` 1 that disables merging entirely, which is correct and
 * deliberate: the rescue exists to reach the template floor, and reaching it by
 * putting two words on a card is exactly what the Block 7 session 6 ruling
 * forbids. A card that still cannot reach its floor is reported, as before.
 */
const DEFAULT_MAX_GROUP_WORDS = MAX_WORDS_PER_CARD;

/**
 * Float slack. `0.13 + 0.07 + 0.13` is 0.33000000000000007, so a card that is
 * exactly 0.33 s long compares as short. A microsecond is far below one frame
 * at any frame rate, so nothing real hides under it.
 */
export const DURATION_EPSILON_S = 1e-6;

/**
 * Gives every subtitle group a display window that reaches its template's
 * floor where it can, and says plainly where it cannot.
 *
 * The order is: extend, then merge, then report. Extension is free — it takes
 * silence that belongs to nobody. Merging costs a card, so it is only tried
 * when extension has already failed, and it is refused outright on a group a
 * keyword supersedes: that alignment was established in session 5 and a merge
 * would break the one-span-one-group property the whole emphasis layer rests
 * on.
 *
 * Nothing is extended past the next group, past the reel, or artificially to
 * fake a pass. A group that still cannot reach its floor is left alone and
 * returned in `unbuildable`.
 */
export function applyDisplayTiming(options: {
  groups: SubtitleGroup[];
  templates: Map<string, TemplateEntry>;
  reelDurationS: number;
  idPrefix?: string;
  /** Cards a merge may build. Defaults to the grouping rule. */
  maxWords?: number;
}): DisplayTimingResult {
  const {
    groups, templates, reelDurationS, idPrefix = 'g',
    maxWords: MAX_GROUP_WORDS = DEFAULT_MAX_GROUP_WORDS,
  } = options;
  const merged: DisplayTimingMerge[] = [];

  // Merge first, because a merged group's window is computed from the pair.
  const working: SubtitleGroup[] = [];
  for (let i = 0; i < groups.length; i += 1) {
    const group = groups[i] as SubtitleGroup;
    const next = groups[i + 1];
    const floor = floorFor(templates, group.templateId);

    const ceiling = Math.min(next?.start ?? reelDurationS, reelDurationS);
    const reachable = Math.max(group.end, Math.min(group.start + (floor ?? 0), ceiling));
    const canExtend = floor === null || reachable - group.start >= floor - DURATION_EPSILON_S;

    const mergeable =
      !canExtend &&
      next !== undefined &&
      group.supersededBy == null &&
      next.supersededBy == null &&
      group.wordIds.length + next.wordIds.length <= MAX_GROUP_WORDS;

    if (mergeable && next !== undefined) {
      merged.push({ from: [group.id, next.id], wordIds: [...group.wordIds, ...next.wordIds] });
      working.push({
        ...group,
        wordIds: [...group.wordIds, ...next.wordIds],
        start: group.start,
        end: next.end,
        // The merged card is a new card; its template is re-assigned by the
        // caller, and carrying the old one over would look deliberate.
        templateId: null,
        supersededBy: null,
      });
      i += 1;
      continue;
    }
    working.push({ ...group });
  }

  const renumbered = working.map((g, i) => ({
    ...g,
    id: `${idPrefix}${String(i + 1).padStart(3, '0')}`,
  }));

  const unbuildable: DisplayTimingUnbuildable[] = [];
  const withWindows = renumbered.map((group, i) => {
    const floor = floorFor(templates, group.templateId);
    const next = renumbered[i + 1];
    /*
     * A card holds until the next card's word begins (Block 7 session 7).
     * Stopping at the template floor left the screen blank between cards —
     * 17.25 s of it across the corpus — and a word persisting *after* it is
     * spoken is ordinary subtitle behaviour, unlike a word appearing before it
     * is spoken, which is what the user objected to at two words per card.
     *
     * The last card of a reel has no next word, so it holds to the reel's end
     * under the same bound. Ending it at its word instead would single out the
     * one card whose successor happens not to exist.
     */
    const ceiling = Math.min(next?.start ?? reelDurationS, reelDurationS);
    const held = Math.min(ceiling, group.start + MAX_SUBTITLE_HOLD_S);
    const end = Math.max(group.end, held);

    if (floor !== null && end - group.start < floor - DURATION_EPSILON_S) {
      const original = groups.find((g) => g.wordIds.join(' ') === group.wordIds.join(' '));
      const following = groups[groups.indexOf(original as SubtitleGroup) + 1];
      unbuildable.push({
        groupId: group.id,
        wordIds: group.wordIds,
        haveS: end - group.start,
        needS: floor,
        reason:
          following === undefined
            ? 'no-room-before-next-group'
            : original?.supersededBy != null || following.supersededBy != null
              ? 'merge-blocked-by-keyword'
              : group.wordIds.length + following.wordIds.length > MAX_GROUP_WORDS
                ? 'merge-would-exceed-two-words'
                : 'no-room-before-next-group',
      });
    }

    return { ...group, displayStart: group.start, displayEnd: end };
  });

  return { groups: withWindows, merged, unbuildable };
}

/**
 * Longest a card stays up after its word has been spoken.
 *
 * **CHOSEN, NOT MEASURED**, 1.20 s. What would change it is the user's eye on
 * a built reel: a card lingering through a long pause reads as a stall, and a
 * card cut short reads as a flicker. Only 3 cards in the whole corpus reach it,
 * so it is a guard against a long silence rather than a rule that shapes the
 * normal case.
 *
 * It coincides with `MAX_GROUP_DURATION_S` in grouping.ts, which caps how long
 * a *pair* of words could occupy one card. The two are separate numbers that
 * happen to agree, and neither is derived from the other.
 */
export const MAX_SUBTITLE_HOLD_S = 1.2;

/** A word this short is an alignment artifact, not a display problem. */
export const MIN_SANE_WORD_DURATION_S = 0.05;

export interface ShortWord {
  id: string;
  text: string;
  durationS: number;
  /** Alignment inferred the timing instead of inheriting a Scribe slot. */
  interpolated: boolean;
}

/**
 * Words too short to be real. vitasilk carried one whose start equalled its
 * end, produced by interpolation across an inserted word.
 *
 * **Nothing is repaired.** These are a Block 2 alignment question, and a
 * timing invented here would be indistinguishable from a measured one.
 */
export function findShortWords(
  words: { id: string; text: string; start: number; end: number; confidence: number | null; removed: boolean }[],
  minDurationS = MIN_SANE_WORD_DURATION_S,
): ShortWord[] {
  return words
    .filter((w) => !w.removed && w.end - w.start < minDurationS)
    .map((w) => ({
      id: w.id,
      text: w.text,
      durationS: w.end - w.start,
      interpolated: w.confidence === null,
    }));
}
