Status: OK

# Block 9 session 13 — the framing tightened, and Block 8's DoD closed

**Spent $0.00. No API was called and no image was generated.** After Effects was
driven only through `DoScript` into the already-running instance; never launched,
never quit, and the project it holds was left clean.

## 1. Stop conditions

| | start | end |
|---|---|---|
| mount | `pwd` and `git rev-parse --show-toplevel` agree | agree |
| ledger | **116 lines**, `e5e0a6e9d6735188065fdbcb33bb9211cf1fc95a5cbc23b192ad246299c132cb` | **byte-identical** |
| cache | **44 entries** | **44, census identical** (`diff` empty) |
| `vitasilk` image files | 28 files, manifest `b5d4e5c7888d9db5b3ecb17d…` | **identical** |
| cutout files | 19 files, manifest `31a5baa205382f1b54f8c56e…` | **identical** |
| After Effects | 1 instance, **pid 79146** | 1 instance, **pid 79146** |
| `aerender` | 0 | 0 |
| `templates/library.aep` | `1d7553e894e10f82051131e8…` | **identical** |

Cutouts were hashed file by file at both ends, per reel, after last session's
collision destroyed and restored eight of `vitasilk`'s. All nineteen — eight
under `test 1`, eleven under `vitasilk` — are unchanged.

`appendCost` did not fire. Nothing regenerated, and no image file was deleted.

## 2. The framing change

`wide, the whole subject with air around it` is removed from
`imageVariation.axes.framingTightness`. **Three values remain** — medium, close,
macro — against the validator's minimum of two, and `npm run validate:modes`
passes at **v12**. Medium is now the loosest framing any slot can draw.

The ruling and its reason are in the mode's own note: a picture is placed at a
fixed size in the top-left corner, 801–917 px on a 2160 px frame, so how much of
its own square the subject fills is the whole of how legible it is. `test-1`'s
`img002` is the evidence — one candidate a whole doctor showing nothing, the
other her from the chest with the vial large in frame.

**Which images would now miss the cache**, computed locally against the current
mode and not guessed:

| reel | slots that would miss | detail |
|---|---|---|
| `test-1` | **3 of 4** — 6 of 8 images | img001 macro→medium, img002 wide→close, img003 medium→macro; **img004 draws *close* either way and still hits** |
| `vitasilk` | **5 of 5** — 10 of 10 images | and these would have missed already: its stored prompts still carry the **old** palette and lighting fragments, because session 12 deliberately did not recompose it |

So of the 18 generated images, **16 would miss**. Only `test-1`'s six are caused
by this session; `vitasilk`'s ten are inherited from session 12's palette change,
and one of its five slots (`img005`) has an unchanged framing draw — its prompt
differs only in the palette fragments.

**Nothing regenerated, and neither plan was recomposed.** Recomposing would leave
a plan describing prompts whose pictures are not on disk; as it stands every
stored prompt still describes the picture beside it.

## 3. The two untested changes, recorded

Written into `docs/DECISION-image-config.md` so a later session cannot assume
either works.

| change | applied | exercised | what would test it |
|---|---|---|---|
| **literal or atmospheric** — `slotPrompt`, `ACTIVE_SLOT_PROMPT_VERSION` 2 | session 12 | **no** | the first reel to plan slots fresh |
| **framing tightness** — `imageVariation`, mode v12 | this session | **no** | the first reel to plan slots fresh |

Both are deliberate. The literalness rule governs which *ideas* get written and
session 12 reused `test-1`'s existing four; re-planning them yields **six slots,
not four** at `IMAGE_SLOTS_PER_30S` 8, which is twelve images at **$2.1708**
budgeted against the $1.4472 that run was authorised for. The framing rule
changes what a slot draws, so testing it means regenerating, and the user ruled
against spending: about **$6.82** of credit remains and Block 10's golden runs on
two machines come out of it.

**Both get their first test on the same run** — the first reel to plan slots
fresh exercises the literalness rule when it writes its ideas and the framing
rule when it composes its prompts. `ground-truth` and `test-3` are the two reels
whose analysis has never run.

## 4. The two measurements, driven

`service/src/build/measurements.ts` is the one declaration. Both sit **inside the
transcription stage**, not as stages of their own: together they are under three
seconds, and a fifth row in the panel for three seconds of ffmpeg would be a
story about the tool rather than about the video.

**In the transcription stage specifically**, because the dialogue level has to be
on the plan before the analysis stage derives SFX gains from it. And **on the
skip path as well as the run path**, because a plan transcribed before this
existed carries no level, and skipping the stage must not mean skipping the
measurement.

- **The watermark** is measured by **spawning `tools/measure-watermark/cli.ts`**,
  the same file a terminal runs. It is 680 lines of ffprobe, alpha
  straight-vs-premultiplied testing and beep detection, and two implementations
  of that would be two answers to one question — the build job spawns its own CLI
  for the same reason. Verified before wiring: the tool reproduces
  `.local/build/watermark.json` and `benchmarks/RESULTS-block7-watermark.md`
  byte-identically. **2.4 s.**
- **The loudness** measurement moved into **`core/src/loudness.ts`**, which the
  sweep CLI and the pipeline both call, so the driven path and the terminal path
  cannot measure differently. The CLI still prints the same corpus table with the
  same figures. **About 0.2 s a reel.**

**The second hop is closed.** `applyLoudnessToPlan` writes
`plan.source.dialogueLufs` and `dialoguePeakDbfs`, which previously reached a
plan only through `npm run migrate:sfx-placement` — measuring alone would have
left the build refusing exactly as before. A plan that already carries SFX events
has them re-derived when the level changes, through the same `deriveSfxEvents`
the analysis stage calls. This was confirmed in code before anything was wired.

### The freshness records

`.local/build/loudness/vitasilk.json`, written by the run:

```json
{
  "reel": "vitasilk",
  "integratedLufs": -14.4,
  "lraLu": 1.2,
  "truePeakDbfs": 0,
  "measuredAt": "2026-08-30T13:09:41.263Z",
  "measuredWith": "ffmpeg (homebrew)",
  "schemaVersion": 1,
  "sourcePath": ".../my files/test videos/vitasilk.mov",
  "sourceSha256": "99dfe0e530ab85d12e2c5e756dc907dca09c75f1257e2bdded28e32795327e72"
}
```

The hash is the plan's own `source.sha256`, which transcription already computed:
hashing a 2.4 GB reel takes **7.5 s** and the answer is known. `watermark.json`
gained `schemaVersion` and `measuredAt` beside the asset sha it already carried.
Any mismatch — a different file, a different hash, a different code version — is
a re-measurement, and re-measuring is cheap and deterministic while trusting a
stale number mixes a reel against another cut's loudness.

**Absence is loud.** `MeasurementUnavailableError` names what is missing, what the
build would otherwise do, and the command that fixes it — never an empty result,
which is the shape that put a 2030 px picture across the speaker while every
check reported success. Proven by test: a missing video refuses naming the path,
the consequence (*"every sound is mixed against nothing and clips"*) and the
remedy. **The build's own refusals are unchanged**; what changed is that they no
longer fire in normal use.

## 5. The DoD proof

**Proved on `vitasilk`, and nothing billed** — the ledger is byte-identical
across the whole proof. `vitasilk` was chosen because every stage is already on
its plan, so a run cannot reach a paid call.

**The pipeline**, run through `runPipeline` — the same function the job runner
calls when the panel posts a job:

```
  watermark: measuring — nothing has measured the watermark
  watermark: measured, 1924x2154, 61 frames
  loudness: measuring — nothing has measured this reel
  loudness: -14.4 LUFS, peak 0.0 dBFS

  transcription  skipped  $0.000000  already on the plan
  analysis       skipped  $0.000000  already on the plan
  images         skipped  $0.000000  already on the plan
  zones          skipped  $0.000000  already done: 53 frames, 20 zones

spent this run: $0.000000
```

That is the **cold** run, with the watermark facts and the loudness record
deleted first so the measurement was actually taken rather than reported fresh.
The measured level matches the corpus sweep exactly. A second run: *"already
measured from this exact file"*, *"already measured from this exact video"* —
**3.5 s cold, 1.5 s warm**.

**The build**, through `runBuildJob`, the same path the panel's Build button
posts to:

```
  stage: Read the plan and resolve everything it names
  stage: Build the composition in After Effects
  stage: Check the built comp against the plan
  done: true   error: none
```

Read back out of After Effects: `.local/build/vitasilk-full.aep`, **`master_final`
83 layers and `master_subs_only` 72**, both 2160x3840, 25.692 s at 29.9700 fps,
97 project items, **project clean**.

**No terminal step, and no billable stage was involved.** The plan changed in no
top-level key.

## 6. The preflight, and the proof it can fail

`assertFrameAnalysisAvailable()` runs before the transcription stage. Frame
analysis is last and free, so a missing ffmpeg, CV venv or segmentation model was
previously discovered *after* three billable stages had spent. **The stage keeps
its position; only the discovery moved.**

Proven by moving the real model file aside rather than by stubbing:

```
PREFLIGHT REFUSED:

Looking at the video cannot run: the segmentation model at
/Volumes/T7 Shield/.../tools/cv/models/selfie_multiclass_256x256.tflite
    without it: nothing can find you in the frame, and every image is placed over your face
    run: tools/cv/setup.sh
```

Restored immediately at its pinned sha256 `c6748b1253a99067ef71f7e26ca71096…`,
and `npm run check`'s model verification passes. A test injects a throwing
preflight and asserts **no stage impl was called** and the ledger did not move.

## 7. The snapshot comparison

`snapshotsAgree` compared the client's `version` along with the palette, faces,
colour roles and image scale. Sessions 12 and 13 edited image prompts — which no
build reads — and every pinned reel started reporting itself behind while its look
was byte-identical.

`version` is now excluded for the same reason `capturedAt` already was: **neither
changes a pixel**. A reel is behind when the look differs, not when the number
does. The version stays **recorded** as provenance — which version a reel was
pinned at is worth knowing, and nothing else says so — it simply does not decide.

**Nothing is re-pinned automatically.** Moving a reel forward is still a control
someone presses. Four tests pin the rule, including that a look change with a
*static* version is still caught, so the comparison did not become blind.

## 8. Deviations

- **The loudness measurement moved into `core` rather than being spawned.**
  `service` and `tools` both compile with `rootDir: src`, so a service cannot
  import a tool; core is the shared home the repo already uses for exactly this.
  The watermark stayed a spawn because porting its alpha and beep analysis would
  create a second answer to one question.
- **The plans were not recomposed** after the mode bump, deliberately — see §2.
- **`.local/build/loudness.json`, the corpus sweep, is unchanged in shape** and
  still what `npm run migrate:sfx-placement` reads. The per-reel freshness
  records are a second, additive artifact rather than a replacement.

## 9. Failures and open problems

- **The pipeline tests were measuring two real videos on every run.** Adding the
  measurements to the transcription stage without injecting them meant
  `pipeline.test.ts` ran real ffmpeg over `ground truth` and `vitasilk`. I found
  it by checking the disk rather than by a failing test — everything was green.
  No plan was corrupted: both already carried matching levels, so
  `applyLoudnessToPlan` found them equal and wrote nothing, and the values still
  match the corpus sweep exactly. Both hooks are injectable now and all 20
  `runPipeline` calls in that file pass fakes.
- **`runBuildJob` reports `outputPath: (none)`** although the build wrote
  `.local/build/vitasilk-full.aep`. The build succeeded and the file is correct;
  what is missing is the job reporting where it went, so the panel cannot name
  the file it just made. Found during the DoD proof, not fixed — it is a
  reporting gap in a path this session did not otherwise touch.
- **Both prompt changes remain unobserved**, §3. This is the session's largest
  open item and it is a recorded decision.
- **`.local/build/watermark.json` is still gitignored**, so a second machine
  starts without it — but it no longer matters for the DoD, because the pipeline
  produces it. Block 10's golden run will exercise that on a machine that has
  never had one.
- **Nothing was lost.** No cache entry, cutout, plan block, reference, ledger line
  or template content changed. The one file this session rewrote and restored —
  the segmentation model — came back at its pinned hash.

## 10. Repo state

- Branch **`main`**, seventeen commits ahead of `49e97a5`, nothing force-pushed.
- HEAD: **`1d69a77 docs: record the framing ruling and the two untested changes`**.
- Working tree clean apart from this report.
- **`npm run check`: PASS**, measured from this session's final run:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 38 | **544** |
| `framopia-service` | 90 | **1146** |
| `framopia-benchmarks` | 16 | **166** |
| `framopia-panel` | 6 | **159 passed, 2 skipped (161)** |
| `tools/cv` pytest | — | **149 passed in 9.74 s** |

```
mode k2-syndicalia v12: ok (fonts set)
templates: 6 entries, ok
extendscript: 12 .jsx file(s) ok
validate-templates: 6 template(s) ok, audited against library.aep
validate:panel: panel/CSXS/manifest.xml ok

  ok    ground-truth   v1.0.8-conformant
  ok    test-1         v1.0.8-conformant
  ok    test-2         v1.0.8-conformant
  ok    test-3         v1.0.8-conformant
references: PASS
149 passed in 9.74s
models: birefnet-general ok
models: selfie-multiclass-256x256 ok
check: PASS
```

## 11. Suggested next step

`/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/build/vitasilk-full.aep`

That file is the definition of done: it was made from picking a video to a built
comp without a terminal, and without spending anything.

What is worth doing next costs money and is one decision. `ground-truth` and
`test-3` have never had their analysis run, so whichever goes first is the only
thing that can test the two prompt changes now standing untested — the
literal-versus-feeling rule and the tighter framing — and it tests both at once.
At the current density that is about **$2.17** a reel, against the **$6.82**
remaining that Block 10's golden runs also draw on.
