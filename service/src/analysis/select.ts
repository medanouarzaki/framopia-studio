import { narrowSpan, significantStems } from './span.js';
import {
  KEYWORD_KINDS,
  type AnalysisWord,
  type KeywordCandidate,
  type KeywordKind,
  type NarrowedSpan,
  type ResolutionFailure,
  type SelectionResult,
} from './types.js';

/**
 * Turns ranked candidates into the keywords that go in the plan. Pure, and
 * the only place the count is decided: the model is asked for more candidates
 * than are needed and this takes the top N.
 *
 * **Every step here is deterministic given the same candidate list.** The
 * model call that produced that list is not — see the note on
 * `runKeywordAnalysis` — so determinism is a property of this function and of
 * the cache, never of the pipeline end to end.
 *
 * Ranking is score descending, and the documented tiebreak is the start time
 * of the keyword's first word ascending, then its first word id
 * lexicographically. The second tiebreak exists only to make the order total:
 * two keywords cannot share a start time without sharing a word, which
 * overlap already rejects, but a total order means the sort can never depend
 * on the input's incoming order.
 *
 * Two rules are enforced here rather than asked of the model, because a model
 * that forgets one produces a plan that looks fine and builds wrong:
 *
 * - **At most two words per keyword** (`narrowSpan`). An over-long candidate
 *   is shortened, not dropped.
 * - **No two keywords on the same head term** (`significantStems`), *unless*
 *   one is a label and the other a promise. The rule exists to stop two
 *   keywords saying the same thing; "Vita Silk" and "smooth for months" share
 *   a subject and say different things. A collision skips the candidate and
 *   the next by score takes its place, so the count is still met whenever the
 *   candidates allow it.
 * - **At least one label and one promise** among the selected keywords. Every
 *   keyword this pipeline had ever picked was a name, because a nameable noun
 *   reads as the word carrying the claim; the mix is forced here rather than
 *   asked for in the prompt, so it holds whatever the model returns.
 */
export function selectKeywords(
  candidates: KeywordCandidate[],
  words: AnalysisWord[],
  requestedCount: number,
): SelectionResult {
  const byId = new Map(words.map((w) => [w.id, w]));
  const failures: ResolutionFailure[] = [];
  const textMismatches: SelectionResult['textMismatches'] = [];

  const resolved: (SelectionResult['items'][number] & {
    firstId: string;
    stems: Set<string>;
  })[] = [];
  const narrowedSpans: NarrowedSpan[] = [];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate.wordIds) || candidate.wordIds.length === 0) {
      failures.push({ candidate, reason: 'empty-word-ids' });
      continue;
    }
    if (!Number.isFinite(candidate.score) || candidate.score < 0 || candidate.score > 1) {
      failures.push({ candidate, reason: 'score-out-of-range' });
      continue;
    }

    const hit = candidate.wordIds.map((id) => byId.get(id));
    // An id the plan does not have is dropped, never fuzzy-matched onto a
    // nearby word: a keyword pointing at the wrong word is worse than one
    // missing, because it reaches a client's subtitles looking deliberate.
    if (hit.some((w) => w === undefined)) {
      failures.push({ candidate, reason: 'unknown-word-id' });
      continue;
    }
    const found = hit as AnalysisWord[];
    if (found.some((w) => w.removed)) {
      failures.push({ candidate, reason: 'removed-word' });
      continue;
    }

    const ordered = [...found].sort((a, b) => a.start - b.start);
    const fullText = ordered.map((w) => w.text).join(' ');
    if (typeof candidate.text === 'string' && candidate.text.trim() !== fullText) {
      textMismatches.push({
        wordIds: candidate.wordIds,
        modelText: candidate.text,
        planText: fullText,
      });
    }

    const { indices, narrowed: wasNarrowed } = narrowSpan(ordered.map((w) => w.text));
    const kept = indices.map((i) => ordered[i] as AnalysisWord);
    const planText = kept.map((w) => w.text).join(' ');
    if (wasNarrowed) {
      narrowedSpans.push({
        originalWordIds: ordered.map((w) => w.id),
        originalText: fullText,
        wordIds: kept.map((w) => w.id),
        text: planText,
      });
    }

    resolved.push({
      wordIds: kept.map((w) => w.id),
      text: planText,
      score: candidate.score,
      reason: candidate.reason,
      start: kept[0]?.start ?? 0,
      end: kept[kept.length - 1]?.end ?? 0,
      firstId: kept[0]?.id ?? '',
      stems: significantStems(kept.map((w) => w.text)),
      ...(candidate.kind === 'label' || candidate.kind === 'promise'
        ? { kind: candidate.kind }
        : {}),
    });
  }

  resolved.sort(
    (a, b) => b.score - a.score || a.start - b.start || (a.firstId < b.firstId ? -1 : 1),
  );

  const items: SelectionResult['items'] = [];
  const taken = new Set<string>();
  // A stem is claimed per kind, so a label and a promise about one product do
  // not collide with each other while two labels about it still do.
  const claimedStems = new Map<string, Set<KeywordKind | 'unknown'>>();

  const asCandidate = (entry: (typeof resolved)[number]): KeywordCandidate => ({
    wordIds: entry.wordIds,
    text: entry.text,
    score: entry.score,
    reason: entry.reason,
    ...(entry.kind === undefined ? {} : { kind: entry.kind }),
  });

  const admissible = (entry: (typeof resolved)[number]): ResolutionFailure['reason'] | null => {
    if (entry.wordIds.some((id) => taken.has(id))) return 'overlaps-a-selected-keyword';
    const kind: KeywordKind | 'unknown' = entry.kind ?? 'unknown';
    for (const stem of entry.stems) {
      const kinds = claimedStems.get(stem);
      if (kinds !== undefined && kinds.has(kind)) return 'shares-a-head-term';
    }
    return null;
  };

  const take = (entry: (typeof resolved)[number]): void => {
    for (const id of entry.wordIds) taken.add(id);
    const kind: KeywordKind | 'unknown' = entry.kind ?? 'unknown';
    for (const stem of entry.stems) {
      const kinds = claimedStems.get(stem) ?? new Set<KeywordKind | 'unknown'>();
      kinds.add(kind);
      claimedStems.set(stem, kinds);
    }
    items.push({
      wordIds: entry.wordIds,
      text: entry.text,
      score: entry.score,
      reason: entry.reason,
      start: entry.start,
      end: entry.end,
      ...(entry.kind === undefined ? {} : { kind: entry.kind }),
    });
  };

  // The mix first: reserve a place for the best of each kind, so a run of
  // strong labels cannot fill the whole selection before a promise is reached.
  const kindShortfall: KeywordKind[] = [];
  const used = new Set<(typeof resolved)[number]>();
  if (requestedCount >= KEYWORD_KINDS.length) {
    for (const kind of KEYWORD_KINDS) {
      const best = resolved.find(
        (e) => !used.has(e) && e.kind === kind && admissible(e) === null,
      );
      if (best === undefined) {
        kindShortfall.push(kind);
        continue;
      }
      used.add(best);
      take(best);
    }
  }

  for (const entry of resolved) {
    if (items.length >= requestedCount) break;
    if (used.has(entry)) continue;
    const rejection = admissible(entry);
    if (rejection !== null) {
      failures.push({ candidate: asCandidate(entry), reason: rejection });
      continue;
    }
    used.add(entry);
    take(entry);
  }

  // Selected in kind order above, so restore score order for the plan.
  items.sort((a, b) => b.score - a.score || a.start - b.start);

  return {
    items,
    failures,
    textMismatches,
    requestedCount,
    narrowed: narrowedSpans,
    shortfall: Math.max(0, requestedCount - items.length),
    kindShortfall,
  };
}
