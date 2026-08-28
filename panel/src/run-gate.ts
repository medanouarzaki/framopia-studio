import type { ClientMode, Reel, ServiceState } from './types.js';

/**
 * Why Run is disabled, in the words the panel shows.
 *
 * Pure, and separate from the component, because "the button is off and the
 * user cannot tell why" is the failure this exists to prevent — so the reason
 * is a value that can be asserted rather than a string built inside a render.
 * The first unmet condition wins; listing all of them at once reads as a wall
 * of complaints when the real answer is "pick a video".
 */
export interface RunGate {
  enabled: boolean;
  reason: string | null;
}

export function runGate(options: {
  service: ServiceState;
  reel: Reel | null;
  mode: ClientMode | null;
  /** A run already in flight for this panel. */
  running?: boolean;
}): RunGate {
  const { service, reel, mode, running = false } = options;

  if (service.kind === 'starting') {
    return { enabled: false, reason: 'Waiting for the companion service to answer.' };
  }
  if (service.kind === 'unreachable') {
    return { enabled: false, reason: 'The companion service is not reachable.' };
  }
  if (!service.health.ok) {
    const missing: string[] = [];
    if (!service.health.ffmpeg.present) missing.push('ffmpeg');
    if (!service.health.ffprobe.present) missing.push('ffprobe');
    if (!service.health.sidecar.venv.present) missing.push('the Python sidecar');
    if (!service.health.templates.valid) missing.push('a valid template manifest');
    return {
      enabled: false,
      reason: `This machine is missing ${formatList(missing)}.`,
    };
  }
  if (reel === null) return { enabled: false, reason: 'Pick a video.' };
  if (mode === null) return { enabled: false, reason: 'Pick a client mode.' };
  if (!reel.present) {
    return {
      enabled: false,
      reason: `${reel.label} is in the catalogue but the file is not on this machine.`,
    };
  }
  if (running) {
    return { enabled: false, reason: 'A run is already going. It continues if you leave this step.' };
  }

  /*
   * Fonts are deliberately **not** checked here. They decide how the comp is
   * built, not whether speech can be transcribed, analysed or imaged, and
   * PROJECT_SPEC §5 reserves a client's own fonts for Block 9 — which comes
   * after this block, so gating Run on them made Block 8's definition of done
   * unreachable. The warning lives at Build, where it is true.
   */

  /*
   * Enabled. Every remaining way to be disabled says so in the line beneath the
   * button, which is what "The pipeline runner is not built yet" was for until
   * the runner existed.
   */
  return { enabled: true, reason: null };
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? 'nothing';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] as string}`;
}
