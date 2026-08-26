Status: PROBLEM — goal 1 stopped: Block 6 built no reusable text-measurement machinery, so subtitles still do not wrap

# Block 7 session 4 — the whole reel, twice

Spent **$0.00**. No Gemini call, no ElevenLabs call, no billable request. The
cost ledger is byte-identical at both ends: **108 lines**, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.
`templates/library.aep` is byte-identical at both ends: sha256
`dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa`.

**After Effects instances: 1 at session start and 1 at session end**, PID
44015, command line
`/Applications/Adobe After Effects 2026/Adobe After Effects 2026.app/Contents/MacOS/After Effects`
with no arguments and no `-r`. The nine other AE processes were the documented
helpers and were not counted. The count was re-checked before every `DoScript`
(`assertOneInstance` in `service/src/build/drive.ts` does it in code) and never
changed. Nothing was launched, nothing was killed.

Five of six goals are complete. **Goal 1 stopped on its own stop condition**
and the built reel is therefore still clipped at the comp edges.

## Done

### Goal 1 — NOT done, and why

The goal said to measure text width with "the same glyph-outline machinery
Block 6 session 4 built", and to **stop rather than duplicate** if it could not
be reused. It cannot be reused, because it does not exist as code. Verified
four ways before stopping:

- **`FONT_METRICS` in `core/src/typography.ts` carries vertical ink extents
  only** — `{ unitsPerEm, ascent, descent }` per face. There is no advance
  width, no kerning table, nothing horizontal.
- **No committed file imports fontTools or opens a font.** A repo-wide grep for
  `TTFont`, `getGlyphSet`, `BoundsPen`, `glyf` and `usWinAscent` across `.py`
  and `.ts` matches `core/src/typography.ts` alone, and there only inside doc
  comments describing a measurement that was done elsewhere.
- **`benchmarks/RESULTS-block6-band-repertoire.md` is hand-written.** Nothing
  in the repo names it as an output path — unlike every other results file,
  which has a generator.
- **fontTools 4.63.0 is installed in `tools/cv/.venv` but absent from
  `tools/cv/requirements.txt`**, so it is an unpinned incidental that
  `npm run check`'s model-pin discipline does not cover.

So Block 6 session 4 produced a *measurement*, recorded its numbers, and
discarded the script. Nothing was lost this session; it was already gone.

**Why this is a real ruling and not pedantry.** Measuring width is a
substantially harder problem than the vertical extents that were measured:
it needs per-glyph advances, kerning pairs, and — for the Arabic track —
positional shaping, since an initial, medial, final and isolated form of the
same letter have different advances. A naive implementation would silently
make wrong wrap decisions on exactly the Arabic cards that most need them.
There is also an architectural question underneath it: font measurement in
this repo would have to live either in the Python sidecar (where fontTools is,
unpinned) or as a TypeScript implementation in `core/` (where the constants
are), and that is a decision about the shape of the project, not something to
settle inside a goal.

**What was therefore not done, and is not claimed:** `SUBTITLE_SAFE_WIDTH` does
not exist; no wrapping logic was written; no wrapping tests exist;
`benchmarks/RESULTS-block7-wrapping.md` was not produced and the survey of all
five reels was not run. **Every one of the 41 cards in the built reel is a
single unwrapped line and the wide ones clip at both comp edges**, exactly as
the user saw in session 3.

### Goal 2 — a replaced image is scaled by the builder

`placeholderScalePercent` in `service/src/build/reel-plan.ts`:

```
scale% = audited solid width / real source width × the template's own scale
```

Nothing is hardcoded. For every vitasilk slot:

```
img_float IMG_MAIN audited: width 1000 px, scale 100% (valueAtSampleTime)
candidate source:           2048 px (read from the bytes)
scale = (1000 / 2048) × 100 = 48.828125%
```

Confirmed by After Effects on all five slots — it reported `layerWidth` 2048,
`scale` [48.828125, 48.828125, 100] for each.

**Goal 2.2 — the rescaled anchor is correct and needs no template edit.** AE
moved `IMG_MAIN`'s anchor from [500, 500, 0] to [1024, 1024, 0] when the source
changed. 500 is the centre of the 1000 px solid and 1024 is the centre of the
2048 px image, so the anchor is the same relative point and the template's
keyframed position still addresses the image's centre. Session 3 left this
open; it is closed with numbers.

**Goal 2.3 — the derivation is exercised, not fitted.** Five tests in
`service/src/build/reel-plan.test.ts`: a source larger than the solid
(2048 → 48.828125%), a source smaller (512 → 195.3125%), a template that
already scales its placeholder (80% with a 2000 px source → 40%), the identity
case, and a zero-width source refused rather than dividing by zero.

### Goal 3 — display timing is persisted

**Goal 3.1 — `regroup.ts` fixed first.** It builds fresh group objects and
display timing was not among the fields carried, so every grouping pass
silently cleared it. It now applies the same rule the `templateId` uses, for a
stronger reason:

- a group that came out **unchanged** keeps its window;
- a group the pass had to **split** loses it, because that window was computed
  against a different word set and the silence after it, and inherited onto a
  split group it could run past the cut and hold a card over the next one's
  words.

Three tests in `regroup.test.ts`. **The first was confirmed to fail against the
old code** — the geometry field was removed, the suite re-run (1 failed, 23
passed), and the code restored — rather than assumed to be a regression test.

**Goal 3.2/3.3 — the migration.** `npm run migrate:display-timing`, dry-run by
default. It **imports `applyDisplayTiming`** rather than reimplementing it, so
a migrated plan and one written by the slot stage carry identical windows. The
function is pure: it reads the group list, the manifest and the reel duration
and calls nothing. **No model call was made and none is possible on this path.**

| reel | groups | already timed | gained | merged | unbuildable |
|---|---:|---:|---:|---:|---:|
| ground-truth | 40 | 0 | 40 | 0 | 0 |
| test-1 | 44 → 43 | 0 | 43 | 1 | 2 |
| test-2 | 38 | 0 | 38 | 0 | 0 |
| test-3 | 31 | 0 | 31 | 0 | 0 |
| vitasilk | 41 | 0 | 41 | 0 | 1 |

**193 groups gained display timing; 0 already had it.** Every plan was reopened
through `readEditPlan` after writing and every group came back timed.

The unbuildable ones, named: test-1 `g002` "w0001" 0.200 s of 0.230 s
(`merge-blocked-by-keyword`), test-1 `g008` "w0008 w0009" 0.060 s of 0.230 s
(`merge-would-exceed-two-words`), vitasilk `g017` "w0028" 0.040 s of 0.230 s
(`merge-would-exceed-two-words`). **ground-truth, test-2 and test-3 report zero
unbuildable only because their groups had no `templateId` at the time**, so
there was no floor to miss; that changed under goal 4 and has not been re-swept.

**Goal 3.4 — ledger after this goal: 108 lines, `50ec3f57…`. Unchanged.**

The migrated plans are **not tracked**: `.gitignore:16` is `*.editplan.json`, so
nothing about them is committed. Only the CLI is.

### Goal 4 — keywords carry template ids

**Goal 4.1 — why they did not.** `assignTemplates` was never the problem; it
handles keywords correctly and always did:

```ts
// service/src/analysis/assign.ts:139-144 (before this session)
const keyword = variantsFor('keyword');
plan.keywords.items.forEach((item, i) => {
  const id = pickVariant(keyword, plan.meta.id, 'keyword', i);
  item.templateId = id;
  assigned.keyword.push(id);
});
```

It was called from **one place only** — `planImageSlotsForPlan`
(`job.ts:313` and `:334`), the image-slot stage. The keyword stage
`analyseKeywordsForPlan` writes every keyword with

```ts
// service/src/analysis/job.ts:116
templateId: null,
```

and reaches `writeEditPlan` at `job.ts:172` **without ever calling
`assignTemplates`**. So assignment was owned by a different stage from the one
that creates the elements, and any keyword run after a slot run left them null.

**Goal 4.2 — the fix is pure local computation, so it was applied.** The
keyword stage now assigns and derives SFX before writing. It is Block 3
decision 10's seeded shuffle: deterministic, no model call, free.

**A second defect surfaced only by trying to apply it.** `assignTemplates`
**was script-blind** — the shuffle drew from every allowed variant regardless
of the element's script. Mode v6 allows `sub_pop` and `sub_pop_ar`, so running
it as-was would have put the Arabic template under **20 of vitasilk's 41 Latin
cards** and `kw_slam_ar` under a Latin keyword. Applying the migration
unchanged would have corrupted all five plans, so the draw was made
script-aware first: it partitions on the `_ar` suffix
(`SCRIPT_VARIANT_SUFFIX`, the naming convention §3 fixes and the manifest
validator enforces — there is no script field on a template entry to read
instead) and keeps a per-script counter so each face still spreads across the
reel. A mixed-script span is **reported as an issue**, not silently rendered in
whichever face came first.

Assignments after the migration:

| reel | keywords templated | keyword templates | subtitle split | script mismatches |
|---|---:|---|---|---:|
| ground-truth | 0 | none | 36 `sub_pop` / 4 `sub_pop_ar` | **0/40** |
| test-1 | 2 | `kw_slam_ar` ×2 | 28 / 15 | **0/43** |
| test-2 | 3 | `kw_slam`, `kw_slam_ar` ×2 | 32 / 6 | **0/38** |
| test-3 | 0 | none | 24 / 7 | **0/31** |
| vitasilk | 3 | `kw_slam` ×3 | 41 / 0 | **0/41** |

**Zero mismatches on every reel**, keywords included. ground-truth and test-3
have no keywords at all — the keyword stage has never run on them.

Four tests added: keywords get ids (already existed and passed, which is why
the defect hid); Latin gets Latin and Arabic gets `_ar`; determinism across
runs; a mixed-script span reported. Plus one pinning the causal chain that
actually broke — **no keyword event while templateIds are null, one each once
assigned** — because the unit that was wrong was the composition, not any
function.

### Goal 5 — SFX re-derived from the current manifest

`npm run migrate:templates-sfx`, dry-run by default, pure and free.

| reel | before | after | change |
|---|---:|---:|---|
| ground-truth | 0 | 0 | — |
| test-1 | 7 | **6** | 6 changed, **1 dropped** |
| test-2 | 0 | **3** | 3 new |
| test-3 | 0 | 0 | — |
| vitasilk | 8 | 8 | **all 8 changed** |

**Every surviving event changed**, because every stored gain came from the stub
manifest: whooshes **−12/−9 → −24**, hits **−6 → −20**. Image offsets moved by
up to 0.05 s as the binding's `offsetS` went to 0.

**The drop is named, not smoothed over.** test-1 lost
`hit_01 @ 20.940s −6dB from k003`. That is correct: `k003` was dropped in Block
6 session 6 for straddling a script boundary, and the event had outlived the
keyword it belonged to. **One event lost, by identity, and it should have been.**

Goal 5.3's test asserts derivation cannot produce a gain absent from
`assets/sfx/sfx.json`, and explicitly that −12, −9 and −6 are not declared
values, so a stub-era gain cannot survive again.

### A fifth defect, inherited from session 1

The first full-reel build skipped **4 of 5 image slots** with "no candidate file
on disk". Cause: Block 7 session 1 re-keyed every image cache entry by renaming
its directory and **did not update the plans that name those directories**. All
ten of vitasilk's `candidates[].path` pointed at directories that no longer
existed.

**Nothing was lost.** Every file was on disk under its new key; only the
pointers were stale. `npm run repair:candidate-paths` recomputes the
fingerprint from the slot's own prompt and the frozen config — the same inputs
`generateImages` uses — and repoints the path. **10 repaired, 0 unresolved**,
and the old→new mapping reproduces session 1's migration table exactly
(`8f66615d…` → `699c0a38…`, `52448155…` → `ac0e7b6f…`, and so on). A candidate
whose recomputed entry is not on disk is left alone and reported.

### Goal 6 — the whole reel, twice

`.local/build/vitasilk-full.aep` (4,884,217 bytes, gitignored via `.gitignore:1`).

| | `master_vitasilk_A` | `master_vitasilk_C` |
|---|---:|---:|
| subtitle instances | 38 | 38 |
| keyword instances | 3 | 3 |
| image instances | 5 | 5 |
| audio layers | 8 | 8 |
| **total layers** | **55** | **55** |
| frame rate as AE stores it | 29.9700317382812 | 29.9700317382812 |
| duration | 25.6923590256924 | 25.6923590256924 |

46 elements built, 67 project items, **0 skipped**. Build wall clock **1.5 s**.

**38 subtitles, not 41**: `g010`, `g013` and `g016` are superseded by keywords
and their keyword renders instead, per Block 3 decision 9 — both are never
rendered.

**The two comps differ only in subtitle out-points, and that is enforced rather
than intended.** One duplicated comp per element is built once and added to
both masters, so the text and the artwork are literally the same item in each;
a check over the two placement lists throws if in-point, x or y differs
anywhere. **33 of 46 placements are shortened in C, by 0.0706 s on average,
2.331 s across the reel.** The other 13 already ended before the next card's
intro.

Everything else came from the plan: display timing (goal 3) for every card,
`sub_pop` for all 41 vitasilk groups by script (goal 4), Block 5 positions and
scales for the images with goal 2's scaling, and the 8 re-derived SFX events at
their declared gains (goal 5).

**Chosen candidates**, since no slot carries a `chosenCandidateId` — the editor
picks in Block 8 — the first candidate of each was used and is named:
`img001-c1` (card), `img002-c1` (cutout), `img003-c1` (card), `img004-c1`
(card), `img005-c1` (card).

## Deviations

1. **Goal 4 required a fix the goal did not anticipate.** Applying assignment
   as written would have put the Arabic subtitle template under 20 of
   vitasilk's 41 Latin cards. Making the draw script-aware was in scope as pure
   local deterministic computation, and not doing it would have corrupted all
   five plans, so it was done before the migration ran.

2. **`npm run repair:candidate-paths` was written, which no goal asked for.**
   Without it, 4 of 5 image slots were absent from the reel the user is meant
   to judge. It is a derivation, not a guess, and it is committed rather than
   run as a one-off so the repair leaves a record.

3. **Two extra migration CLIs exist rather than one script.** Goal 3 asked for
   one; goals 4 and 5 asked for changes without specifying a mechanism. They
   are separate commands because they answer separate questions and each is
   independently re-runnable and dry-runnable.

4. **Goal 6 was built despite goal 1 stopping.** Wrapping affects both arms
   identically, so it does not confound the A-versus-C comparison the session
   exists to settle. The cards are clipped and that is stated loudly rather
   than presented as finished work.

## Failures & open problems

- **Subtitles do not wrap and every wide card in the built reel is clipped at
  both comp edges.** This is the user's original complaint and it is not fixed.
  Goal 1's stop condition fired; see above for what does not exist and what the
  decision is.

- **A quantitative consequence nobody can state yet**: with no width measurer,
  it is not known how many of the 194 cards across the corpus are too wide.
  It could be a handful or it could be most of them. The survey the goal asked
  for was not run.

- **`npm run timing-budget` and `npm run validate-plan` were not re-run after
  the migrations**, and both now read different inputs than when they were last
  published — plans carry display timing and every group carries a template.
  The published figures (7 unbuildable at the loosest budget, 11 from
  `validate-plan`) are stale in both directions and no new sweep was done.

- **The three unbuildable groups were built anyway.** test-1 `g002` and `g008`
  and vitasilk `g017` cannot reach their template's 0.23 s floor; the migration
  reports them and the builder places them regardless, so they are on screen at
  less than the floor. Nothing suppressed them, but nothing flagged them in AE
  either.

- **Keyword and image comps were never checked for the anchor arithmetic that
  subtitles got.** `textCompPosition` is applied to keywords using `kw_slam`'s
  own audited baseline, which is correct by construction, but no one has looked
  at whether a keyword lands where it should. Block 6's
  `KEYWORDS_ARE_INSIDE_SUBTITLE_BAND` assumption is still unverified against a
  built comp.

- **The SFX layers were placed but never heard.** Gains are set from the
  manifest and AE accepted them; whether −20 dB and −24 dB are right, and
  whether the whoosh at `offsetS` 0 reads as leading the motion, is unjudged.

- **ground-truth, test-2 and test-3 have no keywords**, so their reels cannot
  be built with emphasis. The keyword stage has never run on them and running
  it bills.

- **The frame-rate mismatch from session 3 persists**: the library comps store
  29.9700012207031 and a master built from 30000/1001 stores 29.9700317382812.
  Harmless at 25 s, unchecked at 90.

- Carried forward untouched: whole-term grouping is unimplemented (11 §6 terms
  render split); the pipeline is 4K-only; the image gate's yield on vitasilk
  was 2/10 and the built reel uses first candidates regardless of gate verdict.

## Repo state

- Branch `main`, working tree clean.
- HEAD at the time of writing: `docs: record block 7 session 4 in the operating
  memory`. **This report's own commit follows it** — a report cannot name the
  commit that contains it.
- Commits this session, in order: `fix: carry subtitle display timing through a
  regroup`; `fix: assign templates in the keyword stage, and by script`;
  `feat: add free migrations for display timing, templates and sfx`;
  `feat: build a whole reel into two timing variants`; `docs: record block 7
  session 4 in the operating memory`.
- `npm run check`: **exit 0, `check: PASS`**. TypeScript **964 passed** across
  67 files (core 151 / 6, service 647 / 45, benchmarks 166 / 16); Python **141
  passed**. `validate-templates: 6 template(s) ok`; all four references
  `v1.0.8-conformant`; both model pins ok.
- Cost ledger: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — identical
  to the start-of-session values. **Nothing billed.**
- `templates/library.aep`: sha256
  `dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa` —
  identical. Opened only as an import source, never written.
- After Effects: **1 instance at start and end**, PID 44015, unchanged.
- No AI attribution in any commit; `git log` checked before pushing.

## Suggested next step

Settle the wrapping question, because it is the only thing standing between the
built reel and something the user can judge as a whole rather than in parts.
The decision is not "write a measurer" — it is where a text measurer belongs:
in the Python sidecar, where fontTools already sits (unpinned, and pinning it
would be part of the work), or as a TypeScript implementation in `core/`
alongside the constants it would serve. The sidecar is the better fit on
capability grounds, since Arabic advances depend on positional shaping and
fontTools already models that, but it puts a subprocess hop between the builder
and a decision it needs per card, so the answer is a judgement about the shape
of the pipeline rather than about fonts. Once it is made, wrapping is a small
piece of work and the survey across all five reels comes free with it.
