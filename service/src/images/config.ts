import {
  ALLOWED_IMAGE_RESOLUTIONS,
  GEMINI_IMAGE_MODEL_FLASH,
  GEMINI_IMAGE_MODEL_PRO,
  imageModelPrices,
  isAllowedImageResolution,
  type ImageResolution,
} from '@framopia/core';

export class ImageConfigError extends Error {}

/**
 * ARCHITECTURE §5.4: 2-4 candidates per slot, default 3, mode-overridable.
 */
export const MIN_CANDIDATES_PER_SLOT = 2;
export const MAX_CANDIDATES_PER_SLOT = 4;
export const DEFAULT_CANDIDATES_PER_SLOT = 3;

/**
 * Aborts a run before the first call. Chosen, not measured: five slots at
 * three candidates on the pro model is $2.01, so this stops a mistake in the
 * slot count rather than sitting just above a normal reel.
 */
export const DEFAULT_CEILING_USD = 3;

/**
 * The ratios the API accepts (`ImageConfig.aspectRatio`). Only 1:1 is allowed
 * here: TEMPLATE_LIBRARY_GUIDE §3 has image comps at 1200x1200, so a
 * non-square generation is cropped before anyone sees it.
 */
export const ALLOWED_ASPECT_RATIOS = ['1:1'] as const;
export type AspectRatio = (typeof ALLOWED_ASPECT_RATIOS)[number];

export interface ImageGenerationConfig {
  modelId: string;
  resolution: ImageResolution;
  /**
   * Must be sent explicitly. The API does not default to square: leaving it
   * unset produced a 2752x1536 landscape image against a 2K 1:1 request in
   * Block 4 session 2, which also billed 21% over the per-image estimate
   * because the tier served was not the tier requested.
   */
  aspectRatio: AspectRatio;
  candidatesPerSlot: number;
  ceilingUsd: number;
}

/**
 * 1K until session 2 says otherwise. The largest negative zone in a 2160x3840
 * frame is about 1700 px across and TEMPLATE_LIBRARY_GUIDE §3 has image comps
 * at 1200x1200, so anything above 2K is paid-for pixels that get scaled away.
 */
export const DEFAULT_IMAGE_CONFIG: ImageGenerationConfig = {
  modelId: GEMINI_IMAGE_MODEL_FLASH,
  resolution: '1K',
  aspectRatio: '1:1',
  candidatesPerSlot: DEFAULT_CANDIDATES_PER_SLOT,
  ceilingUsd: DEFAULT_CEILING_USD,
};

export interface ImageConfigIssue {
  path: string;
  message: string;
}

/**
 * Reports every problem at once with a dotted path, the way the mode and Edit
 * Plan validators do, rather than throwing on the first.
 */
export function validateImageConfig(config: Partial<ImageGenerationConfig>): ImageConfigIssue[] {
  const issues: ImageConfigIssue[] = [];

  if (typeof config.modelId !== 'string' || config.modelId.length === 0) {
    issues.push({ path: 'modelId', message: 'must be a non-empty string' });
  } else {
    try {
      imageModelPrices(config.modelId);
    } catch {
      issues.push({
        path: 'modelId',
        message: `"${config.modelId}" has no pricing in core; add it to model-config.json first`,
      });
    }
  }

  if (typeof config.resolution !== 'string') {
    issues.push({ path: 'resolution', message: 'must be a string' });
  } else if (!isAllowedImageResolution(config.resolution)) {
    // 4K is the case this rule exists for, so it is named rather than lumped
    // in with a typo.
    const why =
      config.resolution === '4K'
        ? 'the image comps work at 1200x1200, so 4K is paid-for pixels that get scaled away'
        : `allowed: ${ALLOWED_IMAGE_RESOLUTIONS.join(', ')}`;
    issues.push({ path: 'resolution', message: `"${config.resolution}" is rejected — ${why}` });
  }

  if (typeof config.aspectRatio !== 'string') {
    issues.push({ path: 'aspectRatio', message: 'must be a string' });
  } else if (!(ALLOWED_ASPECT_RATIOS as readonly string[]).includes(config.aspectRatio)) {
    issues.push({
      path: 'aspectRatio',
      message: `"${config.aspectRatio}" is rejected — the image comps are square (1200x1200); allowed: ${ALLOWED_ASPECT_RATIOS.join(', ')}`,
    });
  }

  const n = config.candidatesPerSlot;
  if (typeof n !== 'number' || !Number.isInteger(n)) {
    issues.push({ path: 'candidatesPerSlot', message: 'must be an integer' });
  } else if (n < MIN_CANDIDATES_PER_SLOT || n > MAX_CANDIDATES_PER_SLOT) {
    issues.push({
      path: 'candidatesPerSlot',
      message: `must be ${MIN_CANDIDATES_PER_SLOT}-${MAX_CANDIDATES_PER_SLOT} (ARCHITECTURE §5.4), got ${n}`,
    });
  }

  if (typeof config.ceilingUsd !== 'number' || Number.isNaN(config.ceilingUsd)) {
    issues.push({ path: 'ceilingUsd', message: 'must be a number' });
  } else if (config.ceilingUsd <= 0) {
    issues.push({ path: 'ceilingUsd', message: 'must be greater than zero' });
  }

  // Both candidates stay selectable until session 2 decides; this only warns
  // against a model that is neither.
  if (
    typeof config.modelId === 'string' &&
    config.modelId !== GEMINI_IMAGE_MODEL_PRO &&
    config.modelId !== GEMINI_IMAGE_MODEL_FLASH &&
    issues.every((i) => i.path !== 'modelId')
  ) {
    const prices = imageModelPrices(config.modelId);
    if (prices.retiresOn !== null) {
      issues.push({
        path: 'modelId',
        message: `"${config.modelId}" retires on ${prices.retiresOn} and must not be used`,
      });
    }
  }

  return issues;
}

export function parseImageConfig(
  overrides: Partial<ImageGenerationConfig> = {},
): ImageGenerationConfig {
  const merged = { ...DEFAULT_IMAGE_CONFIG, ...overrides };
  const issues = validateImageConfig(merged);
  if (issues.length > 0) {
    throw new ImageConfigError(
      `Invalid image generation config:\n${issues.map((i) => `  ${i.path}: ${i.message}`).join('\n')}`,
    );
  }
  return merged;
}
