import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findLatestRunPerReel, scoreEngine } from './aggregate.js';
import type { GroundTruth, TranscriptionResult } from './types.js';

describe('findLatestRunPerReel', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'framopia-agg-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('keeps the newest run for a reel that was benchmarked twice', () => {
    const runs: [string, string][] = [
      ['2026-01-01', 'test-1'],
      ['2026-01-02', 'test-1'],
      ['2026-01-03', 'test-2'],
    ];
    for (const [dir, reel] of runs) {
      mkdirSync(path.join(root, dir));
      writeFileSync(path.join(root, dir, 'report.md'), `Audio: \`/x/${reel}.wav\``, 'utf8');
    }

    const found = findLatestRunPerReel(root);
    expect(found.get('test-1')).toBe(path.join(root, '2026-01-02'));
    expect(found.get('test-2')).toBe(path.join(root, '2026-01-03'));
  });
});

describe('scoreEngine', () => {
  const groundTruth: GroundTruth = {
    words: [
      { text: 'joj', lang: 'darija', script: 'latin' },
      { text: 'dial', lang: 'darija', script: 'latin' },
      { text: 'la', lang: 'fr', script: 'latin' },
      { text: 'vidéo', lang: 'fr', script: 'latin' },
    ],
  };

  const result = (words: string[]): TranscriptionResult => ({
    engine: 'gemini',
    words: words.map((text, i) => ({ text, startS: i, endS: i + 0.5, confidence: null })),
    rawResponsePath: '',
    costUsd: 0.1,
    wallTimeS: 1,
  });

  it('scores a perfect hypothesis at zero WER on every subset', () => {
    const scores = scoreEngine(result(['joj', 'dial', 'la', 'vidéo']), groundTruth, undefined);
    expect(scores.overall.wer).toBe(0);
    expect(scores.darija.wer).toBe(0);
    expect(scores.codeSwitched.wer).toBe(0);
  });

  it('charges a french miss to the code-switched subset, not the darija one', () => {
    const scores = scoreEngine(result(['joj', 'dial', 'la', 'video']), groundTruth, undefined);
    expect(scores.darija.wer).toBe(0);
    expect(scores.codeSwitched.wer).toBeGreaterThan(0);
  });
});
