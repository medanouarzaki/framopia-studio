import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { LOCAL_DIR } from '@framopia/core';
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
    'ffmpeg',
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
    return {
      index,
      timeS: timestamps === 'pts' && line ? line.ptsTime : index / SAMPLE_FPS,
      path: path.join(dir, file),
    };
  });

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
    frames,
  };

  await writeFile(framesManifestPath(sourcePath), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

export function readFramesManifest(sourcePath: string): FramesManifest {
  const manifestPath = framesManifestPath(sourcePath);
  if (!existsSync(manifestPath)) {
    throw new Error(`no frames sampled for ${sourcePath}; run npm run frames first`);
  }
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as FramesManifest;
}
