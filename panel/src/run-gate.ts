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
}): RunGate {
  const { service, reel, mode } = options;

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
  if (!mode.fontsResolved) {
    return {
      enabled: false,
      reason: `${mode.name} has no fonts yet; PROJECT_SPEC §5 reserves them for the client.`,
    };
  }

  /*
   * The pipeline itself is Block 8's next session. Saying so is better than a
   * button that looks ready and does nothing — and better than hiding it,
   * which would leave no place for the reason to appear.
   */
  return { enabled: false, reason: 'The pipeline runner is not built yet.' };
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? 'nothing';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] as string}`;
}
