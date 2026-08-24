import { copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { appVersion, LOCAL_DIR, loadConfig } from '@framopia/core';
import { registerJobRunner } from '../jobs.js';
import {
  createEditPlan,
  editPlanPathFor,
  writeEditPlan,
  type EditPlan,
} from '../editplan/index.js';
import { transcribeHybridCached, transcriptionCacheRef } from './cached.js';
import { readTranscriptionCache } from './cache.js';
import { hashFile } from './fingerprint.js';
import { extractAudio, extractedAudioPath, probeVideo } from './media.js';
import { buildTranscript } from './plan-builder.js';
import type { HybridTranscript } from './hybrid.js';

export const TRANSCRIBE_JOB_TYPE = 'transcribe';
export const TRANSCRIPTION_CONFIG_LABEL = 'hybrid-v1';

export interface TranscribeVideoOptions {
  videoPath: string;
  planPath?: string;
  keyterms?: string[];
  /** Supplied by a caller that has already hashed the file, so a 2.8 GB reel
   * is not read twice per invocation. */
  videoSha256?: string;
  bypassCache?: boolean;
  cacheRoot?: string;
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
}

/**
 * Video in, validated Edit Plan out: hash, probe, extract audio, transcribe
 * through the cache, then tag, clean and group, and write the plan beside the
 * video. Keywords, images, zones, sfx and build stay empty — the stages that
 * fill them do not exist yet.
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
  const canonicalAudio = extractedAudioPath(videoPath, audioDir);
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
      audioPath = await extract(videoPath, audioDir);
    }
  }

  const { transcript } = await runTranscription({
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

  const built = buildTranscript(transcript.words, transcript.draftWords);
  if (built.unjudged.length > 0) {
    log(
      `cleaning: ${built.unjudged.length} ya3ni/za3ma token(s) left in place — hesitation versus explanation is not decidable here`,
    );
  }
  for (const warning of transcript.warnings) {
    log(`warning [${warning.stage}]: ${warning.cause}`);
  }

  const timestamp = now();
  const plan = createEditPlan({
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
  plan.transcript.words = built.words;
  plan.subtitles.groups = built.groups;
  plan.pipeline.transcription = {
    status: 'done',
    config: TRANSCRIPTION_CONFIG_LABEL,
    costUsd: transcript.cached ? 0 : transcript.cost.totalUsd,
    cached: transcript.cached,
    completedAt: timestamp,
    error: null,
  };
  plan.costs = transcript.cached
    ? { totalUsd: 0, byStage: {} }
    : { totalUsd: transcript.cost.totalUsd, byStage: { transcription: transcript.cost.totalUsd } };

  const planPath = options.planPath ?? editPlanPathFor(videoPath);
  await writeEditPlan(planPath, plan);

  return { videoPath, audioPath, planPath, plan, transcript, cached: transcript.cached };
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
