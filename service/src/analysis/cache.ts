import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { CACHE_MANIFEST, type CacheEntryRef } from '../transcription/cache.js';
import type { KeywordCandidate } from './types.js';

export const ANALYSIS_CACHE_STAGE = 'analysis';

/** What the analysis stage stores. No media, so no audio file to lose. */
export interface AnalysisCachePayload {
  rawText: string;
  candidates: KeywordCandidate[];
  costUsd: number;
  wallTimeS: number;
  promptVersion: number;
  model: string;
  modeId: string;
  modeVersion: number;
}

export interface AnalysisCacheReadResult {
  payload: AnalysisCachePayload | null;
  warning: string | null;
}

export async function readAnalysisCache(ref: CacheEntryRef): Promise<AnalysisCacheReadResult> {
  const manifestPath = path.join(ref.dir, CACHE_MANIFEST);
  if (!existsSync(manifestPath)) return { payload: null, warning: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    return { payload: null, warning: `cache entry at ${ref.dir} is not valid JSON; recomputing` };
  }

  const payload = parsed as Partial<AnalysisCachePayload>;
  if (
    typeof payload.rawText !== 'string' ||
    !Array.isArray(payload.candidates) ||
    typeof payload.costUsd !== 'number'
  ) {
    return { payload: null, warning: `cache entry at ${ref.dir} is incomplete; recomputing` };
  }

  return { payload: payload as AnalysisCachePayload, warning: null };
}

export async function writeAnalysisCache(
  ref: CacheEntryRef,
  payload: AnalysisCachePayload,
): Promise<AnalysisCachePayload> {
  await mkdir(ref.dir, { recursive: true });
  await writeFile(
    path.join(ref.dir, CACHE_MANIFEST),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  );
  return payload;
}
