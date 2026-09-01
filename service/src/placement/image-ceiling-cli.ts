import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { readEditPlan } from '../editplan/io.js';
import type { EditPlan, ImageSlot, Zone } from '../editplan/types.js';
import {
  BOTTOM_EXCLUSION,
  CARD_EDGE_CLEARANCE,
  COMP_SIDE_PX,
  FILL_FRACTION,
  FRAME_ASPECT,
  FRAME_WIDTH,
  HEAD_CLEARANCE,
  SCALE_JITTER,
  SUBTITLE_BAND,
} from './constants.js';
import { inset, largestSquare } from './geometry.js';
import { footprintOf } from './solve.js';
import { reelMasksDir } from '../frames/segment.js';

/**
 * What each placement constraint is *worth*, one relaxation at a time.
 *
 * Session 7 established that the head binds every slot; the user has said a
 * rule is stricter than it needs to be. This says which one, with a number.
 *
 * **Read-only.** Nothing is changed and no constant is moved: every relaxation
 * is computed from the same stored zones and masks.
 */
const FOOTAGE_DIR = path.join(REPO_ROOT, 'my files', 'test videos');
const OUT_PATH = path.join(REPO_ROOT, 'benchmarks', 'RESULTS-block7-image-ceiling.md');
const PY = path.join(REPO_ROOT, 'tools', 'cv', '.venv', 'bin', 'python');
const HEAD_BOXES = path.join(REPO_ROOT, 'tools', 'cv', 'head_boxes.py');

interface Rect { x: number; y: number; w: number; h: number }
interface MaskFrame { index: string; box: [number, number, number, number] | null }

function maskBoxes(reel: string, kind: 'head' | 'face'): MaskFrame[] | null {
  const dir = reelMasksDir(reel);
  if (!existsSync(dir) || !existsSync(PY)) return null;
  const raw = execFileSync(PY, [HEAD_BOXES, dir, kind], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return (JSON.parse(raw) as { frames: MaskFrame[] }).frames;
}

const STEP = 1 / 216;
function largestSquareAvoiding(blocked: Rect[]): { side: number; rect: Rect } {
  let best = { side: 0, rect: { x: 0, y: 0, w: 0, h: 0 } };
  for (let x = 0; x < 1; x += STEP) {
    for (let y = 0; y < 1; y += STEP) {
      let lo = 0;
      let hi = Math.min(1 - x, (1 - y) * FRAME_ASPECT);
      for (let i = 0; i < 18; i += 1) {
        const mid = (lo + hi) / 2;
        const cand: Rect = { x, y, w: mid, h: mid / FRAME_ASPECT };
        const hits = blocked.some(
          (b) => cand.x < b.x + b.w && b.x < cand.x + cand.w && cand.y < b.y + b.h && b.y < cand.y + cand.h,
        );
        if (hits) hi = mid;
        else lo = mid;
      }
      if (lo > best.side) best = { side: lo, rect: { x, y, w: lo, h: lo / FRAME_ASPECT } };
    }
  }
  return best;
}

const f0 = (v: number): string => v.toFixed(0);
const f3 = (v: number): string => v.toFixed(3);

interface Row { reel: string; slotId: string; label: string; px: number; binds: string; rect?: Rect }
const rows: Row[] = [];

for (const reel of ['vitasilk', 'test 1']) {
  const planPath = path.join(FOOTAGE_DIR, `${reel}.editplan.json`);
  if (!existsSync(planPath)) continue;
  const plan: EditPlan = await readEditPlan(planPath);
  const zones = new Map(plan.zones.zones.map((z: Zone) => [z.id, z]));
  const sampleFps = plan.zones.sampleFps || 2;
  const heads = maskBoxes(reel, 'head');
  const faces = maskBoxes(reel, 'face');

  const spanBox = (frames: MaskFrame[] | null, slot: ImageSlot, clearance: number): Rect | null => {
    if (frames === null) return null;
    const boxes = frames
      .filter((h) => {
        const t = Number(h.index) / sampleFps;
        return h.box !== null && t >= slot.start - 1 / sampleFps && t <= slot.end + 1 / sampleFps;
      })
      .map((h) => h.box as [number, number, number, number]);
    if (boxes.length === 0) return null;
    const x0 = Math.min(...boxes.map((b) => b[0])) - clearance;
    const y0 = Math.min(...boxes.map((b) => b[1])) - clearance * FRAME_ASPECT;
    const x1 = Math.max(...boxes.map((b) => b[2])) + clearance;
    const y1 = Math.max(...boxes.map((b) => b[3])) + clearance * FRAME_ASPECT;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };

  const bands: Rect[] = [
    { x: 0, y: SUBTITLE_BAND.y, w: 1, h: 1 - SUBTITLE_BAND.y },
    { x: 0, y: 1 - BOTTOM_EXCLUSION, w: 1, h: BOTTOM_EXCLUSION },
  ];

  for (const slot of plan.images.slots as ImageSlot[]) {
    const zone = slot.zoneId === null ? undefined : zones.get(slot.zoneId);
    const presentation = footprintOf(slot);
    const clearanceNow = presentation === 'card' ? CARD_EDGE_CLEARANCE : 0;

    const zoneCeiling = (clearance: number, fill: number): number => {
      if (zone === undefined) return 0;
      const region = inset(zone.rect, clearance);
      if (region.w <= 0 || region.h <= 0) return 0;
      return largestSquare(region) * fill * FRAME_WIDTH;
    };

    const push = (label: string, px: number, binds: string, rect?: Rect): void => {
      rows.push({ reel, slotId: slot.id, label, px, binds, rect });
    };

    push('baseline (as built)', (slot.scale ?? 0) * COMP_SIDE_PX, 'the zone rectangle');
    push('FILL_FRACTION 1.00', zoneCeiling(clearanceNow, 1), 'the zone rectangle');
    push('CARD_EDGE_CLEARANCE 0.01', zoneCeiling(0.01, FILL_FRACTION), 'the zone rectangle');
    push('CARD_EDGE_CLEARANCE 0', zoneCeiling(0, FILL_FRACTION), 'the zone rectangle');
    // Jitter varies the side either side of FILL_FRACTION; removing it does not
    // move the ceiling, it removes the downside of the draw.
    push('SCALE_JITTER 0', zoneCeiling(clearanceNow, FILL_FRACTION), `the zone rectangle (was ±${f3(SCALE_JITTER)})`);

    const headZero = spanBox(heads, slot, 0);
    const faceNow = spanBox(faces, slot, HEAD_CLEARANCE);

    const noZone = (block: Rect | null): { px: number; binds: string; rect: Rect } => {
      const blocked = block === null ? bands : [block, ...bands];
      const best = largestSquareAvoiding(blocked);
      const eps = 2 / FRAME_WIDTH;
      let binds = 'the frame edge';
      if (block !== null && Math.abs(best.rect.x + best.rect.w - block.x) < eps) binds = 'the mask, to its left';
      else if (block !== null && Math.abs(best.rect.x - (block.x + block.w)) < eps) binds = 'the mask, to its right';
      else if (block !== null && Math.abs(best.rect.y + best.rect.h - block.y) < eps) binds = 'the mask, above it';
      else if (Math.abs(best.rect.y + best.rect.h - SUBTITLE_BAND.y) < eps) binds = 'the subtitle band';
      return { px: best.side * FRAME_WIDTH, binds, rect: best.rect };
    };

    const hZero = noZone(headZero);
    push('HEAD_CLEARANCE 0 (no zone)', hZero.px, hZero.binds, hZero.rect);
    const fNow = noZone(faceNow);
    push('hair is not head (no zone)', fNow.px, fNow.binds, fNow.rect);
    const all = noZone(spanBox(faces, slot, 0));
    push('all of the above', all.px, all.binds, all.rect);
  }
}

const labels = [...new Set(rows.map((r) => r.label))];
const L: string[] = [];
L.push('# Block 7 — what each image constraint is worth');
L.push('');
L.push('Generated by `npm run image-ceiling`. **Read-only**: no constant was changed and no');
L.push('placement was written. Each row relaxes one thing and holds everything else at today\'s');
L.push('value; the last row relaxes all of them.');
L.push('');
L.push('The first five rows keep the **zone rectangle**, which is how a placement is made today.');
L.push('The last three drop it — it was a conservative device for finding free space, never a');
L.push('product rule — and bound the square by the mask, the subtitle band, the bottom exclusion');
L.push('and the frame instead.');
L.push('');
for (const reel of [...new Set(rows.map((r) => r.reel))]) {
  const slots = [...new Set(rows.filter((r) => r.reel === reel).map((r) => r.slotId))];
  L.push(`## ${reel}`);
  L.push('');
  L.push(`| relaxation | ${slots.join(' | ')} | binds after |`);
  L.push(`|---|${slots.map(() => '---:').join('|')}|---|`);
  for (const label of labels) {
    const cells = slots.map((s) => {
      const r = rows.find((x) => x.reel === reel && x.slotId === s && x.label === label);
      return r === undefined ? '—' : `${f0(r.px)} px`;
    });
    const binds = rows.find((x) => x.reel === reel && x.label === label)?.binds ?? '';
    L.push(`| ${label} | ${cells.join(' | ')} | ${binds} |`);
  }
  L.push('');
}
L.push('## Ranked: what each relaxation buys');
L.push('');
L.push('Against the baseline, pooled over all nine slots.');
L.push('');
const baseline = new Map(rows.filter((r) => r.label === labels[0]).map((r) => [`${r.reel}|${r.slotId}`, r.px]));
const ranked = labels.slice(1).map((label) => {
  const gains = rows
    .filter((r) => r.label === label)
    .map((r) => r.px / Math.max(baseline.get(`${r.reel}|${r.slotId}`) ?? 1, 1e-9));
  const mean = gains.reduce((a, b) => a + b, 0) / Math.max(gains.length, 1);
  return { label, mean, min: Math.min(...gains), max: Math.max(...gains) };
});
ranked.sort((a, b) => b.mean - a.mean);
L.push('| relaxation | mean gain | worst slot | best slot |');
L.push('|---|---:|---:|---:|');
for (const r of ranked) {
  L.push(`| ${r.label} | **${r.mean.toFixed(2)}x** | ${r.min.toFixed(2)}x | ${r.max.toFixed(2)}x |`);
}
L.push('');
L.push('## Caveats');
L.push('');
L.push('- The mask rows use the mask\'s **bounding box** unioned over the frames the slot is on');
L.push('  screen, not its silhouette. A box is conservative wherever a head is not square, so');
L.push('  those rows are a floor on the true ceiling rather than the ceiling itself.');
L.push('- `SCALE_JITTER` does not move the ceiling — it varies the realised side either side of');
L.push(`  \`FILL_FRACTION\`, so removing it removes a downside of up to ${f3(SCALE_JITTER)} rather than raising`);
L.push('  the maximum.');
L.push('- The zone rows are bounded by the zone, which is derived from the **person** mask, not');
L.push('  the head mask. Hair-versus-face therefore changes nothing while the zone is in force —');
L.push('  it only matters once the zone is dropped.');
L.push('');
writeFileSync(OUT_PATH, `${L.join('\n')}\n`, 'utf8');
mkdirSync(path.join(REPO_ROOT, '.local', 'build'), { recursive: true });
const sizes: Record<string, Record<string, number>> = {};
for (const label of labels) {
  const key = label.startsWith('baseline') ? 'strict' : label === 'all of the above' ? 'max' : null;
  if (key === null) continue;
  sizes[key] = {};
  for (const r of rows.filter((x) => x.label === label && x.reel === 'vitasilk')) sizes[key]![r.slotId] = r.px;
}
sizes.loose = {};
for (const r of rows.filter((x) => x.label === 'HEAD_CLEARANCE 0 (no zone)' && x.reel === 'vitasilk')) {
  sizes.loose[r.slotId] = r.px;
}
sizes.face = {};
for (const r of rows.filter((x) => x.label === 'hair is not head (no zone)' && x.reel === 'vitasilk')) {
  sizes.face[r.slotId] = r.px;
}
/*
 * The rect, not only the side. A square that fits *somewhere* is not a
 * placement: building it on the slot's original centre put an image across the
 * speaker's face on two slots, because the centre the solver chose belongs to
 * the smaller square. The variants carry the position the ceiling actually
 * found.
 */
const rects: Record<string, Record<string, Rect>> = {};
const rectFor = (key: string, label: string): void => {
  rects[key] = {};
  for (const r of rows.filter((x) => x.label === label && x.reel === 'vitasilk' && x.rect)) {
    rects[key]![r.slotId] = r.rect as Rect;
  }
};
rectFor('loose', 'HEAD_CLEARANCE 0 (no zone)');
rectFor('face', 'hair is not head (no zone)');
rectFor('max', 'all of the above');
writeFileSync(
  path.join(REPO_ROOT, '.local', 'build', 'image-ceilings.json'),
  `${JSON.stringify({ sizes, rects }, null, 2)}\n`,
  'utf8',
);
console.log(`wrote ${path.relative(REPO_ROOT, OUT_PATH)}`);
for (const r of ranked) console.log(`${r.label}: mean ${r.mean.toFixed(2)}x`);
