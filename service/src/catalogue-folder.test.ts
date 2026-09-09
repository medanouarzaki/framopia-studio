import { afterEach, describe, expect, it } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { listModes } from './catalogue.js';

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
