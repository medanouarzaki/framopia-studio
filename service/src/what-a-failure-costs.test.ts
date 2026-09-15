import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runPipeline, PipelineError, type PipelineStageImpl } from './pipeline.js';
import { createEditPlan, readEditPlan, writeEditPlan, editPlanPathFor } from './editplan/io.js';
import { dryRun } from './dry-run.js';
import { loadMode } from '@framopia/core';
import { generateImages } from './images/generate.js';
import { parseImageConfig } from './images/config.js';
import type {
  GeneratedImage,
  ImageGenerationClient,
  ImageGenerationRequest,
} from './images/client.js';
import type { ImageSlot } from './editplan/types.js';
import type { EditPlan } from './editplan/types.js';

/**
 * **What a failure costs him**, measured rather than reasoned.
 *
 * Block 14 session 113. Every real defect since session 84 was found by Mohamed
 * using the tool, not by a test, so the next one will be a shape no test
 * anticipates. This file does not try to prevent it. It measures what it costs
 * when a run stops part-way: what he has paid by then, what survives on the
 * plan and in the caches, and what a second press has to buy again.
 *
 * **Every stage is injected and no request can leave.** The scratch reel is a
 * registry entry pointing at an empty file that nothing opens, its plan goes to
 * a temporary directory through `FRAMOPIA_PLANS_DIR`, and the ledger is a
 * temporary file. Sessions 69 and 70 put five scratch reels on Mohamed's money
 * screen by not doing the last two.
 */
const SCRATCH = 'a scratch reel session 113 made';

let dir = '';
let videoPath = '';
let ledger = '';
let planPath = '';
const savedRegistry = process.env['FRAMOPIA_VIDEO_REGISTRY'];
const savedPlans = process.env['FRAMOPIA_PLANS_DIR'];

/** No request may leave this machine, and that is checked rather than intended. */
const attempted: string[] = [];
const realFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = ((input: unknown): never => {
    attempted.push(String(input));
    throw new Error('this file may not reach the network');
  }) as unknown as typeof fetch;

  dir = mkdtempSync(path.join(tmpdir(), 'framopia-failure-'));
  mkdirSync(path.join(dir, 'plans'), { recursive: true });
  videoPath = path.join(dir, 'scratch.mov');
  writeFileSync(videoPath, '');
  ledger = path.join(dir, 'costs.jsonl');
  writeFileSync(ledger, '');
  writeFileSync(
    path.join(dir, 'videos.json'),
    JSON.stringify({
      videos: [
        {
          label: SCRATCH,
          path: videoPath,
          durationS: 41,
          fps: 30,
          width: 2160,
          height: 3840,
          sha256: 'a'.repeat(64),
          openedAt: '2026-09-15T00:00:00.000Z',
        },
      ],
    }),
  );
  process.env['FRAMOPIA_VIDEO_REGISTRY'] = path.join(dir, 'videos.json');
  process.env['FRAMOPIA_PLANS_DIR'] = path.join(dir, 'plans');
  planPath = editPlanPathFor(videoPath);
});

afterAll(() => {
  globalThis.fetch = realFetch;
  if (savedRegistry === undefined) delete process.env['FRAMOPIA_VIDEO_REGISTRY'];
  else process.env['FRAMOPIA_VIDEO_REGISTRY'] = savedRegistry;
  if (savedPlans === undefined) delete process.env['FRAMOPIA_PLANS_DIR'];
  else process.env['FRAMOPIA_PLANS_DIR'] = savedPlans;
  rmSync(dir, { recursive: true, force: true });
  expect(attempted).toEqual([]);
});

/** The preflight and the two build measurements: disk and ffmpeg, not this. */
function hooks(): { preflight: () => void; measure: () => Promise<void> } {
  return { preflight: () => undefined, measure: async () => undefined };
}

function freshPlan(): void {
  rmSync(planPath, { force: true });
  const plan = createEditPlan({
    source: {
      videoPath,
      sha256: 'a'.repeat(64),
      durationS: 41,
      fps: 30,
      width: 2160,
      height: 3840,
      audioPath: path.join(dir, 'scratch.wav'),
    },
    appVersion: '0.0.0-session113',
    now: '2026-09-15T00:00:00.000Z',
  });
  writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
}

/**
 * Stages that write the plan exactly where the real ones write it.
 *
 * The real `analyseKeywordsForPlan` sets `pipeline.analysis` to done and writes
 * before `planImageSlotsForPlan` is called at all; the real
 * `planImageSlotsForPlan` sets `pipeline.images` and writes. Reproducing that
 * split is the whole point — the question this file asks is what survives when
 * the second of the two never runs.
 */
async function markKeywords(): Promise<{ analysis: { costUsd: number }; cached: boolean }> {
  const plan = await readEditPlan(planPath);
  plan.pipeline.analysis = {
    status: 'done', config: 'session113', costUsd: 0.18, cached: false,
    completedAt: '2026-09-15T00:00:01.000Z', error: null,
  };
  plan.costs.spentUsd = (plan.costs.spentUsd ?? 0) + 0.18;
  await writeEditPlan(planPath, plan);
  return { analysis: { costUsd: 0.18 }, cached: false };
}

async function markSlots(slots: number): Promise<{ analysis: { costUsd: number }; cached: boolean }> {
  const plan = await readEditPlan(planPath);
  plan.images = {
    slots: Array.from({ length: slots }, (_, i) => ({
      id: `slot${String(i + 1)}`,
      wordIds: [`w${String(i * 2 + 1)}`],
      start: i * 4,
      end: i * 4 + 1.5,
      contextText: 'what she is saying here',
      idea: 'a picture',
      prompt: 'a prompt',
      negativePrompt: '',
      candidates: [],
      chosenCandidateId: null,
      zoneId: null,
      templateId: null,
      status: 'pending' as const,
      presentation: 'card' as const,
    })) as unknown as EditPlan['images']['slots'],
  };
  plan.pipeline.images = {
    status: 'done', config: 'session113', costUsd: 0.06, cached: false,
    completedAt: '2026-09-15T00:00:02.000Z', error: null,
  };
  plan.costs.spentUsd = (plan.costs.spentUsd ?? 0) + 0.06;
  await writeEditPlan(planPath, plan);
  return { analysis: { costUsd: 0.06 }, cached: false };
}

function stages(overrides: Partial<PipelineStageImpl>): Partial<PipelineStageImpl> {
  return {
    transcribe: (async () => {
      const plan = await readEditPlan(planPath);
      /* The real stage writes the words before it records itself done. */
      plan.transcript = {
        words: Array.from({ length: 20 }, (_, i) => ({
          id: `w${String(i + 1)}`,
          start: i * 2,
          end: i * 2 + 1.5,
          text: `word${String(i + 1)}`,
          sourceText: `word${String(i + 1)}`,
          lang: 'fr' as const,
          script: 'latin' as const,
          confidence: 0.9,
          removed: false,
          removedReason: null,
          edited: false,
        })),
      } as unknown as EditPlan['transcript'];
      plan.pipeline.transcription = {
        status: 'done', config: 'session113', costUsd: 0.17, cached: false,
        completedAt: '2026-09-15T00:00:00.500Z', error: null,
      };
      plan.costs.spentUsd = (plan.costs.spentUsd ?? 0) + 0.17;
      await writeEditPlan(planPath, plan);
      return { planPath, cached: false, transcript: { cost: { totalUsd: 0.17 } } };
    }) as unknown as PipelineStageImpl['transcribe'],
    keywords: markKeywords as unknown as PipelineStageImpl['keywords'],
    slots: (async () => await markSlots(5)) as unknown as PipelineStageImpl['slots'],
    images: (async () => ({ totalUsd: 0, billedImages: 0 })) as unknown as PipelineStageImpl['images'],
    zones: async () => ({ skipped: null }),
    ...overrides,
  };
}

async function run(overrides: Partial<PipelineStageImpl>): Promise<{
  ok: boolean;
  cause: string | null;
  states: string;
  spentUsd: number;
}> {
  try {
    const progress = await runPipeline({
      ...hooks(),
      reel: SCRATCH,
      modeId: 'k2-syndicalia',
      costsPath: ledger,
      cacheRoot: path.join(dir, 'cache'),
      stages: stages(overrides),
    });
    return {
      ok: true,
      cause: null,
      states: progress.stages.map((s) => `${s.id}=${s.state}`).join(' '),
      spentUsd: progress.spentUsd,
    };
  } catch (error) {
    const cause = error instanceof PipelineError ? error.detail.cause : String(error);
    return { ok: false, cause, states: '(threw)', spentUsd: 0 };
  }
}

function ledgerLines(): number {
  return readFileSync(ledger, 'utf8').split('\n').filter((l) => l.trim() !== '').length;
}

describe('what a failure costs, measured at every point a run can stop', () => {
  it('loses the transcript when transcription itself fails, and has paid nothing', async () => {
    freshPlan();
    const before = ledgerLines();
    const first = await run({
      transcribe: (() => {
        throw new Error('fetch failed');
      }) as unknown as PipelineStageImpl['transcribe'],
    });
    expect(first.ok).toBe(false);
    const plan = await readEditPlan(planPath);
    console.log(
      `\n  [1] transcription fails: plan.transcription=${plan.pipeline.transcription.status}` +
        ` ledger +${String(ledgerLines() - before)} cause="${String(first.cause)}"`,
    );
    expect(plan.pipeline.transcription.status).toBe('pending');

    /* And the retry pays for the transcript once, not twice. */
    const second = await run({});
    expect(second.ok).toBe(true);
    const after = await readEditPlan(planPath);
    console.log(
      `      retry: ${second.states} planSpent=$${(after.costs.spentUsd ?? 0).toFixed(2)}`,
    );
    expect(after.pipeline.transcription.status).toBe('done');
  });

  it('keeps the transcript when the stage after it fails', async () => {
    freshPlan();
    const first = await run({
      keywords: (() => {
        throw new Error('429 RESOURCE_EXHAUSTED');
      }) as unknown as PipelineStageImpl['keywords'],
    });
    expect(first.ok).toBe(false);
    const plan = await readEditPlan(planPath);
    console.log(
      `\n  [2] Google refuses at keywords: transcription=${plan.pipeline.transcription.status}` +
        ` spent=$${(plan.costs.spentUsd ?? 0).toFixed(2)} cause="${String(first.cause)}"`,
    );
    expect(plan.pipeline.transcription.status).toBe('done');

    /* The retry does not re-transcribe. */
    let transcribed = 0;
    const second = await run({
      transcribe: (async () => {
        transcribed += 1;
        throw new Error('the transcript must not be bought twice');
      }) as unknown as PipelineStageImpl['transcribe'],
    });
    console.log(`      retry: ${second.states} transcribe called ${String(transcribed)} time(s)`);
    expect(transcribed).toBe(0);
    expect(second.ok).toBe(true);
  });

  /**
   * **The measurement this file was written for.**
   *
   * The analysis stage makes two billable calls and the first of them writes
   * `pipeline.analysis = done` before the second is even attempted. So a run
   * that buys the keywords and then fails on the slots leaves a plan that says
   * the analysis is finished and carries no slots at all.
   */
  it('what a failure between the keywords and the slots leaves behind', async () => {
    freshPlan();
    const first = await run({
      slots: (() => {
        throw new Error('fetch failed');
      }) as unknown as PipelineStageImpl['slots'],
    });
    expect(first.ok).toBe(false);
    const plan = await readEditPlan(planPath);
    console.log(
      `\n  [3] the slots half fails: analysis=${plan.pipeline.analysis.status}` +
        ` slots=${String(plan.images.slots.length)}` +
        ` spent=$${(plan.costs.spentUsd ?? 0).toFixed(2)}`,
    );

    let keywordsAgain = 0;
    let slotsAgain = 0;
    const second = await run({
      keywords: (async () => {
        keywordsAgain += 1;
        return await markKeywords();
      }) as unknown as PipelineStageImpl['keywords'],
      slots: (async () => {
        slotsAgain += 1;
        return await markSlots(5);
      }) as unknown as PipelineStageImpl['slots'],
    });
    const after = await readEditPlan(planPath);
    console.log(
      `      retry: ${second.states} keywords x${String(keywordsAgain)}` +
        ` slots x${String(slotsAgain)} slots on plan=${String(after.images.slots.length)}`,
    );

    /*
     * The three things that make this a defect rather than an inconvenience,
     * asserted separately so a regression says which one came back.
     */
    /* The keywords are already bought. Buying them again is session 90's loss. */
    expect(keywordsAgain).toBe(0);
    /* The slots half never ran, so this press must run it. */
    expect(slotsAgain).toBe(1);
    /* And the reel ends able to have pictures, which is the whole point. */
    expect(after.images.slots.length).toBe(5);
    /* Never green with nothing done: a skipped analysis here was the silence. */
    expect(second.states).toContain('analysis=done');
  });

  /**
   * **And the money screen has to agree with the run.**
   *
   * The dry run read the same half-written record and told him a reel in this
   * state would never make a picture, so it showed $0.00 for a press that now
   * plans six slots and generates twelve candidates. `test 2` sits in exactly
   * this state on this machine and read $0.00 against a real $2.17.
   */
  it('does not tell him a reel in that state costs nothing', async () => {
    freshPlan();
    const first = await run({
      slots: (() => {
        throw new Error('fetch failed');
      }) as unknown as PipelineStageImpl['slots'],
    });
    expect(first.ok).toBe(false);

    const said = await dryRun(SCRATCH, 'k2-syndicalia');
    const images = said.stages.find((s) => s.id === 'images');
    console.log(
      `      the money screen for that reel: $${String(images?.estimateUsd ?? 0)} — ` +
        `"${String(images?.note ?? '')}"`,
    );
    expect(images?.note ?? '').not.toContain('without planning any');
    expect(images?.estimateUsd ?? 0).toBeGreaterThan(0);
  });

  it('keeps every slot when the picture stage fails part-way', async () => {
    freshPlan();
    const first = await run({
      images: (() => {
        throw new Error('fetch failed');
      }) as unknown as PipelineStageImpl['images'],
    });
    expect(first.ok).toBe(false);
    const plan = await readEditPlan(planPath);
    console.log(
      `\n  [4] the pictures fail: slots=${String(plan.images.slots.length)}` +
        ` analysis=${plan.pipeline.analysis.status}` +
        ` spent=$${(plan.costs.spentUsd ?? 0).toFixed(2)}`,
    );
    expect(plan.images.slots.length).toBe(5);

    let boughtAgain = 0;
    const second = await run({
      keywords: (async () => {
        boughtAgain += 1;
        return await markKeywords();
      }) as unknown as PipelineStageImpl['keywords'],
      slots: (async () => {
        boughtAgain += 1;
        return await markSlots(5);
      }) as unknown as PipelineStageImpl['slots'],
    });
    console.log(`      retry: ${second.states} words re-bought ${String(boughtAgain)} time(s)`);
    expect(boughtAgain).toBe(0);
  });

  it('keeps the pictures when the free look at the video fails after them', async () => {
    freshPlan();
    const first = await run({
      zones: async () => {
        throw new Error('the sidecar is not there');
      },
    });
    expect(first.ok).toBe(false);
    const plan = await readEditPlan(planPath);
    console.log(
      `\n  [5] the look at the video fails last: analysis=${plan.pipeline.analysis.status}` +
        ` images=${plan.pipeline.images.status}` +
        ` spent=$${(plan.costs.spentUsd ?? 0).toFixed(2)}`,
    );

    let bought = 0;
    const second = await run({
      keywords: (async () => {
        bought += 1;
        return await markKeywords();
      }) as unknown as PipelineStageImpl['keywords'],
      slots: (async () => {
        bought += 1;
        return await markSlots(5);
      }) as unknown as PipelineStageImpl['slots'],
      images: (async () => {
        bought += 1;
        return { totalUsd: 0, billedImages: 0 };
      }) as unknown as PipelineStageImpl['images'],
    });
    console.log(`      retry: ${second.states} re-bought ${String(bought)} stage(s)`);
    expect(second.ok).toBe(true);
  });

  /**
   * **A picture that was paid for is never bought twice.**
   *
   * Session 90 lost $0.61 to the opposite: a re-plan re-bought two pictures it
   * had just said it was keeping. The picture stage writes each image into the
   * cache the moment it comes back, before the next one is asked for, so a
   * stage that dies on candidate five leaves four bought and kept — and the
   * fingerprint that addresses them is the prompt, the model and the candidate
   * index, none of which a retry changes.
   *
   * Measured by killing the fifth call and counting what the second run asks
   * the model for.
   */
  it('buys a picture once, however many times the stage is interrupted', async () => {
    const mode = loadMode('k2-syndicalia');
    const cacheRoot = path.join(dir, 'image-cache');
    const config = parseImageConfig({ candidatesPerSlot: 2 });
    const video = 'b'.repeat(64);
    const slots: ImageSlot[] = [1, 2, 3, 4].map((n) => ({
      id: `img-${String(n)}`,
      wordIds: [`w${String(n)}`],
      start: n,
      end: n + 1,
      contextText: 'context',
      idea: `idea ${String(n)}`,
      prompt: `prompt ${String(n)}`,
      negativePrompt: 'no text, no watermark, no logo',
      candidates: [],
      chosenCandidateId: null,
      presentation: null,
      zoneId: null,
      templateId: null,
      status: 'pending',
    }));

    class DiesOnTheFifth implements ImageGenerationClient {
      calls = 0;
      constructor(private readonly dieAt: number | null) {}
      async generate(request: ImageGenerationRequest): Promise<GeneratedImage> {
        this.calls += 1;
        if (this.dieAt !== null && this.calls === this.dieAt) throw new Error('fetch failed');
        return {
          bytes: Uint8Array.from([1, 2, 3, this.calls]),
          mimeType: 'image/png',
          usage: { promptTokenCount: 10, candidatesTokenCount: 1120 },
          text: null,
          width: 2048,
          height: 2048,
          ...(request.prompt === '' ? {} : {}),
        };
      }
    }

    const first = new DiesOnTheFifth(5);
    await expect(
      generateImages({
        slots, mode, config, client: first, videoSha256: video, cacheRoot,
        costsPath: ledger, bill: false,
      }),
    ).rejects.toThrow(/fetch failed/);

    const second = new DiesOnTheFifth(null);
    const done = await generateImages({
      slots, mode, config, client: second, videoSha256: video, cacheRoot,
      costsPath: ledger, bill: false,
    });
    console.log(
      `\n  [6] the pictures die on candidate 5 of 8: ` +
        `the model was asked ${String(first.calls)} time(s), then ${String(second.calls)} more — ` +
        `${String(done.cachedImages)} of ${String(done.candidates.length)} came back free`,
    );

    /* Four were bought and kept; the retry asks only for the four that are missing. */
    expect(first.calls).toBe(5);
    expect(second.calls).toBe(4);
    expect(done.cachedImages).toBe(4);
    expect(done.candidates.length).toBe(8);
  });

  it('never writes a ledger line of its own', () => {
    console.log(`\n  ledger lines written by this file: ${String(ledgerLines())}`);
    expect(ledgerLines()).toBe(0);
  });
});
