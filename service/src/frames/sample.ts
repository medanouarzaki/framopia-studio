import { execFile } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { LOCAL_DIR, resolveFfmpegPath } from '@framopia/core';
import { probeVideo } from '../transcription/media.js';

const execFileAsync = promisify(execFile);

/** ARCHITECTURE §5.5. */
export const SAMPLE_FPS = 2;

/**
 * The working size for frame analysis. The reels are 2160x3840, so this is an
 * exact quarter and the mask is a clean upscale back onto the source. Nothing
 * downstream depends on it: the segmenter returns its box normalized.
 */
export const WORKING_WIDTH = 540;
export const WORKING_HEIGHT = 960;

export const FRAMES_SCHEMA_VERSION = 1;

export interface SampledFrame {
  index: number;
  timeS: number;
  path: string;
  /**
   * The reel's last decodable frame, appended outside the 2 fps grid. The
   * interval before it is shorter than 1/SAMPLE_FPS, so nothing may infer a
   * timestamp from an index.
   */
  final?: true;
}

export interface FramesManifest {
  schemaVersion: number;
  reel: string;
  sourcePath: string;
  sourceWidth: number;
  sourceHeight: number;
  sourceFps: number;
  sourceDurationS: number;
  sampleFps: number;
  width: number;
  height: number;
  /** Working width over source width; the two axes scale together. */
  scale: number;
  /**
   * `pts` means every timeS is the presentation timestamp ffmpeg reported for
   * the frame it actually wrote. `nominal` means showinfo could not be
   * matched to the files and the times are index/sampleFps, which on 29.97fps
   * footage is wrong by a few milliseconds and grows through the reel.
   */
  timestamps: 'pts' | 'nominal';
  /**
   * Whether the last entry in `frames` is the reel's final decodable frame
   * rather than a grid sample. False when the final frame landed on the grid
   * anyway, so it was already sampled.
   */
  hasFinalFrame: boolean;
  frames: SampledFrame[];
}

export class FramesExistError extends Error {
  constructor(readonly dir: string) {
    super(`${dir} already holds sampled frames; pass --force to replace them`);
    this.name = 'FramesExistError';
  }
}

/**
 * Frames live under .local/cv/, deliberately not under .local/cache/. They are
 * not a cache entry: nothing fingerprints them, no stage looks them up, and
 * putting them under the cache root would put them within reach of the
 * eviction pass, which deletes children of a video's directory by age.
 */
export function reelFramesDir(sourcePath: string): string {
  const basename = path.basename(sourcePath, path.extname(sourcePath));
  return path.join(LOCAL_DIR, 'cv', basename, `frames-${SAMPLE_FPS}fps`);
}

export function framesManifestPath(sourcePath: string): string {
  return path.join(reelFramesDir(sourcePath), 'frames.json');
}

interface ShowinfoLine {
  n: number;
  ptsTime: number;
  width: number;
  height: number;
}

/**
 * showinfo writes one line per frame that reached it, to stderr. Reading the
 * timestamp from there rather than computing index/sampleFps is the
 * difference between what ffmpeg wrote and what it was asked for: the reels
 * are 30000/1001, so the second sample is at 0.5005s, not 0.5s.
 */
export function parseShowinfo(stderr: string): ShowinfoLine[] {
  const lines: ShowinfoLine[] = [];
  for (const line of stderr.split('\n')) {
    const match = /\bn:\s*(\d+).*?\bpts_time:([0-9.]+).*?\bs:(\d+)x(\d+)/.exec(line);
    if (!match) continue;
    lines.push({
      n: Number(match[1]),
      ptsTime: Number(match[2]),
      width: Number(match[3]),
      height: Number(match[4]),
    });
  }
  return lines;
}

export interface SampleOptions {
  force?: boolean;
  onProgress?: (message: string) => void;
}

/**
 * Extracts frames at SAMPLE_FPS and writes a manifest beside them.
 *
 * The selection is a filter expression rather than `fps=2` because the fps
 * filter resamples onto its own grid and hands every output frame a
 * synthesised timestamp; this picks the first source frame at or after each
 * half-second and `-fps_mode passthrough` keeps that frame's own pts.
 */
export async function sampleFrames(
  reelLabel: string,
  sourcePath: string,
  options: SampleOptions = {},
): Promise<FramesManifest> {
  const dir = reelFramesDir(sourcePath);
  if (existsSync(dir) && readdirSync(dir).length > 0 && !options.force) {
    throw new FramesExistError(dir);
  }

  const probe = await probeVideo(sourcePath);
  await mkdir(dir, { recursive: true });

  const interval = (1 / SAMPLE_FPS).toFixed(6);
  const select = `select='isnan(prev_selected_t)+gte(t-prev_selected_t\\,${interval})'`;
  const scale = `scale=${WORKING_WIDTH}:${WORKING_HEIGHT}:force_original_aspect_ratio=decrease`;

  options.onProgress?.(`${reelLabel}: sampling`);
  const { stderr } = await execFileAsync(
    resolveFfmpegPath('ffmpeg').path,
    [
      '-y',
      '-loglevel',
      'info',
      '-i',
      sourcePath,
      '-vf',
      `${select},${scale},showinfo`,
      '-fps_mode',
      'passthrough',
      '-start_number',
      '0',
      path.join(dir, 'frame-%04d.png'),
    ],
    // showinfo emits a few hundred lines on a 25s reel and execFile's default
    // buffer is 1MB; a truncated stderr would silently lose timestamps.
    { maxBuffer: 64 * 1024 * 1024 },
  );

  const written = readdirSync(dir)
    .filter((f) => /^frame-\d+\.png$/.test(f))
    .sort();
  const info = parseShowinfo(stderr);

  const timestamps = info.length === written.length ? 'pts' : 'nominal';
  const frames: SampledFrame[] = written.map((file, index) => {
    const line = info[index];
    // The nominal fallback is only ever correct for grid samples, which is why
    // the final frame is appended below rather than folded into this map.
    return {
      index,
      timeS: timestamps === 'pts' && line ? line.ptsTime : index / SAMPLE_FPS,
      path: path.join(dir, file),
    };
  });

  const final = await sampleFinalFrame(sourcePath, dir);
  const lastGrid = frames[frames.length - 1];
  if (final && (!lastGrid || final.timeS > lastGrid.timeS + FINAL_FRAME_EPSILON_S)) {
    frames.push({ index: frames.length, timeS: final.timeS, path: final.path, final: true });
  }

  const first = timestamps === 'pts' ? info[0] : undefined;
  const width = first?.width ?? WORKING_WIDTH;
  const height = first?.height ?? WORKING_HEIGHT;

  const manifest: FramesManifest = {
    schemaVersion: FRAMES_SCHEMA_VERSION,
    reel: reelLabel,
    sourcePath,
    sourceWidth: probe.width,
    sourceHeight: probe.height,
    sourceFps: probe.fps,
    sourceDurationS: probe.durationS,
    sampleFps: SAMPLE_FPS,
    width,
    height,
    scale: width / probe.width,
    timestamps,
    hasFinalFrame: frames[frames.length - 1]?.final === true,
    frames,
  };

  await writeFile(framesManifestPath(sourcePath), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

/**
 * A final frame landing this close to the last grid sample is that sample, not
 * an extra one. Half a source frame at 30 fps, so a reel whose length happens
 * to be a multiple of the sample interval does not get a duplicate.
 */
export const FINAL_FRAME_EPSILON_S = 1 / 60;

/** How far back to seek when hunting for the last decodable frame. */
const FINAL_FRAME_TAIL_S = 1;

/**
 * The reel's last decodable frame, with its own presentation timestamp.
 *
 * The 2 fps grid stops at the last sample on the grid, which on test-1 left
 * 0.4671 s of the reel unobserved and made a slot ending inside that tail
 * unplaceable. Seeking rather than trusting a container's frame count: the
 * question is which frame actually decodes, and only decoding answers it.
 * `-copyts` keeps the timestamps absolute, so the pts is comparable with the
 * grid's.
 */
async function sampleFinalFrame(
  sourcePath: string,
  dir: string,
): Promise<{ timeS: number; path: string } | null> {
  const scratch = await mkdtemp(path.join(tmpdir(), 'framopia-final-'));
  try {
    const { stderr } = await execFileAsync(
      resolveFfmpegPath('ffmpeg').path,
      [
        '-y',
        '-loglevel',
        'info',
        '-sseof',
        `-${FINAL_FRAME_TAIL_S}`,
        '-copyts',
        '-i',
        sourcePath,
        '-vf',
        `scale=${WORKING_WIDTH}:${WORKING_HEIGHT}:force_original_aspect_ratio=decrease,showinfo`,
        '-fps_mode',
        'passthrough',
        '-start_number',
        '0',
        path.join(scratch, 'tail-%04d.png'),
      ],
      { maxBuffer: 64 * 1024 * 1024 },
    );

    const info = parseShowinfo(stderr);
    const files = readdirSync(scratch)
      .filter((f) => /^tail-\d+\.png$/.test(f))
      .sort();
    const last = files[files.length - 1];
    const line = info[files.length - 1];
    if (!last || !line) return null;

    const destination = path.join(dir, FINAL_FRAME_NAME);
    copyFileSync(path.join(scratch, last), destination);
    return { timeS: line.ptsTime, path: destination };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * Named, not numbered, so it can never be swept into the grid list by the
 * `frame-NNNN.png` filter: a stale numbered file would silently desynchronise
 * the showinfo timestamps from the files they describe.
 */
export const FINAL_FRAME_NAME = 'frame-final.png';

export function readFramesManifest(sourcePath: string): FramesManifest {
  const manifestPath = framesManifestPath(sourcePath);
  if (!existsSync(manifestPath)) {
    throw new Error(`no frames sampled for ${sourcePath}; run npm run frames first`);
  }
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as FramesManifest;
}
