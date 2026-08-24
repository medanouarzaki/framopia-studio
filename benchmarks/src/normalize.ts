const ARABIC_SCRIPT_RE = /[؀-ۿ]/;

/**
 * Normalizes a single word token for WER comparison. Arabic-script words
 * are compared as-is (no casing to strip). Latin words are lowercased and
 * stripped of leading/trailing punctuation; digits are left alone because
 * 3/7/9 are letters in Arabizi (see docs/ORTHOGRAPHY_GUIDE.md §2).
 */
export function normalizeToken(token: string): string {
  if (ARABIC_SCRIPT_RE.test(token)) {
    return token.trim();
  }

  return token
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .replace(/\s+/g, ' ');
}

/**
 * Splits a token at Arabic/Latin script boundaries. Scribe emits the
 * occasional joined code-switch token ("واحدcocktail", seen once in 23s of
 * real audio); left whole it aligns against neither reference word, so a
 * single join costs a substitution plus a deletion and drags every later
 * word out of alignment. Splitting it in both hypothesis and reference makes
 * a join cost one boundary error and nothing more.
 */
export function splitScriptBoundaries(token: string): string[] {
  const pieces = token.match(/[\u0600-\u06FF\u0750-\u077F]+|[^\u0600-\u06FF\u0750-\u077F]+/g);
  if (pieces === null) return [token];
  return pieces.map((piece) => piece.trim()).filter((piece) => piece.length > 0);
}

export function normalizeWords(words: string[]): string[] {
  return words
    .flatMap(splitScriptBoundaries)
    .map(normalizeToken)
    .filter((word) => word.length > 0);
}
