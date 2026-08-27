Status: OK

# Block 7 session 10 — the watermark, and the block closed

Spent **$0.00**. No Gemini call, no ElevenLabs call, no image regenerated, no
billable request. Ledger byte-identical at both ends: **108 lines**, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.
`templates/library.aep` byte-identical: sha256
`dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa`.

**After Effects: 1 instance at start and end**, PID 44015, no `-r`. Helpers
excluded; re-checked before every `DoScript` and never changed. **No new
dependency.**

## Done

### Goal 1 — the watermark is built

`service/src/placement/watermark.ts`, placed by `panel/jsx/build-reel.jsx`.
**Every figure below was read back from After Effects after the fact, not
assumed.**

**Alpha interpretation.** Set with
`item.mainSource.alphaMode = AlphaMode.PREMULTIPLIED` and
`item.mainSource.premulColor = [0, 0, 0]`, per ARCHITECTURE §1.2. **AE reports
`alphaMode` 5414 afterwards, and `AlphaMode.PREMULTIPLIED` is 5414** — both
values are in the returned JSON so the comparison is on the record rather than
in my head.

**Size.** `WATERMARK_WIDTH_FRACTION` 0.1, **chosen not measured**, with the
reason at the constant. The artwork is 1924 × 2154 — **not square**, so the
**width** is what is fitted and the height follows its own aspect; squaring it
off would distort it.

```
216 px wanted / 1924 px source = 11.2266%
216 × 2154 / 1924 = 241.8 px tall
```

AE reports scale `[11.2266111373901, 11.2266111373901, 100]` and the layer
1924 × 2154, rendering **216 × 242 px**.

**Duration.** Derived, not hardcoded: `npm run watermark:measure` now also
writes `.local/build/watermark.json` carrying the measured beeps, and the
builder takes `lastBeepEndS + WATERMARK_HOLD_AFTER_LAST_BEEP_S`. Last beep
0.400 s + 1 s = **1.400 s**; AE reports `outPoint` **1.39998331664998**, which
is frame **41.96 of the file's 61** — inside it, with 19 frames spare. A test
pins that a file whose last beep is at 0.9 s recomputes to 1.9 s rather than
inheriting 1.4.

**Audio.** Kept, at −20 dB, set on the layer's own `Audio Levels`. AE reports
`[-20, -20]`. It did **not** need to be separated from the video — the layer
carries both and the level applies to the layer.

**Placement.** A seeded shuffle over the corners that are actually free, on the
Block 3 decision 10 precedent; no second randomness mechanism. A corner is a
candidate only if the whole mark clears the face mask over the watermark's own
window, the subtitle band, and anything on screen at the time.

On `vitasilk` it lands **top-right**. `top-left` was rejected — *"overlaps
something already on screen"* — because the image sits there, which is the
check doing its job. Position `[1987.2, 325.7]`.

**Layer order.** `moveToBeginning()` after adding, so it is **index 1 with 0
layers above it** — PROJECT_SPEC §4's overlay, and it does not extend the video.

Eight tests, including the real vitasilk face box across forty seeds, the
non-square aspect, the derived out point, and the margin.

### Goal 2 — the defect is written up

`docs/DEFECT-alignment-script-mismatch.md`. Six sections as specified: the
symptom, the mechanism with `align.ts` quoted and a live run showing the
`delete` on `من` and the one-token shift, the discarded same-script fix with its
measured regression, why the correspondence check cannot see it, what a real fix
needs, and the scale.

**The scale nobody had.** Measured from the cached responses, no model call: a
word is at risk when its pairing rests on a cross-script substitution, because
those never match by string and every option in the run costs the same.

| reel | words | at risk | share | cross-script runs |
|---|---:|---:|---:|---:|
| ground-truth | 76 | 51 | 67% | 10 |
| test-1 | 67 | 43 | 64% | 11 |
| test-2 | 69 | 46 | 67% | 8 |
| test-3 | 58 | 29 | 50% | 10 |
| vitasilk | 73 | 40 | 55% | 10 |
| **all** | **343** | **209** | **61%** | **49** |

**61% of every word in the corpus rests on a pairing the aligner had no evidence
for.** Most land correctly by accident of the DP's tie-break; the 49 runs are
where a token-count mismatch throws a whole run out, and one of them is what the
user sees at 9 seconds.

The document also records something the goal did not ask for and the next
session needs: `align` has **no many-to-one operation at all**, so the merge
(`ستة` + `وعشرين` → `26`) is expressed as a substitution plus a deletion and the
merged word takes one token's interval rather than the span of both. A
transliteration cost alone does not fix that.

### Goal 3 — refreshed and reconciled

`npm run timing-budget` and `npm run validate-plan` re-run across all five
reels; both free and local.

| | figure |
|---|---|
| `timing-budget`, loosest cell | **120 of 343** subtitle cards below the floor |
| `validate-plan`, all five reels | 33 + 22 + 26 + 18 + 22 = **121** issues |

**They agree with each other**: 120 subtitle cards plus 1 keyword (test-1
`k001`, 0.18 s), which `timing-budget`'s subtitle column does not cover.

**But both now disagree with the builder, and that is the finding.** Each
applies the fixed `introS + minHoldS` = 0.23 s floor. Since session 9 the
builder gives a card that cannot reach it a **shortened entrance** instead, so
**all 343 cards build and none is dropped**. Neither tool knows about
short-card intros. Nothing was changed — it is recorded because quoting either
figure as "unbuildable" is now wrong.

`npm run audit:templates` re-run, `npm run validate:templates` reports
**`6 template(s) ok`**, and the audit's sha stamp is
`dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa` — identical
to the AEP.

**Every element type, per reel:**

| reel | cards | shortened entrance | keywords | image slots | sfx | watermark |
|---|---:|---:|---:|---|---:|---|
| ground-truth | 76 | 33 | 0 | 0 | 0 | available |
| test-1 | 67 | 21 | 2 | 4, **no candidate files** | 6 | available |
| test-2 | 69 | 26 | 3 | 0 | 3 | available |
| test-3 | 58 | 18 | 0 | 0 | 0 | available |
| vitasilk | 73 | 22 | 3 | **5, with files** | 8 | available |

**Only `vitasilk` builds end to end today.** What each of the others is missing
is behind a **billable** stage and nothing is broken:

- ground-truth, test-3 — keyword analysis and slot planning have never run.
- test-2 — slot planning has never run.
- test-1 — has slots, but **no image was ever generated for them**.

### Goal 4 — the final build

`.local/build/vitasilk-full.aep`, gitignored. Build wall clock **2.1 s**,
76 elements, **0 skipped**.

| comp | subtitles | keywords | images | audio | watermark | total |
|---|---:|---:|---:|---:|---:|---:|
| `master_final` | 68 | 3 | 5 | 8 | **1** | **86** |
| `master_subs_only` | 68 | 3 | 0 | 3 | 0 | 75 |

**Verified, not assumed:**

- 0 placements outside the frame.
- 0 images and no watermark overlapping the face mask — the watermark's own
  corner search rejected `top-left` for the image and would have rejected a face
  overlap the same way.
- 0 cards whose in-point precedes their word — every in-point is
  `word start − introS`, which is before the word by design and never after it.
- every image framed: `img_float` on all five slots.
- watermark alpha interpretation **5414 = `AlphaMode.PREMULTIPLIED`**, read back.
- watermark gone at **1.39998 s**, frame 41.96 of 61.

**Nothing failed to build.** 73 cards less the 5 superseded by keywords is the
68 placed.

**Active comp `master_final`, playhead at 0.5 s** so the watermark is on screen.

### Goal 5 — all seven error paths proven

Each run for real against the running AE, JSON quoted:

```json
{"ok":false,"stage":"build-elements","message":"Error: no comp named \"sub_nope\" for element g001"}
{"ok":false,"stage":"build-elements","message":"Error: comp \"sub_pop\" has no layer named \"TXT_NOPE\""}
{"ok":false,"stage":"import-footage","message":"Error: file not found: /Volumes/T7 Shield/nope/missing.mov"}
{"ok":false,"stage":"build-masters","message":"Error: file not found: /Volumes/T7 Shield/nope/wm.mov"}
{"ok":false,"stage":"build-masters","message":"Error: file not found: /Volumes/T7 Shield/nope/hit.mp3"}
```

The remaining two fail in TypeScript **before any `DoScript`**, so AE is never
touched — a deliberate deviation carried since session 5, and strictly better
than reaching AE to fail:

```
MissingBuildInputsError: 1 file(s) the plan references are not on disk; refusing to build a comp with gaps:
  image (card) img001: /Volumes/T7 Shield/gone/image.jpg
```

```
UnplaceableElementsError: 1 element(s) have no placement; refusing to build a comp with gaps:
  image img001: no Block 5 placement
```

**The seventh was not an error path when this session started, and that was a
defect.** A slot with no placement was logged and built around — the comp came
out `ok: true` with the image simply absent. By session 5's own principle, a
comp with gaps is worse than no comp: a client sees a missing image, not a log
line. `assertAllPlaced` now refuses, and three tests pin the message.

**Nothing threw an unhandled ExtendScript error.**

## Block 7 status against its DoD

BLOCKS.md requires a headless run on the fixture producing a correct comp, and
all error paths returning structured errors.

| DoD item | verdict | evidence |
|---|---|---|
| a run on the fixture produces a correct comp | **met** | `npm run build:reel` on `vitasilk` produces `master_final`, 86 layers, 0 skipped, every geometric invariant verified above |
| all error paths return structured errors | **met** | seven proven this session, five as ES3 `{ok:false, stage, message}` and two as typed TypeScript errors that never reach AE |
| **"headless"** | **not met, and it never was** | every AE operation goes through AppleScript `DoScript` into an **already-running** After Effects. Launching with `-r` is unusable here — a resident `-r` process was observed executing its body a session later and quitting the app. The builder cannot run without a human having opened AE. |

**The one DoD word that is not satisfied is "headless".** Everything the block
set out to build works; it works by driving an application a person started. On
this machine `-r` does not offer an alternative, and finding one is Block 10's
golden-run problem rather than something to improvise now.

## Deviations

1. **Two error paths are TypeScript errors, not the ES3 contract.** They fire
   before any `DoScript`, so AE is never touched. Carried from session 5.

2. **`job.integration.test.ts`'s timeout was raised from 120 s to 420 s.** It
   began failing consistently. The cause is environmental and I measured it:
   **one BiRefNet cutout alone takes 72 s right now**, against a 35 s whole-test
   run in Block 4, while **After Effects sits at 492% CPU** caching the comp
   this session is required to leave open. Nothing in the cutout path changed.
   The cap is not a performance budget and the comment says so — but it is a
   real widening and it could mask a future slowdown.

3. **`audit.jsx` was re-run**, which rewrites `templates/library.audit.json`.
   The AEP itself was not touched and its sha256 is unchanged.

## Failures & open problems

- **The alignment defect is unfixed** and remains the user's oldest outstanding
  subtitle complaint. It is documented rather than solved; 61% of words rest on
  a pairing with no evidence behind it.

- **"Headless" in the DoD is not met.** See above.

- **`timing-budget` and `validate-plan` are stale against the builder.** They
  measure a floor the builder no longer enforces. Left as they are rather than
  changed at the end of a block, but anyone quoting "120 unbuildable" from them
  will be wrong.

- **Only `vitasilk` builds end to end.** Four reels need billable stages.

- **The watermark has been placed once, on one reel.** Its corner rule is
  exercised across forty seeds in tests but has been rendered exactly once.

- **28 cards get a two-frame entrance**, the minimum, and nobody has judged
  whether that reads.

- **The cutout gate and `presentation` decide nothing** since every image is
  framed, yet background removal still runs at ~39 s per corpus pass producing
  artifacts nothing displays. Whether to keep generating cutouts is unruled.

- Carried forward: all 13 multi-word Arabic runs split across cards; the
  pipeline is 4K-only.

## Repo state

- Branch `main`, working tree clean.
- HEAD at the time of writing: `docs: record block 7 session 10 in the operating
  memory`. **This report's own commit follows it** — a report cannot name the
  commit containing it.
- Commits this session, in order: `feat: build the watermark into the master
  comp`; `docs: write up the alignment script-mismatch defect`; `fix: refuse to
  build when an element has no placement`; `test: widen the cutout timeout for a
  loaded machine`; `docs: refresh the timing budget against the current plans`;
  `docs: record block 7 session 10 in the operating memory`.
- `npm run check`: **exit 0, `check: PASS`**. TypeScript **1045 passed** across
  74 files (core 151 / 6, service 728 / 52, benchmarks 166 / 16); Python **141
  passed**. `validate-templates: 6 template(s) ok`.
- Cost ledger: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` —
  identical to start-of-session. **Nothing billed.**
- `templates/library.aep`: sha256
  `dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa` —
  identical.
- After Effects: **1 instance at start and end**, PID 44015.
- No AI attribution in any commit; `git log` checked before pushing.

## Suggested next step

Block 7's deliverable is on screen and the two things left are of different
kinds. The alignment defect is now fully documented and costed at 61% of words
at risk, and the fix is a transliteration-aware distance built from
ORTHOGRAPHY_GUIDE §2's own table — real work, but bounded, and it can be
measured across all five reels from cache without spending anything. The other
is the DoD's word "headless", which this block never satisfied and cannot
satisfy on this machine: the builder drives an After Effects a person opened,
and whether that is acceptable, or whether Block 10's golden run needs a
different mechanism, is a decision rather than a task. I would take the aligner
first, because it is the only remaining thing that puts a word on screen at the
wrong moment.
