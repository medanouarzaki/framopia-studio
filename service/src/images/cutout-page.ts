import type { RemoveBgResult } from './sidecar.js';

/**
 * The review page for a cutout run. Four views per image, because a matte
 * flaw is invisible on the wrong backdrop: a halo hides on a ground the same
 * colour as the halo, and edge noise hides on a busy one. Every image in this
 * corpus is a dark subject on a dark ground, which is precisely the case that
 * looks clean until it is composited onto something light.
 *
 * Self-contained and offline: the images are referenced by relative path
 * beside the page, and the checkerboard is a CSS gradient rather than an
 * asset.
 */
function row(result: RemoveBgResult, cutoutFile: string, originalFile: string): string {
  const m = result.metrics;
  const gate = result.gate;
  const ocr = result.ocr;
  const failures = gate.failures.length > 0 ? gate.failures.join('; ') : 'none';
  const detected =
    ocr && ocr.hasText
      ? ocr.detections.map((d) => `${d.text} (${d.confidence.toFixed(2)})`).join(', ')
      : 'none';

  return `
<section>
  <h2>${originalFile}</h2>
  <p class="meta">
    <span class="pill ${gate.passed ? 'pass' : 'fail'}">${gate.presentation}</span>
    <span class="pill ${ocr?.hasText ? 'fail' : 'pass'}">text: ${detected}</span>
    <span>${result.width}&times;${result.height}</span>
    <span>${result.model}</span>
    <span>alphaMatting ${result.alphaMatting}</span>
  </p>
  <table class="metrics">
    <tr><th>alpha edge noise</th><th>hole ratio</th><th>foreground area</th><th>edge halo</th></tr>
    <tr>
      <td>${m.alpha_edge_noise.toFixed(5)}</td>
      <td>${m.hole_ratio.toFixed(5)}</td>
      <td>${m.foreground_area.toFixed(4)}</td>
      <td>${m.edge_halo.toFixed(4)}</td>
    </tr>
  </table>
  <p class="meta">gate failures: ${failures}</p>
  <div class="grid">
    <figure><div class="plate original"><img src="${originalFile}" alt=""></div><figcaption>original</figcaption></figure>
    <figure><div class="plate checker"><img src="${cutoutFile}" alt=""></div><figcaption>cutout on checkerboard</figcaption></figure>
    <figure><div class="plate light"><img src="${cutoutFile}" alt=""></div><figcaption>on light ground</figcaption></figure>
    <figure><div class="plate dark"><img src="${cutoutFile}" alt=""></div><figcaption>on dark ground</figcaption></figure>
  </div>
</section>`;
}

export function buildCutoutPage(
  rows: { result: RemoveBgResult; cutoutFile: string; originalFile: string }[],
  thresholds: Record<string, number>,
): string {
  const declared = Object.entries(thresholds)
    .map(([k, v]) => `<li><code>${k}</code> = ${v}</li>`)
    .join('');

  return `<!doctype html>
<meta charset="utf-8">
<title>Cutout gate — Block 4 corpus</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 -apple-system, system-ui, sans-serif; margin: 2rem auto; max-width: 1200px; padding: 0 1rem; }
  h1 { font-size: 1.4rem; }
  section { border-top: 1px solid #8884; padding-top: 1.5rem; margin-top: 2rem; }
  h2 { font-size: 1.05rem; font-family: ui-monospace, monospace; }
  .meta { color: #8a8a8a; font-size: 0.85rem; display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
  .pill { border-radius: 999px; padding: 0.1rem 0.6rem; font-weight: 600; }
  .pass { background: #1c7c3c22; color: #1c7c3c; }
  .fail { background: #a3232322; color: #a32323; }
  table.metrics { border-collapse: collapse; font-family: ui-monospace, monospace; font-size: 0.8rem; margin: 0.5rem 0; }
  table.metrics th, table.metrics td { border: 1px solid #8884; padding: 0.25rem 0.7rem; text-align: right; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-top: 0.75rem; }
  figure { margin: 0; }
  figcaption { font-size: 0.75rem; color: #8a8a8a; text-align: center; margin-top: 0.3rem; }
  .plate { aspect-ratio: 1; display: grid; place-items: center; border: 1px solid #8884; overflow: hidden; }
  .plate img { width: 100%; height: 100%; object-fit: contain; }
  .checker {
    background-image:
      linear-gradient(45deg, #999 25%, transparent 25%, transparent 75%, #999 75%),
      linear-gradient(45deg, #999 25%, #ddd 25%, #ddd 75%, #999 75%);
    background-size: 24px 24px;
    background-position: 0 0, 12px 12px;
  }
  .light { background: #f8f6f2; }
  .dark { background: #1a0000; }
  .original { background: #444; }
  .note { background: #8881; padding: 0.75rem 1rem; border-radius: 6px; font-size: 0.9rem; }
  ul { margin: 0.4rem 0; }
</style>
<h1>Cutout gate — Block 4 corpus</h1>
<p class="note">
  Thresholds, <strong>declared before this corpus was measured</strong> and provisional:
  <ul>${declared}</ul>
  Six images from one prompt on one slot is not a tuning set. Nothing here was fitted to them.
  The light ground is the mode's <code>light</code> palette entry and the dark ground its
  <code>background</code>, so each cutout is shown against the two grounds it will actually
  be composited over.
</p>
${rows.map((r) => row(r.result, r.cutoutFile, r.originalFile)).join('\n')}
`;
}
