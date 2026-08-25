import modelConfigJson from './model-config.json' with { type: 'json' };

export interface GeminiPrices {
  textInputUsdPerMillionTokens: number;
  audioInputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
}

/**
 * Resolution tiers Google prices image output at. Not every model offers
 * every tier — `gemini-3-pro-image` starts at 1K — so a tier is looked up per
 * model rather than assumed.
 */
export const IMAGE_RESOLUTIONS = ['0.5K', '1K', '2K', '4K'] as const;
export type ImageResolution = (typeof IMAGE_RESOLUTIONS)[number];

export interface GeminiImageModelPrices {
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  perImageUsd: Partial<Record<ImageResolution, number>>;
  /** ISO date, or null where Google has announced no shutdown. */
  retiresOn: string | null;
}

export interface GeminiImagePrices {
  asOf: string;
  source: string;
  note: string;
  models: Record<string, GeminiImageModelPrices>;
}

/**
 * The two candidate image models. Both stay live until Block 4 session 2
 * picks one by eye; nothing in code may assume either.
 */
export interface GeminiImageModels {
  pro: string;
  flash: string;
}

export interface ModelConfig {
  geminiModel: string;
  geminiPrices: GeminiPrices;
  geminiImageModels: GeminiImageModels;
  geminiImagePrices: GeminiImagePrices;
}

export const modelConfig: ModelConfig = modelConfigJson as ModelConfig;

export const GEMINI_IMAGE_MODEL_PRO = modelConfig.geminiImageModels.pro;
export const GEMINI_IMAGE_MODEL_FLASH = modelConfig.geminiImageModels.flash;
