import { describe, expect, it } from 'vitest';
import {
  convertPlainTextToGroundTruth,
  GroundTruthError,
  parseGroundTruthJson,
} from './ground-truth.js';

describe('parseGroundTruthJson', () => {
  it('parses a valid ground truth document', () => {
    const gt = parseGroundTruthJson(
      JSON.stringify({
        words: [
          { text: 'wach', lang: 'darija', script: 'latin' },
          { text: 'salut', lang: 'fr', script: 'latin' },
        ],
      }),
    );
    expect(gt.words).toHaveLength(2);
    expect(gt.words[0]?.text).toBe('wach');
  });

  it('rejects invalid JSON', () => {
    expect(() => parseGroundTruthJson('not json')).toThrow(GroundTruthError);
  });

  it('rejects a document missing the words array', () => {
    expect(() => parseGroundTruthJson('{}')).toThrow(GroundTruthError);
  });

  it('rejects a word with an unknown lang tag', () => {
    expect(() =>
      parseGroundTruthJson(JSON.stringify({ words: [{ text: 'x', lang: 'es', script: 'latin' }] })),
    ).toThrow(GroundTruthError);
  });
});

describe('convertPlainTextToGroundTruth', () => {
  it('tokenizes lines into darija/latin words by default', () => {
    const gt = convertPlainTextToGroundTruth('wach nta mzyan\nchno had lhal');
    expect(gt.words.map((w) => w.text)).toEqual([
      'wach',
      'nta',
      'mzyan',
      'chno',
      'had',
      'lhal',
    ]);
    expect(gt.words.every((w) => w.lang === 'darija' && w.script === 'latin')).toBe(true);
  });

  it('skips blank lines', () => {
    const gt = convertPlainTextToGroundTruth('wach\n\n  \nchno');
    expect(gt.words.map((w) => w.text)).toEqual(['wach', 'chno']);
  });
});

describe('convertPlainTextToGroundTruth — comments', () => {
  it('ignores the instruction header the ground-truth kit ships with', () => {
    const gt = convertPlainTextToGroundTruth('# how to write this\n# 9 for qaf\nwach nta mzyan\n');
    expect(gt.words.map((w) => w.text)).toEqual(['wach', 'nta', 'mzyan']);
  });
});
