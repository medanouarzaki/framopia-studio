import { describe, expect, it } from 'vitest';
import { buildReport } from './report.js';
import type { GroundTruth, TranscriptionResult } from './types.js';

const groundTruth: GroundTruth = {
  words: [
    { text: 'wach', lang: 'darija', script: 'latin' },
    { text: 'nta', lang: 'darija', script: 'latin' },
    { text: 'mzyan', lang: 'darija', script: 'latin' },
  ],
};

function result(engine: string, texts: string[]): TranscriptionResult {
  return {
    engine,
    words: texts.map((text, i) => ({ text, startS: i, endS: i + 0.3, confidence: null })),
    rawResponsePath: `raw/${engine}.json`,
    costUsd: 0.01,
    wallTimeS: 1.2,
  };
}

describe('buildReport — no ground truth', () => {
  it('drops the WER columns but keeps orthography', () => {
    const md = buildReport([result('scribe', ['wach', 'nta', 'mzyan'])], null, {
      title: 'No GT',
      audioPath: 'a.wav',
      groundTruthPath: null,
    });
    expect(md).not.toContain('overall WER');
    expect(md).toContain('orthography');
    expect(md).toContain('| scribe |');
  });
});

describe('buildReport', () => {
  it('includes one row per engine and the report title', () => {
    const md = buildReport(
      [result('scribe', ['wach', 'nta', 'mzyan']), result('gemini', ['wach', 'nta', 'mzyan'])],
      groundTruth,
      { title: 'Test report', audioPath: 'a.wav', groundTruthPath: 'gt.json' },
    );
    expect(md).toContain('Test report');
    expect(md).toContain('| scribe |');
    expect(md).toContain('| gemini |');
  });

  it('shows 0% overall WER for a perfect hypothesis', () => {
    const md = buildReport([result('scribe', ['wach', 'nta', 'mzyan'])], groundTruth, {
      title: 't',
      audioPath: 'a.wav',
      groundTruthPath: 'gt.json',
    });
    expect(md).toMatch(/\| scribe \| 0\.0% \|/);
  });

  it('marks code-switched WER as n/a when the ground truth has no fr/en words', () => {
    const md = buildReport([result('scribe', ['wach', 'nta', 'mzyan'])], groundTruth, {
      title: 't',
      audioPath: 'a.wav',
      groundTruthPath: 'gt.json',
    });
    expect(md).toContain('n/a (no matching GT words)');
  });

  it('shows a deviation dash for scribe against itself and a value for other engines', () => {
    const md = buildReport(
      [result('scribe', ['wach', 'nta', 'mzyan']), result('whisper', ['wach', 'nta', 'mzyan'])],
      groundTruth,
      { title: 't', audioPath: 'a.wav', groundTruthPath: 'gt.json' },
    );
    const lines = md.split('\n');
    const scribeLine = lines.find((l) => l.startsWith('| scribe |'));
    const whisperLine = lines.find((l) => l.startsWith('| whisper |'));
    expect(scribeLine).toContain('—');
    expect(whisperLine).toMatch(/\dms \/ \dms/);
  });
});
