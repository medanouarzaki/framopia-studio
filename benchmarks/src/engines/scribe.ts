import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  estimateScribeCost,
  SCRIBE_KEYTERM_SURCHARGE,
  SCRIBE_USD_PER_AUDIO_HOUR,
} from '@framopia/core';
import type { TranscribedWord, TranscriptionResult } from '../types.js';
import { EngineRequestError, fetchWithOneRetry } from './http.js';

export { estimateScribeCost, SCRIBE_KEYTERM_SURCHARGE, SCRIBE_USD_PER_AUDIO_HOUR };

const SCRIBE_ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text';
const DEFAULT_MODEL_ID = 'scribe_v2';

export interface ScribeRawWord {
  text: string;
  type: 'word' | 'spacing' | 'audio_event';
  start: number | null;
  end: number | null;
  logprob: number;
  speaker_id?: string | null;
}

export interface ScribeRawResponse {
  language_code: string;
  language_probability: number;
  text: string;
  words: ScribeRawWord[];
}

/** Maps Scribe's raw response to the normalized word list, dropping spacing/audio-event entries. */
export function mapScribeResponse(raw: ScribeRawResponse): TranscribedWord[] {
  return raw.words
    .filter((word) => word.type === 'word')
    .map((word) => ({
      text: word.text,
      startS: word.start,
      endS: word.end,
      // logprob is in (-inf, 0]; exp() maps it to a (0, 1] confidence-like score.
      confidence: typeof word.logprob === 'number' ? Math.exp(word.logprob) : null,
    }));
}

export interface TranscribeWithScribeOptions {
  apiKey: string;
  audioPath: string;
  durationS: number;
  keyterms?: string[];
  rawDir: string;
  modelId?: string;
}

export async function transcribeWithScribe(
  options: TranscribeWithScribeOptions,
): Promise<TranscriptionResult> {
  const { apiKey, audioPath, durationS, keyterms = [], rawDir, modelId = DEFAULT_MODEL_ID } = options;

  const audioBuffer = await readFile(audioPath);
  const form = new FormData();
  form.append('model_id', modelId);
  form.append('timestamps_granularity', 'word');
  if (keyterms.length > 0) {
    form.append('keyterms', JSON.stringify(keyterms));
  }
  form.append('file', new Blob([audioBuffer]), path.basename(audioPath));

  const startedAt = Date.now();
  const response = await fetchWithOneRetry(SCRIBE_ENDPOINT, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  });
  const wallTimeS = (Date.now() - startedAt) / 1000;

  if (!response.ok) {
    throw new EngineRequestError('scribe', response.status, await response.text());
  }

  const raw = (await response.json()) as ScribeRawResponse;

  await mkdir(rawDir, { recursive: true });
  const rawResponsePath = path.join(rawDir, 'scribe.json');
  await writeFile(rawResponsePath, JSON.stringify(raw, null, 2), 'utf8');

  return {
    engine: 'scribe',
    words: mapScribeResponse(raw),
    rawResponsePath,
    costUsd: estimateScribeCost(durationS, keyterms.length > 0),
    wallTimeS,
  };
}
