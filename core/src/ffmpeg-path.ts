import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './paths.js';

/**
 * Where ffmpeg and ffprobe actually are on this machine.
 *
 * The same problem `resolveNodePath` solves, and for the same reason: After
 * Effects launches from the Finder and inherits none of the user's shell
 * profile, so `PATH` inside a panel-spawned service is roughly `/usr/bin:/bin`
 * — which holds no Homebrew. Block 8 part 1 resolved Node explicitly and left
 * these two on `PATH`, and the panel reported `ffmpeg version 8.0.1` for a
 * whole session because the service answering was one the user had started
 * from a terminal. **ffmpeg detection had never worked in a panel-spawned
 * service.**
 *
 * **Nothing is version-pinned.** Homebrew's `bin` is a stable directory of
 * symlinks, so the Cellar version never appears here; the partner's machine in
 * Block 10 may well use `/usr/local` instead, and an explicit path in
 * `.local/config.json` overrides both.
 *
 * `PATH` remains last rather than absent: a machine that puts ffmpeg somewhere
 * else entirely and has it on the path is still working, and refusing it would
 * be worse than trying it.
 */
export type FfmpegTool = 'ffmpeg' | 'ffprobe';

export type FfmpegPathSource = 'config' | 'homebrew' | 'usr-local' | 'path';

export interface ResolvedFfmpeg {
  tool: FfmpegTool;
  /** An absolute path, or the bare name when only `PATH` can answer. */
  path: string;
  source: FfmpegPathSource;
  /** True when `path` is absolute and was verified to exist. */
  verified: boolean;
  /** Every candidate tried and what it returned, in order. */
  tried: string[];
}

/** The directories searched, in order, before falling back to `PATH`. */
export const FFMPEG_SEARCH_DIRS = ['/opt/homebrew/bin', '/usr/local/bin'] as const;

const CONFIG_KEY: Record<FfmpegTool, string> = {
  ffmpeg: 'ffmpegPath',
  ffprobe: 'ffprobePath',
};

interface FfmpegFs {
  existsSync: (p: string) => boolean;
  readFileSync: (p: string, enc: string) => string;
}

const NODE_FS: FfmpegFs = { existsSync, readFileSync: (p, enc) => readFileSync(p, enc as 'utf8') };

/**
 * Reads `ffmpegPath` / `ffprobePath` from `.local/config.json`. A key that is
 * present but names a file that is not there is reported as tried and failed,
 * never silently skipped: someone who set it deserves to know it is wrong.
 */
function fromConfig(tool: FfmpegTool, repo: string, fs: FfmpegFs, tried: string[]): string | null {
  const configPath = path.join(repo, '.local', 'config.json');
  if (!fs.existsSync(configPath)) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  } catch {
    tried.push(`${configPath}: not valid JSON`);
    return null;
  }
  const configured = parsed[CONFIG_KEY[tool]];
  if (typeof configured !== 'string' || configured === '') return null;
  if (fs.existsSync(configured)) return configured;
  tried.push(`${configured} (from ${CONFIG_KEY[tool]}): does not exist`);
  return null;
}

export function resolveFfmpegPath(
  tool: FfmpegTool,
  options: { repo?: string; fs?: FfmpegFs; searchDirs?: readonly string[] } = {},
): ResolvedFfmpeg {
  const repo = options.repo ?? REPO_ROOT;
  const fs = options.fs ?? NODE_FS;
  const dirs = options.searchDirs ?? FFMPEG_SEARCH_DIRS;
  const tried: string[] = [];

  const configured = fromConfig(tool, repo, fs, tried);
  if (configured !== null) {
    return { tool, path: configured, source: 'config', verified: true, tried };
  }

  for (const dir of dirs) {
    const candidate = path.join(dir, tool);
    if (fs.existsSync(candidate)) {
      return {
        tool,
        path: candidate,
        source: dir === '/opt/homebrew/bin' ? 'homebrew' : 'usr-local',
        verified: true,
        tried,
      };
    }
    tried.push(`${candidate}: does not exist`);
  }

  // Left to `PATH`, which is right when a shell started the service and wrong
  // when After Effects did. `verified` says which of those this is.
  return { tool, path: tool, source: 'path', verified: false, tried };
}

/** One line naming what was tried, for a message a user can act on. */
export function describeFfmpegFailure(resolved: ResolvedFfmpeg): string {
  return (
    `${resolved.tool} was not found at any known location and is being left to PATH, ` +
    `which a Finder-launched After Effects does not inherit. Tried: ` +
    `${resolved.tried.length === 0 ? 'nothing' : resolved.tried.join('; ')}. ` +
    `Set ${CONFIG_KEY[resolved.tool]} in .local/config.json to an absolute path.`
  );
}
