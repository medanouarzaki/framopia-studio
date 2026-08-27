import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ACTIVE_PROMPT_VERSION, type PromptVersion } from './prompt-version.js';

/**
 * Which transcription cache entry a tool reads, decided by a declared rule
 * rather than by whatever order the filesystem hands back.
 *
 * A reel accumulates one entry per configuration — `vitasilk` holds three,
 * prompt versions 1, 3 and 4 — and three diagnostic tools used to take the
 * first `transcription-*` directory `readdir` returned. On this machine that
 * is the pinned version for four reels and prompt version 1 for `vitasilk`,
 * purely because `0cb5…` sorts before `758a…`. `readdir` order is the
 * filesystem's business and is not guaranteed stable across machines, volumes
 * or entry churn, so the same command could answer differently anywhere else.
 *
 * The rule: **the active entry is the one whose prompt version equals the
 * version pinned in code.** No fallback, no newest-by-mtime, no first match.
 * Nothing matching, or more than one matching, is a failure that names what is
 * on disk — a diagnostic that quietly reads a different configuration is worse
 * than one that refuses.
 *
 * `--entry` exists so reproducing a historical figure is a stated act. It
 * still reports what it selected.
 */
export const TRANSCRIPTION_ENTRY_PREFIX = 'transcription-';

export interface CachedEntryDescriptor {
  /** The directory name, e.g. `transcription-758a3924d090d1b5`. */
  id: string;
  /** Absolute path to the entry directory. */
  dir: string;
  /** null when the manifest does not declare one, which no entry on disk does. */
  promptVersion: number | null;
}

export class CacheEntrySelectionError extends Error {}

export function listTranscriptionEntries(
  cacheRoot: string,
  videoSha256: string,
): CachedEntryDescriptor[] {
  const videoDir = path.join(cacheRoot, videoSha256);
  if (!existsSync(videoDir)) return [];
  return readdirSync(videoDir)
    .filter((name) => name.startsWith(TRANSCRIPTION_ENTRY_PREFIX))
    .map((name) => {
      const dir = path.join(videoDir, name);
      const manifestPath = path.join(dir, 'manifest.json');
      if (!existsSync(manifestPath)) return null;
      let promptVersion: number | null = null;
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
        if (typeof manifest['promptVersion'] === 'number') {
          promptVersion = manifest['promptVersion'];
        }
      } catch {
        return null;
      }
      return { id: name, dir, promptVersion };
    })
    .filter((e): e is CachedEntryDescriptor => e !== null);
}

function present(entries: readonly CachedEntryDescriptor[]): string {
  if (entries.length === 0) return 'none';
  return [...entries]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((e) => `${e.id} (prompt v${e.promptVersion ?? '?'})`)
    .join(', ');
}

export interface SelectOptions {
  /** Defaults to the version pinned in code. */
  pinnedPromptVersion?: PromptVersion | number;
  /** An entry id, or its bare fingerprint, chosen deliberately. */
  entryOverride?: string | null;
}

export function selectTranscriptionEntry(
  entries: readonly CachedEntryDescriptor[],
  reel: string,
  options: SelectOptions = {},
): CachedEntryDescriptor {
  const pinned = options.pinnedPromptVersion ?? ACTIVE_PROMPT_VERSION;
  const override = options.entryOverride ?? null;

  if (override !== null) {
    const wanted = override.startsWith(TRANSCRIPTION_ENTRY_PREFIX)
      ? override
      : `${TRANSCRIPTION_ENTRY_PREFIX}${override}`;
    const hit = entries.find((e) => e.id === wanted);
    if (hit === undefined) {
      throw new CacheEntrySelectionError(
        `${reel}: no cache entry "${override}"; on disk: ${present(entries)}`,
      );
    }
    return hit;
  }

  const matches = entries.filter((e) => e.promptVersion === pinned);
  if (matches.length === 1) return matches[0] as CachedEntryDescriptor;

  const why = matches.length === 0 ? 'no cache entry' : `${matches.length} cache entries`;
  throw new CacheEntrySelectionError(
    `${reel}: ${why} at the pinned prompt version ${pinned}; on disk: ${present(entries)}. ` +
      'Pass --entry <id> to read a specific one deliberately.',
  );
}

/** The one line every tool prints and stamps into whatever it writes. */
export function describeSelection(entry: CachedEntryDescriptor): string {
  return `${entry.id} (prompt v${entry.promptVersion ?? '?'})`;
}
