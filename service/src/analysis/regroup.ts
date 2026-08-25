import type { PlanWord, SubtitleGroup } from '../editplan/types.js';

export const MAX_GROUP_WORDS = 2;

export interface RegroupKeyword {
  id: string;
  wordIds: string[];
}

export interface DroppedKeyword {
  keywordId: string;
  reason: 'span-not-contiguous' | 'group-is-human-edited' | 'would-exceed-group-size';
}

export interface RegroupResult {
  groups: SubtitleGroup[];
  /** The keyword ids that survived, in the order they were given. */
  keptKeywordIds: string[];
  dropped: DroppedKeyword[];
}

/**
 * Re-derives subtitle groups so that every keyword span is exactly one group,
 * and marks that group as superseded by its keyword.
 *
 * Grouping runs during transcription, before any keyword exists, so a two-word
 * keyword can land across two groups — it did on two of vitasilk's three
 * keywords. A keyword replaces its group's rendering rather than drawing over
 * it, and that is only expressible if the span and the group are the same
 * thing.
 *
 * The pass only ever **splits**: it cuts the word sequence at each keyword's
 * boundaries and removes cuts inside the span. A split can never produce a
 * group longer than the span it isolates, and the span is capped at two words
 * upstream, so the 1–2 word rule from PROJECT_SPEC §5 cannot be broken by this
 * pass. It is checked anyway, and a keyword that would break it is dropped.
 *
 * A keyword is dropped, never forced, when its span cannot become one group:
 * word ids that are not adjacent in the transcript, or a group carrying a
 * human edit that ARCHITECTURE §3 forbids re-deriving. An unbuildable pairing
 * is worse than one fewer emphasis moment.
 */
export function regroupForKeywords(options: {
  groups: SubtitleGroup[];
  words: PlanWord[];
  keywords: RegroupKeyword[];
  idPrefix?: string;
}): RegroupResult {
  const { groups, words, keywords, idPrefix = 'g' } = options;

  // The sequence groups actually partition: removed words never appear.
  const displayable = words.filter((w) => !w.removed);
  const position = new Map(displayable.map((w, i) => [w.id, i]));

  // A cut at index i means "a group starts here". Seeded from the groups as
  // they stand, so a reel with no keywords comes back unchanged.
  const cuts = new Set<number>([0]);
  const groupAtStart = new Map<number, SubtitleGroup>();
  for (const group of groups) {
    const first = group.wordIds[0];
    if (first === undefined) continue;
    const start = position.get(first);
    if (start === undefined) continue;
    cuts.add(start);
    groupAtStart.set(start, group);
  }

  const dropped: DroppedKeyword[] = [];
  const keptKeywordIds: string[] = [];
  const spanOwner = new Map<number, string>();

  for (const keyword of keywords) {
    const positions = keyword.wordIds.map((id) => position.get(id));
    if (positions.some((p) => p === undefined)) {
      dropped.push({ keywordId: keyword.id, reason: 'span-not-contiguous' });
      continue;
    }
    const sorted = (positions as number[]).slice().sort((a, b) => a - b);
    const first = sorted[0] as number;
    const last = sorted[sorted.length - 1] as number;
    const contiguous = last - first + 1 === sorted.length;
    if (!contiguous) {
      dropped.push({ keywordId: keyword.id, reason: 'span-not-contiguous' });
      continue;
    }
    if (sorted.length > MAX_GROUP_WORDS) {
      dropped.push({ keywordId: keyword.id, reason: 'would-exceed-group-size' });
      continue;
    }

    // Every group the new boundaries would disturb. A group is disturbed when
    // it overlaps the span without being exactly the span.
    const disturbed = groups.filter((g) => {
      const ps = g.wordIds.map((id) => position.get(id)).filter((p): p is number => p !== undefined);
      if (ps.length === 0) return false;
      const overlaps = ps.some((p) => p >= first && p <= last);
      const isExactly = ps.length === sorted.length && ps.every((p) => p >= first && p <= last);
      return overlaps && !isExactly;
    });
    if (disturbed.some((g) => g.edited === true)) {
      dropped.push({ keywordId: keyword.id, reason: 'group-is-human-edited' });
      continue;
    }

    for (let i = first + 1; i <= last; i += 1) cuts.delete(i);
    cuts.add(first);
    if (last + 1 < displayable.length) cuts.add(last + 1);
    spanOwner.set(first, keyword.id);
    keptKeywordIds.push(keyword.id);
  }

  const starts = [...cuts].sort((a, b) => a - b);
  const rebuilt: SubtitleGroup[] = [];
  for (let i = 0; i < starts.length; i += 1) {
    const from = starts[i] as number;
    const to = (starts[i + 1] ?? displayable.length) as number;
    const members = displayable.slice(from, to);
    if (members.length === 0) continue;
    const previous = groupAtStart.get(from);
    const owner = spanOwner.get(from);
    const unchanged =
      previous !== undefined &&
      previous.wordIds.length === members.length &&
      previous.wordIds.every((id, j) => id === members[j]?.id);
    rebuilt.push({
      id: `${idPrefix}${String(rebuilt.length + 1).padStart(3, '0')}`,
      wordIds: members.map((w) => w.id),
      start: members[0]?.start ?? 0,
      end: members[members.length - 1]?.end ?? 0,
      // A split group is a new group and carries no template yet; one that
      // came through untouched keeps whatever was assigned to it.
      templateId: unchanged ? previous.templateId : null,
      supersededBy: owner ?? null,
      ...(unchanged && previous.edited === true ? { edited: true } : {}),
    });
  }

  const oversized = rebuilt.filter((g) => g.wordIds.length > MAX_GROUP_WORDS);
  if (oversized.length > 0) {
    // Unreachable by construction — the pass only splits — but a silent
    // 3-word group would reach a client's screen, so it fails loudly.
    throw new Error(
      `re-grouping produced ${oversized.length} group(s) longer than ${MAX_GROUP_WORDS} words: ` +
        oversized.map((g) => g.id).join(', '),
    );
  }

  // Words dropped from the sequence would silently vanish from the subtitles.
  const covered = rebuilt.reduce((n, g) => n + g.wordIds.length, 0);
  if (covered !== displayable.length) {
    throw new Error(
      `re-grouping covered ${covered} of ${displayable.length} displayable words`,
    );
  }
  return { groups: rebuilt, keptKeywordIds, dropped };
}
