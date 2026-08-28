import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, resolveFfmpegPath } from '@framopia/core';

/**
 * Measures every SFX file and writes what it found into the manifest.
 *
 * **Why this exists.** SFX placement assumed a sound's impact is at its first
 * sample, and nothing had ever measured where the loudest point in any of these
 * files actually is. `hit_01` is an mp3, which is padded at the head by
 * construction, so every hit in every build could be landing late by a fixed
 * amount — consistently, invisibly, on every reel.
 *
 * Everything here is read from the audio. Nothing is estimated, and the numbers
 * are written by this tool rather than typed into the manifest by hand:
 * guidelines §3, anything asserting a verified property is emitted by the thing
 * that verifies it. `npm run watermark:measure` is the precedent.
 *
 * $0.00 and local: ffmpeg and ffprobe, at the path session 16's resolver
 * returns — never a bare name on `PATH`, which a Finder-launched After Effects
 * does not inherit.
 */
const SFX_DIR = path.join(REPO_ROOT, 'assets', 'sfx');
const MANIFEST = path.join(SFX_DIR, 'sfx.json');

/** The project's frame rate, and the grid every event is snapped to. */
export const FPS = 30000 / 1001;

/** Below this a sample is silence for the purpose of "when does it start". */
export const SILENCE_DBFS = -60;

const ffmpeg = resolveFfmpegPath('ffmpeg');
const ffprobe = resolveFfmpegPath('ffprobe');

interface ProbeStream {
  codec_name?: string;
  sample_rate?: string;
  channels?: number;
  start_time?: string;
  duration?: string;
}

function probe(file: string): {
  stream: ProbeStream;
  container: string;
  formatDurationS: number;
  formatStartS: number;
} {
  const raw = execFileSync(
    ffprobe.path,
    ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file],
    { encoding: 'utf8', maxBuffer: 1 << 24 },
  );
  const parsed = JSON.parse(raw) as {
    streams?: ProbeStream[];
    format?: { duration?: string; start_time?: string; format_name?: string };
  };
  const stream = parsed.streams?.[0];
  if (stream === undefined) throw new Error(`${file}: ffprobe found no stream`);
  return {
    stream,
    container: parsed.format?.format_name ?? 'unknown',
    formatDurationS: Number(parsed.format?.duration ?? NaN),
    formatStartS: Number(parsed.format?.start_time ?? 0),
  };
}

/**
 * Decodes to mono 16-bit PCM and scans every sample.
 *
 * Sample-accurate on purpose: `astats` reports a peak level but not where it
 * is, and the whole question here is *where*. The decode rate is the file's own
 * so no resampling moves the transient.
 */
function scan(file: string, sampleRate: number): {
  peakIndex: number;
  peakAbs: number;
  firstAudibleIndex: number | null;
  samples: number;
  /** Mean square energy per tenth of the file, for the shape question. */
  energyProfile: number[];
} {
  const pcm = execFileSync(
    ffmpeg.path,
    ['-v', 'error', '-i', file, '-map', '0:a:0', '-f', 's16le', '-acodec', 'pcm_s16le',
     '-ac', '1', '-ar', String(sampleRate), '-'],
    { maxBuffer: 1 << 28 },
  );
  const total = Math.floor(pcm.length / 2);
  const silenceFloor = 32768 * 10 ** (SILENCE_DBFS / 20);

  let peakIndex = 0;
  let peakAbs = 0;
  let firstAudibleIndex: number | null = null;
  const buckets = 10;
  const energy = new Array<number>(buckets).fill(0);
  const counts = new Array<number>(buckets).fill(0);

  for (let i = 0; i < total; i += 1) {
    const sample = pcm.readInt16LE(i * 2);
    const magnitude = Math.abs(sample);
    if (magnitude > peakAbs) {
      peakAbs = magnitude;
      peakIndex = i;
    }
    if (firstAudibleIndex === null && magnitude >= silenceFloor) firstAudibleIndex = i;
    const bucket = Math.min(buckets - 1, Math.floor((i / total) * buckets));
    energy[bucket] = (energy[bucket] as number) + magnitude * magnitude;
    counts[bucket] = (counts[bucket] as number) + 1;
  }

  return {
    peakIndex,
    peakAbs,
    firstAudibleIndex,
    samples: total,
    energyProfile: energy.map((e, i) => Math.sqrt(e / Math.max(1, counts[i] as number)) / 32768),
  };
}

export interface SfxMeasurement {
  file: string;
  /** The codec the samples are in, e.g. `mp3` or `pcm_s24le`. */
  codec: string;
  /** The container ffprobe demuxed, e.g. `wav` or `mp3`. */
  container: string;
  sampleRate: number;
  channels: number;
  durationS: number;
  durationFrames: number;
  /** Where the loudest sample is, from the first sample of the decoded stream. */
  peakOffsetS: number;
  peakOffsetFrames: number;
  peakDbfs: number;
  /**
   * Container/codec delay reported by the demuxer, separate from silence the
   * sound itself begins with. An mp3's padding is not the same fact as a sound
   * that starts quietly, and adding them together would put the error back.
   */
  encoderDelayS: number;
  /** First sample above the silence floor, which is a property of the sound. */
  firstAudibleS: number | null;
  /** Where the energy sits: `head`, `middle` or `tail` of the file. */
  shape: 'head' | 'middle' | 'tail';
  /** The peak's position as a fraction of the duration. */
  peakFraction: number;
  /**
   * Which point in the file lands on the template's impact frame.
   *
   * A dry percussive hit is anchored on its first attack; a riser that sweeps
   * into a slam is anchored on its peak. **Derived from the measured shape** —
   * energy in the head means the attack is the event, energy later means the
   * peak is — and `anchorSource` says whether it was derived or set by hand, so
   * a deliberate choice is never mistaken for a default.
   */
  anchor: 'peak' | 'onset';
  anchorSource: 'derived' | 'declared';
  /** Where the anchor sits in the file, in seconds and frames. */
  anchorOffsetS: number;
  anchorOffsetFrames: number;
  /**
   * The gain that puts this file at its kind's target level, compensating its
   * own measured peak. A flat figure per kind cannot do that: `whoosh_02`
   * peaks 7 dB below `whoosh_01`, so the same −24 dB leaves them 7 dB apart.
   */
  gainDb: number;
  /** The level a sound of this kind is aimed at, before compensation. */
  targetDbfs: number;
  measuredAt: string;
  measuredWith: string;
}

/**
 * What each kind of sound is aimed at, from the user's ruling: hits at −20 dB
 * below full scale, whooshes at −24 dB. His figures, unchanged — what changes
 * is that they are now reached rather than applied.
 */
export const TARGET_DBFS: Record<string, number> = { hit: -20, whoosh: -24 };

/** A file's kind, from its id. The manifest has never had another naming. */
export function kindOf(id: string): string {
  return id.startsWith('hit') ? 'hit' : 'whoosh';
}

function shapeOf(profile: number[]): 'head' | 'middle' | 'tail' {
  const third = Math.floor(profile.length / 3);
  const sum = (from: number, to: number): number =>
    profile.slice(from, to).reduce((a, b) => a + b, 0);
  const head = sum(0, third);
  const middle = sum(third, third * 2);
  const tail = sum(third * 2, profile.length);
  if (head >= middle && head >= tail) return 'head';
  if (tail >= middle && tail >= head) return 'tail';
  return 'middle';
}

export function measureFile(file: string, id: string, declaredAnchor?: 'peak' | 'onset'): SfxMeasurement {
  const { stream, container, formatDurationS, formatStartS } = probe(file);
  const sampleRate = Number(stream.sample_rate ?? 48000);
  const scanned = scan(file, sampleRate);
  const durationS = Number.isFinite(formatDurationS)
    ? formatDurationS
    : scanned.samples / sampleRate;
  const peakOffsetS = scanned.peakIndex / sampleRate;

  const shape = shapeOf(scanned.energyProfile);
  /*
   * Energy in the head means the attack is the event, so the first audible
   * sample is what has to land. Energy later means the file rises into its
   * moment and the peak is what has to land.
   */
  const anchor = declaredAnchor ?? (shape === 'head' ? 'onset' : 'peak');
  const firstAudibleS =
    scanned.firstAudibleIndex === null ? null : scanned.firstAudibleIndex / sampleRate;
  const anchorOffsetS = anchor === 'onset' ? (firstAudibleS ?? peakOffsetS) : peakOffsetS;

  const peakDbfs =
    scanned.peakAbs === 0 ? -Infinity : 20 * Math.log10(scanned.peakAbs / 32768);
  const targetDbfs = TARGET_DBFS[kindOf(id)] ?? -20;
  /*
   * The gain that lands this file's peak on the target. A file already 8 dB
   * down needs 8 dB less attenuation to arrive at the same place as one at full
   * scale — which is the whole point of deriving it rather than typing it.
   */
  const gainDb = targetDbfs - peakDbfs;

  return {
    file: path.basename(file),
    codec: stream.codec_name ?? 'unknown',
    container,
    sampleRate,
    channels: stream.channels ?? 0,
    durationS: Number(durationS.toFixed(6)),
    durationFrames: Number((durationS * FPS).toFixed(3)),
    peakOffsetS: Number(peakOffsetS.toFixed(6)),
    peakOffsetFrames: Number((peakOffsetS * FPS).toFixed(3)),
    peakDbfs: Number(peakDbfs.toFixed(2)),
    encoderDelayS: Number(formatStartS.toFixed(6)),
    firstAudibleS: firstAudibleS === null ? null : Number(firstAudibleS.toFixed(6)),
    shape,
    peakFraction: Number((peakOffsetS / durationS).toFixed(4)),
    anchor,
    anchorSource: declaredAnchor === undefined ? 'derived' : 'declared',
    anchorOffsetS: Number(anchorOffsetS.toFixed(6)),
    anchorOffsetFrames: Number((anchorOffsetS * FPS).toFixed(3)),
    gainDb: Number(gainDb.toFixed(2)),
    targetDbfs,
    measuredAt: new Date().toISOString(),
    measuredWith: `${path.basename(ffmpeg.path)} (${ffmpeg.source})`,
  };
}

interface SfxEntry {
  id: string;
  file: string;
  defaultGainDb: number;
  notes?: string;
  /** Set by hand to override the shape-derived anchor. */
  anchor?: 'peak' | 'onset';
  measured?: SfxMeasurement;
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
  sfx: SfxEntry[];
  [key: string]: unknown;
};

const rows: (SfxMeasurement & { id: string; declared: string })[] = [];
for (const entry of manifest.sfx) {
  const file = path.join(SFX_DIR, entry.file);
  const measurement = measureFile(file, entry.id, entry.anchor);
  entry.measured = measurement;
  rows.push({ ...measurement, id: entry.id, declared: entry.file });
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const pad = (s: string | number, n: number): string => String(s).padStart(n);
console.log(
  `${'id'.padEnd(11)}${'codec'.padEnd(11)}${pad('dur s', 8)}${pad('peak s', 9)}${pad('peak f', 8)}` +
    `${pad('dBFS', 8)}${pad('delay s', 9)}${pad('audible s', 11)}${'  shape'}`,
);
for (const row of rows) {
  console.log(
    `${row.id.padEnd(11)}${row.codec.padEnd(11)}` +
      `${pad(row.durationS.toFixed(3), 8)}` +
      `${pad(row.peakOffsetS.toFixed(4), 9)}${pad(row.peakOffsetFrames.toFixed(2), 8)}` +
      `${pad(row.peakDbfs.toFixed(2), 8)}${pad(row.encoderDelayS.toFixed(6), 9)}` +
      `${pad(row.firstAudibleS === null ? 'silent' : row.firstAudibleS.toFixed(4), 11)}` +
      `  ${row.shape}`,
  );
}

console.log('');
console.log(
  `${'id'.padEnd(11)}${'anchor'.padEnd(9)}${'from'.padEnd(10)}${pad('at s', 9)}${pad('at f', 8)}` +
    `${pad('target', 8)}${pad('gain dB', 9)}${pad('was', 7)}${pad('moves', 8)}`,
);
for (const row of rows) {
  const was = manifest.sfx.find((e) => e.id === row.id)?.defaultGainDb ?? 0;
  console.log(
    `${row.id.padEnd(11)}${row.anchor.padEnd(9)}${row.anchorSource.padEnd(10)}` +
      `${pad(row.anchorOffsetS.toFixed(4), 9)}${pad(row.anchorOffsetFrames.toFixed(2), 8)}` +
      `${pad(row.targetDbfs, 8)}${pad(row.gainDb.toFixed(2), 9)}${pad(was, 7)}` +
      `${pad((row.gainDb - was).toFixed(2), 8)}`,
  );
}

/*
 * The extension names the container, not the codec: 24-bit PCM inside a `.wav`
 * is a wav, and reporting that as a mismatch would be a false alarm. What is
 * worth reporting is a file whose container is not what its name claims.
 */
const mismatched = rows.filter(
  (r) => !r.container.split(',').some((c) => r.declared.toLowerCase().endsWith(`.${c}`)),
);
console.log('');
for (const row of mismatched) {
  console.log(
    `container mismatch: ${row.id} is named ${row.declared} and demuxes as ${row.container}`,
  );
}
if (mismatched.length === 0) {
  console.log('every file is the container its name claims');
}
console.log(`\nwritten into ${path.relative(REPO_ROOT, MANIFEST)}. $0.00 — local measurement.`);
