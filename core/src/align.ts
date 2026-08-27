export type AlignOp = 'match' | 'substitute' | 'insert' | 'delete';

export interface AlignedPair {
  op: AlignOp;
  // Index into the reference array, or null for an insertion.
  refIndex: number | null;
  // Index into the hypothesis array, or null for a deletion.
  hypIndex: number | null;
}

export interface AlignCosts {
  substitute: number;
  insert: number;
  delete: number;
}

/**
 * What every production path uses, and what every figure in the repo was
 * measured with. Unchanged since Block 2.
 */
export const DEFAULT_ALIGN_COSTS: AlignCosts = { substitute: 1, insert: 1, delete: 1 };

/**
 * Experiment 1 (Block 8 session 6): make inserting a corrected word with no
 * draft counterpart cost more than pairing it with one.
 *
 * The value is 2 because substitution costs 1 and 2 is the next integer: the
 * diagnosis showed the competing paths tie exactly, so the smallest amount
 * that could break a tie is the only value worth trying first. Lower than 2
 * (say 1.5) breaks the same ties in the same direction and only changes which
 * *other* alignments are disturbed; higher (3, 4) buys nothing here and
 * suppresses genuine insertions, of which the corpus has several at the ends
 * of reels.
 *
 * **Selectable, never default.** Nothing in the pipeline passes it.
 */
export const EXPENSIVE_INSERT_COSTS: AlignCosts = { substitute: 1, insert: 2, delete: 1 };

/**
 * Standard Levenshtein alignment with backtrace, operating on already
 * normalized tokens. Matches cost 0; the other three are `costs`, which
 * defaults to 1 each. Ties in backtrace prefer match > substitute > delete >
 * insert, which keeps alignments intuitive for the hybrid anchor logic.
 *
 * That preference is not cosmetic. Where the corrected side of a run carries
 * one more token than the draft, every path through the run costs the same,
 * and this order is what decides where the single insertion lands — at the
 * earliest hypothesis index, because the backtrace walks backwards and takes a
 * substitution whenever one is on an optimal path. See
 * docs/DEFECT-alignment-script-mismatch.md.
 */
export function align(
  reference: string[],
  hypothesis: string[],
  costs: AlignCosts = DEFAULT_ALIGN_COSTS,
): AlignedPair[] {
  const n = reference.length;
  const m = hypothesis.length;

  const dist: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i += 1) dist[i]![0] = i * costs.delete;
  for (let j = 0; j <= m; j += 1) dist[0]![j] = j * costs.insert;

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      if (reference[i - 1] === hypothesis[j - 1]) {
        dist[i]![j] = dist[i - 1]![j - 1]!;
      } else {
        dist[i]![j] = Math.min(
          dist[i - 1]![j - 1]! + costs.substitute,
          dist[i - 1]![j]! + costs.delete,
          dist[i]![j - 1]! + costs.insert,
        );
      }
    }
  }

  const pairs: AlignedPair[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && reference[i - 1] === hypothesis[j - 1]) {
      pairs.push({ op: 'match', refIndex: i - 1, hypIndex: j - 1 });
      i -= 1;
      j -= 1;
    } else if (i > 0 && j > 0 && dist[i]![j] === dist[i - 1]![j - 1]! + costs.substitute) {
      pairs.push({ op: 'substitute', refIndex: i - 1, hypIndex: j - 1 });
      i -= 1;
      j -= 1;
    } else if (i > 0 && dist[i]![j] === dist[i - 1]![j]! + costs.delete) {
      pairs.push({ op: 'delete', refIndex: i - 1, hypIndex: null });
      i -= 1;
    } else {
      pairs.push({ op: 'insert', refIndex: null, hypIndex: j - 1 });
      j -= 1;
    }
  }

  return pairs.reverse();
}
