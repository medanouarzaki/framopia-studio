import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, SOFT_ENLARGEMENT_PERCENT, fitByLongEdge } from '@framopia/core';

/*
 * **A client's picture is never sent anywhere.**
 *
 * Generated images pass through Gemini; a client's photograph — a doctor's
 * patient results above all — must not. This is the kind of property a comment
 * cannot hold, so it is asserted against the source of the image-generation
 * graph itself.
 */
describe('a client’s own picture never leaves the machine', () => {
  const imagesDir = path.join(REPO_ROOT, 'service', 'src', 'images');
  const sources = readdirSync(imagesDir)
    .filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
    .map((f) => ({ file: f, text: readFileSync(path.join(imagesDir, f), 'utf8') }));

  it('is not read by anything that can call the image model', () => {
    expect(sources.length).toBeGreaterThan(5);
    for (const { file, text } of sources) {
      expect(`${file}: ${String(text.includes('clientPictures'))}`).toBe(`${file}: false`);
      expect(`${file}: ${String(text.includes('chosenClientPictureId'))}`).toBe(`${file}: false`);
      expect(`${file}: ${String(text.includes('client-pictures'))}`).toBe(`${file}: false`);
    }
  });

  /*
   * It stays where he put it. `.local/cache/` is for things the tool made and
   * can make again; a photograph is neither. Comments are stripped first — the
   * rule is about what the code does, not about what it says it does.
   */
  it('is not copied anywhere: the module that owns it writes nothing', () => {
    const raw = readFileSync(path.join(REPO_ROOT, 'core', 'src', 'client-pictures.ts'), 'utf8');
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const forbidden of ['copyFile', 'writeFile', 'node:fs', 'cacheEntryDir', '.local']) {
      expect(`${forbidden}: ${String(code.includes(forbidden))}`).toBe(`${forbidden}: false`);
    }
  });
});

/*
 * A real photograph is not a 2048x2048 square, and the builder scaled by width
 * alone because every generated image was. A phone's 3024x4032 at a 1000px
 * width draws 1333px tall inside a 1200px comp — over the top and the bottom,
 * and far outside the 1080px frame behind it.
 */
describe('a picture of any shape inside the comp', () => {
  const box = { boxPx: 1000, templateScalePercent: 100 };

  it('fits a square exactly as before', () => {
    const fit = fitByLongEdge({ ...box, sourceWidth: 2048, sourceHeight: 2048 });
    expect(fit.scalePercent).toBeCloseTo((1000 / 2048) * 100, 9);
    expect(fit.drawnWidth).toBeCloseTo(1000, 6);
    expect(fit.drawnHeight).toBeCloseTo(1000, 6);
  });

  it('keeps an upright phone photograph inside the box', () => {
    const fit = fitByLongEdge({ ...box, sourceWidth: 3024, sourceHeight: 4032 });
    expect(fit.drawnHeight).toBeCloseTo(1000, 6);
    expect(fit.drawnWidth).toBeCloseTo(750, 6);
    // Scaling by width, as the builder did, would have drawn it 1333px tall.
    expect((1000 / 3024) * 4032).toBeGreaterThan(1300);
  });

  it('keeps a wide photograph inside the box', () => {
    const fit = fitByLongEdge({ ...box, sourceWidth: 4032, sourceHeight: 3024 });
    expect(fit.drawnWidth).toBeCloseTo(1000, 6);
    expect(fit.drawnHeight).toBeCloseTo(750, 6);
  });

  it('never draws either edge past the box, at any shape', () => {
    for (const [w, h] of [[100, 4000], [4000, 100], [1, 1], [1920, 1080], [1080, 1920]]) {
      const fit = fitByLongEdge({ ...box, sourceWidth: w as number, sourceHeight: h as number });
      expect(Math.max(fit.drawnWidth, fit.drawnHeight)).toBeCloseTo(1000, 6);
      expect(Math.min(fit.drawnWidth, fit.drawnHeight)).toBeLessThanOrEqual(1000 + 1e-9);
    }
  });

  it('refuses a picture with no size rather than dividing by zero', () => {
    expect(() => fitByLongEdge({ ...box, sourceWidth: 0, sourceHeight: 100 })).toThrow();
  });
});

/**
 * **Mohamed's ruling of 2026-09-05: a picture enlarged past 200% is warned
 * about; at or under 200%, nothing is said.**
 *
 * He made it by eye on Block 11 session 58's contact sheets — the same picture
 * drawn at 925 px from sources of 2048 down to 200 px — on the grounds that a
 * picture is small on screen and softness does not read at that size, and that
 * the topmost rung was too far.
 *
 * Session 58 measured the ground this sits on: every one of the 122 pictures
 * the project holds is 2048 x 2048 and draws at 48.83%, so **nothing here has
 * ever been enlarged**. A generated picture cannot be — 2048 px is larger than
 * the 2030 px the frame's own margins allow at the extreme — so the rule is
 * reachable only through a client's own photograph or a picture attached to one
 * video, neither of which is resized on the way in.
 */
describe('a picture too small for the space it is given', () => {
  const box = { boxPx: 1000, templateScalePercent: 100 };
  const square = (side: number): number =>
    fitByLongEdge({ ...box, sourceWidth: side, sourceHeight: side }).enlargementPercent;

  it('is measured against the box, never against a pixel size', () => {
    // The same picture is fine in a small box and stretched in a large one, so
    // a video the tool has never seen gets the same answer as this one.
    expect(square(500)).toBeCloseTo(200, 9);
    expect(
      fitByLongEdge({ boxPx: 400, templateScalePercent: 100, sourceWidth: 500, sourceHeight: 500 })
        .enlargementPercent,
    ).toBeCloseTo(80, 9);
    expect(
      fitByLongEdge({ boxPx: 2000, templateScalePercent: 100, sourceWidth: 500, sourceHeight: 500 })
        .enlargementPercent,
    ).toBeCloseTo(400, 9);
  });

  /* The ruling is "past 200", so 200 itself is silent. */
  it('says nothing at exactly 200%', () => {
    expect(square(500)).toBeCloseTo(SOFT_ENLARGEMENT_PERCENT, 9);
    expect(fitByLongEdge({ ...box, sourceWidth: 500, sourceHeight: 500 }).tooEnlarged).toBe(false);
  });

  it('warns a hair past 200%', () => {
    const fit = fitByLongEdge({ ...box, sourceWidth: 499, sourceHeight: 499 });
    expect(fit.enlargementPercent).toBeGreaterThan(SOFT_ENLARGEMENT_PERCENT);
    expect(fit.tooEnlarged).toBe(true);
  });

  it('says nothing about a picture drawn at its own size', () => {
    const fit = fitByLongEdge({ ...box, sourceWidth: 1000, sourceHeight: 1000 });
    expect(fit.enlargementPercent).toBeCloseTo(100, 9);
    expect(fit.tooEnlarged).toBe(false);
  });

  /*
   * A generated picture is 2048 x 2048, and the largest box the frame can ever
   * hold is 2030 px — 2160 wide less the 0.03 margin on each side, beyond which
   * `placementIsSafe` refuses. So the rule can never fire on one.
   */
  it('says nothing about a generated picture, even in the largest box the frame allows', () => {
    const widest = fitByLongEdge({
      boxPx: 2030,
      templateScalePercent: 100,
      sourceWidth: 2048,
      sourceHeight: 2048,
    });
    expect(widest.enlargementPercent).toBeLessThan(100);
    expect(widest.tooEnlarged).toBe(false);
  });

  it('says nothing about a picture larger than its box', () => {
    const fit = fitByLongEdge({ ...box, sourceWidth: 3024, sourceHeight: 4032 });
    expect(fit.enlargementPercent).toBeCloseTo((1000 / 4032) * 100, 9);
    expect(fit.tooEnlarged).toBe(false);
  });

  /* A photograph is not square, and the long edge is what fills the box. */
  it('measures the long edge, whichever it is', () => {
    const wide = fitByLongEdge({ ...box, sourceWidth: 400, sourceHeight: 100 });
    const tall = fitByLongEdge({ ...box, sourceWidth: 100, sourceHeight: 400 });
    expect(wide.enlargementPercent).toBeCloseTo(250, 9);
    expect(tall.enlargementPercent).toBeCloseTo(250, 9);
    expect(wide.tooEnlarged).toBe(true);
    expect(tall.tooEnlarged).toBe(true);
  });

  /* The 500% case session 53 built, which is what opened this. */
  it('warns about the 200 px picture that started this', () => {
    const fit = fitByLongEdge({ ...box, sourceWidth: 200, sourceHeight: 200 });
    expect(fit.enlargementPercent).toBeCloseTo(500, 9);
    expect(fit.scalePercent).toBeCloseTo(500, 9);
    expect(fit.tooEnlarged).toBe(true);
  });
});
