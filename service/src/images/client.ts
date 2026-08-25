import type { ImageResolution } from '@framopia/core';

export interface ImageGenerationRequest {
  modelId: string;
  prompt: string;
  negativePrompt: string;
  resolution: ImageResolution;
}

export interface ImageGenerationUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
}

export interface GeneratedImage {
  bytes: Uint8Array;
  /** IANA type as reported by the API, e.g. `image/png`. */
  mimeType: string;
  usage: ImageGenerationUsage;
}

/**
 * One method, prompt in and bytes out. Everything above this interface is
 * pure or filesystem work, so the whole generation path can be exercised
 * against a fake and a test can assert nothing was billed.
 */
export interface ImageGenerationClient {
  generate(request: ImageGenerationRequest): Promise<GeneratedImage>;
}

export class ImageGenerationError extends Error {
  constructor(
    message: string,
    readonly modelId: string,
    readonly cause_?: unknown,
  ) {
    super(message);
    this.name = 'ImageGenerationError';
  }
}
