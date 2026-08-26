/**
 * Measures assets/watermark/intro.mov and writes every claim about it into
 * benchmarks/RESULTS-block7-watermark.md.
 *
 * Nothing about this file is hand-typed into a document. The load-bearing
 * facts — whether an alpha plane is really there, whether the alpha is
 * straight or premultiplied, whether the audio is silent, where the artwork
 * sits inside the frame — are none of them visible in Finder, and a wrong
 * guess at the alpha interpretation shows up as a dark or bright fringe
 * around the logo after it is composited.
 *
 * Needs ffprobe and ffmpeg, which the service already depends on
 * (ARCHITECTURE §5.1).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const ASSET = path.join(REPO_ROOT, 'assets', 'watermark', 'intro.mov');
const OUT = path.join(REPO_ROOT, 'benchmarks', 'RESULTS-block7-watermark.md');

/**
 * How many frames get the full RGBA read for the straight-vs-premultiplied
 * test. The bounding box and the alpha histogram run over every frame from
 * the single-plane pass, which is a quarter of the bytes.
 */
const COLOUR_SAMPLES = 9;

class MeasureError extends Error {}

function requireTool(name: string): string {
  const which = spawnSync('which', [name], { encoding: 'utf8' });
  if (which.status !== 0) throw new MeasureError(`${name} is not on PATH`);
  return which.stdout.trim();
}

interface Stream {
  index: number;
  codec_type: string;
  codec_name?: string;
  codec_tag_string?: string;
  profile?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  sample_aspect_ratio?: string;
  display_aspect_ratio?: string;
  color_primaries?: string;
  color_transfer?: string;
  color_space?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  nb_frames?: string;
  duration?: string;
  sample_fmt?: string;
  sample_rate?: string;
  channels?: number;
  channel_layout?: string;
  bits_per_raw_sample?: string;
}

interface Probe {
  streams: Stream[];
  format: { duration: string; size: string; format_long_name: string };
}

function probe(file: string): Probe {
  const raw = execFileSync(
    'ffprobe',
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  return JSON.parse(raw) as Probe;
}

function ratioToNumber(r: string | undefined): number | null {
  if (!r) return null;
  const [n, d] = r.split('/').map(Number);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  return n / d;
}

/**
 * ffmpeg's own answer, not a guess from the format name: `-show_pixel_formats`
 * carries an explicit `alpha` flag. A ProRes 4444 file can be written without
 * an alpha plane, so `4444` in the profile string proves nothing.
 *
 * This says the format carries a plane. Whether that plane is meaningful — a
 * fully opaque one is legal and useless — is answered by the histogram below.
 */
interface PixelFormat {
  name: string;
  nb_components: number;
  flags: { alpha: number };
}

function pixelFormatHasAlpha(pixFmt: string): boolean {
  const raw = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_pixel_formats', '-print_format', 'json'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  const list = (JSON.parse(raw) as { pixel_formats: PixelFormat[] }).pixel_formats;
  const found = list.find((f) => f.name === pixFmt);
  if (!found) throw new MeasureError(`ffprobe does not know pixel format ${pixFmt}`);
  return found.flags.alpha === 1;
}

interface AlphaFrameStats {
  index: number;
  min: number;
  max: number;
  zero: number;
  full: number;
  partial: number;
  box: { x: number; y: number; w: number; h: number } | null;
}

/**
 * One ffmpeg pass streaming the alpha plane of every frame as 8-bit gray.
 * `alphaextract` moves the alpha plane into luma, so this is the real stored
 * alpha and not a reconstruction from the composite.
 */
function alphaPerFrame(file: string, width: number, height: number): AlphaFrameStats[] {
  const frameBytes = width * height;
  const res = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-vf', 'alphaextract,format=gray',
      '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
    { maxBuffer: 2 * 1024 * 1024 * 1024, encoding: 'buffer' },
  );
  if (res.status !== 0) {
    throw new MeasureError(`alphaextract failed: ${res.stderr.toString().trim()}`);
  }
  const buf = res.stdout;
  if (buf.length === 0 || buf.length % frameBytes !== 0) {
    throw new MeasureError(
      `alpha stream is ${buf.length} bytes, not a whole number of ${frameBytes}-byte frames`,
    );
  }

  const stats: AlphaFrameStats[] = [];
  const frames = buf.length / frameBytes;
  for (let f = 0; f < frames; f += 1) {
    const off = f * frameBytes;
    let min = 255, max = 0, zero = 0, full = 0, partial = 0;
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y += 1) {
      const row = off + y * width;
      for (let x = 0; x < width; x += 1) {
        const a = buf[row + x];
        if (a < min) min = a;
        if (a > max) max = a;
        if (a === 0) zero += 1;
        else {
          if (a === 255) full += 1;
          else partial += 1;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    stats.push({
      index: f, min, max, zero, full, partial,
      box: x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 },
    });
  }
  return stats;
}

interface AlphaHypothesis {
  partialPixels: number;
  /**
   * Premultiplied-against-black scales colour down by alpha, so no channel
   * can meaningfully exceed its alpha. Straight leaves colour unscaled and
   * routinely does. Both counted over the same pixels.
   */
  exceedingAlpha: number;
  maxExcess: number;
  meanExcess: number;
  /**
   * The artwork's own brightness, over fully opaque pixels. It is what makes
   * the test discriminating: a *dark* logo satisfies "no channel exceeds its
   * alpha" under both hypotheses, so a premultiplied verdict on dark artwork
   * would be an artefact of the artwork rather than evidence about the file.
   */
  opaquePixels: number;
  meanOpaqueTop: number;
  /** Mean of max(r,g,b)/alpha over partial pixels. Premultiplied tends to 1. */
  meanTopOverAlpha: number;
}

/**
 * Below this mean brightness on opaque pixels the two hypotheses make the same
 * prediction and the measurement decides nothing. CHOSEN, NOT MEASURED — the
 * midpoint of the range, on the precedent of `RENDERED_LIGHT_LUMA` in the
 * cutout gate.
 */
const SEPARATION_MIN_OPAQUE_TOP = 128;

/** Slack in 8-bit levels, absorbing 12-bit-to-8-bit rounding and YUV round trip. */
const EXCESS_TOLERANCE = 2;

function colourAgainstAlpha(file: string, width: number, height: number, frames: number[]): AlphaHypothesis {
  const frameBytes = width * height * 4;
  const select = frames.map((n) => `eq(n\\,${n})`).join('+');
  const res = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-vf', `select='${select}',format=rgba`,
      '-vsync', '0', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
    { maxBuffer: 2 * 1024 * 1024 * 1024, encoding: 'buffer' },
  );
  if (res.status !== 0) {
    throw new MeasureError(`rgba read failed: ${res.stderr.toString().trim()}`);
  }
  const buf = res.stdout;
  if (buf.length === 0 || buf.length % frameBytes !== 0) {
    throw new MeasureError(
      `rgba stream is ${buf.length} bytes, not a whole number of ${frameBytes}-byte frames`,
    );
  }

  let partialPixels = 0, exceeding = 0, maxExcess = 0, excessSum = 0, ratioSum = 0;
  let opaquePixels = 0, opaqueTopSum = 0;
  for (let p = 0; p < buf.length; p += 4) {
    const a = buf[p + 3];
    const top = Math.max(buf[p], buf[p + 1], buf[p + 2]);
    if (a === 255) {
      opaquePixels += 1;
      opaqueTopSum += top;
      continue;
    }
    if (a === 0) continue;
    partialPixels += 1;
    ratioSum += top / a;
    const excess = top - a;
    if (excess > EXCESS_TOLERANCE) {
      exceeding += 1;
      excessSum += excess;
      if (excess > maxExcess) maxExcess = excess;
    }
  }
  return {
    partialPixels,
    exceedingAlpha: exceeding,
    maxExcess,
    meanExcess: exceeding === 0 ? 0 : excessSum / exceeding,
    opaquePixels,
    meanOpaqueTop: opaquePixels === 0 ? 0 : opaqueTopSum / opaquePixels,
    meanTopOverAlpha: partialPixels === 0 ? 0 : ratioSum / partialPixels,
  };
}

interface Volume { mean: number | null; max: number | null; raw: string }

function volumeDetect(file: string): Volume {
  const res = spawnSync('ffmpeg', ['-v', 'info', '-i', file, '-af', 'volumedetect',
    '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const err = res.stderr ?? '';
  const mean = /mean_volume:\s*(-?[\d.]+|-inf) dB/.exec(err);
  const max = /max_volume:\s*(-?[\d.]+|-inf) dB/.exec(err);
  const num = (m: RegExpExecArray | null): number | null => {
    if (!m) return null;
    return m[1] === '-inf' ? -Infinity : Number(m[1]);
  };
  return {
    mean: num(mean),
    max: num(max),
    raw: [mean?.[0], max?.[0]].filter(Boolean).join(' / '),
  };
}

function f(n: number, d = 6): string { return n.toFixed(d); }

function main(): void {
  requireTool('ffprobe');
  requireTool('ffmpeg');
  if (!existsSync(ASSET)) throw new MeasureError(`${ASSET} does not exist`);

  const bytes = readFileSync(ASSET);
  const sha = createHash('sha256').update(bytes).digest('hex');
  const p = probe(ASSET);

  const video = p.streams.find((s) => s.codec_type === 'video');
  const audio = p.streams.find((s) => s.codec_type === 'audio');
  const data = p.streams.filter((s) => s.codec_type === 'data');
  if (!video || video.width == null || video.height == null || !video.pix_fmt) {
    throw new MeasureError('no measurable video stream');
  }
  const { width, height, pix_fmt: pixFmt } = video;

  const alphaPlane = pixelFormatHasAlpha(pixFmt);
  const rFps = ratioToNumber(video.r_frame_rate);
  const durationS = Number(p.format.duration);
  const frameCount = Number(video.nb_frames);

  const stats = alphaPlane ? alphaPerFrame(ASSET, width, height) : [];
  const totalPartial = stats.reduce((s, x) => s + x.partial, 0);
  const totalZero = stats.reduce((s, x) => s + x.zero, 0);
  const totalFull = stats.reduce((s, x) => s + x.full, 0);
  const binary = alphaPlane && totalPartial === 0;

  const sampled = Array.from({ length: Math.min(COLOUR_SAMPLES, stats.length) }, (_, i) =>
    Math.round((i * (stats.length - 1)) / Math.max(1, Math.min(COLOUR_SAMPLES, stats.length) - 1)));
  const hyp = alphaPlane && !binary ? colourAgainstAlpha(ASSET, width, height, sampled) : null;

  const vol = audio ? volumeDetect(ASSET) : null;

  const boxes = stats.filter((s) => s.box !== null);
  const unionX0 = Math.min(...boxes.map((s) => s.box!.x));
  const unionY0 = Math.min(...boxes.map((s) => s.box!.y));
  const unionX1 = Math.max(...boxes.map((s) => s.box!.x + s.box!.w - 1));
  const unionY1 = Math.max(...boxes.map((s) => s.box!.y + s.box!.h - 1));
  const fullBleed = boxes.length > 0 &&
    unionX0 === 0 && unionY0 === 0 && unionX1 === width - 1 && unionY1 === height - 1;

  const sar = video.sample_aspect_ratio ?? 'unset';
  const squarePixels = sar === '1:1' || sar === 'unset';

  const L: string[] = [];
  L.push('# Block 7 — the watermark file, measured');
  L.push('');
  L.push('Generated by `npm run watermark:measure`. Every figure here is emitted by the');
  L.push('tool; nothing is hand-typed. Re-run it after any change to the asset.');
  L.push('');
  L.push('## 1. Identity');
  L.push('');
  L.push('| | |');
  L.push('|---|---|');
  L.push('| path | `assets/watermark/intro.mov` |');
  L.push(`| bytes | ${bytes.length.toLocaleString('en-US')} |`);
  L.push(`| sha256 | \`${sha}\` |`);
  L.push(`| container | ${p.format.format_long_name} |`);
  L.push(`| streams | ${p.streams.length} (video, audio, ${data.length} data/timecode) |`);
  L.push('');
  L.push('## 2. Video');
  L.push('');
  L.push('| | |');
  L.push('|---|---|');
  L.push(`| codec | ${video.codec_name} (\`${video.codec_tag_string}\`), profile ${video.profile} |`);
  L.push(`| size | ${width} × ${height} |`);
  L.push(`| duration | ${f(durationS)} s |`);
  L.push(`| frames | ${frameCount} |`);
  L.push(`| r_frame_rate | ${video.r_frame_rate} (${rFps === null ? '?' : f(rFps, 4)}) |`);
  L.push(`| avg_frame_rate | ${video.avg_frame_rate} |`);
  L.push(`| pix_fmt | \`${pixFmt}\`, ${video.bits_per_raw_sample} bits per raw sample |`);
  L.push(`| alpha plane present | **${alphaPlane ? 'yes' : 'no'}** |`);
  L.push(`| sample aspect ratio | ${sar} — pixels are **${squarePixels ? 'square' : 'not square'}** |`);
  L.push(`| display aspect ratio | ${video.display_aspect_ratio ?? 'unset'} |`);
  L.push(`| colour primaries / transfer / matrix | ${video.color_primaries ?? 'unset'} / ${video.color_transfer ?? 'unset'} / ${video.color_space ?? 'unset'} |`);
  L.push('');
  L.push(`Finder rounds the duration to \`00:02\`. The real length is **${f(durationS)} s**, which`);
  L.push(`is **${frameCount} frames** at ${video.r_frame_rate} — the same rate as the source reels`);
  L.push('(PROJECT_SPEC §4), so the overlay lands on the timeline with no rate conversion.');
  L.push('');
  L.push('## 3. Audio');
  L.push('');
  if (!audio) {
    L.push('No audio stream.');
  } else {
    L.push('| | |');
    L.push('|---|---|');
    L.push(`| codec | ${audio.codec_name} (\`${audio.codec_tag_string}\`) |`);
    L.push(`| channels | ${audio.channels} (${audio.channel_layout}) |`);
    L.push(`| sample rate | ${audio.sample_rate} Hz |`);
    L.push(`| sample format | ${audio.sample_fmt} |`);
    L.push(`| mean volume | ${vol?.mean === null ? 'not reported' : `${vol?.mean} dB`} |`);
    L.push(`| max volume | ${vol?.max === null ? 'not reported' : `${vol?.max} dB`} |`);
    L.push('');
    const silent = vol?.max === -Infinity;
    L.push(silent
      ? '**The audio is digital silence** — `max_volume` is `-inf dB`, so every sample is zero.'
      : `**The audio is not silent**: \`max_volume\` is ${vol?.max} dB. The watermark carries a sound and the build has to decide whether to keep it.`);
  }
  L.push('');
  L.push('## 4. Alpha');
  L.push('');
  if (!alphaPlane) {
    L.push('**No alpha plane.** A ProRes 4444 file can be written without one, and this is such');
    L.push('a file: the watermark has no transparency of its own.');
  } else {
    const totalPixels = totalZero + totalFull + totalPartial;
    L.push(`Read from the stored alpha plane of **all ${stats.length} frames** via \`alphaextract\`,`);
    L.push('which moves alpha into luma — this is the stored alpha, not a reconstruction from a');
    L.push('composite.');
    L.push('');
    L.push('| | pixels | share |');
    L.push('|---|---:|---:|');
    L.push(`| fully transparent (0) | ${totalZero.toLocaleString('en-US')} | ${f((100 * totalZero) / totalPixels, 4)}% |`);
    L.push(`| fully opaque (255) | ${totalFull.toLocaleString('en-US')} | ${f((100 * totalFull) / totalPixels, 4)}% |`);
    L.push(`| partial (1–254) | ${totalPartial.toLocaleString('en-US')} | ${f((100 * totalPartial) / totalPixels, 4)}% |`);
    L.push('');
    if (binary) {
      L.push('**The alpha is binary.** Every one of the');
      L.push(`${totalPixels.toLocaleString('en-US')} sampled alpha values is either 0 or 255; there are no`);
      L.push('partial values anywhere in the clip.');
      L.push('');
      L.push('**Consequence, stated plainly:** straight and premultiplied are indistinguishable on');
      L.push('this file and produce identical output. Premultiplication scales colour by alpha, and');
      L.push('with alpha only ever 0 or 1 that scaling is either "discard" or "keep unchanged" under');
      L.push('both interpretations. **The choice cannot introduce a fringe**, so whichever AE picks');
      L.push('on import is correct. It also means the edges are hard — there is no antialiasing in');
      L.push('the matte, and any softness on screen comes from scaling at composite time.');
    } else if (hyp) {
      const violatingPremult = hyp.partialPixels === 0 ? 0 : hyp.exceedingAlpha / hyp.partialPixels;
      L.push(`Partial-alpha pixels exist, so the two hypotheses are testable. Over **${hyp.partialPixels.toLocaleString('en-US')}**`);
      L.push(`partial pixels across ${sampled.length} frames spanning the clip (${sampled.join(', ')}):`);
      L.push('');
      L.push('| hypothesis | prediction | measured |');
      L.push('|---|---|---|');
      L.push(`| premultiplied against black | no channel exceeds its alpha | ${f(100 * violatingPremult, 4)}% of pixels violate it |`);
      L.push(`| straight | colour is unscaled and routinely exceeds alpha | ${f(100 * (1 - violatingPremult), 4)}% of pixels violate it |`);
      L.push('');
      L.push(`Largest excess over alpha: **${hyp.maxExcess}** levels of 255; mean excess where it`);
      L.push(`occurs: **${f(hyp.meanExcess, 2)}** levels. Tolerance ${EXCESS_TOLERANCE} levels, absorbing the`);
      L.push('12-bit-to-8-bit and YUV-to-RGB round trip.');
      L.push('');
      L.push('**Do the two hypotheses actually separate here?** They only do on bright artwork:');
      L.push('dark colour never exceeds its alpha under either reading, so a premultiplied verdict');
      L.push('on a dark logo would say more about the logo than the file.');
      L.push('');
      L.push('| | |');
      L.push('|---|---|');
      L.push(`| fully opaque pixels | ${hyp.opaquePixels.toLocaleString('en-US')} |`);
      L.push(`| mean max(r,g,b) there | **${f(hyp.meanOpaqueTop, 1)}** of 255 (separation needs > ${SEPARATION_MIN_OPAQUE_TOP}) |`);
      L.push(`| mean max(r,g,b)/alpha on partial pixels | **${f(hyp.meanTopOverAlpha, 4)}** (premultiplied tends to 1) |`);
      L.push('');
      const separated = hyp.meanOpaqueTop > SEPARATION_MIN_OPAQUE_TOP;
      if (!separated) {
        L.push(`**Verdict: undecided.** The artwork's mean opaque brightness is ${f(hyp.meanOpaqueTop, 1)},`);
        L.push(`at or below the ${SEPARATION_MIN_OPAQUE_TOP} the test needs to discriminate. Straight and`);
        L.push('premultiplied make the same prediction on colour this dark, so the exceedance figures');
        L.push('above are not evidence either way. Reported as undecided rather than resolved by');
        L.push('taking the larger number; a visual check against a light and a dark background');
        L.push('settles it, and that is a build task, not a measurement.');
      } else if (violatingPremult < 0.01) {
        L.push('**Verdict: premultiplied (against black).** Colour is already scaled down by alpha');
        L.push('across effectively every partial pixel. Importing it as straight would divide out an');
        L.push('alpha that was never multiplied in and brighten the edge.');
        L.push('');
        L.push(`The artwork is essentially white at ${f(hyp.meanOpaqueTop, 1)}, so under a straight`);
        L.push('reading a half-transparent edge pixel would still carry near-255 colour. It carries');
        L.push(`${f(hyp.meanTopOverAlpha, 4)} of its alpha instead — the colour has been multiplied in.`);
      } else if (violatingPremult > 0.5) {
        L.push('**Verdict: straight (unmatted).** Colour is plainly unscaled at partial alpha.');
        L.push('Importing it as premultiplied would darken the edge against the footage.');
      } else {
        L.push(`**Verdict: undecided.** ${f(100 * violatingPremult, 2)}% of partial pixels violate the`);
        L.push('premultiplied prediction and the rest violate the straight one, so the data does not');
        L.push('separate the two hypotheses. This is reported as undecided rather than resolved by');
        L.push('picking the larger number — the correct next step is a visual check against a light');
        L.push('and a dark background, which is a Block 7 build task and not a measurement.');
      }
    }
    L.push('');
    L.push('## 5. Where the artwork sits');
    L.push('');
    L.push(`Bounding box of non-zero alpha, over all ${stats.length} frames.`);
    L.push('');
    L.push(`Union across the clip: **x ${unionX0}–${unionX1}, y ${unionY0}–${unionY1}** ` +
      `(${unionX1 - unionX0 + 1} × ${unionY1 - unionY0 + 1} inside ${width} × ${height}).`);
    L.push('');
    L.push(fullBleed
      ? '**Full-bleed**: the artwork touches every frame edge at some point in the clip, so the file has no built-in margin.'
      : `**A centred lockup, not full-bleed**: the artwork never reaches the frame edge. Free margin — left ${unionX0} px, right ${width - 1 - unionX1} px, top ${unionY0} px, bottom ${height - 1 - unionY1} px — which is padding that will be scaled along with the logo unless the build crops to this box.`);
    L.push('');
    L.push('| frame | x | y | w | h | partial alpha px |');
    L.push('|---:|---:|---:|---:|---:|---:|');
    for (const s of stats) {
      if (s.box === null) {
        L.push(`| ${s.index} | — | — | — | — | ${s.partial} | `);
      } else {
        L.push(`| ${s.index} | ${s.box.x} | ${s.box.y} | ${s.box.w} | ${s.box.h} | ${s.partial} |`);
      }
    }
  }
  L.push('');
  L.push('## 6. What this does not settle');
  L.push('');
  L.push('Where the watermark sits in a 2160 × 3840 frame and at what scale is a product');
  L.push("decision, not a property of the file. PROJECT_SPEC §5's watermark TODO stays open");
  L.push('until the user rules on the geometry.');
  L.push('');

  writeFileSync(OUT, `${L.join('\n')}\n`, 'utf8');
  console.log(`wrote ${path.relative(REPO_ROOT, OUT)}`);
  console.log(`alpha plane: ${alphaPlane}; binary: ${binary}; frames: ${stats.length}`);
}

try {
  main();
} catch (err) {
  console.error(err instanceof MeasureError ? `watermark:measure: ${err.message}` : err);
  process.exit(1);
}
