import type { PlanWord, TermSpan } from '../editplan/types.js';

export type TermRejection =
  | 'unknown-word-id'
  | 'removed-word'
  | 'not-arabic-script'
  | 'not-contiguous'
  | 'overlaps-another-term';

export interface TermSelectionResult {
  terms: TermSpan[];
  rejected: { wordIds: string[]; reason: TermRejection }[];
  /**
   * Arabic-script words the accepted terms do not cover. The prompt asks for
   * every one, so a non-empty list is the model having missed something and
   * is reported rather than patched: grouping treats an uncovered word as its
   * own card, which is the pre-existing behaviour.
   */
  uncoveredWordIds: string[];
}

/**
 * Everything downstream of the model, and all of it deterministic.
 *
 * A term the plan cannot confirm is dropped and counted, never fuzzy-matched
 * into place, on the same rule the keyword selector follows: a term pointing
 * at the wrong words would render a wrong card, which is worse than falling
 * back to one word per card.
 */
export function selectTermSpans(options: {
  words: PlanWord[];
  terms: TermSpan[];
}): TermSelectionResult {
  const { words, terms } = options;
  const displayable = words.filter((w) => !w.removed);
  const position = new Map(displayable.map((w, i) => [w.id, i]));
  const byId = new Map(words.map((w) => [w.id, w]));

  const accepted: TermSpan[] = [];
  const rejected: TermSelectionResult['rejected'] = [];
  const claimed = new Set<string>();

  for (const term of terms) {
    const ids = term.wordIds;
    const reject = (reason: TermRejection) => rejected.push({ wordIds: ids, reason });

    if (ids.some((id) => !byId.has(id))) {
      reject('unknown-word-id');
      continue;
    }
    if (ids.some((id) => byId.get(id)?.removed === true)) {
      reject('removed-word');
      continue;
    }
    if (ids.some((id) => byId.get(id)?.script !== 'arabic')) {
      reject('not-arabic-script');
      continue;
    }
    const positions = ids.map((id) => position.get(id) as number).sort((a, b) => a - b);
    const contiguous = positions[positions.length - 1]! - positions[0]! + 1 === positions.length;
    if (!contiguous) {
      reject('not-contiguous');
      continue;
    }
    if (ids.some((id) => claimed.has(id))) {
      reject('overlaps-another-term');
      continue;
    }

    ids.forEach((id) => claimed.add(id));
    // Stored in transcript order whatever order the model listed them in, so
    // two runs that agree on the terms produce byte-identical plans.
    accepted.push({ wordIds: positions.map((p) => displayable[p]!.id) });
  }

  accepted.sort(
    (a, b) => (position.get(a.wordIds[0]!) ?? 0) - (position.get(b.wordIds[0]!) ?? 0),
  );

  const uncoveredWordIds = displayable
    .filter((w) => w.script === 'arabic' && !claimed.has(w.id))
    .map((w) => w.id);

  return { terms: accepted, rejected, uncoveredWordIds };
}

/** The term each word belongs to, for grouping. Words in no term are absent. */
export function termIndexOf(terms: TermSpan[]): Map<string, number> {
  const index = new Map<string, number>();
  terms.forEach((term, i) => term.wordIds.forEach((id) => index.set(id, i)));
  return index;
}
