/**
 * The service's wire shapes, declared once. The panel never invents a field:
 * anything it shows has to arrive from the service or from ExtendScript, per
 * ARCHITECTURE §1.1 — the panel is a view, never the place a decision lives.
 */
export interface ToolState {
  present: boolean;
  detail: string;
}

export interface HealthPayload {
  ok: boolean;
  serviceVersion: string;
  appVersion: string;
  promptVersion: number;
  ffmpeg: ToolState;
  ffprobe: ToolState;
  sidecar: { venv: ToolState; pythonPath: string };
  templates: { valid: boolean; issues: string[]; count: number };
}

/** ARCHITECTURE §8. Shown verbatim; the panel never paraphrases a cause. */
export interface ServiceError {
  error: string;
  stage: string;
  cause: string;
  retryable: boolean;
}

export interface Reel {
  label: string;
  videoPath: string;
  planPath: string | null;
  durationS: number | null;
  /** Cumulative spend from the plan's `costs.spentUsd`, or null when no plan exists yet. */
  spentUsd: number | null;
}

export interface ClientMode {
  id: string;
  name: string;
  version: number;
  fontsResolved: boolean;
}

export type ServiceState =
  | { kind: 'starting' }
  | { kind: 'healthy'; health: HealthPayload }
  | { kind: 'unreachable'; error: ServiceError };
