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
