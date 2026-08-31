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

/**
 * The build's own guard, narrowed to what it was built for.
 *
 * It stopped the user four times running, and every time the file it refused to
 * close was `.local/build/vitasilk-full.aep` — **the build's own previous
 * output**, open because the last build left it there. Refusing to touch that
 * protects nothing and costs a round trip every time.
 *
 * Asserted against the source, like the audit above: the behaviour lives inside
 * After Effects and no test here can run it.
 */
const BUILD_REEL = readFileSync(
  path.join(REPO_ROOT, 'panel', 'jsx', 'build-reel.jsx'),
  'utf8',
);

describe('the build’s unsaved-changes guard', () => {
  it('saves a project this tool wrote, rather than refusing over it', () => {
    expect(BUILD_REEL).toContain('var isOurs =');
    expect(BUILD_REEL).toContain('o.buildDir');
    // Saved, never discarded, and back to the file it came from: the guard's
    // save takes no argument. The build's own final save to `savePath` does
    // take one and is a different call.
    expect(BUILD_REEL).toContain('app.project.save();');
    const guardSave = BUILD_REEL.indexOf('app.project.save();');
    expect(guardSave).toBeGreaterThan(BUILD_REEL.indexOf('var isOurs ='));
    expect(guardSave).toBeLessThan(
      BUILD_REEL.indexOf('the open After Effects project has unsaved changes'),
    );
  });

  it('says which file it saved rather than doing it silently', () => {
    expect(BUILD_REEL).toContain('savedOwnOutput = openFile.fsName');
    expect(BUILD_REEL).toContain('savedOwnOutput: savedOwnOutput');
  });

  /*
   * The narrowing must not reach anything else. A project somewhere the tool
   * does not write, and one that was never written at all, keep the refusal.
   */
  it('still refuses any other project, and names it', () => {
    const ours = BUILD_REEL.indexOf('var isOurs =');
    const refusal = BUILD_REEL.indexOf('the open After Effects project has unsaved changes');
    expect(refusal).toBeGreaterThan(ours);
    expect(BUILD_REEL).toContain('Save or close it yourself, then run it again');
  });

  it('keeps refusing a project that was never written to disk and holds something', () => {
    // `isOurs` needs a file to compare, so a null file can never satisfy it.
    expect(BUILD_REEL).toContain('var isOurs = openFile !== null');
    expect(BUILD_REEL).toContain('and has never been saved');
  });

  /*
   * An empty untitled project holds no work, and it is the state After Effects
   * is left in by any script that adds a temporary comp and removes it again —
   * the modified flag is read-only and cannot be put back. Session 6's own
   * font measurement put the user's project there and then could not build.
   *
   * This is **not** the "unreadable dirty counts as dirty" case: `numItems` is
   * read, and the exemption needs it to be exactly zero **and** the project to
   * have no file. Either one missing keeps the refusal.
   */
  it('proceeds past an empty untitled project, and only an empty one', () => {
    expect(BUILD_REEL).toContain('itemCount = app.project.numItems');
    expect(BUILD_REEL).toContain('isDirty && openFile === null && itemCount === 0');
    // An unreadable count is -1, which the condition above cannot satisfy.
    expect(BUILD_REEL).toContain('itemCount = -1;');
  });

  it('never closes a project it did not write', () => {
    const closes = [...BUILD_REEL.matchAll(/app\.project\.close\(/g)];
    expect(closes).toHaveLength(1);
    const guard = BUILD_REEL.indexOf('if (isDirty) {');
    expect((closes[0] as RegExpMatchArray).index).toBeGreaterThan(guard);
  });

  /* The other two scripts are unchanged: they write nothing to `.local/build`. */
  it('leaves the other scripts’ guards alone', () => {
    for (const file of ['build.jsx', 'measure-survey.jsx']) {
      const source = readFileSync(path.join(REPO_ROOT, 'panel', 'jsx', file), 'utf8');
      expect(source, file).toContain('the open After Effects project has unsaved changes');
      expect(source, file).not.toContain('var isOurs');
    }
  });
});

/**
 * The shadow copy takes the client's deeper colour, and the build proves it took
 * rather than assuming the write landed.
 *
 * This is the pair of layers Block 9 session 8 found one build away from
 * carrying the template's placeholder word on every card of every reel, so a
 * property that reaches one and not the other is a defect this project has
 * already paid a session for.
 */
describe('the shadow’s colour', () => {
  const buildReel = readFileSync(path.join(REPO_ROOT, 'panel', 'jsx', 'build-reel.jsx'), 'utf8');
  const textFit = readFileSync(path.join(REPO_ROOT, 'panel', 'jsx', 'text-fit.jsx'), 'utf8');

  it('is set on the duplicated instance, from the style the service resolved', () => {
    expect(buildReel).toContain('shadowStyle.fillColor = e.textStyle.shadowFillColor');
  });

  it('is read back and compared, not assumed', () => {
    expect(buildReel).toContain('e.shadowApplied.fillColor');
    expect(buildReel).toContain('the shadow was set to');
    // A carried fill that is not applied draws nothing; both are checked.
    expect(buildReel).toContain('applyFill !== true');
  });

  it('is readable at all, which is what makes the comparison possible', () => {
    expect(textFit).toContain('out.fillColor');
    expect(textFit).toContain('doc.applyFill');
  });

  /**
   * Retired 2026-08-31: the build used to leave the shadow's colour alone
   * deliberately, and both the comment and the code said so.
   */
  it('no longer claims the shadow is never given a colour', () => {
    expect(buildReel).not.toContain('never the colour');
    const reelPlan = readFileSync(
      path.join(REPO_ROOT, 'service', 'src', 'build', 'reel-plan.ts'),
      'utf8',
    );
    expect(reelPlan).not.toContain('never given a colour');
  });
});
