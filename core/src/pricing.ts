import { modelConfig } from './model-config.js';

export const SCRIBE_USD_PER_AUDIO_HOUR = 0.22;
export const SCRIBE_KEYTERM_SURCHARGE = 0.2;

// Gemini's documented audio tokenization rate (ai.google.dev/gemini-api/docs/audio).
const GEMINI_AUDIO_TOKENS_PER_SECOND = 32;
// Rough spoken-word density and per-word JSON overhead for the transcription
// response; actual usage is only known after the call completes via
// usageMetadata. This is a pre-call estimate for the cost-confirmation
// prompt, not a billing figure.
const ESTIMATED_WORDS_PER_SECOND = 2.5;
const ESTIMATED_OUTPUT_TOKENS_PER_WORD = 20;
const GUIDE_PROMPT_TEXT_TOKENS = 2000;
// Gemini 3.1 Pro thinks before answering and bills those tokens at the output
// rate. On the Block 1 reels thinking ran ~5x the visible output, so the
// estimate has to carry the same multiplier or it lands 5x low.
const THINKING_TOKEN_MULTIPLIER = 5;

export function estimateScribeCost(durationS: number, keytermsUsed: boolean): number {
  const hours = durationS / 3600;
  const base = hours * SCRIBE_USD_PER_AUDIO_HOUR;
  return keytermsUsed ? base * (1 + SCRIBE_KEYTERM_SURCHARGE) : base;
}

export function estimateGeminiCallCost(durationS: number): number {
  const audioTokens = durationS * GEMINI_AUDIO_TOKENS_PER_SECOND;
  const outputTokens = durationS * ESTIMATED_WORDS_PER_SECOND * ESTIMATED_OUTPUT_TOKENS_PER_WORD;
  const { geminiPrices } = modelConfig;

  return (
    (audioTokens / 1_000_000) * geminiPrices.audioInputUsdPerMillionTokens +
    (GUIDE_PROMPT_TEXT_TOKENS / 1_000_000) * geminiPrices.textInputUsdPerMillionTokens +
    ((outputTokens * (1 + THINKING_TOKEN_MULTIPLIER)) / 1_000_000) *
      geminiPrices.outputUsdPerMillionTokens
  );
}

export interface GeminiUsageDetail {
  modality?: string;
  tokenCount?: number;
}

export interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  promptTokensDetails?: GeminiUsageDetail[];
}

/**
 * Prices audio and text prompt tokens separately when the SDK reports a
 * per-modality breakdown; falls back to a flat text rate otherwise.
 * Thinking tokens are billed at the output rate and are reported separately
 * from candidatesTokenCount — on a real 23s reel they were five times the
 * visible output, so leaving them out understates a call by ~5x.
 *
 * Audio input tokens are priced at the text input rate here because
 * model-config.json sets the two rates equal. That equality is an assumption
 * carried over from Block 1 and is unverified against Google's published
 * pricing for this model.
 */
export function computeGeminiCost(usage: GeminiUsage): number {
  const { geminiPrices } = modelConfig;
  let inputCost = 0;

  if (usage.promptTokensDetails && usage.promptTokensDetails.length > 0) {
    for (const detail of usage.promptTokensDetails) {
      const tokens = detail.tokenCount ?? 0;
      const pricePerMillion =
        detail.modality === 'AUDIO'
          ? geminiPrices.audioInputUsdPerMillionTokens
          : geminiPrices.textInputUsdPerMillionTokens;
      inputCost += (tokens / 1_000_000) * pricePerMillion;
    }
  } else {
    inputCost =
      ((usage.promptTokenCount ?? 0) / 1_000_000) * geminiPrices.textInputUsdPerMillionTokens;
  }

  const billedOutputTokens = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
  const outputCost = (billedOutputTokens / 1_000_000) * geminiPrices.outputUsdPerMillionTokens;

  return inputCost + outputCost;
}

export interface CostEstimate {
  engine: string;
  usd: number;
  note: string;
}

export function estimateCosts(
  durationS: number,
  engines: string[],
  keytermsUsed: boolean,
): CostEstimate[] {
  const estimates: CostEstimate[] = [];

  if (engines.includes('scribe')) {
    estimates.push({
      engine: 'scribe',
      usd: estimateScribeCost(durationS, keytermsUsed),
      note: 'audio-hour rate, exact',
    });
  }
  if (engines.includes('gemini')) {
    estimates.push({
      engine: 'gemini',
      usd: estimateGeminiCallCost(durationS),
      note: 'rough — actual token counts are only known after the call',
    });
  }
  if (engines.includes('whisper')) {
    estimates.push({ engine: 'whisper', usd: 0, note: 'local, free' });
  }
  if (engines.includes('hybrid')) {
    // Correction call has a similar shape to a transcription call (audio +
    // guide + scribe transcript), so it's estimated the same way.
    const usd = estimateScribeCost(durationS, keytermsUsed) + estimateGeminiCallCost(durationS);
    estimates.push({ engine: 'hybrid', usd, note: 'scribe (exact) + gemini correction (rough)' });
  }

  return estimates;
}
