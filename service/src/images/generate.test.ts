import { mkdtempSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  COSTS_PATH,
  GEMINI_IMAGE_MODEL_FLASH,
  GEMINI_IMAGE_MODEL_PRO,
  loadMode,
} from '@framopia/core';
import type { ImageSlot } from '../editplan/types.js';
import type { GeneratedImage, ImageGenerationClient, ImageGenerationRequest } from './client.js';
import { DEFAULT_IMAGE_CONFIG, parseImageConfig } from './config.js';
import {
  ImageBudgetExceededError,
  ImageCeilingReachedError,
  imageLedgerTotalUsd,
} from './estimate.js';
import { generateImages, ImageDimensionMismatchError } from './generate.js';

const mode = loadMode('k2-syndicalia');

/**
 * Records what it was asked for and returns three bytes. Nothing here reaches
 * a network, so a test that bills would be billing for a call that never
 * happened — which is the exact defect this fake exists to catch.
 */
class FakeClient implements ImageGenerationClient {
  readonly requests: ImageGenerationRequest[] = [];
  constructor(
    private readonly mimeType = 'image/png',
    private readonly size: { width: number | null; height: number | null } = {
      width: 1024,
      height: 1024,
    },
  ) {}
  async generate(request: ImageGenerationRequest): Promise<GeneratedImage> {
    this.requests.push(request);
    return {
      bytes: Uint8Array.from([1, 2, 3]),
      mimeType: this.mimeType,
      usage: { promptTokenCount: 10, candidatesTokenCount: 1120 },
      text: null,
      width: this.size.width,
      height: this.size.height,
    };
  }
}

function slot(id: string, index: number): ImageSlot {
  return {
    id, wordIds: [`w${index}`], start: index, end: index + 1,
    contextText: 'context', idea: `idea ${index}`,
    prompt: `prompt ${index}`, negativePrompt: 'no text, no watermark, no logo',
    candidates: [], chosenCandidateId: null, presentation: null,
    zoneId: null, templateId: null, status: 'pending',
  };
}

const SLOTS = [slot('img-1', 1), slot('img-2', 2)];
const VIDEO = 'a'.repeat(64);

let cacheRoot: string;
beforeEach(() => {
  cacheRoot = mkdtempSync(path.join(tmpdir(), 'framopia-images-'));
});

describe('generateImages', () => {
  it('asks the client once per slot per candidate', async () => {
    const client = new FakeClient();
    const config = parseImageConfig({ candidatesPerSlot: 3 });
    const result = await generateImages({
      slots: SLOTS, mode, config, client, videoSha256: VIDEO, cacheRoot,
    });
    expect(client.requests).toHaveLength(6);
    expect(result.candidates).toHaveLength(6);
    expect(result.billedImages).toBe(6);
    expect(result.cachedImages).toBe(0);
  });

  it('passes the slot prompt and negative prompt through unchanged', async () => {
    const client = new FakeClient();
    await generateImages({
      slots: [SLOTS[0]], mode, config: parseImageConfig({ candidatesPerSlot: 2 }),
      client, videoSha256: VIDEO, cacheRoot,
    });
    expect(client.requests[0].prompt).toBe(SLOTS[0].prompt);
    expect(client.requests[0].negativePrompt).toBe(SLOTS[0].negativePrompt);
    expect(client.requests[0].resolution).toBe('1K');
    expect(client.requests[0].aspectRatio).toBe('1:1');
  });

  it('writes the bytes and serves the second run from cache for free', async () => {
    const first = new FakeClient();
    const config = parseImageConfig({ candidatesPerSlot: 2 });
    const a = await generateImages({
      slots: SLOTS, mode, config, client: first, videoSha256: VIDEO, cacheRoot,
    });
    expect(first.requests).toHaveLength(4);
    for (const c of a.candidates) {
      expect(existsSync(c.path)).toBe(true);
      expect(readFileSync(c.path)).toEqual(Buffer.from([1, 2, 3]));
    }

    const second = new FakeClient();
    const b = await generateImages({
      slots: SLOTS, mode, config, client: second, videoSha256: VIDEO, cacheRoot,
    });
    expect(second.requests).toHaveLength(0);
    expect(b.cachedImages).toBe(4);
    expect(b.totalUsd).toBe(0);
    expect(b.candidates.map((c) => c.path)).toEqual(a.candidates.map((c) => c.path));
  });

  it('regenerates when the mode version bumps', async () => {
    const config = parseImageConfig({ candidatesPerSlot: 2 });
    await generateImages({
      slots: SLOTS, mode, config, client: new FakeClient(), videoSha256: VIDEO, cacheRoot,
    });
    const bumped = new FakeClient();
    await generateImages({
      slots: SLOTS, mode: { ...mode, version: mode.version + 1 }, config,
      client: bumped, videoSha256: VIDEO, cacheRoot,
    });
    expect(bumped.requests).toHaveLength(4);
  });

  it('reports an entry whose image file went missing and regenerates it', async () => {
    const config = parseImageConfig({ candidatesPerSlot: 2 });
    const first = await generateImages({
      slots: [SLOTS[0]], mode, config, client: new FakeClient(), videoSha256: VIDEO, cacheRoot,
    });
    const { rmSync } = await import('node:fs');
    rmSync(first.candidates[0].path);

    const again = new FakeClient();
    const result = await generateImages({
      slots: [SLOTS[0]], mode, config, client: again, videoSha256: VIDEO, cacheRoot,
    });
    expect(result.warnings.join(' ')).toMatch(/missing/);
    expect(again.requests).toHaveLength(1);
  });

  it('bypasses the cache when asked and still repopulates it', async () => {
    const config = parseImageConfig({ candidatesPerSlot: 2 });
    await generateImages({
      slots: [SLOTS[0]], mode, config, client: new FakeClient(), videoSha256: VIDEO, cacheRoot,
    });
    const forced = new FakeClient();
    await generateImages({
      slots: [SLOTS[0]], mode, config, client: forced, videoSha256: VIDEO, cacheRoot,
      useCache: false,
    });
    expect(forced.requests).toHaveLength(2);
  });

  it('aborts over the ceiling before asking the client for anything', async () => {
    const client = new FakeClient();
    await expect(
      generateImages({
        slots: SLOTS, mode, config: parseImageConfig({ ceilingUsd: 0.01, candidatesPerSlot: 4 }),
        client, videoSha256: VIDEO, cacheRoot,
      }),
    ).rejects.toThrow(ImageBudgetExceededError);
    expect(client.requests).toHaveLength(0);
  });

  it('prints an estimate naming the model before generating', async () => {
    const lines: string[] = [];
    await generateImages({
      slots: SLOTS, mode, config: DEFAULT_IMAGE_CONFIG, client: new FakeClient(),
      videoSha256: VIDEO, cacheRoot, log: (m) => lines.push(m),
    });
    const printed = lines.join('\n');
    expect(printed).toMatch(DEFAULT_IMAGE_CONFIG.modelId);
    expect(printed).toMatch(/6 images/);
  });
});

describe('the ledger', () => {
  let before: string;
  beforeEach(() => {
    before = existsSync(COSTS_PATH) ? readFileSync(COSTS_PATH, 'utf8') : '';
  });
  afterEach(() => {
    if (before !== '') writeFileSync(COSTS_PATH, before, 'utf8');
  });

  /**
   * Block 3 session 3 wrote eight fabricated ledger lines totalling $0.08
   * because a wrapper billed around a fake model. The whole generation path
   * runs here against a fake and the ledger must come out byte-identical.
   */
  it('is untouched by a full generation run against the fake client', async () => {
    const result = await generateImages({
      slots: SLOTS, mode, config: parseImageConfig({ candidatesPerSlot: 4 }),
      client: new FakeClient(), videoSha256: VIDEO, cacheRoot,
    });
    expect(result.billedImages).toBe(8);
    const after = existsSync(COSTS_PATH) ? readFileSync(COSTS_PATH, 'utf8') : '';
    expect(after).toBe(before);
  });

  it('is untouched by a cache hit even when billing is on', async () => {
    const config = parseImageConfig({ candidatesPerSlot: 2 });
    await generateImages({
      slots: SLOTS, mode, config, client: new FakeClient(), videoSha256: VIDEO, cacheRoot,
    });
    const snapshot = existsSync(COSTS_PATH) ? readFileSync(COSTS_PATH, 'utf8') : '';
    const result = await generateImages({
      slots: SLOTS, mode, config, client: new FakeClient(), videoSha256: VIDEO, cacheRoot,
      bill: true,
    });
    expect(result.cachedImages).toBe(4);
    expect(existsSync(COSTS_PATH) ? readFileSync(COSTS_PATH, 'utf8') : '').toBe(snapshot);
  });

  it('is untouched when the ceiling aborts the run', async () => {
    await expect(
      generateImages({
        slots: SLOTS, mode, config: parseImageConfig({ ceilingUsd: 0.001 }),
        client: new FakeClient(), videoSha256: VIDEO, cacheRoot, bill: true,
      }),
    ).rejects.toThrow(ImageBudgetExceededError);
    expect(existsSync(COSTS_PATH) ? readFileSync(COSTS_PATH, 'utf8') : '').toBe(before);
  });
});

describe('dimension checking', () => {
  /**
   * The session-2 defect, as a test. 2752x1536 came back for a 2K 1:1
   * request; nothing in the code could see it, so a human measured it with
   * `sips` afterwards.
   */
  it('rejects a response whose shape is not the one requested', async () => {
    const client = new FakeClient('image/jpeg', { width: 2752, height: 1536 });
    await expect(
      generateImages({
        slots: [SLOTS[0]], mode, config: parseImageConfig({ resolution: '2K' }),
        client, videoSha256: VIDEO, cacheRoot,
      }),
    ).rejects.toThrow(ImageDimensionMismatchError);
  });

  it('names both shapes in the error', async () => {
    const client = new FakeClient('image/jpeg', { width: 2752, height: 1536 });
    await expect(
      generateImages({
        slots: [SLOTS[0]], mode, config: parseImageConfig({ resolution: '2K' }),
        client, videoSha256: VIDEO, cacheRoot,
      }),
    ).rejects.toThrow(/2752x1536 for a request of 2048x2048/);
  });

  // A wrong-shaped image is an unpriced request, so it must not become a
  // cache entry the next run serves as a candidate.
  it('caches nothing and writes no ledger line when the shape is wrong', async () => {
    const before = existsSync(COSTS_PATH) ? readFileSync(COSTS_PATH, 'utf8') : '';
    await expect(
      generateImages({
        slots: [SLOTS[0]], mode, config: parseImageConfig({ resolution: '2K' }),
        client: new FakeClient('image/jpeg', { width: 2752, height: 1536 }),
        videoSha256: VIDEO, cacheRoot, bill: true,
      }),
    ).rejects.toThrow(ImageDimensionMismatchError);
    expect(readdirSync(cacheRoot)).toEqual([]);
    expect(existsSync(COSTS_PATH) ? readFileSync(COSTS_PATH, 'utf8') : '').toBe(before);
  });

  it('accepts the requested shape', async () => {
    const result = await generateImages({
      slots: [SLOTS[0]], mode,
      config: parseImageConfig({ resolution: '2K', candidatesPerSlot: 2 }),
      client: new FakeClient('image/png', { width: 2048, height: 2048 }),
      videoSha256: VIDEO, cacheRoot,
    });
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]?.width).toBe(2048);
  });

  /**
   * Unreadable bytes fail closed. An image that cannot be measured cannot be
   * confirmed to be the tier that was paid for, and this check exists
   * because an unverified assumption cost a session. The message
   * distinguishes the two cases so an operator knows which happened.
   */
  it('rejects when the dimensions could not be read at all', async () => {
    await expect(
      generateImages({
        slots: [SLOTS[0]], mode,
        config: parseImageConfig({ resolution: '2K', candidatesPerSlot: 2 }),
        client: new FakeClient('image/png', { width: null, height: null }),
        videoSha256: VIDEO, cacheRoot,
      }),
    ).rejects.toThrow(/dimensions could not be read/);
  });
});

describe('cache eviction across two arms of one run', () => {
  /**
   * The Block 4 session 3 defect, as a test. The eviction budget was this
   * call's own image count, so a second call over the same video and stage
   * evicted the first call's entries. The bake-off ran flash then pro over
   * one slot; the pro arm deleted the three flash entries, and the
   * "second invocation is a cache hit" check regenerated six images for
   * $0.51 instead of costing nothing.
   */
  it('does not evict the first model arm when the second arm runs', async () => {
    const flashFirst = new FakeClient();
    await generateImages({
      slots: [SLOTS[0]], mode,
      config: parseImageConfig({ modelId: GEMINI_IMAGE_MODEL_FLASH, candidatesPerSlot: 3 }),
      client: flashFirst, videoSha256: VIDEO, cacheRoot,
    });
    expect(flashFirst.requests).toHaveLength(3);

    await generateImages({
      slots: [SLOTS[0]], mode,
      config: parseImageConfig({ modelId: GEMINI_IMAGE_MODEL_PRO, candidatesPerSlot: 3 }),
      client: new FakeClient(), videoSha256: VIDEO, cacheRoot,
    });

    // Re-running the first arm must now cost nothing.
    const flashAgain = new FakeClient();
    const result = await generateImages({
      slots: [SLOTS[0]], mode,
      config: parseImageConfig({ modelId: GEMINI_IMAGE_MODEL_FLASH, candidatesPerSlot: 3 }),
      client: flashAgain, videoSha256: VIDEO, cacheRoot,
    });
    expect(flashAgain.requests).toHaveLength(0);
    expect(result.cachedImages).toBe(3);
    expect(result.totalUsd).toBe(0);
  });

  it('keeps both arms of a full bake-off on disk', async () => {
    for (const modelId of [GEMINI_IMAGE_MODEL_FLASH, GEMINI_IMAGE_MODEL_PRO]) {
      await generateImages({
        slots: [SLOTS[0]], mode, config: parseImageConfig({ modelId, candidatesPerSlot: 3 }),
        client: new FakeClient(), videoSha256: VIDEO, cacheRoot,
      });
    }
    const entries = readdirSync(path.join(cacheRoot, VIDEO)).filter((d) => d.startsWith('images-'));
    expect(entries).toHaveLength(6);
  });

  it('never evicts an entry the current run touched', async () => {
    // A budget far below what this run writes must still leave them all.
    const client = new FakeClient();
    await generateImages({
      slots: SLOTS, mode, config: parseImageConfig({ candidatesPerSlot: 4 }),
      client, videoSha256: VIDEO, cacheRoot,
    });
    const entries = readdirSync(path.join(cacheRoot, VIDEO)).filter((d) => d.startsWith('images-'));
    expect(entries).toHaveLength(8);
  });
});

/**
 * Bills well above the price table, the way the real models do: ten images at
 * exact published pairs came in +11% to +26%. The plain fake bills under its
 * estimate, which would leave the per-request check unreachable.
 */
class ExpensiveFakeClient extends FakeClient {
  override async generate(request: ImageGenerationRequest): Promise<GeneratedImage> {
    const image = await super.generate(request);
    return { ...image, usage: { promptTokenCount: 200, candidatesTokenCount: 2600 } };
  }
}

describe('the ceiling as a running check', () => {
  let costsPath: string;
  // 2K requests, so the fake must return the shape the dimension check wants.
  const fake = (): FakeClient => new FakeClient('image/png', { width: 2048, height: 2048 });
  const at2K = (modelId: string, candidatesPerSlot: number, ceilingUsd: number) =>
    parseImageConfig({ modelId, resolution: '2K', candidatesPerSlot, ceilingUsd });

  beforeEach(() => {
    costsPath = path.join(cacheRoot, 'costs.jsonl');
  });

  /**
   * The Block 4 session 3 overrun, as a test. The ceiling was checked once,
   * pre-flight, against an estimate; two arms each passed their own check and
   * the session went $0.33 over. Both arms now share one baseline, so the
   * second sees what the first spent.
   */
  it('stops the second arm once the shared ceiling is reached', async () => {
    // A ceiling that admits the flash arm and not both arms.
    await generateImages({
      slots: [SLOTS[0]], mode, config: at2K(GEMINI_IMAGE_MODEL_FLASH, 3, 0.35),
      client: fake(), videoSha256: VIDEO, cacheRoot,
      bill: true, costsPath, spendBaselineUsd: 0,
    });

    const second = fake();
    await expect(
      generateImages({
        slots: [SLOTS[0]], mode, config: at2K(GEMINI_IMAGE_MODEL_PRO, 3, 0.35),
        client: second, videoSha256: VIDEO, cacheRoot,
        bill: true, costsPath, spendBaselineUsd: 0,
      }),
    ).rejects.toThrow(ImageBudgetExceededError);
    // Aborted before asking for anything: the first arm had spent the budget.
    expect(second.requests).toHaveLength(0);
  });

  /**
   * The case the pre-flight check cannot catch: the estimate fits, the
   * actuals do not. This is the real shape of the risk, since every measured
   * image has billed above its published rate.
   */
  it('stops mid-run when actuals overrun an estimate that passed pre-flight', async () => {
    const client = new ExpensiveFakeClient('image/png', { width: 2048, height: 2048 });
    await expect(
      generateImages({
        slots: [SLOTS[0]], mode, config: at2K(GEMINI_IMAGE_MODEL_FLASH, 3, 0.31),
        client, videoSha256: VIDEO, cacheRoot,
        bill: true, costsPath, spendBaselineUsd: 0,
      }),
    ).rejects.toThrow(ImageCeilingReachedError);
    expect(client.requests.length).toBeGreaterThan(0);
    expect(client.requests.length).toBeLessThan(3);
  });

  it('aborts rather than truncating, and says so', async () => {
    await expect(
      generateImages({
        slots: [SLOTS[0]], mode, config: at2K(GEMINI_IMAGE_MODEL_FLASH, 3, 0.31),
        client: new ExpensiveFakeClient('image/png', { width: 2048, height: 2048 }),
        videoSha256: VIDEO, cacheRoot, bill: true, costsPath, spendBaselineUsd: 0,
      }),
    ).rejects.toThrow(/aborted, not truncated/);
  });

  it('refuses a run whose estimate alone exceeds what is left', async () => {
    const client = fake();
    await expect(
      generateImages({
        slots: [SLOTS[0]], mode, config: at2K(GEMINI_IMAGE_MODEL_FLASH, 4, 0.25),
        client, videoSha256: VIDEO, cacheRoot,
        bill: true, costsPath, spendBaselineUsd: 0,
      }),
    ).rejects.toThrow(ImageBudgetExceededError);
    expect(client.requests).toHaveLength(0);
  });

  it('reads actual spend back from the ledger, not the estimate', async () => {
    await generateImages({
      slots: [SLOTS[0]], mode, config: at2K(GEMINI_IMAGE_MODEL_FLASH, 2, 10),
      client: fake(), videoSha256: VIDEO, cacheRoot,
      bill: true, costsPath, spendBaselineUsd: 0,
    });
    // The fake's usage differs from the price table, so this can only have
    // come from the ledger.
    const total = imageLedgerTotalUsd(costsPath);
    expect(total).toBeGreaterThan(0);
    expect(total).not.toBeCloseTo(2 * 0.101, 4);
  });

  it('lets a cache hit through, since it spends nothing', async () => {
    const config = at2K(GEMINI_IMAGE_MODEL_FLASH, 2, 0.25);
    await generateImages({
      slots: [SLOTS[0]], mode, config, client: fake(),
      videoSha256: VIDEO, cacheRoot, bill: true, costsPath, spendBaselineUsd: 0,
    });
    const again = fake();
    const result = await generateImages({
      slots: [SLOTS[0]], mode, config, client: again,
      videoSha256: VIDEO, cacheRoot, bill: true, costsPath, spendBaselineUsd: 0,
    });
    expect(again.requests).toHaveLength(0);
    expect(result.cachedImages).toBe(2);
  });

  it('counts only spend after the baseline', async () => {
    writeFileSync(
      costsPath,
      `${JSON.stringify({ stage: 'images-generate', model: 'm', unit: 'image', usd: 5, timestamp: 't' })}\n`,
      'utf8',
    );
    const client = fake();
    await generateImages({
      slots: [SLOTS[0]], mode, config: at2K(GEMINI_IMAGE_MODEL_FLASH, 2, 0.25),
      client, videoSha256: VIDEO, cacheRoot,
      bill: true, costsPath, spendBaselineUsd: 5,
    });
    expect(client.requests).toHaveLength(2);
  });
});
