import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './paths.js';

/**
 * Never import a project into itself.
 *
 * Block 9 session 10 imported `templates/library.aep` while that same file was
 * the open project. After Effects does it without complaint: the result was a
 * project holding two of every comp, dirty, and both the audit and the build
 * then refused it — which cost a session. The file on disk was never in danger.
 *
 * Pinned by reading the sources, the way `audit-safety.test.ts` pins the
 * unsaved-work refusal: none of this can be exercised outside After Effects.
 */
const GUARD = readFileSync(path.join(REPO_ROOT, 'panel', 'jsx', 'library-guard.jsx'), 'utf8');

const OPENERS: { file: string; opens: string }[] = [
  { file: 'panel/jsx/build-reel.jsx', opens: 'app.project.importFile(new ImportOptions(aepFile));' },
  { file: 'panel/jsx/build.jsx', opens: 'app.project.importFile(new ImportOptions(aepFile));' },
  { file: 'panel/jsx/measure-survey.jsx', opens: 'app.project.importFile(new ImportOptions(aepFile));' },
  { file: 'tools/validate-templates/audit.jsx', opens: 'app.open(new File(aepPath));' },
];

describe('the self-import guard', () => {
  it('compares the absolute path After Effects itself reports', () => {
    // `fsName` rather than `name` or a string: a relative path or a symlink
    // would otherwise slip past a comparison that looked equal-ish.
    expect(GUARD).toContain('open.fsName !== incoming.fsName');
  });

  it('says which file, and what importing it would do', () => {
    expect(GUARD).toContain('refusing to import');
    expect(GUARD).toContain('duplicate every comp');
    expect(GUARD).toContain('Close it first');
  });

  it('lets a project with no file through rather than throwing on it', () => {
    // A never-saved project cannot be the file being imported, and treating it
    // as suspicious would refuse every build into a fresh project.
    expect(GUARD).toContain('if (open === null) return;');
  });

  for (const { file, opens } of OPENERS) {
    it(`${file} calls the guard before it opens anything`, () => {
      const source = readFileSync(path.join(REPO_ROOT, file), 'utf8');
      const guarded = source.indexOf('framopiaRefuseSelfImport(');
      const opened = source.indexOf(opens);

      expect(guarded, `${file} does not call the guard`).toBeGreaterThan(-1);
      expect(opened, `${file} no longer contains ${opens}`).toBeGreaterThan(-1);
      expect(guarded, `${file} opens before it checks`).toBeLessThan(opened);
    });
  }

  /*
   * The guard is only in force where it is evaluated. Both drivers load it
   * alongside the script they run, and a driver that stopped would leave the
   * function undefined and the script throwing on a name it cannot resolve.
   */
  it('is loaded by both of the things that drive ExtendScript', () => {
    const drive = readFileSync(path.join(REPO_ROOT, 'service', 'src', 'build', 'drive.ts'), 'utf8');
    const cli = readFileSync(
      path.join(REPO_ROOT, 'tools', 'validate-templates', 'cli.ts'),
      'utf8',
    );

    expect(drive).toContain("'library-guard.jsx'");
    expect(cli).toContain("'library-guard.jsx'");
  });
});
