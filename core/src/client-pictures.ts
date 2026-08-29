import type { ClientMode, ClientPicture } from './mode.js';

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
 * **Automatic matching is deliberately not attempted.** Deciding that "the
 * clinic exterior" is what a moment wants is the same judgement as knowing a
 * clock reads quarter past rather than five minutes, and that is the open
 * image-prompt defect in `docs/DECISION-image-config.md` — Block 9. He chooses,
 * by hand, from pictures he described himself.
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
