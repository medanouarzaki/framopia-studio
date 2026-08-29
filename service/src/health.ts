import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  ACTIVE_PROMPT_VERSION,
  appVersion,
  loadSfxIndex,
  loadTemplateManifest,
  REPO_ROOT,
  templatesById,
  validateTemplateManifest,
} from '@framopia/core';
import { existsSync as fsExists, readFileSync as fsRead, readdirSync as fsReaddir } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  describeFfmpegFailure,
  NODE_NOT_FOUND_HELP,
  resolveFfmpegPath,
  resolveNodePath,
  type ResolvedFfmpeg,
  type ResolvedNode,
} from '@framopia/core';
import { SIDECAR_PYTHON } from './images/sidecar.js';

/**
 * What the panel shows so the user can see at a glance that his machine is
 * ready. Every field is **probed, not assumed** — a health check that reports
 * what it hopes is true is worse than none, because a missing ffmpeg then
 * surfaces halfway through a billable run instead of before it.
 *
 * Cheap enough to call on every panel load: two `--version` invocations and a
 * manifest parse, no network and no model loading.
 */
export interface ToolState {
  present: boolean;
  /** The first line of `--version`, or why the probe failed. */
  detail: string;
  /**
   * The absolute path the probe actually ran, and how it was found. Named for
   * the same reason Node's is: `PATH` inside a Finder-launched After Effects
   * holds no Homebrew, and a health line saying `present` without saying which
   * binary answered is what let a terminal-started service mask a panel-spawned
   * one that could not find ffmpeg at all. Optional so an older payload parses.
   */
  path?: string;
  source?: string;
}

export interface HealthPayload {
  ok: boolean;
  /** The service package's own version. */
  serviceVersion: string;
  /** The root package version, which is what a plan records as `meta.appVersion`. */
  appVersion: string;
  /** Frozen for the rest of Block 8; a change invalidates every hand-made reference. */
  promptVersion: number;
  ffmpeg: ToolState;
  ffprobe: ToolState;
  sidecar: {
    /** The venv interpreter exists and runs. */
    venv: ToolState;
    /** tools/cv/.venv, so a report can name the path that is missing. */
    pythonPath: string;
  };
  /**
   * This service process, so the panel can say which one answered. The panel
   * showed `ffmpeg version 8.0.1` from a terminal-started service and `missing`
   * from its own, with nothing on the machine changed between; there was no way
   * to tell the two apart on screen.
   */
  process: { pid: number; startedAt: string };
  templates: {
    valid: boolean;
    /** Every manifest problem, in the validator's own words. */
    issues: string[];
    count: number;
  };
  /**
   * Which build this service process is running.
   *
   * Optional with a default: a service older than this sends nothing, and the
   * panel then reports that it **cannot tell**, which is a different thing from
   * "behind". Written beside the compiled output by
   * `scripts/write-build-stamp.mjs` and read **once, at startup** — reading it
   * per request would report a rebuild the running process has not loaded.
   */
  buildStamp?: string | null;
  /** So the panel can locate footage, modes and brand assets without guessing. */
  repoRoot: string;
  /**
   * Which Node is running the pipeline, and which of the five sources it came
   * from. The panel spawns this service with a resolved absolute path — After
   * Effects inherits no shell PATH — and the user should be able to see which
   * interpreter that is.
   */
  node: (ResolvedNode & { help?: string; version: string }) | { path: null; source: null; help: string };
}

/**
 * Read once, when this module loads, and never again.
 *
 * The stamp has to travel with the **process**, not with the file: rebuilding
 * while the service runs rewrites `build-stamp.json` while the running code is
 * still the old code, and re-reading it would tell the panel the two agree when
 * they do not.
 */
const BUILD_STAMP: string | null = (() => {
  try {
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'build-stamp.json');
    const parsed = JSON.parse(fsRead(file, 'utf8')) as { stamp?: unknown };
    return typeof parsed.stamp === 'string' ? parsed.stamp : null;
  } catch {
    // Running from source through tsx, or a build that predates the stamp.
    // Unknown is a real answer and the panel says so; it is not "stale".
    return null;
  }
})();

export function serviceBuildStamp(): string | null {
  return BUILD_STAMP;
}

function probe(command: string, args: string[]): ToolState {
  try {
    const out = execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { present: true, detail: (out.split('\n')[0] ?? '').trim() };
  } catch (error) {
    return { present: false, detail: (error as Error).message.split('\n')[0] ?? 'not found' };
  }
}

function templateState(): HealthPayload['templates'] {
  try {
    const manifest = loadTemplateManifest();
    const sfxIds = new Set(loadSfxIndex().sfx.map((s) => s.id));
    const issues = validateTemplateManifest(manifest, sfxIds);
    return {
      valid: issues.length === 0,
      issues: issues.map((i) => `${i.path}: ${i.message}`),
      count: templatesById(manifest).size,
    };
  } catch (error) {
    return { valid: false, issues: [(error as Error).message], count: 0 };
  }
}

/**
 * Runs the resolved binary rather than the bare name, and reports which one it
 * was. A failure carries the candidates the resolver tried, so the message says
 * what to do instead of only what is absent.
 */
function probeTool(resolved: ResolvedFfmpeg): ToolState {
  const state = probe(resolved.path, ['-version']);
  if (state.present) {
    return { ...state, path: resolved.path, source: resolved.source };
  }
  return {
    present: false,
    detail: resolved.verified
      ? `${resolved.path}: ${state.detail}`
      : describeFfmpegFailure(resolved),
    path: resolved.path,
    source: resolved.source,
  };
}

/** When this process began, fixed at module load rather than read per call. */
const STARTED_AT = new Date().toISOString();

export function health(serviceVersion: string): HealthPayload {
  const ffmpegAt = resolveFfmpegPath('ffmpeg');
  const ffprobeAt = resolveFfmpegPath('ffprobe');
  const ffmpeg = probeTool(ffmpegAt);
  const ffprobe = probeTool(ffprobeAt);
  const pythonPath = SIDECAR_PYTHON;
  const venv = existsSync(pythonPath)
    ? probe(pythonPath, ['--version'])
    : { present: false, detail: `no interpreter at ${path.relative(REPO_ROOT, pythonPath)}; run tools/cv/setup.sh` };
  const templates = templateState();
  const nodeFs = {
    existsSync: fsExists,
    readFileSync: (p: string, enc: string) => fsRead(p, enc as BufferEncoding) as string,
    readdirSync: fsReaddir,
  };
  const resolved = resolveNodePath({
    fs: nodeFs,
    repo: REPO_ROOT,
    execPath: process.execPath,
    home: homedir(),
  });

  return {
    ok: ffmpeg.present && ffprobe.present && venv.present && templates.valid,
    serviceVersion,
    appVersion: appVersion(),
    promptVersion: ACTIVE_PROMPT_VERSION,
    ffmpeg,
    ffprobe,
    process: { pid: process.pid, startedAt: STARTED_AT },
    sidecar: { venv, pythonPath },
    templates,
    buildStamp: BUILD_STAMP,
    repoRoot: REPO_ROOT,
    /*
     * `process.version` is the interpreter actually running this service, not
     * the one the resolver would pick. The panel compares the two: if they
     * differ, the same pipeline behaves differently depending on how it was
     * started, and nothing on screen would otherwise show it.
     */
    node:
      resolved === null
        ? { path: null, source: null, help: NODE_NOT_FOUND_HELP }
        : { ...resolved, version: process.version, path: process.execPath, source: resolved.source },
  };
}
