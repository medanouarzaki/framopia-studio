import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COSTS_PATH, REPO_ROOT } from '@framopia/core';
import { createEditPlan, readEditPlan, writeEditPlan } from '../editplan/io.js';
import type { EditPlan, ImageSlot } from '../editplan/types.js';
import type { GeneratedImage, ImageGenerationClient, ImageGenerationRequest } from './client.js';
import { generateImagesForPlan } from './job.js';
import { SIDECAR_PYTHON } from './sidecar.js';

/**
 * The job against the **real** Python sidecar — real background removal, real
 * metrics, real gate, real OCR, real plan write. Only the paid generation is
 * substituted, by a client that hands back a real image already on disk.
 *
 * This is the seam the unit tests cannot cover: everything there uses a fake
 * sidecar, so nothing proved the job could talk to the actual one. It matters
 * because the paid half is currently unrunnable — the Gemini account's
 * prepayment credits are depleted — and this is the part of the stage that
 * can still be verified.
 *
 * It writes to a temp plan, never to a real one. A candidate whose bytes came
 * from a different slot's image would be a fabricated fixture, and a plan
 * that looks populated without a generation run having happened is exactly
 * the thing not to leave lying around.
 */
const CORPUS = path.join(
  REPO_ROOT, 'benchmarks', 'results', 'latest-imagebakeoff', 'gemini-3-pro-image-1.jpg',
);

const runnable = existsSync(CORPUS) && existsSync(SIDECAR_PYTHON);

class ReplayClient implements ImageGenerationClient {
  readonly requests: ImageGenerationRequest[] = [];
  constructor(private readonly file: string) {}
  async generate(request: ImageGenerationRequest): Promise<GeneratedImage> {
    this.requests.push(request);
    return {
      bytes: readFileSync(this.file),
      mimeType: 'image/jpeg',
      usage: { promptTokenCount: 200, candidatesTokenCount: 1120 },
      text: null,
      width: 2048,
      height: 2048,
    };
  }
}

describe.runIf(runnable)('the image job against the real sidecar', () => {
  it('cuts out, gates, checks text and writes it all onto the plan', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-integration-'));
    const planPath = path.join(dir, 'reel.editplan.json');
    const costsPath = path.join(dir, 'costs.jsonl');

    const slot: ImageSlot = {
      id: 'img001', wordIds: ['w1'], start: 0, end: 2,
      contextText: 'ctx',
      idea: 'A cosmetic bottle of hair serum on a presentation podium',
      prompt: 'p', negativePrompt: 'no watermark, no logo',
      candidates: [], chosenCandidateId: null, presentation: null,
      zoneId: null, templateId: null, status: 'pending',
    };

    const plan: EditPlan = createEditPlan({
      source: {
        videoPath: '/v.mov', sha256: 'b'.repeat(64), durationS: 25.7,
        fps: 30, width: 2160, height: 3840, audioPath: '/a.wav',
      },
      appVersion: '0.1.0', now: '2026-08-25T00:00:00.000Z', id: 'integration-1',
    });
    plan.transcript.words = [
      {
        id: 'w1', start: 0, end: 0.4, text: 'kolajin', sourceText: 'kolajin',
        lang: 'darija', script: 'latin', confidence: 0.9,
        removed: false, removedReason: null, edited: false,
      },
    ];
    plan.images.slots = [slot];
    await writeEditPlan(planPath, plan);

    const ledgerBefore = existsSync(COSTS_PATH) ? readFileSync(COSTS_PATH, 'utf8') : '';

    await generateImagesForPlan({
      planPath, modeId: 'k2-syndicalia',
      client: new ReplayClient(CORPUS),
      cacheRoot: path.join(dir, 'cache'),
      costsPath, spendBaselineUsd: 0, ceilingUsd: 10,
    });

    const written = await readEditPlan(planPath);
    const candidates = written.images.slots[0]?.candidates ?? [];
    expect(candidates).toHaveLength(2);

    for (const c of candidates) {
      expect(existsSync(c.cutoutPath ?? '')).toBe(true);
      expect(c.metrics?.foregroundArea).toBeGreaterThan(0);
      expect(c.gate?.presentation).toBe('cutout');
      expect(c.cutoutQuality).toBeGreaterThan(0);
    }

    // The regression case end to end: this image carries HAIR SERUM, the slot
    // is about hair serum, so the verdict is clean.
    const verdict = candidates[0]?.textVerdict;
    expect(verdict?.hasText).toBe(true);
    expect(verdict?.expected).toEqual(expect.arrayContaining(['hair', 'serum']));
    expect(verdict?.unexpected).toEqual([]);
    expect(verdict?.ok).toBe(true);

    expect(written.images.slots[0]?.presentation).toBe('cutout');
    expect(written.images.slots[0]?.status).toBe('generated');
    expect(written.images.slots[0]?.chosenCandidateId).toBeNull();

    // The real ledger must not move for a test.
    expect(existsSync(COSTS_PATH) ? readFileSync(COSTS_PATH, 'utf8') : '').toBe(ledgerBefore);
  /*
   * Two real BiRefNet cutouts plus OCR. Measured rather than guessed:
   * **39 s with After Effects idle** (Block 7 session 11), matching Block 4's
   * 35 s, and **~153 s when AE is caching a comp at ~490% CPU** — one cutout
   * alone went 18 s idle to 72 s loaded, a 3.9x contention factor. Nothing in
   * the CV path got slower; the machine did. The bound clears the measured
   * loaded case with headroom and is deliberately not wider than that.
   */
  }, 240_000);
});
