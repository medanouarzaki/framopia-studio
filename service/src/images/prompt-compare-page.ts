import type { EditPlan, ImageSlot } from '../editplan/types.js';

/**
 * The side-by-side a prompt change is judged on.
 *
 * `docs/DECISION-image-config.md` records three image defects — fidelity,
 * darkness and literalness — as one problem, the words sent to the model, and
 * they were tested in one generation. Whether the change worked is the user's
 * eye on the pictures, so the comparison has to be made for him rather than
 * described.
 *
 * **The two halves are different reels**, and the page says so in its own
 * words rather than in a footnote. `vitasilk` is the only reel that had images
 * under the old prompt and regenerating it would have cost the corpus every
 * image measurement in the project is written against; `test-1` had never had
 * an image generated. So there is no slot-for-slot before and after, and the
 * honest comparison is one reel's look against another's.
 */
export interface LuminanceRow {
  name: string;
  mean: number;
  median: number;
  p90: number;
  belowDark: number;
}

export interface ComparePageOptions {
  newPlan: EditPlan;
  newReel: string;
  oldPlan: EditPlan;
  oldReel: string;
  newLuminance: LuminanceRow[];
  oldLuminance: LuminanceRow[];
  promptBefore: string[];
  promptAfter: string[];
  /** Classified by hand from the slot's own words; see the decision document. */
  kinds: Record<string, { kind: 'concrete' | 'mood'; why: string }>;
}

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  );
}

/** A file:// URL: every path here has a space in it. */
function url(filePath: string): string {
  return `file://${encodeURI(filePath).replace(/#/g, '%23')}`;
}

function stat(row: LuminanceRow | undefined): string {
  if (row === undefined) return '<span class="stat">not measured</span>';
  const dark = row.belowDark * 100;
  const cls = dark > 70 ? 'bad' : dark > 50 ? 'mid' : 'good';
  return (
    `<span class="stat ${cls}">${dark.toFixed(1)}% of the frame is unlit</span>` +
    `<span class="stat">mean luminance ${row.mean.toFixed(4)}</span>`
  );
}

function candidates(slot: ImageSlot, lum: Map<string, LuminanceRow>): string {
  return slot.candidates
    .map(
      (c) => `
      <figure>
        <img src="${url(c.path)}" alt="">
        <figcaption><strong>${esc(c.id)}</strong>${stat(lum.get(c.id))}</figcaption>
      </figure>`,
    )
    .join('');
}

function slotBlock(
  slot: ImageSlot,
  lum: Map<string, LuminanceRow>,
  kind: { kind: 'concrete' | 'mood'; why: string } | undefined,
): string {
  const label =
    kind === undefined
      ? ''
      : `<span class="kind ${kind.kind}">${kind.kind === 'concrete' ? 'names a thing' : 'names a feeling'}</span>` +
        `<span class="why">${esc(kind.why)}</span>`;
  return `
    <section class="slot">
      <h3>${esc(slot.id)} ${label}</h3>
      ${slot.contextText ? `<p class="says">she says: <span dir="auto">${esc(slot.contextText)}</span></p>` : ''}
      <p class="idea">${esc(slot.idea)}</p>
      <div class="row">${candidates(slot, lum)}</div>
    </section>`;
}

function fragmentList(fragments: string[], cls: string): string {
  return `<ul class="${cls}">${fragments.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`;
}

function summary(rows: LuminanceRow[]): string {
  if (rows.length === 0) return '';
  const mean = rows.reduce((t, r) => t + r.mean, 0) / rows.length;
  const dark = rows.reduce((t, r) => t + r.belowDark, 0) / rows.length;
  return `mean luminance ${mean.toFixed(4)}, ${(dark * 100).toFixed(1)}% of the average frame unlit`;
}

export function renderComparePage(options: ComparePageOptions): string {
  const newLum = new Map(options.newLuminance.map((r) => [r.name, r]));
  const oldLum = new Map(options.oldLuminance.map((r) => [r.name, r]));

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Image prompt — before and after</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 2rem 2.5rem 5rem; background: #1A0000; color: #F8F6F2;
         font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  h1 { font-size: 1.5rem; margin: 0 0 .35rem; }
  h2 { font-size: 1.15rem; margin: 3rem 0 .3rem; color: #C9A96E;
       border-top: 1px solid #4a2020; padding-top: 1.4rem; }
  h3 { font-size: .95rem; margin: 1.8rem 0 .3rem; display: flex; align-items: center;
       gap: .6rem; flex-wrap: wrap; }
  p { margin: .2rem 0; }
  .lede { color: #cbbfb8; max-width: 62ch; }
  .note { color: #cbbfb8; max-width: 78ch; margin-bottom: .6rem; }
  .says { color: #cbbfb8; font-size: .88rem; }
  .idea { font-size: .95rem; }
  .row { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: .7rem; }
  figure { margin: 0; flex: 1 1 320px; max-width: 460px; }
  img { width: 100%; height: auto; display: block; border-radius: 3px; background: #000; }
  figcaption { font-size: .78rem; color: #cbbfb8; padding-top: .35rem;
               display: flex; gap: .6rem; flex-wrap: wrap; align-items: baseline; }
  .stat { color: #9d928c; }
  .stat.bad { color: #e08d8d; } .stat.mid { color: #d8c08a; } .stat.good { color: #8fc79a; }
  .kind { font-size: .68rem; text-transform: uppercase; letter-spacing: .06em;
          padding: .12rem .5rem; border-radius: 2px; font-weight: 600; }
  .kind.concrete { background: #C9A96E; color: #1A0000; }
  .kind.mood { background: #3a2a2a; color: #C9A96E; }
  .why { font-size: .8rem; color: #9d928c; font-weight: 400; text-transform: none;
         letter-spacing: 0; }
  ul { margin: .3rem 0 .9rem; padding-left: 1.1rem; max-width: 82ch; }
  li { font-size: .85rem; margin: .18rem 0; }
  ul.before li { color: #e08d8d; } ul.after li { color: #8fc79a; }
  .summary { font-size: .85rem; color: #C9A96E; margin-bottom: .4rem; }
</style></head><body>

<h1>The image prompt, before and after</h1>
<p class="lede">Two fragments of the client's image style were replaced. Everything
else — model, resolution, aspect ratio, negative prompt, the variation axes — is
unchanged.</p>

<h2>What was removed</h2>
${fragmentList(options.promptBefore, 'before')}
<h2>What replaced it</h2>
${fragmentList(options.promptAfter, 'after')}

<h2>After — ${esc(options.newReel)}, the new prompt</h2>
<p class="summary">${summary(options.newLuminance)}</p>
<p class="note">These eight were generated to test the change. Each slot shows the
words she says and the idea the picture was asked to carry, so the question
“does this show what it was asked for” can be answered by looking.</p>
${options.newPlan.images.slots.map((s) => slotBlock(s, newLum, options.kinds[s.id])).join('')}

<h2>Before — ${esc(options.oldReel)}, the old prompt</h2>
<p class="summary">${summary(options.oldLuminance)}</p>
<p class="note">A different reel, and that is the honest limit of this comparison.
${esc(options.oldReel)} is the only reel that ever had images under the old prompt, and
regenerating it would have destroyed the set every image measurement in the
project is written against. So these are not the same subjects — they are what
the old words produced.</p>
${options.oldPlan.images.slots.map((s) => slotBlock(s, oldLum, options.kinds[s.id])).join('')}

</body></html>`;
}
