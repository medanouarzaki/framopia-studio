import { describe, expect, it } from 'vitest';
import path from 'node:path';
import {
  dialogueAttenuationDb, loadTemplateManifest, loudestBoundOffsetDb,
  REPO_ROOT, SFX_TARGET_OFFSET_DB, templatesById,
} from '@framopia/core';
import { readEditPlan } from '../editplan/io.js';

/**
 * The voice comes down to make room for the loudest sound in the mix. Which
 * sound that is depends on what the templates actually bind — the hits have
 * been bound to nothing since Block 8 session 27, so nothing plays at +6 dB.
 *
 * Session 27 taught the sound derivation that and not the builder, so the voice
 * was coming down 3.80 dB while the sounds were gained for 3.07. Two halves of
 * one rule, disagreeing.
 */
const templates = templatesById(loadTemplateManifest());

describe('how far the voice comes down', () => {
  it('is computed against a sound something actually plays', () => {
    expect(loudestBoundOffsetDb(templates)).toBe(SFX_TARGET_OFFSET_DB.whoosh);
    expect(loudestBoundOffsetDb(templates)).toBeLessThan(SFX_TARGET_OFFSET_DB.hit);
  });

  it('matches what the sounds are gained for, on every reel', async () => {
    for (const stem of ['ground truth', 'test 1', 'test 2', 'test 3', 'vitasilk']) {
      const plan = await readEditPlan(
        path.join(REPO_ROOT, 'my files', 'test videos', `${stem}.editplan.json`),
      );
      const dialogueLufs = plan.source.dialogueLufs;
      const dialoguePeakDbfs = plan.source.dialoguePeakDbfs;
      if (dialogueLufs === undefined || dialoguePeakDbfs === undefined) continue;

      // What the builder now asks for, and what `deriveSfxEvents` asks for.
      const both = dialogueAttenuationDb({
        dialogueLufs,
        dialoguePeakDbfs,
        loudestOffsetDb: loudestBoundOffsetDb(templates),
      });
      // What the builder asked for before, against every declared offset.
      const againstUnbound = dialogueAttenuationDb({ dialogueLufs, dialoguePeakDbfs });
      expect(both, stem).toBeLessThan(againstUnbound);
      // The reel was being turned down about three quarters of a decibel for a
      // sound nothing plays: 0.70 on `vitasilk`, 0.75 on `ground-truth`.
      expect(againstUnbound - both, stem).toBeGreaterThan(0.6);
      expect(againstUnbound - both, stem).toBeLessThan(0.8);
    }
  });

  /*
   * The consequence of the disagreement, and why it is not only a level: the
   * sounds were gained for one attenuation and the voice took another, so the
   * balance was off by the difference.
   */
  it('puts the sounds exactly where the offset says, once the two agree', async () => {
    const plan = await readEditPlan(
      path.join(REPO_ROOT, 'my files', 'test videos', 'vitasilk.editplan.json'),
    );
    const dialogueLufs = plan.source.dialogueLufs as number;
    const dialoguePeakDbfs = plan.source.dialoguePeakDbfs as number;
    const bound = loudestBoundOffsetDb(templates);
    const agreed = dialogueAttenuationDb({ dialogueLufs, dialoguePeakDbfs, loudestOffsetDb: bound });
    const old = dialogueAttenuationDb({ dialogueLufs, dialoguePeakDbfs });

    // Sounds are gained for `agreed`; the voice used to take `old`.
    expect(SFX_TARGET_OFFSET_DB.whoosh + (old - agreed)).toBeCloseTo(3.73, 2);
    expect(SFX_TARGET_OFFSET_DB.whoosh + (agreed - agreed)).toBe(3);
  });
});
