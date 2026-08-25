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

export interface SidecarOcr {
  hasText: boolean;
  detections: OcrDetection[];
}

export interface RemoveBgResult {
  ok: true;
  task: 'remove_bg';
  imagePath: string;
  cutoutPath: string;
  model: string;
  alphaMatting: boolean;
  width: number;
  height: number;
  metrics: CutoutMetricsJson;
  gate: SidecarGate;
  ocr?: SidecarOcr;
}

export function runSidecar<T>(request: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const child = spawn(SIDECAR_PYTHON, ['-m', 'framopia_cv.cli'], { cwd: SIDECAR_DIR });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => (out += String(chunk)));
    child.stderr.on('data', (chunk) => (err += String(chunk)));
    child.on('error', (error) =>
      reject(new SidecarError(`could not start the sidecar: ${error.message}. ` +
        'Run tools/cv/setup.sh.', err)));
    child.on('close', () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(out);
      } catch {
        reject(new SidecarError(`sidecar stdout was not JSON: ${out.slice(0, 200)}`, err));
        return;
      }
      const record = parsed as { ok?: boolean; error?: string };
      if (record.ok !== true) {
        reject(new SidecarError(`sidecar failed: ${record.error ?? 'no reason given'}`, err));
        return;
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
}): Promise<RemoveBgResult> {
  return runSidecar<RemoveBgResult>({
    task: 'remove_bg',
    imagePath: options.imagePath,
    outPath: options.outPath,
    alphaMatting: options.alphaMatting ?? false,
    ocr: options.ocr ?? true,
  });
}
