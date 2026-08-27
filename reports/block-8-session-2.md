Status: OK

Block 8, session 2. No panel code. **$0.00 spent, no API called, no plan
written, no aligner code changed.** Session 1's `Status: PROBLEM` is explained
and its probable cause is fixed.

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| tree at start | clean |
| `main` / `origin/main` at start | `ff9d06c` / `ff9d06c` |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances at start / end | **1 / 1** (PID 44015, carried from Block 7). AE was not touched. |
| `aerender` processes at start / end | **0 / 0** |

## Done

### Goal 1 — every cache-entry selection site

**Three sites selected a transcription cache entry by directory order.** All
three took the *first* `transcription-*` directory `readdir` returned:

| file | line | function | selects | what decided it |
|---|---:|---|---|---|
| `service/src/transcription/repair-source-text-cli.ts` | 28 | `cachedFor` | the manifest whose draft and corrected texts `sourceText` is repaired from | first `readdir` hit |
| `service/src/analysis/missing-cards-cli.ts` | 32 | `scribeWordsFor` | the raw Scribe words a "nothing on screen" claim is checked against | first `readdir` hit |
| `service/src/analysis/timing-defect-cli.ts` | 39 | `scribeWordsFor` | the raw Scribe words a timing claim rests on | first `readdir` hit |

**Every one of them can vary with filesystem ordering.** Node returns entries in
the order the filesystem supplies; nothing sorted them, and nothing about APFS
guarantees that order across machines, volumes or entry churn.

**Measured on this volume**, the listing returns per reel:

| reel | listing order | first hit | is it the pinned v4? |
|---|---|---|---|
| ground-truth | `758a…` (v4), `92ad…` (v3) | `758a…` | **yes** |
| test-1 | `758a…` (v4), `92ad…` (v3) | `758a…` | **yes** |
| test-2 | `758a…` (v4), `92ad…` (v3) | `758a…` | **yes** |
| test-3 | `758a…` (v4), `92ad…` (v3) | `758a…` | **yes** |
| **vitasilk** | **`0cb5…` (v1)**, `758a…` (v4), `92ad…` (v3) | **`0cb5…`** | **no — prompt v1** |

That is exactly the mixture the defect document carried: four reels at the
pinned version and `vitasilk` at v1, because `0cb5` sorts ahead of `758a`.

**Other listing sites, examined and cleared:**

- `service/src/transcription/cache.ts:73` — `evictStaleEntries` lists a video's
  entries, but sorts by mtime and only ever *deletes*; it selects nothing to
  read. Ordering-independent in effect.
- `tools/migrate-image-cache/cli.ts:67,70` — iterates every entry with `.sort()`
  and processes all of them. No selection.
- Fourteen `readdirSync(FOOTAGE_DIR)…​.sort()` loops across the analysis,
  placement, build and image CLIs enumerate **edit plans**, not cache entries,
  and all are sorted.
- `service/src/frames/sample.ts` and `service/src/images/cutouts-cli.ts` list
  frames and corpus images, not cache entries.
- `core/src/validate-modes-cli.ts` and `benchmarks/src/aggregate.ts` list modes
  and results directories.

**The production paths were never affected.** `transcriptionCacheRef`
(`service/src/transcription/cached.ts:39`), the analysis stages
(`service/src/analysis/cached.ts:46,199`) and the image stage all resolve a
directory by **computed fingerprint** through `cacheEntryDir`. Nothing that
bills, and nothing that writes a plan, has ever selected by directory order.

**Which path `npm run align:review` used in session 1:** its own — `loadEntry`
sorted candidates by `promptVersion` descending and took the first. On this
corpus that coincides with the pinned version, so **all five session-1 sheets
were built from `transcription-758a3924d090d1b5`, prompt version 4**, printed
on stdout at the time and recorded in each `<reel>.pairs.json`. It was still a
rule of its own rather than the declared one, and is now replaced.

### Goal 2 — selection made explicit

`core/src/cache-select.ts`. **The active entry is the one whose prompt version
equals `ACTIVE_PROMPT_VERSION`.** Never `readdir` order, never
newest-by-mtime, never first match.

- Nothing matching, or more than one matching, throws `CacheEntrySelectionError`
  naming the reel, the pinned version and every version on disk. **No fallback.**
- `--entry <id>` takes an entry deliberately, by full id or bare fingerprint,
  and reports that it overrode.
- `describeSelection` is the one line every tool prints and stamps.

**Rewired:** `repair-source-text-cli.ts`, `missing-cards-cli.ts`,
`timing-defect-cli.ts` and `tools/align-review/cli.ts`. Each prints the entry on
stdout; the two that write markdown stamp it into the report, and the review
tool writes it into `<reel>.pairs.json` (with `pinnedPromptVersion` beside it)
and onto the sheet.

**`ACTIVE_PROMPT_VERSION` and `PromptVersion` moved to
`core/src/prompt-version.ts`** and are re-exported from
`service/src/transcription/correction.ts`, so every existing import is
unchanged. They had to leave `correction.ts`: it imports `@google/genai`, and
`tools/align-review` is pinned as unable to reach the network. **The value is
unchanged at 4, the fingerprint is unchanged, and no cache entry was
invalidated** — verified by every tool still resolving `758a3924d090d1b5`.

**Pinned by test, not by comment** — `core/src/cache-select.test.ts`, 12 tests,
including that a listing arriving forward, reversed and shuffled all select the
pinned version, that a missing pin and a duplicate pin each fail with the
listing in the message, and that an unversioned entry is never a fallback.

Both failure paths and the override were exercised live:

```
vitasilk: 73 corrected words against 72 draft tokens from
  transcription-0cb5401192dbfbc7 (prompt v1) [--entry override]
  40 cross-script pairings, 2 words with no draft token

align:review: test-1: no cache entry "deadbeef"; on disk:
  transcription-758a3924d090d1b5 (prompt v4), transcription-92adf5b1bf24601a (prompt v3)
```

The first line reproduces the defect document's original `vitasilk` figure of
**40**, on demand, as a stated act.

### Goal 3 — what downstream is wrong

**`vitasilk`'s three entries, compared:**

| entry | prompt | corrected words | Latin / Arabic |
|---|---:|---:|---|
| `transcription-0cb5401192dbfbc7` | 1 | 73 | 73 / 0 |
| `transcription-92adf5b1bf24601a` | 3 | 74 | 74 / 0 |
| `transcription-758a3924d090d1b5` | **4 (pinned)** | 73 | 73 / 0 |

Token-level, aligning one against the other:

| pair | unchanged | substituted | inserted | deleted | words differing |
|---|---:|---:|---:|---:|---:|
| v1 → v4 | 61 | 10 | 2 | 2 | **14** |
| v3 → v4 | 64 | 9 | 0 | 1 | **10** |
| v1 → v3 | 63 | 9 | 2 | 1 | **12** |

**No word differs in script** — all three are wholly Latin on this reel.
**Language tags:** prompt v1 returns none at all (the field arrived in v3); v3
and v4 tag every word, and of the 64 words whose text matches between them
exactly **one** differs — `26`, tagged `fr` under v3 and `darija` under v4.

v1 → v4, every differing word:

| v1 | v4 |
|---|---|
| ayyeh | eyyh |
| msbseb | msbsb |
| (none) | anno |
| (none) | il |
| annaho | nourrit |
| inourri | il |
| ihydrati | hydrate |
| katsnnay | katsnay |
| la9reb | la9rab |
| w | (none) |
| l9iti | wl9iti |
| ma | (none) |
| ttrddadich | matrddadich |
| walaw | wla |

v3 → v4: `ayyeh`→`eyyh`, `hada`→`a`, `lla`→`lalla`, `ghayrd`→`ghayrdd`,
`mssbsb`→`msbsb`, `katsnnay`→`katsnay`, `w`→(none), `l9iti`→`wl9iti`,
`matrddich`→`matrddadich`, `walaw`→`wla`.

**The committed edit plan and the built comp both came from the pinned entry.**

- `vitasilk.editplan.json`'s 73 word texts are **byte-identical, in order**, to
  the pinned v4 entry's `correctedTexts` — 0 positional differences. Against v1
  it differs at 44 positions; against v3 the lengths differ.
- `.local/build/.build-options.json` — the resolved build the last comp was made
  from — holds **68 subtitle cards, 3 keywords and 5 image slots**, and every
  subtitle text matches its plan group and every keyword text matches its plan
  keyword: **0 mismatches**. 68 is 73 groups less the 5 a keyword supersedes.

**So the plan, the groups, the placements and the built comp are correct**, and
nothing about them needs revisiting.

**One thing downstream is damaged.** With selection corrected,
`npm run repair:source-text` reports **9 of `vitasilk`'s 73 words carry a
`sourceText` that disagrees with the pinned draft**. The other four reels report
0. Block 7 session 7 ran that tool with `--apply` and reported 343/343 correct —
it was reading the **v1** draft on that one reel.

| word | text | stored `sourceText` | pinned v4 draft token | v1 draft token |
|---|---|---|---|---|
| w0017 | msbsb | `مسبسب.` | `مصبوغ.` | `مسبسب.` |
| w0032 | nourrit | `nourrit` | `ينغى,` | (no such interval) |
| w0033 | il | `il` | `يهدئ.` | (no such interval) |
| w0034 | hydrate | `hydrate` | `فيه` | (no such interval) |
| w0054 | f | `تهلّي` | `تهلي` | `تهلّي` |
| w0055 | ch3rk | `ch3rk` | `شعرك؟` | (no such interval) |
| w0070 | matrddadich | `تتردديش` | `تردديش` | `تتردديش` |
| w0071 | wla | `wla` | `ولا` | (no such interval) |
| w0072 | d9i9a | `d9i9a` | `دقيقة` | (no such interval) |

Three carry a v1 token outright; six kept their own text because the v1 draft
had no token at that interval. **What it means:** `sourceText` is documented as
the draft token a word anchored to, and on those nine it names a token from a
configuration the plan was not built from. It is **cosmetic today** — nothing
reads it (Block 7 decision 20) — but Block 8's transcript editor is exactly
where it surfaces. **Reported and not repaired**, per the goal;
`npm run repair:source-text -- --apply` now fixes it.

**A committed results file was also wrong.**
`benchmarks/RESULTS-block7-missing-cards.md` §4 described the **v1** draft —
`ينغّي،`, `ييدرات.`, and three anchors printed as "none". Against the pinned
draft they are `ينغى,`, `يهدئ.` and real anchors. Regenerated. Its
display-window columns moved too, for an unrelated reason: the file predates
Block 7 session 9's hold rule and the plans have since been migrated, so it was
simply stale.

**Entries per reel:**

| reel | entries | versions |
|---|---:|---|
| ground-truth | 2 | 3, 4 |
| test-1 | 2 | 3, 4 |
| test-2 | 2 | 3, 4 |
| test-3 | 2 | 3, 4 |
| **vitasilk** | **3** | **1, 3, 4** |

Every reel has more than one. Only `vitasilk` has three, and only `vitasilk`
has an entry that is not v3 or v4.

### Goal 4 — re-derived, and the defect record rewritten

Derived at git sha `ff9d06c`, aligner unmodified since `fca6e58`
(`service/src/transcription/align.ts`) and `2419746` (`core/src/align.ts`), all
five reels from `transcription-758a3924d090d1b5`, prompt version 4.

| reel | entry | prompt | corrected words | draft word tokens | paired across scripts | share | runs |
|---|---|---:|---:|---:|---:|---:|---:|
| ground-truth | `758a3924d090d1b5` | v4 | 76 | 73 | 51 | 67% | 10 |
| test-1 | `758a3924d090d1b5` | v4 | 67 | 66 | 43 | 64% | 11 |
| test-2 | `758a3924d090d1b5` | v4 | 69 | 72 | 46 | 67% | 8 |
| test-3 | `758a3924d090d1b5` | v4 | 58 | 57 | 29 | 50% | 10 |
| vitasilk | `758a3924d090d1b5` | v4 | 73 | 71 | 39 | 53% | 10 |
| **corpus** | | v4 | **343** | **339** | **208** | **61%** | **49** |

**The `vitasilk` shift.** The reel carries **three insertions and one
deletion**: inserts at corrected 0 (`5`), **corrected 28 (`mn`)** and corrected
50 (`chno`); delete at draft 67 (`ما`, 23.799–23.879). **There is no deletion of
`من`.** The displacement in the reported span comes from the **insertion of
`mn`**: it is given no draft token and interpolated, and every corrected word
after it takes the interval of the token **before** its own — `ghir`, which is
`غير` at draft 28, takes `من`'s interval at draft 27. One token, persisting to
the end of the run.

**The `il` offset.** `il` appears twice and both are displaced:

| corrected index | anchored to | own token opens at | displacement |
|---:|---|---:|---:|
| 31 | draft 29 `أنه` 9.279–9.759 | 9.779 (`ينغى,`) | **0.500 s** |
| 33 | draft 31 `يهدئ.` 9.819–11.079 | 11.159 (`فيه`) | **1.340 s** |

The second is larger and had never been named.

`docs/DEFECT-alignment-script-mismatch.md` is rewritten in two parts. **§A
Current evidence** carries the above, each figure stamped with reel, entry id,
prompt version and derivation sha. **§B Superseded figures** preserves the
originals **verbatim and unadjusted** — the scale table, the quoted trace, the
0.540 s offset and the discarded fix's measurements — each annotated with the
entry it is now known to have come from. **Nothing was deleted and nothing was
adjusted.** §C states, as a hypothesis with its evidence rather than a
conclusion, that ordering-dependent selection is the probable reason the figures
mixed three configurations, and says plainly what it does **not** explain: the
0.540 s figure matches the v3 entry, which is *last* in the same listing, so
first-match does not account for it and nothing in the repo records what did.

§B.4 also carries a new caveat: the discarded fix's measurements name no entry
and cannot be attributed from the numbers, since the experiment was never
committed. `mn`'s `8.899–8.899` matches no draft token in any of the three
entries — verified — because it is an interpolated value.

### Goal 5 — the aligner's internals

- **`core/src/align.ts`, 57 lines.** Exported signature at line 17:
  `export function align(reference: string[], hypothesis: string[]): AlignedPair[]`,
  where `AlignedPair` is `{ op: AlignOp; refIndex: number | null; hypIndex: number | null }`
  (lines 3–9).
- **The caller is `service/src/transcription/align.ts`, 76 lines** —
  `alignCorrectedOntoDraft(draftWords, correctedTexts)` at line 22, keeping only
  `match` and `substitute` as anchors (line 35) and interpolating the rest
  (lines 47–73).
- **Exactly four operations**, declared at `core/src/align.ts:1`:
  `'match' | 'substitute' | 'insert' | 'delete'`. No fifth value exists in the
  type and none is constructed anywhere in the file.
- **Costs**, read off the DP at lines 25–33: a **match costs 0**
  (`dist[i][j] = dist[i-1][j-1]` when the tokens are equal, line 28);
  **substitute, insert and delete each cost 1** — they are the three arms of the
  single `1 + Math.min(dist[i-1][j-1], dist[i-1][j], dist[i][j-1])` at line 30,
  so no operation is cheaper than another. Backtrace ties resolve
  match > substitute > delete > insert (lines 39–53).
- **No many-to-one operation**, confirmed by reading the backtrace rather than
  inferred. Every branch moves the indices by at most one each: `match` and
  `substitute` do `i -= 1; j -= 1` (lines 41–42, 45–46), `delete` does `i -= 1`
  alone (line 49), `insert` does `j -= 1` alone (line 52). No branch decrements
  `i` twice, and `refIndex` is a single `number | null`, so there is no shape in
  which one hypothesis index could carry two reference indices. A merge such as
  `ستة` + `وعشرين` → `26` is expressible only as one substitution plus one
  deletion, and the merged word takes one token's interval rather than both.

**No aligner code was changed this session.**

### Goal 6 — Word-count correction

| reel | corrected words (pinned entry) | subtitle groups on the plan | superseded by a keyword | rendered subtitle cards |
|---|---:|---:|---:|---:|
| ground-truth | 76 | 76 | 0 | 76 |
| test-1 | 67 | 67 | 3 | 64 |
| test-2 | 69 | 69 | 5 | 64 |
| test-3 | 58 | 58 | 0 | 58 |
| vitasilk | **73** | **73** | 5 | **68** |
| **corpus** | **343** | **343** | **13** | **330** |

**`handoffs/block-7.md` uses 343 as both `vitasilk`'s card count and the corpus
word count. It is the corpus figure.** `vitasilk` has **73** words, **73**
subtitle groups and **68** rendered subtitle cards; the last figure is what the
built comp contains and matches `.local/build/.build-options.json` exactly.

**The handoff was not edited** — a committed handoff is history. Carry this
table into the Block 8 handoff as an amendment.

One word per card since Block 7 session 6, so words and groups are equal
everywhere by construction. "Rendered subtitle cards" is lower because a keyword
replaces the groups it covers.

### Goal 7 — the sheets, regenerated and self-describing

All five regenerated from the pinned entry. The sheet now carries a visible
provenance strip above the table — **reel, cache entry, prompt version, aligner
sha, row count** — as five labelled chips, with the cross-script count, the
no-token count and the generation time on the line below. Verified on the
generated `vitasilk.html`: the strip contains `vitasilk`,
`transcription-758a3924d090d1b5`, `v4`, `ff9d06c706fe` and `73`, and the file
still has **zero** `src=` or `href=` attributes.

### Goal 8 — the sheet, executed

`renderSheet` moved to `core/src/align-sheet.ts` so the gate can mount it;
`tools/align-review/` is now the CLI alone.

**happy-dom, not jsdom.** It implements `localStorage` and `Blob` with no setup,
starts fast enough that a UI block can run these on every change (the whole
file runs in 33 ms), and — the deciding reason — **jsdom leaves
`URL.createObjectURL` unimplemented**, which is the one browser API the download
path depends on. Added as a devDependency of `@framopia/core`. The environment
is selected per file with a `// @vitest-environment happy-dom` docblock, so no
vitest config file was introduced and no other test's environment changed.
`core/tsconfig.json` gains `DOM` and `DOM.Iterable` to `lib`.

11 tests in `core/src/align-sheet.test.ts`:

- the provenance strip carries reel, entry, prompt version, aligner sha and row
  count;
- clicking a verdict sets **exactly one** `sel` on that row and moves both that
  counter and the unset counter; a second verdict **replaces** rather than adds;
  clicking the same one again clears it;
- the three-state filter shows all rows, cross-script rows only, and unset rows
  only, and marks only the active filter;
- a remount restores verdicts **and** notes from `localStorage`, and the store
  is keyed `framopia.align-review.<reel>.<sha>`;
- the download's Blob parses through `parseAlignReference`, carrying schema
  version 1, the reel, the generation timestamp and the **git sha**, with one
  entry per judged row, notes included, unjudged rows omitted, and an empty
  `entries` array when nothing has been judged — so the aligner's own pairing is
  never presented as a verdict.

### Goal 9 — CLAUDE.md

Two new binding conventions: **cache-entry selection is declared, never by
directory order**, with the rule, the failure behaviour, the `--entry` escape
and the per-reel entry counts; and **the correction prompt version is frozen for
the rest of Block 8** — changing it changes the corrected words, changes the
pairings under review, and invalidates every hand-made reference under
`benchmarks/references/align/`, which nobody can regenerate. Plus the
`align:review` command with `--entry`, and a Block 8 session 2 section.

### Goal 10 — regression check

`npm run check` — **exit 0, `check: PASS`**.

| workspace | tests | against session 1 |
|---|---:|---|
| `@framopia/core` | 187 (9 files) | 167 |
| `framopia-service` | 737 (53 files) | 737 |
| `framopia-benchmarks` | 166 (16 files) | 166 |
| **TS total** | **1090** | **1070** |
| pytest (sidecar) | **141** | 141 unchanged |

## Deviations

- **`diagnose:timing` was crashing and I fixed it.** Not a stated goal. It
  indexes `pooled[0]` for a pooled two-word-card anticipation row, and one word
  per card since Block 7 session 6 leaves that array empty on every reel, so it
  threw before writing anything. Goal 2 requires every tool that reads a cache
  entry to stamp it into the artifact it writes, and this one wrote none. It
  degrades honestly now: the row prints `—` and the diagnosis says the figure
  **cannot be recomputed** because no two-word card exists, rather than
  restating a number measured before that change. **Block 7's conclusions were
  not rewritten** — the original prose still renders whenever two-word cards are
  present.
- **`ACTIVE_PROMPT_VERSION` moved workspaces.** Not asked for. It was the only
  way to satisfy Goal 2's "every tool" while keeping session 1's pin that
  `tools/align-review` cannot reach the network — `correction.ts` imports
  `@google/genai`. Re-exported, so no call site changed; value, type and
  fingerprint identical.
- **`renderSheet` moved from `tools/align-review/` to `core/`.** Goal 8 requires
  executing it under vitest, and `tools/` belongs to no workspace, so
  `npm run check` would never have run the test. Same precedent as
  `validateTemplates`.
- **`core/tsconfig.json` gained `DOM` and `DOM.Iterable` to `lib`.** The
  alternative was excluding tests from the build as `service/tsconfig.json`
  does, which would have stopped typechecking core's tests entirely. The cost is
  that core source can now reference DOM types without a compile error; nothing
  in core does.
- **Two commits were reworked before pushing.** The first commit accidentally
  carried the `sheet.ts` → `align-sheet.ts` rename, which would have left it
  unbuildable from a clean checkout. It was rebuilt with `git reset --soft` while
  unpushed; nothing pushed was rewritten.
- **`benchmarks/RESULTS-block7-timing-defect.md` and
  `-missing-cards.md` are regenerated and committed**, since both are tracked
  and both tools now read a different (correct) entry.

## Failures & open problems

- **Nothing was lost or corrupted this session.** No plan, cache entry, ledger
  line or template was written. The ledger is byte-identical at both ends and
  `templates/library.aep` was not opened. Every one of the eleven transcription
  cache entries is still on disk.
- **The 9 damaged `sourceText` values on `vitasilk` are still damaged**, by
  instruction — Goal 3 ends at the finding. They are enumerated above.
  `npm run repair:source-text -- --apply` fixes them and is the smallest
  possible next action.
- **The `il` 0.540 s figure is still unattributed.** It matches the prompt v3
  entry, which is last in the listing, so first-match selection does not explain
  it. Whatever produced it no longer exists in the repo in that form. Recorded in
  the defect document as an open question, not resolved.
- **The discarded same-script fix's measurements cannot be attributed to any
  entry** and should not be used as a baseline for a future fix. Re-run the
  experiment against the pinned entry before quoting §B.4.
- **Still no reference has been recorded by a human.** The sheet works and is
  now tested, but every row on every reel is unset and
  `benchmarks/references/align/` holds only its README. **There is still no
  non-circular measure of aligner correctness** — that is the whole point of the
  instrument and it remains unrealised.
- **The sheet has still never been opened in a real browser.** happy-dom is a
  DOM implementation, not a browser: it does not lay anything out, so the styling,
  the RTL rendering of Arabic tokens beside Latin ones, the dimming of same-script
  rows and the real `<a download>` save are unverified visually. The `<a>.click()`
  and `URL.createObjectURL` calls are stubbed in the test.
- **The `beforeunload` warning is untested.** happy-dom does not run the unload
  lifecycle, so the handler is registered but never fired in the suite.
- **A third copy of the Arabic-script regex remains.** `core/src/normalize.ts`,
  `service/src/transcription/tagging.ts` and `core/src/align-review.ts` each
  carry one, with a comment naming the relationship but no test pinning them
  equal — which the guidelines' "a rule shared by more than one tool is pinned by
  a test" argues for. Not done, to keep the session's footprint on the selection
  rule.
- **`tools/` is still neither typechecked nor linted.** `core` and `service`
  tsconfigs include only `src`, and neither eslint config reaches `tools/`.
  Pre-existing; `tools/align-review/cli.ts` inherits it.
- **`selectTranscriptionEntry` covers transcription entries only.** The analysis
  and image caches are resolved by fingerprint and never listed, so they need
  nothing today, but no rule stops a future diagnostic from listing them.
- **`diagnose:timing`'s §6 diagnosis is about two-word cards that no longer
  exist.** It degrades honestly rather than lying, but the tool's central
  question has been overtaken by one word per card and it now reports mostly on
  a corpus property that is gone. Worth retiring or re-aiming rather than
  maintaining.
- Carried forward unchanged from the Block 7 handoff: headless is not met, the
  AE audit path names `Adobe After Effects 2026` literally, a stray `-r` process
  must be treated as live, `vitasilk` is the only reel ever built, seven long
  words exceed `SUBTITLE_SAFE_WIDTH`, 28 cards have a clipped hold, all 13
  multi-word Arabic §6 terms split across cards, the cutout pipeline produces an
  artifact nothing displays, and `runSidecar` still lives in `service/`.

## Repo state

- Branch **`main`**, worked on `main`. No force-push; the two reworked commits
  were unpushed at the time.
- HEAD at the time of writing: **`a8cb81a` `docs: re-derive the alignment defect
  against the pinned entry`**, preceded by
  `test: run the align review sheet in a dom` and
  `fix: select cache entries by pinned prompt version`, on session 1's `ff9d06c`.
  **This report's own commit (`docs: record block 8 session 2`) follows it** and
  is not reflected in that subject line.
- `git log` checked for AI attribution and co-author trailers across the
  session's commits: none.
- `npm run check`: **exit 0, `check: PASS`** — 1090 TS tests across three
  workspaces, 141 pytest.
- Ledger `.local/costs.jsonl`: **108 lines**, sha256 `50ec3f57…` at session start
  and end, byte-identical. All-time spend unchanged at **$10.968590**.
- After Effects: **1 instance** (PID 44015) at start and end, **0** `aerender`
  processes at either. Not touched.
- `templates/library.aep` not opened; still `dac234ce…`.
- One new dependency: **happy-dom**, devDependency of `@framopia/core`, reason
  recorded above.

## Suggested next step

Apply the one repair this session deliberately left — `npm run repair:source-text
-- --apply`, free and local, which corrects the nine `vitasilk` `sourceText`
values written from the prompt v1 draft — and then have the user make the first
pass over the `vitasilk` review sheet, because everything else in this block is
blocked behind it. The instrument is now built, self-describing and tested in a
DOM, the selection defect that made its inputs ambiguous is fixed, and the
defect document states the current evidence separately from the superseded
figures; what does not exist is a single human judgement of a single pairing, and
until one does, any transliteration-cost or many-to-one experiment can only be
judged by eyeballing a diff — which is how the discarded same-script fix consumed
most of Block 7 session 9. One reel is enough to start: 39 of `vitasilk`'s 73
rows are the ones the aligner was guessing on, and the **cross-script only**
filter shows exactly those.

## What the user does next

To open the review sheet for the `vitasilk` reel, paste this into the terminal:

```
cd "/Volumes/T7 Shield/INSEA/Projects/framopia-studio" && npm run align:review -- --reel vitasilk && open benchmarks/results/latest-align-review/vitasilk.html
```

Swap `vitasilk` for `test-1`, `test-2`, `test-3` or `ground-truth` for the other
reels. It costs nothing and calls no API.

Along the top you will now see which reel it is, which stored transcription it
was built from, and which version of the aligner it is judging — so if you come
back to this in a month you can tell whether your marks still apply.

Each row shows one word from the finished transcript on the left, and on the
right the piece of the original Arabic transcription the software believes that
word came from, with the moment in the audio it took its timing from. You are
answering one question per row: **did this word really come from that piece of
audio?**

- **correct** — yes, that word really does come from that piece.
- **wrong** — no, it does not. You do not have to say what the right one is.
- **two tokens** — this one word covers two or more pieces of the original, so a
  single match cannot describe it (`26` said as two Arabic words is the usual
  case).
- **no token** — there is nothing in the original that this word came from.

Rows are dimmed where the software had solid evidence and bright where it was
guessing; the bright ones are the ones worth your time, and the **cross-script
only** filter shows just those. Your marks are saved in the browser as you go, so
a reload does not lose them. When you are done, press **Download reference** — it
saves one file, and that file is what every future fix to this part of the
pipeline gets measured against.
