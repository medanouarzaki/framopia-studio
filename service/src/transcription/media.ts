import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function probeDurationSeconds(mediaPath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
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
  const { stdout } = await execFileAsync('ffprobe', [
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
 * Where extractAudio will put the audio for this input. Exposed so a caller
 * can tell whether extraction is needed before committing to it.
 */
export function extractedAudioPath(inputPath: string, outputDir: string): string {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext === '.wav') return inputPath;
  return path.join(outputDir, `${path.basename(inputPath, ext)}.wav`);
}

/**
 * Extracts mono 16kHz PCM per ARCHITECTURE §5.1. A .wav input is used as-is;
 * re-encoding one would only lose information. An existing extraction is
 * reused rather than redone: ffmpeg on a 2.8 GB ProRes reel is the slowest
 * step in a run that otherwise hits the cache and costs nothing.
 */
export async function extractAudio(inputPath: string, outputDir: string): Promise<string> {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext === '.wav') return inputPath;

  const outputPath = extractedAudioPath(inputPath, outputDir);
  if (existsSync(outputPath)) return outputPath;

  await mkdir(outputDir, { recursive: true });
  await execFileAsync('ffmpeg', [
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
