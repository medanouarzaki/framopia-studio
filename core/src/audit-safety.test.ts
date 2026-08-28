import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './paths.js';

/**
 * The audit is a diagnostic, and a diagnostic must not mutate the host.
 *
 * It used to call `close(DO_NOT_SAVE_CHANGES)` on whatever the user had open,
 * destroying unsaved work. That cost Block 8 session 21 its second half: the
 * impact frame could not be measured, because measuring it would have thrown
 * his project away.
 *
 * Asserted against the source because the behaviour lives inside After Effects
 * and no test here can run it — what can be checked is that the unconditional
 * close is gone and the refusal is in front of it.
 */
const AUDIT = readFileSync(
  path.join(REPO_ROOT, 'tools', 'validate-templates', 'audit.jsx'),
  'utf8',
);
const CLI = readFileSync(path.join(REPO_ROOT, 'tools', 'validate-templates', 'cli.ts'), 'utf8');

describe('the template audit', () => {
  it('refuses before it opens anything', () => {
    const refusal = AUDIT.indexOf('refuseIfUnsafe(aepPath');
    const open = AUDIT.indexOf('app.open(new File(aepPath))');
    expect(refusal).toBeGreaterThan(-1);
    expect(open).toBeGreaterThan(refusal);
  });

  it('closes a project only after checking it is saved', () => {
    const closes = [...AUDIT.matchAll(/app\.project\.close\(/g)];
    expect(closes).toHaveLength(1);
    const guard = AUDIT.indexOf('if (isDirty)');
    expect(guard).toBeGreaterThan(-1);
    expect((closes[0] as RegExpMatchArray).index).toBeGreaterThan(guard);
  });

  it('treats an unreadable dirty flag as dirty', () => {
    expect(AUDIT).toContain('var isDirty = true;');
    expect(AUDIT).toContain('refusing costs a re-run, guessing costs the');
  });

  it('says what to do when it refuses', () => {
    expect(AUDIT).toContain('Save or close it yourself, then run the audit again');
  });

  it('leaves a project it did not open alone when that project is the library', () => {
    expect(AUDIT).toContain('alreadyTheLibrary');
  });

  /*
   * The second destructive path: writing the refusal into the audit file would
   * replace a working measurement with an error message.
   */
  it('never writes a refusal over the audit it was asked to refresh', () => {
    expect(CLI).toContain('raw.refused === true');
    expect(CLI).toContain('is unchanged.');
  });

  it('is ES3, like every other script the host evaluates', () => {
    const withoutComments = AUDIT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(withoutComments).not.toMatch(/\b(const|let)\s/);
    expect(withoutComments).not.toMatch(/=>/);
  });
});
