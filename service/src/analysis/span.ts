import { normalizeToken } from '@framopia/core';

/**
 * The longest span a keyword template can carry. TEMPLATE_LIBRARY_GUIDE §4
 * says to design for "1–2 short words, our real case" and §8's own manifest
 * note reads "best on 1 word"; PROJECT_SPEC §5 counts 3–5 emphasized *words*
 * per 30 s, which a three-word span already breaks. Block 3 session 3
 * produced ten words on a 22 s reel.
 */
export const MAX_KEYWORD_WORDS = 2;

/**
 * Tokens that carry no claim on their own, so they are never the point of a
 * keyword. Darija connectives are the freeze-list §4 entries that are
 * grammatical rather than lexical; French articles and prepositions and the
 * Arabic proclitic words are the same idea in the other two languages.
 */
const FUNCTION_WORDS = new Set([
  // Darija (ORTHOGRAPHY_GUIDE §4 freeze list, the grammatical half)
  'dial', 'diali', 'dialk', 'dialo', 'dialha', 'dialna', 'li', 'mn', '3la',
  'f', 'fa', 'w', '7ta', 'tal', 'mabin', 'bach', 'm3a', 'm3aya', 'lik',
  'likom', 'wa7d', 'joj', 'hadchi', 'houa', 'hia', 'homa', 'hadi', 'had',
  'ta', 'l',
  // French
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'pour',
  'avec', 'sans', 'dans', 'par', 'aussi', 'est', 'non',
  // English
  'the', 'and', 'of', 'a', 'to',
  // Arabic script
  'في', 'من', 'على', 'و', 'مع', 'حول', 'ديال', 'اللي', 'هو', 'هي', 'هذا',
  'هذه', 'الى', 'إلى', 'عن', 'أو', 'ما',
]);

const DIGITS_ONLY_RE = /^\d+$/;
const ARABIC_SCRIPT_RE = /[؀-ۿ]/;

/**
 * A token that cannot be the point of a keyword: a function word, or a bare
 * number. A standalone digit is a qualifier here — "18 7ta l 25 chher" is a
 * claim about *months*, and emphasizing "18" on screen says nothing.
 */
export function isDroppable(token: string): boolean {
  const t = normalizeToken(token);
  if (t.length === 0) return true;
  return FUNCTION_WORDS.has(t) || DIGITS_ONLY_RE.test(t);
}

const ARABIC_PROCLITICS = new Set(['و', 'ف', 'ب', 'ك', 'ل']);

/**
 * A comparison key that sees through the definite article and the single-letter
 * proclitics, so `الكولاجين` and `للكولاجين` are recognised as the same idea.
 * Session 3 spent two of three emphasis moments on exactly that pair.
 *
 * A **heuristic, used only for collision comparison** — it never rewrites a
 * word and never reaches the plan. It refuses to strip down to a stub
 * (`MIN_STEM`), which is what keeps it from mangling a word that genuinely
 * begins with one of these letters.
 */
const MIN_STEM = 3;
const MIN_LATIN_STEM = 4;

export function headStem(token: string): string {
  let t = normalizeToken(token);
  if (t.length === 0) return t;

  if (ARABIC_SCRIPT_RE.test(t)) {
    for (let i = 0; i < 2; i += 1) {
      const first = t[0] as string;
      if (!ARABIC_PROCLITICS.has(first) || t.length - 1 < MIN_STEM) break;
      t = t.slice(1);
    }
    if (t.startsWith('ال') && t.length - 2 >= MIN_STEM) t = t.slice(2);
    return t;
  }

  const elided = t.replace(/^l['’]/, '');
  if (elided !== t) return elided;
  if (t.startsWith('l') && t.length - 1 >= MIN_LATIN_STEM) return t.slice(1);
  return t;
}

/** The stems a span asserts something about; function words and bare numbers
 * contribute nothing, so two spans sharing only those do not collide. */
export function significantStems(tokens: string[]): Set<string> {
  return new Set(
    tokens.filter((t) => !isDroppable(t)).map(headStem).filter((s) => s.length > 0),
  );
}

export interface NarrowResult {
  /** Indices into the input, contiguous, at most MAX_KEYWORD_WORDS long. */
  indices: number[];
  narrowed: boolean;
}

/**
 * Narrows an over-long span to the 1–2 contiguous tokens that carry it. The
 * rule, in full, because a keyword's text is what a client sees on screen:
 *
 * 1. Drop droppable tokens from the front and then the back, while more than
 *    one token remains.
 * 2. If two or fewer remain, that is the span.
 * 3. Otherwise keep the first token, plus the second when the second is not
 *    droppable. Head-initial is right for all three languages in these reels:
 *    Arabic and Darija noun phrases put the head noun first (`محفزات
 *    الكولاجين`), and so does French (`lissage brésilien`).
 *
 * A span is narrowed, never dropped — the model found a real moment and the
 * template contract is about how much text fits, not about whether the moment
 * counts.
 */
export function narrowSpan(tokens: string[]): NarrowResult {
  if (tokens.length === 0) return { indices: [], narrowed: false };

  let lo = 0;
  let hi = tokens.length - 1;
  while (lo < hi && isDroppable(tokens[lo] as string)) lo += 1;
  while (hi > lo && isDroppable(tokens[hi] as string)) hi -= 1;

  const kept: number[] = [];
  if (hi - lo + 1 <= MAX_KEYWORD_WORDS) {
    for (let i = lo; i <= hi; i += 1) kept.push(i);
  } else {
    kept.push(lo);
    if (!isDroppable(tokens[lo + 1] as string)) kept.push(lo + 1);
  }

  const narrowed = kept.length !== tokens.length;
  return { indices: kept, narrowed };
}
