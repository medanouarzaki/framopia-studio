import { tokenScript, type AlignmentRow } from './align-review.js';

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

/**
 * A row on the sheet. `previousDraftText` is set only on the re-review sheet,
 * where the question is not "is this pairing right" but "did this change make
 * it right" — so the reviewer has to see both.
 */
export type SheetRow = AlignmentRow & { previousDraftText?: string | null };

export interface SheetInputs {
  reel: string;
  headSha: string;
  generatedAt: string;
  cacheEntry: string;
  promptVersion: number | null;
  rows: SheetRow[];
  /**
   * `rereview` holds only the rows a change moved and adds the old pairing
   * beside the new one. Its localStorage key differs, so a partial pass over
   * one sheet can never restore into the other.
   */
  variant?: 'review' | 'rereview';
  /** Re-review only: the sha the previous pairing was generated at. */
  previousSha?: string;
  /** Stamped into the downloaded reference; the browser cannot compute it. */
  schemaVersion: number;
  alignerHash: string;
  /**
   * Verdicts to pre-fill, by word id. Shown as restored and fully editable —
   * they are somebody's earlier judgement, not a new one.
   */
  restored?: Record<string, string>;
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
  const rereview = input.variant === 'rereview';
  const facts: Fact[] = [
    { label: 'reel', value: input.reel },
    { label: 'cache entry', value: input.cacheEntry },
    { label: 'prompt version', value: `v${input.promptVersion ?? '?'}` },
    { label: 'aligner sha', value: input.headSha.slice(0, 12) },
    { label: 'aligner', value: input.alignerHash.slice(0, 12) },
    { label: rereview ? 'rows moved' : 'rows', value: String(input.rows.length) },
    ...(rereview && input.previousSha !== undefined
      ? [{ label: 'was', value: input.previousSha.slice(0, 12) }]
      : []),
  ];

  const rows = input.rows
    .map((r) => {
      const cls = r.crossScript ? 'cross' : 'same';
      return `<tr class="row ${cls}" data-word-id="${esc(r.wordId)}" data-i="${r.index}" data-cross="${r.crossScript ? '1' : '0'}">
<td class="idx">${r.index}<span class="wid">${esc(r.wordId)}</span></td>
<td class="word">${token(r.wordText, r.wordScript)}</td>
${rereview ? `<td class="draft was">${token(r.previousDraftText ?? '', (r.previousDraftText ?? null) === null ? null : tokenScript(r.previousDraftText as string))}</td>` : ''}
<td class="draft">${token(r.draftText ?? '', r.draftText === null ? null : r.draftScript)}</td>
<td class="op"><span class="pill op-${esc(r.op)}">${esc(r.op)}</span></td>
<td class="time">${secs(r.draftStart)}<span class="sep">–</span>${secs(r.draftEnd)}</td>
<td class="scripts">${r.draftScript === null ? '—' : r.crossScript ? '<span class="pill warn">cross</span>' : '<span class="pill quiet">same</span>'}</td>
<td class="verdicts">
<button class="v" data-v="correct">correct</button>
<button class="v" data-v="wrong">wrong</button>
<button class="v" data-v="misheard" title="the pairing is in the right place but the machine heard a different word">misheard</button>
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

  /*
   * A fingerprint of the row set, so saved marks are restored only onto the
   * rows they were made against. The reel and the sha are not enough: a
   * re-review sheet holds only the rows a change moved, and a different change
   * moves a different set.
   */
  const rowSetFingerprint = payload.map((w) => w.wordId).join(',');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${rereview ? 'Re-review' : 'Alignment review'} — ${esc(input.reel)}</title>
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
.progress {
  color: var(--muted); font-size: 12.5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.restored-note { margin-top: 8px; color: var(--warn); font-size: 12.5px; }
tbody tr.restored td.verdicts button.sel { background: var(--warn); border-color: var(--warn); }
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
.draft.was .tok { color: var(--faint); }
.draft.was { border-right: 1px solid var(--line); }
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
<h1>${rereview ? 'Re-review' : 'Alignment review'} <span class="accent">·</span> ${esc(input.reel)}</h1>
<div class="provenance">
${facts.map((f) => `<div class="fact"><span class="k">${esc(f.label)}</span><span class="v">${esc(f.value)}</span></div>`).join('\n')}
</div>
<div class="meta">${cross} cross-script &nbsp;·&nbsp; ${unanchored} with no draft token &nbsp;·&nbsp; generated ${esc(input.generatedAt)}</div>
<div class="restored-note" id="restored-note" hidden></div>
<div class="bar">
<button class="f on" data-f="all">all rows</button>
<button class="f" data-f="cross">cross-script only</button>
<button class="f" data-f="unset">unset only</button>
<span class="spacer"></span>
<div class="counts">
<span>correct <b id="c-correct">0</b></span>
<span>wrong <b id="c-wrong">0</b></span>
<span>misheard <b id="c-misheard">0</b></span>
<span>two tokens <b id="c-two-tokens">0</b></span>
<span>no token <b id="c-no-token">0</b></span>
<span class="left">unset <b id="c-unset">0</b></span>
</div>
<span id="progress" class="progress">marked 0 of ${input.rows.length}</span>
<button id="download">Download reference</button>
</div>
</header>
<main>
<table>
<thead><tr>
<th>#</th><th>corrected word</th>${rereview ? '<th>was paired with</th>' : ''}<th>${rereview ? 'now paired with' : 'draft token'}</th><th>op</th><th>interval (s)</th><th>scripts</th><th>verdict</th><th>note</th>
</tr></thead>
<tbody>
${rows}
</tbody>
</table>
</main>
<footer>
${
  rereview
    ? '<strong>misheard</strong> means the pairing is in the right place but the machine heard a different word. Only the rows this change moved. The left column is what the aligner paired the word with when the reference was made; the right is what it pairs it with now. A row that was marked <strong>wrong</strong> and has moved is a candidate repair and nothing more — the reference said the old pairing was wrong and says nothing about whether the new one is right. Until this sheet is filled in, the improvement count is a candidate figure.'
    : "<strong>misheard</strong> is for a pairing that is in the right place where the machine heard a different word — it counts as a correct alignment and is tracked separately, because it measures the transcription rather than the alignment. A verdict here is a human statement about which draft token a corrected word really came from. It is the only non-circular measure of aligner correctness in this project: a checker reading the aligner's own output cannot see a wrong pairing, because the aligner is self-consistent with it. Rows whose two sides share a script are dimmed — those are the pairings Levenshtein had evidence for — but they are fully reviewable, because a fix that breaks them is a regression."
}
</footer>
<script>
(function () {
  var REEL = ${JSON.stringify(input.reel)};
  var HEAD = ${JSON.stringify(input.headSha)};
  var GENERATED = ${JSON.stringify(input.generatedAt)};
  var WORDS = ${JSON.stringify(payload)};
  var VARIANT = ${JSON.stringify(input.variant ?? 'review')};
  var SCHEMA_VERSION = ${JSON.stringify(input.schemaVersion)};
  var ALIGNER_HASH = ${JSON.stringify(input.alignerHash)};
  var ROW_SET = ${JSON.stringify(rowSetFingerprint)};
  var RESTORED = ${JSON.stringify(input.restored ?? {})};

  /*
   * Keyed by the row set as well as the reel and the sha. A re-review sheet
   * holds only the rows a change moved; restoring one change's marks onto
   * another change's rows would be worse than losing them.
   */
  function fingerprint(text) {
    var h = 5381;
    for (var i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }
  var KEY = 'framopia.align-review.' + VARIANT + '.' + REEL + '.' + HEAD + '.' + fingerprint(ROW_SET);

  /*
   * The key before the row-set fingerprint was added, and before marks were
   * keyed by word id rather than by the corrected-word index. Read once, and
   * only when the current key holds nothing: a reviewer whose marks were on
   * screen when the download lost them still has them in this browser, and
   * they are worth more than the tidiness of dropping the old shape.
   */
  var LEGACY_KEY = 'framopia.align-review.' + VARIANT + '.' + REEL + '.' + HEAD;
  var INDEX_TO_ID = ${JSON.stringify(Object.fromEntries(input.rows.map((r) => [String(r.index), r.wordId])))};

  /*
   * Keyed by word id, never by position or by the corrected-word index.
   *
   * The two used to be mixed: rows carried data-i, the corrected-word index,
   * and the download walked positions 0..n-1. On the main sheet every corrected
   * word is a row so the two coincide; on a re-review sheet only the moved rows
   * are present, the indices are sparse, and the download found a mark only
   * where a row's index happened to equal its own position. Seventeen marks on
   * screen, three in the file.
   */
  var state = {};
  var restoredCount = 0;
  var fromLegacy = 0;
  try {
    var saved = window.localStorage.getItem(KEY);
    if (saved) state = JSON.parse(saved) || {};
  } catch (e) {
    state = {};
  }

  if (Object.keys(state).length === 0) {
    try {
      var legacy = window.localStorage.getItem(LEGACY_KEY);
      var old = legacy ? JSON.parse(legacy) || {} : {};
      for (var k in old) {
        if (!Object.prototype.hasOwnProperty.call(old, k)) continue;
        var id = INDEX_TO_ID[k];
        if (!id || !old[k] || !old[k].verdict) continue;
        state[id] = { verdict: old[k].verdict, note: old[k].note, restored: true };
        fromLegacy += 1;
      }
    } catch (e) {
      /* an unreadable legacy store is simply no legacy store */
    }
  }
  for (var rid in RESTORED) {
    if (Object.prototype.hasOwnProperty.call(RESTORED, rid) && !state[rid]) {
      state[rid] = { verdict: RESTORED[rid], restored: true };
    }
  }
  for (var sk in state) {
    if (Object.prototype.hasOwnProperty.call(state, sk) && state[sk] && state[sk].verdict) {
      restoredCount += 1;
    }
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

  function entryFor(id) {
    return state[String(id)] || {};
  }

  function rowId(tr) {
    return tr.getAttribute('data-word-id');
  }

  function paint() {
    var counts = { correct: 0, wrong: 0, misheard: 0, 'two-tokens': 0, 'no-token': 0 };
    var unset = 0;
    rows.forEach(function (tr) {
      var e = entryFor(rowId(tr));
      var verdict = e.verdict || null;
      if (verdict) counts[verdict] += 1;
      else unset += 1;
      tr.classList.toggle('marked', !!verdict);
      tr.classList.toggle('restored', !!verdict && e.restored === true);
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
    var progress = document.getElementById('progress');
    if (progress) progress.textContent = 'marked ' + (rows.length - unset) + ' of ' + rows.length;
    return unset;
  }

  rows.forEach(function (tr) {
    var id = rowId(tr);
    var input = tr.querySelector('.note input');
    var e = entryFor(id);
    if (e.note) input.value = e.note;
    Array.prototype.forEach.call(tr.querySelectorAll('button.v'), function (b) {
      b.addEventListener('click', function () {
        var cur = entryFor(id);
        var v = b.getAttribute('data-v');
        cur.verdict = cur.verdict === v ? null : v;
        cur.restored = false;
        state[String(id)] = cur;
        save();
        paint();
      });
    });
    input.addEventListener('input', function () {
      var cur = entryFor(id);
      cur.note = input.value;
      state[String(id)] = cur;
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
    /*
     * One entry per displayed row, in display order, always. An unmarked row
     * is written with a null verdict rather than omitted: the file is a record
     * of what was reviewed, and a row missing from it used to be
     * indistinguishable from a row nobody looked at.
     */
    var entries = [];
    var marked = 0;
    for (var r = 0; r < rows.length; r += 1) {
      var tr = rows[r];
      var id = rowId(tr);
      var e = entryFor(id);
      var word = null;
      for (var w = 0; w < WORDS.length; w += 1) {
        if (WORDS[w].wordId === id) { word = WORDS[w]; break; }
      }
      if (word === null) {
        window.alert(
          'Download refused: row ' + id + ' is on screen but not in the sheet data. ' +
          'Nothing was written. Please report this — your marks are still here.'
        );
        return;
      }
      var out = {
        wordId: word.wordId,
        wordText: word.wordText,
        draftTokenText: word.draftTokenText,
        verdict: e.verdict || null
      };
      if (e.note) out.note = e.note;
      if (e.verdict) marked += 1;
      entries.push(out);
    }

    /*
     * The counts come off the same walk that produced the entries, so they
     * cannot describe a different file from the one being written.
     */
    if (entries.length !== rows.length) {
      window.alert(
        'Download refused: ' + entries.length + ' entries for ' + rows.length +
        ' rows on screen. Nothing was written, and your marks are still here.'
      );
      return;
    }

    var doc = {
      schemaVersion: SCHEMA_VERSION,
      reel: REEL,
      generatedAt: GENERATED,
      headSha: HEAD,
      alignerHash: ALIGNER_HASH,
      rowCount: entries.length,
      markedCount: marked,
      entries: entries
    };
    var blob = new Blob([JSON.stringify(doc, null, 2) + '\\n'], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = REEL + (VARIANT === 'rereview' ? '.rereview' : '') + '.align-reference.json';
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

  var note = document.getElementById('restored-note');
  if (note && restoredCount > 0) {
    note.hidden = false;
    note.textContent =
      restoredCount + ' of ' + rows.length +
      ' marks were restored' +
      (fromLegacy > 0 ? ' from this browser, saved before the download bug was fixed,' : '') +
      '. They are highlighted, and you can change any of them.';
  }

  paint();
})();
</script>
</body>
</html>
`;
}
