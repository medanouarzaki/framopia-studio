Status: OK

Block 8, session 3. **$0.00 spent, no API called, no aligner logic changed.**
The nine `sourceText` values are repaired, two tooling rules are recorded, and
`npm run align:score` exists.

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| tree at start | clean |
| `main` / `origin/main` at start | `dcc3b1d` / `dcc3b1d` |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances at start / end | **1 / 1** (PID 44015, carried from Block 7). AE was not touched. |
| `aerender` processes at start / end | **0 / 0** |

## Done

### Goal 1 — the nine repaired

**Every reel selected `transcription-758a3924d090d1b5` (prompt v4)**, the pinned
entry, printed per reel before anything was written:

```
ground truth   reading transcription-758a3924d090d1b5 (prompt v4)
test 1         reading transcription-758a3924d090d1b5 (prompt v4)
test 2         reading transcription-758a3924d090d1b5 (prompt v4)
test 3         reading transcription-758a3924d090d1b5 (prompt v4)
vitasilk       reading transcription-758a3924d090d1b5 (prompt v4)
```

Changed per reel: **ground-truth 0, test-1 0, test-2 0, test-3 0, vitasilk 9.**
That is session 2's enumeration exactly — same nine word ids, same old and new
values — so nothing further was withheld.

| id | text | old `sourceText` | new `sourceText` |
|---|---|---|---|
| w0017 | msbsb | `مسبسب.` | `مصبوغ.` |
| w0032 | nourrit | `nourrit` | `ينغى,` |
| w0033 | il | `il` | `يهدئ.` |
| w0034 | hydrate | `hydrate` | `فيه` |
| w0054 | f | `تهلّي` | `تهلي` |
| w0055 | ch3rk | `ch3rk` | `شعرك؟` |
| w0070 | matrddadich | `تتردديش` | `تردديش` |
| w0071 | wla | `wla` | `ولا` |
| w0072 | d9i9a | `d9i9a` | `دقيقة` |

Three carried a prompt v1 draft token outright; six had kept their own Latin
text because the v1 draft held no token at that interval. The tool reopened the
plan after writing and reported **73/73 correct**.

**Re-verified afterwards:**

- `vitasilk`'s 73 plan word texts are still **byte-identical, in order**, to the
  pinned entry's `correctedTexts`.
- `.local/build/.build-options.json` still matches the plan with **0
  mismatches** — 68 subtitle cards (73 groups less 5 superseded) and 3 keywords.
- Only `meta` and `transcript` changed on the plan. Every word's `text`,
  `start`, `end`, `lang`, `script`, `confidence`, `removed`, `removedReason` and
  `edited` is byte-identical to before.

Nothing is committed for this goal: `*.editplan.json` is gitignored.

### Goal 2 — the two rules

Both added to `docs/CLAUDE_CODE_GUIDELINES.md` §3, each with the incident.

**Searched for second homes first.** Neither rule was stated anywhere, in any
form:

- **Write path vs diagnostic** — the only hits for `--apply`, "diagnostic" and
  "write path" across `docs/` and `CLAUDE.md` are command-list entries and
  narrative session records. No statement of the rule, weak or otherwise. New
  subsection.
- **Naming the inputs** — the closest is `docs/CLAUDE_CODE_GUIDELINES.md:57`,
  "anything that asserts a property is verified must be emitted by the thing
  that verifies it." That is about **verification claims**, not about carrying
  provenance of inputs, so the new subsection is written as its sibling and says
  so explicitly rather than competing with it. `docs/BLOCK4-AMENDMENTS.md:77`
  mentions provenance but about one schema field.

**Two rules the Block 7 handoff proposed for §3 never landed** and still are not
there: "never leave a test asserting retired behaviour" and "a rule shared by
more than one tool is pinned by a test." Both are practised in the code and
absent from the guidelines. Not added here — outside this goal's named scope —
but they should go in.

### Goal 3 — the scorer

```
npm run align:score -- --reel <label> [--compare <path>] [--allow-sha-drift] [--entry <id>]
```

- `core/src/align-score.ts` — `scoreAlignment`, `compareAgainstReference`,
  `movedRows`, `AlignScoreError`. Pure, and in `core` so `npm run check` runs it.
- `tools/align-review/score-cli.ts` — the CLI.
- `tools/align-review/load.ts` — new, shared by both CLIs, so the sheet and the
  scorer cannot read different cache entries.
- Import pin unchanged in kind: `@framopia/core/align-score` joins the allowlist
  and the pin now covers all three files under `tools/align-review/`.

**Nothing in it reads the aligner's output as ground truth.** Every figure is
counted from a human's verdicts; the aligner's `draftText` is only ever compared
against what a human judged, never treated as correct.

**Single-run mode** reports the four verdict counts with a cross-script /
same-script split for each, and the headline — the share of **judged** pairings
marked correct. Judged, not total: a half-finished review is not evidence that
the aligner is half wrong, and dividing by the reel would report the reviewer's
progress as the aligner's accuracy.

**Sha drift is a refusal**, naming both shas, overridable with
`--allow-sha-drift`. `--compare` is exempt, because comparing across commits is
what it is for. Exercised live:

```
align:score: the reference was judged at 1111111111111111111111111111111111111111
and the current pairing is at dcc3b1d7392a4c0bd2248cc37ed7966c75c5aaa6. A reference
judges one aligner; scoring it against another says nothing. Re-review at this sha,
use --compare to measure the change, or pass --allow-sha-drift if you have
established the pairing is unaffected.
```

**Comparison mode** buckets every reference row by the human's verdict:

| bucket | meaning |
|---|---|
| `wrong`, now pairs differently | **candidate repairs** — the reference says the old pairing was wrong and says nothing about whether the new one is right |
| `correct`, now pairs differently | **regressions** — a human confirmed these and they changed |
| `two tokens`, still inexpressible | the aligner has no many-to-one operation, so this falls only when the operation set grows |
| `wrong`, unmoved | the change left these exactly as they were |
| `correct`, held | what the change preserved |
| `no token` | so the arithmetic closes over the whole reference |

Regressions are printed with their old and new pairing, not just counted. The
repair count is printed as a **candidate figure** in those words, with the
reason.

**Outputs:** `benchmarks/results/latest-align-review/<reel>.score.json`, stamped
with reel, cache entry id, prompt version, `currentSha`, `referenceSha`,
`comparedSha` and the reference path; and in comparison mode
`<reel>.rereview.html`.

**The re-review sheet is the same renderer with a `variant`**, not a copy — same
CSS, same four verdict buttons, same counters, same Download, same per-token
`dir="rtl"`. It holds only the moved rows and adds a "was paired with" column
beside "now paired with", and its provenance strip names the sha it is measured
against. Its `localStorage` key carries the variant, so a partial pass over one
sheet can never restore into the other.

**With no reference it fails and synthesises nothing:**

```
align:score: reference not found at .../benchmarks/references/align/vitasilk.json.
A reference is a hand-made human judgment — generate the sheet with
`npm run align:review`, mark the rows, press Download, and save the file there.
Nothing synthesises one.
```

`benchmarks/references/align/README.md` gained a section on scoring one.

### Goal 4 — tests

**+28 tests**, all inside `npm run check`.

`core/src/align-score.test.ts` (17), against a fixture whose pairing is asserted
first so the tests score a real alignment rather than a hand-written one:

- every verdict and every bucket, with the cross/same split asserted per verdict;
- the headline over judged rows, and 0 rather than a division by zero on an
  empty reference;
- a word id not in the pairing → rejected, naming it;
- a word whose text changed under the same id → rejected, naming it;
- a reference mixing good and bad ids → rejected, **not** scored on the overlap;
- a `wrong` row that did not move counted as unrepaired, not as a repair;
- a `two-tokens` row still inexpressible even when its pairing moved;
- malformed references: missing `headSha`, missing `schemaVersion`, a verdict
  outside the four (message names all four), and a missing verdict — each
  rejected with the fault named, none silently skipped.

`core/src/align-sheet.test.ts` (+5 DOM tests, happy-dom): the re-review sheet's
column headers and both pairings on screen, the `Re-review` title and the sha it
is measured against, the verdict buttons and counters, the separate
`localStorage` key proven by driving both sheets in one test, and a download
that parses through `parseAlignReference`.

Sha-drift refusal and its override are exercised **live** rather than by unit
test, because they are CLI-level control flow; both transcripts are above.

**No test was left asserting retired behaviour.** The existing key assertion
`framopia.align-review.vitasilk.<sha>` became
`framopia.align-review.review.vitasilk.<sha>` when the variant entered the key.

### Goal 5 — corpus figures against per-reel figures

Every figure re-derived this session against the pinned entry.

| figure | scope | ground-truth | test-1 | test-2 | test-3 | vitasilk | corpus |
|---|---|---:|---:|---:|---:|---:|---:|
| corrected words / subtitle groups | **corpus** | 76 | 67 | 69 | 58 | 73 | **343** |
| cards shorter than intro + minHold | **corpus** | 33 | 21 | 26 | 18 | 22 | **120** |
| cards with a clipped hold | **corpus** | 9 | 7 | 4 | 3 | 5 | **28** |
| cards carrying an overlong single word | **corpus** | 2 | 0 | 1 | 3 | 1 | **7** |
| rendered subtitle cards (groups less superseded) | **corpus** | 76 | 64 | 64 | 58 | 68 | **330** |

- **"120 of 343 under the entrance floor" — corpus.** Confirmed by re-running
  `shortCardTiming` over every group.
- **"28 clipped holds" — corpus.** Confirmed twice, independently: by
  `cardHoldFits` over every group, and by `npm run validate-plan`, which reports
  9 / 7 / 4 / 3 / 5 issues per reel.
- **"cards went 190 → 343" — corpus**, and 190 is the two-word-grouping count.
- **The seven overlong words — corpus**, and they are **7 occurrences of 4
  distinct words**: `polynucléotides` ×1 (ground-truth), `mésothérapie` ×3
  (ground-truth 1, test-3 2), `hyaluronique` ×2 (test-2 1, test-3 1),
  `matrddadich` ×1 (vitasilk). Counted in the plans this session. They were
  seven *cards* under two-word grouping and are seven *cards* now, because at
  one word per card each occurrence is its own card — and each was already
  flagged as a line that still exceeds the bound *after* breaking, so the word
  alone is the problem. **The widths themselves are stale**:
  `benchmarks/RESULTS-block7-wrapping.md` was measured at 193 two-word cards and
  re-measuring needs After Effects, which this session did not touch.

**Live documentation corrected:**

| file | line | was | now |
|---|---|---|---|
| `CLAUDE.md` | 491 | "343 draft words, five reels" | **339 draft word tokens**; 343 is the *corrected* count, not the draft's |
| `docs/PROJECT_SPEC.md` | 53 | "120 of them are shorter than a template's intro + minimum hold" | labelled corpus, with the per-reel split, that none is dropped, and the 28 clipped holds |
| `docs/TEMPLATE_BUILD_SPEC.md` | §4 | "7 of 190 … a group that cannot fit intro, minimum hold and outro has no card at all" | table kept as the two-word-era measurement; current 343 / 120 / 28 beside it; the retired "no card at all" claim removed, since all 343 are built |
| `service/src/analysis/retiming-cli.ts` | 120 | asserted "**No plan in the corpus stores display timing** — `displayStart` is absent on every group of every reel" | counted: 343 of 343 today, with all three branches written |

That last one is the sharpest find of the goal: a tool **asserting** a fact
about its own inputs and emitting it into a committed report. It has been false
since Block 7 session 4 wrote display timing onto all five plans, and nothing
looked. It is the new §3 rule's own subject matter.

**Re-running `npm run retiming` after the fix reports 343 of 343 groups with
display timing, and reading A overlapping 337 of 338 pairs against the committed
record's 162 of 189.** The committed file was **restored, not kept** — it is a
dated record and Goal 5 says to leave those alone. The run was done only to
verify the code still works, and the file is byte-identical to what was
committed before.

**Dated records carrying figures that are now wrong or stale — listed, not
edited:**

- `handoffs/block-7.md:8` — "`vitasilk` builds complete: **343 subtitle
  cards**". 343 is the corpus word total; `vitasilk` has 73 words, 73 groups and
  **68** rendered subtitle cards.
- `handoffs/block-7.md:22` — the hold rule "removed **17.25 s of blank screen**
  on `vitasilk`, down to 0.66 s". **Both are corpus figures.** Measured today,
  blank screen between cards is ground-truth 0.000 s, test-1 0.000 s, test-2
  0.500 s, test-3 0.080 s, **vitasilk 0.080 s**, corpus **0.660 s**.
  `service/src/analysis/display-timing.ts:144` states it as corpus and is right;
  the handoff is the site that is wrong.
- `benchmarks/RESULTS-block7-wrapping.md` — measured at **193 two-word cards**;
  its per-reel card counts (40 / 43 / 38 / 31 / 41) are two-word era and its
  "seven cards still over the bound" list is the source of the seven.
- `benchmarks/RESULTS-block7-retiming.md` — carries the false display-timing
  claim and 162/189; regenerating gives 343/343 and 337/338.
- `benchmarks/RESULTS-block6-timing-budget.md`, `-block6-script-grouping.md` —
  two-word era throughout.
- `reports/*` — dated by definition.

**Checked and found correct, not changed:** `display-timing.ts:186`'s "only 3
cards in the whole corpus reach" `MAX_SUBTITLE_HOLD_S`. A first pass comparing
for exact equality with 1.20 s said 2 and would have been reported as a
correction; the honest test is `>= 1.20`, which finds 3 — test-2 1, test-3 1,
vitasilk 1 — because vitasilk's card is 1.26 s, its own speech exceeding the
cap. Also correct and unchanged: `CLAUDE.md:3222`, `CLAUDE.md:3592`,
`short-card.ts:6,80`, `buildability.ts:63`, `timing-budget.ts:47` and
`floor-rule.test.ts:13`, all of which state 120 / 28 / 343 as corpus figures.

### Goal 6 — CLAUDE.md

The `align:score` command with what each mode does and what a reference file is;
both new guideline rules in condensed form as binding conventions; the corpus /
per-reel table; and a Block 8 session 3 section. The prompt-version freeze from
session 2 is untouched.

### Goal 7 — regression check

`npm run check` — **exit 0, `check: PASS`**.

| workspace | tests | against session 2 |
|---|---:|---|
| `@framopia/core` | 215 (10 files) | 187 |
| `framopia-service` | 737 (53 files) | 737 |
| `framopia-benchmarks` | 166 (16 files) | 166 |
| **TS total** | **1118** | **1090** |
| pytest (sidecar) | **141** | 141 unchanged |

## Deviations

- **`service/src/analysis/retiming-cli.ts` was changed**, which is a code fix
  inside a documentation goal. Goal 5 asks for sites repeating a figure wrongly;
  this one *asserts* a corpus-wide fact that is false and writes it into a
  committed report, so leaving it would have meant correcting the prose sites
  and leaving the machine that regenerates a false one. The fix only replaces
  an assertion with a count.
- **`docs/TEMPLATE_BUILD_SPEC.md` §4 lost a sentence that was not a figure** —
  "a group that cannot fit intro, minimum hold and outro inside its own display
  window has no card at all." It describes behaviour retired in Block 7 session
  9 and sat directly on the entrance-floor figure Goal 5 names, so it was
  corrected with it rather than left contradicting the builder.
- **The re-review sheet is a `variant` of the existing renderer, not a new
  one.** The goal says "a sheet in the same style"; sharing the renderer makes
  that true by construction rather than by discipline, at the cost of a
  conditional in `renderSheet`.
- **A throwaway probe with fabricated verdicts was used to exercise the CLI**,
  written to `/tmp` for compare mode and briefly to
  `benchmarks/references/align/vitasilk.json` for single-run mode and the drift
  paths. **It was removed**; that directory holds only `README.md`, verified
  after. No fabricated verdict was ever committed, and the unit tests use their
  own synthetic references.
- **Sha-drift refusal and `--allow-sha-drift` are proven live, not by unit
  test.** They are CLI control flow around `process.argv` and the repo's `.git`;
  a unit test would have had to test a re-implementation. Both transcripts are
  in Goal 3.

## Failures & open problems

- **Nothing was lost or corrupted this session.** No cache entry, ledger line or
  template was written. The nine `sourceText` values are the only plan change
  and they were repaired, not damaged; the plan was reopened and verified after.
  The ledger is byte-identical at both ends.
- **The sheet's `localStorage` key changed**, from
  `framopia.align-review.<reel>.<sha>` to
  `framopia.align-review.<variant>.<reel>.<sha>`. Marks saved in a browser under
  the old key will not be read. **Nothing was lost in fact** — no review has
  been started — but if the user had a partial pass open in a tab, it is
  orphaned.
- **Still no reference exists.** `benchmarks/references/align/` holds only its
  README. The scorer has never been run against a real human judgement, so
  **every path through it is proven only against synthetic input**, and the
  project still has no non-circular measure of aligner correctness. Building the
  scorer did not create one.
- **The re-review sheet has never been produced from a real comparison** — only
  from the throwaway probe. Its row selection is right in that run and in the
  unit tests, but no aligner change has ever been measured.
- **Neither sheet has been opened in a real browser.** happy-dom lays nothing
  out, so styling, the RTL rendering of Arabic beside Latin, the dimming of
  same-script rows and the real `<a download>` save remain visually unverified.
  `<a>.click()` and `URL.createObjectURL` are stubbed in the tests.
- **`beforeunload` is still untested** — happy-dom does not run the unload
  lifecycle.
- **The seven overlong words are counted but not re-measured.** Their widths
  come from a survey taken at 193 two-word cards. Confirming them at one word
  per card needs `npm run wrap:survey`, which drives After Effects.
- **`benchmarks/RESULTS-block7-retiming.md` is knowingly stale** — it carries a
  claim now known false and figures from before display timing existed.
  Regenerating it changes recorded Block 7 numbers substantially (162/189 →
  337/338) and is a decision, not a chore.
- **Two rules the Block 7 handoff proposed for the guidelines are still
  missing** — "never leave a test asserting retired behaviour" and "a rule
  shared by more than one tool is pinned by a test." Both are practised; neither
  is written down.
- **A third copy of the Arabic-script regex remains** across
  `core/src/normalize.ts`, `service/src/transcription/tagging.ts` and
  `core/src/align-review.ts`, with no test pinning them equal — which the second
  missing rule above would require.
- **`tools/` is still neither typechecked nor linted.** It now holds four files
  under `align-review/` alone.
- Carried forward from the Block 7 handoff: headless is not met, the AE audit
  path names `Adobe After Effects 2026` literally, a stray `-r` process must be
  treated as live, `vitasilk` is the only reel ever built, 28 cards have a
  clipped hold, all 13 multi-word Arabic §6 terms split across cards, the cutout
  pipeline produces an artifact nothing displays, and `runSidecar` still lives
  in `service/`.

## Repo state

- Branch **`main`**, worked on `main`. No force-push, no history rewritten.
- HEAD at the time of writing: **`5a5d48a` `docs: label the corpus figures and
  drop a retired claim`**, preceded by `docs: record the write-path and
  input-naming rules`, `fix: count display timing in the retiming report` and
  `feat: add the alignment reference scorer`, on session 2's `dcc3b1d`.
  **This report's own commit (`docs: record block 8 session 3`) follows it** and
  is not reflected in that subject line.
- `git log` checked for AI attribution and co-author trailers across the
  session's commits: none.
- `npm run check`: **exit 0, `check: PASS`** — 1118 TS tests across three
  workspaces, 141 pytest.
- Ledger `.local/costs.jsonl`: **108 lines**, sha256 `50ec3f57…` at session start
  and end, byte-identical. All-time spend unchanged at **$10.968590**.
- After Effects: **1 instance** (PID 44015) at start and end, **0** `aerender`
  processes at either. Not touched.
- `templates/library.aep` not opened; still `dac234ce…`.
- No new dependency.

## Suggested next step

Have the user make the first pass over the `vitasilk` sheet, because every
remaining thing in this block is behind it and nothing else can substitute. The
instrument is complete now — the sheet says what it is built on, the scorer
turns verdicts into a measurement and refuses to score across shas, and the
re-review sheet closes the loop on a fix — but all of it has been exercised only
against synthetic input, so the first real reference is also the first real test
of the tooling. Thirty-nine of `vitasilk`'s 73 rows are the ones the aligner was
guessing on and the cross-script filter isolates them, so it is an evening's
work rather than a project. Once that file exists, `npm run align:score --
--reel vitasilk` gives the first honest number this defect has ever had, and any
transliteration-cost or many-to-one experiment can be measured with `--compare`
instead of judged by eye — which is how the discarded same-script fix consumed
most of Block 7 session 9.

## What the user does next

Open the review sheet for the `vitasilk` reel:

```
cd "/Volumes/T7 Shield/INSEA/Projects/framopia-studio" && npm run align:review -- --reel vitasilk && open benchmarks/results/latest-align-review/vitasilk.html
```

Swap `vitasilk` for `test-1`, `test-2`, `test-3` or `ground-truth` for the other
reels. It costs nothing and calls no API.

Along the top you will see which reel it is, which stored transcription it was
built from, and which version of the software it is judging — so if you come
back in a month you can tell whether your marks still apply.

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
only** filter shows just those. Your marks save in the browser as you go, so a
reload does not lose them.

When you are done, press **Download reference**. Move that file to
`benchmarks/references/align/vitasilk.json` — the name matters — and then run:

```
cd "/Volumes/T7 Shield/INSEA/Projects/framopia-studio" && npm run align:score -- --reel vitasilk
```

That prints how much of the software's guessing you confirmed, and it is the
first real measurement this problem has ever had. From then on, every attempt to
fix the timing can be checked against your marks instead of by watching the reel
again — and if an attempt breaks something you had confirmed as right, it says
so instead of hiding it inside a total.
