import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createPartFromBase64, createUserContent, GoogleGenAI } from '@google/genai';
import { computeGeminiCost, DOCS_DIR, modelConfig, SCRIPT_RULES, type GeminiUsage } from '@framopia/core';
import { TranscriptionError, type TranscriptWord } from './types.js';
import type { CorrectedWord } from './tagging.js';

export type PromptVersion = 1 | 2;

/**
 * Identity of the correction prompt, and part of the cache fingerprint per
 * ARCHITECTURE §6 — a change here must invalidate every cached correction.
 *
 * Version 1 is active: the Block 1 frozen prompt, verbatim, and the only
 * version any evidence describes.
 *
 * Version 2 stays selectable as the record of the Block 2 session 3
 * experiment, but is not active. That comparison
 * (benchmarks/RESULTS-block2-promptv2.md) was inconclusive: it varied two
 * things at once — the conjunction rule and the keyterms position — and ran
 * each arm once, with no noise floor to judge the difference against.
 *
 * Switching is this constant and nothing else.
 */
export const ACTIVE_PROMPT_VERSION: PromptVersion = 1;

/**
 * Version 2 only. The hybrid path rendered the Darija conjunction و as French
 * "ou" in run B (see docs/DECISION-transcription-config.md); it did not recur
 * in run C, on vitasilk, or under either version in the session-3
 * comparison, so this rule has never been observed to fix anything. The
 * conformance scorer detects the corruption instead.
 */
const CONJUNCTION_RULE = `The Arabic conjunction و is written w, never the French ou. "ou" appears
only as the long vowel /uː/ per ORTHOGRAPHY_GUIDE §3, or inside a
recognizable French root per §5 (ynourri, nour).`;

export const ORTHOGRAPHY_GUIDE_PATH = path.join(DOCS_DIR, 'ORTHOGRAPHY_GUIDE.md');

export interface BuildPromptOptions {
  keyterms?: string[];
  guidePath?: string;
  version?: PromptVersion;
}

/**
 * The guide is read from disk on every call rather than inlined, so bumping
 * its version is a file edit and never a code change.
 */
export async function buildCorrectionPrompt(
  draftWords: TranscriptWord[],
  options: BuildPromptOptions = {},
): Promise<string> {
  const {
    keyterms = [],
    guidePath = ORTHOGRAPHY_GUIDE_PATH,
    version = ACTIVE_PROMPT_VERSION,
  } = options;

  const guide = await readFile(guidePath, 'utf8');
  const scribeText = draftWords.map((w) => w.text).join(' ');
  const keytermsBlock =
    keyterms.length > 0
      ? `Keyterms to recognize accurately if spoken: ${keyterms.join(', ')}.`
      : '';
  const jsonShape = `Respond with strict JSON only, no prose, no markdown fences, in this shape:
{"words":[{"text":"..."}]}`;

  const head = `${guide}

---

A first-pass transcription (Scribe) produced this word sequence, which may
contain spelling, code-switch, or recognition errors:
${scribeText}

Listen to the attached audio and correct the transcription to follow the
orthography rules above exactly. You may fix misspellings, split or merge
words, and add or remove words to match what is actually said — but never
paraphrase or translate.

${SCRIPT_RULES}`;

  if (version === 1) {
    // Verbatim Block 1 ordering: JSON shape last, keyterms appended after it.
    return `${head}

${jsonShape}${keytermsBlock === '' ? '' : `\n\n${keytermsBlock}`}`;
  }

  return `${head}

${CONJUNCTION_RULE}
${keytermsBlock === '' ? '' : `\n${keytermsBlock}\n`}
${jsonShape}`;
}

interface CorrectionRawResponse {
  words: CorrectedWord[];
}

/**
 * Returns the words as the model gave them, including any `lang`/`script` it
 * volunteered. The frozen prompt asks only for `text`, so those are normally
 * absent; see tagging.ts for what happens then.
 */
export function parseCorrectionResponse(text: string): CorrectedWord[] {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new TranscriptionError(
      'correction',
      'response was not valid JSON after stripping code fences',
      true,
    );
  }

  const record = parsed as Partial<CorrectionRawResponse>;
  if (!Array.isArray(record.words)) {
    throw new TranscriptionError('correction', 'response is missing a "words" array', true);
  }

  return record.words.map((w) => ({
    text: w.text,
    ...(typeof w.lang === 'string' ? { lang: w.lang } : {}),
    ...(typeof w.script === 'string' ? { script: w.script } : {}),
  }));
}

export function parseCorrectionResponseText(text: string): string[] {
  return parseCorrectionResponse(text).map((w) => w.text);
}

const OVERLOAD_MARKERS = ['503', 'UNAVAILABLE', 'high demand', 'overloaded'];

function isTransientOverload(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return OVERLOAD_MARKERS.some((marker) => message.includes(marker));
}

export interface CorrectionOptions {
  apiKey: string;
  audioPath: string;
  draftWords: TranscriptWord[];
  keyterms?: string[];
  guidePath?: string;
  version?: PromptVersion;
}

export interface CorrectionResult {
  correctedTexts: string[];
  /** The response verbatim, so a cache entry can be replayed byte for byte. */
  rawText: string;
  correctedWords: CorrectedWord[];
  promptVersion: PromptVersion;
  model: string;
  costUsd: number;
  wallTimeS: number;
  usage: GeminiUsage;
}

export async function correctTranscript(options: CorrectionOptions): Promise<CorrectionResult> {
  const {
    apiKey,
    audioPath,
    draftWords,
    keyterms = [],
    guidePath,
    version = ACTIVE_PROMPT_VERSION,
  } = options;

  const ai = new GoogleGenAI({ apiKey });
  const audioBuffer = await readFile(audioPath);
  const prompt = await buildCorrectionPrompt(draftWords, { keyterms, guidePath, version });
  const request = {
    model: modelConfig.geminiModel,
    contents: createUserContent([
      prompt,
      createPartFromBase64(audioBuffer.toString('base64'), 'audio/wav'),
    ]),
  };

  const startedAt = Date.now();
  let response: Awaited<ReturnType<typeof ai.models.generateContent>>;
  try {
    response = await ai.models.generateContent(request);
  } catch (error) {
    // Gemini 3.1 Pro Preview returns 503 "high demand" often enough to be
    // worth one retry; anything else is a real problem and surfaces at once.
    if (!isTransientOverload(error)) {
      throw new TranscriptionError(
        'correction',
        error instanceof Error ? error.message : String(error),
        false,
      );
    }
    try {
      response = await ai.models.generateContent(request);
    } catch (retryError) {
      throw new TranscriptionError(
        'correction',
        retryError instanceof Error ? retryError.message : String(retryError),
        true,
      );
    }
  }
  const wallTimeS = (Date.now() - startedAt) / 1000;

  const usage = (response.usageMetadata ?? {}) as GeminiUsage;

  const rawText = response.text ?? '';
  const correctedWords = parseCorrectionResponse(rawText);

  return {
    correctedTexts: correctedWords.map((w) => w.text),
    rawText,
    correctedWords,
    promptVersion: version,
    model: modelConfig.geminiModel,
    costUsd: computeGeminiCost(usage),
    wallTimeS,
    usage,
  };
}
