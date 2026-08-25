import { GoogleGenAI } from '@google/genai';
import { loadConfig, type ImageResolution } from '@framopia/core';
import {
  ImageGenerationError,
  type GeneratedImage,
  type ImageGenerationClient,
  type ImageGenerationRequest,
} from './client.js';

/** The tier name Google's image models take in `imageConfig.imageSize`. */
function imageSizeFor(resolution: ImageResolution): string {
  return resolution;
}

/**
 * The real client. **Not invoked in Block 4 session 1** — it exists so the
 * interface is written against a concrete implementation rather than a guess,
 * and session 2 is the first run that calls it.
 *
 * The negative prompt is appended to the prompt text: the image models take
 * no separate negative-prompt field, unlike Imagen.
 */
export class GeminiImageClient implements ImageGenerationClient {
  private readonly ai: GoogleGenAI;

  constructor(apiKey = loadConfig().googleApiKey) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generate(request: ImageGenerationRequest): Promise<GeneratedImage> {
    const text =
      request.negativePrompt.length > 0
        ? `${request.prompt}\n\nAvoid: ${request.negativePrompt}`
        : request.prompt;

    let response;
    try {
      response = await this.ai.models.generateContent({
        model: request.modelId,
        contents: text,
        config: {
          imageConfig: {
            imageSize: imageSizeFor(request.resolution),
            // Sent explicitly: the API picks its own ratio otherwise, and
            // picked 16:9 for a 2K request in Block 4 session 2.
            aspectRatio: request.aspectRatio,
          },
        },
      });
    } catch (error) {
      throw new ImageGenerationError(
        `Image generation failed for ${request.modelId}: ${String(error)}`,
        request.modelId,
        error,
      );
    }

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const inline = parts.find((p) => p.inlineData?.data !== undefined)?.inlineData;
    if (inline?.data === undefined) {
      // A text-only response means the model refused or the prompt tripped a
      // safety filter. Throwing beats writing a zero-byte candidate that
      // looks like a generated image on disk.
      throw new ImageGenerationError(
        `${request.modelId} returned no image part; the prompt may have been refused`,
        request.modelId,
      );
    }

    const returnedText = parts
      .map((p) => p.text)
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      .join('\n')
      .trim();

    return {
      bytes: Buffer.from(inline.data, 'base64'),
      mimeType: inline.mimeType ?? 'image/png',
      usage: {
        promptTokenCount: response.usageMetadata?.promptTokenCount,
        candidatesTokenCount: response.usageMetadata?.candidatesTokenCount,
      },
      text: returnedText.length > 0 ? returnedText : null,
      width: null,
      height: null,
    };
  }
}
