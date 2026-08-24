import freezeListData from './freeze-list.json' with { type: 'json' };

// Frozen spellings from docs/ORTHOGRAPHY_GUIDE.md §4. Entries shorter than
// 4 characters (e.g. "f", "rah", "7ta") are excluded: an edit-distance-≤1
// fuzzy match against a short word matches many unrelated words (e.g. "nta"
// vs "7ta") and produces noise rather than signal.
const FREEZE_LIST: string[] = freezeListData.words.filter((w) => w.length >= 4);

const ALLOWED_ARABIZI_DIGITS = new Set(['3', '7', '9']);
const ARABIC_SCRIPT_RE = /[؀-ۿ]/;
const LATIN_LETTER_RE = /\p{L}/u;
const DIGIT_RE = /[0-9]/g;

export interface FlaggedExample {
  word: string;
  detail: string;
}

export interface DigitSubstitutionReport {
  count: number;
  examples: FlaggedExample[];
}

export interface ShDigraphReport {
  count: number;
  examples: FlaggedExample[];
}

export interface FreezeListReport {
  totalOccurrences: number;
  conformant: number;
  nearMiss: number;
  examples: FlaggedExample[];
}

export interface OrthographyReport {
  digitSubstitutions: DigitSubstitutionReport;
  shDigraph: ShDigraphReport;
  freezeList: FreezeListReport;
  score: number;
  /**
   * Words written in Arabic script. These rules only govern Latin-script
   * Darija, so a transcript that is mostly Arabic script scores near 100%
   * without saying anything about its orthography — Scribe raw output is
   * exactly that case.
   */
  arabicScriptWords: number;
}

function isLatinWord(word: string): boolean {
  return !ARABIC_SCRIPT_RE.test(word) && LATIN_LETTER_RE.test(word);
}

/** Character-level Levenshtein distance, for freeze-list near-miss detection. */
export function editDistance(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  const dist: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i += 1) dist[i]![0] = i;
  for (let j = 0; j <= m; j += 1) dist[0]![j] = j;

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        dist[i]![j] = dist[i - 1]![j - 1]!;
      } else {
        dist[i]![j] = 1 + Math.min(dist[i - 1]![j - 1]!, dist[i - 1]![j]!, dist[i]![j - 1]!);
      }
    }
  }

  return dist[n]![m]!;
}

function findDigitSubstitutions(words: string[]): DigitSubstitutionReport {
  const examples: FlaggedExample[] = [];

  for (const word of words) {
    if (!isLatinWord(word)) continue;
    const digits = word.match(DIGIT_RE);
    if (!digits) continue;
    const banned = digits.filter((d) => !ALLOWED_ARABIZI_DIGITS.has(d));
    if (banned.length > 0) {
      examples.push({ word, detail: `banned digit(s): ${banned.join(', ')}` });
    }
  }

  return { count: examples.length, examples };
}

function findShDigraph(words: string[]): ShDigraphReport {
  const examples: FlaggedExample[] = [];

  for (const word of words) {
    if (!isLatinWord(word)) continue;
    if (word.toLowerCase().includes('sh')) {
      examples.push({ word, detail: 'contains "sh" — guide mandates "ch" for ش' });
    }
  }

  return { count: examples.length, examples };
}

function findFreezeListConformance(words: string[]): FreezeListReport {
  const examples: FlaggedExample[] = [];
  let totalOccurrences = 0;
  let conformant = 0;

  for (const word of words) {
    if (!isLatinWord(word)) continue;
    const lower = word.toLowerCase();

    let best: { frozen: string; distance: number } | null = null;
    for (const frozen of FREEZE_LIST) {
      const distance = editDistance(lower, frozen);
      if (distance <= 1 && (best === null || distance < best.distance)) {
        best = { frozen, distance };
      }
    }

    if (best === null) continue;
    totalOccurrences += 1;
    if (best.distance === 0) {
      conformant += 1;
    } else {
      examples.push({ word, detail: `near "${best.frozen}" (edit distance ${best.distance})` });
    }
  }

  return { totalOccurrences, conformant, nearMiss: totalOccurrences - conformant, examples };
}

export function scoreOrthography(words: string[]): OrthographyReport {
  const digitSubstitutions = findDigitSubstitutions(words);
  const shDigraph = findShDigraph(words);
  const freezeList = findFreezeListConformance(words);

  const totalWords = words.length;
  const violations = digitSubstitutions.count + shDigraph.count + freezeList.nearMiss;
  const score = totalWords === 0 ? 1 : Math.max(0, 1 - violations / totalWords);

  const arabicScriptWords = words.filter((word) => ARABIC_SCRIPT_RE.test(word)).length;

  return { digitSubstitutions, shDigraph, freezeList, score, arabicScriptWords };
}
