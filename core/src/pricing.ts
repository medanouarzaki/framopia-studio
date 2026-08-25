import {
  modelConfig,
  type GeminiImageModelPrices,
  type ImageResolution,
} from './model-config.js';

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
// rate. This multiplier is deliberately pessimistic: it feeds a pre-spend
// gate, and a gate that under-estimates protects nobody. It is not a best
// guess at typical cost — typical is well under it.
//
// Thinking-to-visible ratios observed so far, all on ~23-26s reels:
//   ~5x    Block 1 run C            (benchmarks/RESULTS-block1.md)
//    6.8x  Block 2 session 1        (benchmarks/RESULTS-block2-robustness.md)
//   18.1x, 8.7x  Block 2 session 3  (benchmarks/RESULTS-block2-promptv2.md)
//   30.2x, 20.4x, 8.3x  Block 2 session 4, three identical calls
//                                   (benchmarks/RESULTS-block2-noisefloor.md)
//
// The three identical calls spanning 8.3x-30.2x are the reason this cannot be
// a point estimate. 15 against the visible-output heuristic below yields a
// billed-output figure about 1.45x the worst total actually recorded.
const THINKING_TOKEN_MULTIPLIER = 15;

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

/**
 * Rough characters per token. Four is the usual English figure and it
 * under-counts Arabic script, which is the safe direction for a spend gate.
 */
const CHARS_PER_TOKEN = 4;

/**
 * A text-in, JSON-out call: no audio part, so the duration-based estimator
 * above does not describe it. Passing it a duration of 0 printed ~$0.0040
 * against a ~$0.05 actual for the Block 3 analysis stage, which is worse than
 * printing nothing.
 *
 * Same methodology as `estimateGeminiCallCost` — the same deliberately
 * pessimistic thinking multiplier, priced the same way — fed the prompt that
 * will actually be sent instead of a duration it does not have.
 */
export function estimateGeminiTextCallCost(options: {
  promptChars: number;
  expectedOutputTokens: number;
}): number {
  const { promptChars, expectedOutputTokens } = options;
  const inputTokens = promptChars / CHARS_PER_TOKEN;
  const { geminiPrices } = modelConfig;

  return (
    (inputTokens / 1_000_000) * geminiPrices.textInputUsdPerMillionTokens +
    ((expectedOutputTokens * (1 + THINKING_TOKEN_MULTIPLIER)) / 1_000_000) *
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

export class UnknownImageModelError extends Error {}
export class UnsupportedImageResolutionError extends Error {}

/**
 * 4K is rejected, not merely discouraged. The largest negative zone in a
 * 2160x3840 frame measures roughly 1700 px across and TEMPLATE_LIBRARY_GUIDE
 * §3 has image comps working at 1200x1200, so a 4K generation is paid-for
 * pixels that get scaled away before anyone sees them.
 */
export const ALLOWED_IMAGE_RESOLUTIONS: readonly ImageResolution[] = ['1K', '2K'];

export function isAllowedImageResolution(resolution: string): resolution is ImageResolution {
  return (ALLOWED_IMAGE_RESOLUTIONS as readonly string[]).includes(resolution);
}

export function imageModelPrices(modelId: string): GeminiImageModelPrices {
  const prices = modelConfig.geminiImagePrices.models[modelId];
  if (prices === undefined) {
    const known = Object.keys(modelConfig.geminiImagePrices.models).join(', ');
    throw new UnknownImageModelError(
      `No image pricing for model "${modelId}". Priced models: ${known}.`,
    );
  }
  return prices;
}

/**
 * Cost of one generated image. Google bills image output at a fixed token
 * count per resolution tier, so this is a table lookup rather than a token
 * computation — but it throws on an unpriced model instead of returning zero,
 * because a spend gate that reads a typo as free is worse than no gate.
 */
export function computeImageCost(modelId: string, resolution: ImageResolution): number {
  const usd = imageModelPrices(modelId).perImageUsd[resolution];
  if (usd === undefined) {
    const tiers = Object.keys(imageModelPrices(modelId).perImageUsd).join(', ');
    throw new UnsupportedImageResolutionError(
      `Model "${modelId}" has no price for resolution ${resolution}. Priced tiers: ${tiers}.`,
    );
  }
  return usd;
}

export interface ImageRunEstimate {
  modelId: string;
  resolution: ImageResolution;
  slots: number;
  candidatesPerSlot: number;
  images: number;
  perImageUsd: number;
  usd: number;
}

/**
 * The pre-spend estimate for a whole generation run. Exact rather than
 * pessimistic, unlike the text estimators: per-image billing means the only
 * unknown is how many images get requested, and that is decided before the
 * first call.
 */
export function estimateImageRunCost(options: {
  modelId: string;
  resolution: ImageResolution;
  slots: number;
  candidatesPerSlot: number;
}): ImageRunEstimate {
  const { modelId, resolution, slots, candidatesPerSlot } = options;
  const perImageUsd = computeImageCost(modelId, resolution);
  const images = slots * candidatesPerSlot;
  return { modelId, resolution, slots, candidatesPerSlot, images, perImageUsd,
    usd: images * perImageUsd };
}
