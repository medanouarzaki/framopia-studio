import type { PlanWord, SubtitleGroup } from '../editplan/types.js';

export const MAX_GROUP_WORDS = 2;

export interface RegroupKeyword {
  id: string;
  wordIds: string[];
}

export interface DroppedKeyword {
  keywordId: string;
  reason:
    | 'span-not-contiguous'
    | 'group-is-human-edited'
    | 'would-exceed-group-size'
    | 'span-is-mixed-script';
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
 * word ids that are not adjacent in the transcript, a group carrying a human
 * edit that ARCHITECTURE §3 forbids re-deriving, or a span that straddles a
 * script boundary. An unbuildable pairing is worse than one fewer emphasis
 * moment.
 *
 * **A group's words all share one `script`** (user ruling, Block 6). A Latin
 * word never pairs with an Arabic-script word, so a card carries one script and
 * one template variant — `sub_pop` or `sub_pop_ar` — rather than needing
 * per-character font switching in Block 7's ExtendScript. The rule is enforced
 * by cutting at every script change, which like everything else here only
 * splits, so the 1-2 word rule cannot be broken by it.
 *
 * **Whole-term grouping is deliberately NOT implemented here.** ORTHOGRAPHY_GUIDE
 * §6c requires an Arabic domain term to render whole, and a multi-word term can
 * still land across two cards exactly as it does today. Block 6 session 5 got
 * term boundaries out of the analysis pass and found them unstable — three
 * identical calls returned three different answers, two of which split a term
 * the guide names verbatim — so grouping on them would trade a visible
 * violation for an unpredictable one. `Transcript.terms`, `terms.ts` and the
 * validator rules stay in place, unused by this pass, as the groundwork for the
 * revisit in Block 7 once the user can judge it on a built comp.
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
  const byId = new Map(displayable.map((w) => [w.id, w]));

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

  // Positions where the script changes, so a group can never straddle one.
  // Computed before the keyword loop because a keyword span that crosses a
  // boundary has to be rejected rather than allowed to delete the cut.
  const scriptCuts = new Set<number>();
  for (let i = 1; i < displayable.length; i += 1) {
    if (displayable[i]!.script !== displayable[i - 1]!.script) scriptCuts.add(i);
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
    // The keyword renders as one card, so it cannot straddle a script boundary
    // any more than a subtitle group can. Dropped rather than narrowed: which
    // half of a mixed span carries the emphasis is not this pass's call.
    const crossesScript = sorted.some((p) => p > first && p <= last && scriptCuts.has(p));
    if (crossesScript) {
      dropped.push({ keywordId: keyword.id, reason: 'span-is-mixed-script' });
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

  // Added last so a keyword span cannot have deleted one: spans crossing a
  // boundary are already rejected above, so this never splits a kept keyword.
  for (const cut of scriptCuts) cuts.add(cut);

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
      // Display timing follows the same rule as the template, and for a
      // stronger reason: a window was computed against a specific word set and
      // the silence after it. A split group's inherited window could run past
      // the cut and hold a card over the next one's words, so it is dropped
      // and re-derived rather than carried. Before Block 7 session 4 it was
      // dropped unconditionally, which quietly cleared the field on every
      // group each time grouping ran.
      ...(unchanged &&
      previous.displayStart !== undefined &&
      previous.displayEnd !== undefined
        ? { displayStart: previous.displayStart, displayEnd: previous.displayEnd }
        : {}),
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

  const mixed = rebuilt.filter((g) => {
    const scripts = new Set(g.wordIds.map((id) => byId.get(id)?.script));
    return scripts.size > 1;
  });
  if (mixed.length > 0) {
    // Unreachable by construction — a cut sits at every script change — but a
    // mixed card would reach a client's screen needing a font this pipeline
    // does not switch per character.
    throw new Error(
      `re-grouping produced ${mixed.length} mixed-script group(s): ` +
        mixed.map((g) => g.id).join(', '),
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
