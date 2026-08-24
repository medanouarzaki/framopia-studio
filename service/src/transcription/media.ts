import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
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

/**
 * Extracts mono 16kHz PCM per ARCHITECTURE §5.1. A .wav input is used as-is;
 * re-encoding one would only lose information.
 */
export async function extractAudio(inputPath: string, outputDir: string): Promise<string> {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext === '.wav') return inputPath;

  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${path.basename(inputPath, ext)}.wav`);
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
