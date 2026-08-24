import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createPartFromBase64, createUserContent, GoogleGenAI } from '@google/genai';
import { benchConfig } from '../bench-config.js';
import { REPO_ROOT } from '../paths.js';
import type { TranscribedWord, TranscriptionResult } from '../types.js';
import { normalizeToken } from '../normalize.js';
import { align } from '../wer.js';
import { computeGeminiCost, type GeminiUsage } from './gemini.js';
import { estimateScribeCost, transcribeWithScribe } from './scribe.js';
import { SCRIPT_RULES } from './script-rules.js';

/**
 * Aligns Gemini-corrected word text onto the Scribe words' timings.
 *
 * NOT the production merge — a benchmark-only approximation of the shape
 * production is expected to use. Matched/substituted words inherit the
 * anchor's timing directly (a spelling fix doesn't move in time); a run of
 * inserted words with no Scribe anchor interpolates linearly across the
 * gap between the nearest surviving anchors on either side; deleted Scribe
 * words simply don't appear in the output.
 */
export function alignCorrectedOntoScribeTimings(
  scribeWords: TranscribedWord[],
  correctedTexts: string[],
): TranscribedWord[] {
  const scribeNorm = scribeWords.map((w) => normalizeToken(w.text));
  const correctedNorm = correctedTexts.map((t) => normalizeToken(t));
  const pairs = align(scribeNorm, correctedNorm);

  const output: (TranscribedWord | null)[] = new Array(correctedTexts.length).fill(null);

  for (const pair of pairs) {
    if (pair.hypIndex === null) continue;
    if (pair.op === 'match' || pair.op === 'substitute') {
      const ref = scribeWords[pair.refIndex as number]!;
      output[pair.hypIndex] = {
        text: correctedTexts[pair.hypIndex]!,
        startS: ref.startS,
        endS: ref.endS,
        confidence: null,
      };
    }
  }

  for (let i = 0; i < output.length; i += 1) {
    if (output[i] !== null) continue;

    let prevIdx = i - 1;
    while (prevIdx >= 0 && output[prevIdx] === null) prevIdx -= 1;
    let nextIdx = i + 1;
    while (nextIdx < output.length && output[nextIdx] === null) nextIdx += 1;

    const prevWord = prevIdx >= 0 ? output[prevIdx] : null;
    const nextWord = nextIdx < output.length ? output[nextIdx] : null;

    let timing: number | null;
    if (prevWord?.endS != null && nextWord?.startS != null) {
      const gapSteps = nextIdx - prevIdx;
      const position = i - prevIdx;
      const span = nextWord.startS - prevWord.endS;
      timing = prevWord.endS + (span * position) / gapSteps;
    } else if (prevWord?.endS != null) {
      timing = prevWord.endS;
    } else if (nextWord?.startS != null) {
      timing = nextWord.startS;
    } else {
      timing = null;
    }

    output[i] = { text: correctedTexts[i]!, startS: timing, endS: timing, confidence: null };
  }

  return output.map((w) => w as TranscribedWord);
}

export async function buildHybridCorrectionPrompt(
  scribeWords: TranscribedWord[],
  keyterms: string[] = [],
): Promise<string> {
  const guide = await readFile(path.join(REPO_ROOT, 'docs', 'ORTHOGRAPHY_GUIDE.md'), 'utf8');
  const scribeText = scribeWords.map((w) => w.text).join(' ');
  const keytermsBlock =
    keyterms.length > 0
      ? `\n\nKeyterms to recognize accurately if spoken: ${keyterms.join(', ')}.`
      : '';

  return `${guide}

---

A first-pass transcription (Scribe) produced this word sequence, which may
contain spelling, code-switch, or recognition errors:
${scribeText}

Listen to the attached audio and correct the transcription to follow the
orthography rules above exactly. You may fix misspellings, split or merge
words, and add or remove words to match what is actually said — but never
paraphrase or translate.

${SCRIPT_RULES}

Respond with strict JSON only, no prose, no markdown fences, in this shape:
{"words":[{"text":"..."}]}${keytermsBlock}`;
}

interface CorrectionRawResponse {
  words: { text: string }[];
}

export function parseCorrectionResponseText(text: string): string[] {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error('Gemini correction response was not valid JSON after stripping code fences.');
  }

  const record = parsed as Partial<CorrectionRawResponse>;
  if (!Array.isArray(record.words)) {
    throw new Error('Gemini correction response is missing a "words" array.');
  }

  return record.words.map((w) => w.text);
}

export interface RunHybridOptions {
  elevenLabsApiKey: string;
  googleApiKey: string;
  audioPath: string;
  durationS: number;
  keyterms?: string[];
  rawDir: string;
}

export async function runHybrid(options: RunHybridOptions): Promise<TranscriptionResult> {
  const { elevenLabsApiKey, googleApiKey, audioPath, durationS, keyterms = [], rawDir } = options;

  const scribeResult = await transcribeWithScribe({
    apiKey: elevenLabsApiKey,
    audioPath,
    durationS,
    keyterms,
    rawDir,
  });

  const ai = new GoogleGenAI({ apiKey: googleApiKey });
  const audioBuffer = await readFile(audioPath);
  const prompt = await buildHybridCorrectionPrompt(scribeResult.words, keyterms);

  const startedAt = Date.now();
  const response = await ai.models.generateContent({
    model: benchConfig.geminiModel,
    contents: createUserContent([prompt, createPartFromBase64(audioBuffer.toString('base64'), 'audio/wav')]),
  });
  const correctionWallTimeS = (Date.now() - startedAt) / 1000;

  const correctionText = response.text ?? '';
  await mkdir(rawDir, { recursive: true });
  const correctionRawPath = path.join(rawDir, 'hybrid-correction.json');
  await writeFile(
    correctionRawPath,
    JSON.stringify({ text: correctionText, usageMetadata: response.usageMetadata }, null, 2),
    'utf8',
  );

  const correctedTexts = parseCorrectionResponseText(correctionText);
  const words = alignCorrectedOntoScribeTimings(scribeResult.words, correctedTexts);

  const rawResponsePath = path.join(rawDir, 'hybrid.json');
  await writeFile(
    rawResponsePath,
    JSON.stringify(
      { scribeRawPath: scribeResult.rawResponsePath, correctionRawPath, correctedTexts },
      null,
      2,
    ),
    'utf8',
  );

  const correctionCost = computeGeminiCost((response.usageMetadata ?? {}) as GeminiUsage);

  return {
    engine: 'hybrid',
    words,
    rawResponsePath,
    costUsd: scribeResult.costUsd + correctionCost,
    wallTimeS: scribeResult.wallTimeS + correctionWallTimeS,
  };
}

// estimateScribeCost is re-exported so callers estimating hybrid cost up
// front (before running) can reuse the same Scribe pricing without a
// second import path.
export { estimateScribeCost };
