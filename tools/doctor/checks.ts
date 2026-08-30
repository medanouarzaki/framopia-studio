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
import { existsSync, openSync, closeSync, readSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir, hostname, arch, platform, release } from 'node:os';
import path from 'node:path';
import {
  REPO_ROOT,
  loadMode,
  redact,
  resolveFfmpegPath,
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

/** Chosen, not measured: nothing in the repo states a disk figure. */
export const MIN_FREE_GB = 20;

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

function checkRepo(): CheckResult {
  const marker = path.join(REPO_ROOT, 'package.json');
  if (!existsSync(marker)) {
    return {
      id: 'repo',
      what: 'the repository, at the path everything resolves from',
      state: 'absent',
      detail: `nothing at ${REPO_ROOT}`,
      blocking: 'run',
      remedy: 'plug in the external drive; the repo has to be at this exact path',
      remedyVerified: false,
    };
  }
  return {
    id: 'repo',
    what: 'the repository, at the path everything resolves from',
    state: 'present',
    detail: REPO_ROOT,
    blocking: 'run',
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
  const wanted = ['googleApiKey', 'elevenLabsApiKey'] as const;
  const missing = wanted.filter((k) => typeof config[k] !== 'string' || config[k] === '');
  return {
    id: 'api-keys',
    what: 'the API keys, by presence',
    state: missing.length === 0 ? 'present' : 'absent',
    // The value never appears — not the first characters, not the length.
    detail:
      missing.length === 0
        ? `googleApiKey ${redact()}, elevenLabsApiKey ${redact()}`
        : `missing: ${missing.join(', ')}`,
    blocking: 'run',
    ...(missing.length === 0
      ? {}
      : { remedy: 'add them to .local/config.json; the shape is in config.example.json', remedyVerified: false }),
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
}

/**
 * The footage, against the only hash the repo records for it.
 *
 * `benchmarks/footage.json` carries no hash and no fetch note, so the sha256 on
 * each reel's own Edit Plan is the only figure there is — and where no plan
 * exists the check can report presence and nothing more. It says which.
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
    const planPath = file.replace(/\.[^.]+$/u, '.editplan.json');
    if (!existsSync(planPath)) {
      unhashed += 1;
      continue;
    }
    const plan = JSON.parse(readFileSync(planPath, 'utf8')) as { source?: { sha256?: string } };
    const recorded = plan.source?.sha256;
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
      'benchmarks/footage.json records no hash and no fetch note, so the only figure to ' +
      'check against is source.sha256 on each reel’s own Edit Plan',
    ...(state === 'present'
      ? {}
      : { remedy: 'copy the reels onto this machine at the paths benchmarks/footage.json names', remedyVerified: false }),
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
    caveat: `${minGb} GB is chosen, not measured: nothing in the repo states a figure. ` +
      'The two CV models are ~945 MiB and the corpus footage is 11.9 GB.',
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
  if (!ae.reachable) {
    return {
      id: 'ae-scripting',
      what: 'After Effects allowed to let scripts write files',
      state: 'unknown',
      detail: 'After Effects is not answering, so the preference could not be read',
      blocking: 'build',
      remedy: 'Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network',
      remedyVerified: false,
    };
  }
  if (ae.scriptingAllowed === null || ae.scriptingAllowed === undefined) {
    return {
      id: 'ae-scripting',
      what: 'After Effects allowed to let scripts write files',
      state: 'unknown',
      detail: 'the preference could not be read from this After Effects',
      blocking: 'build',
      remedy: 'Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network',
      remedyVerified: false,
    };
  }
  return {
    id: 'ae-scripting',
    what: 'After Effects allowed to let scripts write files',
    state: ae.scriptingAllowed ? 'present' : 'absent',
    detail: ae.scriptingAllowed
      ? 'the preference is on, which is what lets a driven build return its result'
      : 'the preference is OFF; every driven script will fail to write its result file',
    blocking: 'build',
    ...(ae.scriptingAllowed
      ? {}
      : {
          remedy:
            'Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network',
          remedyVerified: false,
        }),
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
  const installed = new Set(ae.fontNames);
  const missing = wanted.filter((n) => !installed.has(n));
  return {
    id: 'fonts',
    what: 'the client’s faces, by PostScript name',
    state: missing.length === 0 ? 'present' : 'absent',
    detail:
      missing.length === 0
        ? `${wanted.join(', ')} all listed, among ${ae.fontNameCount ?? '?'} names`
        : `missing: ${missing.join(', ')} (of ${wanted.join(', ')})`,
    blocking: 'build',
    caveat:
      'reported, not certified: a name written but not installed is recorded to stay in ' +
      'app.fonts.allFonts for the rest of the application session, and Block 10 session 1 ' +
      'could not reproduce that. Restart After Effects for a reading nothing could have polluted.',
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
