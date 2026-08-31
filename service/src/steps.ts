import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  buildFonts,
  loadMode,
  loadTemplateManifest,
  resolveStoredPath,
  templatesById,
} from '@framopia/core';
import { resolveClientIdentity, type ClientIdentitySource } from './build/client-identity.js';
import { listReels } from './catalogue.js';
import { checkBuildability } from './analysis/buildability.js';
import {
  buildRequirements,
  missingRequirements,
  readBuildDisk,
  type BuildRequirement,
} from './build/requirements.js';
import { watermarkEnabled, watermarkSizeOf } from './placement/watermark.js';
import { FRAME_HEIGHT, FRAME_WIDTH, watermarkWidthFraction } from './placement/constants.js';
import type { EditPlan, WatermarkSize } from './editplan/types.js';

/**
 * Where `build-reel-cli.ts` writes when nothing overrides it. A second copy of
 * that rule, so it is pinned equal to the builder's own by a test — a preview
 * naming the wrong file would be worse than one naming none.
 */
export function buildOutputPath(planPath: string): string {
  const reel = path.basename(planPath).replace('.editplan.json', '').replace(/\s+/g, '_');
  return path.join(REPO_ROOT, '.local', 'build', `${reel}-full.aep`);
}

function watermarkPreview(size: WatermarkSize): {
  size: WatermarkSize;
  widthPx: number;
  heightPx: number;
} {
  const w = watermarkWidthFraction(size);
  // The artwork is 1924 x 2154: the width is fitted and the height follows.
  const h = (w * 2154) / 1924 / (FRAME_HEIGHT / FRAME_WIDTH);
  return { size, widthPx: Math.round(w * FRAME_WIDTH), heightPx: Math.round(h * FRAME_HEIGHT) };
}

/**
 * Where a reel actually is, derived from the Edit Plan on disk.
 *
 * The panel is a view over the plan, not a wizard holding its own progress.
 * Closing the panel, restarting After Effects or reloading the extension must
 * land the user on the step the reel is really at, and the only thing that
 * survives all three is the plan — so every step's availability and every
 * summary figure is computed here, from the plan's own `pipeline` bookkeeping
 * and its contents, and the panel renders what it is told.
 *
 * It runs nothing and bills nothing.
 */
export const STEP_IDS = ['reel', 'transcript', 'keywords', 'images', 'build'] as const;
export type StepId = (typeof STEP_IDS)[number];

export interface StepState {
  id: StepId;
  label: string;
  /** Whether the plan supports opening this step at all. */
  available: boolean;
  /** Why not, in the words the panel shows. Null when available. */
  reason: string | null;
  /** Real figures already on the plan. Null when there are none yet. */
  summary: string | null;
  /**
   * Things the plan cannot build cleanly, named rather than counted. "5
   * buildability issue(s)" tells a user a number and nothing they can act on.
   */
  issues?: string[];
}

export interface PlanSteps {
  reel: string;
  planPath: string | null;
  steps: StepState[];
  /**
   * What pressing Build would do. Absent when the reel has no plan, or when the
   * template manifest did not load — the step's `reason` says why in that case.
   */
  build?: BuildPreview;
}

/**
 * The answer to "what happens if I press this", assembled from the plan rather
 * than described in prose the builder could drift away from.
 */
export interface BuildPreview {
  reel: string;
  planPath: string;
  /** The client whose palette and scale the build uses, and where it came from. */
  modeId: string;
  modeName: string;
  modeSource: 'the plan' | 'the picker';
  /** Where the .aep is written. The build overwrites it. */
  outputPath: string;
  subtitleCards: number;
  keywords: number;
  images: number;
  sfxEvents: number;
  watermark: { size: WatermarkSize; widthPx: number; heightPx: number } | null;
  fonts: {
    latin: string;
    arabic: string;
    /** Optional: a service older than Block 9 session 2 sends no emphasis face. */
    emphasis?: string;
    globalFallback: boolean;
  };
  /**
   * The client's look this build will use, and where it came from.
   *
   * Optional with a default so an older panel renders what it always did. A
   * reel is built against the copy saved with it, not the client file as it
   * stands, so the panel has to be able to say which — and to offer the one
   * control that moves it forward.
   */
  client?: {
    name: string;
    source: ClientIdentitySource;
    note: string;
    /** True when the client has changed since this video was set up. */
    behind: boolean | null;
  };
  /**
   * Always true, and said out loud: every other control in this panel that runs
   * something can spend money, so silence about cost would be read as a cost.
   */
  free: true;
  /**
   * What this reel is missing that a correct build needs. Empty is the normal
   * case; anything here disables Build, because the alternative is a comp that
   * looks right and is not.
   */
  missing: BuildRequirement[];
}

export class StepsError extends Error {}

const LABELS: Record<StepId, string> = {
  reel: 'Reel',
  transcript: 'Transcript',
  keywords: 'Keywords',
  images: 'Images',
  build: 'Build',
};

function countCandidatesOnDisk(plan: EditPlan): { total: number; present: number } {
  let total = 0;
  let present = 0;
  for (const slot of plan.images.slots) {
    for (const candidate of slot.candidates) {
      total += 1;
      // Parsed here rather than through readEditPlan, so the re-rooting that
      // readEditPlan does has to be done explicitly.
      const file =
        candidate.path === ''
          ? ''
          : resolveStoredPath(candidate.path, { field: `${slot.id}/${candidate.id}.path` });
      if (file !== '' && existsSync(file)) present += 1;
    }
  }
  return { total, present };
}

export function stepsFor(reelLabel: string, modeId: string): PlanSteps {
  const reel = listReels().find((r) => r.label === reelLabel);
  if (reel === undefined) {
    throw new StepsError(`no reel labelled "${reelLabel}" in benchmarks/footage.json`);
  }

  let mode;
  try {
    mode = loadMode(modeId);
  } catch (error) {
    throw new StepsError(`mode "${modeId}" did not load: ${(error as Error).message}`);
  }

  const planPath = reel.planPath;
  let plan: EditPlan | null = null;
  if (planPath !== null && existsSync(planPath)) {
    try {
      plan = JSON.parse(readFileSync(planPath, 'utf8')) as EditPlan;
    } catch (error) {
      throw new StepsError(`${planPath} did not parse: ${(error as Error).message}`);
    }
  }

  const steps: StepState[] = [];
  const push = (
    id: StepId,
    available: boolean,
    reason: string | null,
    summary: string | null,
    issues: string[] = [],
  ): void => {
    steps.push({ id, label: LABELS[id], available, reason, summary, ...(issues.length > 0 ? { issues } : {}) });
  };

  push('reel', true, null, `${reel.label}${reel.durationS === null ? '' : ` — ${reel.durationS.toFixed(1)}s`}`);

  const transcriptionDone = plan?.pipeline.transcription.status === 'done';
  if (plan === null) {
    push('transcript', false, 'This reel has no edit plan yet. Run the pipeline first.', null);
    push('keywords', false, 'Nothing has been transcribed yet.', null);
    push('images', false, 'Nothing has been transcribed yet.', null);
    push('build', false, 'Nothing has been transcribed yet.', null);
    return { reel: reel.label, planPath, steps };
  }

  const words = plan.transcript.words.length;
  const cards = plan.subtitles.groups.length;
  const superseded = plan.subtitles.groups.filter((g) => g.supersededBy != null).length;
  const stage = plan.pipeline.transcription;
  const provenance =
    stage.cacheProvenance === 'compatible'
      ? ' Reused a transcription made against an older orthography guide.'
      : '';
  push(
    'transcript',
    transcriptionDone,
    transcriptionDone ? null : 'This reel has not been transcribed yet.',
    transcriptionDone
      ? `${words} words in ${cards} cards, ${cards - superseded} rendered.${provenance}`
      : null,
  );

  const keywordsDone = plan.pipeline.analysis.status === 'done' && plan.keywords.items.length > 0;
  push(
    'keywords',
    keywordsDone,
    keywordsDone ? null : 'Keyword analysis has not run for this reel.',
    keywordsDone
      ? `${plan.keywords.items.length} keywords, ${plan.keywords.items.filter((k) => k.approved).length} approved.`
      : null,
  );

  const slots = plan.images.slots.length;
  const candidates = countCandidatesOnDisk(plan);
  push(
    'images',
    slots > 0,
    slots > 0 ? null : 'No image slots have been planned for this reel.',
    slots > 0
      ? `${slots} slots, ${candidates.total} candidates, ${candidates.present} on disk.`
      : null,
  );

  /*
   * **A subtitles-only comp is a legitimate build, so Build opens on cards.**
   * Session 15's brief said "the plan-completeness check passes" and the code
   * shipped "there are cards" without declaring the difference; this states the
   * rule rather than leaving a third one undeclared.
   *
   * The reason is that keywords and images are enrichments, not requirements:
   * `buildReel` places whatever the plan carries and PROJECT_SPEC's deliverable
   * is a comp for human review. `ground-truth` has no keywords and no images
   * and still builds 76 subtitle cards, which is a useful thing to look at.
   * What the pane must not do is imply the comp will contain more than it will
   * — so the summary says what is in and what is missing.
   *
   * `checkBuildability`'s issues are clipped holds and short words, which the
   * builder handles by compressing an entrance. They are reported, never a gate.
   */
  let buildAvailable = false;
  let buildReason: string | null = null;
  let buildSummary: string | null = null;
  let buildIssues: string[] = [];
  let buildPreview: BuildPreview | undefined;
  const identity = resolveClientIdentity(plan, {});
  const fonts = buildFonts(identity.snapshot ?? mode);
  try {
    const report = checkBuildability(plan, templatesById(loadTemplateManifest()));
    buildAvailable = report.checked.subtitleGroups > 0;
    buildReason = buildAvailable ? null : 'There are no subtitle cards to build.';

    const willContain = [`${report.checked.subtitleGroups} subtitle cards`];
    const willNot: string[] = [];
    const part = (n: number, singular: string, plural: string): void => {
      if (n > 0) willContain.push(`${n} ${n === 1 ? singular : plural}`);
      else willNot.push(plural);
    };
    part(plan.keywords.items.length, 'emphasised keyword', 'emphasised keywords');
    part(candidates.present > 0 ? slots : 0, 'image', 'images');
    part(plan.sfx.events.length, 'sfx event', 'sfx events');

    buildIssues = report.issues.map((i) =>
      i.shortByS === undefined
        ? `${i.path}: ${i.message}`
        : `${i.path}: ${i.message} (short by ${i.shortByS.toFixed(2)}s)`,
    );

    buildSummary =
      `Would contain ${willContain.join(', ')}` +
      (willNot.length === 0 ? '' : `; no ${willNot.join(' and no ')}`) +
      `. Fonts: ${fonts.latin} and ${fonts.arabic}` +
      `${fonts.source === 'global' ? ' (global fallback)' : ''}.`;

    /*
     * The mode a build uses is the plan's own, with the picker as an override —
     * `build-reel-cli.ts` reads `plan.clientMode` and takes `--mode` above it,
     * so the preview says which one it landed on rather than echoing the picker
     * back at the user.
     */
    const missing = missingRequirements(
      buildRequirements(plan, readBuildDisk(planPath ?? ''), {
        knownTemplateIds: new Set(templatesById(loadTemplateManifest()).keys()),
        clientSource: identity.source,
      }),
    );
    if (missing.length > 0) {
      buildAvailable = false;
      buildReason =
        missing.length === 1
          ? `${missing[0]?.what}. Without it, ${missing[0]?.consequence}. Run: ${missing[0]?.command}`
          : `${missing.length} things this reel needs before it can be built correctly.`;
      // Ahead of the clipped holds, not instead of them: these stop the build
      // and those are things to know about a comp that will be made anyway.
      buildIssues = [
        ...missing.map((m) => `${m.what} — without it, ${m.consequence}. Run: ${m.command}`),
        ...buildIssues,
      ];
    }

    const planMode = plan.clientMode;
    const buildMode = planMode === null ? mode : loadMode(planMode.id);
    if (planPath !== null) {
      buildPreview = {
        reel: reel.label,
        planPath,
        modeId: buildMode.id,
        modeName: buildMode.name,
        modeSource: planMode === null ? 'the picker' : 'the plan',
        outputPath: buildOutputPath(planPath),
        subtitleCards: report.checked.subtitleGroups,
        keywords: plan.keywords.items.length,
        images: candidates.present > 0 ? slots : 0,
        sfxEvents: plan.sfx.events.length,
        watermark: watermarkEnabled(plan.watermark)
          ? watermarkPreview(watermarkSizeOf(plan.watermark))
          : null,
        fonts: {
          latin: fonts.latin,
          arabic: fonts.arabic,
          emphasis: fonts.emphasis,
          globalFallback: fonts.source === 'global',
        },
        client: {
          name: identity.snapshot?.name ?? buildMode.name,
          source: identity.source,
          note: identity.note,
          behind: identity.behind,
        },
        free: true,
        missing,
      };
    }
  } catch (error) {
    buildReason = `The template manifest did not load: ${(error as Error).message}`;
  }
  push('build', buildAvailable, buildReason, buildSummary, buildIssues);

  return {
    reel: reel.label,
    planPath,
    steps,
    ...(buildPreview === undefined ? {} : { build: buildPreview }),
  };
}
