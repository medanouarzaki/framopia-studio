import type { HealthPayload } from './types.js';

/**
 * Whether the Node running the service is the one the panel resolved.
 *
 * The panel resolves a binary to spawn; the service reports the interpreter it
 * is actually running under. Those are the same thing only when the panel
 * started it — and right now the service is usually one the user started at a
 * terminal, where `PATH` is his shell's rather than After Effects'. If the two
 * diverge the same pipeline gives different results depending on how it was
 * launched, and nothing on screen would say so.
 *
 * A mismatch is a **warning, not a gate**: a service on a different Node is
 * still a working service, and refusing to use it would be worse than saying
 * so.
 */
export interface NodeMatch {
  matches: boolean;
  /** Null when they agree, or when there is nothing to compare yet. */
  warning: string | null;
}

export function nodeMatch(health: HealthPayload, resolved: { path: string } | null): NodeMatch {
  const running = health.node?.path ?? null;
  if (running === null || resolved === null) return { matches: true, warning: null };
  if (running === resolved.path) return { matches: true, warning: null };
  const version = health.node?.version;
  return {
    matches: false,
    warning:
      `The service is running on ${running}${version === undefined ? '' : ` (${version})`}, ` +
      `but this panel would start ${resolved.path}. They are different interpreters, so a ` +
      'service the panel starts may not behave like the one running now.',
  };
}
