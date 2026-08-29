import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  cardColours, cardFrameColour, frameReferenceLuminance, loadMode,
  MIN_IMAGE_EDGE_CONTRAST, parseHexColour, REPO_ROOT,
} from '@framopia/core';
import { edgeLuminance, SIDECAR_PYTHON } from './images/sidecar.js';
import { readEditPlan } from './editplan/io.js';

/**
 * Against the real files. The defect this pins was invisible to a fixture: the
 * frame colour was chosen from a measurement of a picture that is not the one
 * on screen, and only the actual cutout on disk shows that.
 */
const palette = Object.fromEntries(
  Object.entries(loadMode('k2-syndicalia').palette).map(([r, h]) => [r, parseHexColour(h)]),
);

/*
 * Each measurement spawns the Python sidecar, so the ten are taken once and
 * shared. Ten subprocesses inside one test is what put it past the default
 * timeout when the suite runs in parallel.
 */
interface Measured {
  slotId: string;
  candidateId: string;
  rendersAsCutout: boolean;
  edgeLuminance: number;
  transparentFraction: number;
  subjectLitLuminance: number | null;
}

describe.skipIf(!existsSync(SIDECAR_PYTHON))('the frame colour, on the real pictures', () => {
  const measured: Measured[] = [];

  beforeAll(async () => {
    const plan = await readEditPlan(
      path.join(REPO_ROOT, 'my files', 'test videos', 'vitasilk.editplan.json'),
    );
    for (const slot of plan.images.slots) {
      const rendersAsCutout = slot.presentation === 'cutout';
      for (const candidate of slot.candidates) {
        const file = rendersAsCutout ? (candidate.cutoutPath ?? candidate.path) : candidate.path;
        const m = await edgeLuminance(file);
        measured.push({
          slotId: slot.id,
          candidateId: candidate.id,
          rendersAsCutout,
          edgeLuminance: m.meanLuminance,
          transparentFraction: m.transparentFraction,
          subjectLitLuminance: m.subjectLitLuminance,
        });
      }
    }
  }, 120_000);
  it('measures the subject of a cut-out and the edge of a whole picture', () => {
    let cutouts = 0;
    let whole = 0;
    for (const m of measured) {
      const where = `${m.slotId}/${m.candidateId}`;
      if (m.rendersAsCutout) {
        cutouts += 1;
        // Every cutout in the corpus is fully transparent at its ring, which is
        // why measuring the ring answered the wrong question.
        expect(m.edgeLuminance, where).toBeLessThan(0.02);
        expect(m.transparentFraction, where).toBeGreaterThan(0.5);
        expect(m.subjectLitLuminance, where).not.toBeNull();
      } else {
        whole += 1;
        expect(m.transparentFraction, where).toBe(0);
      }
      const ref = frameReferenceLuminance(m);
      const frame = cardFrameColour({ edgeLuminance: ref.luminance, palette });
      expect(frame.contrast, where).toBeGreaterThanOrEqual(MIN_IMAGE_EDGE_CONTRAST);
      expect(frame.meetsMinimum, where).toBe(true);
    }
    expect(cutouts).toBe(2);
    expect(whole).toBe(8);
  });

  /*
   * `img002-c1` is the picture the user was looking at. Its lit half is nearly
   * white and it was being framed in the palette's lightest colour.
   */
  it('gives the disappearing cut-out a dark frame', () => {
    const m = measured.find((x) => x.candidateId === 'img002-c1') as Measured;
    const ref = frameReferenceLuminance(m);
    const now = cardFrameColour({ edgeLuminance: ref.luminance, palette });
    const before = cardFrameColour({ edgeLuminance: m.edgeLuminance, palette });

    expect(before.role).toBe('light');
    expect(now.role).toBe('background');
    expect(now.contrast).toBeGreaterThan(9);
    // What the old choice was worth against what is actually on screen.
    expect(
      cardFrameColour({ edgeLuminance: ref.luminance, palette: { light: palette['light'] as never } })
        .contrast,
    ).toBeLessThan(2);
  });

  /*
   * The card is both the border and the ground for a cut-out, so a frame chosen
   * only against the subject left no border to see. Two contrasts have to hold
   * now: the subject against its ground, and the border against that ground.
   */
  it('gives every cut-out a ground and a border that both clear the minimum', () => {
    for (const m of measured.filter((x) => x.rendersAsCutout)) {
      const c = cardColours({ ...m, palette });
      const where = `${m.slotId}/${m.candidateId}`;
      expect(c.fill, where).not.toBeNull();
      expect(c.fill?.role, where).not.toBe(c.frame.role);
      expect(c.fill?.contrast, where).toBeGreaterThanOrEqual(MIN_IMAGE_EDGE_CONTRAST);
      expect(c.frame.contrast, where).toBeGreaterThanOrEqual(MIN_IMAGE_EDGE_CONTRAST);
      expect(c.meetsMinimum, where).toBe(true);
      expect(c.fallback, where).toBeNull();
    }
  });

  /* The one that is built, and the one he was looking at. */
  it('puts the serum bottle on a dark ground inside a light frame', () => {
    const m = measured.find((x) => x.candidateId === 'img002-c1') as Measured;
    const c = cardColours({ ...m, palette });
    expect(c.fill?.role).toBe('background');
    expect(c.frame.role).toBe('light');
    // Which is what the other four already look like.
    const whole = measured.find((x) => !x.rendersAsCutout) as Measured;
    expect(cardColours({ ...whole, palette }).frame.role).toBe('light');
  });

  it('leaves every whole picture on the frame it already had', () => {
    for (const m of measured.filter((x) => !x.rendersAsCutout)) {
      const ref = frameReferenceLuminance(m);
      expect(ref.luminance, `${m.slotId}/${m.candidateId}`).toBe(m.edgeLuminance);
      expect(cardFrameColour({ edgeLuminance: ref.luminance, palette }).role).toBe('light');
    }
  });
});
