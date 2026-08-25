import type { EditPlan, ImageCandidate, ImageSlot } from '../editplan/types.js';

/**
 * The review page for a whole reel's candidates, grouped by slot.
 *
 * Grouped because a reel's images have to read as a set — the point of the
 * variation axes is that five slots do not look batched, and that judgement
 * cannot be made on one image at a time. Each slot's `idea` sits above its
 * candidates because **whether an image carries its idea is the judgement
 * being made**, and the picture alone does not show what it was asked for.
 *
 * Four views per candidate, as in the corpus page: a matte flaw is invisible
 * on the wrong backdrop, and a halo is invisible on a ground its own colour.
 */
function candidateBlock(c: ImageCandidate, originalFile: string, cutoutFile: string): string {
  const m = c.metrics;
  const gate = c.gate;
  const verdict = c.textVerdict;

  const textLabel =
    verdict === null || verdict === undefined
      ? 'text: not checked'
      : verdict.unexpected.length > 0
        ? `unexpected: ${verdict.unexpected.slice(0, 12).join(', ')}` +
          (verdict.unexpected.length > 12 ? ` … +${verdict.unexpected.length - 12} more` : '')
        : verdict.hasText
          ? `text ok: ${verdict.expected.join(', ')}`
          : 'no text';

  const metricCells =
    m === null || m === undefined
      ? '<td colspan="4">no metrics</td>'
      : `<td>${m.alphaEdgeNoise.toFixed(5)}</td><td>${m.holeRatio.toFixed(5)}</td>` +
        `<td>${m.foregroundArea.toFixed(4)}</td><td>${m.edgeHalo.toFixed(4)}</td>`;

  return `
  <article>
    <p class="meta">
      <strong>${c.id}</strong>
      <span class="pill ${gate?.passed ? 'pass' : 'fail'}">${gate?.presentation ?? '?'}</span>
      <span class="pill ${verdict && verdict.unexpected.length > 0 ? 'fail' : 'pass'}">${textLabel}</span>
      <span>quality ${(c.cutoutQuality ?? 0).toFixed(3)}</span>
      <span>$${(c.costUsd ?? 0).toFixed(6)}</span>
    </p>
    ${gate && gate.failures.length > 0 ? `<p class="meta fails">${gate.failures.join('; ')}</p>` : ''}
    <table class="metrics">
      <tr><th>edge noise</th><th>hole ratio</th><th>fg area</th><th>edge halo</th></tr>
      <tr>${metricCells}</tr>
    </table>
    <div class="grid">
      <figure><div class="plate original"><img src="${originalFile}" alt=""></div><figcaption>original</figcaption></figure>
      <figure><div class="plate checker"><img src="${cutoutFile}" alt=""></div><figcaption>cutout on checkerboard</figcaption></figure>
      <figure><div class="plate light"><img src="${cutoutFile}" alt=""></div><figcaption>on light ground</figcaption></figure>
      <figure><div class="plate dark"><img src="${cutoutFile}" alt=""></div><figcaption>on dark ground</figcaption></figure>
    </div>
  </article>`;
}

function slotBlock(slot: ImageSlot, files: Map<string, { original: string; cutout: string }>): string {
  const blocks = slot.candidates
    .map((c) => {
      const f = files.get(c.id);
      return f === undefined ? '' : candidateBlock(c, f.original, f.cutout);
    })
    .join('\n');

  return `
<section>
  <h2>${slot.id} <span class="time">${slot.start.toFixed(2)}s – ${slot.end.toFixed(2)}s</span></h2>
  <p class="idea">${slot.idea}</p>
  <p class="meta">
    <span class="pill ${slot.presentation === 'cutout' ? 'pass' : 'fail'}">slot presentation: ${slot.presentation ?? 'null — candidates disagree'}</span>
    <span>status ${slot.status}</span>
    <span>chosen: ${slot.chosenCandidateId ?? 'none — the editor picks in Block 8'}</span>
  </p>
  <details><summary>composed prompt</summary><pre>${slot.prompt}</pre>
  <pre class="neg">${slot.negativePrompt}</pre></details>
  ${blocks}
</section>`;
}

export function buildPlanPage(
  plan: EditPlan,
  files: Map<string, { original: string; cutout: string }>,
  title: string,
): string {
  const totals = plan.images.slots.flatMap((s) => s.candidates);
  const passed = totals.filter((c) => c.gate?.passed).length;
  const flagged = totals.filter((c) => (c.textVerdict?.unexpected.length ?? 0) > 0).length;

  return `<!doctype html>
<meta charset="utf-8">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 -apple-system, system-ui, sans-serif; margin: 2rem auto; max-width: 1200px; padding: 0 1rem; }
  h1 { font-size: 1.4rem; margin-bottom: 0.2rem; }
  section { border-top: 2px solid #8886; padding-top: 1.2rem; margin-top: 2.5rem; }
  h2 { font-size: 1.1rem; font-family: ui-monospace, monospace; margin-bottom: 0.2rem; }
  .time { color: #8a8a8a; font-weight: normal; font-size: 0.85rem; }
  .idea { font-size: 1.05rem; margin: 0.2rem 0 0.6rem; }
  article { border-left: 3px solid #8884; padding-left: 1rem; margin: 1.2rem 0; }
  .meta { color: #8a8a8a; font-size: 0.85rem; display: flex; gap: 0.7rem; flex-wrap: wrap; align-items: center; margin: 0.3rem 0; }
  .fails { color: #a32323; font-family: ui-monospace, monospace; font-size: 0.78rem; }
  .pill { border-radius: 999px; padding: 0.1rem 0.6rem; font-weight: 600; }
  .pass { background: #1c7c3c22; color: #1c7c3c; }
  .fail { background: #a3232322; color: #a32323; }
  table.metrics { border-collapse: collapse; font-family: ui-monospace, monospace; font-size: 0.78rem; margin: 0.4rem 0; }
  table.metrics th, table.metrics td { border: 1px solid #8884; padding: 0.2rem 0.6rem; text-align: right; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; margin-top: 0.6rem; }
  figure { margin: 0; }
  figcaption { font-size: 0.72rem; color: #8a8a8a; text-align: center; margin-top: 0.25rem; }
  .plate { aspect-ratio: 1; display: grid; place-items: center; border: 1px solid #8884; overflow: hidden; }
  .plate img { width: 100%; height: 100%; object-fit: contain; }
  .checker {
    background-image:
      linear-gradient(45deg, #999 25%, transparent 25%, transparent 75%, #999 75%),
      linear-gradient(45deg, #999 25%, #ddd 25%, #ddd 75%, #999 75%);
    background-size: 24px 24px; background-position: 0 0, 12px 12px;
  }
  .light { background: #f8f6f2; }
  .dark { background: #1a0000; }
  .original { background: #444; }
  details { margin: 0.4rem 0; font-size: 0.85rem; }
  pre { white-space: pre-wrap; background: #8881; padding: 0.6rem; border-radius: 4px; font-size: 0.78rem; }
  .neg { color: #8a8a8a; }
  .note { background: #8881; padding: 0.7rem 1rem; border-radius: 6px; font-size: 0.9rem; }
</style>
<h1>${title}</h1>
<p class="note">
  ${plan.images.slots.length} slots, ${totals.length} candidates.
  <strong>${passed} of ${totals.length}</strong> passed the cutout gate;
  <strong>${flagged}</strong> carry text the slot did not ask for.
  Nothing is chosen — the editor picks in Block 8.
  Thresholds are provisional and none was refitted to these images.
  The light ground is the mode's <code>light</code> palette entry and the dark
  ground its <code>background</code>.
</p>
${plan.images.slots.map((s) => slotBlock(s, files)).join('\n')}
`;
}
