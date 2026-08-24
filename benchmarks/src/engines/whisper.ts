import { execFile } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { REPO_ROOT } from '../paths.js';
import type { TranscribedWord, TranscriptionResult } from '../types.js';

const execFileAsync = promisify(execFile);

const WHISPER_MODEL = 'mlx-community/whisper-large-v3-mlx';
const WHISPER_DIR = path.join(REPO_ROOT, 'benchmarks', 'whisper');
const WHISPER_VENV_BIN = path.join(WHISPER_DIR, '.venv', 'bin');
// Matches the HF_HOME set in whisper/setup.sh, so a model predownloaded by
// setup.sh is actually found instead of triggering a re-download.
const WHISPER_HF_HOME = path.join(WHISPER_DIR, 'models');

export interface WhisperRawWord {
  word: string;
  start: number;
  end: number;
  probability: number;
}

export interface WhisperRawSegment {
  words: WhisperRawWord[];
}

export interface WhisperRawResponse {
  text: string;
  segments: WhisperRawSegment[];
  language: string;
}

/** mlx_whisper prefixes most words with a leading space (a GPT-2-tokenizer artifact); trim it. */
export function mapWhisperResponse(raw: WhisperRawResponse): TranscribedWord[] {
  return raw.segments.flatMap((segment) =>
    segment.words.map((word) => ({
      text: word.word.trim(),
      startS: word.start,
      endS: word.end,
      confidence: word.probability,
    })),
  );
}

export interface TranscribeWithWhisperOptions {
  audioPath: string;
  rawDir: string;
}

export async function transcribeWithWhisper(
  options: TranscribeWithWhisperOptions,
): Promise<TranscriptionResult> {
  const { audioPath, rawDir } = options;
  await mkdir(rawDir, { recursive: true });

  const mlxWhisperBin = path.join(WHISPER_VENV_BIN, 'mlx_whisper');
  const startedAt = Date.now();
  await execFileAsync(
    mlxWhisperBin,
    [
      audioPath,
      '--model',
      WHISPER_MODEL,
      '--word-timestamps',
      'True',
      '--output-format',
      'json',
      '--output-dir',
      rawDir,
    ],
    { env: { ...process.env, HF_HOME: WHISPER_HF_HOME } },
  );
  const wallTimeS = (Date.now() - startedAt) / 1000;

  const outputName = `${path.basename(audioPath, path.extname(audioPath))}.json`;
  const rawResponsePath = path.join(rawDir, outputName);
  const raw = JSON.parse(await readFile(rawResponsePath, 'utf8')) as WhisperRawResponse;

  return {
    engine: 'whisper',
    words: mapWhisperResponse(raw),
    rawResponsePath,
    costUsd: 0,
    wallTimeS,
  };
}
