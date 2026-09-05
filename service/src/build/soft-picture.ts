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
