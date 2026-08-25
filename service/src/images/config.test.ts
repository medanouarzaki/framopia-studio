import { describe, expect, it } from 'vitest';
import { GEMINI_IMAGE_MODEL_FLASH, GEMINI_IMAGE_MODEL_PRO } from '@framopia/core';
import {
  DEFAULT_IMAGE_CONFIG,
  ImageConfigError,
  parseImageConfig,
  validateImageConfig,
} from './config.js';

describe('validateImageConfig', () => {
  it('accepts the default', () => {
    expect(validateImageConfig(DEFAULT_IMAGE_CONFIG)).toEqual([]);
  });

  it('accepts both candidate models at 1K and 2K', () => {
    for (const modelId of [GEMINI_IMAGE_MODEL_PRO, GEMINI_IMAGE_MODEL_FLASH]) {
      for (const resolution of ['1K', '2K'] as const) {
        expect(validateImageConfig({ ...DEFAULT_IMAGE_CONFIG, modelId, resolution })).toEqual([]);
      }
    }
  });

  it('rejects 4K and says why', () => {
    const issues = validateImageConfig({ ...DEFAULT_IMAGE_CONFIG, resolution: '4K' as never });
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe('resolution');
    expect(issues[0].message).toMatch(/scaled away/);
  });

  it('rejects a model with no pricing in core', () => {
    const issues = validateImageConfig({ ...DEFAULT_IMAGE_CONFIG, modelId: 'gemini-9-imaginary' });
    expect(issues.map((i) => i.path)).toEqual(['modelId']);
  });

  it('rejects a model that retires, even though it is priced', () => {
    const issues = validateImageConfig({
      ...DEFAULT_IMAGE_CONFIG,
      modelId: 'gemini-2.5-flash-image',
    });
    expect(issues.map((i) => i.message).join(' ')).toMatch(/retires on 2026-10-02/);
  });

  it('holds candidatesPerSlot to the 2-4 of ARCHITECTURE 5.4', () => {
    for (const n of [2, 3, 4]) {
      expect(validateImageConfig({ ...DEFAULT_IMAGE_CONFIG, candidatesPerSlot: n })).toEqual([]);
    }
    for (const n of [0, 1, 5, 2.5]) {
      expect(
        validateImageConfig({ ...DEFAULT_IMAGE_CONFIG, candidatesPerSlot: n }).length,
      ).toBeGreaterThan(0);
    }
  });

  it('rejects a ceiling of zero or less', () => {
    expect(validateImageConfig({ ...DEFAULT_IMAGE_CONFIG, ceilingUsd: 0 })).toHaveLength(1);
    expect(validateImageConfig({ ...DEFAULT_IMAGE_CONFIG, ceilingUsd: -1 })).toHaveLength(1);
  });

  it('reports every problem at once', () => {
    const issues = validateImageConfig({
      modelId: 'nope', resolution: '4K' as never, candidatesPerSlot: 99, ceilingUsd: 0,
    });
    expect(issues.map((i) => i.path).sort()).toEqual([
      'candidatesPerSlot', 'ceilingUsd', 'modelId', 'resolution',
    ]);
  });
});

describe('parseImageConfig', () => {
  it('fills unspecified fields from the default', () => {
    expect(parseImageConfig({ resolution: '2K' })).toEqual({
      ...DEFAULT_IMAGE_CONFIG,
      resolution: '2K',
    });
  });

  it('defaults to a 1K tier, never 4K', () => {
    expect(parseImageConfig().resolution).toBe('1K');
  });

  it('throws on 4K rather than silently downgrading it', () => {
    expect(() => parseImageConfig({ resolution: '4K' as never })).toThrow(ImageConfigError);
  });
});
