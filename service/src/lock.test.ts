import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearHandshake,
  inspectLock,
  processAlive,
  readHandshake,
  writeHandshake,
} from './lock.js';

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

describe('processAlive', () => {
  it('is true for this process', () => {
    expect(processAlive(process.pid)).toBe(true);
  });

  it('is false for a pid nothing owns', () => {
    const kill = ((): never => {
      const err = new Error('no such process') as NodeJS.ErrnoException;
      err.code = 'ESRCH';
      throw err;
    }) as unknown as NodeJS.Process['kill'];
    expect(processAlive(999999, kill)).toBe(false);
  });

  /*
   * EPERM means the process exists and belongs to someone else. Reading that
   * as dead would let a second service take over a live one's lock.
   */
  it('is true for a pid owned by another user', () => {
    const kill = ((): never => {
      const err = new Error('operation not permitted') as NodeJS.ErrnoException;
      err.code = 'EPERM';
      throw err;
    }) as unknown as NodeJS.Process['kill'];
    expect(processAlive(1, kill)).toBe(true);
  });

  it('rejects a nonsense pid without signalling anything', () => {
    expect(processAlive(0)).toBe(false);
    expect(processAlive(-1)).toBe(false);
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
