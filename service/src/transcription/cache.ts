import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { LOCAL_DIR } from '@framopia/core';

/**
 * Cache root per ARCHITECTURE §6: .local/cache/<video-sha256>/<stage>-<fingerprint>/.
 * The video hash groups everything about one reel; the fingerprint separates
 * configurations, so changing the prompt version or the guide leaves the old
 * entry in place rather than overwriting it.
 */
export const CACHE_ROOT = path.join(LOCAL_DIR, 'cache');

const MANIFEST = 'manifest.json';
const AUDIO = 'audio.wav';

export interface CacheEntryRef {
  dir: string;
  videoSha256: string;
  stage: string;
  fingerprint: string;
}

export function cacheEntryDir(
  videoSha256: string,
  stage: string,
  fingerprint: string,
  root = CACHE_ROOT,
): string {
  return path.join(root, videoSha256, `${stage}-${fingerprint}`);
}

/**
 * How many configurations to keep per video. Each entry copies the whole
 * extracted audio, so the cost of keeping them is real, and the useful ones
 * are the recent configurations — an entry for a prompt version from three
 * guide revisions ago is never going to be hit again. Three leaves room to
 * flip between two configurations while comparing them without either being
 * evicted. Chosen, not measured.
 */
export const MAX_ENTRIES_PER_VIDEO = 3;

/**
 * Prunes a single video's entries down to the most recently written
 * MAX_ENTRIES_PER_VIDEO. Scoped deliberately: it only ever reads the
 * directory named by videoSha256 under the cache root, and only ever removes
 * children of that directory, so it cannot reach a user asset.
 */
export async function evictStaleEntries(
  videoSha256: string,
  root = CACHE_ROOT,
  keep = MAX_ENTRIES_PER_VIDEO,
): Promise<string[]> {
  const videoDir = path.join(root, videoSha256);
  let names: string[];
  try {
    names = await readdir(videoDir);
  } catch {
    return [];
  }

  const entries: { dir: string; mtimeMs: number }[] = [];
  for (const name of names) {
    const dir = path.join(videoDir, name);
    try {
      const info = await stat(path.join(dir, MANIFEST));
      entries.push({ dir, mtimeMs: info.mtimeMs });
    } catch {
      // No manifest: either a half-written entry or something that is not an
      // entry at all. Left alone rather than deleted on a guess.
    }
  }

  entries.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const doomed = entries.slice(keep);
  for (const entry of doomed) {
    if (!entry.dir.startsWith(path.join(root, videoSha256) + path.sep)) continue;
    await rm(entry.dir, { recursive: true, force: true });
  }
  return doomed.map((e) => e.dir);
}

/** What the transcription stage stores, per the §6 artifact list. */
export interface TranscriptionCachePayload {
  audioPath: string;
  durationS: number;
  scribeRaw: unknown;
  correctionRaw: { text: string; usageMetadata: unknown };
  correctedTexts: string[];
  costUsd: { scribeUsd: number; geminiUsd: number; totalUsd: number };
  wallTimeS: number;
  promptVersion: number;
  model: string;
}

export interface CacheReadResult {
  payload: TranscriptionCachePayload | null;
  /** Set when an entry existed but could not be used. */
  warning: string | null;
}

/**
 * A corrupt or half-written entry is a miss with a warning, never a crash and
 * never a partial read: an unreadable manifest, a manifest missing any field
 * the caller needs, or a missing audio file all fall through to a fresh call.
 */
export async function readTranscriptionCache(ref: CacheEntryRef): Promise<CacheReadResult> {
  const manifestPath = path.join(ref.dir, MANIFEST);
  if (!existsSync(manifestPath)) return { payload: null, warning: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    return { payload: null, warning: `cache entry at ${ref.dir} is not valid JSON; recomputing` };
  }

  const payload = parsed as Partial<TranscriptionCachePayload>;
  if (
    !Array.isArray(payload.correctedTexts) ||
    typeof payload.durationS !== 'number' ||
    payload.correctionRaw === undefined ||
    payload.scribeRaw === undefined ||
    payload.costUsd === undefined
  ) {
    return { payload: null, warning: `cache entry at ${ref.dir} is incomplete; recomputing` };
  }

  const audioPath = path.join(ref.dir, AUDIO);
  if (!existsSync(audioPath)) {
    return { payload: null, warning: `cache entry at ${ref.dir} lost its audio; recomputing` };
  }

  return { payload: { ...(payload as TranscriptionCachePayload), audioPath }, warning: null };
}

export async function writeTranscriptionCache(
  ref: CacheEntryRef,
  payload: TranscriptionCachePayload,
): Promise<TranscriptionCachePayload> {
  await mkdir(ref.dir, { recursive: true });
  const cachedAudio = path.join(ref.dir, AUDIO);
  if (path.resolve(payload.audioPath) !== path.resolve(cachedAudio)) {
    await copyFile(payload.audioPath, cachedAudio);
  }
  const stored: TranscriptionCachePayload = { ...payload, audioPath: cachedAudio };
  // Manifest last: a crash mid-copy leaves no manifest, which reads as a
  // miss rather than as an entry pointing at a truncated file.
  await writeFile(path.join(ref.dir, MANIFEST), `${JSON.stringify(stored, null, 2)}\n`, 'utf8');
  return stored;
}
