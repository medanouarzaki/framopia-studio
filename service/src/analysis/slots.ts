import { createUserContent, GoogleGenAI } from '@google/genai';
import {
  appendCost,
  computeGeminiCost,
  modelConfig,
  type ClientMode,
  type GeminiUsage,
} from '@framopia/core';
import { AnalysisError, type AnalysisWord } from './types.js';
import type { SlotCandidate } from './slot-select.js';

export type SlotPromptVersion = 1 | 2;

/**
 * Identity of the image-slot prompt, and part of the slot cache fingerprint
 * per ARCHITECTURE §6. Switching is this constant and nothing else.
 *
 * **Version 2** is version 1 plus the literal-or-atmospheric rule, adopted at
 * Block 9 session 12 on the evidence in `docs/DECISION-image-config.md`: five
 * of nine planned slots call for the concrete thing she named and four for the
 * mood, and nothing in version 1 asked for the first, so both mentions of a
 * brand became a generic category. Version 1 stays selectable because every
 * slot on disk was planned with it.
 */
export const ACTIVE_SLOT_PROMPT_VERSION: SlotPromptVersion = 2;

/** ARCHITECTURE §8: every billable call appends one line under this stage. */
export const SLOT_LEDGER_STAGE = 'analysis-slots';

export const SLOT_CANDIDATE_MULTIPLIER = 2;
export const MIN_SLOT_CANDIDATES = 8;

export function slotCandidateCountFor(slotCount: number): number {
  return Math.max(MIN_SLOT_CANDIDATES, slotCount * SLOT_CANDIDATE_MULTIPLIER);
}

export interface BuildSlotPromptOptions {
  words: AnalysisWord[];
  mode: ClientMode;
  candidateCount: number;
  durationS: number;
  version?: SlotPromptVersion;
}

/**
 * The model is asked for spans and ideas only. It is told nothing about the
 * palette, the style fragments or the variation axes: the prompt that reaches
 * the image model is composed from mode data afterwards, so a model that
 * invented a colour could not put it there.
 */
export function buildSlotPrompt(options: BuildSlotPromptOptions): string {
  const { words, mode, candidateCount, durationS } = options;
  const transcript = words
    .filter((w) => !w.removed)
    .map((w) => `${w.id}\t${w.start.toFixed(2)}\t${w.text}`)
    .join('\n');

  return `You are choosing the moments in a short vertical video that should be
illustrated with a generated image.

The transcript below is one word per line, as "word_id<TAB>start_seconds<TAB>text".
It is Moroccan Darija written in Latin Arabizi, mixed with French and English,
and some words are in Arabic script. Do not translate it and do not rewrite it.

The reel is ${durationS.toFixed(1)} seconds long.

Each slot illustrates ONE idea or sentence — a thing being explained, claimed
or shown, that a picture could carry. Choose spans spread across the whole
reel, not clustered in one part of it, and do not choose two slots that
overlap in time.

For each slot give the word_ids of the span it illustrates, copied exactly
from the transcript, and a one-line idea in English describing what the image
should show. The idea is a description of a picture, not a translation of the
words and not a caption.

When the words name something concrete and depictable — a brand, a product,
a place, a country, an ingredient, a tool, a number of things — the picture
should usually be that thing, and the idea should name it as she named it.
A viewer should recognise it at a glance without working out what it stands
for.

When the words name no such thing — a question, a feeling, a promise, a
result — the picture should carry the mood or the outcome instead, and the
idea should describe that.

Decide this for each slot on its own. Both kinds are right, and neither is
the default. The test is what a viewer would recognise fastest in the two
seconds the picture is on screen.

Do not blend the two. A concrete thing beside an abstract one is two
subjects, and a slot idea depicts one.

Do not describe colours, lighting, framing or art style. Those come from the
client's own visual identity and are added after you answer.

Client: ${mode.name}.

Return the ${candidateCount} strongest slots, best first. How many the video
actually uses is imposed downstream and is not yours to decide.

Respond with strict JSON only, no prose, no markdown fences, in this shape:
{"slots":[{"wordIds":["w0000"],"idea":"..."}]}

TRANSCRIPT:
${transcript}`;
}

interface SlotRawResponse {
  slots: SlotCandidate[];
}

export function parseSlotResponse(text: string): SlotCandidate[] {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new AnalysisError(
      'slots',
      'response was not valid JSON after stripping code fences',
      true,
    );
  }

  const record = parsed as Partial<SlotRawResponse>;
  if (!Array.isArray(record.slots)) {
    throw new AnalysisError('slots', 'response is missing a "slots" array', true);
  }

  return record.slots.map((s) => ({
    wordIds: Array.isArray(s?.wordIds) ? s.wordIds.filter((id) => typeof id === 'string') : [],
    idea: typeof s?.idea === 'string' ? s.idea : '',
  }));
}

const OVERLOAD_MARKERS = ['503', 'UNAVAILABLE', 'high demand', 'overloaded'];

function isTransientOverload(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return OVERLOAD_MARKERS.some((marker) => message.includes(marker));
}

export interface SlotAnalysisOptions {
  apiKey: string;
  words: AnalysisWord[];
  mode: ClientMode;
  candidateCount: number;
  durationS: number;
  version?: SlotPromptVersion;
}

export interface SlotAnalysisResult {
  candidates: SlotCandidate[];
  rawText: string;
  promptVersion: SlotPromptVersion;
  model: string;
  costUsd: number;
  wallTimeS: number;
  usage: GeminiUsage;
}

/**
 * One structured call over the corrected transcript plus mode context.
 *
 * **Not reproducible**, exactly as the keyword call is not: two identical
 * requests can return different spans. The cache is what makes a repeated run
 * byte-identical, not the model.
 */
export async function runSlotAnalysis(options: SlotAnalysisOptions): Promise<SlotAnalysisResult> {
  const {
    apiKey,
    words,
    mode,
    candidateCount,
    durationS,
    version = ACTIVE_SLOT_PROMPT_VERSION,
  } = options;

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildSlotPrompt({ words, mode, candidateCount, durationS, version });
  const request = { model: modelConfig.geminiModel, contents: createUserContent([prompt]) };

  const startedAt = Date.now();
  let response: Awaited<ReturnType<typeof ai.models.generateContent>>;
  try {
    response = await ai.models.generateContent(request);
  } catch (error) {
    if (!isTransientOverload(error)) {
      throw new AnalysisError('slots', error instanceof Error ? error.message : String(error), false);
    }
    try {
      response = await ai.models.generateContent(request);
    } catch (retryError) {
      throw new AnalysisError(
        'slots',
        retryError instanceof Error ? retryError.message : String(retryError),
        true,
      );
    }
  }
  const wallTimeS = (Date.now() - startedAt) / 1000;
  const usage = (response.usageMetadata ?? {}) as GeminiUsage;
  const rawText = response.text ?? '';
  const costUsd = computeGeminiCost(usage);

  // Recorded here, at the point of spend, so a stubbed call cannot bill.
  appendCost({ stage: SLOT_LEDGER_STAGE, model: modelConfig.geminiModel, unit: 'run', usd: costUsd });

  return {
    candidates: parseSlotResponse(rawText),
    rawText,
    promptVersion: version,
    model: modelConfig.geminiModel,
    costUsd,
    wallTimeS,
    usage,
  };
}
