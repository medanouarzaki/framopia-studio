import type { HealthPayload, ServiceError } from './types.js';

/**
 * The panel's half of the ARCHITECTURE §1.3 handshake: the service binds
 * 127.0.0.1 on a random free port and writes the port and a shared token to a
 * well-known file, which the panel reads before it can talk to anything.
 *
 * Everything that touches the filesystem or spawns a process goes through the
 * injected `host`. Inside After Effects that is CEP's Node integration; in a
 * test it is a fake. The alternative — importing `node:fs` at the top of a
 * React module — makes the whole screen untestable outside CEP and hides how
 * much of the panel is really host-dependent.
 */
export interface PanelHost {
  readHandshake(): { port: number; token: string; pid: number } | null;
  spawnService(): void;
  processAlive(pid: number): boolean;
}

export const HEALTH_TIMEOUT_MS = 4000;

export function serviceErrorOf(stage: string, cause: string, retryable: boolean): ServiceError {
  return { error: cause, stage, cause, retryable };
}

async function getHealth(port: number, signal: AbortSignal): Promise<HealthPayload> {
  const res = await fetch(`http://127.0.0.1:${port}/health`, { signal });
  if (!res.ok) throw new Error(`health returned HTTP ${res.status}`);
  return (await res.json()) as HealthPayload;
}

/**
 * Reads the handshake, checks the service is really there, and starts one if
 * it is not.
 *
 * The pid is what makes starting safe: a handshake file left behind by a
 * service that died with the machine names a process that no longer exists, so
 * it is reclaimed rather than obeyed. Obeying it would leave the panel waiting
 * forever on a service nobody is running — and the opposite mistake, ignoring
 * a live lock, would start a second service on a second port with the first
 * still holding the file.
 */
export async function connect(host: PanelHost): Promise<
  { ok: true; health: HealthPayload; port: number; token: string } | { ok: false; error: ServiceError }
> {
  const handshake = host.readHandshake();

  if (handshake !== null && host.processAlive(handshake.pid)) {
    try {
      const health = await withTimeout((signal) => getHealth(handshake.port, signal));
      return { ok: true, health, port: handshake.port, token: handshake.token };
    } catch (error) {
      // The pid is alive but nothing answers: a service mid-start, or a pid
      // reused by something else. Either way spawning a second one would make
      // it worse, so this is reported rather than worked around.
      return {
        ok: false,
        error: serviceErrorOf(
          'service-connect',
          `a service is registered on port ${handshake.port} as pid ${handshake.pid} but did not answer: ${(error as Error).message}`,
          true,
        ),
      };
    }
  }

  try {
    host.spawnService();
  } catch (error) {
    return {
      ok: false,
      error: serviceErrorOf('service-spawn', (error as Error).message, true),
    };
  }

  return {
    ok: false,
    error: serviceErrorOf(
      'service-spawn',
      handshake === null
        ? 'no service was running; one has been started. Retry in a moment.'
        : `the registered service (pid ${handshake.pid}) is gone; a new one has been started. Retry in a moment.`,
      true,
    ),
  };
}

function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  return run(controller.signal).finally(() => clearTimeout(timer));
}
