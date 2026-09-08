import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadMode, modePathFor } from '@framopia/core';
import { startServer, type RunningService } from '../server.js';
import { buildClient } from './create.js';

/* Its own lock file, as `server.test.ts` does: sharing `.local/service.json`
   would clobber a service the developer is running. */
const tempDirs: string[] = [];
function lockFileFor(name: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-nocolours-'));
  tempDirs.push(dir);
  return path.join(dir, `${name}.json`);
}

afterAll(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * **A client saved without choosing any colours.**
 *
 * Open item 7: `createClient` copies the template client's palette, and the
 * template client is K2 Syndicalia — so a client whose colours nobody chose
 * came out in K2's four and nothing said so. This asks the real route the panel
 * asks, with no palette in the body, and looks at what reached the file.
 *
 * K2's four are `#1A0000`, `#820000`, `#C9A96E` and `#F8F6F2`; the last is the
 * crème every ordinary subtitle word is set in across the corpus and the first
 * is the ground its pictures are lit against. A second client inheriting them
 * is not a default — it is one client's brand on another client's video.
 */
describe('a client saved with no colours of their own', () => {
  const ID = 'no-colours-scratch-client';
  const K2 = ['#1A0000', '#820000', '#C9A96E', '#F8F6F2'];
  let running: RunningService;

  beforeEach(async () => {
    running = await startServer({ force: true, lockFile: lockFileFor('no-colours') });
  });

  afterEach(() => {
    running.server.close();
    rmSync(modePathFor(ID), { force: true });
  });

  /*
   * **Mohamed ruled on 2026-09-08: a client cannot be saved without their own
   * four colours.** Until then `buildClient` copied the template client's
   * palette, and the template client is K2 Syndicalia — so a client saved with
   * no colours came out in K2's four exactly. Block 11 session 55 measured it,
   * and this test was kept skipped and failing as the record of the open
   * question. The question is answered, so it runs.
   *
   * **His reason.** Every client needs four colours to build anything, and
   * silent inheritance means one client's brand appears on another's reel — a
   * mistake only the eye would ever catch, and only after it had been sent.
   */
  it('is refused, and nothing of K2 Syndicalia reaches it', async () => {
    const res = await fetch(`http://127.0.0.1:${running.port}/clients`, {
      method: 'POST',
      headers: { 'x-service-token': running.token, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'No Colours Scratch Client' }),
    });

    expect(res.ok, 'a client with no colours was saved').toBe(false);
    const body = (await res.json()) as { error?: string };
    expect(body.error ?? '').toContain('no colours of their own');
    expect(body.error ?? '').toContain('borrowed');

    /*
     * The other half, and it is not the same claim: the refusal could hold and
     * a file still be written. Nothing may reach the store at all.
     */
    expect(existsSync(modePathFor(ID)), 'a file was written for a refused client').toBe(false);
  });

  /*
   * **Separate from the refusal.** A client that somehow reaches the store
   * without colours must still not come out wearing K2's — the refusal is one
   * guard and this is the other, so removing either leaves the defect visible.
   */
  it('never lends K2 Syndicalia’s colours to anyone, whatever the route', () => {
    const k2 = loadMode('k2-syndicalia');
    const built = buildClient({
      name: 'Their Own Colours Scratch',
      palette: {
        background: '#0B0B0B',
        primary: '#123456',
        accent: '#654321',
        light: '#FAFAFA',
      },
    });
    const borrowed = Object.entries(built.palette).filter(([, hex]) =>
      K2.includes(String(hex).toUpperCase()),
    );
    expect(borrowed.map(([role, hex]) => `${role}: ${hex}`)).toEqual([]);
    // And the source of the old inheritance is gone: nothing reads K2's palette.
    expect(Object.values(built.palette)).not.toContain(k2.palette.background);
  });
});
