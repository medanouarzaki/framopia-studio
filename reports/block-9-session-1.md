Status: OK

# Block 9 session 1 — frame analysis is driven from the pipeline

**Spent $0.00. No API was called.** No transcription, correction, analysis or
image generation ran. After Effects was not contacted in any way: no
`osascript`, no `DoScript`, no `aerender`, nothing launched and nothing quit.

## 1. Backup

`npm run backup` **succeeded**, before any edit.

- **94 files, 53.3 MB**, into
  `~/Library/CloudStorage/GoogleDrive-…/My Drive/framopia-studio/`.
- **0 copied, 94 already there and identical, 0 failed verification.** 0.2 s.
- **Every file was re-read from the destination and matched by sha256**, and
  every one was confirmed materialised locally.
- `.local/config.json` was **skipped and named on screen** — a cloud destination
  refuses to receive a credential, which is session 40's rule working.

## 2. Stop conditions

| | |
|---|---|
| mount | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`, and `git rev-parse --show-toplevel` agrees |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects at start | **1** instance, pid 79146 (plus its helpers and two `CEPHtmlEngine` processes) |
| After Effects at end | **1** instance, pid 79146 |
| `aerender` at start / end | **0 / 0** |

`templates/library.aep`, `.local/ground-truth/` and every hand-made reference
are untouched.

## 3. Inventory

### 3.1 Which videos have face masks on disk today

**All five reels have them**, under `.local/cv/<video-basename>/masks-2fps/`,
one `<stem>-face.png` per sampled frame. Determined by listing that directory
per reel and counting files matching `-face.png`; the stem set was cross-checked
against `frames-2fps/frames.json`.

| video | mask directory | face masks | all mask files |
|---|---|---:|---:|
| ground truth | `.local/cv/ground truth/masks-2fps/` | 48 | 194 |
| test 1 | `.local/cv/test 1/masks-2fps/` | 45 | 182 |
| test 2 | `.local/cv/test 2/masks-2fps/` | 46 | 186 |
| test 3 | `.local/cv/test 3/masks-2fps/` | 44 | 178 |
| vitasilk | `.local/cv/vitasilk/masks-2fps/` | 53 | 214 |

Each frame yields four PNGs — `-confidence`, `-binary`, `-head`, `-face` — plus
`segmentation.json` and `zones.json` per reel. **1180 PNGs in total.** The
directory is keyed by the video's basename, so it carries the space in
`ground truth` and `test 1`.

### 3.2 What `npm run frames` and `npm run segment` do

**`npm run frames -- (--reel <label> | --all) [--force]`** →
`service/src/frames/frames-cli.ts` → `sampleFrames` in `frames/sample.ts`.
No sidecar. It runs **ffmpeg** with a `select` expression at `SAMPLE_FPS` = 2
and `-fps_mode passthrough` (never the `fps` filter, which would synthesise
timestamps), scales to 540x960, and reads each frame's real presentation
timestamp out of `showinfo` on stderr. It then seeks `-sseof -1 -copyts` for the
reel's **last decodable frame**, written as `frame-final.png` — named, never
numbered. Output: `.local/cv/<stem>/frames-2fps/frame-NNNN.png` plus
`frames.json`. An existing sample is **refused** without `--force`.

**`npm run segment -- (--reel <label> | --all) [--no-debug]`** →
`service/src/frames/segment-cli.ts` → `segmentPerson` in `frames/segment.ts` →
`runSidecar` with task **`segment_person`**. Input: every frame path from
`frames.json`, an output directory and a threshold of 0.5. The sidecar loads
MediaPipe **`selfie_multiclass_256x256`** (pinned by sha256 in
`tools/cv/models.json`) and writes, per frame, `-confidence.png`, `-binary.png`,
`-head.png` and `-face.png` into `.local/cv/<stem>/masks-2fps/`, plus
`segmentation.json` beside them. Without `--no-debug` it also calls the
`segment_overlay` task, writing contact sheets and close-ups to
`benchmarks/results/latest-segmentation/`.

**An existing mask is never rewritten** — `_write_or_verify` in
`tools/cv/framopia_cv/segment_person.py` compares decoded pixels and reports
`binaryUnchanged` / `confidenceUnchanged` instead.

The third command, **`npm run zones`**, reads those masks (no inference) through
the `compute_zones` task and writes `zones.json`; with `--write-plan` it puts
the zones on the Edit Plan.

### 3.3 The build's current refusal, quoted

The text lives in `service/src/build/requirements.ts`, the `face-masks`
requirement (**lines 102–111 as this session found it**), assembled into a
message by `MissingBuildMeasurementsError` at **lines 39–49**:

```
this reel is missing 1 thing(s) a correct build needs:
  the face masks for this reel (5 images are placed against them)
    without it: every image is placed against the frame instead of your face, which puts a 2030 px picture across the speaker on a 2160 px frame
    run: npm run frames -- --reel <label> then npm run segment -- --reel <label>
```

The panel renders the same three fields through `steps.ts` and
`panel/src/Build.tsx`, with Build disabled.

### 3.4 `docs/DECISION-image-config.md`

**416 lines.** Section headings:

```
# Decision — image config, frozen for Block 4
## The frozen config
## The evidence
### Cost, measured
### Per-reel arithmetic
### Why pro
## Known caveats
## Amendment (2026-08-29) — the gate advises, it never blocks
## Amendment (2026-08-29) — cutout metrics judge cutout slots only
## Amendment (2026-08-29) — nothing measures whether the picture shows the idea
## Amendment (2026-08-29) — the pictures are too dark to read
### The sentence that causes it
### What it produces, measured
### The proposed change, not applied
### What testing it costs
### Why it is Block 9
## Amendment (2026-08-29) — literal or atmospheric, decided per moment
### What the prompt says today
### The evidence, all nine planned slots
### The proposed change, not applied
### All three image defects are the prompt
## References
```

**Yes — it documents all three defects**: *fidelity* (session 31, "nothing
measures whether the picture shows the idea"), *darkness* (session 34) and
*literalness* (session 35). Its own summary table names them as one problem seen
three ways, all decided by the words sent to the model and none fixable in the
gate.

**Yes — it contains pasteable replacement prompts, two of them.** Verbatim:

For `imageStyle.stylePrompt`, replacing the two palette/lighting fragments:

```
the brighter end of the palette leads: {{palette.accent}} and {{palette.light}}
carry the subject, with {{palette.primary}} for depth and {{palette.background}}
kept to the ground behind it

lit so the subject reads immediately at a glance, bright and clearly separated
from its ground, not sunk into it
```

Added to `slotPrompt`, after the sentence about what a slot illustrates:

```
When the words name something concrete and depictable — a brand, a product,
a place, a country, an ingredient, a tool, a number of things — the picture
should usually be that thing, and the idea should name it as she named it.
A viewer should recognise it at a glance without working out what it stands
for.

When the words name no such thing — a question, a feeling, a promise, a
result — the picture should carry the mood or the outcome instead, and the
idea should describe that.

Decide this for each slot on its own. Both kinds are right, and neither is
the default. The test is what a viewer would recognise fastest in the two
seconds the picture is on screen.

Do not blend the two. A concrete thing beside an abstract one is two
subjects, and a slot idea depicts one.
```

The document is explicit that **nothing was generated and no prompt was
changed**, that all three should be tested together because a prompt change is a
billable re-generation, and that the test is `test-1`'s 8 images — published
$1.072, expected about **$1.24**, budgeted ceiling **$1.4472**. **Nothing in
this session touched any of it.**

### 3.5 The `fonts` field, and what `buildFonts` falls back to

Shape, from `core/src/mode.ts`'s own doc comment and `ModeFonts`:

```
fonts   { status: "tbd", note } until the user supplies them,
        then { status: "set", latin, arabic }
```

`buildFonts` in `core/src/build-fonts.ts` returns the mode's own pair **only**
when `status === 'set'` and both `latin` and `arabic` are present. Otherwise it
falls back to the **global** subtitle pair from `core/src/typography.ts` —
`LATIN_FONT` (Inter Semi-Bold) and `ARABIC_FONT` (Almarai Bold) at
`ARABIC_SIZE_RATIO` (1.07x) — with `source: 'global'` and a warning naming both
faces, which the panel shows at Build. `requireFonts` still throws on a `tbd`
mode and is called by nothing outside `core`.

`modes/k2-syndicalia.json`, in full, is reproduced at the end of this report
(§9) so this section stays readable.

### 3.6 Where the image prompt is composed

**`composePrompt`** (and `composeNegativePrompt`) in
`service/src/analysis/slot-select.ts` — `composePrompt` at line 149, called from
`planSlots` at line 244 and from `recompose.ts`. It joins the slot's `idea`, the
whole of `mode.imageStyle.stylePrompt`, and this slot's draw from the three
variation axes, normalising each fragment's terminal punctuation.

Read from `my files/test videos/test 1.editplan.json`, slot **`img001`**, with
no API call:

```
A woman gently touching her firm lifted jawline. a single clear idea, readable at a glance. one subject, centred and unobstructed. dominant colour palette of #1A0000, #820000 and #C9A96E. lit against #1A0000, with #F8F6F2 reserved for highlights. seen from slightly above, looking down. macro, a single detail standing for the whole. hard directional light with defined shadow.
```

Its negative prompt, from the same slot:

```
no extraneous objects, no background clutter, no incidental detail, nothing in frame that is not carrying the idea, no busy or competing composition, no watermark, no logo
```

## 4. Done

### 4.1 The stage

`service/src/frames/analyse.ts` — **new**. `analyseFrames` samples the reel,
segments every frame in batches, derives the zones and writes them onto the
plan. It calls the same `sampleFrames`, `segmentPerson` and `computeZones` the
three CLIs call, in the same order with the same parameters, so the driven path
and the terminal path cannot produce different masks.

`service/src/pipeline.ts` — `zonesNotDriven` is **deleted**. The `zones` stage
calls `driveFrameAnalysis`, which is given the reel label, the video path and
the plan path.

`service/src/pipeline-stages.ts` — the stage's label is **"Looking at the
video"**, replacing "Frame analysis (local, free)". Chosen as the prompt
suggested: it says what the stage is for rather than what it does, and
"segmentation", "masks" and "sidecar" are all words from this codebase.

### 4.2 Progress

Batched on the Node side, never parsed out of stderr. `SEGMENT_BATCH_SIZE` = 8
frames per sidecar call (**CHOSEN, NOT MEASURED**); each batch that returns is a
percentage. The Python side is unchanged — its stdin-JSON/stdout-JSON contract
is untouched.

`StageReport.detail` is a **schema addition, optional with a default of null**,
carried through `panel/src/types.ts` and rendered by `App.tsx` only while a
stage is running. A panel older than the service reads it as absent rather than
empty. The line reads *"Finding you in the picture — frame 24 of 53"*.

The dry run's note for the stage now reads *"free, and done on this machine. It
can take a few minutes the first time for a video."*, and the panel shows that
sentence on the main screen rather than only as a tooltip.

### 4.3 The manifest

`.local/cv/<stem>/masks-2fps/frame-analysis.json`. It is the artifact; the
terminal is not. Written **last**, so a run that died half way reads as a run
that never happened. The five now on disk:

| reel | frames | zones | wall | model |
|---|---:|---:|---:|---|
| ground-truth | 48 | 7 | 26.7 s | selfie_multiclass_256x256 |
| test-1 | 45 | 18 | 24.7 s | selfie_multiclass_256x256 |
| test-2 | 46 | 19 | 25.2 s | selfie_multiclass_256x256 |
| test-3 | 44 | 7 | 26.4 s | selfie_multiclass_256x256 |
| vitasilk | 53 | 20 | 28.6 s | selfie_multiclass_256x256 |

Each also records the source path, its **sha256**, the sample fps, the task, the
model's absolute path, the threshold, the zone method and the completion time.
The zone counts reproduce the corpus figures Block 6 session 4 recorded exactly.

`frameAnalysisIsFresh` compares every one of those fields against the video as
it is now. Any mismatch, or a missing or unparseable manifest, is a re-run —
masks are reproducible, so being wrong in that direction costs half a minute and
being wrong the other way builds a comp against another video's face.

### 4.4 Absence is loud and typed

`FrameAnalysisUnavailableError` names ffmpeg, the venv and the model separately,
each with what the pipeline would otherwise do and the command that fixes it
(`tools/cv/setup.sh`, or `brew install ffmpeg`). **It never returns an empty
result** — that is the shape that put a 2030 px picture across the speaker while
every check reported success.

### 4.5 The build's refusal stays

`buildRequirements`' `face-masks` requirement is unchanged in what it needs and
what it warns of. Its **command** now names the panel control first:

```
press Run pipeline for this video; from a terminal, npm run frames -- --reel <label> then npm run segment -- --reel <label>
```

Both halves are true. The existing tests that assert the refusal fires and that
it contains `npm run segment` still pass **unchanged**.

### 4.6 Running one stage on its own

`runPipeline` gains `only?: PipelineStageId[]`; a stage not listed is skipped
with the reason *"not part of this run"* before it looks at anything. Exposed on
the job as `params.only`. Frame analysis is free while the three stages before
it are not, so re-doing it must be expressible without walking past a billable
stage and hoping its cache still hits.

### 4.7 A stale mask is replaced, not trusted

The sidecar never rewrites a mask it finds, so a mask left over from a different
cut of the same video would survive a re-run and be reported as changed rather
than replaced. `analyseFrames` deletes exactly those and asks again, and reports
the count as `repairedMasks`. It was **0** on every reel this session.

### 4.8 One real defect found by a test

`analyseFrames` wrote `segmentation.json` into a directory only the sidecar had
ever created. With a stubbed sidecar the write failed. The directory is created
by this side now — a stage that failed only at the last write would otherwise
leave masks that nothing described.

## 5. Proof on real footage

**Every video already had masks**, so the prompt's alternative applies: run into
a scratch location and byte-compare.

### 5.1 Scratch run

A symlink at `.local/scratch/vitasilk-scratch.mov` pointing at the real
`vitasilk.mov` gives a different basename, so the stage wrote to
`.local/cv/vitasilk-scratch/` and could not touch anything existing. Measured:

- **53 frames, 20 zones, 28.4 s** of stage wall clock (31.8 s including the
  sha256 of a 2.87 GB file).
- Files written: **53 frames + 212 masks + `frames.json` + `segmentation.json` +
  `zones.json` + `frame-analysis.json`**.
- **Byte-compared against the existing `vitasilk` output: 53 of 53 frames
  identical, 212 of 212 masks identical, 0 differing, 0 missing.**
- `zones.json`'s `zones` and `perFrame` are **identical** to the stored ones,
  ignoring only `reel` and `elapsedS`.
- A second run **skipped in 1.44 s**, reporting *"already done: 53 frames, 20
  zones"*.

The scratch directory and the symlink were then removed. Nothing existing was
deleted, moved or overwritten by it.

### 5.2 Through the runner, on all five reels

Then `runPipeline({ only: ['zones'] })` on each of the five reels — the real
path, writing to the real directories.

- **vitasilk 30.8 s, test-1 27.8 s, test-2 28.3 s, test-3 29.4 s, ground-truth
  30.1 s**; every stage `done`, **$0.0000 billed** on each.
- A census of every PNG under `.local/cv/` before and after: **1180 files, all
  1180 byte-identical.** Frames were re-sampled and came back identical; masks
  were verified and not rewritten.
- Each Edit Plan was compared against the copy the backup had already put in
  Drive: **only `meta` and `pipeline` changed on all five**, and each plan's
  zones are byte-identical (7 / 18 / 19 / 7 / 20, unchanged).

**The whole reel takes 25 to 31 seconds, not the "minutes" the Block 8 handoff
estimated.** The panel still warns it can take a few minutes the first time,
because that is a claim about an unknown video rather than about these five.

## 6. Deviations

- **The stage's position is unchanged: `zones` is still last, after `images`.**
  The prompt asks for it "immediately before the stage that consumes the masks
  (image placement)", and image placement is not a pipeline stage — it happens
  in the build. `zones` last already is immediately before the consumer, and
  reordering would have moved a free stage in front of two slow billable ones
  for no gain, while changing the dry run's order on screen.
- **The frame PNGs are cleared before a re-sample.** A re-sample can write fewer
  files than the last one, and a leftover `frame-NNNN.png` would desynchronise
  the `showinfo` timestamps from the files they describe — the exact hazard
  `frame-final.png` is named rather than numbered to avoid. Frames are
  regenerated from the video, and the corpus census above shows all 231 came
  back byte-identical. **Masks are never deleted** except the specific ones the
  model no longer reproduces (§4.7).
- **The stage id stays `zones`.** Renaming it would change the plan's
  `pipeline.zones` key and the dry run's stage id, which several tests and the
  panel read. Only the label the user sees changed.
- **No new npm or pip dependency.**

## 7. Failures and open problems

- **The CEP half is untested, as always.** Everything here was proven under
  Node and in Playwright's Chromium. Whether the panel renders the new progress
  line inside After Effects is unobserved; the bundle passes the Chromium 99
  capability denylist against `panel/dist`, and the line uses no API beyond what
  the panel already used.
- **The stage has never been run from the panel.** It was proven through
  `runPipeline` directly and through the job runner's own tests. The user
  pressing Run is what would prove the whole path, and that needs his machine.
- **A video with genuinely no masks was never exercised end to end**, because
  every video in the catalogue has them. The scratch run is the closest thing:
  a basename nothing had ever sampled, taken from nothing to a full result.
  The stale-mask repair path (§4.7) is proven only by a unit test with a stubbed
  sidecar — no real mask in this corpus failed to reproduce.
- **`repairedMasks` re-segments every frame, not only the stale ones.** It is
  correct and it has never fired on real input; it would cost one extra pass.
- **The sha256 of the source video is re-read on every run** — 1.4 s warm, about
  3.4 s cold on a 2.87 GB file. It is the only honest freshness key and the plan's
  recorded hash is a claim rather than a measurement, so it was not substituted.
- **Still terminal-only, and still blocking the block's DoD in full:**
  `npm run watermark:measure`, and `plan.source.dialogueLufs`, which only
  `npm run migrate:sfx-placement` writes. Neither was in this session's scope.
- **Nothing about the three image-prompt defects was touched**, deliberately:
  they are billable to test and need the user's go-ahead.
- No flaky test was seen. `npm test` in `panel/` is watch mode, not `--run` —
  it hung a command for ten minutes before that was noticed. `npm run check`
  uses the run mode and is unaffected.

## 8. Repo state

- Branch **`main`**, four commits ahead of `d53a70b`, nothing force-pushed.
- HEAD: **`4f1ab35 docs: record that frame analysis is driven`**.
- Working tree clean apart from this report.
- **`npm run check`: PASS**, measured from this session's final run:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 31 | **469** |
| `framopia-service` | 85 | **1099** |
| `framopia-benchmarks` | 16 | **166** |
| `framopia-panel` | 6 | **155 passed, 2 skipped (157)** |
| `tools/cv` pytest | — | **149 passed in 7.75 s** |

Tail of that run:

```
> @framopia/core@0.1.0 validate:modes
mode k2-syndicalia v7: ok (fonts tbd)
templates: 6 entries, ok
validate-templates: 6 template(s) ok, audited against library.aep
validate:panel: panel/CSXS/manifest.xml ok

> framopia-benchmarks@0.1.0 verify-refs
  ok    ground-truth   v1.0.8-conformant
  ok    test-1         v1.0.8-conformant
  ok    test-2         v1.0.8-conformant
  ok    test-3         v1.0.8-conformant
references: PASS
149 passed in 7.75s
models: birefnet-general ok
models: selfie-multiclass-256x256 ok
check: PASS
```

The panel bundle is rebuilt by its own test script before the tests run, so the
Chromium 99 denylist ran against `panel/dist` as built from this session's
source.

## 9. `modes/k2-syndicalia.json`, in full

```json
{
  "id": "k2-syndicalia",
  "name": "K2 Syndicalia",
  "version": 7,
  "note": "Stub. The palette is locked (PROJECT_SPEC §5); fonts, the real image style and the vocabulary are supplied by the user at Block 9. vocabulary is deliberately empty rather than guessed: Block 2 saw one brand name rendered three different ways across three identical correction calls, so these terms become load-bearing as transcription key terms once they exist. allowedTemplates holds stub ids until the real templates arrive in Block 6. Version 2 added imageVariation.",
  "palette": {
    "background": "#1A0000",
    "primary": "#820000",
    "accent": "#C9A96E",
    "light": "#F8F6F2"
  },
  "fonts": {
    "status": "tbd",
    "note": "The user has fonts in use; their names are collected at Block 9 and recorded here. PROJECT_SPEC §5 forbids inventing them, and requireFonts() throws rather than substituting a default."
  },
  "imageStyle": {
    "stylePrompt": [
      "a single clear idea, readable at a glance",
      "one subject, centred and unobstructed",
      "dominant colour palette of {{palette.background}}, {{palette.primary}} and {{palette.accent}}",
      "lit against {{palette.background}}, with {{palette.light}} reserved for highlights"
    ],
    "negativePrompt": [
      "no extraneous objects",
      "no background clutter",
      "no incidental detail",
      "nothing in frame that is not carrying the idea",
      "no busy or competing composition"
    ]
  },
  "imageVariation": {
    "note": "The user's ruling (Block 3 session 3): the mode palette is dominant in every image, and the slots of one reel vary so the set reads as designed rather than batched. imageStyle.stylePrompt is the invariant half and applies unchanged to every slot -- that is what keeps the palette dominant. These axes are the varying half. Block 4 session 3 replaced the composition axis: when the quality gate returns `cutout` the background is discarded, so any variation expressed as where the subject sits inside the generated frame is erased, and the set would read as batched precisely where cutouts work best. The three axes here are properties of the subject itself, which survive being cut out. Placement language is gone from both halves except `centred`, which the invariant fragment keeps because it helps the cutout by holding the subject clear of the frame edge. The specific terms are placeholders like the rest of this stub and are refined with the user at Block 9; the axis names are the part that is settled. Block 4 session 5 pruned the flat/frontal/unmodelled lighting entry: a cutout needs the subject separated from its ground and flat frontal light removes that separation. Stated honestly, the prune's effect is unmeasured -- all six corpus images carried `flat frontal light, no modelling` and the pro model rendered dramatic rim light regardless, so this axis is not reliably obeyed. `soft diffuse light, shadows barely readable` was pruned at session 6 by the user's ruling: the prune targets the flat characterless look, and barely-readable shadows are that look under a gentler name. Diffuse light itself is fine -- an entry that is diffuse *and* modelled belongs here, and none is written yet. The axis is at the validator's minimum of two values; a third is the user's to write at Block 9, like the fonts.",
    "axes": {
      "cameraAngle": [
        "seen straight on at eye level",
        "seen from slightly below, looking up",
        "seen from slightly above, looking down",
        "seen at a three-quarter turn"
      ],
      "framingTightness": [
        "wide, the whole subject with air around it",
        "medium, the subject from the waist",
        "close, the subject filling most of the height",
        "macro, a single detail standing for the whole"
      ],
      "lighting": [
        "hard directional light with defined shadow",
        "rim light separating the subject from the ground"
      ]
    }
  },
  "imageCandidates": 2,
  "allowedTemplates": {
    "subtitle": [
      "sub_pop",
      "sub_pop_ar"
    ],
    "keyword": [
      "kw_slam",
      "kw_slam_ar"
    ],
    "image": [
      "img_slide_left",
      "img_float"
    ]
  },
  "vocabulary": [],
  "imageScale": 1.4
}
```

## 10. Suggested next step

The block's remaining terminal dependencies are the watermark measurement and
the dialogue loudness, and both are the same shape as the one just closed: a
free local measurement the build refuses without, named in a refusal rather than
run. `npm run watermark:measure` already writes `.local/build/watermark.json`
and `npm run loudness:measure` already writes `.local/build/loudness.json`; what
neither has is a caller inside the pipeline and a freshness record of its own.
Driving them would close *"video-in to built comp with no terminal"* outright —
and unlike frame analysis they are seconds, not half a minute, so they can sit
inside an existing stage rather than becoming stages of their own. After that,
the three image-prompt defects in `docs/DECISION-image-config.md` are the real
Block 9 work, and the first thing they need is the user's go-ahead to spend
about $1.24 regenerating `test-1`'s eight images with all three changes applied
at once.
