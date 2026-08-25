import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createJob, getJob, UnknownJobTypeError } from '../jobs.js';
import { transcribeVideo, TRANSCRIBE_JOB_TYPE } from './job.js';
import { transcribeHybridCached } from './cached.js';
import { mapScribeResponse, type ScribeRawResponse } from './scribe.js';
import { parseCorrectionResponseText } from './correction.js';
import { alignCorrectedOntoDraft } from './align.js';
import { validateEditPlan } from '../editplan/index.js';
import type { HybridTranscript } from './hybrid.js';

const FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'fixtures',
);

function fixtures(): { scribeRaw: ScribeRawResponse; correctionRaw: { text: string } } {
  return {
    scribeRaw: JSON.parse(
      readFileSync(path.join(FIXTURES_DIR, 'scribe-response.json'), 'utf8'),
    ) as ScribeRawResponse,
    correctionRaw: JSON.parse(
      readFileSync(path.join(FIXTURES_DIR, 'correction-response.json'), 'utf8'),
    ) as { text: string },
  };
}

/** The recorded vitasilk opening, assembled the way transcribeHybrid would. */
function fixtureTranscript(): HybridTranscript {
  const { scribeRaw, correctionRaw } = fixtures();
  const draftWords = mapScribeResponse(scribeRaw);
  const correctedTexts = parseCorrectionResponseText(correctionRaw.text);
  return {
    words: alignCorrectedOntoDraft(draftWords, correctedTexts),
    draftWords,
    promptVersion: 1,
    model: 'gemini-3.1-pro-preview',
    cost: { scribeUsd: 0.00157, geminiUsd: 0.0756, totalUsd: 0.07717 },
    wallTimeS: 84.8,
    drift: {
      draftCount: draftWords.length,
      correctedCount: correctedTexts.length,
      absoluteDelta: Math.abs(correctedTexts.length - draftWords.length),
      fraction: Math.abs(correctedTexts.length - draftWords.length) / draftWords.length,
      exceedsThreshold: false,
    },
    warnings: [],
    scribeRaw,
    correctionRaw: { text: correctionRaw.text, usageMetadata: {} },
    cached: false,
  };
}

describe('transcribeVideo — composition', () => {
  let dir: string;
  let videoPath: string;
  let audioPath: string;
  let cacheRoot: string;

  function options(overrides: Record<string, unknown> = {}) {
    return {
      videoPath,
      cacheRoot,
      log: () => {},
      now: () => '2026-08-25T00:00:00.000Z',
      audioDir: dir,
      media: {
        hashFile: async () => 'c'.repeat(64),
        probeVideo: async () => ({ durationS: 25.692333, fps: 29.97, width: 2160, height: 3840 }),
        extractAudio: async () => audioPath,
      },
      runTranscription: (async (opts: Parameters<typeof transcribeHybridCached>[0]) =>
        transcribeHybridCached({
          ...opts,
          runHybrid: async () => fixtureTranscript(),
        })) as typeof transcribeHybridCached,
      ...overrides,
    };
  }

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'framopia-job-'));
    videoPath = path.join(dir, 'vitasilk.mov');
    audioPath = path.join(dir, 'vitasilk.wav');
    cacheRoot = path.join(dir, 'cache');
    writeFileSync(videoPath, 'not really a video');
    writeFileSync(audioPath, 'not really audio');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes a validated edit plan beside the video', async () => {
    const result = await transcribeVideo(options());
    expect(result.planPath).toBe(path.join(dir, 'vitasilk.editplan.json'));
    expect(validateEditPlan(result.plan)).toEqual([]);
    const onDisk = JSON.parse(readFileSync(result.planPath, 'utf8')) as unknown;
    expect(validateEditPlan(onDisk)).toEqual([]);
  });

  it('fills source from the probe and the hash', async () => {
    const { plan } = await transcribeVideo(options());
    expect(plan.source).toEqual({
      videoPath,
      sha256: 'c'.repeat(64),
      durationS: 25.692333,
      fps: 29.97,
      width: 2160,
      height: 3840,
      audioPath,
    });
    expect(plan.meta.appVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('records the transcription stage with its cost', async () => {
    const { plan } = await transcribeVideo(options());
    expect(plan.pipeline.transcription).toMatchObject({
      status: 'done',
      config: 'hybrid-prompt-v1',
      cached: false,
      costUsd: 0.07717,
    });
    expect(plan.costs.byStage.transcription).toBe(0.07717);
  });

  it('carries the real transcript through tagging and grouping', async () => {
    const { plan } = await transcribeVideo(options());
    expect(plan.transcript.words).toHaveLength(10);
    expect(plan.transcript.words.map((w) => w.text).join(' ')).toContain('minutes');
    // No stage reports language yet, and script is read off the characters.
    expect(plan.transcript.words.every((w) => w.lang === null)).toBe(true);
    expect(plan.transcript.words.every((w) => w.script === 'latin')).toBe(true);
    for (const group of plan.subtitles.groups) {
      expect(group.wordIds.length).toBeGreaterThanOrEqual(1);
      expect(group.wordIds.length).toBeLessThanOrEqual(2);
    }
  });

  it('keeps every word, and never groups a removed one', async () => {
    const { plan } = await transcribeVideo(options());
    const ids = new Set(plan.transcript.words.map((w) => w.id));
    const grouped = plan.subtitles.groups.flatMap((g) => g.wordIds);
    for (const id of grouped) expect(ids.has(id)).toBe(true);
    const removed = plan.transcript.words.filter((w) => w.removed).map((w) => w.id);
    for (const id of removed) expect(grouped).not.toContain(id);
    expect(plan.transcript.words.length).toBeGreaterThanOrEqual(grouped.length);
  });

  it('leaves the later stages empty', async () => {
    const { plan } = await transcribeVideo(options());
    expect(plan.keywords.items).toEqual([]);
    expect(plan.images.slots).toEqual([]);
    expect(plan.zones.zones).toEqual([]);
    expect(plan.sfx.events).toEqual([]);
    expect(plan.build.status).toBe('none');
    for (const stage of ['analysis', 'images', 'zones', 'build'] as const) {
      expect(plan.pipeline[stage].status).toBe('pending');
    }
  });
});

describe('transcribeVideo — re-run on an unchanged video', () => {
  let dir: string;
  let videoPath: string;
  let audioPath: string;
  let cacheRoot: string;
  let calls: number;

  function options(now: string) {
    return {
      videoPath,
      cacheRoot,
      log: () => {},
      now: () => now,
      audioDir: dir,
      media: {
        hashFile: async () => 'c'.repeat(64),
        probeVideo: async () => ({ durationS: 25.692333, fps: 29.97, width: 2160, height: 3840 }),
        extractAudio: async () => audioPath,
      },
      runTranscription: (async (opts: Parameters<typeof transcribeHybridCached>[0]) =>
        transcribeHybridCached({
          ...opts,
          runHybrid: async () => {
            calls += 1;
            return fixtureTranscript();
          },
        })) as typeof transcribeHybridCached,
    };
  }

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'framopia-job-'));
    videoPath = path.join(dir, 'vitasilk.mov');
    audioPath = path.join(dir, 'vitasilk.wav');
    cacheRoot = path.join(dir, 'cache');
    writeFileSync(videoPath, 'not really a video');
    writeFileSync(audioPath, 'not really audio');
    calls = 0;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('hits the cache, costs nothing, and differs only in updatedAt', async () => {
    const first = await transcribeVideo(options('2026-08-25T00:00:00.000Z'));
    expect(calls).toBe(1);
    expect(first.cached).toBe(false);

    const second = await transcribeVideo(options('2026-08-25T09:30:00.000Z'));
    expect(calls).toBe(1);
    expect(second.cached).toBe(true);
    expect(second.plan.pipeline.transcription.costUsd).toBe(0);
    expect(second.plan.costs.totalUsd).toBe(0);

    // Everything the transcript itself produced must be identical; only the
    // timestamps and the cost bookkeeping may move.
    expect(second.plan.transcript).toEqual(first.plan.transcript);
    expect(second.plan.subtitles).toEqual(first.plan.subtitles);
    expect(second.plan.source).toEqual(first.plan.source);
    expect(second.plan.meta.id).toBe(first.plan.meta.id);
  });

  it('is byte-identical once the volatile fields are normalised', async () => {
    const stamp = '2026-08-25T00:00:00.000Z';
    const first = await transcribeVideo(options(stamp));
    const firstJson = readFileSync(first.planPath, 'utf8');
    const second = await transcribeVideo(options('2026-08-25T09:30:00.000Z'));
    const secondJson = readFileSync(second.planPath, 'utf8');

    expect(secondJson).not.toBe(firstJson);
    const normalise = (json: string): string =>
      json
        .replace(/"createdAt": "[^"]+"/, '"createdAt": "X"')
        .replace(/"updatedAt": "[^"]+"/, '"updatedAt": "X"')
        .replace(/"completedAt": "[^"]+"/, '"completedAt": "X"')
        .replace(/"costUsd": [\d.]+/g, '"costUsd": 0')
        .replace(/"totalUsd": [\d.]+/g, '"totalUsd": 0')
        .replace(/"cached": \w+/, '"cached": X')
        .replace(/"byStage": \{[^}]*\}/, '"byStage": {}');
    expect(normalise(secondJson)).toBe(normalise(firstJson));
  });

  it('bypass forces a call and still repopulates the cache', async () => {
    await transcribeVideo(options('2026-08-25T00:00:00.000Z'));
    expect(calls).toBe(1);
    const bypassed = await transcribeVideo({
      ...options('2026-08-25T01:00:00.000Z'),
      bypassCache: true,
    });
    expect(calls).toBe(2);
    expect(bypassed.cached).toBe(false);
    await transcribeVideo(options('2026-08-25T02:00:00.000Z'));
    expect(calls).toBe(2);
  });
});

describe('transcribe job registration', () => {
  it('registers the transcribe job type with the shared framework', () => {
    expect(() => createJob('definitely-not-a-job-type')).toThrow(UnknownJobTypeError);
    const job = createJob(TRANSCRIBE_JOB_TYPE, {});
    expect(getJob(job.id)?.type).toBe(TRANSCRIBE_JOB_TYPE);
  });

  it('fails the job rather than throwing when videoPath is missing', async () => {
    const job = createJob(TRANSCRIBE_JOB_TYPE, {});
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(getJob(job.id)?.status).toBe('error');
    expect(getJob(job.id)?.error).toContain('videoPath');
  });
});

describe('transcribeVideo — media work is not repeated', () => {
  let dir: string;
  let videoPath: string;
  let audioDir: string;
  let cacheRoot: string;
  let hashes: number;
  let extractions: number;

  function options(overrides: Record<string, unknown> = {}) {
    return {
      videoPath,
      cacheRoot,
      audioDir,
      log: () => {},
      now: () => '2026-08-25T00:00:00.000Z',
      media: {
        hashFile: async () => {
          hashes += 1;
          return 'e'.repeat(64);
        },
        probeVideo: async () => ({ durationS: 25.692333, fps: 29.97, width: 2160, height: 3840 }),
        extractAudio: async (_input: string, outDir: string) => {
          extractions += 1;
          const out = path.join(outDir, 'vitasilk.wav');
          writeFileSync(out, 'extracted audio');
          return out;
        },
      },
      runTranscription: (async (opts: Parameters<typeof transcribeHybridCached>[0]) =>
        transcribeHybridCached({ ...opts, runHybrid: async () => fixtureTranscript() })) as
        typeof transcribeHybridCached,
      ...overrides,
    };
  }

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'framopia-media-'));
    videoPath = path.join(dir, 'vitasilk.mov');
    audioDir = path.join(dir, 'audio');
    cacheRoot = path.join(dir, 'cache');
    mkdirSync(audioDir, { recursive: true });
    writeFileSync(videoPath, 'not really a video');
    hashes = 0;
    extractions = 0;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('hashes the video once per run', async () => {
    await transcribeVideo(options());
    expect(hashes).toBe(1);
  });

  it('does not hash at all when the caller already did', async () => {
    await transcribeVideo(options({ videoSha256: 'e'.repeat(64) }));
    expect(hashes).toBe(0);
  });

  it('extracts audio once and reuses it on the cached re-run', async () => {
    await transcribeVideo(options());
    expect(extractions).toBe(1);
    await transcribeVideo(options());
    // Second run hits the cache; the audio it needs is already extracted.
    expect(extractions).toBe(1);
  });

  it('restores audio from the cache rather than running ffmpeg again', async () => {
    const first = await transcribeVideo(options());
    expect(extractions).toBe(1);
    // The extracted audio is gone, but the cache entry still holds a copy.
    rmSync(first.plan.source.audioPath);
    const logged: string[] = [];
    const second = await transcribeVideo(options({ log: (m: string) => logged.push(m) }));
    expect(extractions).toBe(1);
    expect(second.cached).toBe(true);
    expect(logged.join('\n')).toContain('restored extracted audio from the cache');
    expect(second.plan.source.audioPath).toBe(first.plan.source.audioPath);
  });
});
