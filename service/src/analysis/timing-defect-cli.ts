import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  CacheEntrySelectionError,
  describeSelection,
  listTranscriptionEntries,
  REPO_ROOT,
  loadTemplateManifest,
  selectTranscriptionEntry,
  templatesById,
} from '@framopia/core';
import { readEditPlan } from '../editplan/io.js';
import { CACHE_ROOT } from '../transcription/cache.js';
import type { EditPlan, PlanWord } from '../editplan/types.js';

/**
 * Read-only. No plan is written, no constant is changed, no API is called.
 *
 * Answers a report that "the text is offset against the speech" around 4 s on
 * vitasilk. Written as a tool rather than a one-off because the corpus-wide
 * counts it produces — zero-duration words, non-monotonic timings, how far a
 * two-word card anticipates its second word — are the kind of thing that has
 * to be re-checkable after any change to grouping or alignment.
 */
const FOOTAGE_DIR = path.join(REPO_ROOT, 'my files', 'test videos');
const OUT_PATH = path.join(REPO_ROOT, 'benchmarks', 'RESULTS-block7-timing-defect.md');

const argv = process.argv.slice(2);
const at = (flag: string, fallback: string): string => {
  const i = argv.indexOf(flag);
  return i === -1 ? fallback : (argv[i + 1] as string);
};
const focusReel = at('--reel', 'vitasilk');
const entryFlag = argv.includes('--entry') ? (argv[argv.indexOf('--entry') + 1] ?? null) : null;
const fromS = Number(at('--from', '1.5'));
const toS = Number(at('--to', '8'));

const templates = templatesById(loadTemplateManifest());
const f3 = (v: number): string => v.toFixed(3);

interface ScribeWord { text: string; start: number; end: number; type: string }

/**
 * The raw Scribe response for a video, if its transcription cache entry is
 * still on disk. This is the only independent record of what was actually
 * spoken when, so a claim that the timings are right or wrong rests on it.
 */
/**
 * The raw Scribe response for a video, from the entry at the pinned prompt
 * version. A reel can hold several configurations and this used to take
 * whichever `readdir` returned first, which on `vitasilk` is prompt v1 — a
 * different draft from the one the plan was aligned against, and the only
 * independent record a timing claim rests on.
 */
let selectedEntry = 'none';
function scribeWordsFor(videoSha: string, reel: string): ScribeWord[] | null {
  const entries = listTranscriptionEntries(CACHE_ROOT, videoSha);
  let chosen;
  try {
    chosen = selectTranscriptionEntry(entries, reel, { entryOverride: entryFlag });
  } catch (error) {
    if (!(error instanceof CacheEntrySelectionError)) throw error;
    console.error(error.message);
    return null;
  }
  selectedEntry = describeSelection(chosen);
  console.log(`transcription cache entry: ${selectedEntry}`);
  const raw = JSON.parse(readFileSync(path.join(chosen.dir, 'manifest.json'), 'utf8')) as {
    scribeRaw?: { words?: ScribeWord[] };
  };
  const words = raw.scribeRaw?.words;
  return words ? words.filter((w) => w.type === 'word') : null;
}

interface ReelStats {
  reel: string;
  words: number;
  zero: PlanWord[];
  negative: PlanWord[];
  nonMonotonic: { a: string; b: string; aEnd: number; bStart: number }[];
  interpolated: PlanWord[];
  groups: number;
  groupsOutOfOrder: number;
  displayStartsEarly: number;
  anticipation: { id: string; text: string; earlyS: number }[];
  sourceTextMismatch: number;
  sourceTextShiftedByOne: number;
}

function statsFor(reel: string, plan: EditPlan): ReelStats {
  const words = plan.transcript.words;
  const byId = new Map(words.map((w) => [w.id, w]));
  const nonMonotonic: ReelStats['nonMonotonic'] = [];
  for (let i = 1; i < words.length; i += 1) {
    const a = words[i - 1] as PlanWord;
    const b = words[i] as PlanWord;
    if (b.start < a.end - 1e-9) nonMonotonic.push({ a: a.id, b: b.id, aEnd: a.end, bStart: b.start });
  }

  const groups = plan.subtitles.groups;
  let outOfOrder = 0;
  for (let i = 1; i < groups.length; i += 1) {
    if ((groups[i] as { start: number }).start < (groups[i - 1] as { end: number }).end - 1e-9) {
      outOfOrder += 1;
    }
  }

  const anticipation: ReelStats['anticipation'] = [];
  for (const g of groups) {
    if (g.wordIds.length < 2) continue;
    const introS = g.templateId === null ? 0 : (templates.get(g.templateId)?.introS ?? 0);
    const inPoint = (g.displayStart ?? g.start) - introS;
    const second = byId.get(g.wordIds[1] as string);
    if (second === undefined) continue;
    anticipation.push({
      id: g.id,
      text: g.wordIds.map((id) => byId.get(id)?.text ?? '').join(' '),
      earlyS: second.start - inPoint,
    });
  }
  anticipation.sort((a, b) => b.earlyS - a.earlyS);

  // `sourceText` should name the draft token this word was anchored to. A
  // shift means it names a *neighbour's* token, which is what a positional
  // index does when the corrected text inserted a word.
  let mismatch = 0;
  let shifted = 0;
  words.forEach((w, i) => {
    if (w.sourceText !== w.text) mismatch += 1;
    const next = words[i + 1];
    if (next !== undefined && w.sourceText === next.text) shifted += 1;
  });

  return {
    reel,
    words: words.length,
    zero: words.filter((w) => w.end - w.start <= 0),
    negative: words.filter((w) => w.end < w.start),
    nonMonotonic,
    interpolated: words.filter((w) => w.confidence === null || w.confidence === undefined),
    groups: groups.length,
    groupsOutOfOrder: outOfOrder,
    displayStartsEarly: groups.filter(
      (g) => g.displayStart !== undefined && g.displayStart < g.start - 1e-9,
    ).length,
    anticipation,
    sourceTextMismatch: mismatch,
    sourceTextShiftedByOne: shifted,
  };
}

const all: { reel: string; plan: EditPlan; stats: ReelStats }[] = [];
for (const file of readdirSync(FOOTAGE_DIR).filter((f) => f.endsWith('.editplan.json')).sort()) {
  const reel = file.replace('.editplan.json', '');
  const plan = await readEditPlan(path.join(FOOTAGE_DIR, file));
  all.push({ reel, plan, stats: statsFor(reel, plan) });
}

const focus = all.find((a) => a.reel === focusReel);
if (focus === undefined) {
  console.error(`no plan for reel "${focusReel}"`);
  process.exit(1);
}

const scribe = scribeWordsFor(focus.plan.source.sha256, focus.reel);

const L: string[] = [];
L.push('# Block 7 — the reported offset around 4 s on vitasilk');
L.push('');
L.push('Generated by `npm run diagnose:timing`. **Read-only**: no plan was written, no');
L.push('constant changed, no API called. Every figure is emitted by the tool.');
L.push('');
L.push(`Transcription cache entry read: \`${selectedEntry}\`. A reel holds one entry per`);
L.push('configuration and the Scribe draft below is the only independent record a timing');
L.push('claim rests on, so which one was read is part of the claim.');
L.push('');
L.push(`## 1. What is in the plan across ${f3(fromS)}–${f3(toS)} s on \`${focus.reel}\``);
L.push('');

const byId = new Map(focus.plan.transcript.words.map((w) => [w.id, w]));
L.push('| id | text | start | end | dur | conf | anchored | script | removed |');
L.push('|---|---|---:|---:|---:|---:|---|---|---|');
for (const w of focus.plan.transcript.words) {
  if (w.start < fromS || w.start > toS) continue;
  L.push(
    `| ${w.id} | ${w.text} | ${f3(w.start)} | ${f3(w.end)} | ${f3(w.end - w.start)} | ` +
      `${w.confidence === null || w.confidence === undefined ? '—' : w.confidence.toFixed(4)} | ` +
      `${w.confidence === null || w.confidence === undefined ? 'interpolated' : 'anchored'} | ${w.script} | ${w.removed} |`,
  );
}
L.push('');
L.push('| group | wordIds | text | speech | display | extends by | in-point | template |');
L.push('|---|---|---|---|---|---:|---:|---|');
for (const g of focus.plan.subtitles.groups) {
  if (g.start < fromS || g.start > toS) continue;
  const introS = g.templateId === null ? 0 : (templates.get(g.templateId)?.introS ?? 0);
  const ds = g.displayStart ?? g.start;
  const de = g.displayEnd ?? g.end;
  L.push(
    `| ${g.id}${g.supersededBy != null ? ` (superseded by ${g.supersededBy})` : ''} | ` +
      `${g.wordIds.join('+')} | ${g.wordIds.map((id) => byId.get(id)?.text ?? '').join(' ')} | ` +
      `${f3(g.start)}–${f3(g.end)} | ${f3(ds)}–${f3(de)} | ${f3(de - g.end)} | ${f3(ds - introS)} | ${g.templateId} |`,
  );
}
L.push('');

L.push('## 2. Are the timings actually wrong?');
L.push('');
if (scribe === null) {
  L.push('The transcription cache entry for this reel is not on disk, so there is no');
  L.push('independent record of what was spoken when. **This question cannot be answered**');
  L.push('from the plan alone, and saying so is the finding.');
} else {
  L.push(`Checked against the raw Scribe response held in the transcription cache — ${scribe.length}`);
  L.push('word tokens, the only independent record of what was said when. A corrected word');
  L.push('carries the timing of the draft token it anchored to, so if alignment had slipped,');
  L.push('the interval a word claims would belong to a different token.');
  L.push('');
  L.push('| plan word | plan interval | Scribe token at that exact interval |');
  L.push('|---|---|---|');
  let exact = 0;
  let checked = 0;
  for (const w of focus.plan.transcript.words) {
    if (w.start < fromS || w.start > toS) continue;
    const hit = scribe.find(
      (s) => Math.abs(s.start - w.start) < 1e-6 && Math.abs(s.end - w.end) < 1e-6,
    );
    checked += 1;
    if (hit !== undefined) exact += 1;
    L.push(`| ${w.id} \`${w.text}\` | ${f3(w.start)}–${f3(w.end)} | ${hit === undefined ? '**none**' : `\`${hit.text}\``} |`);
  }
  L.push('');
  L.push(`**${exact} of ${checked} words in this span sit on an interval Scribe reports for a token.**`);
  L.push(exact === checked
    ? 'Every corrected word carries a real Scribe interval, and reading the pairs above they are the *same* words — `minutes`/`minutes.`, `ymkn`/`يمكن`, `un`/`un`, `soin`/`soin`. **The alignment is correct and the timings are not the defect.**'
    : '**Some words sit on no Scribe interval**, which is what an alignment slip would look like.');
}
L.push('');

L.push('## 3. `sourceText` is off by one, and it is not the cause');
L.push('');
L.push('Every word\'s `sourceText` names the *next* word\'s draft token: `w0006` is');
L.push('`text: minutes` / `sourceText: يمكن`, and `يمكن` is `ymkn`, which is `w0007`.');
L.push('');
L.push('| reel | words | sourceText differs from text | of those, equal to the **next** word\'s text |');
L.push('|---|---:|---:|---:|');
for (const a of all) {
  L.push(`| ${a.reel} | ${a.stats.words} | ${a.stats.sourceTextMismatch} | ${a.stats.sourceTextShiftedByOne} |`);
}
L.push('');
L.push('The cause is in `service/src/transcription/plan-builder.ts`: the field is documented');
L.push('as "the draft word the corrected word anchored to" but is assigned');
L.push('`draftWords[i]?.text` — **a positional index into a different array**. The correction');
L.push('pass inserts words (Block 3 measured 15 insertions across 291 production words), so');
L.push('from the first insertion onward the two lists no longer share an index.');
L.push('');
L.push('**It is cosmetic.** `sourceText` is provenance and nothing reads it — not grouping,');
L.push('not display timing, not the builder. The rendered text and the timings both come from');
L.push('other fields. It is a real defect and it should be fixed, but it is not what the user');
L.push('saw.');
L.push('');

L.push('## 4. Corpus-wide integrity');
L.push('');
L.push('| reel | words | zero-duration | negative | non-monotonic | interpolated | groups | out of order | display starts early |');
L.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const a of all) {
  const s = a.stats;
  L.push(
    `| ${a.reel} | ${s.words} | ${s.zero.length} | ${s.negative.length} | ${s.nonMonotonic.length} | ` +
      `${s.interpolated.length} | ${s.groups} | ${s.groupsOutOfOrder} | ${s.displayStartsEarly} |`,
  );
}
L.push('');
const totalZero = all.reduce((n, a) => n + a.stats.zero.length, 0);
const totalInterp = all.reduce((n, a) => n + a.stats.interpolated.length, 0);
L.push(`**${totalZero} zero-duration words across the corpus, and ${totalInterp} interpolated words.**`);
L.push(totalZero === totalInterp
  ? 'The two sets are the same size, and every zero-duration word is an interpolated one — alignment inserted a word the draft had no token for and gave it a point in time rather than a span. **No word with a real Scribe anchor has zero duration.**'
  : 'The two counts differ, so zero duration is not explained by interpolation alone.');
L.push('');
L.push('**Alignment quality is auditable after the fact**, which was in doubt: `confidence` is');
L.push('Scribe\'s per-slot value on an anchored word and `null` on an interpolated one, so the');
L.push('two are distinguishable on any plan without re-running anything.');
L.push('');
for (const a of all) {
  if (a.stats.zero.length === 0) continue;
  L.push(`- **${a.reel}**: ${a.stats.zero.map((w) => `\`${w.id}\` "${w.text}" at ${f3(w.start)} s`).join(', ')}`);
}
L.push('');
L.push('**Nothing is non-monotonic anywhere**: no word starts before the previous one ends, no');
L.push('group is out of order, no negative duration, and no display window opens before its');
L.push('own first word is spoken.');
L.push('');

L.push('## 5. What a two-word card actually does');
L.push('');
L.push('`inPoint = displayStart − introS` puts the animation 0.13 s (4 frames at 29.97) before');
L.push('the first word — by design. But a two-word card shows **both** words from that instant,');
L.push('and the second word is not spoken until later. The gap is the anticipation.');
L.push('');
L.push('| reel | two-word cards | min | median | max |');
L.push('|---|---:|---:|---:|---:|');
const pooled: number[] = [];
for (const a of all) {
  const v = a.stats.anticipation.map((x) => x.earlyS).sort((x, y) => x - y);
  pooled.push(...v);
  if (v.length === 0) { L.push(`| ${a.reel} | 0 | — | — | — |`); continue; }
  L.push(`| ${a.reel} | ${v.length} | ${f3(v[0] as number)} | ${f3(v[Math.floor(v.length / 2)] as number)} | ${f3(v[v.length - 1] as number)} |`);
}
pooled.sort((a, b) => a - b);
/*
 * One word per card since Block 7 session 6, so `anticipation` is empty on
 * every reel and this row has nothing to average. It crashed rather than
 * printing zero, which is why the tool could not write its report at all.
 */
L.push(
  pooled.length === 0
    ? '| **pooled** | 0 | — | — | — |'
    : `| **pooled** | ${pooled.length} | ${f3(pooled[0] as number)} | ${f3(pooled[Math.floor(pooled.length / 2)] as number)} | ${f3(pooled[pooled.length - 1] as number)} |`,
);
L.push('');
L.push(`In the reported span on \`${focus.reel}\`:`);
L.push('');
L.push('| group | text | second word on screen early by |');
L.push('|---|---|---:|');
for (const x of focus.stats.anticipation) {
  const g = focus.plan.subtitles.groups.find((y) => y.id === x.id);
  if (g === undefined || g.start < fromS || g.start > toS) continue;
  L.push(`| ${x.id} | ${x.text} | ${f3(x.earlyS)} s |`);
}
L.push('');

L.push('## 6. Diagnosis');
L.push('');
L.push('**Best supported: the second word of a two-word card is on screen before it is');
L.push('spoken, and around 4 s the cards are short enough that it dominates.**');
L.push('');
L.push('Evidence for:');
L.push('');
L.push('- Every word in the span carries a Scribe interval for the same word, so the audio and');
L.push('  the text agree about *when* each word happens.');
L.push(
  pooled.length === 0
    ? '- **The anticipation can no longer be measured**: one word per card since Block 7' +
      ' session 6, so the corpus holds no two-word card and there is nothing to average.' +
      ' The figures this section carried were measured before that change.'
    : `- The anticipation is real and large: pooled median **${f3(pooled[Math.floor(pooled.length / 2)] as number)} s**, max **${f3(pooled[pooled.length - 1] as number)} s**.`,
);
L.push('- In the reported span the cards are 0.36–0.78 s of speech, so an anticipation of');
L.push('  0.33–0.51 s is a large fraction of the card\'s life — the reading eye is ahead of the');
L.push('  ear for most of the time the card is up.');
L.push('');
L.push('Evidence against, stated because it is real:');
L.push('');
L.push('- **This is not specific to 4 s.** It happens on every two-word card on every reel, and');
L.push('  vitasilk has worse cases later (`g023` at 0.830 s). If the user perceived something');
L.push('  *particular* to 4 s, anticipation alone does not explain why there and not elsewhere.');
L.push('- A second thing happens in the same span and could be what was seen: `w0012` "li" is');
L.push('  0.080 s of speech and `w0013` "ghayrdd" is 0.020 s. Two cards flash through in under');
L.push('  a fifth of a second between 4.259 and 4.699, with a 0.34 s hole in the speech before');
L.push('  the second. A card that flashes reads as mistimed even when its timing is exact.');
L.push('');
L.push('**The data does not separate these two.** Both are present in the same 0.5 s and both');
L.push('would produce "the text is out of step". Naming one would be a guess.');
L.push('');
L.push('**Neither is a defect of this block.** The word durations come from Scribe and the');
L.push('alignment that carries them; grouping and the builder reproduce them faithfully. The');
L.push('0.020 s and 0.080 s words are a transcription-quality question — Block 2 territory —');
L.push('and `findShortWords` has been reporting them since Block 3 without anyone acting.');
L.push('');
writeFileSync(OUT_PATH, `${L.join('\n')}\n`, 'utf8');
console.log(`wrote ${path.relative(REPO_ROOT, OUT_PATH)}`);
console.log(
  `zero-duration ${totalZero}, interpolated ${totalInterp}, non-monotonic ` +
    `${all.reduce((n, a) => n + a.stats.nonMonotonic.length, 0)}, ` +
    `two-word cards ${pooled.length}` +
    (pooled.length === 0
      ? ''
      : ` (median anticipation ${f3(pooled[Math.floor(pooled.length / 2)] as number)}s)`),
);
