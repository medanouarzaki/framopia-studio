import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './paths.js';

/**
 * The build has to say where it put the file.
 *
 * Nothing in this system renders, so a saved project is how a reel leaves it:
 * the `.aep` is the deliverable and the panel naming it is the last step of the
 * job. Until Block 9 session 14 the builder saved to `o.savePath` and left it
 * out of its result, so the service read `null`, and the panel's "Saved to …"
 * sentence had been silently empty for as long as it had existed.
 *
 * Asserted against the source, as the audit's refusals are: the behaviour lives
 * inside After Effects and no test here can run it.
 */
const BUILD = readFileSync(path.join(REPO_ROOT, 'panel', 'jsx', 'build-reel.jsx'), 'utf8');

describe('the reel builder', () => {
  it('reports the path it saved to', () => {
    expect(BUILD).toContain('savePath: savedTo');
  });

  /*
   * Read back from the project, never echoed from the option it was given.
   * Guidelines §3: whatever asserts a property is emitted by the thing that
   * verifies it, and `app.project.file` is the only thing that knows where
   * After Effects actually wrote.
   */
  it('reads the path back from the project rather than echoing the request', () => {
    const save = BUILD.indexOf('app.project.save(new File(o.savePath))');
    const readBack = BUILD.indexOf('app.project.file ? app.project.file.fsName');
    expect(save).toBeGreaterThan(-1);
    expect(readBack).toBeGreaterThan(save);
  });

  it('falls back to what it was asked for rather than reporting nothing', () => {
    expect(BUILD).toContain('app.project.file ? app.project.file.fsName : o.savePath');
  });
});
