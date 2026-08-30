import { GoogleGenAI } from '@google/genai';
import {
  loadConfig,
  withTransientRetry,
  type ImageResolution,
  type RetryAttemptReport,
} from '@framopia/core';
import { readImageDimensions } from './image-dimensions.js';
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
  private readonly onRetry: ((report: RetryAttemptReport) => void) | undefined;

  constructor(apiKey = loadConfig().googleApiKey, onRetry?: (report: RetryAttemptReport) => void) {
    this.ai = new GoogleGenAI({ apiKey });
    this.onRetry = onRetry;
  }

  async generate(request: ImageGenerationRequest): Promise<GeneratedImage> {
    const text =
      request.negativePrompt.length > 0
        ? `${request.prompt}\n\nAvoid: ${request.negativePrompt}`
        : request.prompt;

    let response;
    try {
      /*
       * ARCHITECTURE §8. Block 10 session 7 lost a twelve-request batch to a
       * 503 on the first call, because this was the one billable client with no
       * retry. Only the request is inside the retry: everything below reads a
       * response that has already arrived, so a decode that throws is a defect
       * rather than something to send again.
       */
      response = await withTransientRetry(
        () =>
          this.ai.models.generateContent({
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
          }),
        this.onRetry === undefined ? {} : { onRetry: this.onRetry },
      );
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

    const bytes = Buffer.from(inline.data, 'base64');
    const mimeType = inline.mimeType ?? 'image/png';
    const dimensions = readImageDimensions(bytes, mimeType);

    return {
      bytes,
      mimeType,
      usage: {
        promptTokenCount: response.usageMetadata?.promptTokenCount,
        candidatesTokenCount: response.usageMetadata?.candidatesTokenCount,
      },
      text: returnedText.length > 0 ? returnedText : null,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    };
  }
}
