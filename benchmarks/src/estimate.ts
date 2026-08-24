import { benchConfig } from './bench-config.js';
import { estimateScribeCost } from './engines/scribe.js';

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

export function estimateGeminiCallCost(durationS: number): number {
  const audioTokens = durationS * GEMINI_AUDIO_TOKENS_PER_SECOND;
  const outputTokens = durationS * ESTIMATED_WORDS_PER_SECOND * ESTIMATED_OUTPUT_TOKENS_PER_WORD;
  const { geminiPrices } = benchConfig;

  return (
    (audioTokens / 1_000_000) * geminiPrices.audioInputUsdPerMillionTokens +
    (GUIDE_PROMPT_TEXT_TOKENS / 1_000_000) * geminiPrices.textInputUsdPerMillionTokens +
    ((outputTokens * (1 + THINKING_TOKEN_MULTIPLIER)) / 1_000_000) *
      geminiPrices.outputUsdPerMillionTokens
  );
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
