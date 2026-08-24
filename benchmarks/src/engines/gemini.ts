import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createPartFromBase64,
  createPartFromUri,
  createUserContent,
  GoogleGenAI,
} from '@google/genai';
import { computeGeminiCost, modelConfig, REPO_ROOT, type GeminiUsage } from '@framopia/core';
import { generateWithOneRetry } from './generate-retry.js';
import { SCRIPT_RULES } from './script-rules.js';
import type { TranscribedWord, TranscriptionResult } from '../types.js';

const MAX_INLINE_BYTES = 20 * 1024 * 1024;

function guessMimeType(audioPath: string): string {
  const ext = path.extname(audioPath).toLowerCase();
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.m4a') return 'audio/mp4';
  return 'application/octet-stream';
}

export async function buildGeminiPrompt(keyterms: string[] = []): Promise<string> {
  const guide = await readFile(path.join(REPO_ROOT, 'docs', 'ORTHOGRAPHY_GUIDE.md'), 'utf8');
  const keytermsBlock =
    keyterms.length > 0
      ? `\n\nKeyterms to recognize accurately if spoken: ${keyterms.join(', ')}.`
      : '';

  return `${guide}

---

Transcribe the attached audio following the orthography rules above exactly.

${SCRIPT_RULES}

Respond with strict JSON only, no prose, no markdown fences, in this shape:
{"words":[{"text":"...","startS":0.0,"endS":0.0}]}
Word-level timestamps are required for every word.${keytermsBlock}`;
}

export interface GeminiRawWord {
  text: string;
  startS: number;
  endS: number;
}

interface GeminiRawResponse {
  words: GeminiRawWord[];
}

/** Strips optional markdown code fences before parsing, since models sometimes wrap JSON in ```json blocks despite instructions. */
export function parseGeminiResponseText(text: string): TranscribedWord[] {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error('Gemini response was not valid JSON after stripping code fences.');
  }

  const record = parsed as Partial<GeminiRawResponse>;
  if (!Array.isArray(record.words)) {
    throw new Error('Gemini response is missing a "words" array.');
  }

  return record.words.map((word) => ({
    text: word.text,
    startS: typeof word.startS === 'number' ? word.startS : null,
    endS: typeof word.endS === 'number' ? word.endS : null,
    confidence: null,
  }));
}

// Re-exported so benchmark callers keep a single import path per engine.
export { computeGeminiCost, type GeminiUsage };

export interface TranscribeWithGeminiOptions {
  apiKey: string;
  audioPath: string;
  keyterms?: string[];
  rawDir: string;
}

export async function transcribeWithGemini(
  options: TranscribeWithGeminiOptions,
): Promise<TranscriptionResult> {
  const { apiKey, audioPath, keyterms = [], rawDir } = options;
  const ai = new GoogleGenAI({ apiKey });
  const mimeType = guessMimeType(audioPath);
  const audioBuffer = await readFile(audioPath);

  const audioPart =
    audioBuffer.byteLength < MAX_INLINE_BYTES
      ? createPartFromBase64(audioBuffer.toString('base64'), mimeType)
      : createPartFromUri(
          (await ai.files.upload({ file: audioPath, config: { mimeType } })).uri ?? '',
          mimeType,
        );

  const prompt = await buildGeminiPrompt(keyterms);

  const startedAt = Date.now();
  const response = await generateWithOneRetry(ai, {
    model: modelConfig.geminiModel,
    contents: createUserContent([prompt, audioPart]),
  });
  const wallTimeS = (Date.now() - startedAt) / 1000;

  const text = response.text ?? '';

  await mkdir(rawDir, { recursive: true });
  const rawResponsePath = path.join(rawDir, 'gemini.json');
  await writeFile(
    rawResponsePath,
    JSON.stringify({ text, usageMetadata: response.usageMetadata }, null, 2),
    'utf8',
  );

  return {
    engine: 'gemini',
    words: parseGeminiResponseText(text),
    rawResponsePath,
    costUsd: computeGeminiCost(response.usageMetadata ?? {}),
    wallTimeS,
  };
}
