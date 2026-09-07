import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { whichIsBehind, PANEL_IS_BEHIND, compareBuildStamps, repairFor } from '@framopia/core/build-stamp';

/**
 * **After a `git pull` it is the panel that is behind, not the service.**
 *
 * `compareBuildStamps` says only that the two disagree, and everything
 * downstream assumed the service was the stale half — true for a long time,
 * because `npm run check` rebuilt the panel and left `service/dist` alone.
 * A pull inverts it: the service gets compiled, the bundle does not.
 *
 * The panel then told the user the *service* was built from different code and
 * restarted it, which cannot change the stamp baked into the running bundle. So
 * the repair succeeded, the mismatch remained, and it ran again to the bound.
 * Block 11 session 65 lost a run to this; session 66 measured the loop.
 */
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The stamp the source would produce right now, from the real script rather
 * than from a constant — so this measures the thing the build actually stamps.
 * Spawned rather than imported: `scripts/build-stamp.mjs` ships no types, and
 * a `.mjs` import would make the panel's typecheck fail.
 */
function currentSourceStamp(): string {
  return execFileSync(
    'node',
    ['-e', "import('./scripts/build-stamp.mjs').then((m) => process.stdout.write(m.buildStamp()))"],
    { cwd: REPO, encoding: 'utf8' },
  ).trim();
}

describe('a panel bundle left behind by a pull', () => {
  it('is named as the stale half, not the service', () => {
    // A genuinely stale bundle: the stamp as it was, against the source as it is.
    const now = currentSourceStamp();
    const stale = 'a1b2c3d+0000000000000000000000000000000000000000000000000000000000000000';
    expect(stale).not.toBe(now);

    // The service is running exactly what is compiled, so it is not behind.
    expect(whichIsBehind(stale, now, now)).toBe('panel');
  });

  it('is not what the old rule concluded', () => {
    const now = currentSourceStamp();
    const stale = 'a1b2c3d+0000000000000000000000000000000000000000000000000000000000000000';
    // The old rule only knew they differed, and the repair it chose rebuilds
    // and restarts the service — which cannot change the panel's own stamp.
    expect(compareBuildStamps(stale, now).verdict).toBe('different');
    expect(repairFor(stale, now)).toBe('rebuild');
    // Which is why the panel must not run it in this case.
    expect(whichIsBehind(stale, now, now)).toBe('panel');
  });

  it('still blames the service when the service really is behind', () => {
    const now = currentSourceStamp();
    const oldService = 'a1b2c3d+0000000000000000000000000000000000000000000000000000000000000000';
    // Compiled code is current, the running process is not.
    expect(whichIsBehind(now, oldService, now)).toBe('service');
  });

  it('concludes nothing when the compiled service cannot be read', () => {
    const now = currentSourceStamp();
    const stale = 'a1b2c3d+0000000000000000000000000000000000000000000000000000000000000000';
    // Falls back to the long-standing answer rather than guessing "panel".
    expect(whichIsBehind(stale, now, null)).toBe('service');
  });

  /*
   * **The sentence names the one command, which is a ruling.** Session 66 said
   * only that something was wrong, because every complete sentence broke the
   * no-leaving-the-panel rule and the panel cannot repair this case itself.
   * Mohamed ruled on 2026-09-07 that this message, and no other, may name the
   * command that fixes it. This asserts the whole instruction is there — a
   * command with no reopening would leave the person exactly where session 66
   * left them, because building the bundle does not load it.
   */
  it('says what is wrong, then the one command, then how to load it', () => {
    expect(PANEL_IS_BEHIND).toContain('older code');
    expect(PANEL_IS_BEHIND).toContain('npm run panel:build');
    expect(PANEL_IS_BEHIND).toContain('close this panel and open it again');
    expect(PANEL_IS_BEHIND).toContain('Window → Extensions');

    // What is wrong comes before what to do about it.
    expect(PANEL_IS_BEHIND.indexOf('older code')).toBeLessThan(
      PANEL_IS_BEHIND.indexOf('npm run panel:build'),
    );
    // And it says nothing has been lost, because nothing has.
    expect(PANEL_IS_BEHIND).toContain('Nothing you have made is affected');
  });

  /*
   * The exemption is one sentence wide. Anything else the panel says is still
   * held to the rule, which `leave-the-panel.test.ts` proves; this pins the
   * other half — that the exempt sentence is the one the panel actually shows,
   * not a constant nothing reads.
   */
  it('is the sentence the panel puts on screen', () => {
    const app = readFileSync(path.join(REPO, 'panel', 'src', 'App.tsx'), 'utf8');
    expect(app).toContain('PANEL_IS_BEHIND');
    expect(app).not.toContain('showing older code');
  });

});
