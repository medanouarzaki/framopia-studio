import type { ClientMode, ClientPicture } from './mode.js';
import { normalizeToken } from './normalize.js';

/**
 * The client's own pictures, and the two properties that are not negotiable.
 *
 * **1. A client's picture is never sent anywhere.** Generated images pass
 * through Gemini; a client's photograph — a doctor's patient results above all
 * — must not. Nothing in `service/src/images/` reads this module, and a test
 * asserts that the image-generation graph never imports it.
 *
 * **2. It is not copied into a cache.** It stays where he put it and is
 * referenced by path. `.local/cache/` is for things the tool made and can make
 * again; a photograph is neither.
 *
 * **Matching is by a label he writes, and by nothing else.** Deciding that
 * "the clinic exterior" is what a moment wants is a judgement, and this makes
 * none: a picture is used when a word actually spoken is one of the words he
 * listed against it. Anything less generates. A picture with no label is
 * chosen by hand from the picture editor, exactly as before.
 */
export function clientPictures(mode: Pick<ClientMode, 'pictures'>): ClientPicture[] {
  return mode.pictures ?? [];
}

export function clientPictureById(
  mode: Pick<ClientMode, 'pictures'>,
  id: string,
): ClientPicture | null {
  return clientPictures(mode).find((p) => p.id === id) ?? null;
}

/**
 * How much of the comp a picture of arbitrary shape may fill.
 *
 * **This is the half of the feature that actually broke.** Every generated
 * image is a 2048x2048 square, so the builder scaled by width alone and the
 * height followed for free. A real photograph is not square: a phone holds
 * 3024x4032, and scaling that to a 1000 px width gives 1333 px of height inside
 * a 1200 px comp — 133 px over the top and the bottom, and far outside the
 * 1080 px card frame behind it.
 *
 * So a picture is fitted by its **long edge**: the whole of it lands inside the
 * box, whatever its shape, and the short edge is short. Nothing is cropped —
 * cropping a photograph a doctor chose is the tool deciding which half of her
 * results matter.
 */
export function fitByLongEdge(options: {
  /** The placeholder's box in the template, in pixels. */
  boxPx: number;
  /** The template's own scale for that placeholder. */
  templateScalePercent: number;
  sourceWidth: number;
  sourceHeight: number;
}): { scalePercent: number; drawnWidth: number; drawnHeight: number } {
  const { boxPx, templateScalePercent, sourceWidth, sourceHeight } = options;
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('a picture needs a width and a height');
  }
  const long = Math.max(sourceWidth, sourceHeight);
  const scalePercent = (boxPx / long) * templateScalePercent;
  const factor = scalePercent / templateScalePercent;
  return {
    scalePercent,
    drawnWidth: sourceWidth * factor,
    drawnHeight: sourceHeight * factor,
  };
}

/**
 * The words in a picture's label.
 *
 * **The one place a label is read as words**, so the client screen, the
 * validator and the matcher cannot disagree about what a label says. Split on
 * anything that is not a letter or a digit — whitespace, commas, slashes — and
 * normalised with `normalizeToken`, which is the same rule the transcript is
 * compared with everywhere else in this project.
 */
export function labelWords(label: string | undefined): string[] {
  if (label === undefined) return [];
  const words: string[] = [];
  for (const raw of label.split(/[^\p{L}\p{N}]+/u)) {
    const word = normalizeToken(raw);
    if (word !== '' && !words.includes(word)) words.push(word);
  }
  return words;
}

/** Which picture a spoken word asked for, and the word that asked. */
export interface ClientPictureMatch {
  pictureId: string;
  /** The transcript word that fired, as it is written on the plan. */
  word: string;
  wordId: string;
}

/**
 * **A client's picture is used when a word she says is in that picture's
 * label.** Strict, and deliberately nothing more.
 *
 * *What is normalised*: edge punctuation, in both scripts, and Latin case —
 * `Botox`, `botox` and `Botox,` are one word. That is `normalizeToken`, which
 * this project already uses to decide whether two words are the same word.
 *
 * *What is deliberately not*: Arabic letter-forms and diacritics are not
 * folded, Latin and Arabic are never transliterated into each other — a label
 * saying `Botox` does not match `بوتوكس`, and a client who wants both writes
 * both — and there is no stemming, no plural, no synonym, no edit distance and
 * no model. The user chose the strict rule so that it never surprises him; a
 * near-miss generates, exactly as today, and can be widened later on evidence.
 *
 * *Which spoken word*: the words of the slot's own span, because that is the
 * moment the picture illustrates. **The naming word is tried first** — it is
 * the one word the model says the picture is about — and after it the span is
 * read in the order it is spoken.
 *
 * *When two pictures both match*: there is no honest way to prefer one picture
 * a client labelled over another he labelled for the same word, so this does
 * not invent one. It takes **the first in the client's own list**, which is the
 * order he added them and the only order he can see, and it reports the word
 * that fired so the choice is explicable rather than mysterious.
 */
export function matchClientPicture(
  pictures: readonly ClientPicture[],
  spoken: readonly { id: string; text: string }[],
  nameWordId?: string,
): ClientPictureMatch | null {
  const labelled = pictures.filter((p) => labelWords(p.label).length > 0);
  if (labelled.length === 0) return null;

  const named = spoken.find((w) => w.id === nameWordId);
  const order = named === undefined ? spoken : [named, ...spoken.filter((w) => w !== named)];

  for (const word of order) {
    const said = normalizeToken(word.text);
    if (said === '') continue;
    const picture = labelled.find((p) => labelWords(p.label).includes(said));
    if (picture !== undefined) {
      return { pictureId: picture.id, word: word.text, wordId: word.id };
    }
  }
  return null;
}
