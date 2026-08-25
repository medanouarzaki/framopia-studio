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

export interface ImageUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
}

/**
 * What an image call actually cost, from the response's `usageMetadata`.
 *
 * The per-image table is the *published* rate and is what the pre-spend
 * estimate uses; this is the billed amount. The two should agree, because
 * Google prices an image at a fixed token count per tier — but they are
 * computed from different things, and a disagreement means either the tier
 * served was not the tier requested or the price table is stale. Recording
 * the table figure as an actual would hide both.
 */
export function computeImageCostFromUsage(modelId: string, usage: ImageUsage): number {
  const prices = imageModelPrices(modelId);
  return (
    ((usage.promptTokenCount ?? 0) / 1_000_000) * prices.inputUsdPerMillionTokens +
    ((usage.candidatesTokenCount ?? 0) / 1_000_000) * prices.outputUsdPerMillionTokens
  );
}

/**
 * Applied to every pre-flight image estimate. Like THINKING_TOKEN_MULTIPLIER
 * this is a **gate, not a best estimate**: it feeds a spend ceiling, and a
 * ceiling that under-estimates protects nobody. Typical cost is well under it.
 *
 * Ten images have been generated at exact published (size, aspect) pairs, and
 * every one billed above its published per-image rate — never once under.
 * Actual over published, in order
 * (benchmarks/RESULTS-block4-imagebakeoff.md, reports/block-4-session-3.md):
 *
 *   flash 2K  1.152, 1.171, 1.261, 1.185, 1.220, 1.169
 *   pro   2K  1.129, 1.125, 1.113, 1.139
 *
 *   min 1.113   mean 1.166   max 1.261
 *
 * 1.35 clears the worst observed by 7%. It is not derived from a model of
 * why the gap exists — the served token count for a published pair is 1,930
 * to 2,050 against a published 1,680 and nothing explains that — so it is
 * chosen to sit above the evidence rather than to fit it. Ten images from one
 * slot on one reel is a thin basis; revise it when there is a wider one.
 *
 * Actuals always come from `usageMetadata` and are never estimated.
 */
export const IMAGE_COST_MULTIPLIER = 1.35;

export interface ImageRunEstimate {
  modelId: string;
  resolution: ImageResolution;
  slots: number;
  candidatesPerSlot: number;
  images: number;
  /** The rate Google publishes, before the gate multiplier. */
  publishedUsd: number;
  /** What the gate budgets per image: published x IMAGE_COST_MULTIPLIER. */
  perImageUsd: number;
  usd: number;
}

/**
 * The pre-spend estimate for a whole generation run, deliberately pessimistic
 * by IMAGE_COST_MULTIPLIER. It was exact once, on the theory that per-image
 * billing left only the image count unknown; ten images then billed 11% to
 * 26% above their published rates.
 */
export function estimateImageRunCost(options: {
  modelId: string;
  resolution: ImageResolution;
  slots: number;
  candidatesPerSlot: number;
}): ImageRunEstimate {
  const { modelId, resolution, slots, candidatesPerSlot } = options;
  const publishedUsd = computeImageCost(modelId, resolution);
  const perImageUsd = publishedUsd * IMAGE_COST_MULTIPLIER;
  const images = slots * candidatesPerSlot;
  return { modelId, resolution, slots, candidatesPerSlot, images,
    publishedUsd, perImageUsd, usd: images * perImageUsd };
}
