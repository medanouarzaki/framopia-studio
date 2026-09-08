import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';

/**
 * **One place writes a client file, so one place can refuse.**
 *
 * Mohamed ruled on 2026-09-08 that a client cannot be saved without their own
 * four colours. A rule enforced in two writers is a rule a third writer can be
 * added without — and `createClient` was exactly that second writer until this
 * session, calling `writeFileSync` itself and repeating the validation rather
 * than going through `writeMode`.
 */
const SOURCE = readFileSync(
  path.join(REPO_ROOT, 'service', 'src', 'clients', 'create.ts'),
  'utf8',
);
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('writing a client file', () => {
  it('happens in exactly one function', () => {
    const writes = CODE.split('\n').filter((l) => /writeFileSync\(modePath/.test(l));
    expect(writes).toHaveLength(1);
  });

  it('always passes through the colours check first', () => {
    // The one writer, and what it does before it writes.
    const at = CODE.indexOf('function writeMode(');
    expect(at).toBeGreaterThan(-1);
    const body = CODE.slice(at, CODE.indexOf('\n}', at));
    expect(body).toContain('ownColoursOrRefuse');
    expect(body.indexOf('ownColoursOrRefuse')).toBeLessThan(body.indexOf('writeFileSync'));
  });

  /*
   * The old inheritance, gone. `palette: base.palette` copied the template
   * client's four onto every new one, and the template client is K2.
   */
  it('never copies the template client’s palette', () => {
    expect(CODE).not.toContain('palette: base.palette');
    expect(CODE).toContain('ownColours(name, input.palette)');
  });
});
