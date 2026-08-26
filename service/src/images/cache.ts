import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { CACHE_MANIFEST, type CacheEntryRef } from '../transcription/cache.js';

export const IMAGE_CACHE_STAGE = 'images';

/** The generated file inside an entry. Extension follows the mime type. */
export function imageFileName(mimeType: string): string {
  return mimeType === 'image/jpeg' ? 'image.jpg' : 'image.png';
}

export interface ImageCachePayload {
  prompt: string;
  negativePrompt: string;
  modelId: string;
  resolution: string;
  candidateIndex: number;
  modeId: string;
  /** Provenance only — not a fingerprint input. See fingerprint.ts. */
  modeVersion: number;
  mimeType: string;
  file: string;
  costUsd: number;
  generatedAt: string;
  /** Any text the model returned alongside the bytes. */
  text?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface ImageCacheReadResult {
  payload: ImageCachePayload | null;
  warning: string | null;
}

/**
 * An entry is only a hit when its manifest parses, carries the fields a
 * caller reads, and the image file it names is actually there. A half-written
 * entry is a miss with a warning, never a crash and never a zero-byte image
 * handed on as a candidate.
 */
export async function readImageCache(ref: CacheEntryRef): Promise<ImageCacheReadResult> {
  const manifestPath = path.join(ref.dir, CACHE_MANIFEST);
  if (!existsSync(manifestPath)) return { payload: null, warning: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    return { payload: null, warning: `cache entry at ${ref.dir} is not valid JSON; regenerating` };
  }

  const payload = parsed as Partial<ImageCachePayload>;
  if (
    typeof payload.prompt !== 'string' ||
    typeof payload.modelId !== 'string' ||
    typeof payload.file !== 'string' ||
    typeof payload.costUsd !== 'number'
  ) {
    return { payload: null, warning: `cache entry at ${ref.dir} is incomplete; regenerating` };
  }
  if (!existsSync(path.join(ref.dir, payload.file))) {
    return {
      payload: null,
      warning: `cache entry at ${ref.dir} names an image file that is missing; regenerating`,
    };
  }

  return { payload: payload as ImageCachePayload, warning: null };
}

export async function writeImageCache(
  ref: CacheEntryRef,
  payload: ImageCachePayload,
  bytes: Uint8Array,
): Promise<ImageCachePayload> {
  await mkdir(ref.dir, { recursive: true });
  // Image first: a manifest is what makes an entry readable, so writing it
  // last means an interrupted write reads as a miss rather than as an entry
  // pointing at a file that does not exist.
  await writeFile(path.join(ref.dir, payload.file), bytes);
  await writeFile(
    path.join(ref.dir, CACHE_MANIFEST),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  );
  return payload;
}
