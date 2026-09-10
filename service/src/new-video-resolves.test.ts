import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { findReelByLabel, listReels } from './catalogue.js';

/**
 * **A video the tool has never seen must resolve.**
 *
 * Block 12 session 84: Mohamed picked `September Content/Exports/Work in
 * Progress/sora-1` out of Dr Loubna Kfafi's folder and every stage answered
 * `no reel labelled "…" in benchmarks/footage.json` — a sentence about the
 * benchmark catalogue, said about his client's footage.
 *
 * Every stage resolved a label with `listReels().find(...)`, and `listReels`
 * knows the five corpus reels plus whatever has been opened through Browse. The
 * picker offers a client's whole folder. The two lists were never the same, and
 * every session since Block 11 went green because it proved its work against the
 * corpus and the two reels already built.
 *
 * **A client of this test's own**, so it asserts the rule rather than the state
 * of Mohamed's disk: a video in a folder nothing has ever heard of must be found
 * by the same call the run path makes.
 */
let scratch: string | null = null;
const saved = process.env['FRAMOPIA_MODES_DIR'];

function aClientWithAVideoNobodyHasSeen(relative: string): string {
  scratch = mkdtempSync(path.join(tmpdir(), 'framopia-newvideo-'));
  const modes = path.join(scratch, 'modes');
  const folder = path.join(scratch, 'their folder');
  mkdirSync(modes);
  const video = path.join(folder, relative);
  mkdirSync(path.dirname(video), { recursive: true });
  writeFileSync(video, 'not really a video, but it is on the disk');
  const raw = JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'modes', 'k2-syndicalia.json'), 'utf8'),
  ) as Record<string, unknown>;
  raw['id'] = 'a-client-nobody-has-heard-of';
  raw['name'] = 'A Client Nobody Has Heard Of';
  raw['videoFolder'] = folder;
    // The filename is the id: loadMode looks the client up by it.
  writeFileSync(
    path.join(modes, 'a-client-nobody-has-heard-of.json'),
    JSON.stringify(raw, null, 2),
  );
  process.env['FRAMOPIA_MODES_DIR'] = modes;
  return video;
}

afterEach(() => {
  if (saved === undefined) delete process.env['FRAMOPIA_MODES_DIR'];
  else process.env['FRAMOPIA_MODES_DIR'] = saved;
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

describe('a video the tool has never seen', () => {
  it('is not in the list the run path used to search', () => {
    aClientWithAVideoNobodyHasSeen('Exports/Work in Progress/sora-1.mov');
    const label = path.join('Exports', 'Work in Progress', 'sora-1');
    // The old lookup, kept here as the thing that failed him.
    expect(listReels().some((r) => r.label === label)).toBe(false);
  });

  it('resolves anyway, to the file it names', () => {
    const video = aClientWithAVideoNobodyHasSeen('Exports/Work in Progress/sora-1.mov');
    const label = path.join('Exports', 'Work in Progress', 'sora-1');
    const found = findReelByLabel(label);
    expect(found?.label).toBe(label);
    expect(found?.videoPath).toBe(video);
    expect(found?.present).toBe(true);
  });

  /* Several levels down, which is where all of Dr Loubna Kfafi's footage is. */
  it('resolves one several folders deep', () => {
    const video = aClientWithAVideoNobodyHasSeen('a/b/c/d/buried.mov');
    const found = findReelByLabel(path.join('a', 'b', 'c', 'd', 'buried'));
    expect(found?.videoPath).toBe(video);
  });

  it('still resolves a corpus reel, and does not go looking for it', () => {
    expect(findReelByLabel('test-1')?.label).toBe('test-1');
  });

  it('answers undefined for a label nothing has', () => {
    aClientWithAVideoNobodyHasSeen('Exports/one.mov');
    expect(findReelByLabel('a video that does not exist')).toBeUndefined();
  });
});
