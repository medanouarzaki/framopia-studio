import { describe, expect, it } from 'vitest';
import { chooseBreak, LINE_SEPARATOR } from './wrap.js';

/*
 * Strings taken from the corpus plans, not invented: g027 and g004 from
 * vitasilk, an Arabic pair from test-2, and the single words that are the case
 * the ruling does not cover.
 */
describe('chooseBreak', () => {
  it('breaks a two-word card at its space', () => {
    const b = chooseBreak('dernière génération');
    expect(b.lines).toEqual(['dernière', 'génération']);
    expect(b.twoLines).toBe(`dernière${LINE_SEPARATOR}génération`);
    expect(b.reason).toBeNull();
  });

  it('breaks an Arabic pair the same way, without inspecting the script', () => {
    const b = chooseBreak('ترطيب عميق');
    expect(b.lines).toEqual(['ترطيب', 'عميق']);
  });

  it('refuses to break a single word and says why', () => {
    const b = chooseBreak('matrddadich');
    expect(b.twoLines).toBeNull();
    expect(b.lines).toEqual(['matrddadich']);
    expect(b.reason).toMatch(/single word/);
  });

  it('never produces more than two lines', () => {
    for (const t of ['a b', 'a b c', 'a b c d', 'one', 'ترطيب عميق للبشرة']) {
      expect(chooseBreak(t).lines.length).toBeLessThanOrEqual(2);
      const two = chooseBreak(t).twoLines;
      if (two !== null) expect(two.split(LINE_SEPARATOR).length).toBe(2);
    }
  });

  it('balances a longer string at the space nearest the middle', () => {
    expect(chooseBreak('ترطيب عميق للبشرة').lines).toEqual(['ترطيب عميق', 'للبشرة']);
  });

  it('is unbothered by padding and repeated spaces', () => {
    expect(chooseBreak('  filler   glow ').lines).toEqual(['filler', 'glow']);
    expect(chooseBreak('  filler   glow ').oneLine).toBe('filler   glow');
  });

  it('keeps every word, in order', () => {
    for (const t of ['dernière génération', 'a b c d e']) {
      expect(chooseBreak(t).lines.join(' ').split(/\s+/)).toEqual(t.trim().split(/\s+/));
    }
  });
});
