/**
 * How loud a sound effect should be, relative to the reel's own dialogue.
 *
 * **The figures this replaces were absolute and had never been heard.** Block 5
 * chose −20 dB for hits and −24 dB for whooshes before any composition existed.
 * They are a level *below full scale*, which says nothing about the voice they
 * sit under: the same −20 dBFS is prominent beneath a quiet reel and inaudible
 * beneath a loud one. Every reel in this corpus is mastered at −13.9 to
 * −14.6 LUFS with a true peak at 0.0 dBFS, so a hit peaking at −20 dBFS sits
 * 5.6 dB under the *average* speech level and roughly 20 dB under its peaks.
 * The user built `vitasilk`, played it, and could not hear the hits at all.
 *
 * A target measured against the dialogue is right on both a quiet reel and a
 * loud one without anyone listening, which is the point: the output has to be
 * right without per-reel intervention.
 */
export type SfxKind = 'hit' | 'whoosh';

/**
 * Where each kind of sound should peak, in dB relative to the reel's
 * **integrated** dialogue loudness.
 *
 * **CHOSEN, NOT MEASURED**, and to be judged by ear on a built comp — the same
 * standing the −20/−24 figures had, except that these are anchored to something
 * measured rather than to nothing.
 *
 * A hit is a transient accent: its peak has to sit *above* the average speech
 * level to read as an accent at all, because a short transient is perceptually
 * far quieter than a continuous signal at the same peak. A whoosh is a bed
 * under a moving image rather than an accent, so it sits at the dialogue's own
 * level and reads as texture.
 *
 * Integrated loudness is the anchor rather than true peak: peak is where a reel
 * clips, loudness is what the ear averages, and these reels are all pinned at
 * 0.0 dBFS peak while differing in loudness.
 */
export const SFX_TARGET_OFFSET_DB: Record<SfxKind, number> = { hit: 6, whoosh: 0 };

/** A sound's kind, from its id. The manifest has never had another naming. */
export function sfxKindOf(id: string): SfxKind {
  return id.startsWith('hit') ? 'hit' : 'whoosh';
}

/**
 * The layer gain that puts this file's peak on its kind's target for this reel.
 *
 * `filePeakDbfs` is the file's own measured peak, so a file already 8 dB down
 * needs 8 dB less attenuation than one at full scale to arrive in the same
 * place — which is why the gain cannot be a constant per kind.
 */
export function sfxGainDb(options: {
  sfxId: string;
  filePeakDbfs: number;
  dialogueLufs: number;
}): number {
  const target = options.dialogueLufs + SFX_TARGET_OFFSET_DB[sfxKindOf(options.sfxId)];
  return Number((target - options.filePeakDbfs).toFixed(2));
}

/** Where the sound ends up, for reporting: its peak in dBFS on this reel. */
export function sfxPeakDbfs(options: { sfxId: string; dialogueLufs: number }): number {
  return Number(
    (options.dialogueLufs + SFX_TARGET_OFFSET_DB[sfxKindOf(options.sfxId)]).toFixed(2),
  );
}
