import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { processAlive } from './process-alive.js';
import { REPO_ROOT } from './paths.js';

describe('processAlive', () => {
  it('is true for this process', () => {
    expect(processAlive(process.pid)).toBe(true);
  });

  it('is false for a pid nothing owns', () => {
    expect(
      processAlive(999999, () => {
        const err = new Error('no such process') as NodeJS.ErrnoException;
        err.code = 'ESRCH';
        throw err;
      }),
    ).toBe(false);
  });

  /*
   * EPERM means the process exists and belongs to someone else. Reading it as
   * dead would let a second service take over a live one's lock.
   */
  it('is true for a pid owned by another user', () => {
    expect(
      processAlive(1, () => {
        const err = new Error('operation not permitted') as NodeJS.ErrnoException;
        err.code = 'EPERM';
        throw err;
      }),
    ).toBe(true);
  });

  it('rejects a nonsense pid without signalling anything', () => {
    let called = false;
    const spy = (): void => {
      called = true;
    };
    expect(processAlive(0, spy)).toBe(false);
    expect(processAlive(-1, spy)).toBe(false);
    expect(processAlive(1.5, spy)).toBe(false);
    expect(called).toBe(false);
  });
});

/**
 * The rule this module exists to stop being broken again: it had two
 * implementations, in the service's lock and the panel's CEP host, with
 * nothing pinning them. CLAUDE_CODE_GUIDELINES §3 requires a rule shared by
 * more than one tool to be pinned by a test, and the pin only means anything
 * while both callers really do delegate.
 */
describe('the single home is the only home', () => {
  const callers = ['service/src/lock.ts', 'panel/src/host.ts'];

  it.each(callers)('%s imports processAlive rather than reimplementing it', (file) => {
    const source = readFileSync(path.join(REPO_ROOT, file), 'utf8');

    expect(source).toMatch(/import .*processAlive.* from '@framopia\/core/);
    // The tell-tale of a second copy: signalling a pid directly.
    expect(source).not.toMatch(/\.kill\s*\(\s*\w+\s*,\s*0\s*\)/);
  });
});
