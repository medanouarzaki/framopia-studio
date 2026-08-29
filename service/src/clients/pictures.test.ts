import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, fitByLongEdge } from '@framopia/core';

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
