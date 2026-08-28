import { describe, expect, it } from 'vitest';
import { accessSync, constants, statSync } from 'node:fs';
import { imagesView } from './image-view.js';

/**
 * **Against the real files, not a fixture.**
 *
 * Session 31 changed the picker to render `renderedPath` and shipped it with
 * 141 panel tests green, because every one of them drives a fixture shaped like
 * the service's reply. A fixture always has its files; a filesystem does not.
 * Guidelines §3 — a test environment more capable than the host proves nothing
 * about the host — and a fixture is more capable than a disk.
 *
 * So this walks the reels that actually have generated images and checks every
 * path the picker would render: it exists, it is a file, it is readable, and it
 * is not empty. It is in the service tests because they already read the real
 * plans; a browser test cannot see the filesystem at all.
 */
const WITH_IMAGES = ['vitasilk'] as const;

describe('every picture the picker would show is really there', () => {
  it('has a reel with generated images to check', async () => {
    // If this ever fails the suite below is vacuous, which is worse than red.
    const view = await imagesView('vitasilk');
    expect(view.slots.flatMap((s) => s.candidates).length).toBeGreaterThan(0);
  });

  it('resolves, and can read, every file it would render', async () => {
    for (const reel of WITH_IMAGES) {
      const view = await imagesView(reel);
      for (const slot of view.slots) {
        for (const candidate of slot.candidates) {
          const where = `${reel}/${slot.id}/${candidate.id}`;
          expect(candidate.renderedPath, where).toMatch(/^\//);
          expect(candidate.renderedExists, where).toBe(true);
          expect(() => accessSync(candidate.renderedPath, constants.R_OK), where).not.toThrow();
          const stat = statSync(candidate.renderedPath);
          expect(stat.isFile(), where).toBe(true);
          expect(stat.size, where).toBeGreaterThan(0);
        }
      }
    }
  });

  /*
   * The picker offers the picture before the background was removed, on a
   * cutout slot only. That file has to be there too.
   */
  it('can read the raw picture wherever it offers one', async () => {
    for (const reel of WITH_IMAGES) {
      const view = await imagesView(reel);
      for (const slot of view.slots.filter((s) => s.rendersAsCutout)) {
        for (const candidate of slot.candidates) {
          const where = `${reel}/${slot.id}/${candidate.id}`;
          expect(candidate.imageExists, where).toBe(true);
          expect(() => accessSync(candidate.imagePath, constants.R_OK), where).not.toThrow();
        }
      }
    }
  });

  /*
   * The picker and the builder must name the same file. They read one rule —
   * `presentation` — but from different code, and a divergence would show the
   * user a picture the build does not place.
   */
  it('names the same file the builder would place', async () => {
    const view = await imagesView('vitasilk');
    for (const slot of view.slots) {
      for (const candidate of slot.candidates) {
        const expected = slot.rendersAsCutout ? candidate.cutoutPath : candidate.imagePath;
        expect(candidate.renderedPath, `${slot.id}/${candidate.id}`).toBe(expected);
      }
    }
  });

  /*
   * These paths live under `my files/test videos/`, so a space in a directory
   * name is the normal case rather than an edge one. The panel encodes it; this
   * records that the encoding has something to do.
   */
  it('has paths with spaces in them, which is why the URL is encoded', async () => {
    const view = await imagesView('vitasilk');
    const all = view.slots.flatMap((s) => s.candidates.map((c) => c.renderedPath));
    expect(all.some((p) => p.includes(' '))).toBe(true);
  });
});
