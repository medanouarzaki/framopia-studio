import type { TranscribedWord } from './types.js';

/**
 * Picks up to `n` words spread evenly across the timed range of `words`
 * (not evenly by index — a transcript's word density isn't uniform). Words
 * without a timestamp are not eligible for sampling.
 */
export function sampleWordsEvenly(words: TranscribedWord[], n: number): TranscribedWord[] {
  const timed = words
    .filter((w): w is TranscribedWord & { startS: number } => w.startS !== null)
    .sort((a, b) => a.startS - b.startS);

  if (timed.length <= n) return timed;
  if (n <= 0) return [];

  const first = timed[0]!.startS;
  const last = timed[timed.length - 1]!.startS;
  const span = last - first;

  const chosen: TranscribedWord[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < n; i += 1) {
    const targetTime = n === 1 ? first : first + (span * i) / (n - 1);
    let bestIndex = -1;
    let bestDelta = Infinity;
    for (let idx = 0; idx < timed.length; idx += 1) {
      if (usedIndices.has(idx)) continue;
      const delta = Math.abs(timed[idx]!.startS - targetTime);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIndex = idx;
      }
    }
    if (bestIndex >= 0) {
      usedIndices.add(bestIndex);
      chosen.push(timed[bestIndex]!);
    }
  }

  return chosen.sort((a, b) => a.startS! - b.startS!);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeJsString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export interface SpotcheckOptions {
  engine: string;
  audioPath: string;
  words: TranscribedWord[];
  sampleSize?: number;
}

export function generateSpotcheckHtml(options: SpotcheckOptions): string {
  const { engine, audioPath, words, sampleSize = 15 } = options;
  const sample = sampleWordsEvenly(words, sampleSize);

  const rows = sample
    .map((word, index) => {
      const start = word.startS ?? 0;
      const seekTo = Math.max(0, start - 0.3);
      return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(word.text)}</td>
        <td>${start.toFixed(2)}s</td>
        <td><button type="button" onclick="playAt(${seekTo})">play</button></td>
        <td>
          <label><input type="radio" name="row-${index}" value="hit"> hit</label>
          <label><input type="radio" name="row-${index}" value="miss"> miss</label>
        </td>
      </tr>`;
    })
    .join('\n');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Spotcheck — ${escapeHtml(engine)}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #ccc; padding: 0.4rem 0.6rem; text-align: left; }
  #summary { width: 100%; margin-top: 1rem; font-family: monospace; }
</style>
</head>
<body>
<h1>Spotcheck — ${escapeHtml(engine)}</h1>
<p>${sample.length} sampled words. Press play to hear ~1.2s starting 0.3s before the claimed timestamp, then mark hit or miss.</p>
<audio id="player" src="${escapeHtml(audioPath)}" preload="none"></audio>
<table>
  <thead><tr><th>#</th><th>word</th><th>claimed start</th><th></th><th>result</th></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>
<button type="button" onclick="showSummary()">show summary</button>
<input id="summary" type="text" readonly onclick="this.select()" placeholder="summary appears here">
<script>
  var player = document.getElementById('player');
  var stopTimer = null;
  function playAt(seekTo) {
    if (stopTimer) clearTimeout(stopTimer);
    player.currentTime = seekTo;
    player.play();
    stopTimer = setTimeout(function () { player.pause(); }, 1200);
  }
  function showSummary() {
    var radios = document.querySelectorAll('input[type=radio]:checked');
    var hits = 0;
    var total = ${sample.length};
    radios.forEach(function (r) { if (r.value === 'hit') hits += 1; });
    var rated = radios.length;
    var text = '${escapeJsString(engine)}: ' + hits + '/' + rated + ' rated hit (' + rated + '/' + total + ' rated)';
    document.getElementById('summary').value = text;
  }
</script>
</body>
</html>
`;
}
