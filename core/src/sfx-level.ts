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
 *
 * **The offsets alone were not enough, and the reason is measurable.** Set at
 * hits +6 dB, the hits clipped: every reel in this corpus is delivered with a
 * true peak at 0.0–0.2 dBFS, so at the instants the voice touches full scale
 * there is **no gain at all** at which a second sound can be added without the
 * sum passing 0 dBFS. That is arithmetic, not taste — see
 * `dialogueAttenuationDb`. The balance the offsets describe is kept; the room
 * for it is made by lowering the whole mix.
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
export const SFX_TARGET_OFFSET_DB: Record<SfxKind, number> = { hit: 6, whoosh: 3 };

/**
 * The loudest the finished mix may peak.
 *
 * **CHOSEN, NOT MEASURED**, −1.0 dBFS. Below full scale so that inter-sample
 * peaks and any later encode have somewhere to go, and only just, because every
 * decibel here is a decibel the whole reel is quieter.
 */
export const MIX_CEILING_DBFS = -1;

/**
 * Two peaks added at their worst case: in phase, so the amplitudes sum.
 *
 * Real speech and a sound effect almost never align this way, so a mix built to
 * this bound has more room than the number suggests. That is the right
 * direction for a bound whose job is to stop the sum squaring off.
 */
export function summedPeakDbfs(a: number, b: number): number {
  return 20 * Math.log10(10 ** (a / 20) + 10 ** (b / 20));
}

/**
 * How far the reel's own audio is turned down so the sound effects fit.
 *
 * **Derived, not chosen** — the only chosen inputs are the ceiling and the
 * offsets. The dialogue's peak and the sfx target both move with the
 * attenuation, so the summed peak moves with it one for one, and the smallest
 * attenuation that satisfies the ceiling is just how far the un-attenuated sum
 * overshoots it.
 *
 * It is computed against the **loudest kind of sound bound to anything**, so
 * one figure covers the reel and the balance between the kinds is untouched:
 * everything, voice included, comes down together.
 *
 * Never negative. A reel already delivered with headroom is left alone rather
 * than boosted — a build is for review, and inventing level is not this
 * function's business.
 */
export function dialogueAttenuationDb(options: {
  dialogueLufs: number;
  dialoguePeakDbfs: number;
  ceilingDbfs?: number;
  /**
   * The loudest offset a sound on this reel will actually use. Defaults to the
   * loudest of all kinds, which is right when every kind is in play and
   * over-attenuates by the difference when one is not — hits have been unbound
   * since Block 8 session 27, so the whoosh is the loudest thing in the mix.
   */
  loudestOffsetDb?: number;
}): number {
  const ceiling = options.ceilingDbfs ?? MIX_CEILING_DBFS;
  const loudestOffset =
    options.loudestOffsetDb ?? Math.max(...Object.values(SFX_TARGET_OFFSET_DB));
  const summed = summedPeakDbfs(
    options.dialoguePeakDbfs,
    options.dialogueLufs + loudestOffset,
  );
  return Number(Math.max(0, summed - ceiling).toFixed(2));
}

/**
 * The loudest offset among the kinds any template actually binds.
 *
 * The attenuation exists to keep the loudest sound under the ceiling, so a kind
 * bound to nothing must not set it: with the hits unbound, computing against
 * their +6 would take the whole reel down 0.7 dB further than anything in it
 * needs. A template set that binds nothing at all returns the quietest offset,
 * because there is nothing to make room for.
 */
export function loudestBoundOffsetDb(
  templates: Map<string, { sfx: { sfxId: string }[] }>,
): number {
  const offsets = [...templates.values()]
    .flatMap((t) => t.sfx)
    .map((b) => SFX_TARGET_OFFSET_DB[sfxKindOf(b.sfxId)]);
  return offsets.length === 0
    ? Math.min(...Object.values(SFX_TARGET_OFFSET_DB))
    : Math.max(...offsets);
}

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
  /** How far the reel's own audio is turned down; see `dialogueAttenuationDb`. */
  attenuationDb?: number;
}): number {
  const target = sfxPeakDbfs(options);
  return Number((target - options.filePeakDbfs).toFixed(2));
}

/**
 * Where the sound ends up: its peak in dBFS on this reel, after the attenuation
 * the whole mix takes.
 *
 * The offset is applied to the dialogue's loudness **as it will be heard**, so
 * the balance between voice and effect is exactly what the offset says whatever
 * the attenuation turns out to be.
 */
export function sfxPeakDbfs(options: {
  sfxId: string;
  dialogueLufs: number;
  attenuationDb?: number;
}): number {
  const heard = options.dialogueLufs - (options.attenuationDb ?? 0);
  return Number((heard + SFX_TARGET_OFFSET_DB[sfxKindOf(options.sfxId)]).toFixed(2));
}

/** Which rule decided an event's level, so the two cannot silently disagree. */
export type SfxBinding = 'loudness-offset' | 'headroom-ceiling';

export interface SfxLevel {
  gainDb: number;
  /** The sound's own peak on the timeline. */
  peakDbfs: number;
  /** Worst case against the dialogue's peak at that instant. */
  summedPeakDbfs: number;
  binding: SfxBinding;
}

/**
 * One event's level, and which of the two rules decided it.
 *
 * The offset sets the level; the ceiling is a bound it must not cross. With the
 * mix attenuated the offset is expected to bind everywhere, and an event
 * reporting `headroom-ceiling` means the dialogue is louder at that instant than
 * the reel-wide figures predicted — worth seeing rather than absorbing.
 */
export function sfxLevel(options: {
  sfxId: string;
  filePeakDbfs: number;
  dialogueLufs: number;
  attenuationDb: number;
  /** The dialogue's own peak where this sound lands, already attenuated. */
  dialoguePeakAtEventDbfs: number;
  ceilingDbfs?: number;
}): SfxLevel {
  const ceiling = options.ceilingDbfs ?? MIX_CEILING_DBFS;
  const wanted = sfxPeakDbfs(options);
  const room = 10 ** (ceiling / 20) - 10 ** (options.dialoguePeakAtEventDbfs / 20);
  // No room at all: the voice alone is already at the ceiling there.
  const allowed = room <= 0 ? Number.NEGATIVE_INFINITY : 20 * Math.log10(room);
  const peak = Math.min(wanted, allowed);
  return {
    gainDb: Number((peak - options.filePeakDbfs).toFixed(2)),
    peakDbfs: Number(peak.toFixed(2)),
    summedPeakDbfs: Number(
      summedPeakDbfs(options.dialoguePeakAtEventDbfs, peak).toFixed(2),
    ),
    binding: peak < wanted - 1e-9 ? 'headroom-ceiling' : 'loudness-offset',
  };
}
