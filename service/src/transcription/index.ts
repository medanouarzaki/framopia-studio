export {
  ACTIVE_ALIGN_COST_MODEL,
  ALIGN_COST_MODELS,
  alignCorrectedOntoDraft,
  type AlignCostModel,
} from './align.js';
export {
  assembleHybridResult,
  transcribeHybrid,
  CORRECTION_LEDGER_STAGE,
  SCRIBE_LEDGER_STAGE,
  type HybridTranscribeOptions,
  type HybridTranscript,
} from './hybrid.js';
export {
  cacheEntryDir,
  CACHE_ROOT,
  type CacheEntryRef,
  type TranscriptionCachePayload,
} from './cache.js';
export {
  transcribeHybridCached,
  transcriptionCacheRef,
  TRANSCRIPTION_CACHE_STAGE,
  type CachedTranscribeOptions,
  type CachedTranscribeResult,
} from './cached.js';
export {
  fingerprintOf,
  readGuideVersion,
  transcriptionFingerprintInputs,
  type FingerprintInputs,
} from './fingerprint.js';
export { computeHybridCost, type HybridCostBreakdown } from './cost.js';
export { extractAudio, probeDurationSeconds } from './media.js';
export {
  buildCorrectionPrompt,
  correctTranscript,
  parseCorrectionResponseText,
  ACTIVE_PROMPT_VERSION,
  type PromptVersion,
} from './correction.js';
export {
  driftWarning,
  measureTokenDrift,
  DRIFT_WARNING_THRESHOLD,
  type TokenDrift,
} from './drift.js';
export { mapScribeResponse, transcribeWithScribe, SCRIBE_MODEL_ID } from './scribe.js';
export {
  TranscriptionError,
  type TranscriptionStage,
  type TranscriptionWarning,
  type TranscriptWord,
} from './types.js';
