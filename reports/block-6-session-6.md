Status: OK

Script-aware grouping is implemented, measured, and written to all five plans.
Whole-term grouping is deliberately not implemented and the resulting §6c
violations are itemized. `docs/TEMPLATE_BUILD_SPEC.md` is written. No API call
was made and nothing was billed.

## Done

**Session-start checks.** T7 mounted, repo at
`/Volumes/T7 Shield/INSEA/Projects/framopia-studio`. `git status
--untracked-files=no` empty. Ledger sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`,
**108 lines**. Session 5's commits were local and were **pushed**:
`origin/main` went `c6b5ad2` → `a16ea9c`.

### Goal 1 — script-aware grouping

`service/src/analysis/regroup.ts`. Script boundaries are computed once, before
the keyword loop, and added to the cut set **after** it, so a keyword span
cannot delete one. The pass still only splits, so PROJECT_SPEC §5's 1–2 word
rule cannot be broken by it. A post-condition throws if any rebuilt group mixes
scripts — unreachable by construction, and there because a mixed card would
reach a screen needing a font switch mid-string.

**`transcript.terms` is not read.** Grouping is fully deterministic this
session.

**The keyword conflict is handled by dropping, and it is real.** A keyword span
that straddles a script boundary gets the new `DroppedKeyword` reason
`span-is-mixed-script`. **test-1 `k003` "jawdat البشرة" is the only one in the
corpus** and it is dropped; test-1 keeps two of three keywords. Narrowing was
rejected — which half of a mixed span carries the emphasis is not this pass's
judgement to make.

**`supersededBy` survives, verified rather than assumed.** Session 2 recorded
that merging renumbers groups and breaks those links. Splitting does not: the
pass rebuilds every group from the cut set and re-attaches the owner by the
span's start position. A test drives a split elsewhere in the reel and asserts
the keyword's group keeps both its words and its `supersededBy`.

Tests in `service/src/analysis/regroup.test.ts` — nine added, all of the
required cases plus two: an alternating Latin/Arabic sequence cutting at every
boundary, and an explicit never-enlarges assertion.

### Goal 2 — the measurement

`benchmarks/RESULTS-block6-script-grouping.md`.

**Mixed-script groups: 10 → 0**, matching session 1's count exactly. All ten
named in the results file with reel and text.

| reel | groups before | after | changed |
|---|---|---|---|
| ground truth | 38 | 40 | 4 |
| test 1 | 38 | 44 | 12 |
| test 2 | 37 | 38 | 2 |
| test 3 | 30 | 31 | 2 |
| vitasilk | 41 | 41 | 0 |
| **pooled** | **184** | **194** | **20** |

Pooled speech duration min / p10 / median / max: **0.000 / 0.240 / 0.520 /
1.260 → 0.000 / 0.220 / 0.480 / 1.260**. Neither the minimum nor the maximum
moves on any reel — splitting a pair cannot produce a group shorter than the
shortest word already in it.

**Eleven multi-word §6 terms still split across cards**, each named in the
results file with reel, group ids and the text as each card would show it.
Term identity is read off ORTHOGRAPHY_GUIDE §6's own example list by eye, which
the results file states plainly. This is the recorded state of the accepted
violation.

**Timing budget: 7 of 190 groups unbuildable at intro+outro 0.13 s / minHold
0.10 s, against session 1's 6 of 182.** No cell in the 25-cell grid moves more
than 2 points.

**Of that one-group difference, one is this change's cost and one is not:**

- **newly unbuildable, caused by this change** — test-1 `hia`, 0.099 s. It was
  half of the mixed group `الكولاجين hia`, buildable at 0.700 s; split off, it
  stands alone and cannot be extended or merged.
- **newly unbuildable, NOT caused by this change** — test-2 `le`, 0.139 s.
  Byte-identical before and after; it became a lone group when session 5 ran
  test-2's first keyword analysis. Session 1 swept test-2 at 35 groups, it is
  37 now for that reason.
- **newly buildable** — test-1 `mn`, unchanged in itself, now rescued by a
  merge.

**Script-aware grouping is therefore net neutral on buildability.**

**The merge rescue woke up**: 20 → 245 merges across the grid, 0 → 4 at the
loosest budget. Splitting creates the adjacent single-word groups the rescue
needs. Consequence recorded in the results file: **two cards the plan lists
separately can be shown as one**, so the group count on a plan is not the card
count on screen.

`npm run timing-budget` gained **`--footage <dir>`**, read-only, so the sweep
could run on copies before the corpus was written.

### Goal 3 — the corpus write

All five backed up **before any was written**, so a failure part-way through
restores the whole corpus rather than the part it reached. Each written through
`writeEditPlan` (which validates first) and reopened through `readEditPlan`.
Backups at `my files/test videos/<name>.editplan.json.pre-script-grouping.bak`.

| plan | before | after |
|---|---|---|
| ground truth | `cb7598e8e34ecc71e0d8564ef2297a1e0978292aad577fd13c83c7f10a0d0a6e` | `15c243b7a46a2d5638d9c150c37571270dc817525048f6fce1b403954a18f85f` |
| test 1 | `a816fb6e4320cc06563bd9e36f05e318f24e66523d155acfa563c504cf715877` | `2340846772a2753fed4fed1d6a05acde229a33f2fdeded71242b18f075c3c003` |
| test 2 | `ea48552b5d1713e0a2b2259c7ea8934ed0896b6baa39968ddc9c82d775ab4b8c` | `3694e15a3d79dc54a5b9f36b1c3ffeaa4c28f86a5c113004a21728179730e5ce` |
| test 3 | `033ca520dee05cd70402a73c50f577ed2fbae47bf55a2668012dcedc9599bc45` | `9d98ef90d56aa0c58be029ced731284b984b13bf77b0832eb6d10cb9268bcf07` |
| vitasilk | `90f1a7fce12ce6f2ff2649a6840acc9393ffd92287cfc90c7f8ca73dc37b4bdb` | **unchanged** |

vitasilk is byte-identical, which is the correct outcome for an all-Latin reel
and a useful check that the pass does nothing when there is nothing to do.

**A gitignore hole was found and closed.** `.gitignore` had `*.editplan.json`,
which does not match `<name>.editplan.json.pre-script-grouping.bak`, so the
backups showed up as untracked and committable. `*.editplan.json.*` now covers
them. Nothing was committed before the fix.

### Goal 4 — the build spec

`docs/TEMPLATE_BUILD_SPEC.md`. TEMPLATE_LIBRARY_GUIDE §3–§8 was read first and
is referenced rather than restated. It records the six comps and their
placeholders; comp settings; the type constants from `core/src/typography.ts`
with `y` as the baseline and the layer anchor at 0,0; the **intro+outro ≤
0.13 s / minHold 0.10 s** budget with the measured cost of two extra frames
(**7 unbuildable at 0.13 s, 16 at 0.20 s**); the intro/hold/outro contract and
what the three manifest fields mean; that keyword templates declare no offset
and that `KEYWORDS_ARE_INSIDE_SUBTITLE_BAND` depends on it; why the `_ar`
variants exist and that Block 7 selects by the group's `script`; and that every
manifest entry carries `sfx: []` until audio exists.

Two things it flags that the goals did not ask for and that nobody has tested:
comps are authored at **30 fps against 29.97 fps footage** (about one frame of
drift every 33 s, under a frame on a 25 s reel, never exercised end to end),
and the two `_ar` ids **must be added to `modes/k2-syndicalia.json`'s
`allowedTemplates`** before they can be assigned.

## Deviations

- **`npm run timing-budget` gained a `--footage <dir>` flag.** The CLI read a
  fixed directory, so sweeping the new grouping would have meant writing the
  corpus first — which goal 3 forbids until goal 2's numbers exist. The flag is
  read-only and four lines. It also makes the tool reusable for the next
  grouping change.
- **`.gitignore` was edited**, which no goal asked for. The backups goal 3
  mandates were committable without it.
- **The manifest's stub timings were left alone.** `sub_pop` still declares
  0.26 s of intro+outro, twice the measured budget. It is explicitly a stub
  whose entries the built comps replace, and editing placeholder timings to
  match a spec the comps do not yet meet would assert something untrue. The
  spec says to replace them and names the current values.
- **Two extra tests** beyond the required list, noted above.

## Failures and open problems

- **Eleven §6 terms render split across cards.** This is the accepted
  violation, not a surprise, but it is the largest known-wrong thing in the
  pipeline and it will be visible on the first built comp. Worst case is
  test-1's `شد طبيعي للوجه` across three cards. The revisit needs term
  boundaries the model does not yet produce reliably.

- **Term identity in the results file was judged by eye.** Nine of the eleven
  match an example in ORTHOGRAPHY_GUIDE §6 or §6c verbatim; **`شد خفيف للبشرة`
  is not in the guide's list** and is called a term on its identical
  construction to `شد طبيعي للوجه`. A term the guide does not name and nobody
  recognised would not appear in the count at all, so the eleven is what we can
  identify, not a total.

- **test-1 lost a keyword.** `k003` was one of three on that reel and there is
  no replacement — the selector is not re-run, so test-1 now carries two
  keywords where `keywordCountFor` asked for three. Nothing reports this as a
  shortfall because the drop happens after selection.

- **Grouping is script-aware only in the analysis pass.** `groupWordsIntoSubtitles`
  in `service/src/transcription/grouping.ts` still pairs across scripts, so a
  freshly transcribed reel carries mixed groups until analysis runs. Every reel
  in the corpus has been through the analysis-stage pass now, so nothing on
  disk is mixed, but a new reel would be until it is analysed. Implementing it
  in the analysis pass is what the goal specified; naming the gap here.

- **The 30 fps / 29.97 fps mismatch is recorded and untested.** It is in the
  build spec because Block 7 is where it would first show.

- **Two of the seven remaining failures are degenerate word timings**, not
  animation problems: vitasilk `mn` at 0.000 s and test-1 `tb3i m3aya` at
  0.030 s. Unchanged since session 1 and still a Block 2 alignment question.

- **The unused terms machinery is now load-bearing documentation.**
  `Transcript.terms`, `terms.ts`, prompt version 4 and the validator rules are
  all live and all unread by grouping. The risk is that a future session reads
  them as an oversight and removes them; `CLAUDE.md`, the results file and the
  `regroupForKeywords` doc comment each say why they are there.

## Repo state

- Branch `main`, clean apart from `CLAUDE.md`, staged into the report commit.
  `origin/main` is at `a16ea9c` — **session 5's commits were pushed this
  session; this session's own commits are local and unpushed.**
- **HEAD at the time of writing is
  `7a1f995 docs: add the template build spec for the first comp set`**,
  preceded by `4e10266 chore: ignore edit plan backups beside the plans`,
  `3dd5732 docs: measure script-aware grouping across the corpus` and
  `c0ec5ab feat: never mix scripts within one subtitle group`. **The commit
  carrying this report follows HEAD and cannot be named here.**
- **Ledger `.local/costs.jsonl`, session start and session end, identical:**
  sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`,
  **108 lines** at both ends. No billable call was made.
- **`npm run check`: exit code 0, `check: PASS`.** core 127 tests / 6 files,
  service 617 / 43, benchmarks 166 / 16 — **910 TypeScript tests**, up from 901
  (+9 script-aware grouping). pytest **141 passed**, unchanged.

## Suggested next step

The build spec is what the user needs next and it is written, so the next
session should be whatever unblocks the comps once they exist rather than more
grouping work. Two things are worth doing before Block 7 opens, both free and
both small: add `sub_pop_ar` and `kw_slam_ar` to
`modes/k2-syndicalia.json`'s `allowedTemplates` and to `templates/manifest.json`
as entries, so that `npm run validate:modes` and the deterministic template
assigner can see them the moment the comps land — the assigner is already
tested against a multi-variant fixture and will distribute two subtitle variants
without further work, but it throws `NoTemplateVariantError` on a type with no
allowed variant, so an `_ar` group would fail hard today. The other is the
degenerate word timings: two of the seven unbuildable groups have 0.000 s and
0.030 s of speech, they have survived unexamined since session 1, and they are
alignment artifacts rather than template problems — worth an hour in
`service/src/transcription/align.ts` before the user concludes their animation
budget is at fault for cards that were never going to build.
