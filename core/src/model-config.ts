import modelConfigJson from './model-config.json' with { type: 'json' };

export interface GeminiPrices {
  textInputUsdPerMillionTokens: number;
  audioInputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
}

export interface ModelConfig {
  geminiModel: string;
  geminiPrices: GeminiPrices;
}

export const modelConfig: ModelConfig = modelConfigJson;
