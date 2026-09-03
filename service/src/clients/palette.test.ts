import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { loadMode, modePathFor, snapshotOfMode, snapshotIsBehind, PALETTE_ROLES } from '@framopia/core';
import { ClientWriteError, createClient, setPalette } from './create.js';

/**
 * **A saved client's colours can be corrected.**
 *
 * They could be chosen when the client was created and never afterwards — Block
 * 10 session 40 found there was no route — and session 44 found that the screen
 * that chose them never sent them either, so a client's four colours had never
 * reached anything for anybody but K2 Syndicalia.
 *
 * These write a scratch client into `modes/` and delete it again; K2's file is
 * never opened for writing.
 */
const ID = 'palette-test-scratch-client';
const THEIRS = {
  background: '#06131F',
  primary: '#12507A',
  accent: '#5FD0F0',
  light: '#F2FBFF',
};

afterEach(() => rmSync(modePathFor(ID), { force: true }));

function make(): void {
  rmSync(modePathFor(ID), { force: true });
  createClient({ name: 'Palette Test Scratch Client' });
}

describe('correcting a client’s colours', () => {
  it('replaces all four and leaves everything else alone', () => {
    make();
    const before = loadMode(ID);
    setPalette(ID, THEIRS);
    const after = loadMode(ID);
    expect(after.palette).toEqual(THEIRS);
    // Everything but the palette and the version is untouched.
    expect({ ...after, palette: null, version: 0 }).toEqual({ ...before, palette: null, version: 0 });
  });

  it('uppercases what it is given, so two spellings of one colour agree', () => {
    make();
    setPalette(ID, { ...THEIRS, accent: '#5fd0f0' });
    expect(loadMode(ID).palette.accent).toBe('#5FD0F0');
  });

  /**
   * The four are one object on the mode and `renderStylePrompt` substitutes
   * every role into an image prompt, so a half-written palette would reach the
   * model as the word "undefined".
   */
  it('refuses a palette that is missing a colour, and writes nothing', () => {
    make();
    const before = readFileSync(modePathFor(ID), 'utf8');
    const { accent, ...three } = THEIRS;
    void accent;
    expect(() => setPalette(ID, three as unknown as Record<string, string>)).toThrow(ClientWriteError);
    expect(readFileSync(modePathFor(ID), 'utf8')).toBe(before);
  });

  it('names the colours that are missing', () => {
    make();
    expect(() => setPalette(ID, { light: '#FFFFFF' })).toThrow(/accent/);
  });

  it('refuses a client that does not exist', () => {
    expect(() => setPalette('no-such-client-anywhere', THEIRS)).toThrow(ClientWriteError);
  });

  it('keeps a note someone typed into the file by hand', () => {
    make();
    const raw = JSON.parse(readFileSync(modePathFor(ID), 'utf8')) as Record<string, unknown>;
    raw['note'] = 'typed by a person';
    writeFileSync(modePathFor(ID), `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    setPalette(ID, THEIRS);
    expect(loadMode(ID).note).toBe('typed by a person');
  });

  /**
   * **A reel already built keeps the look it was built with.** It pins a
   * snapshot and rebuilds from that; the edit bumps the client's version, which
   * is what lets the panel offer to move the reel forward — a control someone
   * presses, never something the edit does.
   */
  it('leaves a reel’s pinned look exactly where it was', () => {
    make();
    const pinned = snapshotOfMode(loadMode(ID), '2026-01-01T00:00:00.000Z');
    const copy = JSON.parse(JSON.stringify(pinned)) as typeof pinned;
    setPalette(ID, THEIRS);
    expect(pinned).toEqual(copy);
    expect(pinned.palette.accent).not.toBe(THEIRS.accent);
    // And the reel is now offered the move, rather than taking it.
    expect(snapshotIsBehind(pinned, loadMode(ID))).toBe(true);
  });

  it('bumps the client’s version once per edit', () => {
    make();
    const first = loadMode(ID).version;
    setPalette(ID, THEIRS);
    expect(loadMode(ID).version).toBe(first + 1);
    setPalette(ID, { ...THEIRS, light: '#FFFFFF' });
    expect(loadMode(ID).version).toBe(first + 2);
  });

  it('writes every role the project defines, and no other key', () => {
    make();
    setPalette(ID, THEIRS);
    expect(Object.keys(loadMode(ID).palette).sort()).toEqual([...PALETTE_ROLES].sort());
  });
});
