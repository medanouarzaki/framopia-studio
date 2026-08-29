import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { VIDEO_EXTENSIONS } from './videos.js';

/*
 * Guidelines §3: a rule with two implementations is pinned by a test. The
 * panel's file dialog offers extensions without their dots, and the service
 * decides which files a folder listing accepts — a dialog that lets him choose
 * a file the list would refuse is a dialog that hands him an error.
 */
describe('what counts as a video', () => {
  it('is the same list in the panel’s dialog and in the folder listing', () => {
    const source = readFileSync(
      path.join(REPO_ROOT, 'panel', 'src', 'video-extensions.ts'),
      'utf8',
    );
    const inPanel = [...source.matchAll(/'([a-z0-9]+)'/g)].map((m) => m[1]);
    expect(inPanel).toEqual(VIDEO_EXTENSIONS.map((e) => e.replace('.', '')));
  });
});
