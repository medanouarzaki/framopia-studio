import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ServiceAlreadyRunningError, ServiceWithNoHandshakeError, startServer } from './server.js';
import { otherFramopiaServices, takeTheOnlyPlace, whoHoldsTheOnlyPlace } from './lock.js';

/**
 * **One service, or a clear refusal.**
 *
 * Block 12 session 78 found a service that had been listening since 2026-09-03
 * — six days, from a commit two days older than the route the panel was calling
 * — with the handshake naming a different process entirely. `inspectLock` reads
 * a file, and a file can be stale, can name a recycled pid, and can be deleted
 * while a service is live. None of those free a bound port.
 *
 * Every port here is its own, so these can run beside a developer's real
 * service and beside each other.
 */
const running: { close(): void }[] = [];
const places: { release(): void }[] = [];
let scratch: string | null = null;

function lockFile(): string {
  scratch ??= mkdtempSync(path.join(tmpdir(), 'framopia-one-'));
  return path.join(scratch, `${running.length}-${Math.random().toString(36).slice(2)}.json`);
}

afterEach(() => {
  for (const s of running.splice(0)) s.close();
  for (const p of places.splice(0)) p.release();
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

/** A port nothing else in this suite uses, so the cases cannot collide. */
let next = 45900;
const aPort = (): number => (next += 1);

describe('a second service beside a live one', () => {
  it('is refused, and names the one already running', async () => {
    const port = aPort();
    const file = lockFile();
    const first = await startServer({ lockFile: file, onlyPlacePort: port });
    running.push(first.server);
    await expect(startServer({ lockFile: file, onlyPlacePort: port })).rejects.toThrow(
      ServiceAlreadyRunningError,
    );
  });

  /*
   * `--force` was meant to take a lock from a service that had gone. Taking the
   * place from one that is answering is what left two of them running.
   */
  it('is refused even with force, because the place is held', async () => {
    const port = aPort();
    const file = lockFile();
    const first = await startServer({ lockFile: file, onlyPlacePort: port });
    running.push(first.server);
    await expect(
      startServer({ lockFile: file, force: true, onlyPlacePort: port }),
    ).rejects.toThrow(ServiceAlreadyRunningError);
  });

  /* The case no file-based lock can cover, and the one that made the orphan. */
  it('is refused when the handshake has been deleted under it, and says it cannot name it', async () => {
    const port = aPort();
    const file = lockFile();
    const first = await startServer({ lockFile: file, onlyPlacePort: port });
    running.push(first.server);
    rmSync(file, { force: true });
    await expect(startServer({ lockFile: file, onlyPlacePort: port })).rejects.toThrow(
      ServiceWithNoHandshakeError,
    );
  });
});

describe('a leftover handshake', () => {
  it('does not block a legitimate start when it names a dead process', async () => {
    const port = aPort();
    const file = lockFile();
    writeFileSync(file, JSON.stringify({ port: 1, token: 'old', pid: 999999, startedAt: '' }));
    const started = await startServer({ lockFile: file, onlyPlacePort: port });
    running.push(started.server);
    expect(started.port).toBeGreaterThan(0);
  });

  it('does not block a start when there is no file at all', async () => {
    const started = await startServer({ lockFile: lockFile(), onlyPlacePort: aPort() });
    running.push(started.server);
    expect(started.port).toBeGreaterThan(0);
  });
});

/**
 * **The guard must never make a service unreachable.**
 *
 * A service whose handshake is gone still holds the place. Without a way to
 * name it, the panel could neither reach it nor start a replacement — worse
 * than the two services this guards against. The panel already stops a service
 * by pid; this is where it gets the pid.
 */
describe('who is standing in the only place', () => {
  it('names the live service, even with no handshake on disk', async () => {
    const port = aPort();
    const file = lockFile();
    const started = await startServer({ lockFile: file, onlyPlacePort: port });
    running.push(started.server);
    rmSync(file, { force: true });
    expect(await whoHoldsTheOnlyPlace(port)).toEqual({ pid: process.pid, port: started.port });
  });

  it('answers null when nobody is standing there', async () => {
    expect(await whoHoldsTheOnlyPlace(aPort())).toBeNull();
  });

  /* A port a stranger holds is not a Framopia service, and must not be named. */
  it('answers null when the port is held by something that says nothing', async () => {
    const port = aPort();
    const place = await takeTheOnlyPlace(port);
    if (place.taken !== null) places.push(place.taken);
    expect(await whoHoldsTheOnlyPlace(port)).toBeNull();
  });
});

/**
 * **Noticing one that is already there.**
 *
 * The guard stops a second service starting from session 79 onwards. It says
 * nothing about the ones already running, which is exactly what the orphan was
 * — six days old, from a commit that had never heard of the guard. So the
 * process table is asked, not the port.
 */
describe('every other Framopia service', () => {
  it('never counts this process as another one', async () => {
    const others = await otherFramopiaServices();
    expect(others.map((o) => o.pid)).not.toContain(process.pid);
  });

  it('excludes whichever pid it is told is itself', async () => {
    const all = await otherFramopiaServices(0);
    const first = all[0];
    if (first === undefined) return;
    const withoutFirst = await otherFramopiaServices(first.pid);
    expect(withoutFirst.map((o) => o.pid)).not.toContain(first.pid);
  });
});
