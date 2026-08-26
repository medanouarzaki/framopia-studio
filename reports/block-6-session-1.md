Status: OK

The Block 5 handoff, a plan inventory, the subtitle timing budget sweep, and the
script scan. No API call was made and nothing was billed.

## Done

### Goal 1 — the Block 5 handoff

`handoffs/block-5.md` committed alone as `8d1b658 docs: add block 5 handoff`,
101 lines, no other file in the commit.

### Goal 2 — plan inventory

All five plans opened cleanly through `readEditPlan`. None failed.

| reel | words | subtitle groups | keywords | image slots | zones | stages `done` |
|---|---|---|---|---|---|---|
| ground truth | 76 | 38 | 0 | 0 | 11 | transcription, zones |
| test 1 | 67 | 38 | 3 | 4 | 24 | transcription, analysis, images, zones |
| test 2 | 69 | 35 | 0 | 0 | 29 | transcription, zones |
| test 3 | 58 | 30 | 0 | 0 | 16 | transcription, zones |
| vitasilk | 73 | 41 | 3 | 5 | 20 | transcription, analysis, images, zones |

Only vitasilk and test-1 have run analysis and image generation. `build` is
`done` on none of them.

### Goal 3 — the timing budget sweep

`service/src/analysis/timing-budget.ts` and `timing-budget-cli.ts`, wired as
`npm run timing-budget`. Output: `benchmarks/RESULTS-block6-timing-budget.md`.

**Both existing functions were reusable as they stand, so neither was
reimplemented.** `checkBuildability(plan, templates)` and
`applyDisplayTiming({groups, templates, reelDurationS})` both already take a
caller-supplied `Map<string, TemplateEntry>`, and `TemplateEntry` carries
`introS`, `outroS` and `minHoldS`. The sweep builds one synthetic template per
element kind holding the candidate triple and points every element at it. Only
the sum `introS + minHoldS + outroS` is ever compared, so the even split
between intro and outro affects no number here.

**Display timing is re-derived from speech timings for every cell.**
`applyDisplayTiming` reads only `start`, `end`, `wordIds`, `supersededBy` and
`templateId`, and returns new group objects; the stored `displayStart` and
`displayEnd` are explicitly cleared on the in-memory copies before it runs. A
test pins that a stored 9-second display window plays no part in the result,
and another pins that the input plan is not mutated. **The plans on disk were
hashed before and after the run and are byte-identical.**

Worth stating: **no plan currently stores display timing at all** — 0 of 182
groups across the five reels carry `displayStart`. So `displayWindow` has been
falling back to speech timings everywhere, and the risk the brief guarded
against could not have materialised on today's data. It would have on tomorrow's.

**The answer. No swept budget makes every subtitle group buildable.** The
fewest failures is **6 of 182 groups**, at the loosest cell: intro+outro
**0.13 s** with minHold **0.10 s**, a floor of 0.23 s — 97% buildable. Against
the stub's current 0.33 s floor the corpus sits at 86%.

Pooled subtitle groups, percentage buildable:

| intro+outro | minHold 0.10 | 0.15 | 0.20 | 0.25 | 0.30 |
|---|---|---|---|---|---|
| 0.13 s (4f) | **97%** | 93% | 86% | 81% | 74% |
| 0.20 s (6f) | 92% | 84% | 78% | 72% | 66% |
| 0.27 s (8f) | 81% | 77% | 67% | 63% | 55% |
| 0.33 s (10f) | 74% | 67% | 62% | 55% | 47% |
| 0.40 s (12f) | 66% | 57% | 53% | 43% | 35% |

The six that fail at the loosest budget:

| reel | group | text | on screen | short by |
|---|---|---|---|---|
| ground truth | `g002` | cernes pigmentés | 0.221 s | 0.009 s |
| ground truth | `g028` | houa wa7d | 0.147 s | 0.083 s |
| test 1 | `g002` | شد | 0.200 s | 0.030 s |
| test 1 | `g007` | tb3i m3aya | 0.060 s | 0.170 s |
| test 1 | `g036` | mn | 0.201 s | 0.029 s |
| vitasilk | `g017` | mn | 0.040 s | 0.190 s |

**Two structural findings decide how to read the grid.**

- **The merge rescue barely fires.** 20 merges across 125 reel-cells, in 20 of
  them, and **0 at the loosest budget**. `applyDisplayTiming` merges only when a
  pair totals two words or fewer, and grouping has already paired words wherever
  it could, so adjacent single-word groups are rare. Extension into silence does
  the work.
- **Silence is the scarce resource, not the budget.** Pooled gap after a group:
  min 0.000 · p10 0.020 · **median 0.059** · max 1.200 s. A card can rarely be
  held more than hundredths of a second past its words, so what a group can
  reach is close to what it was spoken in.

Pooled raw group speech duration: min **0.000** · p10 0.241 · median 0.520 ·
max 1.260 s (n=182).

Per reel, speech duration / gap / shortest group:

| reel | duration min·p10·median·max | gap min·p10·median·max | shortest group |
|---|---|---|---|
| ground truth | 0.087 · 0.221 · 0.520 · 1.060 | 0.006 · 0.019 · 0.039 · 0.460 | `g028` "houa wa7d" 0.087 s, 0.060 s after |
| test 1 | 0.030 · 0.180 · 0.500 · 1.020 | 0.000 · 0.020 · 0.040 · 0.620 | `g007` "tb3i m3aya" 0.030 s, 0.030 s after |
| test 2 | 0.261 · 0.299 · 0.520 · 1.099 | 0.020 · 0.020 · 0.060 · 1.200 | `g011` "fa houa" 0.261 s, 0.020 s after |
| test 3 | 0.231 · 0.300 · 0.581 · 1.199 | 0.000 · 0.019 · 0.059 · 0.760 | `g009` "Eyes fa" 0.231 s, 0.030 s after |
| vitasilk | 0.000 · 0.220 · 0.521 · 1.260 | 0.019 · 0.030 · 0.079 · 0.381 | `g017` "mn" **0.000 s**, 0.040 s after |

**Two of the six failures are degenerate word timings, not display problems.**
vitasilk `g017` has a speech duration of exactly **0.000 s** and test-1 `g007`
of 0.030 s. `findShortWords` already reports these as Block 2 alignment
artifacts. No intro or outro choice rescues them, and the sweep counts them as
failures because they are unbuildable, not because the budget is wrong.

Keywords and image slots are reported per cell in the results file for the two
reels that have them. Keyword templateIds are `null` on both reels, so the
sweep substitutes a synthetic id there too; without that they would be reported
as "no templateId assigned" rather than measured.

Tests: `service/src/analysis/timing-budget.test.ts`, 15 tests, fixtures only.
A group fitting exactly at a budget; one missing by one frame (0.0334 s at
29.97) with no silence; the same group rescued by silence; extension stopping
at the next group's start; stored display timing ignored; the input plan not
mutated; the merge path exercised explicitly; and the spread and gap helpers.

### Goal 4 — the script scan

Read-only, no code path changed.

**(a) Mixed-script subtitle groups: 10 across the corpus. Not zero.**

| reel | mixed | groups found |
|---|---|---|
| ground truth | 2 of 38 | `g031` "3lih الكافيين", `g037` "wki3tiw نتائج" |
| test 1 | 6 of 38 | `g005` "bghiti تحفيز", `g018` "للكولاجين f", `g031` "fa محفزات", `g032` "الكولاجين hia", `g034` "إبر katji", `g037` "jawdat البشرة" |
| test 2 | 1 of 35 | `g030` "diri الوجه" |
| test 3 | 1 of 30 | `g022` "kay3ti نتائج" |
| vitasilk | 0 of 41 | — |

**A single-script subtitle template contract does not stand.** One in eighteen
groups puts a Latin word and an Arabic-script word on the same card, and the
Arabic word is first in three of the ten.

**(b) Arabic-script keyword spans.** Only test-1 has any: **2 of 3 wholly
Arabic** — `k001` "شد", `k002` "محفزات الكولاجين" — and **`k003` "jawdat
البشرة" is mixed-script**. vitasilk's 3 keywords are all Latin. So the keyword
template faces the same mixed-script case as the subtitle template.

**(c) Image slots by presentation.**

| reel | cutout | card | null | total |
|---|---|---|---|---|
| vitasilk | 1 | 4 | 0 | 5 |
| test 1 | 0 | 0 | 4 | 4 |
| ground truth / test 2 / test 3 | 0 | 0 | 0 | 0 |

test-1's four slots have never been through the quality gate, which is what
sets `presentation`; its images have not been generated.

### Goal 5 — housekeeping

`CLAUDE.md` updated with the new command, the sweep's findings and the script
scan. `npm run check` result below.

## Deviations

- **The tree was not strictly clean at session start.** `git status --porcelain`
  showed exactly one entry, `?? handoffs/block-5.md` — the untracked file goal 1
  instructs me to commit. **Zero tracked files were modified.** I judged this not
  to be the "dirty tree" the stop condition guards against, since the sole
  untracked file is the session's own first deliverable, and proceeded. Flagging
  it rather than deciding silently.
- **The sweep substitutes synthetic template ids on an in-memory copy.** The
  plans carry a mix of stub ids (`sub_pop`, `img_float`, `img_slide_left`) and
  nulls, and `checkBuildability` reports a null id as "no templateId assigned"
  rather than measuring it. Without the substitution three reels and all
  keywords would have been unmeasurable. Nothing is written back.
- **Only duration failures are counted.** `checkBuildability` also reports
  keyword-to-group alignment and slot overlap; re-deriving display timing
  renumbers groups and can disturb the first of those, and neither is what a
  timing budget decides. The sweep filters to issues carrying `shortByS`.
- **The intro/outro split is even.** Only the sum is ever compared, so the split
  is arbitrary; stated in code and in the results file.
- **Goal 4's scan lives in this report only**, not in `benchmarks/`, because the
  brief called it a scan and a report rather than a feature.

## Failures and open problems

- **I shipped a wrong sentence and had to correct it.** The results file first
  claimed "the merge rescue never fires" in the same sentence as the number 20.
  It fires 20 times in 20 of 125 reel-cells and 0 at the loosest budget; the
  wording is now accurate. Worth recording because the number was right and the
  claim was not.
- **Two unit-test fixtures initially passed for the wrong reason**: two adjacent
  single-word groups triggered the merge path, so the "misses by one frame" case
  never failed. Rewritten with two-word groups, which is also what the real
  corpus looks like, and an explicit merge test added.
- **The grid is an assumption**, in those words. The five intro+outro totals and
  five minHolds were given, not derived from anything measured. So are the
  29.97 fps frame equivalences.
- **The 0.05 s degenerate-word threshold** used to count alignment artifacts is
  `MIN_SANE_WORD_DURATION_S`, itself unmeasured and inherited from Block 3.
- **Nothing here validates that a real AE comp can animate in the reported
  budget.** The sweep measures whether content is long enough for a declared
  floor; whether a legible pop-in is possible in 4 frames is a question for the
  comps, not for this tool.
- **`checkBuildability`'s keyword-alignment check is untested under
  re-derivation.** Merging renumbers groups and breaks `supersededBy` links; the
  sweep filters those issues out rather than handling them, so if a future
  caller wants alignment checked after re-derivation, it does not work today.
- **Image slots and keywords are measured on two reels only** — vitasilk and
  test-1 — and test-1's slots have no `presentation`, so the cutout/card split
  rests on vitasilk's five slots alone.
- **The build stage has run on no reel**, so nothing in this session is
  validated end to end against an actual composition.
- The sweep was run once; it is deterministic and pure, but **I did not run it
  twice and diff** to demonstrate that.

## Repo state

- Branch `main`. `origin/main` is at `10790a7`; three commits are local and
  unpushed. Nothing was pushed this session.
- **HEAD at the time of writing is
  `a36d262 docs: record the block 6 timing budget sweep`**, preceded by
  `5948161 feat: sweep the subtitle timing budget across every plan` and
  `8d1b658 docs: add block 5 handoff`. **The commit recording this report
  follows HEAD and cannot be named here.**
- **`npm run check`: exit code 0, `check: PASS`.** core 121 tests / 5 files,
  service 588 / 41, benchmarks 166 / 16 — **875 TypeScript tests**, up from 860.
  pytest **141 passed**, unchanged. Reference verification clean; both model
  pins verified ok.
- **Ledger `.local/costs.jsonl`, session start and session end, identical:**
  sha256 `a7e85e4bd5253bda8578aa008629c08a1726e145734ae04b16242f73fc64813d`,
  **105 lines** at both ends. No billable call was made.
- **The five Edit Plans are byte-identical** before and after the sweep, hashed
  and compared. No mask, frame or asset was touched.

## Suggested next step

Build the subtitle comp against the 0.13 s intro+outro / 0.10 s minHold budget
and accept that six groups will not be buildable, because the grid says nothing
cheaper exists and two of those six are broken word timings rather than a
template problem — chasing them belongs in Block 2's alignment, not in After
Effects. The more consequential finding for what gets animated is the script
scan: ten subtitle groups and one keyword span mix Latin and Arabic on a single
card, so the comps need a text layer that handles both directions in one line
rather than a Latin template and an Arabic template, and that is a design
decision worth settling before any keyframe is set.
