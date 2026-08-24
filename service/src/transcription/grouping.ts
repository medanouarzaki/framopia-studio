import type { PlanWord, SubtitleGroup } from '../editplan/types.js';

/**
 * Longest silence between two words that still reads as one breath. Above it
 * the pair is two separate beats and pairing them would hold the first word
 * on screen through the gap.
 */
export const MAX_INTRA_GROUP_GAP_S = 0.18;

/**
 * Longest a 1-2 word group stays on screen. Two slow words exceed what the
 * fast-reel style in PROJECT_SPEC §5 wants from a single card.
 */
export const MAX_GROUP_DURATION_S = 1.2;

export interface GroupingOptions {
  maxGapS?: number;
  maxDurationS?: number;
  idPrefix?: string;
}

/**
 * Groups of 1-2 words per PROJECT_SPEC §5, derived from wordIds and
 * re-derivable after any transcript edit — nothing here reads previous
 * groups.
 *
 * The rule for a 2-word group rather than two 1-word groups: two adjacent
 * displayable words pair when the silence between them is at most
 * MAX_INTRA_GROUP_GAP_S and the span from the first word's start to the
 * second's end is at most MAX_GROUP_DURATION_S. Otherwise the first word
 * stands alone and the second is considered afresh as the head of the next
 * group. Pairing is greedy left to right, which keeps the output stable: the
 * same words always produce the same groups.
 *
 * Removed words are skipped entirely — they never appear in a group — but
 * their timing still counts towards the gap, because the audio is still
 * there whether or not the filler is displayed.
 */
export function groupWordsIntoSubtitles(
  words: PlanWord[],
  options: GroupingOptions = {},
): SubtitleGroup[] {
  const {
    maxGapS = MAX_INTRA_GROUP_GAP_S,
    maxDurationS = MAX_GROUP_DURATION_S,
    idPrefix = 'g',
  } = options;

  const displayable = words.filter((w) => !w.removed);
  const groups: SubtitleGroup[] = [];

  let i = 0;
  while (i < displayable.length) {
    const first = displayable[i]!;
    const second = displayable[i + 1];

    const pairs =
      second !== undefined &&
      second.start - first.end <= maxGapS &&
      second.end - first.start <= maxDurationS;

    const members = pairs ? [first, second] : [first];
    const last = members[members.length - 1]!;

    groups.push({
      id: `${idPrefix}${String(groups.length + 1).padStart(3, '0')}`,
      wordIds: members.map((w) => w.id),
      start: first.start,
      end: last.end,
      templateId: null,
    });

    i += members.length;
  }

  return groups;
}
