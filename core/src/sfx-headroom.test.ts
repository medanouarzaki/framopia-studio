import { describe, expect, it } from 'vitest';
import {
  dialogueAttenuationDb,
  sfxGainDb,
  sfxLevel,
  sfxPeakDbfs,
  summedPeakDbfs,
  MIX_CEILING_DBFS,
  SFX_TARGET_OFFSET_DB,
} from './sfx-level.js';

/**
 * Session 25 set the offsets and the hits clipped. The reason is measurable and
 * has nothing to do with the offset: this corpus is delivered at 0.0–0.2 dBFS
 * true peak, so at the instants the voice is on full scale there is no gain at
 * all at which a second sound can be added.
 */
describe('the headroom the mix does not have', () => {
  it('adds two peaks at their worst case', () => {
    // Two equal peaks in phase double the amplitude: 20·log10(2) = 6.0206 dB.
    expect(summedPeakDbfs(-6.0206, -6.0206)).toBeCloseTo(0, 4);
    expect(summedPeakDbfs(0, Number.NEGATIVE_INFINITY)).toBeCloseTo(0, 6);
  });

  it('shows there is no solution in the sfx gain alone', () => {
    // A hit as quiet as −40 dBFS still pushes a 0 dBFS voice over the ceiling.
    expect(summedPeakDbfs(0, -40)).toBeGreaterThan(MIX_CEILING_DBFS);
    const level = sfxLevel({
      sfxId: 'hit_01',
      filePeakDbfs: -0.72,
      dialogueLufs: -14.4,
      attenuationDb: 0,
      dialoguePeakAtEventDbfs: 0,
    });
    expect(level.peakDbfs).toBe(Number.NEGATIVE_INFINITY);
    expect(level.binding).toBe('headroom-ceiling');
  });

  it('derives the attenuation rather than choosing it', () => {
    const a = dialogueAttenuationDb({ dialogueLufs: -14.4, dialoguePeakDbfs: 0 });
    expect(a).toBeCloseTo(3.8, 2);
    // The dialogue and the sound both come down by it, so the sum lands exactly
    // on the ceiling — that is what makes it the smallest attenuation that works.
    const hit = sfxPeakDbfs({ sfxId: 'hit_01', dialogueLufs: -14.4, attenuationDb: a });
    expect(summedPeakDbfs(0 - a, hit)).toBeCloseTo(MIX_CEILING_DBFS, 1);
  });

  it('covers the whole corpus at 3.8 to 4.1 dB', () => {
    for (const [lufs, peak] of [
      [-13.9, 0.1], [-14, 0.1], [-14.6, 0.2], [-14.6, 0.1], [-14.4, 0],
    ] as const) {
      const a = dialogueAttenuationDb({ dialogueLufs: lufs, dialoguePeakDbfs: peak });
      expect(a).toBeGreaterThan(3.7);
      expect(a).toBeLessThan(4.1);
    }
  });

  it('never boosts a reel that already has headroom', () => {
    expect(dialogueAttenuationDb({ dialogueLufs: -23, dialoguePeakDbfs: -12 })).toBe(0);
  });

  /* The offset is a balance, so it must survive the attenuation unchanged. */
  it('keeps the balance the offsets describe, whatever the attenuation', () => {
    const a = dialogueAttenuationDb({ dialogueLufs: -14.4, dialoguePeakDbfs: 0 });
    const heard = -14.4 - a;
    expect(sfxPeakDbfs({ sfxId: 'hit_01', dialogueLufs: -14.4, attenuationDb: a }) - heard)
      .toBeCloseTo(SFX_TARGET_OFFSET_DB.hit, 6);
    expect(sfxPeakDbfs({ sfxId: 'whoosh_01', dialogueLufs: -14.4, attenuationDb: a }) - heard)
      .toBeCloseTo(SFX_TARGET_OFFSET_DB.whoosh, 6);
  });

  it('reports the offset as binding once the mix has room', () => {
    const a = dialogueAttenuationDb({ dialogueLufs: -14.4, dialoguePeakDbfs: 0 });
    const level = sfxLevel({
      sfxId: 'hit_01',
      filePeakDbfs: -0.72,
      dialogueLufs: -14.4,
      attenuationDb: a,
      dialoguePeakAtEventDbfs: -8.86 - a,
    });
    expect(level.binding).toBe('loudness-offset');
    expect(level.summedPeakDbfs).toBeLessThan(MIX_CEILING_DBFS);
  });

  it('the ceiling still wins where the voice is loud at that instant', () => {
    const level = sfxLevel({
      sfxId: 'hit_01',
      filePeakDbfs: -0.72,
      dialogueLufs: -14.4,
      attenuationDb: 3.8,
      dialoguePeakAtEventDbfs: -1.2,
    });
    expect(level.binding).toBe('headroom-ceiling');
    expect(level.summedPeakDbfs).toBeLessThanOrEqual(MIX_CEILING_DBFS + 1e-6);
  });

  it('raises the whooshes, which were inaudible at the dialogue’s own level', () => {
    expect(SFX_TARGET_OFFSET_DB.whoosh).toBeGreaterThan(0);
    expect(SFX_TARGET_OFFSET_DB.whoosh).toBeLessThan(SFX_TARGET_OFFSET_DB.hit);
  });

  it('gives whoosh_02 the same peak as whoosh_01 despite an 8 dB quieter file', () => {
    const args = { dialogueLufs: -14.4, attenuationDb: 3.8 } as const;
    const a = sfxGainDb({ ...args, sfxId: 'whoosh_01', filePeakDbfs: -1.23 });
    const b = sfxGainDb({ ...args, sfxId: 'whoosh_02', filePeakDbfs: -8.39 });
    expect(b - a).toBeCloseTo(7.16, 2);
  });
});
