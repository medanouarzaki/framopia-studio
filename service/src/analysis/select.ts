import type {
  AnalysisWord,
  KeywordCandidate,
  ResolutionFailure,
  SelectionResult,
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
 */
export function selectKeywords(
  candidates: KeywordCandidate[],
  words: AnalysisWord[],
  requestedCount: number,
): SelectionResult {
  const byId = new Map(words.map((w) => [w.id, w]));
  const failures: ResolutionFailure[] = [];
  const textMismatches: SelectionResult['textMismatches'] = [];

  const resolved: (SelectionResult['items'][number] & { firstId: string })[] = [];

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
    const planText = ordered.map((w) => w.text).join(' ');
    if (typeof candidate.text === 'string' && candidate.text.trim() !== planText) {
      textMismatches.push({
        wordIds: candidate.wordIds,
        modelText: candidate.text,
        planText,
      });
    }

    resolved.push({
      wordIds: ordered.map((w) => w.id),
      text: planText,
      score: candidate.score,
      reason: candidate.reason,
      start: ordered[0]?.start ?? 0,
      end: ordered[ordered.length - 1]?.end ?? 0,
      firstId: ordered[0]?.id ?? '',
    });
  }

  resolved.sort(
    (a, b) => b.score - a.score || a.start - b.start || (a.firstId < b.firstId ? -1 : 1),
  );

  const items: SelectionResult['items'] = [];
  const taken = new Set<string>();
  for (const entry of resolved) {
    if (items.length >= requestedCount) break;
    if (entry.wordIds.some((id) => taken.has(id))) {
      const original = candidates.find((c) => c.wordIds.join() === entry.wordIds.join());
      failures.push({
        candidate: original ?? { ...entry },
        reason: 'overlaps-a-selected-keyword',
      });
      continue;
    }
    for (const id of entry.wordIds) taken.add(id);
    items.push({
      wordIds: entry.wordIds,
      text: entry.text,
      score: entry.score,
      reason: entry.reason,
      start: entry.start,
      end: entry.end,
    });
  }

  return { items, failures, textMismatches, requestedCount };
}
