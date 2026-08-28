import { describe, expect, it } from 'vitest';
import { fileUrl, pictureFor } from './picture.js';
import type { CandidateView, ImageSlotView } from './types.js';

const slot = (over: Partial<ImageSlotView> = {}): ImageSlotView =>
  ({ presentation: 'card', rendersAsCutout: false, ...over }) as ImageSlotView;

const candidate = (over: Partial<CandidateView> = {}): CandidateView =>
  ({
    id: 'c1',
    imagePath: '/v/image.jpg',
    imageExists: true,
    cutoutPath: '/v/c1.cutout.png',
    cutoutExists: true,
    ...over,
  }) as CandidateView;

describe('which picture to show', () => {
  it('prefers the file the service named', () => {
    expect(pictureFor(slot(), candidate({ renderedPath: '/v/x.jpg', renderedExists: true })))
      .toEqual({ state: 'ready', path: '/v/x.jpg' });
  });

  /*
   * The session 31 defect. The panel is reloaded from `panel/dist` while the
   * service is a long-running process, so the bundle can be newer than the
   * service; against one started before the change, `renderedPath` is absent
   * and every candidate read as missing from the disk.
   */
  it('falls back to the older reply rather than claiming the file is gone', () => {
    const older = candidate();
    delete (older as Partial<CandidateView>).renderedPath;
    delete (older as Partial<CandidateView>).renderedExists;
    expect(pictureFor(slot(), older)).toEqual({ state: 'ready', path: '/v/image.jpg' });
    expect(pictureFor(slot({ presentation: 'cutout', rendersAsCutout: true }), older)).toEqual({
      state: 'ready',
      path: '/v/c1.cutout.png',
    });
  });

  it('applies the builder’s own rule when it has to fall back', () => {
    const older = candidate();
    delete (older as Partial<CandidateView>).renderedPath;
    // An older service sends `presentation` but not `rendersAsCutout`.
    const legacySlot = slot({ presentation: 'cutout' });
    delete (legacySlot as Partial<ImageSlotView>).rendersAsCutout;
    expect(pictureFor(legacySlot, older)).toEqual({ state: 'ready', path: '/v/c1.cutout.png' });
  });

  it('says a file is absent only when the service says so', () => {
    expect(
      pictureFor(slot(), candidate({ renderedPath: '/v/x.jpg', renderedExists: false })),
    ).toEqual({ state: 'absent', path: '/v/x.jpg' });
    const older = candidate({ imageExists: false });
    delete (older as Partial<CandidateView>).renderedPath;
    expect(pictureFor(slot(), older)).toEqual({ state: 'absent', path: '/v/image.jpg' });
  });

  /* Nothing to show and nothing to blame the disk for. */
  it('says the picture is unnamed when the service named none at all', () => {
    const bare = candidate({ imagePath: '' });
    delete (bare as Partial<CandidateView>).renderedPath;
    delete (bare as Partial<CandidateView>).cutoutPath;
    expect(pictureFor(slot(), bare)).toEqual({ state: 'unnamed' });
  });
});

describe('the file URL', () => {
  /* Every cutout in the corpus lives under `my files/test videos/`. */
  it('encodes the spaces these paths actually contain', () => {
    expect(fileUrl('/Volumes/T7 Shield/my files/test videos/cutouts/a.png')).toBe(
      'file:///Volumes/T7%20Shield/my%20files/test%20videos/cutouts/a.png',
    );
  });

  it('leaves the separators alone', () => {
    expect(fileUrl('/a/b/c.jpg')).toBe('file:///a/b/c.jpg');
  });

  it('encodes a fragment or query character rather than truncating the path', () => {
    expect(fileUrl('/a/b#1?2.jpg')).toBe('file:///a/b%231%3F2.jpg');
  });
});
