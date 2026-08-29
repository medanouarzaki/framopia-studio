import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { clearHandshake, inspectLock, readHandshake, writeHandshake } from './lock.js';

const dirs: string[] = [];
function tempFile(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-lock-'));
  dirs.push(dir);
  return path.join(dir, 'service.json');
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const handshake = { port: 51234, token: 'abc123', pid: 4242, startedAt: '2026-08-27T00:00:00.000Z' };

describe('the handshake file', () => {
  it('round-trips port, token and pid', () => {
    const file = tempFile();
    writeHandshake(handshake, file);
    expect(readHandshake(file)).toEqual(handshake);
  });

  it('creates its directory rather than failing on a missing .local', () => {
    const file = path.join(tempFile(), 'nested', 'service.json');
    writeHandshake(handshake, file);
    expect(readHandshake(file)?.port).toBe(51234);
  });

  it('reads a truncated file as absent rather than throwing', () => {
    const file = tempFile();
    writeFileSync(file, '{ "port": 51234, "tok');
    expect(readHandshake(file)).toBeNull();
  });

  it('reads a file missing a required field as absent', () => {
    const file = tempFile();
    writeFileSync(file, JSON.stringify({ port: 1, token: 'x' }));
    expect(readHandshake(file)).toBeNull();
  });

  it('is gone after clearing', () => {
    const file = tempFile();
    writeHandshake(handshake, file);
    clearHandshake(file);
    expect(readHandshake(file)).toBeNull();
  });

  it('writes valid JSON with a trailing newline', () => {
    const file = tempFile();
    writeHandshake(handshake, file);
    const raw = readFileSync(file, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(JSON.parse(raw)).toEqual(handshake);
  });
});

describe('inspectLock', () => {
  it('is free when there is no lock file', () => {
    expect(inspectLock(tempFile())).toEqual({ state: 'free', reason: 'no lock file' });
  });

  it('is held when the lock names a live process', () => {
    const file = tempFile();
    writeHandshake(handshake, file);
    const lock = inspectLock(file, () => true);
    expect(lock.state).toBe('held');
    expect(lock.state === 'held' && lock.handshake.port).toBe(51234);
  });

  /*
   * A service killed with the machine leaves its file behind. Obeying that
   * lock would leave every future panel waiting on a service nobody runs.
   */
  it('reclaims a lock whose pid is gone rather than obeying it', () => {
    const file = tempFile();
    writeHandshake(handshake, file);
    expect(inspectLock(file, () => false)).toEqual({
      state: 'free',
      reason: 'lock names a dead process',
    });
  });

  it('names why it is free, so a caller can say which case it hit', () => {
    const file = tempFile();
    expect(inspectLock(file, () => false).state === 'free' && inspectLock(file, () => false)).toMatchObject(
      { reason: 'no lock file' },
    );
    writeHandshake(handshake, file);
    expect(inspectLock(file, () => false)).toMatchObject({ reason: 'lock names a dead process' });
  });
});

/*
 * Observed while verifying this session's remedy: `npm run service -- --force`
 * takes the lock but leaves the old process running, and stopping that old
 * process deleted the handshake belonging to the service that took over. A
 * healthy service was then running with nothing on disk pointing at it, and the
 * panel's next load would spawn a third.
 */
describe('clearHandshake', () => {
  it('leaves a handshake that names another process alone', () => {
    const file = tempFile();
    writeFileSync(
      file,
      JSON.stringify({ port: 1, token: 't', pid: process.pid + 1, startedAt: 'now' }),
      'utf8',
    );

    clearHandshake(file, process.pid);

    expect(existsSync(file)).toBe(true);
  });

  it('removes its own', () => {
    const file = tempFile();
    writeFileSync(
      file,
      JSON.stringify({ port: 1, token: 't', pid: process.pid, startedAt: 'now' }),
      'utf8',
    );

    clearHandshake(file, process.pid);

    expect(existsSync(file)).toBe(false);
  });
});
