import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createPartFromBase64, createUserContent, GoogleGenAI } from '@google/genai';
import {
  isTransientFailure,
  ACTIVE_PROMPT_VERSION,
  computeGeminiCost,
  DOCS_DIR,
  modelConfig,
  SCRIPT_RULES,
  type GeminiUsage,
  type PromptVersion,
} from '@framopia/core';
import { TranscriptionError, type TranscriptWord } from './types.js';
import type { CorrectedWord } from './tagging.js';


/**
 * The active prompt version and its type live in `@framopia/core` and are
 * re-exported here, where every existing caller expects them. They moved
 * because `tools/align-review` has to name the configuration it read and may
 * not import this module: `@google/genai` above puts a network client in the
 * graph, and the review sheet is pinned as unable to reach one.
 *
 * Which version says what is documented below with the prompts themselves.
 * Version 4 is active: version 3 plus the two spelling rules guide v1.0.7
 * settles, stated in the prompt rather than left to be inferred from the guide
 * text. The guide is injected verbatim either way, but the conjunction rule was
 * new in v1.0.7 and every transcript in Block 3 wrote a standalone `w`; a rule
 * the model has to find in a long document is a rule it follows by chance.
 * This is the only difference from version 3 — Block 2 session 3 varied two
 * things at once and produced a result nobody could read.
 *
 * Version 3: version 1 plus a per-word `lang` in the response, and nothing
 * else. Activated in Block 2 session 7 on the evidence in
 * benchmarks/RESULTS-block2-langtagging.md — under guide v1.0.6 all three runs
 * tagged every word, agreed on every tag, and moved WER by 0.4 points against
 * a 3.7-point noise floor.
 *
 * Version 1 is the Block 1 frozen prompt, verbatim, and stays selectable: it
 * is what run C and every Block 1 figure were measured with.
 *
 * Version 2 stays selectable as the record of the Block 2 session 3
 * experiment, but is not active. That comparison
 * (benchmarks/RESULTS-block2-promptv2.md) was inconclusive: it varied two
 * things at once — the conjunction rule and the keyterms position — and ran
 * each arm once, with no noise floor to judge the difference against.
 *
 * ARCHITECTURE §3 requires the `lang` field and PROJECT_SPEC §5 depends on it
 * for the Latin-versus-Arabic rendering decision.
 */
export { ACTIVE_PROMPT_VERSION, type PromptVersion } from '@framopia/core';

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
  // Version 3 only. The enum is ARCHITECTURE §3's, defined the way §3 defines
  // it; "mixed" exists for a single token that genuinely belongs to two
  // languages, not for a sentence that code-switches between them.
  const langShape = `Respond with strict JSON only, no prose, no markdown fences, in this shape:
{"words":[{"text":"...","lang":"..."}]}

Every word carries a lang, one of exactly these five values:
- darija: Moroccan Darija, whatever script it is written in.
- msa: classical or Modern Standard Arabic — religious formulas, formal
  quotations, fixed formal terms.
- fr: French.
- en: English.
- mixed: a single token that genuinely belongs to two languages at once.
  A sentence that switches between languages is not mixed; tag each of its
  words with the language that word belongs to.`;

  /*
   * Version 4 only. Both rules are in the guide above; they are repeated here
   * because a rule stated once inside a long reference document is followed by
   * chance, and these two are the ones a draft actually gets wrong.
   *
   * Rewritten at guide v2.0.0. Until then they said the opposite — that the
   * conjunction be written `w7essa` in Latin letters, and that `dial` be
   * written Latin beside a French noun. The prompt version did not move with
   * them: it names the prompt's *shape*, and the shape is unchanged, while
   * what these two rules say is the guide's business and the guide's version
   * is what the cache keys on.
   */
  const spellingRules = `Two spelling rules from the guide above, repeated because they are the ones
most often missed:

1. Arabic proclitics attach, in Arabic letters: the conjunction و, the
   definite article, and ل/ب/ف/ك. Write "ونضارة", "للبشرة", "فالدار". Never
   write a standalone و before an Arabic word, and never write the
   conjunction as a Latin "w". Before a Latin-script word the proclitic
   cannot attach — a token may not mix scripts — so it stands alone in Arabic
   letters: "و l'effet", "ديال les cernes".
2. A borrowed word takes the script of the language it is being spoken as.
   With a French article and French grammar it stays French: "ديال la vidéo",
   not "ديال لافيديو". With Arabic grammar it is Arabic: "الفيتامينات". Write
   whichever one is spoken.`;

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

  if (version === 1 || version === 3) {
    // Verbatim Block 1 ordering: response shape last, keyterms appended after
    // it. Version 3 differs from version 1 in the response shape and nothing
    // else.
    const shape = version === 3 ? langShape : jsonShape;
    return `${head}

${shape}${keytermsBlock === '' ? '' : `\n\n${keytermsBlock}`}`;
  }

  if (version === 4) {
    return `${head}

${spellingRules}

${langShape}${keytermsBlock === '' ? '' : `\n\n${keytermsBlock}`}`;
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
    if (!isTransientFailure(error)) {
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
