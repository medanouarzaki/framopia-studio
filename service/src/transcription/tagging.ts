import type { WordLang, WordScript } from '../editplan/types.js';

const ARABIC_SCRIPT_RE = /[؀-ۿݐ-ݿ]/;

/**
 * What the correction pass may say about a word beyond its text. Prompt
 * version 3 supplies `lang`; versions 1 and 2 ask only for `text`. `script`
 * is read here too, though no prompt version asks for it — the characters
 * answer that on their own.
 */
export interface CorrectedWord {
  text: string;
  lang?: string;
  script?: string;
}

const LANGS = new Set<WordLang>(['darija', 'msa', 'fr', 'en', 'mixed']);

export interface WordTags {
  lang: WordLang | null;
  script: WordScript;
  /**
   * What the local derivation concluded independently, or null where it has
   * no opinion. Never used to fill `lang`.
   */
  derivedLang: WordLang | null;
  /**
   * True when the model said one language and the derivation said another.
   * Recorded for review; neither side overwrites the other, because the
   * derivation is a wordlist and the model heard the audio.
   */
  langDisagreement: boolean;
}

const ACCENTED_RE = /[àâäçéèêëîïôöùûüÿœæ]/i;

/**
 * A deliberately small closed-class French and English lexicon plus the
 * accent and elided-article giveaways. It exists to contradict the model, not
 * to replace it: Arabizi never carries an accent or an `l'` elision, so a hit
 * is strong evidence, while a miss says nothing at all — most Darija words
 * are simply absent from any list. Anything not matched derives to null.
 *
 * Kept separate from the benchmark's ground-truth tagger, which defaults
 * unmatched words to darija. That default is right for scoring a
 * Darija-majority reference and wrong here, where a wrong guess would be
 * recorded as a disagreement with the model.
 *
 * The rule for both lists: **an entry may only be a word whose spelling
 * decides its language.** A word spelled the same in French and English
 * cannot be claimed by either, so it is absent and derives to null — the
 * derivation says nothing rather than guessing. Two corollaries, so neither
 * gets re-added:
 *
 * - An accented word needs no entry. `ACCENTED_RE` below already answers it,
 *   and listing it twice invites the two to drift apart.
 * - A brand or product name is not a language claim. §5 makes brand spelling
 *   a client-vocabulary matter, and mode vocabulary carries it from Block 9.
 */
const FRENCH_LEXICON = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'alors',
  'donc', 'mais', 'pour', 'avec', 'sans', 'dans', 'par', 'non', 'aussi',
  'est', "c'est", 'soin', 'vitamines', 'saumon', 'cernes', 'visage', 'peau',
  'cou', 'acide', 'exemple', 'lissage', 'hyaluronique', 'ridules',
  'faiblement',
]);

// "filler" and "glow" were both listed as French. They are English loanwords
// in Moroccan aesthetics speech, and the one time the cross-check ever fired
// it was this error: the model tagged "filler" en in "le filler glow" and was
// right. "glow" is asserted here; "filler" is only removed, so it derives to
// null and the derivation stays silent rather than trading one claim for
// another.
const ENGLISH_LEXICON = new Set(['the', 'and', 'eyes', 'skin', 'glow']);

const EDGE_PUNCTUATION_RE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/**
 * The local opinion, or null for "no opinion". Never a source for `lang`.
 */
export function deriveLang(text: string): WordLang | null {
  if (ARABIC_SCRIPT_RE.test(text)) return null; // msa or darija; unknowable here
  const bare = text
    .toLowerCase()
    .replace(/^l['\u2019]/, '')
    .replace(EDGE_PUNCTUATION_RE, '');
  if (bare.length === 0) return null;
  if (ENGLISH_LEXICON.has(bare)) return 'en';
  if (FRENCH_LEXICON.has(bare)) return 'fr';
  if (ACCENTED_RE.test(bare) || /^l['\u2019]/.test(text)) return 'fr';
  return null;
}

/**
 * Script is read off the characters, which is an observation rather than a
 * judgement: a token containing Arabic-script codepoints is Arabic script.
 *
 * Language is not derivable this way. Arabizi Darija, French and English all
 * sit in Latin script, and Arabic script covers both MSA and the domain terms
 * §6 mandates. Prompt version 3 asks the model for it; when the model does
 * not say, `lang` is **null**, meaning "no stage has determined this".
 * It is deliberately not defaulted to `darija`: most words are Darija, so
 * that default would be right often enough to look like data and wrong often
 * enough to mislead the review UI it feeds.
 */
export function tagWord(word: CorrectedWord): WordTags {
  const script: WordScript =
    word.script === 'latin' || word.script === 'arabic'
      ? word.script
      : ARABIC_SCRIPT_RE.test(word.text)
        ? 'arabic'
        : 'latin';

  const lang =
    typeof word.lang === 'string' && LANGS.has(word.lang as WordLang)
      ? (word.lang as WordLang)
      : null;

  const derivedLang = deriveLang(word.text);

  return {
    lang,
    script,
    derivedLang,
    langDisagreement: lang !== null && derivedLang !== null && lang !== derivedLang,
  };
}

export function tagWords(words: CorrectedWord[]): WordTags[] {
  return words.map(tagWord);
}
