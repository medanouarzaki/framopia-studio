import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { registerJobRunner, type Job } from '../jobs.js';
import {
  BUILD_STAGES,
  BUILD_STAGES_ENV,
  parseBuildStage,
  type BuildStageId,
} from './stages.js';

export const BUILD_JOB_TYPE = 'build';

/** The compiled CLI a terminal runs, spawned rather than imported. */
export const BUILD_CLI = path.join(REPO_ROOT, 'service', 'dist', 'build', 'build-reel-cli.js');

export type BuildStageState = 'waiting' | 'running' | 'done';

export interface BuildStageReport {
  id: BuildStageId;
  label: string;
  state: BuildStageState;
}

export interface BuildProgress {
  reel: string;
  planPath: string;
  stages: BuildStageReport[];
  /** 0..1 across the three stages. */
  percent: number;
  done: boolean;
  /** Where the project was written, once it has been. */
  savePath: string | null;
  /** A previous build of ours that was open and got saved on the way past. */
  savedOwnOutput: string | null;
  wallS: number | null;
  /** The builder's own words when it refused or failed. */
  error: string | null;
}

export class BuildJobError extends Error {}

/**
 * Building drives the user's **running** After Effects over AppleScript, and
 * `runBuildReel` blocks on it synchronously. Running that inside the service
 * would freeze the event loop for the whole build, so `GET /jobs/:id` could not
 * be answered until it finished and the panel would see nothing at all until
 * the end — the opposite of the progress the pipeline runner gives.
 *
 * So the job spawns the CLI instead. That also settles the drift question the
 * dry run and the runner once lost a session to: the panel and the terminal do
 * not run *equivalent* code, they run **the same file**.
 */
export function buildCommand(planPath: string, modeId?: string): string[] {
  const args = [BUILD_CLI, '--plan', planPath];
  if (modeId !== undefined) args.push('--mode', modeId);
  return args;
}

function initialStages(): BuildStageReport[] {
  return BUILD_STAGES.map((s) => ({ id: s.id, label: s.label, state: 'waiting' as const }));
}

export function progressPercent(stages: BuildStageReport[]): number {
  const done = stages.filter((s) => s.state === 'done').length;
  return stages.length === 0 ? 0 : done / stages.length;
}

/**
 * The sentence the build meant a person to read.
 *
 * Its own refusal first — the unsaved-changes guard above all, which is written
 * as an instruction. Then a thrown error's message, because an uncaught throw
 * ends with a stack and a Node version banner, and taking the last line would
 * put "Node.js v24.14.1" on screen as the reason a build failed. An exit code
 * is the last resort: nobody can act on one.
 */
export function failureMessage(stderr: string, code: number | null): string {
  const lines = stderr
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const refusal = lines.find((l) => l.startsWith('build refused at '));
  if (refusal !== undefined) return refusal;
  const thrown = lines.find((l) => /^[A-Za-z][A-Za-z0-9_]*Error: /.test(l));
  if (thrown !== undefined) return thrown;
  const said = lines.filter((l) => !l.startsWith('at ') && !/^Node\.js v/.test(l));
  if (said.length > 0) return said[said.length - 1] as string;
  return `the build exited with code ${code ?? 'unknown'} and said nothing`;
}

export interface RunBuildInput {
  reel: string;
  planPath: string;
  modeId?: string;
  onProgress?: (progress: BuildProgress) => void;
}

export async function runBuildJob(input: RunBuildInput): Promise<BuildProgress> {
  if (!existsSync(input.planPath)) {
    throw new BuildJobError(
      `there is no Edit Plan at ${input.planPath}. Run the pipeline for this reel first.`,
    );
  }
  if (!existsSync(BUILD_CLI)) {
    throw new BuildJobError(
      'the service has not been built, so there is nothing to build the reel with. ' +
        'Run npm run service:build, then reopen the panel.',
    );
  }
  /*
   * The service is itself running under Node, and the panel resolved that
   * binary when it spawned the service — so `process.execPath` is the one
   * interpreter already known to work on this machine. Resolving a second one
   * here could pick a different Node than the service runs on.
   */
  const node = process.execPath;

  const progress: BuildProgress = {
    reel: input.reel,
    planPath: input.planPath,
    stages: initialStages(),
    percent: 0,
    done: false,
    savePath: null,
    savedOwnOutput: null,
    wallS: null,
    error: null,
  };
  const report = (): void => {
    progress.percent = progressPercent(progress.stages);
    input.onProgress?.({ ...progress, stages: progress.stages.map((s) => ({ ...s })) });
  };

  const startedAt = Date.now();
  const child = spawn(node, buildCommand(input.planPath, input.modeId), {
    cwd: REPO_ROOT,
    env: { ...process.env, [BUILD_STAGES_ENV]: '1' },
  });

  let stdout = '';
  let stderr = '';
  let pending = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk;
    pending += chunk;
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) {
      const stage = parseBuildStage(line);
      if (stage === null) continue;
      let seen = false;
      for (const s of progress.stages) {
        if (s.id === stage) {
          s.state = 'running';
          seen = true;
        } else if (!seen) {
          s.state = 'done';
        }
      }
      report();
    }
  });
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });

  const code = await new Promise<number | null>((resolve, reject) => {
    child.on('error', (error: Error) => {
      reject(new BuildJobError(`the build could not be started: ${error.message}`));
    });
    child.on('close', (exitCode) => resolve(exitCode));
  });

  progress.wallS = (Date.now() - startedAt) / 1000;
  if (code !== 0) {
    progress.error = failureMessage(stderr, code);
    report();
    throw new BuildJobError(progress.error);
  }

  for (const s of progress.stages) s.state = 'done';
  progress.done = true;
  progress.savePath = readSavePath(stdout);
  progress.savedOwnOutput = readSavedOwnOutput(stdout);
  report();
  return progress;
}

/*
 * The build prints its result as JSON, and `savePath` is what the user wants to
 * know. Read from the JSON rather than from a sentence, so a reworded line
 * cannot quietly turn the file's name into null.
 */
export function readSavePath(stdout: string): string | null {
  return readResultField(stdout, 'savePath');
}

export function readSavedOwnOutput(stdout: string): string | null {
  return readResultField(stdout, 'savedOwnOutput');
}

function readResultField(stdout: string, field: string): string | null {
  const pattern = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'g');
  let last: string | null = null;
  for (const match of stdout.matchAll(pattern)) {
    try {
      last = JSON.parse(`"${match[1] ?? ''}"`) as string;
    } catch {
      last = match[1] ?? null;
    }
  }
  return last;
}

registerJobRunner(BUILD_JOB_TYPE, async (params, job: Job) => {
  const reel = params?.['reel'];
  const planPath = params?.['planPath'];
  const modeId = params?.['mode'];
  if (typeof reel !== 'string' || reel.length === 0) {
    throw new BuildJobError('a build job needs a reel');
  }
  if (typeof planPath !== 'string' || planPath.length === 0) {
    throw new BuildJobError('a build job needs the path of the reel’s Edit Plan');
  }
  return await runBuildJob({
    reel,
    planPath,
    modeId: typeof modeId === 'string' && modeId.length > 0 ? modeId : undefined,
    onProgress: (progress) => {
      job.progress = progress.percent;
      job.detail = progress;
    },
  });
});
