import { describe, expect, it } from 'vitest';
import { pictureLives, pictureStartOf, pictureWindows, type PictureWindow } from './picture-life.js';

/**
 * **When a picture arrives and when it leaves, over reel shapes rather than
 * over reels.**
 *
 * Two rulings of 1 September. *"The images shouldn't cut off. After each image
 * appears, it should stay until the next one appears."* And: *"At the very
 * beginning of the video the doctor says hello. She doesn't say 'I'm doctor'
 * etc. He should display the photo at the time she says 'I am doctor'."*
 *
 * Every case here is arithmetic over windows invented in the test. Nothing
 * reads the disk, runs a model or opens a socket, so no reel's numbers can leak
 * into the rule and there is nothing for a request to leave through.
 */

/** The image template's authored entrance; passed in everywhere, never assumed. */
const ENTRANCE = 0.4004;

function reel(...spans: [number, number][]): PictureWindow[] {
  return spans.map(([start, end], i) => ({ id: `img${i + 1}`, start, end }));
}

/** No moment between the first picture's arrival and the last one's departure is uncovered. */
function gaps(lives: { screenStartS: number; screenEndS: number }[]): number[] {
  const order = lives.slice().sort((a, b) => a.screenStartS - b.screenStartS);
  return order
    .slice(0, -1)
    .map((l, i) => (order[i + 1] as { screenStartS: number }).screenStartS - l.screenEndS);
}

describe('where a picture arrives', () => {
  it('arrives with its sentence when the model named no word', () => {
    expect(pictureStartOf({ id: 'a', start: 1, end: 4 }, ENTRANCE)).toBe(1);
  });

  it('arrives at the naming word when it is the first word of the span', () => {
    expect(pictureStartOf({ id: 'a', start: 1, end: 4, nameStartS: 1 }, ENTRANCE)).toBe(1);
  });

  it('arrives at the naming word when it is in the middle of the span', () => {
    expect(pictureStartOf({ id: 'a', start: 1, end: 4, nameStartS: 2.5 }, ENTRANCE)).toBe(2.5);
  });

  /**
   * The bound that matters: a picture may not arrive so late that its entrance
   * could not finish inside its own words. Clamped against the words' end
   * rather than against the next picture, so one slot decides it alone and the
   * builder, the sizing and the sound can each compute it without knowing what
   * follows.
   */
  it('is pulled back when the naming word is too near the end for the entrance', () => {
    const life = pictureStartOf({ id: 'a', start: 1, end: 4, nameStartS: 3.9 }, ENTRANCE);
    expect(life).toBeCloseTo(4 - ENTRANCE, 9);
    expect(4 - life).toBeGreaterThanOrEqual(ENTRANCE - 1e-9);
  });

  it('never leaves its own span, however short the span is', () => {
    // A one-word span shorter than the entrance: it cannot start later at all.
    expect(pictureStartOf({ id: 'a', start: 2, end: 2.2, nameStartS: 2 }, ENTRANCE)).toBe(2);
    // A naming word the caller resolved to something before the span.
    expect(pictureStartOf({ id: 'a', start: 2, end: 5, nameStartS: 0.5 }, ENTRANCE)).toBe(2);
    // And after it.
    expect(pictureStartOf({ id: 'a', start: 2, end: 5, nameStartS: 9 }, ENTRANCE)).toBe(5 - ENTRANCE);
  });

  it('resolves a named word to a time, and leaves an unresolvable one alone', () => {
    const windows = pictureWindows(
      [
        { id: 'a', start: 1, end: 4, nameWordId: 'w0002' },
        { id: 'b', start: 5, end: 7, nameWordId: 'w9999' },
        { id: 'c', start: 8, end: 9 },
      ],
      (id) => (id === 'w0002' ? 2.5 : undefined),
    );
    expect(windows[0]?.nameStartS).toBe(2.5);
    expect(windows[1]?.nameStartS).toBeUndefined();
    expect(windows[2]?.nameStartS).toBeUndefined();
  });
});

describe('pictureLives', () => {
  it('leaves no void between two pictures far apart', () => {
    const lives = pictureLives(reel([1, 2], [12, 13]), ENTRANCE);
    expect(lives[0]?.screenEndS).toBe(12);
    expect(gaps(lives)).toEqual([0]);
  });

  /** The hand-over is to the next picture's arrival, not to its sentence. */
  it('hands over to where the next picture actually arrives', () => {
    const lives = pictureLives(
      [
        { id: 'img1', start: 1, end: 2 },
        { id: 'img2', start: 12, end: 15, nameStartS: 13.5 },
      ],
      ENTRANCE,
    );
    expect(lives[1]?.screenStartS).toBe(13.5);
    expect(lives[0]?.screenEndS).toBe(13.5);
    expect(gaps(lives)).toEqual([0]);
  });

  it('leaves back-to-back pictures alone', () => {
    const lives = pictureLives(reel([1, 3], [3, 5]), ENTRANCE);
    expect(lives[0]?.screenEndS).toBe(3);
    expect(lives[1]?.screenEndS).toBe(5);
  });

  it('ends the only picture in a reel with its own words', () => {
    expect(pictureLives(reel([4, 6]), ENTRANCE)[0]?.screenEndS).toBe(6);
  });

  it('ends the last picture with its own words, however far the reel runs on', () => {
    expect(pictureLives(reel([1, 2], [9, 20]), ENTRANCE)[1]?.screenEndS).toBe(20);
  });

  /** The last picture is the only one whose length the naming word can shorten. */
  it('still gives the last picture its entrance when it arrives late', () => {
    const lives = pictureLives(
      [
        { id: 'img1', start: 1, end: 2 },
        { id: 'img2', start: 9, end: 10, nameStartS: 9.95 },
      ],
      ENTRANCE,
    );
    const last = lives[1] as { screenStartS: number; screenEndS: number };
    expect(last.screenEndS - last.screenStartS).toBeGreaterThanOrEqual(ENTRANCE - 1e-9);
  });

  it('never shortens a picture, whatever the next one does', () => {
    // Windows that overlap cannot come out of planSlots, and the rule holds
    // without depending on that: the words always win.
    const lives = pictureLives(reel([1, 8], [4, 6]), ENTRANCE);
    expect(lives[0]?.screenEndS).toBe(8);
    expect(lives[1]?.screenEndS).toBe(6);
  });

  it('is independent of the order the windows arrive in', () => {
    const forwards = pictureLives(reel([1, 2], [5, 6], [9, 10]), ENTRANCE);
    const shuffled = pictureLives(
      [
        { id: 'img3', start: 9, end: 10 },
        { id: 'img1', start: 1, end: 2 },
        { id: 'img2', start: 5, end: 6 },
      ],
      ENTRANCE,
    );
    for (const life of forwards) {
      expect(shuffled.find((l) => l.id === life.id)?.screenEndS).toBe(life.screenEndS);
    }
  });

  it('holds a picture across every gap in a many-slot reel, and none is missed', () => {
    const windows = reel([0.1, 2.1], [4.3, 7.2], [8.4, 9.4], [11.1, 12.0], [15.0, 17.0]);
    const lives = pictureLives(windows, ENTRANCE);
    expect(gaps(lives).every((g) => g === 0)).toBe(true);
    expect(lives[lives.length - 1]?.screenEndS).toBe(17.0);
  });

  it('leaves no gap when every picture arrives at a naming word', () => {
    const lives = pictureLives(
      [
        { id: 'img1', start: 0.1, end: 2.1, nameStartS: 1.0 },
        { id: 'img2', start: 4.3, end: 7.2, nameStartS: 6.0 },
        { id: 'img3', start: 8.4, end: 9.4, nameStartS: 8.4 },
      ],
      ENTRANCE,
    );
    expect(lives.map((l) => l.screenStartS)).toEqual([1.0, 6.0, 8.4]);
    expect(gaps(lives).every((g) => g === 0)).toBe(true);
  });

  it('yields an empty reel unchanged', () => {
    expect(pictureLives([], ENTRANCE)).toEqual([]);
  });
});
