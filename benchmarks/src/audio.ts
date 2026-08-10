import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const WAV_EXTENSIONS = new Set(['.wav']);

export async function getAudioDurationSeconds(audioPath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    audioPath,
  ]);
  const seconds = Number.parseFloat(stdout.trim());
  if (Number.isNaN(seconds)) {
    throw new Error(`ffprobe returned an unparseable duration for ${audioPath}: ${stdout}`);
  }
  return seconds;
}

/**
 * Returns a 16kHz mono WAV path for the given input. If the input is
 * already a .wav it's returned unchanged; otherwise ffmpeg extracts audio
 * into outputDir.
 */
export async function ensureWavAudio(inputPath: string, outputDir: string): Promise<string> {
  const ext = path.extname(inputPath).toLowerCase();
  if (WAV_EXTENSIONS.has(ext)) return inputPath;

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
