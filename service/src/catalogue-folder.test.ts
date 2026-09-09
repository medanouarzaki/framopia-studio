import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { listModes, listVideosFor } from './catalogue.js';

/**
 * **What the client card is told about a folder declared too deep.**
 *
 * `videosLeftOutside` is proved in core against made-up paths. This is the wire
 * between it and the screen: the catalogue reads the reels already made, works
 * out which of a client's own videos their declared folder does not contain, and
 * hands the card a sentence or nothing.
 *
 * Both directories are scratch copies. **The real clients are never read here**,
 * and nothing writes to `modes/`.
 */
let scratch: string | null = null;
const saved = {
  modes: process.env['FRAMOPIA_MODES_DIR'],
  plans: process.env['FRAMOPIA_PLANS_DIR'],
};

function world(videoFolder: string, videoPaths: string[]): void {
  scratch = mkdtempSync(path.join(tmpdir(), 'framopia-catalogue-'));
  const modes = path.join(scratch, 'modes');
  const plans = path.join(scratch, 'plans');
  mkdirSync(modes);
  mkdirSync(plans);
  /* A real client file, so this is the shape the parser really accepts. */
  cpSync(path.join(REPO_ROOT, 'modes', 'k2-syndicalia.json'), path.join(modes, 'a-client.json'));
  const raw = JSON.parse(readFileSync(path.join(modes, 'a-client.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  raw['id'] = 'a-client';
  raw['name'] = 'A Client';
  raw['videoFolder'] = videoFolder;
  writeFileSync(path.join(modes, 'a-client.json'), JSON.stringify(raw, null, 2));
  videoPaths.forEach((videoPath, i) => {
    writeFileSync(
      path.join(plans, `reel-${i}.editplan.json`),
      JSON.stringify({ clientMode: { id: 'a-client' }, source: { videoPath } }),
    );
  });
  process.env['FRAMOPIA_MODES_DIR'] = modes;
  process.env['FRAMOPIA_PLANS_DIR'] = plans;
}

afterEach(() => {
  if (saved.modes === undefined) delete process.env['FRAMOPIA_MODES_DIR'];
  else process.env['FRAMOPIA_MODES_DIR'] = saved.modes;
  if (saved.plans === undefined) delete process.env['FRAMOPIA_PLANS_DIR'];
  else process.env['FRAMOPIA_PLANS_DIR'] = saved.plans;
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

const ROOT = '/Clients/A Client';

describe('the sentence the card gets about a declared folder', () => {
  it('is nothing when the folder holds every video of theirs', () => {
    world(ROOT, [`${ROOT}/Inputs/one.mov`, `${ROOT}/September/two.mov`]);
    expect(listModes()[0]?.folderLeavesOut).toBeNull();
  });

  it('says what is left out when the folder is declared too deep', () => {
    world(`${ROOT}/Inputs`, [`${ROOT}/Inputs/one.mov`, `${ROOT}/September/two.mov`]);
    const said = listModes()[0]?.folderLeavesOut ?? '';
    expect(said).toContain('One video already set up as this client');
    expect(said).toContain('Nothing has been changed');
  });

  /* A plan this service cannot open must not take the whole client list down. */
  it('still lists the clients when a plan is unreadable', () => {
    world(`${ROOT}/Inputs`, [`${ROOT}/September/two.mov`]);
    writeFileSync(path.join(scratch as string, 'plans', 'broken.editplan.json'), '{not json');
    const modes = listModes();
    expect(modes).toHaveLength(1);
    expect(modes[0]?.folderLeavesOut).toContain('One video');
  });

  it('is nothing when this machine has made no reels', () => {
    world(`${ROOT}/Inputs`, []);
    expect(listModes()[0]?.folderLeavesOut).toBeNull();
  });
});

/**
 * **What the picker is offered, when two videos share a filename.**
 *
 * The panel keys its picker by label and looks the chosen reel back up by label.
 * Three of Dr Loubna Kfafi's files are called `sora.mov` in three different
 * sub-folders, so an unqualified label would give the picker the same key three
 * times and resolve whichever he chose to the first of them.
 */
describe('the labels the video picker is given', () => {
  let tree: string;
  const savedModes = process.env['FRAMOPIA_MODES_DIR'];
  let modes: string;

  beforeEach(() => {
    tree = mkdtempSync(path.join(tmpdir(), 'framopia-labels-'));
    modes = mkdtempSync(path.join(tmpdir(), 'framopia-labelmodes-'));
    const raw = JSON.parse(
      readFileSync(path.join(REPO_ROOT, 'modes', 'k2-syndicalia.json'), 'utf8'),
    ) as Record<string, unknown>;
    raw['id'] = 'a-client-with-subfolders';
    raw['videoFolder'] = tree;
    writeFileSync(path.join(modes, 'a-client-with-subfolders.json'), JSON.stringify(raw, null, 2));
    process.env['FRAMOPIA_MODES_DIR'] = modes;
  });

  afterEach(() => {
    if (savedModes === undefined) delete process.env['FRAMOPIA_MODES_DIR'];
    else process.env['FRAMOPIA_MODES_DIR'] = savedModes;
    rmSync(tree, { recursive: true, force: true });
    rmSync(modes, { recursive: true, force: true });
  });

  function video(relative: string): void {
    const full = path.join(tree, relative);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, 'x');
  }

  it('gives one label per video, all of them different', () => {
    video('Inputs/Footages/sora.mov');
    video('August/Work in Progress/sora.mov');
    video('September/Work in Progress/sora.mov');
    const reels = listVideosFor('a-client-with-subfolders').reels;
    expect(reels).toHaveLength(3);
    expect(new Set(reels.map((r) => r.label)).size).toBe(3);
  });

  it('leads every label with the folder it was found in', () => {
    video('September/Work in Progress/sora.mov');
    const reel = listVideosFor('a-client-with-subfolders').reels[0];
    expect(reel?.label).toBe(path.join('September', 'Work in Progress', 'sora'));
  });

  /* A video at the top of the folder keeps its plain name. */
  it('leaves a video at the top of the folder named as it always was', () => {
    video('plain.mov');
    expect(listVideosFor('a-client-with-subfolders').reels[0]?.label).toBe('plain');
  });

  /* Whatever the label says, the reel points at the file it was found at. */
  it('points each label at its own file', () => {
    video('one/sora.mov');
    video('two/sora.mov');
    const reels = listVideosFor('a-client-with-subfolders').reels;
    expect(new Set(reels.map((r) => r.videoPath)).size).toBe(2);
    for (const reel of reels) {
      expect(reel.videoPath.endsWith(`${reel.label}.mov`)).toBe(true);
    }
  });
});
