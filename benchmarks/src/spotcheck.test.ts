import { describe, expect, it } from 'vitest';
import { generateSpotcheckHtml, sampleWordsEvenly } from './spotcheck.js';
import type { TranscribedWord } from './types.js';

function words(count: number, spacingS = 1): TranscribedWord[] {
  return Array.from({ length: count }, (_, i) => ({
    text: `w${i}`,
    startS: i * spacingS,
    endS: i * spacingS + 0.3,
    confidence: null,
  }));
}

describe('sampleWordsEvenly', () => {
  it('returns all words when there are fewer than n', () => {
    const result = sampleWordsEvenly(words(5), 15);
    expect(result).toHaveLength(5);
  });

  it('returns exactly n words spread across the duration', () => {
    const result = sampleWordsEvenly(words(100), 15);
    expect(result).toHaveLength(15);
    // spread: first and last sampled words should be near the range edges
    expect(result[0]?.startS).toBeLessThan(10);
    expect(result[result.length - 1]?.startS).toBeGreaterThan(90);
  });

  it('excludes words with a null timestamp', () => {
    const input: TranscribedWord[] = [
      { text: 'a', startS: 0, endS: 0.3, confidence: null },
      { text: 'b', startS: null, endS: null, confidence: null },
    ];
    expect(sampleWordsEvenly(input, 15)).toHaveLength(1);
  });

  it('never returns duplicate words for a dense sample', () => {
    const result = sampleWordsEvenly(words(20), 15);
    const unique = new Set(result.map((w) => w.text));
    expect(unique.size).toBe(result.length);
  });
});

describe('generateSpotcheckHtml', () => {
  it('embeds the audio path and one row per sampled word', () => {
    const html = generateSpotcheckHtml({ engine: 'scribe', audioPath: 'audio.wav', words: words(15) });
    expect(html).toContain('src="audio.wav"');
    expect((html.match(/onclick="playAt/g) ?? []).length).toBe(15);
  });

  it('is self-contained: no CDN or external network references', () => {
    const html = generateSpotcheckHtml({ engine: 'scribe', audioPath: 'audio.wav', words: words(15) });
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('escapes engine name and word text used in HTML/JS', () => {
    const html = generateSpotcheckHtml({
      engine: 'test<engine>',
      audioPath: 'audio.wav',
      words: [{ text: "o'brien & co", startS: 0, endS: 0.3, confidence: null }],
    });
    expect(html).toContain('test&lt;engine&gt;');
    expect(html).not.toContain('<script>test<engine>');
  });
});
