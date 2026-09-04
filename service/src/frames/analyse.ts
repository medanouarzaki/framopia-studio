import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, resolveFfmpegPath } from '@framopia/core';
import { editPlanPathFor } from '../editplan/io.js';
import { hashFile } from '../transcription/fingerprint.js';
import { SUBTITLE_BAND } from '../placement/constants.js';
import { SIDECAR_PYTHON } from '../images/sidecar.js';
import { writeZonesToPlan } from './plan-zones.js';
import { reelMasksDir, segmentPerson, type SegmentedFrame } from './segment.js';
import { type VideoIdentity } from '../video-identity.js';
import { SAMPLE_FPS, reelFramesDir, sampleFrames } from './sample.js';
import { computeZones, type Zone } from './zones.js';

/**
 * Frame analysis, driven — sample the reel, segment every frame, derive the
 * zones, write them onto the plan.
 *
 * This is the work `npm run frames`, `npm run segment` and `npm run zones` did
 * from a terminal. Block 8 shipped a pipeline that named those three commands
 * instead of running them, so a video that had never been through the sidecar
 * could not be taken from footage to comp without leaving the panel — and image
 * placement reads the face masks these produce.
 *
 * **Nothing here is a new measurement.** It calls the same `sampleFrames`,
 * `segmentPerson` and `computeZones` the CLIs call, in the same order and with
 * the same parameters, so the driven path and the terminal path cannot produce
 * different masks. What is new is the manifest below, which records what was
 * used, and the batching, which is what lets a long stage report progress.
 */

/**
 * Bumped when anything that changes the masks or the zones changes: the sample
 * rate, the working size, the segmentation threshold, the zone method. A
 * manifest written at a different version is stale whatever else it says.
 */
export const FRAME_ANALYSIS_VERSION = 1;

export const FRAME_ANALYSIS_MANIFEST = 'frame-analysis.json';

/**
 * How many frames go to the sidecar per invocation.
 *
 * Progress has to come from somewhere, and the sidecar's contract is one JSON
 * request in and one JSON result out — there is no progress channel and parsing
 * one out of stderr would make a debug line load-bearing. So the batching is on
 * this side: each batch that returns is a percentage the panel can show. Eight
 * is about four seconds of work on this corpus, which is often enough to read
 * as movement without paying the model-load cost too many times.
 *
 * CHOSEN, NOT MEASURED.
 */
export const SEGMENT_BATCH_SIZE = 8;

export const SEGMENTATION_MODEL_PATH = path.join(
  REPO_ROOT,
  'tools',
  'cv',
  'models',
  'selfie_multiclass_256x256.tflite',
);

export const SEGMENT_THRESHOLD = 0.5;

/** The manifest written beside the masks. It is the artifact; stdout is not. */
export interface FrameAnalysisManifest {
  schemaVersion: number;
  reel: string;
  sourcePath: string;
  sourceSha256: string;
  sampleFps: number;
  frameCount: number;
  task: 'segment_person';
  model: string;
  modelPath: string;
  threshold: number;
  zoneMethod: string;
  zoneCount: number;
  wallS: number;
  completedAt: string;
}

export interface FrameAnalysisNeed {
  what: string;
  command: string;
  consequence: string;
}

/**
 * Thrown when the machine cannot do this work at all.
 *
 * It never resolves to an empty result. An empty map of face boxes is exactly
 * what put a 2030 px picture across the speaker while every check reported
 * success, so absence here is a typed refusal naming the stage, what the
 * pipeline would otherwise do, and the command that fixes it.
 */
export class FrameAnalysisUnavailableError extends Error {
  constructor(readonly needs: FrameAnalysisNeed[]) {
    super(
      'Looking at the video cannot run: ' +
        needs
          .map((n) => `${n.what}\n    without it: ${n.consequence}\n    run: ${n.command}`)
          .join('\n  '),
    );
    this.name = 'FrameAnalysisUnavailableError';
  }
}

function ffmpegRuns(): boolean {
  try {
    execFileSync(resolveFfmpegPath('ffmpeg').path, ['-version'], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

/** What is missing, if anything. Empty means the stage can run. */
export function frameAnalysisNeeds(
  disk: { ffmpeg: boolean; python: boolean; model: boolean } = {
    ffmpeg: ffmpegRuns(),
    python: existsSync(SIDECAR_PYTHON),
    model: existsSync(SEGMENTATION_MODEL_PATH),
  },
): FrameAnalysisNeed[] {
  const needs: FrameAnalysisNeed[] = [];
  if (!disk.ffmpeg) {
    needs.push({
      what: 'ffmpeg, which takes the still frames out of the video',
      command: 'brew install ffmpeg, or set ffmpegPath in .local/config.json',
      consequence: 'no frames can be taken, so nothing knows where you are in the picture',
    });
  }
  if (!disk.python) {
    needs.push({
      what: `the picture tools at ${SIDECAR_PYTHON}`,
      command: 'tools/cv/setup.sh',
      consequence: 'nothing can find you in the frame, and every image is placed over your face',
    });
  }
  if (!disk.model) {
    needs.push({
      what: `the segmentation model at ${SEGMENTATION_MODEL_PATH}`,
      command: 'tools/cv/setup.sh',
      consequence: 'nothing can find you in the frame, and every image is placed over your face',
    });
  }
  return needs;
}

export function assertFrameAnalysisAvailable(needs = frameAnalysisNeeds()): void {
  if (needs.length > 0) throw new FrameAnalysisUnavailableError(needs);
}

export function frameAnalysisManifestPath(video: VideoIdentity): string {
  return path.join(reelMasksDir(video), FRAME_ANALYSIS_MANIFEST);
}

export function readFrameAnalysisManifest(video: VideoIdentity): FrameAnalysisManifest | null {
  const file = frameAnalysisManifestPath(video);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as FrameAnalysisManifest;
  } catch {
    // A manifest that will not parse is a manifest that says nothing, which is
    // the same position as having none: re-run rather than trust it.
    return null;
  }
}

export interface FreshnessInput {
  manifest: FrameAnalysisManifest | null;
  sourcePath: string;
  sourceSha256: string;
  masksPresent: boolean;
}

/**
 * Whether the masks on disk describe this video, as it is now.
 *
 * Any mismatch is a re-run, and re-running is always safe: segmentation is
 * bit-identical across runs on this corpus, so the cost of being wrong in this
 * direction is a minute, and the cost of being wrong in the other is a comp
 * built against another video's face.
 */
export function frameAnalysisIsFresh(input: FreshnessInput): { fresh: boolean; why: string } {
  const { manifest } = input;
  if (manifest === null) return { fresh: false, why: 'nothing here says what was looked at' };
  if (!input.masksPresent) return { fresh: false, why: 'the results are no longer on the disk' };
  if (manifest.schemaVersion !== FRAME_ANALYSIS_VERSION) {
    return { fresh: false, why: 'the way this is worked out has changed since' };
  }
  if (manifest.sourcePath !== input.sourcePath) return { fresh: false, why: 'a different file' };
  if (manifest.sourceSha256 !== input.sourceSha256) {
    return { fresh: false, why: 'the video has changed since' };
  }
  if (manifest.sampleFps !== SAMPLE_FPS) return { fresh: false, why: 'a different sampling rate' };
  if (manifest.threshold !== SEGMENT_THRESHOLD) {
    return { fresh: false, why: 'a different threshold' };
  }
  if (manifest.modelPath !== SEGMENTATION_MODEL_PATH) {
    return { fresh: false, why: 'a different model' };
  }
  return { fresh: true, why: `already done: ${manifest.frameCount} frames, ${manifest.zoneCount} zones` };
}

function masksPresentIn(dir: string): boolean {
  return existsSync(dir) && readdirSync(dir).some((f) => f.endsWith('.png'));
}

export interface FrameAnalysisProgress {
  /** 0..1 across the whole stage. */
  percent: number;
  /** One line for the panel, already in the user's words. */
  message: string;
}

export interface FrameAnalysisOptions {
  reelLabel: string;
  videoPath: string;
  /** Defaults to the plan beside the video. */
  planPath?: string;
  /** Run even when the manifest says the result is fresh. */
  force?: boolean;
  onProgress?: (progress: FrameAnalysisProgress) => void;
  log?: (message: string) => void;
  batchSize?: number;
  /** Injected by the tests so the sidecar and ffmpeg can be stood in for. */
  deps?: Partial<FrameAnalysisDeps>;
}

export interface FrameAnalysisDeps {
  needs: () => FrameAnalysisNeed[];
  hash: (file: string) => Promise<string>;
  sample: typeof sampleFrames;
  segment: typeof segmentPerson;
  zones: typeof computeZones;
  writePlan: typeof writeZonesToPlan;
}

export interface FrameAnalysisResult {
  reel: string;
  /** Null when the work was actually done. */
  skipped: string | null;
  frameCount: number;
  zoneCount: number;
  wallS: number;
  manifestPath: string;
  /** Masks that no longer matched the model's output and were rewritten. */
  repairedMasks: number;
}

/**
 * Masks the model no longer reproduces.
 *
 * The sidecar never rewrites a mask that is already there — every mask on disk
 * has been measured and reasoned about, and re-encoding one to prove it is
 * unchanged is the one action that could change it. So a mask left over from a
 * different cut of the same video survives a re-run and is reported as changed
 * rather than replaced. This deletes exactly those and asks again.
 */
function staleMaskPaths(frames: SegmentedFrame[]): string[] {
  const stale: string[] = [];
  for (const frame of frames) {
    if (frame.confidenceUnchanged === false) stale.push(frame.confidenceMaskPath);
    if (frame.binaryUnchanged === false) stale.push(frame.binaryMaskPath);
  }
  return stale;
}

export async function analyseFrames(options: FrameAnalysisOptions): Promise<FrameAnalysisResult> {
  const deps: FrameAnalysisDeps = {
    needs: frameAnalysisNeeds,
    hash: hashFile,
    sample: sampleFrames,
    segment: segmentPerson,
    zones: computeZones,
    writePlan: writeZonesToPlan,
    ...options.deps,
  };
  const {
    reelLabel,
    videoPath,
    planPath = editPlanPathFor(videoPath),
    force = false,
    onProgress = (): void => undefined,
    log = (): void => undefined,
    batchSize = SEGMENT_BATCH_SIZE,
  } = options;

  assertFrameAnalysisAvailable(deps.needs());

  /*
   * The hash comes before the directory, not after it: `.local/cv/` is named
   * for the video's content as well as its name, because two of his files are
   * called `sora.mov`. It was already being computed here for the freshness
   * check, so this costs nothing it did not already cost.
   */
  onProgress({ percent: 0, message: 'Checking whether this video has been looked at' });
  const sourceSha256 = await deps.hash(videoPath);
  const video: VideoIdentity = { path: videoPath, sha256: sourceSha256 };

  const masksDir = reelMasksDir(video);
  const manifestPath = frameAnalysisManifestPath(video);

  const freshness = frameAnalysisIsFresh({
    manifest: readFrameAnalysisManifest(video),
    sourcePath: videoPath,
    sourceSha256,
    masksPresent: masksPresentIn(masksDir),
  });
  if (freshness.fresh && !force) {
    return {
      reel: reelLabel,
      skipped: freshness.why,
      frameCount: 0,
      zoneCount: 0,
      wallS: 0,
      manifestPath,
      repairedMasks: 0,
    };
  }
  log(`frame analysis: ${freshness.why}`);

  const started = Date.now();

  /*
   * A re-sample can write fewer frames than the last one, and a leftover
   * frame-NNNN.png would silently desynchronise the timestamps from the files
   * they describe. Clearing them is the whole reason `frame-final.png` is named
   * rather than numbered, and it is safe: frames are regenerated from the
   * video, never edited.
   */
  clearPngs(reelFramesDir(video));

  onProgress({ percent: 0.05, message: 'Taking still frames from the video' });
  const frames = await deps.sample(reelLabel, video, {
    force: true,
    onProgress: (message) => log(message),
  });

  // The sidecar makes this directory on its way to writing the first mask, so
  // in production it is always there by now. It is made here as well because
  // the manifest and segmentation.json are written by this side, and a stage
  // that failed only at the last write would leave masks nothing described.
  mkdirSync(masksDir, { recursive: true });

  const framePaths = frames.frames.map((f) => f.path);
  const segmented: SegmentedFrame[] = [];
  let model = '';
  let modelPath = SEGMENTATION_MODEL_PATH;

  for (let start = 0; start < framePaths.length; start += batchSize) {
    const batch = framePaths.slice(start, start + batchSize);
    const result = await deps.segment({
      framePaths: batch,
      outDir: masksDir,
      threshold: SEGMENT_THRESHOLD,
    });
    segmented.push(...result.frames);
    model = result.model;
    modelPath = result.modelPath;
    const done = Math.min(start + batch.length, framePaths.length);
    onProgress({
      percent: 0.1 + 0.8 * (done / framePaths.length),
      message: `Finding you in the picture — frame ${done} of ${framePaths.length}`,
    });
  }

  const stale = staleMaskPaths(segmented);
  if (stale.length > 0) {
    log(`frame analysis: replacing ${stale.length} mask(s) left over from a different video`);
    for (const file of stale) rmSync(file, { force: true });
    const repaired = await deps.segment({
      framePaths,
      outDir: masksDir,
      threshold: SEGMENT_THRESHOLD,
    });
    segmented.length = 0;
    segmented.push(...repaired.frames);
    model = repaired.model;
    modelPath = repaired.modelPath;
  }

  // What `npm run segment` writes, so `maskFramesFor` and every existing tool
  // read the driven run exactly as they read a terminal one.
  writeFileSync(
    path.join(masksDir, 'segmentation.json'),
    `${JSON.stringify(
      {
        reel: reelLabel,
        elapsedS: (Date.now() - started) / 1000,
        ok: true,
        task: 'segment_person',
        model,
        modelPath,
        threshold: SEGMENT_THRESHOLD,
        writeHead: true,
        outDir: masksDir,
        frames: segmented,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  onProgress({ percent: 0.92, message: 'Working out where a picture can sit' });
  const zoneResult = await deps.zones({
    frames: segmented.map((frame, index) => ({
      maskPath: frame.binaryMaskPath,
      timeS: frames.frames[index]?.timeS ?? 0,
      headMaskPath: frame.headMaskPath,
    })),
    sampleFps: SAMPLE_FPS,
    subtitleBandY: SUBTITLE_BAND.y,
  });
  const zones: Zone[] = zoneResult.zones;

  writeFileSync(
    path.join(masksDir, 'zones.json'),
    `${JSON.stringify({ reel: reelLabel, elapsedS: (Date.now() - started) / 1000, ...zoneResult }, null, 2)}\n`,
    'utf8',
  );

  if (existsSync(planPath)) {
    await deps.writePlan(planPath, zones, SAMPLE_FPS, new Date().toISOString());
  }

  const wallS = (Date.now() - started) / 1000;
  const manifest: FrameAnalysisManifest = {
    schemaVersion: FRAME_ANALYSIS_VERSION,
    reel: reelLabel,
    sourcePath: videoPath,
    sourceSha256,
    sampleFps: SAMPLE_FPS,
    frameCount: segmented.length,
    task: 'segment_person',
    model,
    modelPath,
    threshold: SEGMENT_THRESHOLD,
    zoneMethod: zoneResult.method ?? 'maximal',
    zoneCount: zones.length,
    wallS,
    completedAt: new Date().toISOString(),
  };
  // Written last, so a run that died half way reads as a run that never
  // happened rather than as one whose results can be trusted.
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  onProgress({ percent: 1, message: `Looked at ${segmented.length} frames` });
  return {
    reel: reelLabel,
    skipped: null,
    frameCount: segmented.length,
    zoneCount: zones.length,
    wallS,
    manifestPath,
    repairedMasks: stale.length,
  };
}

function clearPngs(dir: string): void {
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.png')) rmSync(path.join(dir, file), { force: true });
  }
}
