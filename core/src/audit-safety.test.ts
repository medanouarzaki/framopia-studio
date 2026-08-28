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

/**
 * Every script the host evaluates had the audit's defect too, and nobody had
 * looked: each closed the open project with DO_NOT_SAVE_CHANGES before starting
 * its own. Nothing these produce is worth someone's unsaved work.
 */
describe('every script that opens its own project', () => {
  const SCRIPTS = ['build.jsx', 'build-reel.jsx', 'measure-survey.jsx'];
  const sourceOf = (name: string): string =>
    readFileSync(path.join(REPO_ROOT, 'panel', 'jsx', name), 'utf8');

  for (const name of SCRIPTS) {
    it(`${name} refuses a project with unsaved changes`, () => {
      const source = sourceOf(name);
      expect(source).toContain('This will not close it');
      const guard = source.indexOf('if (isDirty)');
      const close = source.indexOf('app.project.close(');
      expect(guard).toBeGreaterThan(-1);
      expect(close).toBeGreaterThan(guard);
    });

    it(`${name} closes at most one project, and treats an unreadable flag as dirty`, () => {
      const source = sourceOf(name);
      expect([...source.matchAll(/app\.project\.close\(/g)]).toHaveLength(1);
      expect(source).toContain('guessing costs the user');
    });

    it(`${name} is ES3, like every other script the host evaluates`, () => {
      const withoutComments = sourceOf(name)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(withoutComments).not.toMatch(/\b(const|let)\s/);
      expect(withoutComments).not.toMatch(/=>/);
    });
  }
});

/**
 * The easing the impact derivation needs. Session 23 stopped because the audit
 * recorded two endpoints and a duration, which cannot say when the value
 * arrives — linear puts kw_slam's word at 95% on frame 11.4 and the user's eye
 * puts it on frame 4.
 */
describe('the audit records easing', () => {
  it('asks After Effects for interpolation type and temporal ease', () => {
    expect(AUDIT).toContain('keyInTemporalEase');
    expect(AUDIT).toContain('keyOutTemporalEase');
    expect(AUDIT).toContain('keyInInterpolationType');
    expect(AUDIT).toContain('keyOutInterpolationType');
  });

  it('emits influence and speed per dimension', () => {
    expect(AUDIT).toContain('influence');
    expect(AUDIT).toContain('speed');
  });

  /* A property AE refuses emits null, never a zero that reads as "no easing". */
  it('emits null for an ease it cannot read', () => {
    expect(AUDIT).toContain('if (!ease || !ease.length) return null;');
  });
});
