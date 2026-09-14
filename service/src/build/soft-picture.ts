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
 * What the build says when it crops a photograph to fill its frame.
 *
 * **Session 107 wrote this sentence to describe a problem; Mohamed's ruling of
 * fill turned it into a description of an action.** It said *the frame it goes in
 * is square … so 238px of the 1080px card shows above and below it*. Nothing
 * shows beside it any more — the picture is cropped to fill the frame — so what
 * is worth saying is what was cut off.
 *
 * **It is a note, not a warning.** Nothing went wrong and nothing is being
 * refused; a thing happened to his photograph and he is told which and how much.
 * The original is untouched and the sentence says so, because "cropped" and
 * "damaged my file" are one word apart in anyone's head.
 */
export function croppedPictureNote(options: {
  elementId: string;
  sourceWidth: number;
  sourceHeight: number;
  shape: 'square' | 'wider than it is tall' | 'taller than it is wide';
  lostFraction: number;
  /** False when the square copy was already there from an earlier build. */
  made: boolean;
}): string {
  const { elementId, sourceWidth, sourceHeight, shape, lostFraction, made } = options;
  const lost = Math.round(lostFraction * 100);
  const sides = shape === 'taller than it is wide' ? 'the top and the bottom' : 'the sides';
  return (
    `${elementId}: this picture is ${sourceWidth}x${sourceHeight}px, ${shape}, and the frame it ` +
    `goes in is square, so ${String(lost)}% of it is cropped off ${sides} to fill the frame. ` +
    `The square copy is ${made ? 'made and kept' : 'the one made earlier'} beside the original, ` +
    'which is untouched.'
  );
}
