/**
 * What the build says about a picture too small for the space it fills.
 *
 * **The sentence is here rather than inline so it can be asserted.** Block 11
 * session 59 added the warning and quoted it in its report; nothing had ever
 * run it, and a line nobody has seen printed is a line that might not print.
 * `soft-picture.test.ts` compares this against the string the build really
 * produced on a reel that places a 320 px photograph.
 *
 * **It warns and it does not refuse** — Mohamed's ruling of 2026-09-05. A
 * client's logo may exist at one size and no other, and refusing would throw
 * away the only picture they have. The build says so and places it.
 */
export function softPictureWarning(options: {
  elementId: string;
  sourceWidth: number;
  sourceHeight: number;
  boxPx: number;
  enlargementPercent: number;
}): string {
  const { elementId, sourceWidth, sourceHeight, boxPx, enlargementPercent } = options;
  return (
    `warning [${elementId}]: this picture is ${sourceWidth}x${sourceHeight}px and is being ` +
    `drawn at ${boxPx}px, so it is enlarged ${enlargementPercent.toFixed(0)}% and will look ` +
    'soft. It is still placed; a larger copy of the same picture would look sharper.'
  );
}

/**
 * What the build says about a picture that is not the shape of its frame.
 *
 * **Beside `softPictureWarning`, in the same shape and for the same reason.**
 * Block 13 session 107: a photograph that is not square is fitted whole into a
 * square box — which crops nothing, and is right — and then sits on a square card
 * with bare card above and below it. None of the six non-square photographs on
 * this disk is enlarged past 200%, so the warning session 59 built never fires on
 * any of them and the build said nothing at all.
 *
 * **It warns and it does not refuse**, which is Mohamed's ruling of 2026-09-05
 * about the other warning and the only one there is. Whether the answer should be
 * to fit, to fill or to refuse is his; this says what is happening.
 */
export function pictureShapeWarning(options: {
  elementId: string;
  sourceWidth: number;
  sourceHeight: number;
  shape: 'square' | 'wider than it is tall' | 'taller than it is wide';
  bandPx: number;
  cardPx: number;
}): string {
  const { elementId, sourceWidth, sourceHeight, shape, bandPx, cardPx } = options;
  const where = shape === 'taller than it is wide' ? 'each side of' : 'above and below';
  return (
    `warning [${elementId}]: this picture is ${sourceWidth}x${sourceHeight}px, ${shape}, ` +
    `and the frame it goes in is square. It is placed whole and nothing is cut off, so ` +
    `${bandPx.toFixed(0)}px of the ${cardPx}px card shows ${where} it.`
  );
}
