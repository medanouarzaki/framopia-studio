/**
 * Every check the doctor runs, and every path it looks at made overridable.
 *
 * The overrides are not a convenience: a check that has only ever been seen
 * passing is an assertion nobody has tested, and the only safe way to watch one
 * fail is to point it somewhere empty. **Nothing real is ever moved, renamed or
 * deleted to test a check** — the environment variables below are how absence is
 * simulated, and `reports/block-10-session-9.md` records which one proved which.
 */
import { execFileSync } from 'node:child_process';
import {
  accessSync,
  constants as fsConstants,
  existsSync,
  openSync,
  closeSync,
  readSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir, hostname, arch, platform, release } from 'node:os';
import path from 'node:path';
import {
  compareFontNames,
  REPO_ROOT,
  loadMode,
  redact,
  resolveFfmpegPath,
  scriptingVerdict,
  resolveNodePath,
  type CheckResult,
} from '@framopia/core';

/** Every override, in one place, so the report can name the mechanism used. */
export const OVERRIDES = {
  path: 'FRAMOPIA_DOCTOR_PATH',
  venv: 'FRAMOPIA_DOCTOR_VENV',
  models: 'FRAMOPIA_DOCTOR_MODELS_DIR',
  rembg: 'FRAMOPIA_DOCTOR_REMBG_DIR',
  localDir: 'FRAMOPIA_DOCTOR_LOCAL_DIR',
  extensions: 'FRAMOPIA_DOCTOR_EXTENSIONS_DIR',
  templatesDir: 'FRAMOPIA_DOCTOR_TEMPLATES_DIR',
  panelDist: 'FRAMOPIA_DOCTOR_PANEL_DIST',
  footageDir: 'FRAMOPIA_DOCTOR_FOOTAGE_DIR',
  aeState: 'FRAMOPIA_DOCTOR_AE_STATE',
  minFreeGb: 'FRAMOPIA_DOCTOR_MIN_FREE_GB',
} as const;

function env(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === '' ? undefined : value;
}

const LOCAL = (): string => env(OVERRIDES.localDir) ?? path.join(REPO_ROOT, '.local');

/**
 * Derived, not chosen — measured on this machine 2026-08-31 and summed:
 *
 * ```
 *   the checked-out repository (714 tracked files)   0.033 GB
 *   node_modules, after npm install                  0.164
 *   tools/cv/.venv, after tools/cv/setup.sh          0.801
 *   the segmentation model                           0.015
 *   the cutout model                                 0.906
 *   the five source reels                           11.926
 *   the cache copy                                   0.052
 *   the generated pictures and cutouts               0.052
 *   frames and masks, generated on the machine       0.584
 *   built .aep files and measurements                0.106
 *   extracted audio                                  0.003
 *                                                   ------
 *                                                   14.643 GB
 * ```
 *
 * Rounded up with a quarter again for headroom. **`benchmarks/whisper/models`
 * (4.0 GB) is deliberately out**: the local Whisper baseline is optional, Apple
 * Silicon only, and not part of `npm run check`. So is
 * `benchmarks/results` (0.24 GB), which regenerates and is gitignored.
 */
export const MIN_FREE_GB = 19;

function sha256Of(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/**
 * The same, for a file too big to hold. A reel is 2.4 GB and `readFileSync`
 * refuses past 2 GiB, so the footage check reads it in chunks.
 */
function sha256OfLarge(file: string): string {
  const hash = createHash('sha256');
  const fd = openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (;;) {
      const read = readSync(fd, buffer, 0, buffer.length, null);
      if (read === 0) break;
      hash.update(buffer.subarray(0, read));
    }
  } finally {
    closeSync(fd);
  }
  return hash.digest('hex');
}

function firstLine(text: string): string {
  return text.split('\n')[0]?.trim() ?? '';
}

/** Runs a binary for its version string. Never throws; absence is a state. */
function probe(command: string, args: string[]): { ok: boolean; out: string } {
  try {
    const out = execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...(env(OVERRIDES.path) === undefined
        ? {}
        : { env: { ...process.env, PATH: env(OVERRIDES.path) as string } }),
    });
    return { ok: true, out: firstLine(out) };
  } catch (error) {
    return { ok: false, out: (error as Error).message };
  }
}

export function machineFacts(): {
  platform: string;
  release: string;
  arch: string;
  hostname: string;
  label: string | null;
} {
  let label: string | null = null;
  try {
    const config = JSON.parse(
      readFileSync(path.join(LOCAL(), 'config.json'), 'utf8'),
    ) as Record<string, unknown>;
    label = typeof config['machineLabel'] === 'string' ? config['machineLabel'] : null;
  } catch {
    label = null;
  }
  return { platform: platform(), release: release(), arch: arch(), hostname: hostname(), label };
}

/**
 * The repository, wherever it is.
 *
 * It used to say *the repo has to be at this exact path*, and until Block 10
 * session 11 that was true: the Edit Plans stored 52 absolute paths rooted at
 * the drive this project grew up on. `resolveStoredPath` re-roots them at read
 * time now, so what is required is a folder this account can read and write,
 * not a particular one. Proven by running the whole corpus from a second copy
 * at a different absolute path.
 */
function checkRepo(): CheckResult {
  const marker = path.join(REPO_ROOT, 'package.json');
  if (!existsSync(marker)) {
    return {
      id: 'repo',
      what: 'the repository, wherever it is',
      state: 'absent',
      detail: `nothing at ${REPO_ROOT}`,
      blocking: 'run',
      remedy: 'clone the repository, or plug in the drive holding it',
      remedyVerified: false,
    };
  }
  let writable = true;
  try {
    accessSync(REPO_ROOT, fsConstants.W_OK);
  } catch {
    writable = false;
  }
  return {
    id: 'repo',
    what: 'the repository, wherever it is',
    state: writable ? 'present' : 'absent',
    detail: writable ? REPO_ROOT : `${REPO_ROOT} is not writable by this account`,
    blocking: 'run',
    caveat:
      'no longer needs a particular path: stored paths are re-rooted onto whatever ' +
      'repository is running, so what it needs is somewhere readable and writable',
    ...(writable
      ? {}
      : { remedy: 'put the repository somewhere this account can write', remedyVerified: false }),
  };
}

function checkNode(): CheckResult {
  const nvmrc = path.join(REPO_ROOT, '.nvmrc');
  const wanted = existsSync(nvmrc) ? readFileSync(nvmrc, 'utf8').trim() : null;
  const resolved = resolveNodePath({
    fs: { existsSync, readFileSync: (p: string) => readFileSync(p, 'utf8'), readdirSync },
    repo: REPO_ROOT,
    execPath: process.execPath,
    home: homedir(),
  });
  if (resolved === null) {
    return {
      id: 'node',
      what: `node, at the version .nvmrc pins (${wanted ?? 'unpinned'})`,
      state: 'absent',
      detail: 'no node binary found in the config, nvm, homebrew or /usr/local',
      blocking: 'run',
      remedy: `install node ${wanted ?? 'LTS'} with nvm, or set nodePath in .local/config.json`,
      remedyVerified: false,
    };
  }
  const running = process.version;
  const matches = wanted === null || running.startsWith(`v${wanted}`);
  return {
    id: 'node',
    what: `node, at the version .nvmrc pins (${wanted ?? 'unpinned'})`,
    state: matches ? 'present' : 'absent',
    detail: `${running} running, resolved to ${resolved.path} (${resolved.source})`,
    blocking: 'run',
    ...(matches
      ? {}
      : {
          remedy: `install node ${wanted ?? ''} — the panel spawns this binary directly`,
          remedyVerified: false,
        }),
  };
}

function checkDependencies(): CheckResult {
  const dir = path.join(REPO_ROOT, 'node_modules');
  const present = existsSync(dir);
  return {
    id: 'dependencies',
    what: 'the installed workspace dependencies',
    state: present ? 'present' : 'absent',
    detail: present ? `${readdirSync(dir).length} entries in node_modules` : `nothing at ${dir}`,
    blocking: 'run',
    ...(present ? {} : { remedy: 'npm install, from the repository root', remedyVerified: false }),
  };
}

function checkFfmpeg(tool: 'ffmpeg' | 'ffprobe'): CheckResult {
  /*
   * Resolved by the project's own rule rather than by `which`: After Effects
   * launches from the Finder and inherits no shell PATH, so a tool a terminal
   * finds can still be invisible to a panel-spawned service.
   */
  const overriddenPath = env(OVERRIDES.path);
  let resolvedPath: string | null = null;
  let source = 'unresolved';
  if (overriddenPath === undefined) {
    const resolved = resolveFfmpegPath(tool);
    resolvedPath = resolved.path;
    source = resolved.source;
  } else {
    for (const dir of overriddenPath.split(':')) {
      const candidate = path.join(dir, tool);
      if (existsSync(candidate)) {
        resolvedPath = candidate;
        source = 'PATH';
        break;
      }
    }
  }
  if (resolvedPath === null) {
    return {
      id: tool,
      what: `${tool}, resolved the way a panel-spawned service resolves it`,
      state: 'absent',
      detail: 'not in .local/config.json, /opt/homebrew/bin, /usr/local/bin or PATH',
      blocking: 'run',
      remedy: `brew install ffmpeg, or set ${tool}Path in .local/config.json`,
      remedyVerified: false,
    };
  }
  const version = probe(resolvedPath, ['-version']);
  if (!version.ok) {
    return {
      id: tool,
      what: `${tool}, resolved the way a panel-spawned service resolves it`,
      state: 'absent',
      detail: `${resolvedPath} did not run: ${firstLine(version.out)}`,
      blocking: 'run',
      remedy: `brew install ffmpeg, or set ${tool}Path in .local/config.json`,
      remedyVerified: false,
    };
  }
  return {
    id: tool,
    what: `${tool}, resolved the way a panel-spawned service resolves it`,
    state: 'present',
    detail: `${version.out} at ${resolvedPath} (${source})`,
    blocking: 'run',
  };
}

function checkVenv(): CheckResult {
  const python = env(OVERRIDES.venv) ?? path.join(REPO_ROOT, 'tools', 'cv', '.venv', 'bin', 'python');
  if (!existsSync(python)) {
    return {
      id: 'cv-venv',
      what: 'the picture tools — the Python interpreter in the CV venv',
      state: 'absent',
      detail: `nothing at ${python}`,
      blocking: 'build',
      remedy: 'tools/cv/setup.sh',
      remedyVerified: false,
    };
  }
  const version = probe(python, ['--version']);
  return {
    id: 'cv-venv',
    what: 'the picture tools — the Python interpreter in the CV venv',
    state: version.ok ? 'present' : 'absent',
    detail: version.ok ? `${version.out} at ${python}` : `${python} did not run`,
    blocking: 'build',
    ...(version.ok ? {} : { remedy: 'tools/cv/setup.sh', remedyVerified: false }),
  };
}

function checkVenvPackages(): CheckResult {
  const python = env(OVERRIDES.venv) ?? path.join(REPO_ROOT, 'tools', 'cv', '.venv', 'bin', 'python');
  if (!existsSync(python)) {
    return {
      id: 'cv-packages',
      what: 'the packages the CV sidecar imports',
      state: 'unknown',
      detail: 'no interpreter to ask; the venv itself is missing',
      blocking: 'build',
      remedy: 'tools/cv/setup.sh',
      remedyVerified: false,
    };
  }
  const probed = probe(python, ['-c', 'import mediapipe, rembg, PIL, numpy; print("ok")']);
  return {
    id: 'cv-packages',
    what: 'the packages the CV sidecar imports',
    state: probed.ok ? 'present' : 'absent',
    detail: probed.ok
      ? 'mediapipe, rembg, PIL and numpy all import'
      : `import failed: ${firstLine(probed.out)}`,
    blocking: 'build',
    ...(probed.ok
      ? {}
      : { remedy: 'tools/cv/setup.sh, which installs tools/cv/requirements.txt', remedyVerified: false }),
  };
}

interface PinnedModel {
  file: string;
  sha256: string;
  bytes: number;
}

function pinnedModels(): Record<string, PinnedModel> {
  const raw = JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'tools', 'cv', 'models.json'), 'utf8'),
  ) as { models: Record<string, PinnedModel> };
  return raw.models;
}

/**
 * The segmentation model, by size rather than by hash.
 *
 * Hashing 16 MiB is cheap and hashing the 928 MiB cutout model is not, so both
 * are checked by presence and byte count here and `tools/cv/verify-models.sh`
 * stays the thing that hashes. The doctor says which check it made.
 */
function checkModel(id: string, blocking: 'build'): CheckResult {
  const pinned = pinnedModels()[id];
  if (pinned === undefined) {
    return {
      id: `model-${id}`,
      what: `the ${id} model`,
      state: 'unknown',
      detail: 'tools/cv/models.json does not pin it',
      blocking,
    };
  }
  const base = pinned.file.startsWith('~')
    ? (env(OVERRIDES.rembg) ?? homedir())
    : (env(OVERRIDES.models) ?? path.join(REPO_ROOT, 'tools', 'cv'));
  const file = pinned.file.startsWith('~')
    ? path.join(base, pinned.file.slice(2))
    : path.join(base, pinned.file);
  if (!existsSync(file)) {
    return {
      id: `model-${id}`,
      what: `the ${id} model weights`,
      state: 'absent',
      detail: `nothing at ${file} (${(pinned.bytes / 1024 ** 2).toFixed(0)} MiB expected)`,
      blocking,
      remedy:
        id === 'birefnet-general'
          ? 'rembg fetches it on the first cutout; tools/cv/setup.sh does it up front'
          : 'tools/cv/setup.sh',
      remedyVerified: false,
    };
  }
  const bytes = statSync(file).size;
  const matches = bytes === pinned.bytes;
  return {
    id: `model-${id}`,
    what: `the ${id} model weights`,
    state: matches ? 'present' : 'absent',
    detail: `${bytes} bytes at ${file}` + (matches ? ', the pinned size' : `, pinned at ${pinned.bytes}`),
    blocking,
    caveat: 'checked by size; tools/cv/verify-models.sh is what checks the sha256',
    ...(matches ? {} : { remedy: 'tools/cv/verify-models.sh, then tools/cv/setup.sh', remedyVerified: false }),
  };
}

function checkTemplates(): CheckResult {
  const dir = env(OVERRIDES.templatesDir) ?? path.join(REPO_ROOT, 'templates');
  const aep = path.join(dir, 'library.aep');
  const auditPath = path.join(dir, 'library.audit.json');
  if (!existsSync(aep)) {
    return {
      id: 'templates',
      what: 'the template library, matching its recorded audit',
      state: 'absent',
      detail: `nothing at ${aep}`,
      blocking: 'build',
      remedy: 'git checkout templates/library.aep — it is committed',
      remedyVerified: false,
    };
  }
  if (!existsSync(auditPath)) {
    return {
      id: 'templates',
      what: 'the template library, matching its recorded audit',
      state: 'unknown',
      detail: `${aep} is here but there is no audit to compare it against`,
      blocking: 'build',
      remedy: 'npm run audit:templates, with After Effects open',
      remedyVerified: false,
    };
  }
  const audit = JSON.parse(readFileSync(auditPath, 'utf8')) as { aepSha256?: string };
  const actual = sha256Of(aep);
  const matches = audit.aepSha256 === actual;
  return {
    id: 'templates',
    what: 'the template library, matching its recorded audit',
    state: matches ? 'present' : 'absent',
    detail: matches
      ? `sha256 ${actual.slice(0, 16)}, the audited one`
      : `sha256 ${actual.slice(0, 16)} against an audit of ${String(audit.aepSha256).slice(0, 16)}`,
    blocking: 'build',
    ...(matches
      ? {}
      : { remedy: 'npm run audit:templates, with After Effects open', remedyVerified: false }),
  };
}

function checkPanelInstalled(): CheckResult {
  const dir =
    env(OVERRIDES.extensions) ??
    path.join(homedir(), 'Library', 'Application Support', 'Adobe', 'CEP', 'extensions');
  const link = path.join(dir, 'com.framopia.studio');
  const present = existsSync(link);
  return {
    id: 'panel-installed',
    what: 'the panel, where After Effects looks for extensions',
    state: present ? 'present' : 'absent',
    detail: present ? link : `nothing at ${link}`,
    blocking: 'panel',
    ...(present
      ? {}
      : {
          remedy: 'npm run panel:install, then restart After Effects once',
          remedyVerified: false,
        }),
  };
}

function checkPanelBuilt(): CheckResult {
  const dist = env(OVERRIDES.panelDist) ?? path.join(REPO_ROOT, 'panel', 'dist', 'panel.js');
  const present = existsSync(dist);
  return {
    id: 'panel-built',
    what: 'the panel bundle the manifest points at',
    state: present ? 'present' : 'absent',
    detail: present ? `${statSync(dist).size} bytes at ${dist}` : `nothing at ${dist}`,
    blocking: 'panel',
    ...(present ? {} : { remedy: 'npm run panel:build', remedyVerified: false }),
  };
}

/** An unsigned extension will not load without this, on a fresh machine. */
function checkDebugMode(): CheckResult {
  const domains = [10, 11, 12, 13];
  const set: number[] = [];
  const unset: number[] = [];
  for (const version of domains) {
    const probed = probe('defaults', ['read', `com.adobe.CSXS.${version}`, 'PlayerDebugMode']);
    if (probed.ok && probed.out.trim() === '1') set.push(version);
    else unset.push(version);
  }
  /*
   * CSXS 12 is the one After Effects 2026 reads; the neighbours are set by the
   * installer for a machine with several Adobe versions, so their absence is
   * worth reporting and is not a blocker on its own.
   */
  const ok = set.includes(12);
  return {
    id: 'cep-debug-mode',
    what: 'PlayerDebugMode, without which an unsigned extension will not load',
    state: ok ? 'present' : 'absent',
    detail: `set on CSXS ${set.join(', ') || 'none'}; unset on ${unset.join(', ') || 'none'}`,
    blocking: 'panel',
    ...(ok ? {} : { remedy: 'npm run panel:install, which sets it on CSXS 10-13', remedyVerified: false }),
  };
}

/**
 * What a key must not be.
 *
 * **A key being present is not the same as a key being real.** Block 11 session
 * 55 rehearsed the setup document literally: it says to copy
 * `config.example.json` to `.local/config.json` and edit it, and a partner who
 * copies it and forgets to edit got
 *
 * ```
 *   ok    the API keys, by presence
 *         googleApiKey present (value not shown), elevenLabsApiKey present (value not shown)
 * ```
 *
 * — a green tick over `AIzaYourGoogleKey`. The first thing that then goes wrong
 * is a paid call failing as unauthorised, long after the doctor said the
 * machine was ready.
 *
 * **The placeholders are read out of `config.example.json` itself**, never
 * copied here, so this cannot drift from the file it compares against. If the
 * example is reworded, this follows it.
 *
 * **There is no issuer prefix rule, and that is deliberate.** The obvious one —
 * a Google key begins `AIza` — was written, run, and **refused a working key**:
 * measured on 2026-09-05, the key this machine actually bills with is 53
 * characters, does not begin `AIza`, and carries a character outside
 * `[A-Za-z0-9_-]`. A check that refuses a key that works is worse than the one
 * it replaced, so what is asserted is only what the evidence supports: it is
 * not the example's value, it does not read like a placeholder, and it is long
 * enough to be a credential at all.
 *
 * **Nothing here calls either service.** The only way to prove a key works is to
 * spend money with it, and a check that bills is not a check anyone would run.
 */
const KEYS_WANTED = ['googleApiKey', 'elevenLabsApiKey'] as const;

/** Every placeholder in `config.example.json` says "your". None of them is a key. */
const READS_LIKE_A_PLACEHOLDER = /your/i;

/** Short enough that nothing either service issues could be mistaken for it. */
const SHORTEST_CREDIBLE_KEY = 20;

/**
 * The example's value for a key, or null when the example cannot be read.
 *
 * A missing or unreadable example makes the placeholder comparison silently
 * pass, which is the right way round: the shape check still applies, and a
 * doctor that refused because a documentation file was missing would be
 * refusing for the wrong reason.
 */
function examplePlaceholder(name: string): string | null {
  const example = path.join(REPO_ROOT, 'config.example.json');
  if (!existsSync(example)) return null;
  try {
    const parsed = JSON.parse(readFileSync(example, 'utf8')) as Record<string, unknown>;
    const value = parsed[name];
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

function checkConfigKeys(): CheckResult {
  const file = path.join(LOCAL(), 'config.json');
  if (!existsSync(file)) {
    return {
      id: 'api-keys',
      what: 'the API keys, by presence',
      state: 'absent',
      detail: `nothing at ${file}`,
      blocking: 'run',
      remedy: 'copy config.example.json to .local/config.json and fill in the two keys',
      remedyVerified: false,
    };
  }
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    return {
      id: 'api-keys',
      what: 'the API keys, by presence',
      state: 'unknown',
      detail: `${file} did not parse: ${(error as Error).message}`,
      blocking: 'run',
      remedy: 'compare it against config.example.json',
      remedyVerified: false,
    };
  }
  const faults: string[] = [];
  for (const name of KEYS_WANTED) {
    const raw = config[name];
    if (typeof raw !== 'string' || raw.trim() === '') {
      faults.push(`${name} is missing`);
      continue;
    }
    const value = raw.trim();
    if (value === examplePlaceholder(name)) {
      faults.push(`${name} is still the example's placeholder, not a key`);
      continue;
    }
    if (READS_LIKE_A_PLACEHOLDER.test(value)) {
      faults.push(`${name} still reads like an example rather than a key`);
      continue;
    }
    if (value.length < SHORTEST_CREDIBLE_KEY) {
      faults.push(`${name} is too short to be a key`);
    }
  }
  return {
    id: 'api-keys',
    what: 'the API keys, by presence and shape',
    state: faults.length === 0 ? 'present' : 'absent',
    // The value never appears — not the first characters, not the length.
    detail:
      faults.length === 0
        ? `googleApiKey ${redact()}, elevenLabsApiKey ${redact()}`
        : faults.join('; '),
    blocking: 'run',
    ...(faults.length === 0
      ? {}
      : {
          remedy:
            'open .local/config.json and replace the two placeholder values with your own ' +
            'keys — the ones from config.example.json are examples of the shape, not keys',
          remedyVerified: false,
        }),
  };
}

/** Expected absent on a cold machine: the pipeline measures it itself. */
function checkWatermarkFacts(): CheckResult {
  const file = path.join(LOCAL(), 'build', 'watermark.json');
  const present = existsSync(file);
  return {
    id: 'watermark-facts',
    what: 'the watermark measurement',
    state: present ? 'present' : 'absent',
    detail: present ? file : `nothing at ${file}`,
    blocking: 'money',
    caveat:
      'expected absent on a machine that has never run the pipeline — the transcription ' +
      'stage measures it and writes this file, so it costs one ffmpeg pass rather than a fault',
    ...(present
      ? {}
      : { remedy: 'run the pipeline once, or npm run watermark:measure', remedyVerified: false }),
  };
}

function checkLoudness(): CheckResult {
  const dir = path.join(LOCAL(), 'build', 'loudness');
  if (!existsSync(dir)) {
    return {
      id: 'loudness-records',
      what: 'the per-reel dialogue loudness records',
      state: 'absent',
      detail: `nothing at ${dir}`,
      blocking: 'money',
      caveat: 'measured by the transcription stage, like the watermark; absent is expected cold',
      remedy: 'run the pipeline, or npm run loudness:measure',
      remedyVerified: false,
    };
  }
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  return {
    id: 'loudness-records',
    what: 'the per-reel dialogue loudness records',
    state: files.length > 0 ? 'present' : 'absent',
    detail: `${files.length} record(s) in ${dir}`,
    blocking: 'money',
    caveat: 'measured by the transcription stage, like the watermark; absent is expected cold',
    ...(files.length > 0
      ? {}
      : { remedy: 'run the pipeline, or npm run loudness:measure', remedyVerified: false }),
  };
}

interface Reel {
  label: string;
  path: string;
  /** Recorded in benchmarks/footage.json since Block 10 session 10. */
  sha256?: string;
  bytes?: number;
}

/**
 * The footage, against the hash the catalogue records for it.
 *
 * `benchmarks/footage.json` carries a sha256, a byte count and a fetch note per
 * reel since Block 10 session 10; before that the only figure was `source.sha256`
 * on the reel's own Edit Plan, which is still the fallback. A file that does not
 * match is a different cut, and every cached transcription for it will miss.
 */
function checkFootage(options: { hash: boolean }): CheckResult {
  const catalogue = JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'benchmarks', 'footage.json'), 'utf8'),
  ) as { reels: Reel[] };
  const dir = env(OVERRIDES.footageDir);
  const missing: string[] = [];
  const wrong: string[] = [];
  let hashed = 0;
  let unhashed = 0;
  let unchecked = 0;
  for (const reel of catalogue.reels) {
    const file = dir === undefined ? reel.path : path.join(dir, path.basename(reel.path));
    if (!existsSync(file)) {
      missing.push(reel.label);
      continue;
    }
    if (!options.hash) {
      unchecked += 1;
      continue;
    }
    let recorded = reel.sha256;
    if (typeof recorded !== 'string') {
      const planPath = file.replace(/\.[^.]+$/u, '.editplan.json');
      if (existsSync(planPath)) {
        const plan = JSON.parse(readFileSync(planPath, 'utf8')) as { source?: { sha256?: string } };
        recorded = plan.source?.sha256;
      }
    }
    if (typeof recorded !== 'string') {
      unhashed += 1;
      continue;
    }
    if (sha256OfLarge(file) === recorded) hashed += 1;
    else wrong.push(reel.label);
  }
  const state = missing.length > 0 || wrong.length > 0 ? 'absent' : 'present';
  const parts = options.hash
    ? [`${hashed} of ${catalogue.reels.length} match the sha256 on their Edit Plan`]
    : [`${unchecked} of ${catalogue.reels.length} present; not hashed (--hash-footage does that)`];
  if (unhashed > 0) parts.push(`${unhashed} present with no recorded hash to check`);
  if (missing.length > 0) parts.push(`missing: ${missing.join(', ')}`);
  if (wrong.length > 0) parts.push(`WRONG CUT: ${wrong.join(', ')}`);
  return {
    id: 'footage',
    what: 'the source reels, which are not in git',
    state,
    detail: parts.join('; '),
    blocking: 'run',
    caveat:
      'checked against the sha256 in benchmarks/footage.json, which also carries the fetch ' +
      'note saying where the files come from; a reel’s own Edit Plan is the fallback',
    ...(state === 'present'
      ? {}
      : {
          remedy:
            'copy the five reels into "my files/test videos/"; benchmarks/footage.json’s ' +
            'fetchNote says where they come from',
          remedyVerified: false,
        }),
  };
}

function checkCache(): CheckResult {
  const root = path.join(LOCAL(), 'cache');
  if (!existsSync(root)) {
    return {
      id: 'cache',
      what: 'the API cache, which is what makes a re-run free',
      state: 'absent',
      detail: `nothing at ${root}`,
      blocking: 'money',
      caveat: 'absent costs money, not correctness: every stage bills again',
      remedy: 'nothing to do — it fills as stages run, or copy it from the other machine',
      remedyVerified: false,
    };
  }
  const videos = readdirSync(root).filter((d) => statSync(path.join(root, d)).isDirectory());
  let entries = 0;
  for (const video of videos) entries += readdirSync(path.join(root, video)).length;
  return {
    id: 'cache',
    what: 'the API cache, which is what makes a re-run free',
    state: entries > 0 ? 'present' : 'absent',
    detail: `${entries} entries across ${videos.length} video(s) in ${root}`,
    blocking: 'money',
    caveat: 'absent costs money, not correctness: every stage bills again',
    ...(entries > 0
      ? {}
      : { remedy: 'nothing to do — it fills as stages run', remedyVerified: false }),
  };
}

function checkLedger(): CheckResult {
  const file = path.join(LOCAL(), 'costs.jsonl');
  if (!existsSync(file)) {
    return {
      id: 'ledger',
      what: 'the cost ledger',
      state: 'absent',
      detail: `nothing at ${file}`,
      blocking: 'money',
      caveat: 'append-only and irreplaceable; a fresh machine starts its own',
      remedy: 'nothing to do — the first billable call creates it',
      remedyVerified: false,
    };
  }
  const lines = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() !== '');
  return {
    id: 'ledger',
    what: 'the cost ledger',
    state: 'present',
    detail: `${lines.length} lines at ${file}`,
    blocking: 'money',
    caveat: 'append-only and irreplaceable; a fresh machine starts its own',
  };
}

function checkDisk(): CheckResult {
  const minGb = Number(env(OVERRIDES.minFreeGb) ?? MIN_FREE_GB);
  const probed = probe('df', ['-k', REPO_ROOT]);
  if (!probed.ok) {
    return {
      id: 'disk',
      what: `free disk space, at least ${minGb} GB`,
      state: 'unknown',
      detail: 'df did not run',
      blocking: 'run',
    };
  }
  const out = execFileSync('df', ['-k', REPO_ROOT], { encoding: 'utf8' });
  const row = out.split('\n')[1] ?? '';
  const available = Number(row.split(/\s+/u)[3] ?? '0') * 1024;
  const gb = available / 1024 ** 3;
  const ok = gb >= minGb;
  return {
    id: 'disk',
    what: `free disk space, at least ${minGb} GB`,
    state: ok ? 'present' : 'absent',
    detail: `${gb.toFixed(1)} GB free on the volume holding the repo`,
    blocking: 'run',
    caveat:
      `${minGb} GB is derived: 14.6 GB measured on 2026-08-31 across the repo, node_modules, ` +
      'the venv, both CV models, the footage, the cache, the cutouts, the frames and masks ' +
      'and the built files, plus a quarter again. The components are in MIN_FREE_GB in ' +
      'tools/doctor/checks.ts. The optional Whisper baseline (4.0 GB) is not counted.',
    ...(ok ? {} : { remedy: 'free space on the volume holding the repo', remedyVerified: false }),
  };
}

function checkXmllint(): CheckResult {
  // xmllint prints its version to stderr, so a captured stdout is empty.
  const probed = probe('xmllint', ['--version']);
  return {
    id: 'xmllint',
    what: 'xmllint, which parses the panel manifest in npm run check',
    state: probed.ok ? 'present' : 'absent',
    detail: probed.ok ? 'on PATH and runs' : 'not on PATH',
    blocking: 'dev',
    caveat: 'the gate prints a notice and does not fail without it, so this blocks nothing',
    ...(probed.ok
      ? {}
      : { remedy: 'it ships with macOS; xcode-select --install restores it', remedyVerified: false }),
  };
}

/** What a live After Effects reported, when there was one to ask. */
export interface AeState {
  reachable: boolean;
  reason?: string;
  /**
   * A script ran to completion — `DoScript` returned 0. This needs no file, so
   * it is the one thing an After Effects with the scripting preference off can
   * still tell us.
   */
  answering?: boolean | null;
  /** The file-writing probe produced its result. */
  wroteResult?: boolean;
  appVersion?: string;
  scriptingAllowed?: boolean | null;
  fontNames?: string[];
  fontNameCount?: number;
  instances?: number;
}

function checkAeRunning(ae: AeState): CheckResult {
  if (!ae.reachable) {
    return {
      id: 'after-effects',
      what: 'After Effects, running and answering',
      state: 'unknown',
      detail: ae.reason ?? 'could not be asked',
      blocking: 'build',
      caveat: 'nothing here may launch After Effects; a build needs a person to open it',
      remedy: 'open After Effects and run this again',
      remedyVerified: false,
    };
  }
  return {
    id: 'after-effects',
    what: 'After Effects, running and answering',
    state: 'present',
    detail: `${ae.appVersion ?? 'unknown version'}, ${ae.instances ?? 1} instance(s)`,
    blocking: 'build',
  };
}

/**
 * The preference a fresh install has switched off.
 *
 * Every driven script writes its result to a file for the caller to read back,
 * so a machine with this off produces "After Effects wrote no result" and
 * nothing that names the cause. Checked nowhere in this repo before Block 10
 * session 9.
 */
function checkScripting(ae: AeState): CheckResult {
  const verdict = scriptingVerdict({
    answering: ae.answering ?? null,
    wroteResult: ae.wroteResult === true,
    preference: ae.scriptingAllowed ?? null,
  });
  return {
    id: 'ae-scripting',
    what: 'After Effects allowed to let scripts write files',
    state: verdict.state,
    detail: verdict.detail,
    blocking: 'build',
    ...(verdict.remedy === undefined
      ? {}
      : { remedy: verdict.remedy, remedyVerified: false }),
  };
}

/**
 * The three faces, reported rather than certified.
 *
 * Block 9 session 5 recorded that a name set but not installed stays in
 * `app.fonts.allFonts` for the rest of the application session; Block 10
 * session 1 probed for the sentinel it would have left and did not find it, and
 * could not explain a count that had moved 1200 to 1198. So this states what it
 * observed and how long After Effects has been up, and does not claim more.
 */
function checkFonts(ae: AeState, modeId: string): CheckResult {
  let wanted: string[] = [];
  try {
    const mode = loadMode(modeId);
    const names = mode.fonts.status === 'set' ? mode.fonts.postScriptNames : undefined;
    wanted = [names?.latin, names?.arabic, names?.emphasis].filter(
      (n): n is string => typeof n === 'string' && n.length > 0,
    );
  } catch (error) {
    return {
      id: 'fonts',
      what: 'the client’s faces, by PostScript name',
      state: 'unknown',
      detail: `${modeId} did not load: ${(error as Error).message}`,
      blocking: 'build',
    };
  }
  if (wanted.length === 0) {
    return {
      id: 'fonts',
      what: 'the client’s faces, by PostScript name',
      state: 'unknown',
      detail: `${modeId} declares no measured PostScript names`,
      blocking: 'build',
      caveat: 'a client with no measured names builds in the template’s own type',
    };
  }
  if (!ae.reachable || ae.fontNames === undefined) {
    return {
      id: 'fonts',
      what: 'the client’s faces, by PostScript name',
      state: 'unknown',
      detail: `${wanted.join(', ')} — After Effects is not answering, so nothing was checked`,
      blocking: 'build',
      caveat:
        'After Effects accepts a font name it cannot resolve and substitutes silently, so ' +
        'this is the only check that stands between a wrong face and a comp that looks built',
      remedy: 'open After Effects and run this again',
      remedyVerified: false,
    };
  }
  const { missing, nearby } = compareFontNames(wanted, ae.fontNames);
  // A mismatch arrives as two lists, never as a verdict: After Effects names a
  // variable font's instance differently from the file and from macOS, so a
  // missing name is not evidence the wrong file was installed.
  const comparison = missing
    .map((name) => {
      const offered = nearby[name] ?? [];
      return offered.length === 0
        ? `wanted ${name}; After Effects lists nothing under that family`
        : `wanted ${name}; After Effects lists ${offered.join(', ')}`;
    })
    .join(' | ');
  return {
    id: 'fonts',
    what: 'the client’s faces, by PostScript name',
    state: missing.length === 0 ? 'present' : 'absent',
    detail:
      missing.length === 0
        ? `${wanted.join(', ')} all listed, among ${ae.fontNameCount ?? '?'} names`
        : comparison,
    blocking: 'build',
    caveat:
      'reported, not certified: a name written but not installed is recorded to stay in ' +
      'app.fonts.allFonts for the rest of the application session, and Block 10 session 1 ' +
      'could not reproduce that. Restart After Effects for a reading nothing could have polluted. ' +
      'After Effects names a variable font differently from macOS, so a name missing here is not ' +
      'evidence the wrong file is installed — report both lists rather than renaming anything.',
    ...(missing.length === 0
      ? {}
      : { remedy: `install ${missing.join(', ')} and restart After Effects`, remedyVerified: false }),
  };
}

export interface CheckOptions {
  modeId?: string;
  /** Hashing five 2.4 GB reels takes about half a minute; off unless asked. */
  hashFootage?: boolean;
}

export function runChecks(ae: AeState, options: CheckOptions = {}): CheckResult[] {
  const modeId = options.modeId ?? 'k2-syndicalia';
  return [
    checkRepo(),
    checkNode(),
    checkDependencies(),
    checkFfmpeg('ffmpeg'),
    checkFfmpeg('ffprobe'),
    checkVenv(),
    checkVenvPackages(),
    checkModel('selfie-multiclass-256x256', 'build'),
    checkModel('birefnet-general', 'build'),
    checkTemplates(),
    checkAeRunning(ae),
    checkScripting(ae),
    checkFonts(ae, modeId),
    checkPanelInstalled(),
    checkPanelBuilt(),
    checkDebugMode(),
    checkConfigKeys(),
    checkWatermarkFacts(),
    checkLoudness(),
    checkFootage({ hash: options.hashFootage === true }),
    checkCache(),
    checkLedger(),
    checkDisk(),
    checkXmllint(),
  ];
}
