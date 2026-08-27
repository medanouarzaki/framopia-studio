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
import { NODE_NOT_FOUND_HELP, resolveNodePath, type ResolvedNode } from '@framopia/core';
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
  templates: {
    valid: boolean;
    /** Every manifest problem, in the validator's own words. */
    issues: string[];
    count: number;
  };
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

export function health(serviceVersion: string): HealthPayload {
  const ffmpeg = probe('ffmpeg', ['-version']);
  const ffprobe = probe('ffprobe', ['-version']);
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
    sidecar: { venv, pythonPath },
    templates,
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
