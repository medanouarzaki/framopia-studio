import type { WordLang, WordScript } from '../editplan/types.js';

const ARABIC_SCRIPT_RE = /[؀-ۿݐ-ݿ]/;

/**
 * What the correction pass may say about a word beyond its text. The prompt
 * frozen in Block 1 asks only for `text`, so `lang` and `script` are absent
 * in practice today; they are read here so that a later prompt version can
 * supply them without another change to this layer.
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
}

/**
 * Script is read off the characters, which is an observation rather than a
 * judgement: a token containing Arabic-script codepoints is Arabic script.
 *
 * Language is not derivable this way. Arabizi Darija, French and English all
 * sit in Latin script, and Arabic script covers both MSA and the domain terms
 * §6 mandates. When the correction pass does not say — which is every word
 * today — `lang` is **null**, meaning "no stage has determined this yet".
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

  return { lang, script };
}

export function tagWords(words: CorrectedWord[]): WordTags[] {
  return words.map(tagWord);
}
