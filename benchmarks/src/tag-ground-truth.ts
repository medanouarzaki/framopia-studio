import type { GroundTruthWord } from './types.js';
import { splitScriptBoundaries } from './normalize.js';

const ARABIC_SCRIPT_RE = /[؀-ۿݐ-ݿ]/;
const ACCENTED_RE = /[àâäçéèêëîïôöùûüÿœæ]/i;

// Closed-class French words plus the aesthetics/skincare vocabulary that
// actually shows up in these reels. Kept small on purpose: anything not
// listed and not accent-marked falls through to darija, which is the right
// default for a Darija-majority transcript.
const FRENCH_LEXICON = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'alors', 'et', 'ou',
  'donc', 'mais', 'pour', 'avec', 'sans', 'dans', 'par', 'exemple', 'deja',
  // "mains" only in the plural. Singular "main" is left out: the one place it
  // appeared was a typo for Darija "mabin" (between), fixed in the ground
  // truth for v1.0.2, and a bare singular is far likelier to be that typo
  // again than the French for hand.
  'cou', 'mains', 'visage', 'peau', 'acide', 'non',
  'cernes', 'vidéo', 'effet', 'caféine', 'vitamines', 'injections',
  'polynucléotides', 'mésothérapie', 'hyaluronique', 'réticulé', 'ridules',
  'petites', 'pigmentées', 'faiblement', 'décolleté', 'profhilo', 'saumon',
  'cocktail', 'adn', 'rrs',
]);

const ENGLISH_LEXICON = new Set(['the', 'and', 'eyes', 'cabin', 'kids', 'skin', 'face']);

function stripLeadingArticle(word: string): string {
  return word.replace(/^l['’]/i, '');
}

export function tagWord(raw: string): GroundTruthWord {
  const text = raw;

  if (ARABIC_SCRIPT_RE.test(text)) {
    return { text, lang: 'msa', script: 'arabic' };
  }

  const bare = stripLeadingArticle(text)
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

  if (ENGLISH_LEXICON.has(bare)) return { text, lang: 'en', script: 'latin' };
  if (FRENCH_LEXICON.has(bare)) return { text, lang: 'fr', script: 'latin' };

  // An accent or an elided French article is a reliable giveaway: Arabizi
  // never carries either.
  if (ACCENTED_RE.test(bare) || /^l['’]/i.test(text)) {
    return { text, lang: 'fr', script: 'latin' };
  }

  return { text, lang: 'darija', script: 'latin' };
}

export function tagTranscript(source: string): GroundTruthWord[] {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .flatMap((line) => line.split(/\s+/))
    .flatMap(splitScriptBoundaries)
    .filter((token) => token.length > 0)
    .map(tagWord);
}
