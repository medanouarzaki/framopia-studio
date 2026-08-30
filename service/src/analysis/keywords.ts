import { createUserContent, GoogleGenAI } from '@google/genai';
import {
  isTransientFailure,
  appendCost,
  computeGeminiCost,
  modelConfig,
  type ClientMode,
  type GeminiUsage,
} from '@framopia/core';
import { MAX_KEYWORD_WORDS } from './span.js';
import type { TermSpan } from '../editplan/types.js';
import { AnalysisError, type AnalysisWord, type KeywordCandidate } from './types.js';

export type AnalysisPromptVersion = 1 | 2 | 3 | 4;

/**
 * Identity of the keyword prompt, and part of the analysis cache fingerprint
 * per ARCHITECTURE §6 — a change here must invalidate every cached analysis.
 * Switching is this constant and nothing else.
 *
 * **Version 4 adds §6 term boundaries** and changes nothing else. A subtitle
 * card carries one script (user ruling, Block 6), and §6c forbids breaking an
 * Arabic domain term across cards — but a maximal Arabic run is not reliably
 * one term, and nothing in the transcript marks where one ends. The call that
 * already reads the whole transcript is asked to say. It is here rather than
 * in the transcription pass because that config is frozen
 * (docs/DECISION-transcription-config.md) and a bump there invalidates the
 * transcription cache for every reel, where this invalidates keywords only.
 *
 * **Version 3 makes the label and the promise co-primary.** Every keyword
 * selected in Block 3 was a name — a product, a brand, a procedure — because
 * a nameable noun reads as the word carrying its sentence's claim. A reel that
 * only ever emphasises names never puts the offer on screen. The mix itself is
 * forced in the selector, not here; this asks for candidates of both kinds and
 * makes the model label them.
 *
 * Version 2 adds the span-length preference. Version 1's selections ran to
 * four words on a 22 s reel, which no keyword template can carry; the cap is
 * enforced in `narrowSpan` either way, and this asks the model to make
 * narrowing the exception rather than the rule.
 */
export const ACTIVE_ANALYSIS_PROMPT_VERSION: AnalysisPromptVersion = 4;

/**
 * How many more candidates to ask for than will be kept. The count is imposed
 * downstream, and candidates are lost to unresolvable ids, removed words and
 * overlap, so asking for exactly N would leave a reel short whenever any
 * candidate failed to resolve.
 */
/** ARCHITECTURE §8: every billable call appends one line under this stage. */
export const KEYWORD_LEDGER_STAGE = 'analysis-keywords';

export const CANDIDATE_MULTIPLIER = 3;
export const MIN_CANDIDATES = 8;

export function candidateCountFor(keywordCount: number): number {
  return Math.max(MIN_CANDIDATES, keywordCount * CANDIDATE_MULTIPLIER);
}

export interface BuildKeywordPromptOptions {
  words: AnalysisWord[];
  mode: ClientMode;
  candidateCount: number;
  version?: AnalysisPromptVersion;
}

/**
 * The criteria are stated in priority order and the prompt says so, because
 * the failure mode is a model that treats them as a flat list and picks a
 * brand name over the word carrying the claim.
 *
 * Delivery and vocal emphasis are ruled out explicitly. Nothing in this
 * pipeline hears prosody: the model is given the transcript as text, so any
 * appeal to how something was said would be invention.
 */
export function buildKeywordPrompt(options: BuildKeywordPromptOptions): string {
  const { words, mode, candidateCount, version = ACTIVE_ANALYSIS_PROMPT_VERSION } = options;
  const transcript = words
    .filter((w) => !w.removed)
    .map((w) => `${w.id}\t${w.text}`)
    .join('\n');

  const vocabularyBlock =
    mode.vocabulary.length > 0
      ? `The client's own vocabulary, for criterion 2: ${mode.vocabulary.join(', ')}.`
      : 'The client has no vocabulary list yet, so criterion 2 rests on product and procedure names alone.';

  return `You are selecting the words a short vertical video should emphasize on screen.

The transcript below is one word per line, as "word_id<TAB>text". It is
Moroccan Darija written in Latin Arabizi, mixed with French and English, and
some words are in Arabic script. Do not translate it and do not rewrite it.

${
    version >= 3
      ? `SELECTION CRITERIA. Two kinds of word matter, and they matter equally:

- THE LABEL: the product, the brand, or the procedure being named. What the
  thing is called.
- THE PROMISE: the benefit, the result, or the claim being made about it.
  What the viewer is being told they will get.

A reel needs both. Naming a product without showing what it does, or showing a
result without naming what produces it, each leaves half the message off the
screen. Return strong candidates of BOTH kinds and mark each one with its
"kind": "label" or "promise".

Within each kind, prefer the word that carries the claim of its sentence — the
thing being asserted, the thing a viewer must not miss.

Delivery and vocal emphasis are NOT criteria. Nothing in this pipeline hears
prosody.`
      : `SELECTION CRITERIA, in this priority order:
1. PRIMARY: semantic weight. The word that carries the claim of its sentence
   — the thing being asserted, the thing a viewer must not miss.
2. SECONDARY (tiebreak only): brand and domain vocabulary — product names,
   procedure names, and any term in the mode's vocabulary list.

Delivery and vocal emphasis are NOT criteria. Nothing in this pipeline hears
prosody.

Criterion 2 breaks ties within criterion 1. It never promotes a word that
carries no claim.`
  }

${vocabularyBlock}

Client: ${mode.name}.

Return the ${candidateCount} strongest candidates, ranked best first.
Return candidates only. How many the video actually uses is imposed
downstream and is not yours to decide.

Every candidate must name real word_ids copied exactly from the transcript
below. Candidates must not share a word_id.${
    version >= 2
      ? `

Prefer a span of ONE word. Use two only when the two words are one term and
neither carries the idea alone. Never return more than ${MAX_KEYWORD_WORDS} words: these go
into an on-screen animation designed for one or two short words, and a longer
span is shortened before it reaches the video. Do not include a leading
article, a preposition, or a bare number in the span.

Do not return two candidates of the SAME KIND about the same thing. A label
and a promise about one product are two different things and both are wanted;
two labels for one product are not.`
      : ''
  }

"score" is your confidence that the word carries its sentence's claim, from
0 to 1. "reason" is one clause, not a sentence and not a paragraph.

${
    version >= 4
      ? `
ALSO, SEPARATELY FROM THE CANDIDATES: mark the domain terms.

Some words in the transcript are in Arabic script. Where several Arabic-script
words sit next to each other, they may be ONE domain term, or they may be
SEVERAL terms one after another. A term is a single named thing: a procedure,
a treatment, an anatomical region, a substance, or one outcome phrase.

For every run of adjacent Arabic-script words, split the run into the terms it
actually contains and return one entry per term, giving that term's word_ids
in order. A run that is one term returns one entry. A single Arabic-script word
standing alone is one term. Do not include any Latin-script word in a term.
Every Arabic-script word in the transcript must appear in exactly one term.

This is a question about where terms begin and end, not about importance. It is
independent of the candidates above and the two must not be conflated.
`
      : ''
  }
Respond with strict JSON only, no prose, no markdown fences, in this shape:
${
    version >= 4
      ? '{"candidates":[{"wordIds":["w0000"],"text":"...","kind":"label","score":0.0,"reason":"..."}],"terms":[{"wordIds":["w0000","w0001"]}]}'
      : version === 3
        ? '{"candidates":[{"wordIds":["w0000"],"text":"...","kind":"label","score":0.0,"reason":"..."}]}'
        : '{"candidates":[{"wordIds":["w0000"],"text":"...","score":0.0,"reason":"..."}]}'
  }

TRANSCRIPT:
${transcript}`;
}

interface KeywordRawResponse {
  candidates: KeywordCandidate[];
  terms?: { wordIds?: unknown }[];
}

export interface KeywordResponse {
  candidates: KeywordCandidate[];
  /**
   * Undefined when the response carried no `terms` key at all, which is every
   * response under prompt versions 1-3. Distinguished from an empty array,
   * which is a reel with no Arabic-script word — an answer, not a silence.
   */
  terms?: TermSpan[];
}

export function parseKeywordResponse(text: string): KeywordResponse {
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
      'keywords',
      'response was not valid JSON after stripping code fences',
      true,
    );
  }

  const record = parsed as Partial<KeywordRawResponse>;
  if (!Array.isArray(record.candidates)) {
    throw new AnalysisError('keywords', 'response is missing a "candidates" array', true);
  }

  const candidates = record.candidates.map((c) => ({
    wordIds: Array.isArray(c?.wordIds) ? c.wordIds.filter((id) => typeof id === 'string') : [],
    text: typeof c?.text === 'string' ? c.text : '',
    score: typeof c?.score === 'number' ? c.score : Number.NaN,
    reason: typeof c?.reason === 'string' ? c.reason : '',
    // An unrecognised kind is dropped rather than coerced: the selector
    // forces a mix of kinds, and a guessed one would satisfy that rule with
    // something nobody claimed.
    ...(c?.kind === 'label' || c?.kind === 'promise' ? { kind: c.kind } : {}),
  }));

  if (!Array.isArray(record.terms)) return { candidates };

  // A term with no usable ids is dropped rather than kept as an empty span:
  // an empty term would claim nothing and still occupy a slot in the list.
  const terms = record.terms
    .map((t) => ({
      wordIds: Array.isArray(t?.wordIds) ? t.wordIds.filter((id) => typeof id === 'string') : [],
    }))
    .filter((t) => t.wordIds.length > 0);

  return { candidates, terms };
}


export interface KeywordAnalysisOptions {
  apiKey: string;
  words: AnalysisWord[];
  mode: ClientMode;
  candidateCount: number;
  version?: AnalysisPromptVersion;
}

export interface KeywordAnalysisResult {
  candidates: KeywordCandidate[];
  /** Undefined when the prompt version did not ask for terms. */
  terms?: TermSpan[];
  /** The response verbatim, so a cache entry replays byte for byte. */
  rawText: string;
  promptVersion: AnalysisPromptVersion;
  model: string;
  costUsd: number;
  wallTimeS: number;
  usage: GeminiUsage;
}

/**
 * One structured call over the corrected transcript plus mode context.
 *
 * **This call is not reproducible.** Two identical requests can return
 * different candidates: Block 2 measured a 3.7-point WER floor across three
 * identical correction calls and saw one brand name rendered three ways. The
 * cache is what makes a repeated run byte-identical, not the model.
 */
export async function runKeywordAnalysis(
  options: KeywordAnalysisOptions,
): Promise<KeywordAnalysisResult> {
  const {
    apiKey,
    words,
    mode,
    candidateCount,
    version = ACTIVE_ANALYSIS_PROMPT_VERSION,
  } = options;

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildKeywordPrompt({ words, mode, candidateCount, version });
  const request = {
    model: modelConfig.geminiModel,
    contents: createUserContent([prompt]),
  };

  const startedAt = Date.now();
  let response: Awaited<ReturnType<typeof ai.models.generateContent>>;
  try {
    response = await ai.models.generateContent(request);
  } catch (error) {
    if (!isTransientFailure(error)) {
      throw new AnalysisError(
        'keywords',
        error instanceof Error ? error.message : String(error),
        false,
      );
    }
    try {
      response = await ai.models.generateContent(request);
    } catch (retryError) {
      throw new AnalysisError(
        'keywords',
        retryError instanceof Error ? retryError.message : String(retryError),
        true,
      );
    }
  }
  const wallTimeS = (Date.now() - startedAt) / 1000;
  const usage = (response.usageMetadata ?? {}) as GeminiUsage;
  const rawText = response.text ?? '';
  const costUsd = computeGeminiCost(usage);

  // Recorded here, where the call is actually made, for the same reason
  // hybrid.ts records its two legs here: a caller that stubs this function
  // out must not be able to write a fabricated line to the ledger.
  appendCost({ stage: KEYWORD_LEDGER_STAGE, model: modelConfig.geminiModel, unit: 'run', usd: costUsd });

  const parsed = parseKeywordResponse(rawText);

  return {
    candidates: parsed.candidates,
    ...(parsed.terms === undefined ? {} : { terms: parsed.terms }),
    rawText,
    promptVersion: version,
    model: modelConfig.geminiModel,
    costUsd,
    wallTimeS,
    usage,
  };
}
