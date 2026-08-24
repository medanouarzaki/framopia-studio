export type AlignOp = 'match' | 'substitute' | 'insert' | 'delete';

export interface AlignedPair {
  op: AlignOp;
  // Index into the reference array, or null for an insertion.
  refIndex: number | null;
  // Index into the hypothesis array, or null for a deletion.
  hypIndex: number | null;
}

/**
 * Standard Levenshtein alignment with backtrace, operating on already
 * normalized tokens. Substitution/insertion/deletion all cost 1; matches
 * cost 0. Ties in backtrace prefer match > substitute > delete > insert,
 * which keeps alignments intuitive for the hybrid anchor logic.
 */
export function align(reference: string[], hypothesis: string[]): AlignedPair[] {
  const n = reference.length;
  const m = hypothesis.length;

  const dist: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i += 1) dist[i]![0] = i;
  for (let j = 0; j <= m; j += 1) dist[0]![j] = j;

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      if (reference[i - 1] === hypothesis[j - 1]) {
        dist[i]![j] = dist[i - 1]![j - 1]!;
      } else {
        dist[i]![j] = 1 + Math.min(dist[i - 1]![j - 1]!, dist[i - 1]![j]!, dist[i]![j - 1]!);
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
    } else if (i > 0 && j > 0 && dist[i]![j] === dist[i - 1]![j - 1]! + 1) {
      pairs.push({ op: 'substitute', refIndex: i - 1, hypIndex: j - 1 });
      i -= 1;
      j -= 1;
    } else if (i > 0 && dist[i]![j] === dist[i - 1]![j]! + 1) {
      pairs.push({ op: 'delete', refIndex: i - 1, hypIndex: null });
      i -= 1;
    } else {
      pairs.push({ op: 'insert', refIndex: null, hypIndex: j - 1 });
      j -= 1;
    }
  }

  return pairs.reverse();
}
