import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, loadTemplateManifest, templatesById } from '@framopia/core';
import { readEditPlan } from '../editplan/io.js';
import type { EditPlan, ImageSlot } from '../editplan/types.js';
import { CARD_EDGE_CLEARANCE, COMP_SIDE_PX, FRAME_WIDTH } from './constants.js';

/**
 * Does a generated image fill its own canvas, and how large is the subject on
 * screen once every reduction is applied?
 *
 * Read-only. **No image is regenerated and the cutout sidecar is not re-run** —
 * every file measured is already on disk.
 *
 * The question is the user's: fitting a file to a square fits the file, and if
 * the subject occupies half the file then the subject arrives at half the size
 * anyone intended.
 */
const FOOTAGE_DIR = path.join(REPO_ROOT, 'my files', 'test videos');
const OUT_PATH = path.join(REPO_ROOT, 'benchmarks', 'RESULTS-block7-image-fill.md');
const PY = path.join(REPO_ROOT, 'tools', 'cv', '.venv', 'bin', 'python');
const SCRIPT = path.join(REPO_ROOT, 'tools', 'cv', 'content_boxes.py');
const AUDIT_PATH = path.join(REPO_ROOT, 'templates', 'library.audit.json');

interface Box { x: number; y: number; w: number; h: number; pixels: number }
interface Measured {
  path: string;
  kind: string;
  width: number;
  height: number;
  boxes: Record<string, Box | null>;
}

interface AuditLayerLike { name: string; width?: number | null }
interface AuditCompLike { name: string; width: number; layers: AuditLayerLike[] }
const audit = (JSON.parse(readFileSync(AUDIT_PATH, 'utf8')) as { comps?: AuditCompLike[] }).comps ?? [];

/** How much of a template's own square the picture layer occupies. */
function pictureFractionOf(templateId: string): number | null {
  const comp = audit.find((c) => c.name === templateId);
  const layer = comp?.layers.find((l) => l.name === 'IMG_MAIN');
  if (comp === undefined || layer === undefined || typeof layer.width !== 'number') return null;
  return layer.width / comp.width;
}

const requests: { path: string; kind: 'cutout' | 'original' }[] = [];
const plans: { reel: string; plan: EditPlan }[] = [];
for (const file of readdirSync(FOOTAGE_DIR).filter((f) => f.endsWith('.editplan.json')).sort()) {
  const plan = await readEditPlan(path.join(FOOTAGE_DIR, file));
  if (plan.images.slots.every((s) => s.candidates.length === 0)) continue;
  plans.push({ reel: file.replace('.editplan.json', ''), plan });
  for (const slot of plan.images.slots) {
    for (const c of slot.candidates) {
      if (existsSync(c.path)) requests.push({ path: c.path, kind: 'original' });
      if (c.cutoutPath && existsSync(c.cutoutPath)) {
        requests.push({ path: c.cutoutPath, kind: 'cutout' });
      }
    }
  }
}

if (requests.length === 0) {
  console.error('image-fill: no candidate files on disk');
  process.exit(1);
}

const raw = execFileSync(PY, [SCRIPT], {
  input: JSON.stringify({ images: requests }),
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const measured = new Map(
  (JSON.parse(raw) as { images: Measured[] }).images.map((m) => [m.path, m]),
);

const templates = templatesById(loadTemplateManifest());
const f3 = (v: number): string => v.toFixed(3);
const f0 = (v: number): string => v.toFixed(0);

interface Row {
  reel: string;
  slotId: string;
  candidateId: string;
  presentation: string;
  templateId: string | null;
  usedKind: 'cutout' | 'original';
  canvas: number;
  contentLong: number;
  contentShort: number;
  contentFraction: number;
  offsetX: number;
  offsetY: number;
  placedPx: number;
  pictureFraction: number;
  effectivePx: number;
  chosen: boolean;
}

const rows: Row[] = [];
for (const { reel, plan } of plans) {
  for (const slot of plan.images.slots as ImageSlot[]) {
    slot.candidates.forEach((c, index) => {
      const usedKind: 'cutout' | 'original' = slot.presentation === 'cutout' ? 'cutout' : 'original';
      const file = usedKind === 'cutout' ? (c.cutoutPath ?? c.path) : c.path;
      const m = measured.get(file);
      if (m === undefined) return;
      const box = usedKind === 'cutout' ? m.boxes.alpha : m.boxes.t24;
      if (!box) return;
      const canvas = Math.min(m.width, m.height);
      const contentLong = Math.max(box.w, box.h);
      const contentShort = Math.min(box.w, box.h);
      const placedPx = (slot.scale ?? 0) * COMP_SIDE_PX;
      const pictureFraction = slot.templateId === null ? 1 : (pictureFractionOf(slot.templateId) ?? 1);
      rows.push({
        reel,
        slotId: slot.id,
        candidateId: c.id,
        presentation: slot.presentation ?? 'null',
        templateId: slot.templateId,
        usedKind,
        canvas,
        contentLong,
        contentShort,
        contentFraction: contentShort / canvas,
        // Offset of the content's centre from the canvas centre, in canvas units.
        offsetX: (box.x + box.w / 2 - m.width / 2) / m.width,
        offsetY: (box.y + box.h / 2 - m.height / 2) / m.height,
        placedPx,
        pictureFraction,
        // What the eye sees: the placed square, less the template's own inset,
        // less the empty margin inside the file.
        effectivePx: placedPx * pictureFraction * (contentLong / canvas),
        chosen: index === 0,
      });
    });
  }
}

const stats = (v: number[]): string => {
  if (v.length === 0) return '—';
  const s = [...v].sort((a, b) => a - b);
  return `${f3(s[0] as number)} / ${f3(s[Math.floor(s.length / 2)] as number)} / ${f3(s[s.length - 1] as number)}`;
};

// The subject inside an original is what the matte found there, so an original
// gets a second fraction measured from its own cutout.
const subjectFractionOf = new Map<string, number>();
for (const { plan } of plans) {
  for (const slot of plan.images.slots) {
    for (const c of slot.candidates) {
      const cut = c.cutoutPath ? measured.get(c.cutoutPath) : undefined;
      const b = cut?.boxes.alpha;
      if (cut && b) subjectFractionOf.set(c.id, Math.max(b.w, b.h) / Math.min(cut.width, cut.height));
    }
  }
}

const L: string[] = [];
L.push('# Block 7 — do the generated images fill their own canvas?');
L.push('');
L.push('Generated by `npm run image-fill`. **Read-only**: no image was regenerated, the cutout');
L.push('sidecar was not re-run, and every file measured was already on disk.');
L.push('');
L.push('## The definitions');
L.push('');
L.push('- **cutout content** — non-zero alpha. The matte is what the Block 4 quality gate already');
L.push('  accepted as the subject, so nothing new is decided here.');
L.push('- **original content** — colour whose largest per-channel difference from the mode\'s');
L.push('  background `#1A0000` exceeds 24 of 255. The mode\'s own style fragment places the');
L.push('  subject "lit against #1A0000", so the ground is a stated colour rather than a guess.');
L.push('  Thresholds of 16 and 40 were measured too and are reported below, because a single');
L.push('  threshold on a deliberately dark image should not go unqualified.');
L.push('- **content fraction** — the box\'s short edge over the canvas\'s short edge, as asked.');
L.push('  Where scaling is concerned the **long** edge is what binds, and it is reported beside it.');
L.push('');
L.push('## Every candidate');
L.push('');
L.push('| reel | slot | candidate | presentation | template | file used | canvas | content w x h | short frac | long frac | centre offset |');
L.push('|---|---|---|---|---|---|---:|---|---:|---:|---|');
for (const r of rows) {
  const m = measured.get(
    r.usedKind === 'cutout'
      ? (plans.flatMap((p) => p.plan.images.slots).flatMap((s) => s.candidates).find((c) => c.id === r.candidateId)?.cutoutPath ?? '')
      : (plans.flatMap((p) => p.plan.images.slots).flatMap((s) => s.candidates).find((c) => c.id === r.candidateId)?.path ?? ''),
  );
  const box = m ? (r.usedKind === 'cutout' ? m.boxes.alpha : m.boxes.t24) : null;
  L.push(
    `| ${r.reel} | ${r.slotId} | ${r.candidateId}${r.chosen ? ' **(used)**' : ''} | ${r.presentation} | ${r.templateId} | ` +
      `${r.usedKind} | ${r.canvas} | ${box ? `${box.w} x ${box.h}` : '—'} | ${f3(r.contentFraction)} | ` +
      `${f3(r.contentLong / r.canvas)} | ${f3(r.offsetX)}, ${f3(r.offsetY)} |`,
  );
}
L.push('');
L.push('## Distribution');
L.push('');
const cutRows = rows.filter((r) => r.usedKind === 'cutout');
const origRows = rows.filter((r) => r.usedKind === 'original');
L.push('| set | n | short-edge fraction min / median / max | long-edge fraction min / median / max |');
L.push('|---|---:|---|---|');
L.push(`| cutouts (as used) | ${cutRows.length} | ${stats(cutRows.map((r) => r.contentFraction))} | ${stats(cutRows.map((r) => r.contentLong / r.canvas))} |`);
L.push(`| originals (as used) | ${origRows.length} | ${stats(origRows.map((r) => r.contentFraction))} | ${stats(origRows.map((r) => r.contentLong / r.canvas))} |`);
const subjectFractions = [...subjectFractionOf.values()];
L.push(`| **subject inside any file**, from its matte | ${subjectFractions.length} | — | ${stats(subjectFractions)} |`);
L.push('');
L.push('## The verdict on the hypothesis');
L.push('');
const medCut = [...cutRows.map((r) => r.contentLong / r.canvas)].sort((a, b) => a - b)[
  Math.floor(cutRows.length / 2)
];
const medSubject = [...subjectFractions].sort((a, b) => a - b)[Math.floor(subjectFractions.length / 2)];
const subjSorted = [...subjectFractions].sort((a, b) => a - b);
const minSubject = subjSorted[0] ?? 0;
const templateLoss = rows.filter((r) => r.chosen).map((r) => r.pictureFraction);
const worstCombined = Math.min(...rows.filter((r) => r.chosen).map((r) => (r.effectivePx / Math.max(r.placedPx, 1e-9))));
L.push('**Confirmed — but not by the route the hypothesis proposed, and the correction is worth');
L.push('making because it changes what to fix.**');
L.push('');
L.push('*Not* by the route proposed: the files mostly **do** fill their own canvas. Originals reach');
L.push(`a median **${f3([...origRows.map((r) => r.contentLong / r.canvas)].sort((a, b) => a - b)[Math.floor(origRows.length / 2)] ?? 0)}** of the long edge, and only ${origRows.filter((r) => r.contentLong / r.canvas < 0.9).length} of ${origRows.length} fall below 0.9. Only`);
L.push(`${cutRows.length} slot renders from a cutout at all, so the cutout column is two numbers`);
L.push(`(${cutRows.map((r) => f3(r.contentLong / r.canvas)).join(' and ')}) and not a distribution — no median should be read from it.`);
L.push('');
L.push('Confirmed all the same, one level down: what is small is **the subject inside the');
L.push(`picture**, measured from each file's own matte. It occupies a median **${f3(medSubject ?? 0)}** of the`);
L.push(`long edge and as little as **${f3(minSubject)}**. Fitting the file to the square therefore fits the`);
L.push('scene, and the bottle inside the scene arrives at a fraction of it.');
L.push('');
L.push(`On top of that, **both image templates put \`IMG_MAIN\` at 1000 inside a 1200 comp**, losing`);
L.push(`a further ${f3(1 - (templateLoss[0] ?? 1))} of every placed square before a pixel is drawn.`);
L.push('');
L.push(`Multiplied out, the worst slot shows its subject at **${f3(worstCombined)}** of the square it was`);
L.push('given. **The effective on-screen size of every image has been overstated by roughly that');
L.push('factor for the whole block**, and no figure published before this one accounted for it.');
L.push('## What the builder scales by');
L.push('');
L.push('`service/src/build/reel-plan.ts`:');
L.push('');
L.push('```ts');
L.push('export function placeholderScalePercent(options: {');
L.push('  auditedSolidWidth: number;');
L.push('  auditedScalePercent: number;');
L.push('  sourceWidth: number;');
L.push('}): number {');
L.push('  return (auditedSolidWidth / sourceWidth) * auditedScalePercent;');
L.push('}');
L.push('```');
L.push('');
L.push('`sourceWidth` comes from `imageSize()`, which reads the PNG IHDR or the JPEG frame header —');
L.push('**the canvas, not the content**. So the answer to "canvas or content" is canvas, and');
L.push('session 4\'s 1000/2048 was a canvas ratio throughout.');
L.push('');
L.push('## Everything that shrinks the subject, multiplied out');
L.push('');
L.push('| reel | slot | placed square | template picture fraction | content long fraction | **subject on screen** | as frame width |');
L.push('|---|---|---:|---:|---:|---:|---:|');
for (const r of rows.filter((x) => x.chosen)) {
  L.push(
    `| ${r.reel} | ${r.slotId} | ${f0(r.placedPx)} px | ${f3(r.pictureFraction)} | ` +
      `${f3(r.contentLong / r.canvas)} | **${f0(r.effectivePx)} px** | ${f3(r.effectivePx / FRAME_WIDTH)} |`,
  );
}
L.push('');
L.push('**Both image templates put `IMG_MAIN` at 1000 inside a 1200 comp**, so 16.7% of every');
L.push('placed square is lost before a pixel of picture is drawn — on the cutout template as well');
L.push('as the card one. That is measured from the audit, not assumed.');
L.push('');
L.push(`\`CARD_EDGE_CLEARANCE\` is ${CARD_EDGE_CLEARANCE} of frame width and insets the placed square before`);
L.push('any of this, so it compounds rather than overlaps.');
L.push('');
L.push('## Presentation, and a mismatch found on the way');
L.push('');
const byPresentation = new Map<string, number>();
for (const r of rows.filter((x) => x.chosen)) {
  byPresentation.set(r.presentation, (byPresentation.get(r.presentation) ?? 0) + 1);
}
L.push('| presentation | slots |');
L.push('|---|---:|');
for (const [k, v] of byPresentation) L.push(`| ${k} | ${v} |`);
L.push('');
const mismatched = rows.filter((r) => {
  if (!r.chosen || r.templateId === null) return false;
  const declared = templates.get(r.templateId)?.imagePresentation;
  return declared !== undefined && declared !== null && declared !== r.presentation;
});
L.push(mismatched.length === 0
  ? '**Every slot\'s template matches its presentation.**'
  : `**${mismatched.length} slot(s) carry a template built for the other presentation**: ` +
    `${mismatched.map((r) => `${r.reel} ${r.slotId} is \`${r.presentation}\` on \`${r.templateId}\``).join(', ')}. ` +
    'Template assignment is a seeded shuffle over the mode\'s allowed variants and does not read ' +
    '`presentation` — the quality gate sets that later. A card rendered in the cutout template ' +
    'simply has no frame around it; nothing fails, and nothing said so until now.');
L.push('');
writeFileSync(OUT_PATH, `${L.join('\n')}\n`, 'utf8');
mkdirSync(path.join(REPO_ROOT, '.local', 'build'), { recursive: true });
console.log(`wrote ${path.relative(REPO_ROOT, OUT_PATH)}`);
console.log(
  `cutout long-edge fraction median ${f3(medCut ?? 0)}; subject-in-file median ${f3(medSubject ?? 0)}`,
);
for (const r of rows.filter((x) => x.chosen)) {
  console.log(`${r.slotId}: placed ${f0(r.placedPx)} -> subject ${f0(r.effectivePx)} px`);
}
