import { describe, expect, it } from 'vitest';
import { editDistance, scoreOrthography } from './orthography.js';

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
