const ARABIC_SCRIPT_RE = /[؀-ۿ]/;

// Leading/trailing punctuation, in either script. Arabic question marks and
// commas (؟ ،) are punctuation, not letters, so \p{L} excludes them already.
const EDGE_PUNCTUATION_RE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/**
 * Normalizes a single word token for WER comparison. Both scripts get their
 * edge punctuation stripped — the ground truth writes "للوجه؟" where an
 * engine writes "للوجه", and that is not a transcription error. Only Latin
 * words are lowercased; digits are left alone because 3/7/9 are letters in
 * Arabizi (see docs/ORTHOGRAPHY_GUIDE.md §2).
 */
export function normalizeToken(token: string): string {
  if (ARABIC_SCRIPT_RE.test(token)) {
    return token.trim().replace(EDGE_PUNCTUATION_RE, '');
  }

  return token
    .trim()
    .toLowerCase()
    .replace(EDGE_PUNCTUATION_RE, '')
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

// Spelled-out Darija numerals, mapped to the digit form the orthography
// guide mandates (§3a). Every engine spelled its numbers out and the ground
// truth writes digits throughout, so without this every number in every reel
// scores as a substitution — an artifact of two valid spellings, not a
// transcription error. Variants are the spellings actually produced by the
// Block 1 engines plus the obvious neighbours.
//
// "wa7d" and "joj" are deliberately absent: in these reels they are the
// indefinite article and a quantifier ("wa7d l cocktail", "joj dial
// l7essass"), not numerals, and the ground truth never writes them as digits.
const NUMERAL_TO_DIGITS = new Map<string, string>(
  Object.entries({
    '3': ['tlata', 'tlatta'],
    '4': ['rb3a', 'reb3a', 'rab3a', 'arb3a'],
    '5': ['khmsa', 'khamsa'],
    '6': ['stta', 'setta', 'sitta'],
    '7': ['sb3a', 'seb3a'],
    '8': ['tmnya', 'tmenya', 'tmanya', 'tmniat', 'tmnyat'],
    '9': ['ts3a', 'tes3a', 'ts3oud'],
    '10': ['3chra', '3achra'],
    '11': ['7dach', '7edach'],
    '12': ['tnach', 'tnnach'],
    '13': ['tltach', 'tlttach'],
    '14': ['rb3tach', 'reb3tach'],
    '15': ['khmstach', 'khamstach', 'khmstachr', 'khamstachr', 'khmstachar'],
    '16': ['sttach', 'settach'],
    '17': ['sb3tach', 'seb3tach'],
    '18': ['tmntach', 'tmentach', 'tmantach'],
    '19': ['ts3tach', 'tes3tach'],
    '20': ['3chrin', '3echrin', '3ichrin', '3achrin'],
  }).flatMap(([digits, spellings]) => spellings.map((s) => [s, digits] as [string, string])),
);

/**
 * Normalizes a token sequence for WER comparison only: script-boundary
 * splitting, the usual token normalization, then numeral equivalence.
 * Kept separate from normalizeWords because the numeral map must not reach
 * hybrid's alignment or the cross-engine timestamp keys, where a word is a
 * word and rewriting it would change engine behaviour rather than scoring.
 */
export function normalizeForWer(words: string[]): string[] {
  return normalizeWords(words).map((word) => NUMERAL_TO_DIGITS.get(word) ?? word);
}
