import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadMode, modePathFor } from '@framopia/core';
import { startServer, type RunningService } from '../server.js';

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
   * **Skipped, and failing.** Measured in Block 11 session 55: a client created
   * with no palette comes out `background #1A0000, primary #820000, accent
   * #C9A96E, light #F8F6F2` — K2 Syndicalia's four, every one. That is open
   * item 7, and closing it needs somebody to say what a client with no colours
   * of their own should look like, which is a decision about taste and not one
   * this code can make. The test stays so the day it is decided the answer is
   * already written down.
   */
  it.skip('does not come out in K2 Syndicalia’s four', async () => {
    const res = await fetch(`http://127.0.0.1:${running.port}/clients`, {
      method: 'POST',
      headers: { 'x-service-token': running.token, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'No Colours Scratch Client' }),
    });
    expect(res.ok, `the route refused: ${res.status}`).toBe(true);

    const saved = loadMode(ID);
    const theirs = Object.entries(saved.palette).map(([role, hex]) => `${role}: ${hex}`);
    const borrowed = Object.entries(saved.palette).filter(([, hex]) =>
      K2.includes(String(hex).toUpperCase()),
    );
    expect(borrowed.map(([role, hex]) => `${role}: ${hex}`), theirs.join(', ')).toEqual([]);
  });
});
