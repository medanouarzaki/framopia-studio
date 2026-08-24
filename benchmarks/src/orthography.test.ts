import { describe, expect, it } from 'vitest';
import { editDistance, findFreezeListConformance, scoreOrthography } from './orthography.js';

describe('editDistance', () => {
  it('is zero for identical strings', () => {
    expect(editDistance('bzaf', 'bzaf')).toBe(0);
  });

  it('is one for a single substitution', () => {
    expect(editDistance('bzzaf', 'bzaf')).toBe(1);
  });
});

describe('scoreOrthography — digit substitutions', () => {
  it('flags "5dma" for the banned 5-for-kh substitution', () => {
    const report = scoreOrthography(['5dma']);
    expect(report.digitSubstitutions.count).toBe(1);
    expect(report.digitSubstitutions.examples[0]?.word).toBe('5dma');
  });

  it('does not flag "khdma", the correct spelling', () => {
    const report = scoreOrthography(['khdma']);
    expect(report.digitSubstitutions.count).toBe(0);
  });

  it('does not flag 3/7/9, which are legitimate Arabizi letters', () => {
    const report = scoreOrthography(['3lach', '7ta', 'kan9olo']);
    expect(report.digitSubstitutions.count).toBe(0);
  });

  it('flags "2ndi" for the banned 2-for-hamza substitution', () => {
    const report = scoreOrthography(['2ndi']);
    expect(report.digitSubstitutions.count).toBe(1);
  });
});

describe('scoreOrthography — sh digraph', () => {
  it('flags words containing "sh" for review', () => {
    const report = scoreOrthography(['shno']);
    expect(report.shDigraph.count).toBe(1);
  });

  it('does not flag the correct "ch" spelling', () => {
    const report = scoreOrthography(['chno']);
    expect(report.shDigraph.count).toBe(0);
  });
});

describe('scoreOrthography — freeze list', () => {
  it('treats an exact frozen spelling as conformant', () => {
    const report = scoreOrthography(['bzaf']);
    expect(report.freezeList.totalOccurrences).toBe(1);
    expect(report.freezeList.conformant).toBe(1);
    expect(report.freezeList.nearMiss).toBe(0);
  });

  it('flags "bzzaf" as a near miss of frozen "bzaf"', () => {
    const report = scoreOrthography(['bzzaf']);
    expect(report.freezeList.totalOccurrences).toBe(1);
    expect(report.freezeList.nearMiss).toBe(1);
    expect(report.freezeList.examples[0]?.detail).toContain('bzaf');
  });

  it('does not match unrelated words against the freeze list', () => {
    const report = scoreOrthography(['salut']);
    expect(report.freezeList.totalOccurrences).toBe(0);
  });
});

describe('scoreOrthography — composite score', () => {
  it('is 1 for a clean transcript', () => {
    const report = scoreOrthography(['wach', 'nta', 'mzyan']);
    expect(report.score).toBe(1);
  });

  it('is 1 for an empty transcript', () => {
    expect(scoreOrthography([]).score).toBe(1);
  });

  it('drops below 1 when violations are present', () => {
    const report = scoreOrthography(['5dma', 'shno', 'bezzaf']);
    expect(report.score).toBeLessThan(1);
  });
});

describe('scoreOrthography — arabic script', () => {
  it('counts arabic-script words, which these latin rules cannot judge', () => {
    const report = scoreOrthography(['عندك', 'les', 'chno']);
    expect(report.arabicScriptWords).toBe(1);
  });
});

describe('freeze-list near-miss matching', () => {
  it('never reports an exact freeze-list hit as a near-miss of a neighbour', () => {
    // "bach" and "wach" are one edit apart and are different words. With both
    // on the list, an exact hit must win outright.
    const report = findFreezeListConformance(['bach', 'wach'], ['wach', 'bach']);
    expect(report.nearMiss).toBe(0);
    expect(report.conformant).toBe(2);
    expect(report.examples).toEqual([]);
  });

  it('applies the same precedence to frozen spellings that sit one edit apart', () => {
    const report = findFreezeListConformance(['dial', 'diali', 'kayn', 'kayna']);
    expect(report.nearMiss).toBe(0);
    expect(report.conformant).toBe(4);
  });

  it('still flags a genuine misspelling of a frozen word', () => {
    const report = findFreezeListConformance(['bzzaf'], ['bzaf']);
    expect(report.nearMiss).toBe(1);
    expect(report.examples[0]?.detail).toContain('bzaf');
  });

  // "bach" is not on the freeze list, so the exact-match rule cannot reach it
  // and it is still reported as a near-miss of "wach". Adding it to
  // freeze-list.json is a pending user decision plus a guide version bump;
  // this test pins today's behaviour so that decision is visible rather than
  // silently assumed. See reports/block-2-session-2.md.
  it('still flags bach against the real freeze list, which does not contain it', () => {
    const report = findFreezeListConformance(['bach']);
    expect(report.nearMiss).toBe(1);
    expect(report.examples[0]).toEqual({
      word: 'bach',
      detail: 'near "wach" (edit distance 1)',
    });
  });

  it('leaves words under four characters out of the matcher entirely', () => {
    const report = findFreezeListConformance(['nta']);
    expect(report.totalOccurrences).toBe(0);
  });
});
