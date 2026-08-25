import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ClientMode } from '@framopia/core';
import { analyseKeywordsCached, analysisCacheRef } from './cached.js';
import { analysisFingerprintInputs, analysisFingerprintOf, hashTranscript } from './fingerprint.js';
import type { KeywordAnalysisResult } from './keywords.js';
import type { AnalysisWord, KeywordMode } from './types.js';

const words: AnalysisWord[] = [
  { id: 'w0', text: 'bghiti', start: 0, end: 0.4, removed: false },
  { id: 'w1', text: 'chd', start: 0.4, end: 0.9, removed: false },
  { id: 'w2', text: 'euh', start: 0.9, end: 1.0, removed: true },
  { id: 'w3', text: 'lkolajin', start: 1.0, end: 1.8, removed: false },
];

const mode = (overrides: Partial<ClientMode> = {}): ClientMode =>
  ({
    id: 'k2-syndicalia',
    name: 'K2 Syndicalia',
    version: 2,
    palette: { background: '#1A0000', primary: '#820000', accent: '#C9A96E', light: '#F8F6F2' },
    fonts: { status: 'tbd', note: 'n' },
    imageStyle: { stylePrompt: ['s'], negativePrompt: ['n'] },
    imageVariation: { note: 'n', axes: { crop: ['wide', 'close'] } },
    allowedTemplates: { subtitle: ['sub_pop'], keyword: ['kw_slam'], image: ['img_float'] },
    vocabulary: [],
    ...overrides,
  }) satisfies ClientMode;

describe('the analysis fingerprint', () => {
  const inputs = (o: Partial<Parameters<typeof analysisFingerprintInputs>[0]> = {}) =>
    analysisFingerprintInputs({ mode: mode(), words, candidateCount: 9, ...o });

  it('is stable for identical inputs', () => {
    expect(analysisFingerprintOf(inputs())).toBe(analysisFingerprintOf(inputs()));
  });

  it('invalidates on an analysis prompt version bump', () => {
    expect(analysisFingerprintOf(inputs({ promptVersion: 1 }))).not.toBe(
      analysisFingerprintOf(inputs({ promptVersion: 2 })),
    );
  });

  /**
   * Deliberately reversed in Block 4 session 4. Keying on `mode.version` meant
   * a variation-axis edit — which the Gemini call never sees — invalidated
   * every entry and billed a full re-analysis. The key is now a content hash
   * of the fields this call actually reads.
   */
  it('survives a mode version bump on its own', () => {
    expect(analysisFingerprintOf(inputs({ mode: mode({ version: 3 }) }))).toBe(
      analysisFingerprintOf(inputs()),
    );
  });

  it('invalidates when a field the prompt reads changes', () => {
    expect(analysisFingerprintOf(inputs({ mode: mode({ name: 'Another Client' }) }))).not.toBe(
      analysisFingerprintOf(inputs()),
    );
    expect(analysisFingerprintOf(inputs({ mode: mode({ vocabulary: ['profhilo'] }) }))).not.toBe(
      analysisFingerprintOf(inputs()),
    );
  });

  it('invalidates on a different mode id', () => {
    expect(analysisFingerprintOf(inputs({ mode: mode({ id: 'other' }) }))).not.toBe(
      analysisFingerprintOf(inputs()),
    );
  });

  it('invalidates when the transcript changes', () => {
    const edited = [...words.slice(0, 3), { ...words[3]!, text: 'lkolagen' }];
    expect(analysisFingerprintOf(inputs({ words: edited }))).not.toBe(
      analysisFingerprintOf(inputs()),
    );
  });

  it('invalidates when a word is removed, because the prompt then differs', () => {
    const cleaned = words.map((w) => (w.id === 'w1' ? { ...w, removed: true } : w));
    expect(hashTranscript(cleaned)).not.toBe(hashTranscript(words));
  });

  it('ignores the timings, which the prompt never shows', () => {
    const shifted = words.map((w) => ({ ...w, start: w.start + 5, end: w.end + 5 }));
    expect(hashTranscript(shifted)).toBe(hashTranscript(words));
  });
});

describe('analyseKeywordsCached', () => {
  let dir: string;
  let calls = 0;

  const response = (): KeywordAnalysisResult => ({
    candidates: [
      { wordIds: ['w3'], text: 'lkolajin', score: 0.9, reason: 'the claim' },
      { wordIds: ['w0'], text: 'bghiti', score: 0.7, reason: 'the ask' },
      { wordIds: ['w1'], text: 'chd', score: 0.5, reason: 'the effect' },
    ],
    rawText: '{"candidates":[]}',
    promptVersion: 1,
    model: 'gemini-test',
    costUsd: 0.01,
    wallTimeS: 1.5,
    usage: {} as KeywordAnalysisResult['usage'],
  });

  const options = (keywordMode: KeywordMode = 'auto', bypassCache = false) => ({
    apiKey: 'unused',
    videoSha256: 'a'.repeat(64),
    durationS: 22,
    words,
    mode: mode(),
    keywordMode,
    bypassCache,
    cacheRoot: dir,
    runAnalysis: async () => {
      calls += 1;
      return Promise.resolve(response());
    },
  });

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'framopia-analysis-'));
    calls = 0;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('calls once, then serves the second run from cache for nothing', async () => {
    const first = await analyseKeywordsCached(options());
    expect(calls).toBe(1);
    expect(first.cached).toBe(false);
    expect(first.costUsd).toBe(0.01);

    const second = await analyseKeywordsCached(options());
    expect(calls).toBe(1);
    expect(second.cached).toBe(true);
    expect(second.costUsd).toBe(0);
  });

  it('gives byte-identical selection on a cache hit', async () => {
    const first = await analyseKeywordsCached(options());
    const second = await analyseKeywordsCached(options());
    expect(JSON.stringify(second.selection)).toBe(JSON.stringify(first.selection));
  });

  it('imposes the duration-derived count, not the candidate count', async () => {
    const result = await analyseKeywordsCached(options());
    // 22s -> 3 keywords, and the model offered three candidates.
    expect(result.selection.requestedCount).toBe(3);
    expect(result.selection.items).toHaveLength(3);
  });

  it('selects identically in auto and propose; only approval differs', async () => {
    const auto = await analyseKeywordsCached(options('auto'));
    const propose = await analyseKeywordsCached(options('propose'));
    expect(propose.selection.items).toEqual(auto.selection.items);
    expect(auto.keywordMode).toBe('auto');
    expect(propose.keywordMode).toBe('propose');
  });

  it('bypass forces a call and still repopulates the entry', async () => {
    await analyseKeywordsCached(options());
    expect(calls).toBe(1);
    const bypassed = await analyseKeywordsCached(options('auto', true));
    expect(calls).toBe(2);
    expect(bypassed.cached).toBe(false);
    await analyseKeywordsCached(options());
    expect(calls).toBe(2);
  });

  // A version bump alone must not bill. A font arriving at Block 9 bumps the
  // mode and reaches no prompt; so did session 3's variation-axis edit.
  it('still hits after a mode version bump', async () => {
    await analyseKeywordsCached(options());
    expect(calls).toBe(1);
    await analyseKeywordsCached({ ...options(), mode: mode({ version: 3 }) });
    expect(calls).toBe(1);
  });

  it('misses when the vocabulary the prompt carries changes', async () => {
    await analyseKeywordsCached(options());
    expect(calls).toBe(1);
    await analyseKeywordsCached({ ...options(), mode: mode({ vocabulary: ['profhilo'] }) });
    expect(calls).toBe(2);
  });

  it('writes its entry under an analysis-prefixed directory', () => {
    const { ref } = analysisCacheRef({
      videoSha256: 'a'.repeat(64),
      mode: mode(),
      words,
      candidateCount: 9,
      cacheRoot: dir,
    });
    expect(path.basename(ref.dir)).toMatch(/^analysis-[0-9a-f]{16}$/);
  });
});
