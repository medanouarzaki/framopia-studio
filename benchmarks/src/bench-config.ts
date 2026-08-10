import benchConfigJson from './bench-config.json' with { type: 'json' };

export interface GeminiPrices {
  textInputUsdPerMillionTokens: number;
  audioInputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
}

export interface BenchConfig {
  geminiModel: string;
  geminiPrices: GeminiPrices;
}

export const benchConfig: BenchConfig = benchConfigJson;
