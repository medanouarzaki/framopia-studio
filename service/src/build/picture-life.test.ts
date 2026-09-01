import { describe, expect, it } from 'vitest';
import { pictureLives, type Handover, type PictureWindow } from './picture-life.js';

/**
 * **The handover, over reel shapes rather than over reels.**
 *
 * The user's ruling of 1 September: *"The images shouldn't cut off. After each
 * image appears, it should stay until the next one appears. They should be
 * consecutive. There is no void between them, layer after layer."*
 *
 * Every case here is arithmetic over windows invented in the test. Nothing
 * reads the disk, runs a model or opens a socket, so no reel's numbers can
 * leak into the rule and there is nothing for a request to leave through.
 */

const CUT: Handover = { kind: 'cut' };
const DISSOLVE: Handover = { kind: 'dissolve', crossFadeS: 0.4 };
const WORDS: Handover = { kind: 'words' };

function reel(...spans: [number, number][]): PictureWindow[] {
  return spans.map(([start, end], i) => ({ id: `img${i + 1}`, start, end }));
}

/** No moment between the first picture's arrival and the last one's departure is uncovered. */
function gaps(lives: { start: number; screenEndS: number }[]): number[] {
  const order = lives.slice().sort((a, b) => a.start - b.start);
  return order.slice(0, -1).map((l, i) => (order[i + 1] as { start: number }).start - l.screenEndS);
}

describe('pictureLives', () => {
  it('leaves no void between two pictures far apart', () => {
    const lives = pictureLives(reel([1, 2], [12, 13]), CUT);
    expect(lives[0]?.screenEndS).toBe(12);
    expect(gaps(lives)).toEqual([0]);
  });

  it('overlaps by exactly the authored entrance under a dissolve', () => {
    const lives = pictureLives(reel([1, 2], [12, 13]), DISSOLVE);
    expect(lives[0]?.screenEndS).toBeCloseTo(12.4, 9);
    // Negative gap: the outgoing picture is still there while the next fades up.
    expect(gaps(lives)[0]).toBeCloseTo(-0.4, 9);
  });

  it('leaves back-to-back pictures alone', () => {
    const lives = pictureLives(reel([1, 3], [3, 5]), CUT);
    expect(lives[0]?.screenEndS).toBe(3);
    expect(lives[1]?.screenEndS).toBe(5);
  });

  it('ends the only picture in a reel with its own words', () => {
    expect(pictureLives(reel([4, 6]), CUT)[0]?.screenEndS).toBe(6);
    expect(pictureLives(reel([4, 6]), DISSOLVE)[0]?.screenEndS).toBe(6);
  });

  it('ends the last picture with its own words, however far the reel runs on', () => {
    const lives = pictureLives(reel([1, 2], [9, 20]), CUT);
    expect(lives[1]?.screenEndS).toBe(20);
  });

  it('never shortens a picture, whatever the next one does', () => {
    // Windows that overlap cannot come out of planSlots, and the rule holds
    // without depending on that: the words always win.
    const lives = pictureLives(reel([1, 8], [4, 6]), CUT);
    expect(lives[0]?.screenEndS).toBe(8);
    expect(lives[1]?.screenEndS).toBe(6);
  });

  it('changes nothing at all when no handover is asked for', () => {
    const windows = reel([1, 2], [12, 13], [20, 25]);
    for (const [i, life] of pictureLives(windows, WORDS).entries()) {
      expect(life.screenEndS).toBe(windows[i]?.end);
    }
  });

  it('is independent of the order the windows arrive in', () => {
    const forwards = pictureLives(reel([1, 2], [5, 6], [9, 10]), CUT);
    const shuffled = pictureLives(
      [
        { id: 'img3', start: 9, end: 10 },
        { id: 'img1', start: 1, end: 2 },
        { id: 'img2', start: 5, end: 6 },
      ],
      CUT,
    );
    for (const life of forwards) {
      expect(shuffled.find((l) => l.id === life.id)?.screenEndS).toBe(life.screenEndS);
    }
  });

  it('holds a picture across every gap in a many-slot reel, and none is missed', () => {
    const windows = reel([0.1, 2.1], [4.3, 7.2], [8.4, 9.4], [11.1, 12.0], [15.0, 17.0]);
    const lives = pictureLives(windows, CUT);
    expect(gaps(lives).every((g) => g === 0)).toBe(true);
    expect(lives[lives.length - 1]?.screenEndS).toBe(17.0);
  });

  it('yields an empty reel unchanged', () => {
    expect(pictureLives([], CUT)).toEqual([]);
  });
});
