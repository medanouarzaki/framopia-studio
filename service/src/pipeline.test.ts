import { describe, expect, it, vi } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import {
  asStageError,
  ledgerSpendUsd,
  PIPELINE_CEILING_USD,
  PipelineCeilingError,
  PipelineError,
  runPipeline,
  type PipelineStageImpl,
} from './pipeline.js';
import { PIPELINE_STAGES } from './pipeline-stages.js';
import { readEditPlan } from './editplan/io.js';

const FOOTAGE = path.join(REPO_ROOT, 'my files', 'test videos');
const LEDGER = path.join(REPO_ROOT, '.local', 'costs.jsonl');

/**
 * Every stage is injected. Nothing in this file can reach an API: the real
 * stage functions are never called, and the ledger is asserted byte-identical
 * afterwards rather than trusted to be.
 */
function fakeStages(overrides: Partial<PipelineStageImpl> = {}): Partial<PipelineStageImpl> {
  return {
    transcribe: vi.fn(async () => {
      throw new Error('transcribe must not run in this test');
    }) as unknown as PipelineStageImpl['transcribe'],
    keywords: vi.fn(async () => {
      throw new Error('keywords must not run in this test');
    }) as unknown as PipelineStageImpl['keywords'],
    slots: vi.fn(async () => {
      throw new Error('slots must not run in this test');
    }) as unknown as PipelineStageImpl['slots'],
    images: vi.fn(async () => {
      throw new Error('images must not run in this test');
    }) as unknown as PipelineStageImpl['images'],
    zones: vi.fn(async () => ({ skipped: 'already on the plan' })),
    ...overrides,
  };
}

function ledgerSha(): string {
  return readFileSync(LEDGER, 'utf8');
}

describe('runPipeline over a plan that is already complete', () => {
  /*
   * `vitasilk` has been through every billable stage, so a run must touch
   * nothing. This is the check that the runner cannot spend by accident.
   */
  it('skips every stage the plan already carries, and bills nothing', async () => {
    const before = ledgerSha();
    const progress = await runPipeline({
      reel: 'vitasilk',
      modeId: 'k2-syndicalia',
      stages: fakeStages(),
    });

    expect(progress.done).toBe(true);
    expect(progress.error).toBeNull();
    expect(progress.spentUsd).toBe(0);
    expect(progress.stages.map((s) => s.state)).toEqual([
      'skipped',
      'skipped',
      'skipped',
      'skipped',
    ]);
    for (const stage of progress.stages) {
      expect(stage.reason, stage.id).not.toBeNull();
    }
    expect(ledgerSha()).toBe(before);
  });

  it('says why each stage was skipped, in words', async () => {
    const progress = await runPipeline({
      reel: 'vitasilk',
      modeId: 'k2-syndicalia',
      stages: fakeStages(),
    });
    const reasons = Object.fromEntries(progress.stages.map((s) => [s.id, s.reason]));
    expect(reasons['transcription']).toBe('already on the plan');
    expect(reasons['analysis']).toBe('already on the plan');
    expect(reasons['images']).toBe('already on the plan');
  });

  it('reports the plan’s cumulative spend, which is what the alarm reads', async () => {
    const progress = await runPipeline({
      reel: 'vitasilk',
      modeId: 'k2-syndicalia',
      stages: fakeStages(),
    });
    expect(progress.planSpentUsd).toBeCloseTo(1.550444, 6);
  });

  it('reaches 100 per cent when every stage has settled', async () => {
    const progress = await runPipeline({
      reel: 'vitasilk',
      modeId: 'k2-syndicalia',
      stages: fakeStages(),
    });
    expect(progress.percent).toBe(1);
  });
});

describe('a reel that has never been analysed', () => {
  /*
   * `ground-truth` is transcribed and nothing else, so analysis is the first
   * stage that would bill. Its stage function is injected, so the assertion is
   * about what the runner *asks for*, never about a call being made.
   */
  it('skips transcription and asks for analysis', async () => {
    const keywords = vi.fn(async () => ({
      planPath: '',
      plan: {} as never,
      analysis: { costUsd: 0.18 },
      cached: false,
      regroupDropped: [],
    })) as unknown as PipelineStageImpl['keywords'];
    const slots = vi.fn(async () => ({
      planPath: '',
      plan: {} as never,
      analysis: { costUsd: 0.06 },
      cached: false,
    })) as unknown as PipelineStageImpl['slots'];

    const before = ledgerSha();
    const progress = await runPipeline({
      reel: 'ground-truth',
      modeId: 'k2-syndicalia',
      stages: fakeStages({ keywords, slots }),
    });

    expect(progress.stages[0]?.state).toBe('skipped');
    expect(progress.stages[1]?.state).toBe('done');
    expect(progress.stages[1]?.costUsd).toBeCloseTo(0.24, 6);
    expect(keywords).toHaveBeenCalledTimes(1);
    expect(slots).toHaveBeenCalledTimes(1);
    // The stages are fakes, so the ledger cannot have moved — asserted rather
    // than assumed, because a wrapper that billed is exactly the defect this
    // runner was written to avoid.
    expect(ledgerSha()).toBe(before);
  });

  it('does not ask for images when the plan has no slots', async () => {
    const images = vi.fn();
    const progress = await runPipeline({
      reel: 'ground-truth',
      modeId: 'k2-syndicalia',
      stages: fakeStages({
        keywords: vi.fn(async () => ({
          analysis: { costUsd: 0 },
          cached: true,
        })) as unknown as PipelineStageImpl['keywords'],
        slots: vi.fn(async () => ({
          analysis: { costUsd: 0 },
          cached: true,
        })) as unknown as PipelineStageImpl['slots'],
        images: images as unknown as PipelineStageImpl['images'],
      }),
    });
    expect(images).not.toHaveBeenCalled();
    expect(progress.stages[2]?.reason).toBe('no image slots on the plan');
  });
});

describe('an interrupted run', () => {
  /*
   * The plan is the source of truth, so resuming is not a feature the runner
   * implements — it is what happens when a stage reads the plan and finds its
   * own work already there. This proves the second run does not repeat it.
   */
  it('resumes from the plan and does not repeat a completed stage', async () => {
    const keywords = vi.fn(async () => ({
      analysis: { costUsd: 0.18 },
      cached: false,
    })) as unknown as PipelineStageImpl['keywords'];
    const slots = vi.fn(async () => ({
      analysis: { costUsd: 0.06 },
      cached: false,
    })) as unknown as PipelineStageImpl['slots'];

    await runPipeline({
      reel: 'vitasilk',
      modeId: 'k2-syndicalia',
      stages: fakeStages({ keywords, slots }),
    });
    await runPipeline({
      reel: 'vitasilk',
      modeId: 'k2-syndicalia',
      stages: fakeStages({ keywords, slots }),
    });

    expect(keywords).not.toHaveBeenCalled();
    expect(slots).not.toHaveBeenCalled();
  });

  it('runs a stage again only when it is explicitly asked to', async () => {
    const keywords = vi.fn(async () => ({
      analysis: { costUsd: 0 },
      cached: true,
    })) as unknown as PipelineStageImpl['keywords'];
    const slots = vi.fn(async () => ({
      analysis: { costUsd: 0 },
      cached: true,
    })) as unknown as PipelineStageImpl['slots'];

    await runPipeline({
      reel: 'vitasilk',
      modeId: 'k2-syndicalia',
      redo: ['analysis'],
      stages: fakeStages({ keywords, slots }),
    });
    expect(keywords).toHaveBeenCalledTimes(1);
  });
});

describe('the ceiling', () => {
  /*
   * A running check against the ledger before each billable request, not a
   * pre-flight estimate: a run is aborted, not truncated, and nothing is
   * requested once it refuses.
   */
  it('refuses a billable stage that would cross it, and appends nothing', async () => {
    const before = ledgerSha();
    const keywords = vi.fn();
    await expect(
      runPipeline({
        reel: 'ground-truth',
        modeId: 'k2-syndicalia',
        // Zero leaves no room at all, so the first billable stage refuses.
        ceilingUsd: 0,
        stages: fakeStages({ keywords: keywords as unknown as PipelineStageImpl['keywords'] }),
      }),
    ).rejects.toThrow(PipelineError);
    expect(keywords).not.toHaveBeenCalled();
    expect(ledgerSha()).toBe(before);
  });

  it('reports a refusal as a stage failure that is not worth retrying', async () => {
    try {
      await runPipeline({
        reel: 'ground-truth',
        modeId: 'k2-syndicalia',
        ceilingUsd: 0,
        stages: fakeStages(),
      });
      expect.unreachable('the ceiling should have refused');
    } catch (error) {
      const detail = (error as PipelineError).detail;
      expect(detail.stage).toBe('analysis');
      expect(detail.retryable).toBe(false);
      expect(detail.cause).toContain('aborted, not truncated');
    }
  });

  it('is a hard gate above the panel’s soft alarm, not the same number', () => {
    expect(PIPELINE_CEILING_USD).toBeGreaterThan(2);
  });

  it('sums every ledger stage a run can append to', () => {
    expect(ledgerSpendUsd()).toBeGreaterThan(0);
  });
});

describe('a failing stage', () => {
  it('stops the run and surfaces the cause verbatim', async () => {
    const keywords = vi.fn(async () => {
      throw new Error('the model returned 503 Service Unavailable');
    }) as unknown as PipelineStageImpl['keywords'];
    const images = vi.fn();

    await expect(
      runPipeline({
        reel: 'ground-truth',
        modeId: 'k2-syndicalia',
        stages: fakeStages({ keywords, images: images as unknown as PipelineStageImpl['images'] }),
      }),
    ).rejects.toThrow('503 Service Unavailable');
    expect(images).not.toHaveBeenCalled();
  });

  it('marks a transient failure retryable and a terminal one not', () => {
    expect(asStageError('analysis', new Error('fetch failed')).retryable).toBe(true);
    expect(asStageError('analysis', new Error('503 upstream')).retryable).toBe(true);
    expect(
      asStageError('images', new Error('ENOENT: no such file or directory')).retryable,
    ).toBe(false);
    expect(asStageError('analysis', new PipelineCeilingError('analysis', 1, 1)).retryable).toBe(
      false,
    );
  });
});

describe('progress', () => {
  it('reports every stage before any of them has run', async () => {
    const seen: string[][] = [];
    await runPipeline({
      reel: 'vitasilk',
      modeId: 'k2-syndicalia',
      stages: fakeStages(),
      onProgress: (p) => seen.push(p.stages.map((s) => s.state)),
    });
    expect(seen[0]).toHaveLength(PIPELINE_STAGES.length);
    expect(seen[0]?.[0]).toBe('running');
  });

  it('refuses a reel that is not in the catalogue, by name', async () => {
    await expect(
      runPipeline({ reel: 'nope', modeId: 'k2-syndicalia', stages: fakeStages() }),
    ).rejects.toThrow('no reel labelled "nope"');
  });
});

/**
 * The transcription stage resolves through session 14's one resolver, and the
 * corpus is pinned at orthography guide v1.0.7 — so every reel resolves
 * `compatible`, and `compatible` must never reach the thing that transcribes.
 */
describe('a compatible transcription resolution', () => {
  it('never reaches runHybrid', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-pipeline-'));
    const planPath = path.join(dir, 'vitasilk.editplan.json');
    copyFileSync(path.join(FOOTAGE, 'vitasilk.editplan.json'), planPath);

    // Transcription pending, so the stage is not skipped and the resolver is
    // what has to keep the API call away.
    const plan = await readEditPlan(planPath);
    plan.pipeline.transcription = { ...plan.pipeline.transcription, status: 'pending' };
    writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');

    const { resolveTranscriptionEntry } = await import('./transcription/resolve-entry.js');
    const entry = await resolveTranscriptionEntry({ videoSha256: plan.source.sha256 });
    expect(entry.provenance).toBe('compatible');

    const runHybrid = vi.fn(async () => {
      throw new Error('runHybrid must never be reached for a compatible entry');
    });
    const { transcribeHybridCached } = await import('./transcription/cached.js');
    const result = await transcribeHybridCached({
      videoSha256: plan.source.sha256,
      audioPath: '',
      durationS: plan.source.durationS,
      elevenLabsApiKey: '',
      googleApiKey: '',
      runHybrid: runHybrid as never,
    });

    expect(runHybrid).not.toHaveBeenCalled();
    expect(result.entry.provenance).toBe('compatible');
    expect(result.transcript.cached).toBe(true);
  });
});
