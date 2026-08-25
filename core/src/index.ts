export { ConfigError, CONFIG_PATH, loadConfig, type FramopiaConfig } from './config.js';
export { appendCost, readCosts, COSTS_PATH, type CostEntry } from './costs.js';
export { appVersion } from './app-version.js';
export { align, type AlignedPair, type AlignOp } from './align.js';
export { normalizeToken } from './normalize.js';
export { modelConfig, type GeminiPrices, type ModelConfig } from './model-config.js';
export {
  GLOBAL_NEGATIVE_PROMPTS,
  loadMode,
  MODE_SCHEMA_VERSION,
  ModeFontsUnresolvedError,
  ModeValidationError,
  MODES_DIR,
  modePathFor,
  PALETTE_ROLES,
  parseMode,
  renderNegativePrompt,
  renderStylePrompt,
  requireFonts,
  TEMPLATE_KINDS,
  TEMPLATE_PREFIXES,
  validateMode,
  type ClientMode,
  type ImageVariation,
  type ModeFonts,
  type ModeValidationIssue,
  type PaletteRole,
  type TemplateKind,
} from './mode.js';
export { DOCS_DIR, LOCAL_DIR, REPO_ROOT, ROOT_PACKAGE_JSON } from './paths.js';
export { SCRIPT_RULES } from './script-rules.js';
export {
  computeGeminiCost,
  estimateCosts,
  estimateGeminiCallCost,
  estimateGeminiTextCallCost,
  estimateScribeCost,
  SCRIBE_KEYTERM_SURCHARGE,
  SCRIBE_USD_PER_AUDIO_HOUR,
  type CostEstimate,
  type GeminiUsage,
  type GeminiUsageDetail,
} from './pricing.js';
