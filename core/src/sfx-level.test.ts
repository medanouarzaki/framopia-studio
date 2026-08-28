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

  it('puts a whoosh at the dialogue’s own level, where a bed belongs', () => {
    expect(sfxPeakDbfs({ sfxId: 'whoosh_01', dialogueLufs: -14.4 })).toBeCloseTo(-14.4, 2);
    expect(SFX_TARGET_OFFSET_DB.whoosh).toBe(0);
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

  it('reproduces the corpus figures', () => {
    expect(sfxGainDb({ sfxId: 'hit_01', filePeakDbfs: -0.72, dialogueLufs: -14.4 })).toBeCloseTo(-7.68, 2);
    expect(sfxGainDb({ sfxId: 'whoosh_01', filePeakDbfs: -1.23, dialogueLufs: -14.4 })).toBeCloseTo(-13.17, 2);
  });

  /* It is louder than what was there, which is the reported symptom. */
  it('raises every sound above the absolute figures it replaces', () => {
    expect(sfxGainDb({ sfxId: 'hit_01', filePeakDbfs: -0.72, dialogueLufs: -14.4 })).toBeGreaterThan(-19.28);
    expect(sfxGainDb({ sfxId: 'whoosh_01', filePeakDbfs: -1.23, dialogueLufs: -14.4 })).toBeGreaterThan(-22.77);
  });

  it('names a sound’s kind from its id', () => {
    expect(sfxKindOf('hit_02')).toBe('hit');
    expect(sfxKindOf('whoosh_02')).toBe('whoosh');
  });
});
