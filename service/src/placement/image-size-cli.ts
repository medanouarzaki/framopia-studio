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
import { footprintOf, regionFor } from './solve.js';
import { largestSquare } from './geometry.js';

/**
 * How large an image could be, under three successively looser rules.
 *
 * The user's ruling is that the images read too small, which settles the
 * question Block 5 left open. **This changes no constant** — it measures the
 * ceiling so the choice is made against numbers and a built comp rather than
 * against an argument.
 *
 * Free and local: reads masks already on disk and calls nothing.
 */
const FOOTAGE_DIR = path.join(REPO_ROOT, 'my files', 'test videos');
const OUT_PATH = path.join(REPO_ROOT, 'benchmarks', 'RESULTS-block7-image-size.md');
const PY = path.join(REPO_ROOT, 'tools', 'cv', '.venv', 'bin', 'python');
const HEAD_BOXES = path.join(REPO_ROOT, 'tools', 'cv', 'head_boxes.py');

interface HeadFrame { index: string; box: [number, number, number, number] | null }

function headBoxes(reel: string): HeadFrame[] | null {
  const dir = path.join(REPO_ROOT, '.local', 'cv', reel, 'masks-2fps');
  if (!existsSync(dir) || !existsSync(PY)) return null;
  const raw = execFileSync(PY, [HEAD_BOXES, dir], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return (JSON.parse(raw) as { frames: HeadFrame[] }).frames;
}

/** Frame-fraction rect, x/w against width and y/h against height. */
interface Rect { x: number; y: number; w: number; h: number }



/**
 * The largest square that fits in the frame while avoiding every forbidden
 * band, swept on a coarse grid. The bands are the real product rules: the head
 * (plus clearance), the subtitle band, the bottom exclusion, and the frame
 * edge. The zone rectangle is deliberately not among them — it was a
 * conservative device for finding free space, never itself a rule.
 */
function largestSquareAvoiding(blocked: Rect[]): { side: number; rect: Rect } {
  const STEP = 1 / 216; // 10 source px
  let best = { side: 0, rect: { x: 0, y: 0, w: 0, h: 0 } };
  for (let x = 0; x < 1; x += STEP) {
    for (let y = 0; y < 1; y += STEP) {
      let lo = 0;
      let hi = Math.min(1 - x, (1 - y) * FRAME_ASPECT);
      for (let iter = 0; iter < 18; iter += 1) {
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

interface Row {
  reel: string;
  slotId: string;
  presentation: string;
  zoneId: string | null;
  aPx: number;
  bPx: number;
  cPx: number;
  binding: string;
}

const rows: Row[] = [];
const notes: string[] = [];

for (const reel of ['vitasilk', 'test 1']) {
  const planPath = path.join(FOOTAGE_DIR, `${reel}.editplan.json`);
  if (!existsSync(planPath)) { notes.push(`no plan for ${reel}`); continue; }
  const plan: EditPlan = await readEditPlan(planPath);
  const heads = headBoxes(reel);
  const zones = new Map(plan.zones.zones.map((z: Zone) => [z.id, z]));
  const sampleFps = plan.zones.sampleFps || 2;

  for (const slot of plan.images.slots as ImageSlot[]) {
    const presentation = footprintOf(slot);
    const zone = slot.zoneId === null ? undefined : zones.get(slot.zoneId);

    const aPx = slot.scale == null ? 0 : slot.scale * COMP_SIDE_PX;

    let bPx = 0;
    if (zone !== undefined) {
      const region = regionFor(zone, presentation);
      if (region !== null) bPx = largestSquare(region) * FRAME_WIDTH;
    }

    // Head boxes over the frames this slot is on screen, unioned: the image
    // must clear the head for the whole time it is up, not on average.
    const blocked: Rect[] = [];
    let headRect: Rect | null = null;
    if (heads !== null) {
      const boxes = heads
        .filter((h) => {
          const t = Number(h.index) / sampleFps;
          return h.box !== null && t >= slot.start - 1 / sampleFps && t <= slot.end + 1 / sampleFps;
        })
        .map((h) => h.box as [number, number, number, number]);
      if (boxes.length > 0) {
        const x0 = Math.min(...boxes.map((b) => b[0])) - HEAD_CLEARANCE;
        const y0 = Math.min(...boxes.map((b) => b[1])) - HEAD_CLEARANCE * FRAME_ASPECT;
        const x1 = Math.max(...boxes.map((b) => b[2])) + HEAD_CLEARANCE;
        const y1 = Math.max(...boxes.map((b) => b[3])) + HEAD_CLEARANCE * FRAME_ASPECT;
        headRect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        blocked.push(headRect);
      }
    }
    blocked.push({ x: 0, y: SUBTITLE_BAND.y, w: 1, h: 1 - SUBTITLE_BAND.y });
    blocked.push({ x: 0, y: 1 - BOTTOM_EXCLUSION, w: 1, h: BOTTOM_EXCLUSION });

    const c = largestSquareAvoiding(blocked);
    const cPx = c.side * FRAME_WIDTH;

    // Which rule actually stops it growing: whichever edge the winning square
    // is sitting against.
    let binding = 'frame edge';
    const eps = 2 / FRAME_WIDTH;
    if (headRect !== null && Math.abs(c.rect.x + c.rect.w - headRect.x) < eps) binding = 'head (left of it)';
    else if (headRect !== null && Math.abs(c.rect.x - (headRect.x + headRect.w)) < eps) binding = 'head (right of it)';
    else if (headRect !== null && Math.abs(c.rect.y + c.rect.h - headRect.y) < eps) binding = 'head (above it)';
    else if (Math.abs(c.rect.y + c.rect.h - SUBTITLE_BAND.y) < eps) binding = 'subtitle band';
    else if (Math.abs(c.rect.x + c.rect.w - 1) < eps) binding = 'frame width';

    rows.push({ reel, slotId: slot.id, presentation, zoneId: slot.zoneId, aPx, bPx, cPx, binding });
  }
}

const f0 = (v: number): string => v.toFixed(0);
const frac = (px: number): string => (px / FRAME_WIDTH).toFixed(3);

const L: string[] = [];
L.push('# Block 7 — how big the images could actually be');
L.push('');
L.push('Generated by `npm run image-size`. **No constant was changed.** The user ruled the');
L.push('images too small, which settles the question Block 5 left open; this measures the');
L.push('ceiling so the choice is made against numbers and a built comp.');
L.push('');
L.push('Three rules, successively looser:');
L.push('');
L.push(`- **(a) as built today** — inside the assigned zone, \`FILL_FRACTION\` ${FILL_FRACTION}, with`);
L.push(`  jitter (±${SCALE_JITTER}) and edge clearance.`);
L.push('- **(b) fill the zone** — same zone, same clearance, `FILL_FRACTION` 1.0.');
L.push('- **(c) maximum allowed** — anywhere in the frame, clear of the head mask plus');
L.push(`  \`HEAD_CLEARANCE\` ${HEAD_CLEARANCE}, outside the subtitle band and the bottom exclusion,`);
L.push('  inside the frame. **The zone rectangle is not a constraint here** — it was a');
L.push('  conservative device for finding free space, never itself a product rule.');
L.push('');
L.push('**(b) cannot keep the jitter.** At `FILL_FRACTION` 1.0 the square already fills the');
L.push('region, so a jitter upward would leave it — the solver draws the side before the');
L.push('position precisely so that cannot happen. (b) is therefore the zone-filling ceiling,');
L.push('with no jitter, and that is a property of the two settings together rather than an');
L.push('omission.');
L.push('');
L.push('| reel | slot | presentation | zone | (a) built | (b) fill zone | (c) max allowed | (c)/(a) | what binds (c) |');
L.push('|---|---|---|---|---:|---:|---:|---:|---|');
for (const r of rows) {
  L.push(
    `| ${r.reel} | ${r.slotId} | ${r.presentation} | ${r.zoneId ?? '—'} | ` +
      `${f0(r.aPx)} px (${frac(r.aPx)}) | ${f0(r.bPx)} px (${frac(r.bPx)}) | ` +
      `${f0(r.cPx)} px (${frac(r.cPx)}) | ${r.aPx === 0 ? '—' : `${(r.cPx / r.aPx).toFixed(2)}x`} | ${r.binding} |`,
  );
}
L.push('');
const meanRatio = rows.filter((r) => r.aPx > 0).reduce((s, r) => s + r.cPx / r.aPx, 0) /
  Math.max(1, rows.filter((r) => r.aPx > 0).length);
L.push(`Across ${rows.length} slots the maximum allowed square is **${meanRatio.toFixed(2)}x** the side`);
L.push('built today on average — an area roughly ' + (meanRatio * meanRatio).toFixed(1) + 'x larger.');
L.push('');
L.push('## What actually limits an image');
L.push('');
L.push('Named per slot for the first time. The zone rectangle has been the binding constraint');
L.push('in practice, and it is the one constraint on the list that is not a product rule.');
L.push('');
const byBinding = new Map<string, number>();
for (const r of rows) byBinding.set(r.binding, (byBinding.get(r.binding) ?? 0) + 1);
L.push('| binding constraint | slots |');
L.push('|---|---:|');
for (const [k, v] of [...byBinding].sort((a, b) => b[1] - a[1])) L.push(`| ${k} | ${v} |`);
L.push('');
L.push('## Caveats');
L.push('');
L.push('- **(c) uses the head mask\'s bounding box**, unioned over the frames the slot is on');
L.push('  screen, not its silhouette. A box is conservative where the head is not square, so');
L.push('  (c) is a floor on the true ceiling rather than the exact one.');
L.push('- **(c) ignores concurrent elements.** ARCHITECTURE §5.3 plans non-overlapping image');
L.push('  windows and no fixture has two slots overlapping in time, so nothing was excluded —');
L.push('  but the rule is unexercised and a reel that did overlap would need it.');
L.push(`- \`CARD_EDGE_CLEARANCE\` ${CARD_EDGE_CLEARANCE} still applies to (a) and (b) and is not applied in (c),`);
L.push('  because it insets from a zone edge and (c) has no zone.');
L.push('');
writeFileSync(OUT_PATH, `${L.join('\n')}\n`, 'utf8');

/*
 * The measured sides, for the builder to place three variants from. Written
 * under .local/ because it is a run artefact, not a decision: nothing reads it
 * except a build the user is about to look at.
 */
const sizes: Record<string, Record<string, number>> = { a: {}, b: {}, c: {} };
for (const r of rows) {
  if (r.reel !== 'vitasilk') continue;
  sizes.a![r.slotId] = r.aPx;
  sizes.b![r.slotId] = r.bPx;
  sizes.c![r.slotId] = r.cPx;
}
const sizesPath = path.join(REPO_ROOT, '.local', 'build', 'image-sizes.json');
mkdirSync(path.dirname(sizesPath), { recursive: true });
writeFileSync(sizesPath, `${JSON.stringify(sizes, null, 2)}\n`, 'utf8');
console.log(`wrote ${path.relative(REPO_ROOT, sizesPath)}`);
console.log(`wrote ${path.relative(REPO_ROOT, OUT_PATH)}`);
for (const r of rows) {
  console.log(`${r.reel} ${r.slotId}: a=${f0(r.aPx)} b=${f0(r.bPx)} c=${f0(r.cPx)} (${r.binding})`);
}
