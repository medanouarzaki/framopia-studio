import { describe, expect, it } from 'vitest';
import {
  CLIENT_SNAPSHOT_VERSION,
  snapshotIsBehind,
  snapshotOfMode,
  snapshotsAgree,
} from './client-snapshot.js';
import { loadMode, type ClientMode } from './mode.js';

function fixture(over: Partial<ClientMode> = {}): ClientMode {
  return {
    id: 'acme',
    name: 'Acme',
    version: 3,
    palette: {
      background: '#000000',
      primary: '#110000',
      accent: '#CCAA66',
      light: '#FFFFFF',
    },
    fonts: { status: 'set', latin: 'Fake Sans', arabic: 'Fake Arabic' },
    imageStyle: { stylePrompt: ['x'], negativePrompt: ['y'] },
    imageVariation: { note: 'n', axes: { a: ['one', 'two'] } },
    allowedTemplates: { subtitle: ['sub_a'], keyword: ['kw_a'], image: ['img_a'] },
    vocabulary: [],
    ...over,
  } as ClientMode;
}

describe('snapshotOfMode', () => {
  it('copies the look a build reads, and stamps the client’s own version', () => {
    const snap = snapshotOfMode(fixture(), 'then');

    expect(snap).toMatchObject({
      snapshotVersion: CLIENT_SNAPSHOT_VERSION,
      id: 'acme',
      name: 'Acme',
      version: 3,
      capturedAt: 'then',
    });
    expect(snap.palette.accent).toBe('#CCAA66');
    expect(snap.fonts).toEqual({ status: 'set', latin: 'Fake Sans', arabic: 'Fake Arabic' });
  });

  /*
   * Resolved rather than copied, so reading a snapshot never depends on what
   * the defaults happen to be on the day it is read.
   */
  it('resolves the colour roles a client leaves blank', () => {
    // No shadow key at all: a client who names none must not be given one.
    expect(snapshotOfMode(fixture(), 'then').textColours).toEqual({
      ordinary: 'light',
      emphasis: 'accent',
    });
  });

  it('keeps the roles a client names', () => {
    const snap = snapshotOfMode(
      fixture({ textColours: { ordinary: 'accent', emphasis: 'primary' } }),
      'then',
    );
    expect(snap.textColours).toEqual({ ordinary: 'accent', emphasis: 'primary' });
  });

  it('resolves an absent image scale to 1, which is what a build drew', () => {
    expect(snapshotOfMode(fixture(), 'then').imageScale).toBe(1);
    expect(snapshotOfMode(fixture({ imageScale: 1.4 }), 'then').imageScale).toBe(1.4);
  });

  /*
   * The copy is deliberately not the whole mode. A client's own pictures are
   * paths to files a person chose by hand, and pinning one would break the
   * moment it is moved or replaced.
   */
  it('does not copy the client’s pictures', () => {
    const snap = snapshotOfMode(fixture(), 'then') as unknown as Record<string, unknown>;
    expect(snap['pictures']).toBeUndefined();
    expect(snap['videoFolder']).toBeUndefined();
  });
});

describe('snapshotsAgree', () => {
  it('ignores when the copy was taken', () => {
    expect(snapshotsAgree(snapshotOfMode(fixture(), 'a'), snapshotOfMode(fixture(), 'b'))).toBe(
      true,
    );
  });

  it('notices a palette that moved', () => {
    const moved = fixture({
      palette: { ...fixture().palette, accent: '#000001' },
    });
    expect(snapshotsAgree(snapshotOfMode(fixture(), 'a'), snapshotOfMode(moved, 'a'))).toBe(false);
  });

  it('notices a face that changed', () => {
    const moved = fixture({
      fonts: { status: 'set', latin: 'Other Sans', arabic: 'Fake Arabic' },
    });
    expect(snapshotsAgree(snapshotOfMode(fixture(), 'a'), snapshotOfMode(moved, 'a'))).toBe(false);
  });
});

describe('snapshotIsBehind', () => {
  it('is false while the client has not moved', () => {
    expect(snapshotIsBehind(snapshotOfMode(fixture(), 'then'), fixture())).toBe(false);
  });

  it('is true once the client’s look changes underneath a pinned reel', () => {
    const pinned = snapshotOfMode(fixture(), 'then');
    const retuned = fixture({ version: 4, palette: { ...fixture().palette, light: '#EEEEEE' } });
    expect(snapshotIsBehind(pinned, retuned)).toBe(true);
  });
});

describe('the real client', () => {
  it('pins K2 Syndicalia’s three faces and its locked palette', () => {
    const snap = snapshotOfMode(loadMode('k2-syndicalia'), 'now');

    expect(snap.version).toBe(11);
    expect(snap.palette).toEqual({
      background: '#1A0000',
      primary: '#820000',
      accent: '#C9A96E',
      light: '#F8F6F2',
    });
    expect(snap.fonts).toMatchObject({
      latin: 'Inter Semi-Bold',
      arabic: 'Almarai Bold',
      emphasis: 'Cormorant Garamond SemiBold Italic',
    });
    expect(snap.textColours).toEqual({
      ordinary: 'light',
      emphasis: 'accent',
      shadow: 'primary',
    });
  });
});
