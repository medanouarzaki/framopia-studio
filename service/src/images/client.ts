import type { ImageResolution } from '@framopia/core';

export interface ImageGenerationRequest {
  modelId: string;
  prompt: string;
  negativePrompt: string;
  resolution: ImageResolution;
  aspectRatio: string;
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
  /**
   * Any text the model returned alongside the image, joined and trimmed.
   * These models take no separate negative-prompt field, so the negatives are
   * appended to the prompt as prose — if the model answers that prose
   * conversationally instead of obeying it, this is where it shows.
   */
  text: string | null;
  /** Pixel dimensions, when the response reports them. */
  width: number | null;
  height: number | null;
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
