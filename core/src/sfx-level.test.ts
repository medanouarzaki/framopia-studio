import { describe, expect, it } from 'vitest';
import { sfxGainDb, sfxKindOf, sfxPeakDbfs, SFX_TARGET_OFFSET_DB } from './sfx-level.js';

/**
 * The user built `vitasilk`, played it, and could not hear the hits. Its
 * dialogue runs −14.4 LUFS with a true peak at 0.0 dBFS, and the hit peaked at
 * −20 dBFS — twenty decibels under the voice's peaks, on a figure chosen in
 * Block 5 against nothing.
 */
describe('sfx level, relative to the dialogue', () => {
  it('puts a hit above the reel’s average speech level, where an accent belongs', () => {
    expect(sfxPeakDbfs({ sfxId: 'hit_01', dialogueLufs: -14.4 })).toBeCloseTo(-8.4, 2);
    expect(SFX_TARGET_OFFSET_DB.hit).toBeGreaterThan(0);
  });

  /*
   * It sat at the dialogue's own level and the user could not hear it under
   * speech. A bed still belongs below the hit's accent, so it went to +3 rather
   * than up to +6.
   */
  it('puts a whoosh above the dialogue but below the hit', () => {
    expect(sfxPeakDbfs({ sfxId: 'whoosh_01', dialogueLufs: -14.4 })).toBeCloseTo(-11.4, 2);
    expect(SFX_TARGET_OFFSET_DB.whoosh).toBeGreaterThan(0);
    expect(SFX_TARGET_OFFSET_DB.whoosh).toBeLessThan(SFX_TARGET_OFFSET_DB.hit);
  });

  /* The whole point: the same file lands correctly on a quiet and a loud reel. */
  it('moves the gain with the reel, so no one has to listen per reel', () => {
    const loud = sfxGainDb({ sfxId: 'hit_01', filePeakDbfs: -0.72, dialogueLufs: -10 });
    const quiet = sfxGainDb({ sfxId: 'hit_01', filePeakDbfs: -0.72, dialogueLufs: -24 });
    expect(loud - quiet).toBeCloseTo(14, 2);
  });

  /* A file already 8 dB down needs 8 dB less attenuation to arrive together. */
  it('compensates each file’s own peak', () => {
    const hot = sfxGainDb({ sfxId: 'whoosh_01', filePeakDbfs: -1.23, dialogueLufs: -14.4 });
    const quiet = sfxGainDb({ sfxId: 'whoosh_02', filePeakDbfs: -8.39, dialogueLufs: -14.4 });
    expect(quiet - hot).toBeCloseTo(7.16, 2);
    expect(sfxPeakDbfs({ sfxId: 'whoosh_01', dialogueLufs: -14.4 })).toBe(
      sfxPeakDbfs({ sfxId: 'whoosh_02', dialogueLufs: -14.4 }),
    );
  });

  it('reproduces the corpus figures, with the mix attenuated', () => {
    const args = { dialogueLufs: -14.4, attenuationDb: 3.8 } as const;
    expect(sfxGainDb({ ...args, sfxId: 'hit_01', filePeakDbfs: -0.72 })).toBeCloseTo(-11.48, 2);
    expect(sfxGainDb({ ...args, sfxId: 'hit_02', filePeakDbfs: -0.03 })).toBeCloseTo(-12.17, 2);
    expect(sfxGainDb({ ...args, sfxId: 'whoosh_01', filePeakDbfs: -1.23 })).toBeCloseTo(-13.97, 2);
  });

  /*
   * Still louder than the absolute figures it replaces, even after the mix is
   * turned down to stop it clipping — which is the point: the voice came down
   * with it, so both sounds gained against the thing they have to be heard
   * through.
   */
  it('raises every sound above the absolute figures it replaces', () => {
    const args = { dialogueLufs: -14.4, attenuationDb: 3.8 } as const;
    expect(sfxGainDb({ ...args, sfxId: 'hit_01', filePeakDbfs: -0.72 })).toBeGreaterThan(-19.28);
    expect(sfxGainDb({ ...args, sfxId: 'whoosh_01', filePeakDbfs: -1.23 })).toBeGreaterThan(-22.77);
  });

  it('names a sound’s kind from its id', () => {
    expect(sfxKindOf('hit_02')).toBe('hit');
    expect(sfxKindOf('whoosh_02')).toBe('whoosh');
  });
});
