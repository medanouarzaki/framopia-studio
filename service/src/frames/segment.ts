import path from 'node:path';
import { LOCAL_DIR, REPO_ROOT } from '@framopia/core';
import { runSidecar } from '../images/sidecar.js';
import { SAMPLE_FPS } from './sample.js';
import { videoDirName, type VideoIdentity } from '../video-identity.js';

/** Normalized 0-1 against the frame, so the working size never leaks downstream. */
export interface PersonBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SegmentedFrame {
  framePath: string;
  confidenceMaskPath: string;
  binaryMaskPath: string;
  width: number;
  height: number;
  personPixelRatio: number;
  bbox: PersonBox | null;
  /** False when the model no longer reproduces a mask already on disk. */
  confidenceUnchanged?: boolean;
  binaryUnchanged?: boolean;
  headMaskPath?: string;
  headPixelRatio?: number;
  /** Normalized y below which no head pixel appears; null when no head. */
  headBottomY?: number | null;
}

export interface SegmentPersonResult {
  ok: true;
  task: 'segment_person';
  model: string;
  modelPath: string;
  threshold: number;
  outDir: string;
  frames: SegmentedFrame[];
}

export interface SegmentOverlayResult {
  ok: true;
  task: 'segment_overlay';
  contactSheet: string;
  closeUps: string[];
}

export const SEGMENTATION_DEBUG_DIR = path.join(
  REPO_ROOT,
  'benchmarks',
  'results',
  'latest-segmentation',
);

/**
 * Beside the frames, and outside .local/cache/ for the same reason they are.
 *
 * **The one place this path is decided.** It takes the video's identity — its
 * path and its sha256 — and hands the naming to `videoDirName`, because two of
 * his files are called `sora.mov` and a basename alone put one reel's masks and
 * the other's frames in the same directory (session 51). Until session 32 the
 * build requirement and the builder each built the string themselves from the
 * *plan's* filename, which agreed with this only while every plan sat beside
 * its video; a browsed video's plan does not, and a reel with 82 face masks on
 * disk was refused for having none. Pinned by a test in
 * `build/requirements.test.ts` that fails on any other module spelling
 * `masks-2fps` itself.
 */
export function reelMasksDir(video: VideoIdentity): string {
  return path.join(LOCAL_DIR, 'cv', videoDirName(video), `masks-${SAMPLE_FPS}fps`);
}

export function segmentPerson(options: {
  framePaths: string[];
  outDir: string;
  threshold?: number;
}): Promise<SegmentPersonResult> {
  return runSidecar<SegmentPersonResult>({
    task: 'segment_person',
    framePaths: options.framePaths,
    outDir: options.outDir,
    threshold: options.threshold ?? 0.5,
  });
}

export function segmentOverlay(options: {
  frames: { index: number; timeS: number; framePath: string; binaryMaskPath: string }[];
  outDir: string;
  prefix: string;
}): Promise<SegmentOverlayResult> {
  return runSidecar<SegmentOverlayResult>({
    task: 'segment_overlay',
    frames: options.frames,
    outDir: options.outDir,
    prefix: options.prefix,
  });
}

export interface RatioSummary {
  min: number;
  median: number;
  max: number;
  nullBoxes: number;
}

function nth(values: number[], index: number): number {
  const value = values[index];
  if (value === undefined) throw new Error(`no element ${index} in ${values.length} ratios`);
  return value;
}

export function summarise(frames: SegmentedFrame[]): RatioSummary {
  if (frames.length === 0) throw new Error('cannot summarise a segmentation with no frames');
  const ratios = frames.map((f) => f.personPixelRatio).sort((a, b) => a - b);
  const middle = Math.floor(ratios.length / 2);
  return {
    min: nth(ratios, 0),
    median:
      ratios.length % 2 === 0
        ? (nth(ratios, middle - 1) + nth(ratios, middle)) / 2
        : nth(ratios, middle),
    max: nth(ratios, ratios.length - 1),
    nullBoxes: frames.filter((f) => f.bbox === null).length,
  };
}
