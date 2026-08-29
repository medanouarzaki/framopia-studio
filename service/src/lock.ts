import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LOCAL_DIR, processAlive } from '@framopia/core';

/**
 * The handshake file the panel reads: ARCHITECTURE §1.3's "random free port
 * written to a well-known file, simple shared token in the same file".
 *
 * It doubles as the lock that stops two panels starting two services. The pid
 * is what makes that safe to reclaim: a service killed with the machine leaves
 * its file behind, and a lock naming a process that no longer exists is a
 * leftover, not a claim. Obeying it would leave the panel waiting forever on a
 * service nobody is running.
 */
/*
 * `FRAMOPIA_SERVICE_JSON` lets a spawned service publish somewhere else, so a
 * test can drive the real entry point without taking the lock a developer's
 * own service is holding. Nothing in production sets it.
 */
export const SERVICE_JSON_PATH =
  process.env['FRAMOPIA_SERVICE_JSON'] ?? path.join(LOCAL_DIR, 'service.json');

export interface ServiceHandshake {
  port: number;
  token: string;
  pid: number;
  startedAt: string;
}

export function writeHandshake(handshake: ServiceHandshake, file = SERVICE_JSON_PATH): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(handshake, null, 2)}\n`, 'utf8');
}

export function readHandshake(file = SERVICE_JSON_PATH): ServiceHandshake | null {
  if (!existsSync(file)) return null;
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<ServiceHandshake>;
    if (
      typeof raw.port !== 'number' ||
      typeof raw.token !== 'string' ||
      typeof raw.pid !== 'number'
    ) {
      return null;
    }
    return {
      port: raw.port,
      token: raw.token,
      pid: raw.pid,
      startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : '',
    };
  } catch {
    // A truncated write is a stale lock, not a crash: treat it as absent.
    return null;
  }
}

export { processAlive };

export type LockState =
  | { state: 'free'; reason: 'no lock file' | 'lock names a dead process' }
  | { state: 'held'; handshake: ServiceHandshake };

/**
 * Whether a service is already running, and if not, why the lock did not stop
 * us. Callers report the reason rather than silently overwriting: a reclaimed
 * lock is worth a line of output, because the alternative explanation for a
 * missing service is that it crashed a moment ago.
 */
export function inspectLock(
  file = SERVICE_JSON_PATH,
  alive: (pid: number) => boolean = (pid) => processAlive(pid),
): LockState {
  const handshake = readHandshake(file);
  if (handshake === null) return { state: 'free', reason: 'no lock file' };
  if (!alive(handshake.pid)) return { state: 'free', reason: 'lock names a dead process' };
  return { state: 'held', handshake };
}

/**
 * Removes the handshake, but only when it still names this process.
 *
 * A service that lost the lock to `--force` is still running and still has a
 * SIGTERM handler. Stopping it used to delete the handshake belonging to the
 * service that took over, which left a healthy service running with nothing on
 * disk pointing at it — the panel then finds no handshake and spawns a third.
 * Observed while verifying the remedy this session ships.
 *
 * `pid` is optional so a caller with no opinion still gets the old behaviour,
 * which is what a test that writes its own file wants.
 */
export function clearHandshake(file = SERVICE_JSON_PATH, pid?: number): void {
  if (pid !== undefined) {
    const handshake = readHandshake(file);
    if (handshake !== null && handshake.pid !== pid) return;
  }
  rmSync(file, { force: true });
}
