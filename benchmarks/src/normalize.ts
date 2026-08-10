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

export function normalizeWords(words: string[]): string[] {
  return words.map(normalizeToken).filter((word) => word.length > 0);
}
