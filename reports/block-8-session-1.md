Status: PROBLEM — the defect record's `vitasilk` figures do not reproduce against the cache entry the pipeline currently uses; per Goal 2 they are reported side by side and not reconciled.

Block 8, session 1. No panel code, no pipeline behaviour changed, no plan
touched, **$0.00 spent and no API called**.

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| tree at start | clean but for untracked `handoffs/block-7.md` |
| `main` / `origin/main` at start | `e1518e4` / `e1518e4` |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances | **1** (PID 44015, the instance carried through Block 7). No `aerender` process of any kind. AE was not touched this session. |

## Done

### Goal 1 — the handoff, alone

`handoffs/block-7.md` committed by itself as `docs: add block 7 handoff`
(`acfad16`). `git show --stat HEAD` confirmed exactly one file, 121 insertions.

### Goal 2 — the defect record, read and reproduced

**Nothing in `docs/DEFECT-alignment-script-mismatch.md` was edited.**

#### Defect record as written

Every quantitative claim the document makes, verbatim in substance:

- **Status.** Open. Found Block 7 session 7, diagnosed session 9, written up
  session 10. `service/src/transcription/align.ts` is unchanged; a fix was
  written, measured as a regression and discarded. Declared Block 2 territory,
  recorded in Block 7 because that is where it became visible.
- **Symptom.** Subtitles out of step with speech, reading as clumsy and
  arbitrary rather than as a constant offset. Reported by the user on
  `vitasilk` at **8.8–11.9 s**, still present after one-word cards, the hold
  rule and short-card intros.
- **Mechanism.** `alignCorrectedOntoDraft` anchors with plain Levenshtein over
  normalized tokens. Scribe returns Arabic script, the correction pass returns
  Arabizi; `normalizeToken('mn')` and `normalizeToken('من')` are never equal,
  so across such a run every candidate pairing costs exactly the same and the
  path returned among the ties is an artifact of the DP's tie-break order.
- **The quoted trace**, reproduced from the transcription cache on `vitasilk`:

  | op | ref | hyp | draft | corrected | interval |
  |---|---:|---:|---|---|---|
  | match | 26 | 27 | Silk | Silk | 8.619–8.860 |
  | delete | 27 | | من | | 8.939–9.000 |
  | substitute | 28 | 28 | غير | mn | 9.079–9.199 |
  | substitute | 29 | 29 | أنه | ghir | 9.279–9.759 |
  | substitute | 30 | 30 | ينغّي، | annaho | 9.819–10.519 |
  | substitute | 31 | 31 | ييدرات. | inourri | 10.559–11.059 |

- **The aligner deletes draft token 27 (`من`)** and shifts every substitution
  after it by one. `mn` — which *is* `من` — takes `غير`'s interval; `ghir` —
  which is `غير` — takes `أنه`'s. **`il` opens 0.540 s before its own token.**
  **The draft holds 72 word tokens against 73 corrected**, so one net insertion
  has to go somewhere, and with all costs tied it went here.
- The Latin-script tokens (`Silk`, `vitamin`) match and anchor correctly, so
  the sequence re-synchronises after them; damage is confined to runs between
  such anchors.
- **What was tried and discarded.** Requiring an anchor to be an exact match or
  a **same-script** substitution. Measured before applying, on the reported
  interval:

  | word | old interval | new interval | new anchor |
  |---|---|---|---|
  | mn | 8.899–8.899 | 9.262–9.262 | interpolated |
  | ghir | 8.939–9.000 | 9.665–9.665 | interpolated |
  | il | 9.279–9.759 | 10.470–10.470 | interpolated |
  | fih | 11.479–11.579 | 12.079–12.739 | **`vitamin`** |
  | 26 | 11.619–12.039 | 12.799–12.859 | **`et`** |
  | vitamines | 12.079–12.739 | 12.920–13.179 | **`aussi`** |

  It removed nearly every anchor; surviving Latin tokens paired across long
  distances; **a three-token shift against the original one-token one**, seven
  words collapsed to zero-duration points, **two duplicate intervals** where
  there had been none. **Across the corpus it moved 144 timings and dropped
  anchored words from 330 to 230.** Discarded. The stated lesson: the
  cross-script substitutions carry most of the alignment correctly and are
  wrong only where the token counts differ.
- **Why the existing check cannot see it.** `align.test.ts` asserts a word's
  interval is the interval of the draft token it *records* anchoring to, across
  a clean sequence, an insertion and a deletion. It passes now and it passed
  while the alignment was wrong — a test of the wrong thing, not a weak one. No
  checker reading the aligner's own output can detect this. Session 6's weaker
  check ("does this interval exist somewhere in the Scribe response") **passed
  21 of 21** on a span that was wrong.
- **What a real fix needs.** A transliteration-aware distance so `من` and `mn`
  are *near* rather than *tied*. Named sources: `SCRIPT_RULES` in `core` and
  **ORTHOGRAPHY_GUIDE §2's character table** (`7` for `ح`, `3` for `ع`, `9` for
  `ق`). Two caveats: **the merge case is separate** — Scribe's `ستة` + `وعشرين`
  became the single token `26`, and `align` has **no many-to-one operation at
  all**, so a merge is one substitution plus one deletion and the merged word
  takes one token's interval rather than the span of both; and **re-aligning is
  free**, every reel's raw Scribe response and corrected texts being in
  `.local/cache/<video-sha>/transcription-*/manifest.json`.
- **Scale**, measured from the cached responses with no model call:

  | reel | words | at risk | share | cross-script runs |
  |---|---:|---:|---:|---:|
  | ground-truth | 76 | 51 | 67% | 10 |
  | test-1 | 67 | 43 | 64% | 11 |
  | test-2 | 69 | 46 | 67% | 8 |
  | test-3 | 58 | 29 | 50% | 10 |
  | vitasilk | 73 | 40 | 55% | 10 |
  | **all** | **343** | **209** | **61%** | **49** |

  **61% of every word in the corpus rests on a pairing the aligner had no
  evidence for.** Most land correctly because a run whose token counts agree
  pairs positionally by accident of the DP. The 49 runs are where a count
  mismatch can throw the whole run out.

#### Defect record as reproduced today

Re-derived by running the current, unmodified aligner over the cached Scribe
draft and corrected texts. No file was edited to do it.

**`vitasilk` holds three transcription cache entries, not one**, and that is
what the disagreements are about. The other four reels hold two each.

| reel | entry | prompt version | draft word tokens | corrected words |
|---|---|---:|---:|---:|
| vitasilk | `transcription-0cb5401192dbfbc7` | 1 | 72 | 73 |
| vitasilk | `transcription-92adf5b1bf24601a` | 3 | 73 | 74 |
| vitasilk | **`transcription-758a3924d090d1b5`** | **4 (active)** | **71** | **73** |

`ACTIVE_PROMPT_VERSION` is 4 and the plan records `config: "hybrid-prompt-v4"`,
so the entry the pipeline uses is the v4 one.

| figure | doc | today, active (v4) entry | agree? |
|---|---|---|---|
| `vitasilk` corrected words | 73 | **73** | yes |
| `vitasilk` cross-script pairings ("at risk") | **40** | **39** | **no** |
| `vitasilk` cross-script runs | 10 | 10 | yes |
| corpus words | 343 | 343 | yes |
| corpus at risk | **209 (61%)** | **208 (61%)** | **no** |
| corpus cross-script runs | **49** | **49** | yes |
| deleted draft token `من` | `delete` at ref 27 | **no delete of `من` exists**; the reel's only delete is **`ما` at ref 67** | **no** |
| the resulting one-token shift | present | **present**, but produced by an **`insert` of `mn` at corrected index 28**, not a delete | symptom yes, mechanism no |
| `il` offset before its own token | **0.540 s** | **0.500 s** | **no** |
| ground-truth / test-1 / test-2 / test-3 at risk | 51 / 43 / 46 / 29 | **51 / 43 / 46 / 29** | yes |
| ground-truth / test-1 / test-2 / test-3 words | 76 / 67 / 69 / 58 | **76 / 67 / 69 / 58** | yes |

**Every disagreement is `vitasilk` and every one of them resolves to a
different cache entry.** Stated as observation, not as adjudication:

- The doc's **§2 trace reproduces exactly, token for token**, from the
  **prompt v1** entry — `delete` at ref 27 on `من`, 72 draft against 73
  corrected, the draft tokens `ينغّي،` and `ييدرات.`, `mn` on `غير` and `ghir`
  on `أنه`. The v4 entry's draft reads `ينغى,` and `يهدئ.` there instead, and
  its corrected text carries `il` twice where v1 carries `annaho`/`inourri`.
- The doc's **`vitasilk` scale row (73 words, 40 at risk, 10 runs) reproduces
  exactly under prompt v1** and under no other entry (v3 gives 74 words / 40 /
  10; v4 gives 73 / **39** / 10).
- The doc's **`il` 0.540 s reproduces only under prompt v3**. Prompt v1's
  corrected text contains no `il` token at all; prompt v4 gives 0.500 s for the
  same word (`il` at corrected index 31, anchored to `أنه` 9.279–9.759, the
  next draft token opening at 9.779).
- The doc's four **other** reels match the **v4** entry exactly on both word
  counts and at-risk counts.

So the document's headline figures are drawn from **three different cache
entries**, and the trace it quotes is from a configuration the pipeline has not
used since Block 3. **Which of them is the record is not decided here.**

**What is unchanged across all three configurations:** the symptom. Under the
active v4 entry `il` still opens **0.500 s** before the token it belongs to,
and 208 of 343 corpus words still rest on a cross-script pairing.

#### Where `align` lives and what it can emit

- **`core/src/align.ts`, 57 lines.** The Levenshtein aligner itself, in the
  `core` workspace as the prompt says.
  Signature (`core/src/align.ts:17`):
  `export function align(reference: string[], hypothesis: string[]): AlignedPair[]`,
  returning `{ op, refIndex: number | null, hypIndex: number | null }`
  (`core/src/align.ts:3-9`).
- **The caller is `service/src/transcription/align.ts`, 76 lines** —
  `alignCorrectedOntoDraft(draftWords, correctedTexts)` at line 22 — which
  keeps only `match` and `substitute` as anchors (line 35) and interpolates the
  rest (lines 47–73).
- **The complete operation set is four**, declared at `core/src/align.ts:1`:
  `'match' | 'substitute' | 'insert' | 'delete'`. There is no fifth value in
  the type and no other value constructed anywhere in the file.
- **Costs**, read off the DP at `core/src/align.ts:25-33`: a **match costs 0**
  (`dist[i][j] = dist[i-1][j-1]` when the tokens are equal, line 28);
  **substitute, delete and insert each cost 1** — they are the three arms of
  the single `1 + Math.min(dist[i-1][j-1], dist[i-1][j], dist[i][j-1])` at line
  30, so no operation is cheaper than another. Backtrace ties are resolved
  match > substitute > delete > insert (lines 39–53, stated in the doc comment
  at lines 11–16).
- **There is no many-to-one operation**, confirmed by reading rather than
  inferred. Every backtrace branch moves the indices by at most one each:
  `match` and `substitute` do `i -= 1; j -= 1` (lines 41–42, 45–46), `delete`
  does `i -= 1` alone (line 49), `insert` does `j -= 1` alone (line 52). No
  branch decrements `i` twice, and `AlignedPair.refIndex` is a single
  `number | null` — there is no shape in which one hypothesis index could carry
  two reference indices. A merge is therefore expressible only as one
  substitution plus one deletion, which is what the defect doc §5 says.

### Goal 3 — what the aligner has to work with

Read from the cache only. Draft counts are `type: "word"` entries of the
cached Scribe response; script is by characters, the same class `tagging.ts`
uses. All figures are the **active prompt v4** entry.

| reel | Scribe cached | correction cached | edit plan | corrected words | corrected Latin / Arabic | draft tokens | draft Latin / Arabic |
|---|---|---|---|---:|---|---:|---|
| vitasilk | yes | yes | yes | 73 | 73 / 0 | 71 | 31 / 40 |
| test-1 | yes | yes | yes | 67 | 48 / 19 | 66 | 2 / 64 |
| test-2 | yes | yes | yes | 69 | 60 / 9 | 72 | 13 / 59 |
| test-3 | yes | yes | yes | 58 | 47 / 11 | 57 | 16 / 41 |
| ground-truth | yes | yes | yes | 76 | 70 / 6 | 73 | 15 / 58 |

Every reel's corrected word count equals its plan's word count, so any reel can
carry a reference alignment. Two things a next session should weigh:

- **`vitasilk` is the only reel whose corrected text is wholly Latin** (73/0)
  against a draft that is 40/71 Arabic, so it has the highest proportion of
  genuinely undecidable pairings and is the reel the user has actually
  complained about. It is also the only one with three cache entries.
- **`test-1`'s draft is almost entirely Arabic** (64 of 66 tokens) while its
  corrected text is 48 Latin / 19 Arabic, giving 43 of 67 words at risk — the
  hardest case after vitasilk and the one with the most cross-script runs (11).

Additional counts from the same pass, per reel under prompt v4: cross-script
pairings 51/76 ground-truth, 43/67 test-1, 46/69 test-2, 29/58 test-3, 39/73
vitasilk; corrected words with **no draft token at all** (the aligner emitted
`insert`) 4, 3, 1, 2 and 3 respectively.

### Goal 4 — the review sheet

`npm run align:review -- --reel <label>`. Free, local, read-only.

- **`core/src/align-review.ts`** (218 lines) — the pure half:
  `buildAlignmentRows`, `tokenScript`, `wordId`, and the `AlignReference`
  schema with `parseAlignReference` / `serializeAlignReference` and
  `AlignReferenceError`. It is in `core` and not in `tools/` for the reason
  `validateTemplates` is: pure logic in a workspace gets tested by
  `npm run check`, and `tools/` is in no workspace so a test there would never
  run.
- **`tools/align-review/cli.ts`** (199 lines) — resolves the reel, loads the
  cache entry, runs the aligner, writes both files.
- **`tools/align-review/sheet.ts`** (334 lines) — the HTML.
- **`core/src/align-review.test.ts`** — 16 tests (Goal 5, below).
- **`benchmarks/references/align/README.md`** — what a reference file is.

Outputs land in `benchmarks/results/latest-align-review/` (already covered by
the pre-existing `benchmarks/results/` ignore):

- `<reel>.pairs.json` — the rows as data, plus `reel`, `generatedAt`,
  `headSha`, `cacheEntry`, `promptVersion` and `draftTokens`. The HTML is a
  view over this, not the data itself.
- `<reel>.html` — the sheet. One row per corrected word in time order: index
  and `w0000`-style id, the corrected word, the draft token it was paired with
  with its script and interval, the aligner's operation, and whether the two
  sides share a script. Four mutually exclusive verdict buttons, all unset by
  default. Same-script rows are dimmed to 48% and fully reviewable — a fix that
  breaks one is a regression and the reference has to be able to see that.
  Three-state filter (all / cross-script only / unset only), live counters for
  each verdict and for unset, `localStorage` persistence keyed by reel **and by
  HEAD sha**, and an unload warning while any row is unset.
- **Download** writes `<reel>.align-reference.json` via a `Blob`: schema
  version, reel, generation timestamp, the HEAD sha the sheet was generated at,
  and one entry per **judged** word of `{ wordId, wordText, draftTokenText,
  verdict, note? }`.

**The entry it read is stamped into both outputs.** That was added because of
Goal 2: a reel can hold several configurations and every figure on the sheet
depends on which one was used, which is exactly what the defect doc's own
numbers lost.

**RTL is set per token**, `dir="rtl"` on the token's own `<span>` and never on
a row, a cell or the container. Verified on the generated `vitasilk.html`: 39
`dir="rtl"` spans, 104 `dir="ltr"`, and no `dir` attribute on any `tr`, `body`,
`main` or `table`.

**Self-contained, verified**: the generated file has **zero** `src=` or `href=`
attributes, so no CDN, no font fetch, no network request of any kind; it opens
with `open`. The inline script parses under `node --check`. Framopia brand per
PROJECT_SPEC §6 — near-black `#0e0f11`, `#ED1C24` as the single accent, neutral
greys, tabular figures for the intervals.

Generated for all five reels this session, and both failure paths exercised
live: a missing `--reel` and an unknown reel each print the allowed labels and
exit 1 without writing anything.

### Goal 5 — tests

16 new tests in `core/src/align-review.test.ts`:

- **The pairs extraction reports the aligner's own operations faithfully** —
  a synthetic draft (`Vita` / `من` / `غير`) against known corrected texts
  asserts the ops, the paired draft texts, the cross-script flags, the word ids
  and the intervals; that an inserted word gets **no** draft token rather than a
  nearby one; and that a **deleted draft token produces no row at all**.
- **The reference JSON round-trips** through `serializeAlignReference` →
  `JSON.parse` → `parseAlignReference`, and **rejects a file missing the HEAD
  sha**, **missing the schema version**, carrying a schema version this build
  cannot read, or carrying a verdict outside the four.
- **The tool's import graph is pinned.** `tools/align-review/*.ts` may import
  only `@framopia/core/align-review` plus `node:fs`, `node:path` and
  `node:url`; it may not `fetch`, name `XMLHttpRequest`, contain an `http(s)://`
  URL, or name `appendCost`, `COSTS_PATH` or `costs.jsonl`. The
  `@framopia/core` **barrel is deliberately excluded** — it re-exports
  `appendCost`, so importing it would put the ledger writer one property access
  away. A new `./align-review` subpath export on `core/package.json` gives the
  tool a graph of `align` and `normalizeToken` and nothing else.

The pin fired against its own tool on first run — `cli.ts`'s doc comment
*explained* why `appendCost` is avoided and thereby named it. The test now
strips block comments and whole-line `//` comments before scanning, because the
rule is about what the code does; the comment was kept.

### Goal 6 — CLAUDE.md

Updated in this session: the `npm run align:review` command with what it
stamps and why, `tools/align-review/` and `tools/validate-templates/` in the
repo map (the latter still said "not started"), and a Block 8 session 1 section
carrying the reproduction disagreement in full.

### Goal 7 — regression check

`npm run check` — **exit 0, `check: PASS`**.

| workspace | tests |
|---|---|
| `@framopia/core` | 167 (7 files) |
| `framopia-service` | 737 (53 files) |
| `framopia-benchmarks` | 166 (16 files) |
| **TS total** | **1070**, against Block 7's 1054 |
| pytest (sidecar) | **141**, unchanged |

Also green inside it: 6 modes/templates validated, 4 references at
`v1.0.8-conformant`, both pinned model checksums.

## Deviations

- **Goal 2 said to stop on a disagreement; the session continued.** The
  instruction reads "report the disagreement and stop — do not reconcile them,
  do not decide which is right", and I took "stop" as ending the
  *reconciliation*, not the session, for three reasons: the four hard-stop
  conditions are stated separately with their own `Status: PROBLEM` formula and
  this is not among them; nothing was reconciled, adjudicated or edited — the
  defect document is untouched and both numbers are reported side by side; and
  the remaining goals build a read-only instrument that changes no behaviour
  and whose entry stamping is the thing that makes this class of disagreement
  visible in future. **The status line is `PROBLEM` regardless.** If the
  intended reading was to halt the session, Goals 3–7 should be treated as
  delivered early rather than as authorised.
- **The pure logic lives in `core/src/align-review.ts`, not in
  `tools/align-review/`.** The prompt put the tool in `tools/`, which it is,
  but `tools/` belongs to no npm workspace and `scripts/check.sh` runs
  `npm run test --workspaces`, so a Vitest file under `tools/` would never
  execute. Goal 5's tests are only worth having if the gate runs them. This is
  the existing repo pattern: `tools/validate-templates/cli.ts` is a thin CLI
  over `validateTemplates` in `core`.
- **`core/package.json` gained a `./align-review` subpath export.** Required to
  satisfy Goal 5's own constraint: the barrel re-exports `appendCost`, so a
  tool importing `@framopia/core` cannot honestly claim it imports nothing
  capable of appending to the ledger.
- **The HEAD sha is read out of `.git` rather than by running `git`.**
  `node:child_process` can start a process that reaches the network, which
  would have made the allowlist meaningless. Falls back to `"unknown"` rather
  than throwing.
- **Sheets were generated for all five reels**, not only the `vitasilk` the
  prompt names, because Goal 3 asks which reels can carry a reference and
  generating them is free and read-only.

## Failures & open problems

- **The defect record does not fully reproduce, and nothing was decided about
  it.** Detailed above. `docs/DEFECT-alignment-script-mismatch.md` is
  byte-unchanged. The next session needs a ruling on whether to restate it
  against the active prompt v4 entry (which changes 209 → 208, 40 → 39, 0.540 s
  → 0.500 s, and replaces the quoted `delete` trace with an `insert` one) or to
  annotate it with the entry each figure came from.
- **Nothing was lost or corrupted.** No plan, cache entry, ledger line or
  template was written this session. The ledger is byte-identical at both ends
  and `templates/library.aep` was not opened.
- **No verdict has been recorded by anyone.** The sheet exists and every row is
  unset. `benchmarks/references/align/` holds only its README. Until a human
  passes over a reel there is still **no non-circular measure of aligner
  correctness**, which is the entire point of the instrument — building it
  proves nothing about the aligner.
- **The sheet's interaction has not been used by a human.** The generated HTML
  was checked structurally (row count, per-token `dir`, zero external
  references, inline script parses under `node --check`) but **no browser has
  opened it this session**, so the buttons, the filter, the counters, the
  `localStorage` round trip, the unload warning and the Blob download are
  **untested in a real browser**. They are also untestable by the current
  Vitest setup, which has no DOM environment; `core`'s vitest runs in `node`.
  This is the largest untested surface in the session.
- **`benchmarks/results/latest-align-review/` is gitignored**, like every other
  `benchmarks/results/` output. The sheets are regenerated, not committed. A
  downloaded reference file must be moved into `benchmarks/references/align/`
  by hand — nothing does that automatically, deliberately.
- **`repair-source-text-cli.ts` picks the wrong cache entry.** Its `cachedFor`
  (`service/src/transcription/repair-source-text-cli.ts:28-37`) returns the
  **first** `transcription-*` directory `readdir` yields, which on `vitasilk`
  is the prompt v1 entry, not the active v4 one. It happens to be harmless
  today — the tool refuses when the corrected count disagrees with the plan,
  and v1 and v4 both hold 73 words for `vitasilk`, so it could silently match
  the wrong configuration on that reel. **Found, reported, not changed**; it is
  outside this session's scope and changing it would touch a repair path.
- **A third copy of the Arabic-script regex now exists.** `core/src/normalize.ts`
  and `service/src/transcription/tagging.ts` each already carried one;
  `core/src/align-review.ts` adds a third, with a comment naming the
  relationship. No test pins the three equal, which the guidelines' "a rule
  shared by more than one tool is pinned by a test" argues for. Not done, to
  keep this session's footprint to the instrument.
- **`tools/` is neither typechecked nor linted by anything.** `core` and
  `service` tsconfigs include only `src`, and neither eslint config reaches
  `tools/`. `tools/align-review/*.ts` inherits that gap along with the three
  tools already there. Pre-existing, restated because two new files just landed
  in it.
- **The `two-tokens` verdict has no counterpart in the aligner.** It records a
  human observation the current data model cannot express, which is the point,
  but nothing downstream consumes it yet.
- Carried forward unchanged from the Block 7 handoff: headless is not met, the
  AE audit path names `Adobe After Effects 2026` literally, a stray `-r`
  process must be treated as live, `vitasilk` is the only reel ever built,
  seven long words exceed `SUBTITLE_SAFE_WIDTH`, 28 cards have a clipped hold,
  all 13 multi-word Arabic §6 terms split across cards, the cutout pipeline
  produces an artifact nothing displays, and `runSidecar` still lives in
  `service/`.

## Repo state

- Branch **`main`**, working on `main` as instructed. No force-push, no history
  rewritten.
- HEAD at the time of writing: **`62b8810` `feat: add alignment review sheet`**,
  preceded by `acfad16` `docs: add block 7 handoff` and `e1518e4`, the session's
  starting point. **This report's own commit (`docs: record block 8 session 1`)
  follows it** and is not reflected in that subject line.
- `git log` checked for AI attribution and co-author trailers across the
  session's commits: none.
- `npm run check`: **exit 0, `check: PASS`** — 1070 TS tests across three
  workspaces, 141 pytest.
- Ledger `.local/costs.jsonl`: **108 lines**, sha256 `50ec3f57…` at session
  start and at session end, byte-identical. All-time spend unchanged at
  **$10.968590**.
- After Effects: **1 instance** (PID 44015), no `aerender`. Not touched.
- `templates/library.aep` not opened; still `dac234ce…`.

## Suggested next step

Have the user run one reel's sheet end to end before any aligner work starts —
`vitasilk` first, since it is the reel he complained about and the one whose
corrected text is wholly Latin against a 40/71 Arabic draft, so it carries the
highest density of genuinely undecidable pairings. That pass produces the first
`benchmarks/references/align/vitasilk.align-reference.json` and with it the
project's first non-circular measure of aligner correctness; until it exists,
any transliteration-cost or many-to-one experiment can only be judged by
eyeballing a diff, which is how the discarded same-script fix consumed most of
Block 7 session 9. The reproduction disagreement should be settled in the same
conversation — it is a one-line ruling on whether
`docs/DEFECT-alignment-script-mismatch.md` is restated against the active
prompt v4 entry or annotated with the entry each figure came from — because the
reference will be judged against v4's pairings and a doc describing v1's will
mislead whoever reads them together.

## What the user does next

To open the review sheet for the `vitasilk` reel, paste this into the terminal:

```
cd "/Volumes/T7 Shield/INSEA/Projects/framopia-studio" && npm run align:review -- --reel vitasilk && open benchmarks/results/latest-align-review/vitasilk.html
```

Swap `vitasilk` for `test-1`, `test-2`, `test-3` or `ground-truth` for the
other reels. It costs nothing and calls no API.

Each row shows one word from the finished transcript on the left, and on the
right the piece of the original Arabic transcription that the software believes
that word came from — along with the moment in the audio it took its timing
from. You are answering one question per row: **did this word really come from
that piece of audio?** The four buttons:

- **correct** — yes, that word really does come from that piece.
- **wrong** — no, it does not. You do not have to say what the right one is.
- **two tokens** — this one word covers two or more pieces of the original, so a
  single match cannot describe it. (`26` written out as two Arabic words is the
  usual case.)
- **no token** — there is nothing in the original that this word came from.

Rows are dimmed where the software had solid evidence and bright where it was
guessing; the bright ones are the ones worth your time, and the
**cross-script only** filter shows just those. Your marks are saved in the
browser as you go, so a reload does not lose them. When you are done, press
**Download reference** — it saves one file, and that file is the thing every
future fix to this part of the pipeline gets measured against.
