import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REPO_ROOT, modePathFor } from '@framopia/core';
import { addPicture, createClient, removePicture, setPictureLabel } from './create.js';

/**
 * **The three controls that write to his photograph store, pressed twice.**
 *
 * Block 14 session 113. Session 112 audited 78 controls over two scenarios and
 * left these three deliberately empty: they are the ones where a double press
 * would matter most, and pressing them against Dr Loubna Kfafi's twenty-two
 * photographs was not a risk worth running to fill in a table.
 *
 * So they are pressed here against **a scratch client and scratch
 * photographs**, made in a temporary directory and deleted at the end. The
 * question is not whether the panel sends one request — `every-control.browser.
 * test.ts` measures that — but what the store does when it receives two.
 *
 * **Never delete a user asset** is the rule these exist to check. The scratch
 * photographs stand in for his: they are hashed before and after, and every
 * assertion about damage is made against those hashes.
 */
const SCRATCH_NAME = 'Scratch Client Session 113';
const SCRATCH_ID = 'scratch-client-session-113';
const PALETTE = {
  background: '#0B0B0F',
  primary: '#3C6E71',
  accent: '#D9594C',
  light: '#F4F1DE',
};

let dir = '';
let photographs: string[] = [];
let before = new Map<string, string>();

/** A real PNG, small, and different bytes per file so a mix-up is visible. */
function pngBytes(seed: number): Buffer {
  const header = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
  ]);
  return Buffer.concat([header, Buffer.from(`session-113-scratch-${String(seed)}`)]);
}

function sha(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function storeDir(): string {
  return path.join(REPO_ROOT, 'assets', 'client-pictures', SCRATCH_ID);
}

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'framopia-pressed-twice-'));
  photographs = [1, 2, 3].map((n) => {
    const file = path.join(dir, `scratch-${String(n)}.png`);
    writeFileSync(file, pngBytes(n));
    return file;
  });
  before = new Map(photographs.map((f) => [f, sha(f)]));
  /* A leftover from an interrupted run would make every count below wrong. */
  rmSync(modePathFor(SCRATCH_ID), { force: true });
  rmSync(storeDir(), { recursive: true, force: true });
  createClient({ name: SCRATCH_NAME, palette: PALETTE });
});

afterAll(() => {
  rmSync(modePathFor(SCRATCH_ID), { force: true });
  rmSync(storeDir(), { recursive: true, force: true });
  rmSync(dir, { recursive: true, force: true });
  /*
   * Said rather than assumed. Session 71 reported moving three files it had not
   * moved; a cleanup that is claimed and not checked is the same mistake.
   */
  expect(existsSync(modePathFor(SCRATCH_ID))).toBe(false);
  expect(existsSync(storeDir())).toBe(false);
});

function stored(): string[] {
  return existsSync(storeDir()) ? readdirSync(storeDir()).sort() : [];
}

describe('the three controls that write to his photograph store, pressed twice', () => {
  it('adds a photograph twice: the file it came from is untouched either time', () => {
    const source = photographs[0] as string;
    const first = addPicture(SCRATCH_ID, { path: source, description: 'the clinic door' });
    const second = addPicture(SCRATCH_ID, { path: source, description: 'the clinic door' });

    console.log(
      `\n  add, pressed twice: ids ${first.id} and ${second.id}, ` +
        `${String(stored().length)} file(s) in the store — ${stored().join(', ')}`,
    );

    /*
     * **The finding, measured, and not the one this test was written expecting.**
     *
     * The guess was that `keepPicture` would recognise the identical bytes and
     * return the file it already had. It does not: it is asked for `pic002`,
     * `pic002.png` is not there, and it copies. So a second press costs a second
     * row on the client **and a second copy of the photograph in the store** —
     * about 1.6 MB for one of his, pushed to the public repository with the
     * rest.
     *
     * **Nothing is damaged and nothing is deleted**, which is what these controls
     * had to be checked for: the file he chose is byte-identical, the first entry
     * is untouched, and no user asset is removed. What a double press produces is
     * a duplicate he would have to forget by hand.
     *
     * So the panel's guard is the only thing between him and that duplicate, and
     * it is not decoration. `every-control.browser.test.ts` presses this control
     * twice against an answer held for three seconds and measures one request; the
     * guard is `disabled={!ready}` with `busy` in `ready`, in `ClientPictures.tsx`.
     */
    expect(sha(source)).toBe(before.get(source));
    expect(first.id).not.toBe(second.id);
    expect(stored().length).toBe(2);
    /* Two rows, two files, and both files are the photograph he chose. */
    for (const file of stored()) {
      expect(`${file}: ${sha(path.join(storeDir(), file))}`).toBe(`${file}: ${String(before.get(source))}`);
    }
  });

  it('never writes to the file he chose, whatever is pressed', () => {
    const source = photographs[1] as string;
    const added = addPicture(SCRATCH_ID, { path: source, description: 'her waiting room' });
    setPictureLabel(SCRATCH_ID, added.id, 'waiting room');
    setPictureLabel(SCRATCH_ID, added.id, 'waiting room');
    removePicture(SCRATCH_ID, added.id);
    removePicture(SCRATCH_ID, added.id);
    for (const [file, hash] of before) expect(`${path.basename(file)}: ${sha(file)}`).toBe(`${path.basename(file)}: ${hash}`);
  });

  it('saves the same words twice and leaves one picture with those words', () => {
    const source = photographs[2] as string;
    const added = addPicture(SCRATCH_ID, { path: source, description: 'the treatment room' });
    const first = setPictureLabel(SCRATCH_ID, added.id, 'Profhilo');
    const second = setPictureLabel(SCRATCH_ID, added.id, 'Profhilo');
    console.log(`  save the words, pressed twice: "${String(first.label)}" then "${String(second.label)}"`);
    expect(second).toEqual(first);
    const mode = JSON.parse(readFileSync(modePathFor(SCRATCH_ID), 'utf8')) as {
      pictures?: { id: string; label?: string }[];
    };
    expect((mode.pictures ?? []).filter((p) => p.id === added.id).length).toBe(1);
    removePicture(SCRATCH_ID, added.id);
  });

  /**
   * **Forgetting a photograph twice, which is the one that could delete.**
   *
   * It does not: `removePicture` edits the client file and never touches the
   * store. The second press is a filter that removes nothing. Both facts are
   * asserted rather than described.
   */
  it('forgets a photograph twice and deletes no file at all', () => {
    const source = photographs[0] as string;
    const added = addPicture(SCRATCH_ID, { path: source, description: 'the sign outside' });
    const kept = stored().length;
    removePicture(SCRATCH_ID, added.id);
    removePicture(SCRATCH_ID, added.id);
    console.log(
      `  forget, pressed twice: ${String(kept)} file(s) in the store before, ` +
        `${String(stored().length)} after`,
    );
    expect(stored().length).toBe(kept);
    expect(sha(source)).toBe(before.get(source));
  });
});
