import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { resolveFfmpegPath } from '@framopia/core';

const execFileAsync = promisify(execFile);

export async function probeDurationSeconds(mediaPath: string): Promise<number> {
  const { stdout } = await execFileAsync(resolveFfmpegPath('ffprobe').path, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    mediaPath,
  ]);
  const seconds = Number.parseFloat(stdout.trim());
  if (Number.isNaN(seconds)) {
    throw new Error(`ffprobe returned an unparseable duration for ${mediaPath}: ${stdout}`);
  }
  return seconds;
}

export interface MediaProbe {
  durationS: number;
  fps: number;
  width: number;
  height: number;
}

/**
 * Video-stream geometry for the Edit Plan's `source` block. fps comes back as
 * a rational (30000/1001), which is how ffprobe reports drop-frame rates.
 */
export async function probeVideo(mediaPath: string): Promise<MediaProbe> {
  const { stdout } = await execFileAsync(resolveFfmpegPath('ffprobe').path, [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height,r_frame_rate',
    '-show_entries',
    'format=duration',
    '-of',
    'json',
    mediaPath,
  ]);
  const parsed = JSON.parse(stdout) as {
    streams?: { width?: number; height?: number; r_frame_rate?: string }[];
    format?: { duration?: string };
  };
  const stream = parsed.streams?.[0];
  if (stream?.width === undefined || stream.height === undefined) {
    throw new Error(`ffprobe found no video stream in ${mediaPath}`);
  }
  const [num, den] = (stream.r_frame_rate ?? '0/1').split('/');
  const fps = Number(num) / (Number(den) === 0 ? 1 : Number(den));
  const durationS = Number.parseFloat(parsed.format?.duration ?? '');
  if (Number.isNaN(durationS)) {
    throw new Error(`ffprobe returned no duration for ${mediaPath}`);
  }
  return { durationS, fps, width: stream.width, height: stream.height };
}

/**
 * How far an existing extraction's length may sit from the video's before it is
 * treated as a different recording. A wav written from this video differs only
 * by the encoder's framing of the last packet, which is milliseconds.
 */
const AUDIO_DURATION_TOLERANCE_S = 0.25;

/**
 * Where extractAudio will put the audio for this input.
 *
 * **Named from the video's content, not its filename.** It was
 * `<basename>.wav`, so two videos called `sora.mov` — a client's folder of
 * exports normally holds several — shared one extraction. Block 10 session 50
 * handed 40.5 s of one reel's audio to the transcription of a different 13.5 s
 * reel, and paid $1.01 for a transcript whose last word falls 25 seconds past
 * the end of the video it was filed under.
 *
 * The hash is short and the readable name is kept, so `.local/audio/` is still
 * something a person can look at and recognise. The sha256 is already computed
 * before this is called — it is what keys the cache — so this costs nothing.
 */
export function extractedAudioPath(
  inputPath: string,
  outputDir: string,
  videoSha256: string,
): string {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext === '.wav') return inputPath;
  return path.join(outputDir, `${path.basename(inputPath, ext)}-${videoSha256.slice(0, 12)}.wav`);
}

/**
 * Extracts mono 16kHz PCM per ARCHITECTURE §5.1. A .wav input is used as-is;
 * re-encoding one would only lose information. An existing extraction is
 * reused rather than redone: ffmpeg on a 2.8 GB ProRes reel is the slowest
 * step in a run that otherwise hits the cache and costs nothing.
 *
 * **Reused only when it is the same length as the video.** The name now carries
 * the video's hash, so a mismatch should be impossible — this is the second
 * check rather than the first, because the thing it guards is a paid call and
 * the cost of being wrong is a transcript of the wrong recording. A file that
 * disagrees is re-extracted over the top and the reason is logged; the wav is
 * derived from the video, so the video is the one that is right.
 */
export async function extractAudio(
  inputPath: string,
  outputDir: string,
  videoSha256: string,
  log: (message: string) => void = () => undefined,
): Promise<string> {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext === '.wav') return inputPath;

  const outputPath = extractedAudioPath(inputPath, outputDir, videoSha256);
  if (existsSync(outputPath)) {
    const [have, want] = await Promise.all([
      probeDurationSeconds(outputPath),
      probeDurationSeconds(inputPath),
    ]);
    if (Math.abs(have - want) <= AUDIO_DURATION_TOLERANCE_S) return outputPath;
    log(
      `audio: ${path.basename(outputPath)} is ${have.toFixed(3)}s against the video's ` +
        `${want.toFixed(3)}s, so it is not this recording; extracting again`,
    );
  }

  await mkdir(outputDir, { recursive: true });
  await execFileAsync(resolveFfmpegPath('ffmpeg').path, [
    '-y',
    '-i',
    inputPath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-c:a',
    'pcm_s16le',
    outputPath,
  ]);
  return outputPath;
}
