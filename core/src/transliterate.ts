/**
 * A distance between an Arabic-script token and an Arabizi one.
 *
 * Cross-script substitution carries no information in the default cost model:
 * `normalizeToken('mn')` and `normalizeToken('من')` are never equal, so every
 * cross-script pair in a run scores exactly 1 and an arbitrary tiebreak
 * decides the reel (see docs/DEFECT-alignment-script-mismatch.md). This gives
 * that comparison real signal, so `mn`/`من` costs less than `mn`/`غير`.
 *
 * **The mapping is ORTHOGRAPHY_GUIDE §2's table.** §2 lists the *conventions* —
 * the letters whose Arabizi form is not obvious — and says nothing about ب or
 * م because nobody needs telling. The plain correspondences below are marked
 * as the extension they are; if §2 and this table ever disagree, §2 wins.
 *
 * Several letters have two accepted forms (`و` is `w` or `ou`, `ي` is `y` or
 * `i`), so a letter maps to a set and the closest member is taken. That is why
 * this is a distance and not a lookup.
 */

/** ORTHOGRAPHY_GUIDE §2, verbatim. */
const GUIDE_TABLE: Record<string, string[]> = {
  ع: ['3'],
  ح: ['7'],
  ق: ['9'],
  خ: ['kh'],
  ش: ['ch'],
  غ: ['gh'],
  ط: ['t'],
  ص: ['s'],
  ض: ['d'],
  ظ: ['d'],
  ء: ['', "'"],
  ه: ['h'],
  و: ['w', 'ou', 'o', 'u'],
  ي: ['y', 'i'],
};

/**
 * Not in §2, because §2 documents only what is not obvious. Written out here
 * so the distance covers a whole word rather than the handful of letters the
 * guide happens to discuss.
 */
const PLAIN_TABLE: Record<string, string[]> = {
  ا: ['a', ''],
  أ: ['a', ''],
  إ: ['a', ''],
  آ: ['a'],
  ب: ['b'],
  ت: ['t'],
  ث: ['t', 'th'],
  ج: ['j'],
  د: ['d'],
  ذ: ['d'],
  ر: ['r'],
  ز: ['z'],
  س: ['s'],
  ف: ['f'],
  ك: ['k'],
  ل: ['l'],
  م: ['m'],
  ن: ['n'],
  ة: ['a', 't', ''],
  ى: ['a', 'i'],
  ئ: ["'", 'i', ''],
  ؤ: ["'", 'w', ''],
  ٱ: ['a', ''],
};

export const TRANSLITERATION_TABLE: Record<string, string[]> = { ...GUIDE_TABLE, ...PLAIN_TABLE };

/** Harakat and tatweel carry no Arabizi letter and are dropped before comparison. */
const DIACRITICS = /[ً-ْٰـ]/g;

const ARABIC = /[؀-ۿݐ-ݿ]/;

export function hasArabic(token: string): boolean {
  return ARABIC.test(token);
}

/**
 * The Arabizi skeleton of an Arabic token, taking the first listed form of
 * each letter. A character the table does not cover — a digit, a stray Latin
 * letter inside an Arabic token — is **kept as itself**, so it can still match
 * its counterpart rather than being silently deleted.
 */
export function transliterate(token: string): string {
  const stripped = token.replace(DIACRITICS, '');
  let out = '';
  for (const ch of stripped) {
    const forms = TRANSLITERATION_TABLE[ch];
    out += forms === undefined ? ch.toLowerCase() : (forms[0] as string);
  }
  return out;
}

function editDistance(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i += 1) {
    const row = new Array<number>(m + 1);
    row[0] = i;
    for (let j = 1; j <= m; j += 1) {
      row[j] =
        a[i - 1] === b[j - 1]
          ? (prev[j - 1] as number)
          : 1 + Math.min(prev[j - 1] as number, prev[j] as number, row[j - 1] as number);
    }
    prev = row;
  }
  return prev[m] as number;
}

/**
 * 0 for a perfect transliteration, 1 for no shared structure at all.
 *
 * **Normalised by length**, dividing by the longer of the two: without it a
 * ten-letter pair differing in two characters would score worse than a
 * two-letter pair differing in one, and the aligner would systematically
 * prefer pairing short words.
 *
 * Each letter's alternative forms are tried and the best taken, because `و` is
 * legitimately `w` or `ou` and choosing one would penalise the other.
 */
export function transliterationDistance(arabic: string, latin: string): number {
  const target = latin.toLowerCase();
  const candidates = new Set<string>([transliterate(arabic)]);

  // One alternative form at a time. The full product is exponential and buys
  // nothing: a word rarely turns on two ambiguous letters at once.
  const stripped = arabic.replace(DIACRITICS, '');
  const chars = [...stripped];
  chars.forEach((ch, index) => {
    const forms = TRANSLITERATION_TABLE[ch];
    if (forms === undefined || forms.length < 2) return;
    for (const form of forms.slice(1)) {
      candidates.add(
        chars
          .map((c, i) => {
            if (i === index) return form;
            const f = TRANSLITERATION_TABLE[c];
            return f === undefined ? c.toLowerCase() : (f[0] as string);
          })
          .join(''),
      );
    }
  });

  let best = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const longest = Math.max(candidate.length, target.length);
    const ratio = longest === 0 ? 0 : editDistance(candidate, target) / longest;
    if (ratio < best) best = ratio;
  }
  return Math.min(1, best);
}

/**
 * The cost of substituting one token for the other under experiment 2.
 *
 * Same-script pairs keep the flat cost: this experiment changes one thing, and
 * that thing is the cross-script comparison that carries no signal today. A
 * perfect transliteration bottoms out at `MIN_CROSS_SCRIPT_COST` rather than 0
 * so that a real match is still cheaper than a transliterated one — a match is
 * evidence, a transliteration is a guess that happens to be good.
 */
export const MIN_CROSS_SCRIPT_COST = 0.2;

export function transliterationSubstituteCost(reference: string, hypothesis: string): number {
  const refArabic = hasArabic(reference);
  const hypArabic = hasArabic(hypothesis);
  if (refArabic === hypArabic) return 1;
  const arabic = refArabic ? reference : hypothesis;
  const latin = refArabic ? hypothesis : reference;
  const ratio = transliterationDistance(arabic, latin);
  return MIN_CROSS_SCRIPT_COST + (1 - MIN_CROSS_SCRIPT_COST) * ratio;
}
