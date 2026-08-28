import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './paths.js';

/**
 * The manifest's measurements are written by `npm run sfx:measure`, never by
 * hand. These pin that they are there, that they are the shape the placement
 * rule needs, and — the point of the whole exercise — that no file's peak is at
 * its first sample.
 */
const manifest = JSON.parse(
  readFileSync(path.join(REPO_ROOT, 'assets', 'sfx', 'sfx.json'), 'utf8'),
) as {
  sfx: {
    id: string;
    file: string;
    defaultGainDb: number;
    measured?: {
      codec: string;
      container: string;
      durationS: number;
      peakOffsetS: number;
      peakOffsetFrames: number;
      peakDbfs: number;
      encoderDelayS: number;
      firstAudibleS: number | null;
      shape: string;
    };
  }[];
};

describe('the sfx manifest', () => {
  it('carries a measurement for every file', () => {
    for (const entry of manifest.sfx) {
      expect(entry.measured, entry.id).toBeDefined();
    }
  });

  /*
   * The assumption this session removed: that a sound's impact is at its first
   * sample. Not one of the four files is like that.
   */
  it('shows no file whose peak is at its first sample', () => {
    for (const entry of manifest.sfx) {
      expect(entry.measured?.peakOffsetS, entry.id).toBeGreaterThan(0);
    }
  });

  /*
   * `hit_01` is the one bound to every keyword. Its peak is over two seconds
   * in, so the old rule — file start at the card plus 0.13 s — was putting its
   * impact two seconds after the card it belongs to.
   */
  it('records hit_01’s peak more than two seconds into the file', () => {
    const hit = manifest.sfx.find((s) => s.id === 'hit_01');
    expect(hit?.measured?.peakOffsetS).toBeGreaterThan(2);
    expect(hit?.measured?.peakOffsetFrames).toBeGreaterThan(60);
  });

  /* An mp3's head padding is a different fact from a quiet opening. */
  it('keeps container delay separate from the sound’s own silence', () => {
    for (const entry of manifest.sfx) {
      expect(typeof entry.measured?.encoderDelayS, entry.id).toBe('number');
      expect(entry.measured?.firstAudibleS, entry.id).not.toBeUndefined();
    }
  });

  it('names each file’s real codec and container', () => {
    const byId = Object.fromEntries(manifest.sfx.map((s) => [s.id, s.measured]));
    expect(byId['hit_01']?.codec).toBe('mp3');
    expect(byId['hit_02']?.container).toBe('wav');
    expect(byId['hit_02']?.codec).toBe('pcm_s24le');
  });

  it('records where a whoosh’s energy sits, since a sweep anchors differently', () => {
    for (const id of ['whoosh_01', 'whoosh_02']) {
      const entry = manifest.sfx.find((s) => s.id === id);
      expect(['head', 'middle', 'tail'], id).toContain(entry?.measured?.shape);
    }
  });
});
