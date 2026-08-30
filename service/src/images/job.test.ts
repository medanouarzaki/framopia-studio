import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { COSTS_PATH } from '@framopia/core';
import { createEditPlan, readEditPlan, writeEditPlan } from '../editplan/io.js';
import type { EditPlan, ImageSlot } from '../editplan/types.js';
import type { GeneratedImage, ImageGenerationClient, ImageGenerationRequest } from './client.js';
import type { RemoveBgResult } from './sidecar.js';
import {
  candidatesFor,
  cutoutDirFor,
  generateImagesForPlan,
  imagesReplacementFlags,
  ImagesReplaceBlockedError,
} from './job.js';

class FakeClient implements ImageGenerationClient {
  readonly requests: ImageGenerationRequest[] = [];
  async generate(request: ImageGenerationRequest): Promise<GeneratedImage> {
    this.requests.push(request);
    return {
      bytes: Uint8Array.from([1, 2, 3]),
      mimeType: 'image/png',
      usage: { promptTokenCount: 10, candidatesTokenCount: 1120 },
      text: null,
      width: 2048,
      height: 2048,
    };
  }
}

/** Stands in for the Python sidecar so the suite needs no venv. */
function fakeCutout(overrides: Partial<RemoveBgResult> = {}) {
  const calls: { imagePath: string; idea?: string; modeVocabulary?: string[] }[] = [];
  const fn = async (options: {
    imagePath: string; outPath: string; idea?: string; modeVocabulary?: string[];
  }): Promise<RemoveBgResult> => {
    calls.push({ imagePath: options.imagePath, idea: options.idea, modeVocabulary: options.modeVocabulary });
    return {
      ok: true, task: 'remove_bg',
      imagePath: options.imagePath, cutoutPath: options.outPath,
      model: 'birefnet-general', alphaMatting: false,
      postProcessMask: false,
      width: 2048, height: 2048,
      metrics: { alpha_edge_noise: 0, hole_ratio: 0, foreground_area: 0.15, edge_halo: 0.05 },
      gate: { presentation: 'cutout', passed: true, failures: [] },
      ocr: { hasText: false, detections: [], verdict: { hasText: false, expected: [], unexpected: [], ok: true } },
      ...overrides,
    } as RemoveBgResult;
  };
  return Object.assign(fn, { calls });
}

let dir: string;
let planPath: string;
let cacheRoot: string;
let costsPath: string;

let slotIndex = 0;
const slot = (id: string, idea: string): ImageSlot => ({
  // Distinct, non-overlapping windows: the validator rejects slots that
  // overlap in time, correctly.
  id, wordIds: ['w1'], start: slotIndex * 3, end: (slotIndex++ * 3) + 2,
  contextText: 'ctx', idea, prompt: `prompt ${id}`, negativePrompt: 'no watermark',
  candidates: [], chosenCandidateId: null, presentation: null,
  zoneId: null, templateId: null, status: 'pending',
});

async function makePlan(slots: ImageSlot[]): Promise<void> {
  const plan: EditPlan = createEditPlan({
    source: {
      videoPath: '/v.mov', sha256: 'a'.repeat(64), durationS: 25.7,
      fps: 30, width: 2160, height: 3840, audioPath: '/a.wav',
    },
    appVersion: '0.1.0', now: '2026-08-25T00:00:00.000Z', id: 'plan-1',
  });
  plan.transcript.words = [
    {
      id: 'w1', start: 0, end: 0.4, text: 'kolajin', sourceText: 'kolajin',
      lang: 'darija', script: 'latin', confidence: 0.9,
      removed: false, removedReason: null, edited: false,
    },
  ];
  plan.images.slots = slots;
  await writeEditPlan(planPath, plan);
}

beforeEach(async () => {
  slotIndex = 0;
  dir = mkdtempSync(path.join(tmpdir(), 'framopia-job-'));
  planPath = path.join(dir, 'reel.editplan.json');
  cacheRoot = path.join(dir, 'cache');
  costsPath = path.join(dir, 'costs.jsonl');
  await makePlan([slot('img001', 'A bottle of hair serum'), slot('img002', 'A salon shelf')]);
});

const run = (o: Record<string, unknown> = {}) =>
  generateImagesForPlan({
    planPath, modeId: 'k2-syndicalia',
    client: new FakeClient(), cutout: fakeCutout(),
    cacheRoot, costsPath, spendBaselineUsd: 0, ceilingUsd: 10,
    ...o,
  });

describe('generateImagesForPlan', () => {
  it('writes candidates onto every slot', async () => {
    const result = await run();
    const plan = await readEditPlan(planPath);
    expect(plan.images.slots).toHaveLength(2);
    for (const s of plan.images.slots) {
      expect(s.candidates).toHaveLength(2);
      expect(s.status).toBe('generated');
    }
    expect(result.billedImages).toBe(4);
  });

  it('fills the schema the DoD asks for', async () => {
    await run();
    const plan = await readEditPlan(planPath);
    const c = plan.images.slots[0]?.candidates[0];
    expect(c?.path).toBeTruthy();
    expect(c?.cutoutPath).toBeTruthy();
    expect(c?.cutoutQuality).toBeGreaterThan(0);
    expect(c?.metrics).toBeTruthy();
    expect(c?.gate?.presentation).toBe('cutout');
    expect(c?.detectedText).toEqual([]);
    expect(c?.textVerdict?.ok).toBe(true);
    expect(c?.costUsd).toBeGreaterThan(0);
  });

  it('takes the candidate count from the mode', async () => {
    const { loadMode } = await import('@framopia/core');
    const mode = loadMode('k2-syndicalia');
    const { parseImageConfig } = await import('./config.js');
    expect(candidatesFor(mode, parseImageConfig())).toBe(2);
  });

  it('passes the slot idea and mode vocabulary to the text check', async () => {
    const cutout = fakeCutout();
    await run({ cutout });
    expect(cutout.calls[0]?.idea).toBe('A bottle of hair serum');
    expect(cutout.calls[0]?.modeVocabulary).toEqual([]);
  });

  // Block 8's job, not this one's.
  it('never chooses a candidate', async () => {
    await run();
    const plan = await readEditPlan(planPath);
    for (const s of plan.images.slots) expect(s.chosenCandidateId).toBeNull();
  });

  it('sets presentation only when the candidates agree', async () => {
    await run();
    expect((await readEditPlan(planPath)).images.slots[0]?.presentation).toBe('cutout');

    slotIndex = 0;
    await makePlan([slot('img001', 'idea')]);
    let n = 0;
    const mixed = async (o: { imagePath: string; outPath: string }): Promise<RemoveBgResult> => {
      const passed = n++ === 0;
      return fakeCutout({
        gate: { presentation: passed ? 'cutout' : 'card', passed, failures: passed ? [] : ['hole_ratio 0.5 > 0.01'] },
      })(o);
    };
    await run({ cutout: mixed, cacheRoot: path.join(dir, 'cache2') });
    expect((await readEditPlan(planPath)).images.slots[0]?.presentation).toBeNull();
  });

  it('records the stage and its cost', async () => {
    await run();
    const plan = await readEditPlan(planPath);
    expect(plan.pipeline.images?.status).toBe('done');
    expect(plan.costs.byStage.images).toBeGreaterThan(0);
  });

  it('costs nothing and bills nothing on a second run', async () => {
    await run();
    const before = readFileSync(costsPath, 'utf8');
    const client = new FakeClient();
    const result = await run({ client });
    expect(client.requests).toHaveLength(0);
    expect(result.billedImages).toBe(0);
    expect(result.totalUsd).toBe(0);
    expect(readFileSync(costsPath, 'utf8')).toBe(before);
    // Zero rather than absent, so byStage stays diffable across runs.
    expect((await readEditPlan(planPath)).costs.byStage.images).toBe(0);
  });

  /**
   * Block 3 session 3 wrote eight fabricated ledger lines by billing in a
   * wrapper around a call that never happened. The real ledger must not move
   * when the suite runs.
   */
  it('never touches the real ledger', async () => {
    const before = existsSync(COSTS_PATH) ? readFileSync(COSTS_PATH, 'utf8') : '';
    await run();
    expect(existsSync(COSTS_PATH) ? readFileSync(COSTS_PATH, 'utf8') : '').toBe(before);
  });
});

describe('re-run protection', () => {
  it('says nothing about a plan nobody has touched', async () => {
    const plan = await readEditPlan(planPath);
    expect(imagesReplacementFlags(plan)).toEqual([]);
  });

  /**
   * Candidates alone are not a reason to block: they come back from the cache
   * byte-identical and free. A chosen candidate is a human's decision.
   */
  it('does not block on candidates alone', async () => {
    await run();
    const client = new FakeClient();
    await expect(run({ client })).resolves.toBeTruthy();
  });

  it('blocks on a chosen candidate and names it', async () => {
    await run();
    const plan = await readEditPlan(planPath);
    plan.images.slots[0]!.chosenCandidateId = plan.images.slots[0]!.candidates[0]!.id;
    await writeEditPlan(planPath, plan);

    const client = new FakeClient();
    await expect(run({ client })).rejects.toThrow(ImagesReplaceBlockedError);
    expect(client.requests).toHaveLength(0);
  });

  it('proceeds with force', async () => {
    await run();
    const plan = await readEditPlan(planPath);
    plan.images.slots[0]!.chosenCandidateId = plan.images.slots[0]!.candidates[0]!.id;
    await writeEditPlan(planPath, plan);
    await expect(run({ force: true })).resolves.toBeTruthy();
  });
});

describe('the text warning', () => {
  it('logs unexpected text without dropping the candidate', async () => {
    const lines: string[] = [];
    await run({
      cutout: fakeCutout({
        ocr: {
          hasText: true,
          detections: [{ text: 'LUXE', confidence: 0.9 }],
          verdict: { hasText: true, expected: [], unexpected: ['luxe'], ok: false },
        },
      }),
      log: (m: string) => lines.push(m),
    });
    expect(lines.join('\n')).toMatch(/unexpected text luxe/);

    const plan = await readEditPlan(planPath);
    const c = plan.images.slots[0]?.candidates[0];
    expect(c).toBeTruthy();
    expect(c?.textVerdict?.ok).toBe(false);
    expect(c?.textVerdict?.unexpected).toEqual(['luxe']);
  });
});

describe('cutoutDirFor', () => {
  // Every corpus plan lives in one directory and slot ids restart at img001 on
  // every reel, so a shared cutouts/ directory made the second reel's run
  // overwrite the first's file for file. That is what happened to eight of
  // vitasilk's ten cutouts in Block 9 session 12.
  it('gives two plans in one directory two directories', () => {
    const dir = '/videos';
    const a = cutoutDirFor(path.join(dir, 'vitasilk.editplan.json'));
    const b = cutoutDirFor(path.join(dir, 'test 1.editplan.json'));
    expect(a).not.toBe(b);
    expect(path.join(a, 'img001-c1.cutout.png')).not.toBe(path.join(b, 'img001-c1.cutout.png'));
  });

  it('names the directory after the plan, under cutouts/', () => {
    expect(cutoutDirFor('/videos/vitasilk.editplan.json')).toBe(
      path.join('/videos', 'cutouts', 'vitasilk'),
    );
    expect(cutoutDirFor('/videos/test 1.editplan.json')).toBe(
      path.join('/videos', 'cutouts', 'test 1'),
    );
  });

  it('stays inside the plan\'s own directory', () => {
    const planPath = '/a/b/reel.editplan.json';
    expect(cutoutDirFor(planPath).startsWith(path.dirname(planPath) + path.sep)).toBe(true);
  });
});

