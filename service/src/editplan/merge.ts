import { createHash } from 'node:crypto';
import type { EditPlan, PipelineStageName } from './types.js';

/**
 * Identity of a transcript for the purpose of "do downstream references still
 * mean anything". Covers each word's id, text, timing and removed flag,
 * because every one of those can invalidate a block that points at it: an id
 * that vanished, a text that changed what a keyword says, a timing that moves
 * an image slot's window, a removal that makes a word ineligible.
 *
 * Deliberately not the analysis fingerprint's `hashTranscript`, which hashes
 * only non-removed id/text because that is all its prompt sees. Two different
 * questions, two different hashes.
 */
export function transcriptContentHash(plan: EditPlan): string {
  const canonical = JSON.stringify(
    plan.transcript.words.map((w) => [w.id, w.text, w.start, w.end, w.removed]),
  );
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

/**
 * Blocks that reference transcript word ids and therefore cannot survive a
 * transcript change. `zones` is absent on purpose: zones come from computer
 * vision over video frames and reference no word, so a re-transcription
 * leaves them valid.
 */
export const TRANSCRIPT_DEPENDENT_BLOCKS = ['keywords', 'images', 'sfx'] as const;
export type TranscriptDependentBlock = (typeof TRANSCRIPT_DEPENDENT_BLOCKS)[number];

/** Which pipeline stage owns each block, so clearing can reset its status. */
const BLOCK_STAGE: Record<TranscriptDependentBlock, PipelineStageName | null> = {
  keywords: 'analysis',
  images: 'images',
  sfx: null,
};

export interface HumanFlag {
  block: TranscriptDependentBlock;
  itemId: string;
  detail: string;
}

/**
 * Anything a human has touched in a block that a transcript change would
 * clear. ARCHITECTURE §3: an automated re-run must never overwrite a flagged
 * item without explicit confirmation.
 */
export function humanFlaggedItems(plan: EditPlan): HumanFlag[] {
  const flags: HumanFlag[] = [];
  for (const item of plan.keywords.items) {
    if (item.edited === true) {
      flags.push({ block: 'keywords', itemId: item.id, detail: 'edited by a human' });
    }
  }
  for (const slot of plan.images.slots) {
    if (slot.chosenCandidateId !== null) {
      flags.push({
        block: 'images',
        itemId: slot.id,
        detail: `a candidate was chosen (${slot.chosenCandidateId})`,
      });
    }
  }
  return flags;
}

export class PlanMergeBlockedError extends Error {
  constructor(readonly flags: HumanFlag[]) {
    super(
      `the transcript changed, so ${flags.length} human-flagged item(s) would be discarded: ` +
        `${flags.map((f) => `${f.block}.${f.itemId} (${f.detail})`).join('; ')}. ` +
        'Re-run with --force to discard them.',
    );
    this.name = 'PlanMergeBlockedError';
  }
}

export interface MergePlanOptions {
  /** The plan already on disk, or null when this reel has never been run. */
  existing: EditPlan | null;
  /** A freshly built plan carrying the new transcript and subtitles. */
  fresh: EditPlan;
  /** Discard human-flagged items rather than refusing. */
  force?: boolean;
}

export interface MergePlanResult {
  plan: EditPlan;
  /** False only when an existing plan's transcript hash matched. */
  transcriptChanged: boolean;
  cleared: TranscriptDependentBlock[];
  /** What `force` discarded. Empty unless it was needed. */
  discarded: HumanFlag[];
}

function clearBlocks(plan: EditPlan, now: string): TranscriptDependentBlock[] {
  const cleared: TranscriptDependentBlock[] = [];
  if (plan.keywords.items.length > 0) {
    plan.keywords = { mode: plan.keywords.mode, items: [] };
    cleared.push('keywords');
  }
  if (plan.images.slots.length > 0) {
    plan.images = { slots: [] };
    cleared.push('images');
  }
  if (plan.sfx.events.length > 0) {
    plan.sfx = { events: [] };
    cleared.push('sfx');
  }
  for (const block of cleared) {
    const stage = BLOCK_STAGE[block];
    if (stage === null) continue;
    plan.pipeline[stage] = {
      status: 'pending',
      config: null,
      costUsd: null,
      cached: null,
      completedAt: null,
      error: null,
    };
    delete plan.costs.byStage[stage];
  }
  if (cleared.length > 0) {
    plan.costs.totalUsd = Object.values(plan.costs.byStage).reduce((n, v) => n + v, 0);
    if (plan.build.status === 'built') plan.build = { ...plan.build, status: 'stale' };
    plan.meta.updatedAt = now;
  }
  return cleared;
}

/**
 * Folds a fresh transcription into whatever is already on disk instead of
 * overwriting it. Transcription used to write a brand-new plan, which meant a
 * second transcribe run silently deleted the keywords a later stage had
 * added.
 *
 * A word id that no longer exists is never re-resolved onto a neighbour: the
 * block is cleared and its stage set back to pending, and the caller is
 * expected to say so out loud. Repairing a stale reference by guessing is how
 * a keyword ends up pointing at the wrong word in a client's build.
 */
export function mergeIntoExistingPlan(options: MergePlanOptions): MergePlanResult {
  const { existing, fresh, force = false } = options;
  const freshHash = transcriptContentHash(fresh);
  fresh.transcript.contentHash = freshHash;

  if (existing === null) {
    return { plan: fresh, transcriptChanged: true, cleared: [], discarded: [] };
  }

  const merged: EditPlan = {
    ...existing,
    schemaVersion: fresh.schemaVersion,
    meta: {
      ...existing.meta,
      // Identity and birth belong to the plan, not to this run.
      id: existing.meta.id,
      createdAt: existing.meta.createdAt,
      updatedAt: fresh.meta.updatedAt,
      appVersion: fresh.meta.appVersion,
    },
    source: fresh.source,
    transcript: fresh.transcript,
    subtitles: fresh.subtitles,
    pipeline: { ...existing.pipeline, transcription: fresh.pipeline.transcription },
    costs: {
      totalUsd: existing.costs.totalUsd,
      byStage: { ...existing.costs.byStage },
    },
  };

  const transcriptionCost = fresh.costs.byStage.transcription ?? 0;
  merged.costs.byStage.transcription = transcriptionCost;
  merged.costs.totalUsd = Object.values(merged.costs.byStage).reduce((n, v) => n + v, 0);

  // Recomputed from the existing plan's own words rather than read from its
  // stored `contentHash`. The stored value is the record of what downstream
  // blocks were built against; the words are the fact. A plan written before
  // the field existed still answers the question exactly, instead of being
  // assumed stale and having its keywords thrown away for nothing.
  if (transcriptContentHash(existing) === freshHash) {
    return { plan: merged, transcriptChanged: false, cleared: [], discarded: [] };
  }

  const flags = humanFlaggedItems(existing);
  if (flags.length > 0 && !force) throw new PlanMergeBlockedError(flags);

  const cleared = clearBlocks(merged, fresh.meta.updatedAt);
  return { plan: merged, transcriptChanged: true, cleared, discarded: flags };
}
