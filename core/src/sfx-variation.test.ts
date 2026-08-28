import { describe, expect, it } from 'vitest';
import { selectSfx, MIN_SFX_SPACING_S, SFX_VARIATION_WINDOW_S } from './sfx-variation.js';

const HITS = ['hit_01', 'hit_02'];
const alternatives = (id: string): string[] => (id.startsWith('hit') ? HITS : ['whoosh_01']);
const hit = (elementId: string, startS: number) => ({
  elementId,
  startS,
  sfxId: 'hit_01',
  droppable: true,
});

describe('which sound fires, and whether', () => {
  /* vitasilk's three keywords, which the user heard as mechanical. */
  it('thins the run the user complained about and varies what is left', () => {
    const { kept, dropped } = selectSfx(
      [hit('k003', 3.77), hit('k001', 5.339), hit('k002', 6.598)],
      alternatives,
    );
    expect(kept.map((k) => k.elementId)).toEqual(['k003', 'k001']);
    expect(kept.map((k) => k.chosenSfxId)).toEqual(['hit_01', 'hit_02']);
    expect(dropped.map((d) => d.elementId)).toEqual(['k002']);
  });

  it('measures consecutiveness in time, not in plan order', () => {
    // vitasilk stores its keywords k001, k002, k003 while they play k003 first.
    const { kept } = selectSfx(
      [hit('k001', 5.339), hit('k002', 6.598), hit('k003', 3.77)],
      alternatives,
    );
    expect(kept.map((k) => k.elementId)).toEqual(['k003', 'k001']);
  });

  it('leaves a well-spaced pair on the file its template binds', () => {
    const { kept, dropped } = selectSfx([hit('k001', 0), hit('k002', 4.071)], alternatives);
    expect(dropped).toEqual([]);
    expect(kept.map((k) => k.chosenSfxId)).toEqual(['hit_01', 'hit_01']);
  });

  it('varies inside the window and stops varying outside it', () => {
    const inside = selectSfx(
      [hit('a', 0), hit('b', SFX_VARIATION_WINDOW_S - 0.1)],
      alternatives,
    );
    expect(inside.kept[1]?.chosenSfxId).toBe('hit_02');
    const outside = selectSfx(
      [hit('a', 0), hit('b', SFX_VARIATION_WINDOW_S + 0.1)],
      alternatives,
    );
    expect(outside.kept[1]?.chosenSfxId).toBe('hit_01');
  });

  it('cycles rather than alternating once, so four in a run never repeat', () => {
    const run = [hit('a', 0), hit('b', 1.6), hit('c', 3.2), hit('d', 4.8)];
    const { kept } = selectSfx(run, alternatives);
    expect(kept).toHaveLength(4);
    for (let i = 1; i < kept.length; i += 1) {
      expect(kept[i]?.chosenSfxId).not.toBe(kept[i - 1]?.chosenSfxId);
    }
  });

  it('is a no-op for a kind with one file', () => {
    const { kept } = selectSfx(
      [
        { elementId: 'img001', startS: 0, sfxId: 'whoosh_01', droppable: false },
        { elementId: 'img002', startS: 0.4, sfxId: 'whoosh_01', droppable: false },
      ],
      alternatives,
    );
    expect(kept.map((k) => k.chosenSfxId)).toEqual(['whoosh_01', 'whoosh_01']);
  });

  /* Every image gets a sound, so an image is never the one thinned out. */
  it('never drops a sound that may not be dropped', () => {
    const { kept, dropped } = selectSfx(
      [
        { elementId: 'img001', startS: 0, sfxId: 'whoosh_01', droppable: false },
        { elementId: 'img002', startS: 0.1, sfxId: 'whoosh_01', droppable: false },
      ],
      alternatives,
    );
    expect(dropped).toEqual([]);
    expect(kept).toHaveLength(2);
  });

  it('drops strictly under the minimum and keeps exactly on it', () => {
    expect(selectSfx([hit('a', 0), hit('b', MIN_SFX_SPACING_S)], alternatives).dropped)
      .toEqual([]);
    expect(selectSfx([hit('a', 0), hit('b', MIN_SFX_SPACING_S - 0.01)], alternatives).dropped)
      .toHaveLength(1);
  });

  /* A dropped event must not shield the next one from the spacing rule. */
  it('measures the gap from the last sound that actually fired', () => {
    const { kept, dropped } = selectSfx(
      [hit('a', 0), hit('b', 0.5), hit('c', 1.0)],
      alternatives,
    );
    expect(kept.map((k) => k.elementId)).toEqual(['a']);
    expect(dropped.map((d) => d.elementId)).toEqual(['b', 'c']);
  });

  it('is deterministic, so the same plan always builds the same', () => {
    const run = [hit('c', 3.77), hit('a', 5.339), hit('b', 6.598)];
    expect(JSON.stringify(selectSfx(run, alternatives)))
      .toBe(JSON.stringify(selectSfx([...run].reverse(), alternatives)));
  });
});
