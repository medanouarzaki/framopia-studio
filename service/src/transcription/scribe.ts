import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { TranscriptionError, type TranscriptWord } from './types.js';

const SCRIBE_ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text';
export const SCRIBE_MODEL_ID = 'scribe_v2';

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

/** Maps Scribe's raw response to the word list, dropping spacing and audio-event entries. */
export function mapScribeResponse(raw: ScribeRawResponse): TranscriptWord[] {
  return raw.words
    .filter((word) => word.type === 'word')
    .map((word) => ({
      text: word.text,
      start: word.start,
      end: word.end,
      // logprob is in (-inf, 0]; exp() maps it to a (0, 1] confidence-like score.
      confidence: typeof word.logprob === 'number' ? Math.exp(word.logprob) : null,
    }));
}

export interface ScribeOptions {
  apiKey: string;
  audioPath: string;
  /** Mode vocabulary, passed to Scribe as keyterms. Billed at a surcharge. */
  keyterms?: string[];
  modelId?: string;
}

export interface ScribeResult {
  words: TranscriptWord[];
  raw: ScribeRawResponse;
  wallTimeS: number;
}

export async function transcribeWithScribe(options: ScribeOptions): Promise<ScribeResult> {
  const { apiKey, audioPath, keyterms = [], modelId = SCRIBE_MODEL_ID } = options;

  const audioBuffer = await readFile(audioPath);
  const form = new FormData();
  form.append('model_id', modelId);
  form.append('timestamps_granularity', 'word');
  if (keyterms.length > 0) {
    form.append('keyterms', JSON.stringify(keyterms));
  }
  form.append('file', new Blob([audioBuffer]), path.basename(audioPath));

  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(SCRIBE_ENDPOINT, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
    });
  } catch (error) {
    throw new TranscriptionError('scribe', error instanceof Error ? error.message : String(error), true);
  }
  const wallTimeS = (Date.now() - startedAt) / 1000;

  if (!response.ok) {
    // 5xx and 429 are worth another attempt; a 4xx is a real problem with the
    // request or the key and will fail again identically.
    const retryable = response.status >= 500 || response.status === 429;
    throw new TranscriptionError('scribe', await response.text(), retryable, response.status);
  }

  const raw = (await response.json()) as ScribeRawResponse;
  return { words: mapScribeResponse(raw), raw, wallTimeS };
}
