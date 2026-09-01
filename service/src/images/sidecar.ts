import { spawn } from 'node:child_process';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';

/**
 * The CV sidecar, ARCHITECTURE §1.4: a subprocess per task, JSON on stdin,
 * JSON on stdout, no server and no state.
 *
 * stdout is parsed, so anything the sidecar writes there that is not the
 * result corrupts it. The Python side keeps progress and tracebacks on
 * stderr; this side surfaces stderr only when the call fails, because rembg
 * and onnxruntime are chatty and a successful run's noise is not worth
 * printing.
 */
export const SIDECAR_DIR = path.join(REPO_ROOT, 'tools', 'cv');
export const SIDECAR_PYTHON = path.join(SIDECAR_DIR, '.venv', 'bin', 'python');

/**
 * `FRAMOPIA_SIDECAR_DIR` runs a scratch package instead, so a sidecar that dies
 * can be watched without touching the real one — the device
 * `FRAMOPIA_REFERENCE_ROOT` gives the reference gate. The interpreter is always
 * the real venv's: the crash being reproduced is Python's, not this repo's.
 */
function sidecarCwd(): string {
  return process.env['FRAMOPIA_SIDECAR_DIR'] ?? SIDECAR_DIR;
}

export class SidecarError extends Error {
  constructor(
    message: string,
    readonly stderr: string,
  ) {
    super(message);
    this.name = 'SidecarError';
  }
}

export interface CutoutMetricsJson {
  alpha_edge_noise: number;
  hole_ratio: number;
  foreground_area: number;
  edge_halo: number;
}

export interface SidecarGate {
  presentation: 'cutout' | 'card';
  passed: boolean;
  failures: string[];
}

export interface OcrDetection {
  text: string;
  confidence: number;
}

export interface TextVerdictJson {
  hasText: boolean;
  expected: string[];
  unexpected: string[];
  ok: boolean;
}

export interface SidecarOcr {
  hasText: boolean;
  detections: OcrDetection[];
  /** Present only when the caller supplied the slot's idea to check against. */
  verdict?: TextVerdictJson;
}

export interface RemoveBgResult {
  ok: true;
  task: 'remove_bg';
  imagePath: string;
  cutoutPath: string;
  model: string;
  alphaMatting: boolean;
  postProcessMask?: boolean;
  width: number;
  height: number;
  metrics: CutoutMetricsJson;
  gate: SidecarGate;
  ocr?: SidecarOcr;
}

/**
 * How a child process ended, in words, or null when it ended normally.
 *
 * The exit status was **not read at all** until Block 10 session 32:
 * `child.on('close', () => …)` took no arguments, so a process that died by
 * signal was indistinguishable from one that returned 0. That was invisible
 * rather than harmless — 29 Python crash reports had accumulated on the user's
 * machine since 25 August and nothing in this project had ever mentioned one.
 */
function abnormalExit(code: number | null, signal: NodeJS.Signals | null): string | null {
  if (signal !== null) return `it was killed by ${signal}`;
  if (code !== null && code !== 0) return `it exited ${String(code)}`;
  return null;
}

/**
 * Reports a sidecar that did its work and then died on the way out.
 *
 * Replaceable so a test can watch it without reading the service's log.
 */
export let reportAbnormalExit: (message: string) => void = (message) => {
  console.error(message);
};

export function setAbnormalExitReporter(report: (message: string) => void): void {
  reportAbnormalExit = report;
}

export function runSidecar<T>(request: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const child = spawn(SIDECAR_PYTHON, ['-m', 'framopia_cv.cli'], { cwd: sidecarCwd() });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => (out += String(chunk)));
    child.stderr.on('data', (chunk) => (err += String(chunk)));
    child.on('error', (error) =>
      reject(new SidecarError(`could not start the sidecar: ${error.message}. ` +
        'Run tools/cv/setup.sh.', err)));
    child.on('close', (code, signal) => {
      const died = abnormalExit(code, signal);
      const task = String(request['task'] ?? 'unknown');
      let parsed: unknown;
      try {
        parsed = JSON.parse(out);
      } catch {
        /*
         * Without the exit status this said only "stdout was not JSON", which
         * for a process that aborted names the symptom and not the cause. The
         * empty-output case is the common one and it is what a crash mid-work
         * looks like.
         */
        reject(
          new SidecarError(
            died === null
              ? `the picture tools answered nothing readable for ${task}: ${out.slice(0, 200)}`
              : `the picture tools stopped during ${task} — ${died}, and wrote ` +
                `${out.length === 0 ? 'nothing' : 'only part of an answer'}`,
            err,
          ),
        );
        return;
      }
      const record = parsed as { ok?: boolean; error?: string };
      if (record.ok !== true) {
        reject(new SidecarError(`sidecar failed: ${record.error ?? 'no reason given'}`, err));
        return;
      }
      /*
       * **A complete answer and an abnormal exit at the same time is the shape
       * this project actually has.** onnxruntime's bundled telemetry aborts
       * during static destruction — the main thread is inside `exit()` while a
       * worker thread throws a `system_error` from a mutex that is already
       * gone — so the work is finished and the JSON is flushed before the
       * process dies. Failing on the exit status alone would have broken the
       * image stage, which is why the answer decides and the death is reported
       * rather than raised.
       */
      if (died !== null) {
        reportAbnormalExit(
          `sidecar: ${task} finished and answered, then the process died — ${died}. ` +
            'The result was used; see ~/Library/Logs/DiagnosticReports for the crash.',
        );
      }
      resolve(parsed as T);
    });
    child.stdin.end(JSON.stringify(request));
  });
}

export function removeBackground(options: {
  imagePath: string;
  outPath: string;
  alphaMatting?: boolean;
  ocr?: boolean;
  /** The slot's idea; without it the OCR pass reports text but no verdict. */
  idea?: string;
  modeVocabulary?: string[];
}): Promise<RemoveBgResult> {
  return runSidecar<RemoveBgResult>({
    task: 'remove_bg',
    imagePath: options.imagePath,
    outPath: options.outPath,
    alphaMatting: options.alphaMatting ?? false,
    ocr: options.ocr ?? true,
    idea: options.idea,
    modeVocabulary: options.modeVocabulary ?? [],
  });
}

export interface SidecarEdgeLuminance {
  imagePath: string;
  width: number;
  height: number;
  bandPx: number;
  meanLuminance: number;
  p90Luminance: number;
  /** How much of the picture is transparent — a cut-out is mostly nothing. */
  transparentFraction: number;
  subjectPixels: number;
  /** The lit part of the subject; null when the picture has no subject. */
  subjectLitLuminance: number | null;
  subjectMedianLuminance: number | null;
}

/**
 * The mean relative luminance of an image's outermost ring.
 *
 * What the card frame's colour is derived from — see `cardFrameColour` in
 * `@framopia/core` and `frameReferenceLuminance` beside it.
 *
 * Measured on the file the builder will actually place, and both figures are
 * reported because which one matters depends on how the slot renders: a whole
 * picture meets the frame at its own outer ring, while a cut-out has no ring —
 * its surround is transparent and shows the frame itself, so what has to be
 * told apart from the frame is the subject.
 */
export function edgeLuminance(imagePath: string): Promise<SidecarEdgeLuminance> {
  return runSidecar<SidecarEdgeLuminance>({ task: 'edge_luminance', imagePath });
}

export interface SidecarFlattenedCutout {
  cutoutPath: string;
  outPath: string;
  width: number;
  height: number;
  fillRgb: [number, number, number];
  /** How much of the result is the ground rather than the subject. */
  groundFraction: number;
}

/**
 * Composite a cut-out over a solid colour so it has a ground of its own.
 *
 * Without one the card behind it shows through the whole square and the border
 * cannot be seen — the frame and the fill are the same layer. See `cardColours`
 * in `@framopia/core` for which colour and why.
 */
export function flattenCutout(options: {
  cutoutPath: string;
  fillRgb: [number, number, number];
  outPath: string;
}): Promise<SidecarFlattenedCutout> {
  return runSidecar<SidecarFlattenedCutout>({ task: 'flatten_cutout', ...options });
}
