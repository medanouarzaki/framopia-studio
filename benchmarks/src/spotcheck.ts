import type { TranscribedWord } from './types.js';

/**
 * A word plus whatever the caller wants shown beside it. `choices` overrides
 * the page default for this row alone, so one page can ask two different
 * questions of the same audio.
 */
export type SpotcheckWord = TranscribedWord & {
  context?: string;
  choices?: [string, string];
};

/**
 * Picks up to `n` words spread evenly across the timed range of `words`
 * (not evenly by index — a transcript's word density isn't uniform). Words
 * without a timestamp are not eligible for sampling.
 */
export function sampleWordsEvenly<T extends TranscribedWord>(words: T[], n: number): T[] {
  const timed = words
    .filter((w): w is T & { startS: number } => w.startS !== null)
    .sort((a, b) => a.startS - b.startS);

  if (timed.length <= n) return timed;
  if (n <= 0) return [];

  const first = timed[0]!.startS;
  const last = timed[timed.length - 1]!.startS;
  const span = last - first;

  const chosen: (T & { startS: number })[] = [];
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
  words: SpotcheckWord[];
  sampleSize?: number;
  /**
   * How far before the claimed start to begin playback, and how long to play.
   * The defaults are the timestamp check: a short clip straddling the word.
   * A judgement about the word's content needs the run-up to it instead.
   */
  leadInS?: number;
  playMs?: number;
  /** The two answers offered, as [value, label] pairs. */
  choices?: [string, string];
  /** Column heading for `word.context`; the column is dropped when absent. */
  contextHeader?: string;
  /** Replaces the sentence under the heading. */
  intro?: string;
}

export function generateSpotcheckHtml(options: SpotcheckOptions): string {
  const {
    engine,
    audioPath,
    words,
    sampleSize = 15,
    leadInS = 0.3,
    playMs = 1200,
    choices = ['hit', 'miss'],
    contextHeader,
    intro,
  } = options;
  const sample = sampleWordsEvenly(words, sampleSize);

  const rows = sample
    .map((word, index) => {
      const start = word.startS ?? 0;
      const seekTo = Math.max(0, start - leadInS);
      const contextCell =
        contextHeader === undefined ? '' : `\n        <td>${escapeHtml(word.context ?? '')}</td>`;
      const rowChoices = word.choices ?? choices;
      return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(word.text)}</td>${contextCell}
        <td>${start.toFixed(2)}s</td>
        <td><button type="button" onclick="playAt(${seekTo})">play</button></td>
        <td>
          <label><input type="radio" name="row-${index}" value="${escapeHtml(rowChoices[0])}"> ${escapeHtml(rowChoices[0])}</label>
          <label><input type="radio" name="row-${index}" value="${escapeHtml(rowChoices[1])}"> ${escapeHtml(rowChoices[1])}</label>
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
<p>${escapeHtml(intro ?? `${sample.length} sampled words. Press play to hear ~${(playMs / 1000).toFixed(1)}s starting ${leadInS.toFixed(1)}s before the claimed timestamp, then mark ${choices[0]} or ${choices[1]}.`)}</p>
<audio id="player" src="${escapeHtml(audioPath)}" preload="none"></audio>
<table>
  <thead><tr><th>#</th><th>word</th>${contextHeader === undefined ? '' : `<th>${escapeHtml(contextHeader)}</th>`}<th>claimed start</th><th></th><th>result</th></tr></thead>
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
    stopTimer = setTimeout(function () { player.pause(); }, ${playMs});
  }
  function showSummary() {
    var radios = document.querySelectorAll('input[type=radio]:checked');
    var total = ${sample.length};
    // Counted by answer rather than against one expected value, because a
    // page may carry rows that ask different questions.
    var counts = {};
    var order = [];
    radios.forEach(function (r) {
      if (counts[r.value] === undefined) { counts[r.value] = 0; order.push(r.value); }
      counts[r.value] += 1;
    });
    order.sort();
    var parts = order.map(function (v) { return v + ' ' + counts[v]; });
    var rated = radios.length;
    var text = '${escapeJsString(engine)}: ' + parts.join(', ') + ' (' + rated + '/' + total + ' rated)';
    document.getElementById('summary').value = text;
  }
</script>
</body>
</html>
`;
}
