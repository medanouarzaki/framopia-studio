import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { loadMode, type ClientMode } from '@framopia/core';
import { recordStageSpend } from '../editplan/costs.js';
import { readEditPlan, writeEditPlan } from '../editplan/io.js';
import type { EditPlan, ImageCandidate, ImageSlot } from '../editplan/types.js';
import { parseImageConfig, type ImageGenerationConfig } from './config.js';
import { GeminiImageClient } from './gemini-client.js';
import type { ImageGenerationClient } from './client.js';
import { generateImages, type GeneratedCandidate } from './generate.js';
import { imageLedgerTotalUsd } from './estimate.js';
import { removeBackground, type SidecarGate } from './sidecar.js';
import { cutoutQuality, slotPresentation } from './quality.js';
import { slotsNeedingGeneration } from '../editplan/slot-fill.js';

/**
 * A re-run would replace every slot's candidates. That is right for a plan
 * nobody has touched and wrong for one an editor has worked on. Mirrors
 * `PlanMergeBlockedError` and `SlotsReplaceBlockedError`: it names what would
 * be lost and demands an explicit --force rather than deciding.
 */
export class ImagesReplaceBlockedError extends Error {
  constructor(readonly reasons: { slotId: string; detail: string }[]) {
    super(
      `re-generating would discard editor work on ${reasons.length} slot(s): ` +
        `${reasons.map((r) => `${r.slotId} (${r.detail})`).join('; ')}. ` +
        'Re-run with --force to discard it.',
    );
    this.name = 'ImagesReplaceBlockedError';
  }
}

/**
 * What a wholesale replacement of a slot's candidates would destroy.
 *
 * Only editor decisions count. Candidates on their own are cheap to rebuild —
 * they come back from the cache byte-identical and free — so their presence
 * is not a reason to block. A chosen candidate is a human's pick, and an
 * overridden presentation is a human's override.
 */
export function imagesReplacementFlags(plan: EditPlan): { slotId: string; detail: string }[] {
  const reasons: { slotId: string; detail: string }[] = [];
  for (const slot of plan.images.slots) {
    if (slot.chosenCandidateId !== null) {
      reasons.push({ slotId: slot.id, detail: `a candidate was chosen (${slot.chosenCandidateId})` });
    }
  }
  return reasons;
}

export interface GenerateImagesForPlanOptions {
  planPath: string;
  modeId: string;
  force?: boolean;
  useCache?: boolean;
  cacheRoot?: string;
  costsPath?: string;
  /** Image spend already in the ledger when the session began. */
  spendBaselineUsd?: number;
  ceilingUsd?: number;
  /**
   * Stop after this many candidates in total. The probe uses it to generate
   * one image and halt: the frozen config has never been sent to the API, and
   * a defect found on image 1 costs $0.15 where image 10 costs $1.51.
   */
  limit?: number;
  /** Injected in tests, so the whole path runs without an API key. */
  client?: ImageGenerationClient;
  /** Injected in tests, so the sidecar is not required. */
  cutout?: typeof removeBackground;
  log?: (message: string) => void;
  now?: () => string;
}

export interface GenerateImagesForPlanResult {
  planPath: string;
  plan: EditPlan;
  config: ImageGenerationConfig;
  generated: GeneratedCandidate[];
  totalUsd: number;
  billedImages: number;
  cachedImages: number;
  warnings: string[];
}

/** The mode's §5.4 override, falling back to the code default. */
export function candidatesFor(mode: ClientMode, config: ImageGenerationConfig): number {
  return mode.imageCandidates ?? config.candidatesPerSlot;
}

/**
 * Generates every slot's candidates, cuts each one out, gates it, checks its
 * text, and writes the lot onto the plan.
 *
 * `chosenCandidateId` is left null. The editor picks in Block 8, and a stage
 * that picked for them would be making the decision the panel exists for.
 */
/**
 * Where a plan's cutouts are written, namespaced by the plan's own filename.
 *
 * **It was `<video-dir>/cutouts/` for every plan**, and slot ids restart at
 * `img001` on every reel, so the second reel in a directory silently
 * overwrote the first reel's cutouts file for file. Every corpus plan lives
 * in `my files/test videos/`, so the collision was total: Block 9 session 12
 * generated `test-1`'s eight images and destroyed eight of `vitasilk`'s ten
 * cutouts, the set every image measurement in the project is written against.
 *
 * They were restorable — a cutout is derived from the cached source image,
 * free and locally, and regeneration was verified bit-identical against the
 * two files the collision happened to spare. That is luck, not a design: the
 * same collision on an input nothing can reproduce would have been permanent.
 *
 * The stem is the plan's filename without its extensions, so `test 1` and
 * `vitasilk` cannot meet. Same shape as `.local/cv/<video-basename>/`.
 */
export function cutoutDirFor(planPath: string): string {
  const stem = path.basename(planPath).replace(/\.editplan\.json$/, '');
  return path.join(path.dirname(planPath), 'cutouts', stem);
}

export async function generateImagesForPlan(
  options: GenerateImagesForPlanOptions,
): Promise<GenerateImagesForPlanResult> {
  const {
    planPath,
    modeId,
    force = false,
    useCache = true,
    cacheRoot,
    costsPath,
    ceilingUsd,
    limit,
    client = new GeminiImageClient(),
    cutout = removeBackground,
    log = (): void => undefined,
    now = () => new Date().toISOString(),
  } = options;

  const plan = await readEditPlan(planPath);
  const mode = loadMode(modeId);

  // Before anything is generated: a blocked re-run must cost nothing.
  const blocked = imagesReplacementFlags(plan);
  if (blocked.length > 0 && !force) throw new ImagesReplaceBlockedError(blocked);

  const spendBaselineUsd = options.spendBaselineUsd ?? imageLedgerTotalUsd(costsPath);
  const config = parseImageConfig({
    candidatesPerSlot: mode.imageCandidates ?? undefined,
    ...(ceilingUsd === undefined ? {} : { ceilingUsd }),
  });

  const cutoutDir = cutoutDirFor(planPath);
  mkdirSync(cutoutDir, { recursive: true });

  /*
   * Only the slots that still need a picture made. A slot the client has
   * already filled is not sent to the model — the whole point of the client's
   * own pictures is that they are not bought. `slotNeedsGenerating` is the one
   * declaration of that, and it lives outside this directory so nothing here
   * can read what filled the slot.
   */
  const toGenerate = slotsNeedingGeneration(plan.images.slots);
  const alreadyFilled = plan.images.slots.length - toGenerate.length;
  if (alreadyFilled > 0) {
    log(`images: ${alreadyFilled} slot(s) are already filled and are not generated`);
  }

  const result = await generateImages({
    slots: toGenerate,
    mode,
    config,
    client,
    videoSha256: plan.source.sha256,
    cacheRoot,
    costsPath,
    useCache,
    bill: true,
    spendBaselineUsd,
    limit,
    log,
  });

  const bySlot = new Map<string, GeneratedCandidate[]>();
  for (const candidate of result.candidates) {
    const list = bySlot.get(candidate.slotId) ?? [];
    list.push(candidate);
    bySlot.set(candidate.slotId, list);
  }

  const slots: ImageSlot[] = [];
  for (const slot of plan.images.slots) {
    const generated = bySlot.get(slot.id) ?? [];
    const candidates: ImageCandidate[] = [];
    const gates: SidecarGate[] = [];

    for (const g of generated) {
      const outPath = path.join(cutoutDir, `${g.id}.cutout.png`);
      const cut = await cutout({
        imagePath: g.path,
        outPath,
        idea: slot.idea,
        modeVocabulary: mode.vocabulary,
        ocr: true,
      });
      gates.push(cut.gate);

      candidates.push({
        id: g.id,
        path: g.path,
        cutoutPath: cut.cutoutPath,
        cutoutQuality: cutoutQuality(cut.metrics),
        modelId: g.modelId,
        resolution: g.resolution,
        generatedAt: g.generatedAt,
        costUsd: g.costUsd,
        metrics: {
          alphaEdgeNoise: cut.metrics.alpha_edge_noise,
          holeRatio: cut.metrics.hole_ratio,
          foregroundArea: cut.metrics.foreground_area,
          edgeHalo: cut.metrics.edge_halo,
        },
        gate: { ...cut.gate },
        detectedText: cut.ocr?.detections.map((d) => ({ ...d })) ?? [],
        textVerdict: cut.ocr?.verdict === undefined ? null : { ...cut.ocr.verdict },
      });

      const verdict = cut.ocr?.verdict;
      if (verdict !== undefined && !verdict.ok) {
        log(`warning [${slot.id}/${g.id}]: unexpected text ${verdict.unexpected.join(', ')}`);
      }
      if (!cut.gate.passed) {
        log(`gate [${slot.id}/${g.id}]: card — ${cut.gate.failures.join('; ')}`);
      }
    }

    slots.push({
      ...slot,
      candidates,
      // Untouched: the editor picks in Block 8.
      chosenCandidateId: slot.chosenCandidateId,
      presentation: slotPresentation(gates),
      status: candidates.length > 0 ? 'generated' : slot.status,
    });
  }

  if (limit !== undefined) {
    return {
      planPath, plan, config,
      generated: result.candidates,
      totalUsd: result.totalUsd,
      billedImages: result.billedImages,
      cachedImages: result.cachedImages,
      warnings: result.warnings,
    };
  }

  plan.images = { slots };
  const timestamp = now();
  plan.pipeline.images = {
    status: 'done',
    config: `${config.modelId}-${config.resolution}-${config.aspectRatio}-x${config.candidatesPerSlot}`,
    costUsd: result.totalUsd,
    cached: result.billedImages === 0,
    completedAt: timestamp,
    error: null,
  };
  recordStageSpend(plan, 'images', result.totalUsd);
  plan.meta.updatedAt = timestamp;

  await writeEditPlan(planPath, plan);

  return {
    planPath,
    plan,
    config,
    generated: result.candidates,
    totalUsd: result.totalUsd,
    billedImages: result.billedImages,
    cachedImages: result.cachedImages,
    warnings: result.warnings,
  };
}
