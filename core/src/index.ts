export { ConfigError, CONFIG_PATH, loadConfig, type FramopiaConfig } from './config.js';
export { appendCost, readCosts, COSTS_PATH, type CostEntry } from './costs.js';
export { align, type AlignedPair, type AlignOp } from './align.js';
export { normalizeToken } from './normalize.js';
export { modelConfig, type GeminiPrices, type ModelConfig } from './model-config.js';
export { DOCS_DIR, LOCAL_DIR, REPO_ROOT } from './paths.js';
export { SCRIPT_RULES } from './script-rules.js';
export {
  computeGeminiCost,
  estimateCosts,
  estimateGeminiCallCost,
  estimateScribeCost,
  SCRIBE_KEYTERM_SURCHARGE,
  SCRIBE_USD_PER_AUDIO_HOUR,
  type CostEstimate,
  type GeminiUsage,
  type GeminiUsageDetail,
} from './pricing.js';
