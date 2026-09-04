import { execFile, execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FRAME_ANALYSIS_VERSION,
  SEGMENTATION_MODEL_PATH,
  SEGMENT_THRESHOLD,
  analyseFrames,
  frameAnalysisIsFresh,
  frameAnalysisManifestPath,
  frameAnalysisNeeds,
  type FrameAnalysisDeps,
  type FrameAnalysisManifest,
} from './analyse.js';
import { reelFramesDir, SAMPLE_FPS } from './sample.js';
import { reelMasksDir } from './segment.js';
import { type VideoIdentity } from '../video-identity.js';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
  execFile: vi.fn(),
  execFileSync: vi.fn(() => ''),
}));

/**
 * The video's name **and its hash** decide where the frames and masks go, so
 * every test gets its own and cleans up after itself. `.local/cv/` is not
 * injectable — it is derived from the repository root — and a test that wrote
 * into a real reel's directory would destroy measurements nothing can
 * re-derive for free.
 */
const THIS_VIDEO = 'e'.repeat(64);
const ANOTHER_VIDEO = 'f'.repeat(64);
let videoPath = '';
let video: VideoIdentity = { path: '', sha256: THIS_VIDEO };
let stem = '';

beforeEach(() => {
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-analyse-'));
  stem = `analyse-test-${path.basename(dir)}`;
  videoPath = path.join(dir, `${stem}.mov`);
  video = { path: videoPath, sha256: THIS_VIDEO };
  writeFileSync(videoPath, 'not really a video', 'utf8');
  vi.clearAllMocks();
});

afterEach(() => {
  rmSync(path.dirname(videoPath), { recursive: true, force: true });
  rmSync(path.dirname(reelMasksDir(video)), { recursive: true, force: true });
});

function writeManifest(over: Partial<FrameAnalysisManifest> = {}): FrameAnalysisManifest {
  const manifest: FrameAnalysisManifest = {
    schemaVersion: FRAME_ANALYSIS_VERSION,
    reel: stem,
    sourcePath: videoPath,
    sourceSha256: THIS_VIDEO,
    sampleFps: SAMPLE_FPS,
    frameCount: 3,
    task: 'segment_person',
    model: 'selfie_multiclass_256x256',
    modelPath: SEGMENTATION_MODEL_PATH,
    threshold: SEGMENT_THRESHOLD,
    zoneMethod: 'maximal',
    zoneCount: 4,
    wallS: 12,
    completedAt: '2026-08-29T00:00:00.000Z',
    ...over,
  };
  const masks = reelMasksDir(video);
  mkdirSync(masks, { recursive: true });
  writeFileSync(path.join(masks, 'frame-0000-binary.png'), 'png-bytes');
  writeFileSync(frameAnalysisManifestPath(video), JSON.stringify(manifest), 'utf8');
  return manifest;
}

function fakeDeps(over: Partial<FrameAnalysisDeps> = {}): Partial<FrameAnalysisDeps> {
  return {
    needs: () => [],
    hash: async () => THIS_VIDEO,
    sample: vi.fn(async () => ({
      schemaVersion: 1,
      reel: stem,
      sourcePath: videoPath,
      sourceWidth: 2160,
      sourceHeight: 3840,
      sourceFps: 29.97,
      sourceDurationS: 3,
      sampleFps: SAMPLE_FPS,
      width: 540,
      height: 960,
      scale: 0.25,
      timestamps: 'pts' as const,
      hasFinalFrame: false,
      frames: [0, 1, 2].map((index) => ({
        index,
        timeS: index / SAMPLE_FPS,
        path: path.join(reelFramesDir(video), `frame-000${index}.png`),
      })),
    })),
    segment: vi.fn(async (options: { framePaths: string[]; outDir: string }) => ({
      ok: true as const,
      task: 'segment_person' as const,
      model: 'selfie_multiclass_256x256',
      modelPath: SEGMENTATION_MODEL_PATH,
      threshold: SEGMENT_THRESHOLD,
      outDir: options.outDir,
      frames: options.framePaths.map((framePath) => ({
        framePath,
        confidenceMaskPath: `${framePath}-confidence`,
        binaryMaskPath: `${framePath}-binary`,
        width: 540,
        height: 960,
        personPixelRatio: 0.4,
        bbox: null,
        confidenceUnchanged: true,
        binaryUnchanged: true,
      })),
    })),
    zones: vi.fn(async () => ({
      ok: true as const,
      task: 'compute_zones' as const,
      sampleFps: SAMPLE_FPS,
      width: 540,
      height: 960,
      params: {},
      zones: [],
      perFrame: [],
      emptySamples: 0,
      method: 'maximal',
    })),
    writePlan: vi.fn(),
    ...over,
  };
}

describe('frameAnalysisNeeds', () => {
  it('names tools/cv/setup.sh when the picture tools are missing', () => {
    const needs = frameAnalysisNeeds({ ffmpeg: true, python: false, model: true });
    expect(needs).toHaveLength(1);
    expect(needs[0]?.command).toBe('tools/cv/setup.sh');
    expect(needs[0]?.consequence).toContain('over your face');
  });

  it('names the model separately from the interpreter', () => {
    const needs = frameAnalysisNeeds({ ffmpeg: true, python: true, model: false });
    expect(needs[0]?.what).toContain('segmentation model');
  });

  it('says nothing when everything is there', () => {
    expect(frameAnalysisNeeds({ ffmpeg: true, python: true, model: true })).toEqual([]);
  });
});

describe('frameAnalysisIsFresh', () => {
  const base = {
    sourcePath: '/v/reel.mov',
    sourceSha256: 'abc',
    masksPresent: true,
  };
  const manifest = (over: Partial<FrameAnalysisManifest> = {}): FrameAnalysisManifest => ({
    schemaVersion: FRAME_ANALYSIS_VERSION,
    reel: 'reel',
    sourcePath: '/v/reel.mov',
    sourceSha256: 'abc',
    sampleFps: SAMPLE_FPS,
    frameCount: 10,
    task: 'segment_person',
    model: 'm',
    modelPath: SEGMENTATION_MODEL_PATH,
    threshold: SEGMENT_THRESHOLD,
    zoneMethod: 'maximal',
    zoneCount: 2,
    wallS: 1,
    completedAt: 'then',
    ...over,
  });

  it('is fresh when everything agrees', () => {
    expect(frameAnalysisIsFresh({ ...base, manifest: manifest() }).fresh).toBe(true);
  });

  it('is not fresh with no manifest', () => {
    expect(frameAnalysisIsFresh({ ...base, manifest: null }).fresh).toBe(false);
  });

  it('is not fresh when the video has changed', () => {
    const verdict = frameAnalysisIsFresh({ ...base, manifest: manifest({ sourceSha256: 'zzz' }) });
    expect(verdict.fresh).toBe(false);
    expect(verdict.why).toContain('changed');
  });

  it('is not fresh when the masks are gone', () => {
    expect(
      frameAnalysisIsFresh({ ...base, manifest: manifest(), masksPresent: false }).fresh,
    ).toBe(false);
  });

  it('is not fresh at a different code version', () => {
    expect(
      frameAnalysisIsFresh({ ...base, manifest: manifest({ schemaVersion: 0 }) }).fresh,
    ).toBe(false);
  });
});

describe('analyseFrames', () => {
  it('skips a fresh result without starting a single subprocess', async () => {
    writeManifest();
    const result = await analyseFrames({
      reelLabel: stem,
      videoPath,
      deps: { needs: () => [], hash: async () => THIS_VIDEO },
    });
    expect(result.skipped).toContain('already done');
    expect(result.frameCount).toBe(0);
    // The sidecar is a spawn and ffmpeg is an execFile. Neither may happen.
    expect(vi.mocked(spawn)).not.toHaveBeenCalled();
    expect(vi.mocked(execFile)).not.toHaveBeenCalled();
    expect(vi.mocked(execFileSync)).not.toHaveBeenCalled();
  });

  it('re-runs when the video sha has moved', async () => {
    writeManifest({ sourceSha256: ANOTHER_VIDEO });
    const deps = fakeDeps();
    const result = await analyseFrames({ reelLabel: stem, videoPath, deps });
    expect(result.skipped).toBeNull();
    expect(deps.sample).toHaveBeenCalled();
    expect(deps.segment).toHaveBeenCalled();
  });

  it('re-runs and writes the manifest when the masks are there but nothing says what they are', async () => {
    const masks = reelMasksDir(video);
    mkdirSync(masks, { recursive: true });
    writeFileSync(path.join(masks, 'frame-0000-binary.png'), 'png-bytes');
    expect(existsSync(frameAnalysisManifestPath(video))).toBe(false);

    const result = await analyseFrames({ reelLabel: stem, videoPath, deps: fakeDeps() });

    expect(result.skipped).toBeNull();
    expect(result.frameCount).toBe(3);
    const written = JSON.parse(
      readFileSync(frameAnalysisManifestPath(video), 'utf8'),
    ) as FrameAnalysisManifest;
    expect(written.sourceSha256).toBe(THIS_VIDEO);
    expect(written.task).toBe('segment_person');
    expect(written.model).toBe('selfie_multiclass_256x256');
    expect(written.sampleFps).toBe(SAMPLE_FPS);
    expect(written.wallS).toBeGreaterThanOrEqual(0);
  });

  it('reports progress per batch rather than once at the end', async () => {
    const seen: number[] = [];
    await analyseFrames({
      reelLabel: stem,
      videoPath,
      batchSize: 1,
      onProgress: (p) => seen.push(p.percent),
      deps: fakeDeps(),
    });
    expect(seen.length).toBeGreaterThan(4);
    expect(seen[seen.length - 1]).toBe(1);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });

  it('writes no manifest when the sidecar fails', async () => {
    await expect(
      analyseFrames({
        reelLabel: stem,
        videoPath,
        deps: fakeDeps({
          segment: vi.fn(async () => {
            throw new Error('sidecar failed: could not load the model');
          }),
        }),
      }),
    ).rejects.toThrow('sidecar failed');
    expect(existsSync(frameAnalysisManifestPath(video))).toBe(false);
  });

  it('refuses, naming the setup command, when the picture tools are missing', async () => {
    await expect(
      analyseFrames({
        reelLabel: stem,
        videoPath,
        deps: fakeDeps({
          needs: () => frameAnalysisNeeds({ ffmpeg: true, python: false, model: false }),
        }),
      }),
    ).rejects.toThrow(/tools\/cv\/setup\.sh/);
    expect(existsSync(frameAnalysisManifestPath(video))).toBe(false);
  });

  it('replaces a mask the model no longer reproduces', async () => {
    let call = 0;
    const segment = vi.fn(async (options: { framePaths: string[]; outDir: string }) => {
      call += 1;
      return {
        ok: true as const,
        task: 'segment_person' as const,
        model: 'selfie_multiclass_256x256',
        modelPath: SEGMENTATION_MODEL_PATH,
        threshold: SEGMENT_THRESHOLD,
        outDir: options.outDir,
        frames: options.framePaths.map((framePath) => ({
          framePath,
          confidenceMaskPath: `${framePath}-confidence`,
          binaryMaskPath: `${framePath}-binary`,
          width: 540,
          height: 960,
          personPixelRatio: 0.4,
          bbox: null,
          confidenceUnchanged: true,
          // The sidecar never rewrites a mask it finds, so a leftover from a
          // different cut reports itself as changed on the first pass only.
          binaryUnchanged: call > 1,
        })),
      };
    });
    const result = await analyseFrames({
      reelLabel: stem,
      videoPath,
      deps: fakeDeps({ segment }),
    });
    expect(result.repairedMasks).toBe(3);
    expect(segment.mock.calls.length).toBeGreaterThan(1);
  });
});
