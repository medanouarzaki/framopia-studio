import { describe, expect, it } from 'vitest';
import { SOFT_ENLARGEMENT_PERCENT, fitByLongEdge } from '@framopia/core';
import { softPictureWarning, croppedPictureNote } from './soft-picture.js';

/**
 * **The line the build really printed.**
 *
 * Copied out of the output of `npm run build:reel` on a reel whose first slot a
 * 320 px photograph fills, run on 2026-09-05. Block 11 session 59 wrote this
 * warning and quoted it in its report without ever running it; this is the run.
 *
 * The build exited 0 and placed the picture — it warns and continues, which is
 * Mohamed's ruling.
 */
const AS_PRINTED =
  'warning [img001]: this picture is 320x320px and is being drawn at 1000px, so it is ' +
  'enlarged 313% and will look soft. It is still placed; a larger copy of the same ' +
  'picture would look sharper.';

describe('what the build says about a picture too small for its space', () => {
  it('is exactly what it printed on a real reel', () => {
    const fit = fitByLongEdge({
      boxPx: 1000,
      templateScalePercent: 100,
      sourceWidth: 320,
      sourceHeight: 320,
    });
    expect(fit.tooEnlarged).toBe(true);
    expect(
      softPictureWarning({
        elementId: 'img001',
        sourceWidth: 320,
        sourceHeight: 320,
        boxPx: 1000,
        enlargementPercent: fit.enlargementPercent,
      }),
    ).toBe(AS_PRINTED);
  });

  /* It names the element, so a reel with several says which one. */
  it('names the slot it is about', () => {
    const said = softPictureWarning({
      elementId: 'img004',
      sourceWidth: 200,
      sourceHeight: 200,
      boxPx: 1000,
      enlargementPercent: 500,
    });
    expect(said).toContain('warning [img004]');
    expect(said).toContain('200x200px');
    expect(said).toContain('enlarged 500%');
  });

  /*
   * It says the picture is still placed. A build that warned and refused would
   * be a different ruling, and this is the sentence that says which one it is.
   */
  it('says the picture is still placed', () => {
    const said = softPictureWarning({
      elementId: 'img001',
      sourceWidth: 320,
      sourceHeight: 320,
      boxPx: 1000,
      enlargementPercent: 312.5,
    });
    expect(said).toContain('It is still placed');
    expect(said.toLowerCase()).not.toContain('refus');
    // And it sends nobody to a terminal, like every other message in this tool.
    for (const word of ['npm run', 'terminal', 'restart']) {
      expect(`${word}: ${said.toLowerCase().includes(word)}`).toBe(`${word}: false`);
    }
  });

  /* The build only reaches this line past the ruling, which is what fires it. */
  it('is only reached past the ruling', () => {
    const at = fitByLongEdge({ boxPx: 1000, templateScalePercent: 100, sourceWidth: 500, sourceHeight: 500 });
    expect(at.enlargementPercent).toBe(SOFT_ENLARGEMENT_PERCENT);
    expect(at.tooEnlarged).toBe(false);
  });
});

/**
 * **Rewritten by Block 13 session 108.**
 *
 * Session 107 wrote this to assert a sentence describing a problem — *238px of
 * the 1080px card shows above and below it*. Mohamed ruled fill, so nothing
 * shows beside the picture any more and the same condition produces a note about
 * what was cut. What it holds is unchanged: the size, which way the picture is
 * long, no jargon, no command, no threat to refuse — and it now also asserts the
 * sentence says his original is untouched.
 */
describe('what the build says when it crops a photograph to fill its frame', () => {
  it('names the shape, the size and how much was cut, without jargon', () => {
    const said = croppedPictureNote({
      elementId: 'img003',
      sourceWidth: 1200,
      sourceHeight: 630,
      shape: 'wider than it is tall',
      lostFraction: 1 - (630 * 630) / (1200 * 630),
      made: true,
    });
    expect(said).toBe(
      'img003: this picture is 1200x630px, wider than it is tall, and the frame it goes in is ' +
        'square, so 48% of it is cropped off the sides to fill the frame. The square copy is ' +
        'made and kept beside the original, which is untouched.',
    );
    /* No command, and it does not threaten to refuse. */
    expect(said).not.toMatch(/npm |terminal|refus/i);
  });

  it('says which sides were cut when the picture is the tall way', () => {
    const said = croppedPictureNote({
      elementId: 'img001',
      sourceWidth: 4776,
      sourceHeight: 6432,
      shape: 'taller than it is wide',
      lostFraction: 1 - (4776 * 4776) / (4776 * 6432),
      made: true,
    });
    expect(said).toContain('cropped off the top and the bottom');
  });

  /** A second build finds the copy and says so rather than claiming it made one. */
  it('does not claim to have made a copy that was already there', () => {
    const said = croppedPictureNote({
      elementId: 'img002',
      sourceWidth: 1000,
      sourceHeight: 665,
      shape: 'wider than it is tall',
      lostFraction: 0.335,
      made: false,
    });
    expect(said).toContain('the one made earlier');
    expect(said).not.toContain('made and kept');
  });
});
