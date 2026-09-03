import { copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { appVersion, LOCAL_DIR, loadConfig } from '@framopia/core';
import { registerJobRunner } from '../jobs.js';
import {
  createEditPlan,
  editPlanPathFor,
  mergeIntoExistingPlan,
  readEditPlan,
  writeEditPlan,
  type EditPlan,
  type MergePlanResult,
} from '../editplan/index.js';
import { transcribeHybridCached, transcriptionCacheRef } from './cached.js';
import { readTranscriptionCache } from './cache.js';
import { hashFile } from './fingerprint.js';
import { extractAudio, extractedAudioPath, probeVideo } from './media.js';
import { buildTranscript } from './plan-builder.js';
import type { HybridTranscript } from './hybrid.js';

export const TRANSCRIBE_JOB_TYPE = 'transcribe';
/**
 * What produced this transcript, for the plan's pipeline block. Derived from
 * the prompt version rather than hardcoded: the label read `hybrid-v1` while
 * prompt version 3 was active, which is exactly the kind of stale provenance
 * the Edit Plan exists to prevent.
 */
export function transcriptionConfigLabel(promptVersion: number): string {
  return `hybrid-prompt-v${promptVersion}`;
}

export interface TranscribeVideoOptions {
  videoPath: string;
  planPath?: string;
  keyterms?: string[];
  /** Supplied by a caller that has already hashed the file, so a 2.8 GB reel
   * is not read twice per invocation. */
  videoSha256?: string;
  bypassCache?: boolean;
  cacheRoot?: string;
  /**
   * Discard human-flagged downstream items when the transcript changed.
   * Without it a re-run that would destroy them refuses instead.
   */
  force?: boolean;
  /** Where extracted audio lives. Overridden in tests so a run cannot pick
   * up a previous run's extraction from the shared .local directory. */
  audioDir?: string;
  log?: (message: string) => void;
  /** Injected in tests so the composition can run without an API. */
  runTranscription?: typeof transcribeHybridCached;
  /** Injected in tests so the composition can run without ffmpeg. */
  media?: {
    hashFile?: typeof hashFile;
    probeVideo?: typeof probeVideo;
    extractAudio?: typeof extractAudio;
  };
  now?: () => string;
}

export interface TranscribeVideoResult {
  videoPath: string;
  audioPath: string;
  planPath: string;
  plan: EditPlan;
  transcript: HybridTranscript;
  cached: boolean;
  merge: MergePlanResult;
}

/**
 * Video in, validated Edit Plan out: hash, probe, extract audio, transcribe
 * through the cache, then tag, clean and group, and merge the result into
 * whatever plan already sits beside the video.
 *
 * It merges rather than replaces because it is no longer the only writer. A
 * plan carries keyword and image work that later stages added, and a second
 * transcribe run used to delete all of it without a word.
 */
export async function transcribeVideo(
  options: TranscribeVideoOptions,
): Promise<TranscribeVideoResult> {
  const {
    videoPath,
    keyterms = [],
    bypassCache = false,
    cacheRoot,
    audioDir = path.join(LOCAL_DIR, 'audio'),
    log = console.log,
    runTranscription = transcribeHybridCached,
    media = {},
    now = () => new Date().toISOString(),
  } = options;
  const hash = media.hashFile ?? hashFile;
  const probeMedia = media.probeVideo ?? probeVideo;
  const extract = media.extractAudio ?? extractAudio;
  const config = loadConfig();

  const videoSha256 = options.videoSha256 ?? (await hash(videoPath));
  const probe = await probeMedia(videoPath);

  // ffmpeg on a large ProRes reel is the slowest step in an otherwise free
  // run, so it happens only when neither a previous extraction nor a cache
  // entry can supply the audio.
  const canonicalAudio = extractedAudioPath(videoPath, audioDir, videoSha256);
  let audioPath: string;
  if (existsSync(canonicalAudio)) {
    audioPath = canonicalAudio;
  } else {
    const { ref } = await transcriptionCacheRef({ videoSha256, keyterms, cacheRoot });
    const cached = bypassCache ? null : (await readTranscriptionCache(ref)).payload;
    if (cached !== null) {
      await copyFile(cached.audioPath, canonicalAudio);
      audioPath = canonicalAudio;
      log('cache: restored extracted audio from the cache instead of running ffmpeg');
    } else {
      audioPath = await extract(videoPath, audioDir, videoSha256, log);
    }
  }

  const { transcript, entry } = await runTranscription({
    elevenLabsApiKey: config.elevenLabsApiKey,
    googleApiKey: config.googleApiKey,
    audioPath,
    durationS: probe.durationS,
    keyterms,
    videoSha256,
    bypassCache,
    cacheRoot,
    log,
  });

  const built = buildTranscript(transcript.words, transcript.correctedWords);
  if (built.unjudged.length > 0) {
    log(
      `cleaning: ${built.unjudged.length} ya3ni/za3ma token(s) left in place — hesitation versus explanation is not decidable here`,
    );
  }
  for (const warning of transcript.warnings) {
    log(`warning [${warning.stage}]: ${warning.cause}`);
  }

  const timestamp = now();
  const fresh = createEditPlan({
    source: {
      videoPath,
      sha256: videoSha256,
      durationS: probe.durationS,
      fps: probe.fps,
      width: probe.width,
      height: probe.height,
      audioPath,
    },
    appVersion: appVersion(),
    now: timestamp,
    id: videoSha256.slice(0, 32),
  });
  fresh.transcript.words = built.words;
  fresh.subtitles.groups = built.groups;
  fresh.pipeline.transcription = {
    status: 'done',
    config: transcriptionConfigLabel(transcript.promptVersion),
    costUsd: transcript.cached ? 0 : transcript.cost.totalUsd,
    cached: transcript.cached,
    completedAt: timestamp,
    error: null,
    cacheEntryId: entry.id,
    cacheProvenance: entry.provenance,
  };
  // A cache hit costs nothing, but the stage still ran: recording it as 0
  // rather than dropping the key keeps `byStage` diffable across runs, where
  // an appearing and vanishing key reads as a pipeline change.
  const stageCost = transcript.cached ? 0 : transcript.cost.totalUsd;
  fresh.costs = { totalUsd: stageCost, byStage: { transcription: stageCost } };

  const planPath = options.planPath ?? editPlanPathFor(videoPath);
  const existing = existsSync(planPath) ? await readEditPlan(planPath) : null;
  const merge = mergeIntoExistingPlan({ existing, fresh, force: options.force });

  if (existing !== null) {
    if (!merge.transcriptChanged) {
      log('plan: transcript unchanged, keeping keywords, images and sfx as they are');
    } else if (merge.cleared.length > 0) {
      log(
        `plan: the transcript changed, so ${merge.cleared.join(', ')} were cleared and their stages set back to pending — word ids they referenced may no longer exist`,
      );
      for (const flag of merge.discarded) {
        log(`plan: --force discarded human-flagged ${flag.block}.${flag.itemId} (${flag.detail})`);
      }
    } else {
      log('plan: the transcript changed; no downstream block had anything to clear');
    }
  }

  await writeEditPlan(planPath, merge.plan);

  return {
    videoPath,
    audioPath,
    planPath,
    plan: merge.plan,
    transcript,
    cached: transcript.cached,
    merge,
  };
}

registerJobRunner(TRANSCRIBE_JOB_TYPE, async (params) => {
  const videoPath = params?.videoPath;
  if (typeof videoPath !== 'string' || videoPath.length === 0) {
    throw new Error('transcribe job requires a videoPath');
  }
  const keyterms = Array.isArray(params?.keyterms)
    ? params.keyterms.filter((k): k is string => typeof k === 'string')
    : [];
  const planPath = typeof params?.planPath === 'string' ? params.planPath : undefined;
  const bypassCache = params?.bypassCache === true;
  return transcribeVideo({ videoPath, keyterms, planPath, bypassCache });
});
