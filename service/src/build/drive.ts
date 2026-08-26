import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';

/**
 * Drives the **already-running** After Effects over AppleScript `DoScript`,
 * the same mechanism tools/validate-templates/cli.ts uses.
 *
 * The application name is a literal, so this is machine-specific: another AE
 * version, or a differently-named install, fails to find the app. Block 10's
 * golden run on a second machine is where that has to be solved.
 *
 * Launching with `-r` is not an option. It is unusably slow here, and a
 * resident `-r` process has been observed executing its body long afterwards
 * and quitting the application out from under a later session.
 */
export const AE_APPLICATION = 'Adobe After Effects 2026';

const JSX_DIR = path.join(REPO_ROOT, 'panel', 'jsx');
const RUN_DIR = path.join(REPO_ROOT, '.local', 'build');

export class AeDriveError extends Error {}

/** Only the application process counts; AE always spawns helpers. */
const AE_EXECUTABLE =
  '/Applications/Adobe After Effects 2026/Adobe After Effects 2026.app/Contents/MacOS/After Effects';

export function countAeInstances(): number {
  const out = execFileSync('ps', ['-axo', 'comm='], { encoding: 'utf8' });
  return out.split('\n').filter((line) => line.trim() === AE_EXECUTABLE).length;
}

/**
 * A second instance would receive the Apple event non-deterministically, and a
 * resident `-r` instance can quit the application mid-script. Checked
 * immediately before every send rather than once per run.
 */
export function assertOneInstance(): void {
  const n = countAeInstances();
  if (n !== 1) {
    throw new AeDriveError(
      `expected exactly 1 running After Effects instance, found ${n}. ` +
        'Close the extra instances by hand — this tool never kills them, ' +
        'because a wrong kill takes an open project with it.',
    );
  }
}

export interface BuildOptions {
  [key: string]: unknown;
  savePath: string;
}

export type BuildResult =
  | ({ ok: true } & Record<string, unknown>)
  | { ok: false; stage: string; message: string };

/**
 * Options travel through a file rather than being interpolated into the
 * AppleScript string: the text of a subtitle is arbitrary user content and
 * quoting it through osascript, AppleScript and ExtendScript in turn is three
 * chances to corrupt it.
 */
export function runBuild(options: BuildOptions): BuildResult {
  return runJsx('build.jsx', 'framopiaBuild', options);
}

/**
 * Runs on the project already open, so the subtitle card and the image land in
 * one master comp. `build.jsx` starts a new project; this deliberately does
 * not.
 */
export function runImageProbe(options: Record<string, unknown>): BuildResult {
  return runJsx('image-probe.jsx', 'framopiaImageProbe', options);
}

/** Builds a whole reel into one or more master comps in a single project. */
export function runBuildReel(options: Record<string, unknown>): BuildResult {
  return runJsx('build-reel.jsx', 'framopiaBuildReel', options);
}

/** Measures every card in the corpus. Reads the library; writes no comp. */
export function runMeasureSurvey(options: Record<string, unknown>): BuildResult {
  return runJsx('measure-survey.jsx', 'framopiaMeasureSurvey', options);
}

function runJsx(
  file: string,
  entry: string,
  options: Record<string, unknown>,
): BuildResult {
  assertOneInstance();
  mkdirSync(RUN_DIR, { recursive: true });

  const optionsPath = path.join(RUN_DIR, '.build-options.json');
  const resultPath = path.join(RUN_DIR, '.build-result.json');
  writeFileSync(optionsPath, JSON.stringify(options), 'utf8');
  if (existsSync(resultPath)) unlinkSync(resultPath);

  const script = [
    `$.evalFile("${path.join(JSX_DIR, 'json2.jsx')}");`,
    `$.evalFile("${path.join(JSX_DIR, 'text-fit.jsx')}");`,
    `$.evalFile("${path.join(JSX_DIR, file)}");`,
    `${entry}("${optionsPath}", "${resultPath}");`,
  ]
    .join(' ')
    .replace(/"/g, '\\"');

  execFileSync(
    'osascript',
    ['-e', `tell application "${AE_APPLICATION}" to DoScript "${script}"`],
    { stdio: 'ignore' },
  );

  if (!existsSync(resultPath)) {
    throw new AeDriveError(
      'After Effects wrote no result. It has to be running with a closable project; ' +
        'launching it with -r does not work on this machine.',
    );
  }
  const parsed = JSON.parse(readFileSync(resultPath, 'utf8')) as BuildResult;
  unlinkSync(resultPath);
  return parsed;
}
