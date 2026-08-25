Status: OK

Block 3 session 5, the last feature session of the block. Fixed the prompt
punctuation defect, measured and then closed the keyword/subtitle collision,
stubbed the template manifest and SFX index, made template assignment
deterministic, derived SFX events, added buildability checks, and ran the
complete analysis stage on both reels.

**Session spend $0.249868 over 4 billable calls.** Both cost gates held.

## Done

**1. Prompt punctuation** (1d9f5bb). `composePrompt` in
`service/src/analysis/slot-select.ts` now strips each fragment's own terminal
punctuation and collapses whitespace before joining, then ends the whole
prompt with one full stop. Fragments come from three places that cannot agree
on punctuation — the model's idea ends in a period, the mode's style fragments
and variation values do not. Tests pin that no composed prompt contains
doubled punctuation, doubled whitespace, or whitespace before punctuation.
**All nine prompts on the two plans were regenerated at $0.0000** on cache
hits; the ledger was unchanged (64 lines before and after).

**2. Keyword/subtitle collision** (f0de4a8). Measured first, in
`benchmarks/RESULTS-block3-complete.md` and below.

| reel | keyword | groups touched | verdict |
|---|---|---|---|
| vitasilk | k001 `filler glow` | g012 | exact |
| vitasilk | k002 `Vita Silk` | g014 `marque Vita`, g015 `Silk mn` | **straddles two** |
| vitasilk | k003 `lissage brésilien` | g026 `dial lissage`, g027 `brésilien chno` | **straddles two** |
| test-1 | k001 `محفزات الكولاجين` | g011 | exact |
| test-1 | k002 `injections` | g013 `des injections` | inside a 2-word group |
| test-1 | k003 `شد` | g001 `bghiti شد` | inside a 2-word group |

**Across both reels: 2 exact, 2 inside a larger group, 2 straddling.** Four of
six could not have rendered as a replacement, because there was no single
group to replace.

Then the rule:

- A keyword **replaces** its group's rendering, recorded explicitly as
  `subtitles.groups[].supersededBy`. **Schema departure**, documented at its
  definition.
- `service/src/analysis/regroup.ts` re-cuts the word sequence after keyword
  selection so every span is exactly one group. **It only ever splits**, so
  the 1–2 word rule cannot be broken by it; it is asserted anyway and throws
  if it ever were, and it also asserts that no displayable word is lost.
- A keyword that still cannot align is **dropped and counted**: non-adjacent
  word ids (`span-not-contiguous`), a span longer than a group may be
  (`would-exceed-group-size`), or a group carrying a human edit
  (`group-is-human-edited`). ARCHITECTURE §3's rule holds — a flagged group is
  never silently re-derived. `subtitles.groups[].edited` is a **second schema
  departure**, added because groups had no way to carry the flag.
- 12 tests including all four the goal named.

**After re-grouping, all six keywords align exactly**, every group is still
1–2 words, and **no keyword was dropped**. vitasilk went 40 → 42 groups,
test-1 36 → 38.

**3. Stub manifest and SFX index** (e5f70ae). `templates/manifest.json`
follows TEMPLATE_LIBRARY_GUIDE §8's schema exactly, with one entry per element
type plus the second image variant the mode allows: `sub_pop`, `kw_slam`,
`img_slide_left`, `img_float`. `assets/sfx/sfx.json` declares `hit_01` and
`whoosh_01`. Both carry a machine-readable **`stub: true`** and a `stubNote`,
not just a comment, and `assertRenderable` throws `StubTemplatesError` naming
the stage — so a rendering stage cannot build from placeholder timings.
`core/src/templates.ts` holds the loader and validation; `npm run
validate:modes` now also validates the manifest and checks every id a mode
allows exists in it with the right type. `sub_pop` declares no SFX, per §10.
16 tests.

**No audio file exists.** The index names `hit_01.wav` and `whoosh_01.wav`;
Block 6 supplies them.

**4. Deterministic template assignment** (afa3ab3).
`service/src/analysis/assign.ts`: an offset and a stride coprime to the
variant count, both seeded from `meta.id` and the element type, plus a
per-cycle bump. Consecutive elements never repeat and the walk covers every
variant. `variantDistribution` and `longestRun` exist so a whole sequence can
be inspected, which is session 4's slot-5 lesson applied. A type with no
allowed variant throws `NoTemplateVariantError`; image slots leave
`presentation` unset for Block 4 but their template's `imagePresentation` is
checked now. 26 tests, run against a **fixture mode with 3 subtitle, 2 keyword
and 4 image variants**:

| type | elements | distribution | longest run |
|---|---|---|---|
| subtitle | 42 | sub_wipe 14, sub_pop 14, sub_slide 14 | **1** |
| keyword | 3 | kw_glitch 2, kw_slam 1 | **1** |
| image | 5 | img_zoom 2, img_float 1, img_slide_left 1, img_pan 1 | **1** |

**5. SFX and buildability** (06b1cbc). `sfx.ts` derives events from the
assigned templates and manifest bindings — recomputed every run, never merged
with what the plan carried, firing at element start plus the binding offset at
the binding's gain. An unknown sfxId throws `UnknownSfxError`.
`buildability.ts` plus `npm run validate-plan -- --plan <path>` checks element
duration against intro + minHold + outro, every keyword span mapping to
exactly one group, slot ids resolving, no slot overlap, and every templateId in
the manifest. It reports every failure at once and **repairs nothing**.

**6. Full run** (0c9a528). Ledger all-time before spending: **$5.936884**.

**vitasilk — 25.7 s, $0.1238 (keywords $0.0475 + slots $0.0763):**

| id | keyword | words | score | template | supersedes | reason (verbatim) |
|---|---|---|---|---|---|---|
| k001 | `filler glow` | 2 | 0.99 | kw_slam | g012 | identifies the specific product being promoted |
| k002 | `Vita Silk` | 2 | 0.98 | kw_slam | g015 | names the brand behind the treatment |
| k003 | `lissage brésilien` | 2 | 0.95 | kw_slam | g028 | specifies the cosmetic procedure category |

| slot | window | template | idea (verbatim) |
|---|---|---|---|
| img001 | 1.60–2.68 s | img_slide_left | A timer display showing five minutes. |
| img002 | 4.26–6.22 s | img_float | Smooth, straight, and silky hair flowing. |
| img003 | 10.56–11.28 s | img_slide_left | Water droplets splashing onto hair strands. |
| img004 | 14.28–16.88 s | img_float | A woman with perfectly straightened hair. |
| img005 | 24.60–25.48 s | img_slide_left | A woman looking at a wristwatch. |

8 SFX events: `img001 whoosh_01 @1.60s -9dB`, `img002 whoosh_01 @4.31s -12dB`,
`k001 hit_01 @7.08s -6dB`, `k002 hit_01 @8.34s -6dB`,
`img003 whoosh_01 @10.56s -9dB`, `img004 whoosh_01 @14.33s -12dB`,
`k003 hit_01 @15.86s -6dB`, `img005 whoosh_01 @24.60s -9dB`.

**Buildability: NO — 31 issues** (26 of 42 groups, 2 of 3 keywords, 3 of 5
slots too short).

**test-1 — 22.0 s, $0.1261 (keywords $0.0745 + slots $0.0516):**

| id | keyword | words | score | template | supersedes | reason (verbatim) |
|---|---|---|---|---|---|---|
| k001 | `محفزات الكولاجين` | 2 | 0.95 | kw_slam | g012 | names the specific aesthetic procedure being promoted |
| k002 | `شد طبيعي` | 2 | 0.92 | kw_slam | g002 | asserts the primary physical benefit of the treatment |
| k003 | `jawdat البشرة` | 2 | 0.88 | kw_slam | g038 | states the ultimate quality outcome for the patient |

| slot | window | template | idea (verbatim) |
|---|---|---|---|
| img001 | 0.10–1.38 s | img_slide_left | A side profile of a woman's face with subtle graphical upward arrows along the jawline indicating a lifting effect. |
| img002 | 5.74–6.76 s | img_float | A macroscopic view of glowing collagen fibers forming a strong web under the skin surface. |
| img003 | 10.86–12.54 s | img_slide_left | Fingers gently pinching the youthful, firm skin on a cheek to demonstrate elasticity. |
| img004 | 20.04–21.94 s | img_float | A close-up of a woman's face with perfectly smooth, radiant, and hydrated skin. |

7 SFX events: `img001 whoosh_01 @0.10s -9dB`, `k002 hit_01 @0.50s -6dB`,
`img002 whoosh_01 @5.79s -12dB`, `k001 hit_01 @5.84s -6dB`,
`img003 whoosh_01 @10.86s -9dB`, `img004 whoosh_01 @20.09s -12dB`,
`k003 hit_01 @20.94s -6dB`.

**Buildability: NO — 25 issues** (23 of 39 groups, 1 of 3 keywords, 1 of 4
slots too short).

**Cache hit:** both stages re-run on vitasilk cost **$0.0000** with no new
ledger line (68 before, 68 after) and ten differing leaves, all bookkeeping.
**The ledger gained nothing from the test suite**: 68 lines before
`npm run check` and 68 after.

**7. `CLAUDE.md` updated** for all six changes, the new command, the
buildability finding and the full schema-departure table.

## Deviations

- **The "every keyword supersedes a group" check moved out of structural
  validation.** I put it in `validateEditPlan` first and it made both existing
  plans **unreadable** — `readEditPlan` validates on read, so a plan written
  before supersession existed could not be opened, and therefore could not be
  migrated. Completeness is a buildability property and now lives in
  `npm run validate-plan`, which is where goal 5 asked for it anyway. The
  structural half — the named keyword exists, no keyword supersedes two
  groups, the span matches the group exactly — stays in validation.
- **`job.ts`'s wiring landed in goal 5's commit, not goal 4's.** Assignment and
  SFX derivation are one integration point in the slot job and SFX depends on
  assignment; splitting the file across two commits would have left goal 4's
  commit calling a function that did not exist.
- **The manifest carries `img_float` as well as `img_slide_left`**, which is
  two image entries rather than "one per element type". The mode already
  allowed both, and a manifest missing one would have failed the new
  mode-versus-manifest cross-check.
- **`assets/sfx/sfx.json` and `templates/manifest.json` gained `stub` and
  `stubNote` fields** that TEMPLATE_LIBRARY_GUIDE §8 does not list. The goal
  asked for the stub marking to survive being read by code, and a comment
  cannot.

## Failures & open problems

- **Both live plans fail buildability, and that is the block's real finding.**
  26 of 42 vitasilk groups and 23 of 39 test-1 groups are shorter than
  `sub_pop`'s 0.60 s; worst case is vitasilk's `g016` at **0.00 s**, an
  interpolated word whose start and end are the same instant. Nothing was
  extended. Two things are both true: the stub timings are guesses Block 6 will
  replace, *and* a word spoken in 0.08 s cannot carry any animation with a
  distinguishable intro and outro. It is a real conflict between PROJECT_SPEC
  §5's fast-reel 1–2 word subtitles and a template contract having
  intro/hold/outro at all, and it is the user's to settle.
- **Zero-length subtitle groups exist.** `g016` on vitasilk. That is an
  alignment artifact from session 2's interpolated timings surfacing for the
  first time, and nothing upstream rejects it.
- **Code paths added this block that have never run against real data:**
  - keyword span narrowing (`narrowSpan`) — the prompt has prevented every
    over-long span since version 2, so only unit tests exercise it;
  - head-term diversity skipping — likewise, no live collision since the
    prompt change;
  - all three re-grouping drop reasons — no live keyword hit any of them;
  - `--force` on transcribe, and the whole transcript-changed branch of the
    merge — both live merges took the unchanged branch;
  - `NoTemplateVariantError`, `UnknownSfxError`, `StubTemplatesError`;
  - the entire multi-variant assignment path — the real mode has one variant
    per type, so live runs only ever exercise the trivial case;
  - `readEditPlan`'s schema-version gate outside its own tests.
- **`assign.ts` and `sfx.ts` recompute over the whole plan inside the slots
  stage.** Running only `--stage keywords` leaves templates and SFX describing
  the previous slot set until the slots stage runs again. Not a live problem
  today because the two always run together, but it is an ordering dependency
  nothing enforces.
- **Template timings are invented.** Every `introS`, `outroS` and `minHoldS`
  is a plausible default, so every buildability number above will move when
  Block 6 measures real comps.
- **No audio exists** for either declared sfx id.
- **`analyse-cli.ts` and `validate-plan-cli.ts` have no unit tests**; verified
  only by the live runs.
- **The insertion spotcheck listening pass is still not done**, carried from
  sessions 2, 3 and 4.

## Block 3 handoff data

**Spend across all five sessions: $1.366526 over 21 billable calls.**

| session | calls | spend |
|---|---|---|
| 1 | 8 | $0.624776 |
| 2 | 0 | $0.000000 |
| 3 | 5 | $0.267718 |
| 4 | 4 | $0.224164 |
| 5 | 4 | $0.249868 |

By stage: `transcribe-gemini-correction` $0.619352,
`analysis-keywords` $0.517834, `analysis-slots` $0.223916,
`transcribe-scribe` $0.005424. **Ledger all-time: $6.186752** across 68
entries.

**Schema departures from ARCHITECTURE §3 introduced in Block 3**, for the
handoff's Amendments section verbatim:

| field | shape | why |
|---|---|---|
| `transcript.contentHash` | `string?` | A re-run must tell whether downstream word-id references still mean anything without diffing two word arrays. Recomputed from the words, so a plan predating the field is answered exactly rather than assumed stale. |
| `keywords.items[].edited` | `boolean?` | §3 requires an automated re-run never overwrite a human-flagged item; keywords had no way to carry the flag. |
| `subtitles.groups[].supersededBy` | `string \| null` (optional) | A keyword and a group can claim the same words and §3 never says which wins. The keyword replaces the group's rendering, and the builder is told rather than inferring it from overlapping time ranges. |
| `subtitles.groups[].edited` | `boolean?` | Same reason as the keyword flag: the re-grouping pass is an automated re-run over groups. |
| `images.slots[].wordIds` | `string[]` | §3 gives a slot only start/end, which leaves a merge unable to tell whether the span it illustrates still exists. |
| `images.slots[].presentation` | `'cutout' \| 'card' \| null` | §3 types it as always set; the quality gate is Block 4, and a guessed `cutout` would read as a decision. |

## Repo state

- Branch: `main`. **Pushed** at the end of the session (see below).
- HEAD: `0c9a528` `test: run the complete analysis stage on two reels`, plus
  the CLAUDE.md and report commit that follows it.
- Session commits: 1d9f5bb, f0de4a8, e5f70ae, afa3ab3, 06b1cbc, 0c9a528.
- `npm run check`: **PASS**, exit 0, `check: PASS` marker present.
  **549 tests** — core 69, service 335, benchmarks 145 (up from 493).
- Session spend: **$0.249868** over 4 billable calls.
- Ledger all-time: **$6.186752** across 68 entries, up from $5.936884 / 64.

## Suggested next step

Block 3 is feature-complete but neither plan it produced is buildable, so the
next thing is a decision rather than more code: roughly half of every reel's
subtitle groups are shorter than any animation with a distinguishable intro and
outro can occupy, and that number will not go away when Block 6 measures real
comps — it will only get more precise. The choice is between holding a group on
screen past its own words, giving grouping a minimum-duration floor that merges
or extends short groups, or designing subtitle templates with near-zero intro
and outro so a 0.2 s word is renderable; each pushes the cost somewhere
different, and only the user can say whether a subtitle lingering past its word
is acceptable in this reel style. Settling it before Block 4 matters because
image slots passed the same check comfortably while subtitles did not, so the
answer changes grouping and template design but not image generation — and
starting Block 4 first would mean generating images against a plan whose
subtitle layer is still going to be reworked.
