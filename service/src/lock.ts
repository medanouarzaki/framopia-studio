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

/**
 * **The one place a Framopia service can stand.**
 *
 * `inspectLock` reads a file, and a file is data: it can be stale, it can name
 * a pid that has been recycled, and it can be deleted while a service is live.
 * Block 12 session 78 found a service that had been listening since
 * 2026-09-03 — six days, from a commit two days older than the route the panel
 * was calling — with the handshake naming a different process entirely. Nothing
 * had stopped it and nothing had noticed it, because nothing ever asked the
 * operating system who was actually running.
 *
 * A listening socket is the one claim on this machine that no file operation
 * can forge or free. The kernel refuses a second bind, and it releases the port
 * when the process dies however it dies — killed, crashed, or taken down with
 * the machine. That is why the guard is a port and not the handshake:
 *
 * - **the handshake is stale** — irrelevant; the bind decides.
 * - **it names a pid that no longer exists** — that process released the port
 *   when it died, so the bind succeeds and the start goes ahead.
 * - **it has been deleted** — the port is still held, so a second service is
 *   still refused. This is the case a file-based lock cannot cover at all, and
 *   it is the one that produced the orphan.
 *
 * The data port stays random, as ARCHITECTURE §1.3 says. This is a separate
 * socket that carries no traffic; it exists to be held.
 */
export const ONLY_PLACE_PORT = 45871;

export interface TheOnlyPlace {
  /** Releases the claim. The kernel does this too, on any exit. */
  release(): void;
  /** Starts answering `whoHoldsTheOnlyPlace`, once the data port is known. */
  announce(pid: number, port: number): void;
}

/**
 * Who is standing in the only place, asked of the kernel rather than of a file.
 *
 * **This is what stops the guard from making a service unreachable.** A service
 * whose handshake has been deleted still holds the port, and without this there
 * would be no way to name it: the panel could neither reach it nor start a
 * replacement, which is a worse failure than the two services this guards
 * against. The panel already knows how to stop a service by pid and start a
 * fresh one; this gives it the pid to stop.
 */
export async function whoHoldsTheOnlyPlace(
  port = ONLY_PLACE_PORT,
): Promise<{ pid: number; port: number } | null> {
  const { connect } = await import('node:net');
  return await new Promise((resolve) => {
    const socket = connect(port, '127.0.0.1');
    let said = '';
    const give = (value: { pid: number; port: number } | null): void => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(2000, () => give(null));
    socket.once('error', () => give(null));
    socket.on('data', (chunk) => (said += String(chunk)));
    socket.once('close', () => {
      try {
        const parsed = JSON.parse(said) as { pid?: number; port?: number };
        if (typeof parsed.pid !== 'number' || typeof parsed.port !== 'number') return resolve(null);
        return resolve({ pid: parsed.pid, port: parsed.port });
      } catch {
        return resolve(null);
      }
    });
  });
}

/**
 * Takes the only place, or reports who could not be displaced.
 *
 * `heldByUs` distinguishes the two ways a bind can fail. `EADDRINUSE` means
 * something is standing here, and on this port that is a Framopia service —
 * including one whose handshake has been deleted, which is the case no file
 * could catch. Any other error means the machine would not let us bind loopback
 * at all: **that is not a refusal**, because a panel that can never start a
 * service is worse than two services. It starts, and says it is unguarded.
 */
export async function takeTheOnlyPlace(
  port = ONLY_PLACE_PORT,
): Promise<{ taken: TheOnlyPlace } | { taken: null; heldByUs: boolean }> {
  const { createServer } = await import('node:net');
  return await new Promise((resolve) => {
    const socket = createServer();
    socket.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code !== 'EADDRINUSE') {
        // Not a claim at all — a machine that will not let us bind loopback.
        // Starting is still better than never starting.
        resolve({ taken: null, heldByUs: false });
        return;
      }
      resolve({ taken: null, heldByUs: true });
    });
    socket.once('listening', () => {
      socket.unref();
      resolve({
        taken: {
          release: (): void => {
            socket.close();
          },
          announce: (pid: number, dataPort: number): void => {
            socket.on('connection', (client) => {
              client.end(JSON.stringify({ pid, port: dataPort }));
            });
          },
        },
      });
    });
    socket.listen(port, '127.0.0.1');
  });
}

/**
 * Every Framopia service running on this machine other than this one.
 *
 * **The process table, not the port.** `whoHoldsTheOnlyPlace` finds a service
 * that took the guard, which is every service built from session 79 onwards —
 * and none of the ones already running. Session 78's orphan was six days old
 * and from a commit that had never heard of the guard; a check that only asked
 * the guard would have reported it as absent, which is the same silent green
 * this project keeps finding.
 *
 * `pgrep -f` against the entry point the panel spawns. A service started any
 * other way is still this file, so it is still found. Its own pid is excluded
 * by number rather than by parsing, and a machine without `pgrep` reports
 * nothing rather than guessing.
 */
export async function otherFramopiaServices(
  self = process.pid,
): Promise<{ pid: number; startedAt: string }[]> {
  const { execFile } = await import('node:child_process');
  const entry = path.join('service', 'dist', 'service.js');
  const pids = await new Promise<number[]>((resolve) => {
    execFile('/usr/bin/pgrep', ['-f', entry], (error, stdout) => {
      // pgrep exits 1 with no output when nothing matches: not a failure.
      if (error !== null && stdout === '') return resolve([]);
      resolve(
        stdout
          .split('\n')
          .map((line) => Number(line.trim()))
          .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== self),
      );
    });
  });
  if (pids.length === 0) return [];
  return await new Promise((resolve) => {
    execFile('/bin/ps', ['-o', 'pid=,lstart=', ...pids.map((p) => `-p${p}`)], (error, stdout) => {
      if (error !== null) return resolve(pids.map((pid) => ({ pid, startedAt: '' })));
      resolve(
        stdout
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line !== '')
          .map((line) => {
            const [, pid, started] = /^(\d+)\s+(.*)$/.exec(line) ?? [];
            return { pid: Number(pid), startedAt: (started ?? '').trim() };
          })
          .filter((row) => Number.isInteger(row.pid)),
      );
    });
  });
}
