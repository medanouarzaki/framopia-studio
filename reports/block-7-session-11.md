Status: OK

# Block 7 session 11 — the flat watermark, the reconciled tools, and the block closed

Spent **$0.00**. No Gemini call, no ElevenLabs call, no image regenerated, no
billable request. Ledger byte-identical at both ends: **108 lines**, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.
`templates/library.aep` byte-identical: sha256
`dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa`.

**After Effects: 1 instance at start and end**, PID 44015, no `-r`. Helpers
excluded; re-checked before every `DoScript` and never changed. **No new
dependency.**

## Done

### Goal 1 — the watermark runs exactly one second

`WATERMARK_DURATION_S = 1` in `service/src/placement/constants.ts`, replacing
`WATERMARK_HOLD_AFTER_LAST_BEEP_S`. The comment records that it is **the user's
ruling, not a measurement**, and what would change it. The beep-derived
computation is gone from the duration path.

**The beep measurement is kept and repurposed.** `tools/measure-watermark/` and
its results file are untouched — they are what established the audio's shape.
Since the duration no longer follows them, nothing would notice a file whose
beeps ran past it; the sound would be cut mid-beep and read as a taste decision.
`assertBeepsFitWatermark` now checks it and throws `WatermarkBeepsRunLongError`
naming both times.

**Current margin: the last beep ends at 0.400 s against a 1.000 s out point —
0.600 s spare.**

**The retired test is gone, not left green.** Session 10 pinned that a 0.9 s
beep recomputes to 1.9 s. That is now false, so it was replaced by one pinning
the flat second across three beep values and four pinning the new assertion,
including a file whose beeps run to 1.3 s.

**The audio ends with the picture.** Both are the same AV layer, and AE bounds a
layer's audio by its out point — nothing extra was needed. AE reports
`hasAudio true`, `audioActive true`, `outPoint 1`. **This was not verified by
rendering**, because the tool never renders; it rests on AE's layer model plus
the out point read back, and I am stating that rather than claiming more.

**Read back from After Effects:**

| | |
|---|---|
| out point | **1** s = frame **29.97 of 61** |
| layer index | **1**, with **0 layers above** |
| alpha interpretation | `alphaMode` **5414**, and `AlphaMode.PREMULTIPLIED` is **5414** |
| audio level | **[-20, -20]** |
| size / scale | 216 × 242 px, **11.2266%** |
| corner | **top-right** — top-left rejected, "overlaps something already on screen" |

### Goal 2 — the reporting tools agree with the builder

**Where I looked before changing anything.** Six homes of the floor arithmetic:
`display-timing.ts:48` (`floorFor`), `buildability.ts:59`,
`missing-cards-cli.ts:47`, `migrate-regroup-cli.ts:57`, `short-card.ts:39`, and
`core/src/templates.ts:498`.

**The single declaration is `cardMinimumDurationS` in
`service/src/build/short-card.ts`.** `buildability.ts` reads it, and
`timing-budget.ts` inherits it through `checkBuildability` — no third copy.

**The floor is 0.118 s, not 0.230 s.** With the entrance compressible to two
frames, the sum scales with it:
`(introS + minHoldS) × MIN_INTRO_S / introS` = `0.23 × 0.0667/0.13`.

**"Unbuildable" was the wrong word and is no longer used.** A card below the
floor is **still built** — the entrance sits on the floor and the hold is
clipped. The predicate is `cardHoldFits`, and its doc says why the old name
misled: the tools reported 120 unbuildable while the builder placed all 343.

| reel | cards | shortened entrance | on the two-frame floor | hold clipped |
|---|---:|---:|---:|---:|
| ground-truth | 76 | 33 | 9 | 9 |
| test-1 | 67 | 21 | 7 | 7 |
| test-2 | 69 | 26 | 4 | 4 |
| test-3 | 58 | 18 | 3 | 3 |
| vitasilk | 73 | 22 | 5 | 5 |
| **all** | **343** | **120** | **28** | **28** |

**`validate-plan` reports 9 / 7 / 4 / 3 / 5 = 28. `timing-budget` at the built
cell reports 76−67, 67−60, 69−65, 58−55, 73−68 = 28. The builder places all 343
and drops none. All three agree.**

**A second home nobody had named, found because the figures still disagreed.**
After pointing `buildability.ts` at the rule, `validate-plan` reported 28 and
`timing-budget` still said 120. The cause was `sweepTemplate`, which split the
budget evenly between intro and outro under a comment reading *"Only the sum is
ever read, so the split is arbitrary and even."* **That stopped being true the
moment the rule began compressing the entrance alone** — halved, `introS` was
0.065, `MIN_INTRO_S/introS` exceeded 1, and the sweep measured the full 0.23 s.
The whole budget is the entrance now, matching the built templates' `outroS: 0`.

**Four tests asserted the retired behaviour and were rewritten**, one of them
named *"splits the budget evenly and only the sum is ever compared"*. None was
left green against a rule that no longer applies.

**A new test, `service/src/build/floor-rule.test.ts`**, pins that the builder,
`checkBuildability` and `evaluateBudget` all land on the same floor — the
mirrored-constant rule applied to a rule rather than a number.

**Stale figures.** `benchmarks/RESULTS-block6-timing-budget.md` is regenerated.
Every other "120" left standing is in `reports/` — historical records of what was
true when written, never rewritten. The one current claim in `CLAUDE.md` is
struck through and corrected in place.

### Goal 3 — the timeout, measured rather than widened

Re-measured with After Effects idle (it was left open, not closed):

| | idle | under load |
|---|---:|---:|
| one BiRefNet cutout | **18.4 s** | 72 s |
| the whole integration test | **39.2 s** | ~153 s (timed out at 120) |

**Block 4 measured the whole test at 35 s. It is 39 s today. Nothing in the CV
path got slower — the machine was contended**, by 3.9×, while AE cached the comp
these sessions are required to leave open.

The timeout is **240 s**, clearing the measured loaded case with headroom and no
wider. The measured basis is in the comment beside it. **This is not an
unexplained slowdown and does not belong in open problems.**

### Goal 4 — the final build

`.local/build/vitasilk-full.aep`, gitignored. Build wall clock **4.8 s**,
76 elements, **0 skipped**, pre-flight passed on 15 files.

| comp | subtitles | keywords | images | audio | watermark | total |
|---|---:|---:|---:|---:|---:|---:|
| `master_final` | 68 | 3 | 5 | 8 | 1 | **86** |
| `master_subs_only` | 68 | 3 | 0 | 3 | 0 | 75 |

**Verified, not assumed:**

- **0** placements outside the frame.
- **0** images overlapping the face mask; the watermark inside the frame and
  **not** overlapping the face.
- **0** cards whose in-point follows their word — every in-point is
  `word start − introS`.
- **5 of 5** images on the card template.
- watermark alpha interpretation **5414 = `AlphaMode.PREMULTIPLIED`**, read back.
- watermark and its audio both gone at **1.000 s** — same layer, same out point.

**Nothing failed to build.** 73 cards less the 5 superseded by keywords is the
68 placed.

**Active comp `master_final`, playhead at 0.5 s.**

## Deviations

1. **The watermark's audio end was not verified by rendering.** The tool never
   renders. It rests on AE's layer model — audio is bounded by the layer's out
   point — plus `outPoint 1` read back.

2. **`sweepTemplate`'s intro/outro split changed**, which the goal did not
   anticipate. It was the second home of the rule and the reason the two tools
   still disagreed after the first fix.

## Failures & open problems

- **The aligner defect is unfixed** — `docs/DEFECT-alignment-script-mismatch.md`.
  61% of words rest on a pairing with no evidence; `align` has no many-to-one
  operation. The largest thing carried out of this block.

- **"Headless" in the DoD is not met.** See below.

- **28 cards have a clipped hold** and 28 get a two-frame entrance. Nobody has
  judged whether two frames reads.

- **Only `vitasilk` builds end to end.** The other four need billable stages.

- **The cutout gate and `presentation` decide nothing** since every image is
  framed, yet background removal still runs at ~39 s per corpus pass producing
  artifacts nothing displays. Unruled.

- **The watermark has been rendered on one reel.** Its corner rule is tested
  across forty seeds but has been built once.

- **All 13 multi-word Arabic runs split across cards**; the pipeline is 4K-only.

## Repo state

- Branch `main`, working tree clean.
- HEAD at the time of writing: `docs: record block 7 session 11 in the operating
  memory`. **This report's own commit follows it** — a report cannot name the
  commit containing it.
- Commits this session, in order: `test: set the cutout timeout from a measured
  contention factor`; `feat: hold the watermark for a flat second`; `fix: report
  the floor the builder actually uses`; `docs: record block 7 session 11 in the
  operating memory`.
- `npm run check`: **exit 0, `check: PASS`**. TypeScript **1054 passed** across
  75 files (core 151 / 6, service 737 / 53, benchmarks 166 / 16); Python **141
  passed**.
- Cost ledger: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` —
  identical to start-of-session. **Nothing billed.**
- `templates/library.aep`: sha256
  `dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa` —
  identical.
- After Effects: **1 instance at start and end**, PID 44015.
- No AI attribution in any commit; `git log` checked before pushing.

## Suggested next step

Block 7's work is done and the one thing carried out of it that still puts a
word on screen at the wrong moment is the aligner. It is fully written up, its
cost is measured at 61% of words at risk, and the fix has a named source — a
transliteration distance built from ORTHOGRAPHY_GUIDE §2's own character table —
so the next session can start on the work rather than on the diagnosis, and can
measure across all five reels from cache without spending anything. The other
carried item, "headless", is not a task but a decision: the builder drives an
After Effects a person opened, and whether Block 10's golden run accepts that or
needs a different mechanism is the user's call.

---

# Block 7 closing state

## 1. Definition of done, itemized

BLOCKS.md requires a headless run on the fixture producing a correct comp, and
all error paths returning structured errors.

| item | verdict | evidence |
|---|---|---|
| a run on the fixture produces a correct comp | **met** | `master_final` on `vitasilk`: 86 layers, 0 skipped, every geometric invariant verified this session |
| all error paths return structured errors | **met** | seven proven in session 10, five as ES3 `{ok:false, stage, message}` and two as typed TypeScript errors that never reach AE |
| **headless** | **NOT met** | see below |

**"Headless" is not met, and it never was.** Every After Effects operation goes
through AppleScript `DoScript` into an **already-running** instance. Launching
with `-r` is unusable on this machine: session 2 observed a resident `-r`
process execute its `app.quit()` body a session later and close the application
out from under a running session. The builder **cannot run without a person
having opened After Effects**. Everything the block set out to build works; it
works by driving an application a human started. Finding an alternative is Block
10's golden-run problem.

## 2. Constants this block introduced or changed

| constant | value | where | measured or chosen |
|---|---|---|---|
| `SUBTITLE_SAFE_WIDTH` | 1940 px | `core/src/typography.ts` | **chosen** |
| `MAX_WORDS_PER_CARD` | 1 | `service/src/transcription/grouping.ts` | **user ruling** |
| `MAX_SUBTITLE_HOLD_S` | 1.2 s | `service/src/analysis/display-timing.ts` | **chosen** |
| `MIN_INTRO_S` | 2/29.97 s | `service/src/build/short-card-constants.ts` | **chosen** |
| `TOP_LEFT_MARGIN` | 0.03 | `service/src/placement/constants.ts` | **chosen** |
| `TOP_LEFT_JITTER` | 0.06 | `service/src/placement/constants.ts` | **chosen** |
| `HEAD_CLEARANCE` | 0.04 | mirrored into `service/src/placement/constants.ts` | **chosen**, pinned to `zones.py` by test |
| `FACE_CATEGORIES` | (3,) | `tools/cv/framopia_cv/segment_person.py` | **model categories**, user-approved by eye |
| `WATERMARK_WIDTH_FRACTION` | 0.1 | `service/src/placement/constants.ts` | **user ruling** |
| `WATERMARK_MARGIN` | 0.03 | `service/src/placement/constants.ts` | **chosen** |
| `WATERMARK_DURATION_S` | 1.0 s | `service/src/placement/constants.ts` | **user ruling** |
| `WATERMARK_GAIN_DB` | −20 | `service/src/placement/constants.ts` | **user's own setting** |
| `SUBTITLE_BAND` | y 0.5157, h 0.2649 | `core/src/typography.ts` | **measured** from font outlines |

Everything marked chosen is what a later block revisits.

## 3. Rules the user ruled this block

- **One word per subtitle card.** A two-word card shows its second word before
  it is spoken — measured at a median 0.410 s early — and no retiming fixes it.
- **Images are always top-left**, on every reel, regardless of zones. The corner
  is reliably empty in this format and the only real constraint is his face.
- **Every image is framed** — the card presentation on every slot, whatever the
  cutout gate says.
- **The face-only mask is approved**, on all five contact sheets, with no
  under-coverage. Hair may be overlapped; the face may not.
- **Image size** at the loose/face level is right; the strict rule is retired.
- **The watermark** is about a tenth of the frame wide, in a free corner, its
  sound kept at **−20 dB**, on screen for **exactly one second**.
- **The subtitle baseline** at x 1080, y 2480.4 is approved and unchanged.

## 4. Open defects

1. **Alignment mis-pairs Arabic-script tokens against Arabizi** —
   `docs/DEFECT-alignment-script-mismatch.md`. **209 of 343 words (61%) across
   49 runs** rest on a pairing the aligner had no evidence for, and `align` has
   **no many-to-one operation at all**, so a merge takes one token's interval
   rather than both. The largest open item.
2. **`sourceText` provenance** is correct now but was wrong twice; no test
   catches a repair writing a self-inconsistent value onto a plan.
3. **The image gate decides nothing** while background removal still costs
   ~39 s per corpus pass.
4. **Whole-term grouping is unimplemented** — 13 multi-word Arabic runs split
   across cards.
5. **The pipeline is 4K-only.**

## 5. What each reel can build today

| reel | builds end to end | what is missing |
|---|---|---|
| **vitasilk** | **yes** | — |
| test-1 | no | has 4 image slots but **no image was ever generated** |
| test-2 | no | slot planning never run |
| ground-truth | no | keyword analysis and slot planning never run |
| test-3 | no | keyword analysis and slot planning never run |

Everything missing is behind a **billable** stage. Nothing is broken.

## 6. Documents this block made wrong

Listed for the conversation to apply; none was edited here.

| document | section | correction needed |
|---|---|---|
| `docs/PROJECT_SPEC.md` | §5 subtitles | already amended to one word per card in session 6 — **verify no other §5 text still says 1–2** |
| `docs/PROJECT_SPEC.md` | §4 output | images are placed **top-left**, not in auto-detected negative space |
| `docs/PROJECT_SPEC.md` | §5 watermark TODO | still open: record size (0.1 frame width), position (free corner, seeded), duration (1.000 s), gain (−20 dB) |
| `docs/ARCHITECTURE.md` | §5.5 | zone-based image placement is **retired for automatic placement**, kept for manual zones and a future format |
| `docs/ARCHITECTURE.md` | §5.4 | the cutout gate no longer decides presentation; every image is framed |
| `docs/TEMPLATE_LIBRARY_GUIDE.md` | §5 | retiming now includes **layer time stretching** for a short card's entrance; keyframes are still never edited |
| `docs/BLOCKS.md` | Block 7 DoD | "headless" is not met; record it or restate the requirement |
