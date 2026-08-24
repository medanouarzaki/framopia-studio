import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { transcribeHybridCached, transcriptionCacheRef } from './cached.js';
import { evictStaleEntries, MAX_ENTRIES_PER_VIDEO } from './cache.js';
import { fingerprintOf, readGuideVersion } from './fingerprint.js';
import type { HybridTranscript } from './index.js';

const scribeRaw = {
  language_code: 'ary',
  language_probability: 1,
  text: 'joj dial l7loul',
  words: [
    { text: 'joj', type: 'word' as const, start: 0, end: 0.3, logprob: -0.1 },
    { text: 'dial', type: 'word' as const, start: 0.35, end: 0.6, logprob: -0.2 },
    { text: 'l7loul', type: 'word' as const, start: 0.65, end: 1.1, logprob: -0.3 },
  ],
};

function fakeTranscript(): HybridTranscript {
  return {
    words: [
      { text: 'joj', start: 0, end: 0.3, confidence: 0.9 },
      { text: 'dial', start: 0.35, end: 0.6, confidence: 0.8 },
      { text: 'l7loul', start: 0.65, end: 1.1, confidence: 0.7 },
    ],
    draftWords: [],
    promptVersion: 1,
    model: 'gemini-3.1-pro-preview',
    cost: { scribeUsd: 0.0014, geminiUsd: 0.1, totalUsd: 0.1014 },
    wallTimeS: 42,
    drift: { draftCount: 3, correctedCount: 3, absoluteDelta: 0, fraction: 0, exceedsThreshold: false },
    warnings: [],
    scribeRaw,
    correctionRaw: { text: '{"words":[{"text":"joj"}]}', usageMetadata: { candidatesTokenCount: 9 } },
    cached: false,
  };
}

describe('transcription cache', () => {
  let dir: string;
  let cacheRoot: string;
  let audioPath: string;
  let calls: number;

  function options(overrides: Partial<Parameters<typeof transcribeHybridCached>[0]> = {}) {
    return {
      elevenLabsApiKey: 'sk_test',
      googleApiKey: 'AQ.test',
      audioPath,
      durationS: 1.1,
      videoSha256: 'f'.repeat(64),
      cacheRoot,
      log: () => {},
      runHybrid: async () => {
        calls += 1;
        return fakeTranscript();
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'framopia-cache-'));
    cacheRoot = path.join(dir, 'cache');
    audioPath = path.join(dir, 'reel.wav');
    writeFileSync(audioPath, 'not really audio');
    calls = 0;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('misses on an empty cache and calls the pipeline', async () => {
    const result = await transcribeHybridCached(options());
    expect(calls).toBe(1);
    expect(result.transcript.cached).toBe(false);
    expect(existsSync(path.join(result.cacheDir, 'manifest.json'))).toBe(true);
    expect(existsSync(path.join(result.cacheDir, 'audio.wav'))).toBe(true);
  });

  it('hits on the second identical run without calling the pipeline', async () => {
    const first = await transcribeHybridCached(options());
    const second = await transcribeHybridCached(options());
    expect(calls).toBe(1);
    expect(second.transcript.cached).toBe(true);
    expect(second.fingerprint).toBe(first.fingerprint);
    expect(second.transcript.words.map((w) => w.text)).toEqual(
      first.transcript.words.map((w) => w.text),
    );
    expect(second.transcript.cost).toEqual(first.transcript.cost);
  });

  it('keys on the video hash, so a different video misses', async () => {
    await transcribeHybridCached(options());
    await transcribeHybridCached(options({ videoSha256: 'a'.repeat(64) }));
    expect(calls).toBe(2);
  });

  it('keys on keyterms', async () => {
    await transcribeHybridCached(options());
    await transcribeHybridCached(options({ keyterms: ['Vitasilk'] }));
    expect(calls).toBe(2);
  });

  it('is insensitive to keyterm order', async () => {
    await transcribeHybridCached(options({ keyterms: ['a', 'b'] }));
    await transcribeHybridCached(options({ keyterms: ['b', 'a'] }));
    expect(calls).toBe(1);
  });

  it('keys on the orthography guide version', async () => {
    const guideA = path.join(dir, 'a.md');
    const guideB = path.join(dir, 'b.md');
    writeFileSync(guideA, '# Guide (v1.0.4)\n');
    writeFileSync(guideB, '# Guide (v1.0.5)\n');
    await transcribeHybridCached(options({ guidePath: guideA }));
    await transcribeHybridCached(options({ guidePath: guideB }));
    expect(calls).toBe(2);
  });

  it('falls back to hashing a guide with no parseable version', async () => {
    const guide = path.join(dir, 'noversion.md');
    writeFileSync(guide, '# Guide with no version header\n');
    const first = await readGuideVersion(guide);
    expect(first.startsWith('sha256:')).toBe(true);
    writeFileSync(guide, '# Guide with no version header, edited\n');
    expect(await readGuideVersion(guide)).not.toBe(first);
  });

  it('changes fingerprint when any single component changes', async () => {
    const base = {
      promptVersion: 1 as const,
      geminiModel: 'gemini-3.1-pro-preview',
      guideVersion: '1.0.5',
      scribeModel: 'scribe_v2',
      keyterms: [],
    };
    const baseline = fingerprintOf(base);
    expect(fingerprintOf({ ...base, promptVersion: 2 })).not.toBe(baseline);
    expect(fingerprintOf({ ...base, geminiModel: 'other' })).not.toBe(baseline);
    expect(fingerprintOf({ ...base, guideVersion: '1.0.4' })).not.toBe(baseline);
    expect(fingerprintOf({ ...base, scribeModel: 'scribe_v1' })).not.toBe(baseline);
    expect(fingerprintOf({ ...base, keyterms: ['x'] })).not.toBe(baseline);
    expect(fingerprintOf({ ...base })).toBe(baseline);
  });

  it('bypass forces a call and repopulates the entry', async () => {
    await transcribeHybridCached(options());
    expect(calls).toBe(1);
    const bypassed = await transcribeHybridCached(options({ bypassCache: true }));
    expect(calls).toBe(2);
    expect(bypassed.transcript.cached).toBe(false);
    // The entry it skipped is written again, so the next plain run hits.
    await transcribeHybridCached(options());
    expect(calls).toBe(2);
  });

  it('treats an unparseable manifest as a miss with a warning', async () => {
    const first = await transcribeHybridCached(options());
    writeFileSync(path.join(first.cacheDir, 'manifest.json'), '{ not json');
    const logged: string[] = [];
    const second = await transcribeHybridCached(options({ log: (m) => logged.push(m) }));
    expect(calls).toBe(2);
    expect(second.transcript.cached).toBe(false);
    expect(logged.join('\n')).toContain('not valid JSON');
    expect(second.transcript.warnings.some((w) => w.cause.includes('not valid JSON'))).toBe(true);
  });

  it('treats an incomplete manifest as a miss', async () => {
    const first = await transcribeHybridCached(options());
    writeFileSync(path.join(first.cacheDir, 'manifest.json'), JSON.stringify({ durationS: 1.1 }));
    const second = await transcribeHybridCached(options());
    expect(calls).toBe(2);
    expect(second.transcript.cached).toBe(false);
  });

  it('treats a lost audio file as a miss', async () => {
    const first = await transcribeHybridCached(options());
    rmSync(path.join(first.cacheDir, 'audio.wav'));
    const logged: string[] = [];
    await transcribeHybridCached(options({ log: (m) => logged.push(m) }));
    expect(calls).toBe(2);
    expect(logged.join('\n')).toContain('lost its audio');
  });

  it('stores the raw artifacts §6 names', async () => {
    const result = await transcribeHybridCached(options());
    const manifest = JSON.parse(
      readFileSync(path.join(result.cacheDir, 'manifest.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(manifest.scribeRaw).toBeDefined();
    expect(manifest.correctionRaw).toBeDefined();
    expect(manifest.correctedTexts).toEqual(['joj', 'dial', 'l7loul']);
  });

  it('puts the entry under the video hash and a stage-fingerprint directory', async () => {
    const { ref } = await transcriptionCacheRef({ videoSha256: 'f'.repeat(64), cacheRoot });
    expect(ref.dir).toBe(
      path.join(cacheRoot, 'f'.repeat(64), `transcription-${ref.fingerprint}`),
    );
  });

  it('creates the cache tree on demand', async () => {
    const nested = path.join(dir, 'deep', 'cache');
    expect(existsSync(nested)).toBe(false);
    await transcribeHybridCached(options({ cacheRoot: nested }));
    expect(existsSync(nested)).toBe(true);
  });

  it('does not reuse an entry written under a different fingerprint', async () => {
    const first = await transcribeHybridCached(options());
    const otherDir = path.join(cacheRoot, 'f'.repeat(64), 'transcription-deadbeefdeadbeef');
    mkdirSync(otherDir, { recursive: true });
    writeFileSync(path.join(otherDir, 'manifest.json'), readFileSync(path.join(first.cacheDir, 'manifest.json')));
    await transcribeHybridCached(options({ keyterms: ['x'] }));
    expect(calls).toBe(2);
  });
});

describe('cache eviction', () => {
  let dir: string;
  let cacheRoot: string;
  let audioPath: string;

  function options(keyterms: string[]) {
    return {
      elevenLabsApiKey: 'sk_test',
      googleApiKey: 'AQ.test',
      audioPath,
      durationS: 1.1,
      videoSha256: 'f'.repeat(64),
      keyterms,
      cacheRoot,
      log: () => {},
      runHybrid: async () => fakeTranscript(),
    };
  }

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'framopia-evict-'));
    cacheRoot = path.join(dir, 'cache');
    audioPath = path.join(dir, 'reel.wav');
    writeFileSync(audioPath, 'not really audio');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('keeps the bound and drops the oldest beyond it', async () => {
    const dirs: string[] = [];
    for (let i = 0; i < MAX_ENTRIES_PER_VIDEO + 2; i += 1) {
      const result = await transcribeHybridCached(options([`term-${i}`]));
      dirs.push(result.cacheDir);
      // Distinct manifest mtimes, so "most recent" is well defined.
      await new Promise((resolve) => setTimeout(resolve, 12));
    }

    const videoDir = path.join(cacheRoot, 'f'.repeat(64));
    const remaining = readdirSync(videoDir);
    expect(remaining).toHaveLength(MAX_ENTRIES_PER_VIDEO);

    // The survivors are the most recently written ones.
    for (const kept of dirs.slice(-MAX_ENTRIES_PER_VIDEO)) {
      expect(remaining).toContain(path.basename(kept));
    }
    for (const dropped of dirs.slice(0, dirs.length - MAX_ENTRIES_PER_VIDEO)) {
      expect(existsSync(dropped)).toBe(false);
    }
  });

  it('leaves other videos alone', async () => {
    await transcribeHybridCached(options(['a']));
    const other = { ...options(['a']), videoSha256: 'b'.repeat(64) };
    const kept = await transcribeHybridCached(other);
    for (let i = 0; i < MAX_ENTRIES_PER_VIDEO + 2; i += 1) {
      await transcribeHybridCached(options([`churn-${i}`]));
    }
    expect(existsSync(kept.cacheDir)).toBe(true);
    expect(readdirSync(path.join(cacheRoot, 'b'.repeat(64)))).toHaveLength(1);
  });

  it('does nothing for a video hash that has no entries', async () => {
    expect(await evictStaleEntries('d'.repeat(64), cacheRoot)).toEqual([]);
  });

  it('never removes a directory with no manifest', async () => {
    await transcribeHybridCached(options(['a']));
    const stray = path.join(cacheRoot, 'f'.repeat(64), 'not-an-entry');
    mkdirSync(stray, { recursive: true });
    writeFileSync(path.join(stray, 'something.txt'), 'user data');
    for (let i = 0; i < MAX_ENTRIES_PER_VIDEO + 2; i += 1) {
      await transcribeHybridCached(options([`churn-${i}`]));
    }
    expect(existsSync(stray)).toBe(true);
  });
});
