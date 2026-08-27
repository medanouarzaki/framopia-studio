import type { AlignmentRow } from './align-review.js';

/**
 * The review sheet, as one self-contained HTML file. No CDN, no build step,
 * no framework: it has to open from the filesystem with `open`, and a review
 * pass that fails because a script did not load is a review pass lost.
 *
 * Framopia brand per PROJECT_SPEC §6 — dark-first, #ED1C24 the single accent.
 * This is the first thing Block 8 shows the user, so it is styled as product
 * rather than as a diagnostic dump.
 *
 * It lives in core rather than beside the CLI so that the markup and the
 * behaviour it carries can be executed in a DOM by `npm run check`. Block 8
 * session 1 verified the structure and never ran the script.
 */

export interface SheetInputs {
  reel: string;
  headSha: string;
  generatedAt: string;
  cacheEntry: string;
  promptVersion: number | null;
  rows: AlignmentRow[];
}

interface Fact {
  label: string;
  value: string;
}

const escapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => escapes[c] as string);
}

/**
 * `dir` is set on the token's own element, never on the row or the container.
 * A row carries an Arabizi word beside an Arabic-script token and a bidi
 * algorithm given the whole row will reorder the Latin half around it — which
 * is exactly the failure mode that made `نم` appear in a prompt for `من`.
 */
function token(text: string, script: string | null): string {
  if (script === null) return '<span class="tok none">—</span>';
  const dir = script === 'arabic' ? ' dir="rtl"' : ' dir="ltr"';
  return `<span class="tok ${script}"${dir}>${esc(text)}</span>`;
}

function secs(value: number | null): string {
  return value === null ? '—' : value.toFixed(3);
}

export function renderSheet(input: SheetInputs): string {
  const cross = input.rows.filter((r) => r.crossScript).length;
  const unanchored = input.rows.filter((r) => r.draftIndex === null).length;

  /*
   * On screen, not only in the JSON. A reel holds one cache entry per
   * configuration and the verdicts below are a judgement of one of them; a
   * reviewer who cannot see which is judging something he cannot name.
   */
  const facts: Fact[] = [
    { label: 'reel', value: input.reel },
    { label: 'cache entry', value: input.cacheEntry },
    { label: 'prompt version', value: `v${input.promptVersion ?? '?'}` },
    { label: 'aligner sha', value: input.headSha.slice(0, 12) },
    { label: 'rows', value: String(input.rows.length) },
  ];

  const rows = input.rows
    .map((r) => {
      const cls = r.crossScript ? 'cross' : 'same';
      return `<tr class="row ${cls}" data-i="${r.index}" data-cross="${r.crossScript ? '1' : '0'}">
<td class="idx">${r.index}<span class="wid">${esc(r.wordId)}</span></td>
<td class="word">${token(r.wordText, r.wordScript)}</td>
<td class="draft">${token(r.draftText ?? '', r.draftText === null ? null : r.draftScript)}</td>
<td class="op"><span class="pill op-${esc(r.op)}">${esc(r.op)}</span></td>
<td class="time">${secs(r.draftStart)}<span class="sep">–</span>${secs(r.draftEnd)}</td>
<td class="scripts">${r.draftScript === null ? '—' : r.crossScript ? '<span class="pill warn">cross</span>' : '<span class="pill quiet">same</span>'}</td>
<td class="verdicts">
<button class="v" data-v="correct">correct</button>
<button class="v" data-v="wrong">wrong</button>
<button class="v" data-v="two-tokens">two tokens</button>
<button class="v" data-v="no-token">no token</button>
</td>
<td class="note"><input type="text" placeholder="note" aria-label="note for word ${r.index}"></td>
</tr>`;
    })
    .join('\n');

  const payload = input.rows.map((r) => ({
    wordId: r.wordId,
    wordText: r.wordText,
    draftTokenText: r.draftText,
  }));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Alignment review — ${esc(input.reel)}</title>
<style>
:root {
  --bg: #0e0f11;
  --panel: #16181c;
  --panel-2: #1c1f24;
  --line: #262a31;
  --text: #e8eaed;
  --muted: #9aa1ab;
  --faint: #6b7280;
  --accent: #ED1C24;
  --ok: #3fb950;
  --warn: #d29922;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
  -webkit-font-smoothing: antialiased;
}
header {
  position: sticky; top: 0; z-index: 5;
  background: rgba(14,15,17,.94);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line);
  padding: 22px 32px 16px;
}
h1 { margin: 0 0 4px; font-size: 19px; font-weight: 600; letter-spacing: -.01em; }
h1 .accent { color: var(--accent); }
.meta { color: var(--faint); font-size: 12.5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin-top: 10px; }
.provenance { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.fact {
  display: flex; align-items: baseline; gap: 8px;
  background: var(--panel); border: 1px solid var(--line); border-radius: 7px;
  padding: 5px 11px;
}
.fact .k { font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--faint); }
.fact .v { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; color: var(--text); }
.bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 16px; }
.spacer { flex: 1 1 auto; }
button {
  font: inherit; color: var(--text); background: var(--panel-2);
  border: 1px solid var(--line); border-radius: 7px;
  padding: 7px 13px; cursor: pointer; transition: border-color .12s, background .12s;
}
button:hover { border-color: #3a4049; }
button.on { border-color: var(--accent); background: rgba(237,28,36,.14); }
.counts { display: flex; gap: 18px; font-size: 13px; color: var(--muted); }
.counts b { color: var(--text); font-variant-numeric: tabular-nums; font-weight: 600; }
.counts .left b { color: var(--accent); }
main { padding: 24px 32px 96px; }
table { width: 100%; border-collapse: collapse; }
thead th {
  text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .09em;
  color: var(--faint); font-weight: 600; padding: 0 12px 10px; border-bottom: 1px solid var(--line);
}
tbody tr { border-bottom: 1px solid rgba(38,42,49,.6); }
tbody tr.same { opacity: .48; }
tbody tr.same:hover, tbody tr.marked { opacity: 1; }
tbody tr:hover { background: var(--panel); }
td { padding: 11px 12px; vertical-align: middle; }
.idx { color: var(--faint); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; white-space: nowrap; }
.wid { display: block; color: #4b525c; font-size: 11px; }
.tok { font-size: 17px; }
.tok.arabic { font-size: 19px; }
.tok.none { color: var(--faint); }
.draft .tok { color: var(--muted); }
.time { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.time .sep { color: var(--faint); padding: 0 3px; }
.pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; border: 1px solid var(--line); background: var(--panel-2); color: var(--muted); }
.pill.warn { color: var(--warn); border-color: rgba(210,153,34,.4); }
.pill.quiet { color: var(--faint); }
.op-substitute { color: var(--text); }
.op-insert { color: var(--accent); border-color: rgba(237,28,36,.45); }
.verdicts { white-space: nowrap; }
.verdicts button { padding: 5px 10px; font-size: 12.5px; margin-right: 5px; }
.verdicts button.sel { background: var(--accent); border-color: var(--accent); color: #fff; }
.note input {
  width: 100%; min-width: 120px; font: inherit; font-size: 13px;
  background: transparent; border: 1px solid transparent; border-radius: 6px;
  padding: 5px 8px; color: var(--muted);
}
.note input:hover { border-color: var(--line); }
.note input:focus { outline: none; border-color: var(--accent); color: var(--text); }
tr[hidden] { display: none; }
footer { padding: 0 32px 40px; color: var(--faint); font-size: 12.5px; max-width: 900px; }
</style>
</head>
<body>
<header>
<h1>Alignment review <span class="accent">·</span> ${esc(input.reel)}</h1>
<div class="provenance">
${facts.map((f) => `<div class="fact"><span class="k">${esc(f.label)}</span><span class="v">${esc(f.value)}</span></div>`).join('\n')}
</div>
<div class="meta">${cross} cross-script &nbsp;·&nbsp; ${unanchored} with no draft token &nbsp;·&nbsp; generated ${esc(input.generatedAt)}</div>
<div class="bar">
<button class="f on" data-f="all">all rows</button>
<button class="f" data-f="cross">cross-script only</button>
<button class="f" data-f="unset">unset only</button>
<span class="spacer"></span>
<div class="counts">
<span>correct <b id="c-correct">0</b></span>
<span>wrong <b id="c-wrong">0</b></span>
<span>two tokens <b id="c-two-tokens">0</b></span>
<span>no token <b id="c-no-token">0</b></span>
<span class="left">unset <b id="c-unset">0</b></span>
</div>
<button id="download">Download reference</button>
</div>
</header>
<main>
<table>
<thead><tr>
<th>#</th><th>corrected word</th><th>draft token</th><th>op</th><th>interval (s)</th><th>scripts</th><th>verdict</th><th>note</th>
</tr></thead>
<tbody>
${rows}
</tbody>
</table>
</main>
<footer>
A verdict here is a human statement about which draft token a corrected word really came from. It is the only non-circular measure of aligner correctness in this project: a checker reading the aligner's own output cannot see a wrong pairing, because the aligner is self-consistent with it. Rows whose two sides share a script are dimmed — those are the pairings Levenshtein had evidence for — but they are fully reviewable, because a fix that breaks them is a regression.
</footer>
<script>
(function () {
  var REEL = ${JSON.stringify(input.reel)};
  var HEAD = ${JSON.stringify(input.headSha)};
  var GENERATED = ${JSON.stringify(input.generatedAt)};
  var WORDS = ${JSON.stringify(payload)};
  var KEY = 'framopia.align-review.' + REEL + '.' + HEAD;

  var state = {};
  try {
    var saved = window.localStorage.getItem(KEY);
    if (saved) state = JSON.parse(saved);
  } catch (e) {
    state = {};
  }

  var rows = Array.prototype.slice.call(document.querySelectorAll('tr.row'));
  var filter = 'all';

  function save() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* a full or disabled store must not stop the review */
    }
  }

  function entryFor(i) {
    return state[String(i)] || {};
  }

  function paint() {
    var counts = { correct: 0, wrong: 0, 'two-tokens': 0, 'no-token': 0 };
    var unset = 0;
    rows.forEach(function (tr) {
      var i = tr.getAttribute('data-i');
      var e = entryFor(i);
      var verdict = e.verdict || null;
      if (verdict) counts[verdict] += 1;
      else unset += 1;
      tr.classList.toggle('marked', !!verdict);
      Array.prototype.forEach.call(tr.querySelectorAll('button.v'), function (b) {
        b.classList.toggle('sel', b.getAttribute('data-v') === verdict);
      });
      var visible =
        filter === 'all' ||
        (filter === 'cross' && tr.getAttribute('data-cross') === '1') ||
        (filter === 'unset' && !verdict);
      tr.hidden = !visible;
    });
    Object.keys(counts).forEach(function (k) {
      document.getElementById('c-' + k).textContent = String(counts[k]);
    });
    document.getElementById('c-unset').textContent = String(unset);
    return unset;
  }

  rows.forEach(function (tr) {
    var i = tr.getAttribute('data-i');
    var input = tr.querySelector('.note input');
    var e = entryFor(i);
    if (e.note) input.value = e.note;
    Array.prototype.forEach.call(tr.querySelectorAll('button.v'), function (b) {
      b.addEventListener('click', function () {
        var cur = entryFor(i);
        var v = b.getAttribute('data-v');
        cur.verdict = cur.verdict === v ? null : v;
        state[String(i)] = cur;
        save();
        paint();
      });
    });
    input.addEventListener('input', function () {
      var cur = entryFor(i);
      cur.note = input.value;
      state[String(i)] = cur;
      save();
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('button.f'), function (b) {
    b.addEventListener('click', function () {
      filter = b.getAttribute('data-f');
      Array.prototype.forEach.call(document.querySelectorAll('button.f'), function (o) {
        o.classList.toggle('on', o === b);
      });
      paint();
    });
  });

  document.getElementById('download').addEventListener('click', function () {
    var entries = [];
    for (var i = 0; i < WORDS.length; i += 1) {
      var e = entryFor(i);
      if (!e.verdict) continue;
      var out = {
        wordId: WORDS[i].wordId,
        wordText: WORDS[i].wordText,
        draftTokenText: WORDS[i].draftTokenText,
        verdict: e.verdict
      };
      if (e.note) out.note = e.note;
      entries.push(out);
    }
    var doc = {
      schemaVersion: 1,
      reel: REEL,
      generatedAt: GENERATED,
      headSha: HEAD,
      entries: entries
    };
    var blob = new Blob([JSON.stringify(doc, null, 2) + '\\n'], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = REEL + '.align-reference.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  window.addEventListener('beforeunload', function (ev) {
    if (paint() === 0) return undefined;
    ev.preventDefault();
    ev.returnValue = '';
    return '';
  });

  paint();
})();
</script>
</body>
</html>
`;
}
