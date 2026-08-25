Status: OK

Block 5, session 1: frame sampling and person segmentation. No API call was
made and nothing was billed.

## Done

**Housekeeping.** `handoffs/block-4.md` committed on its own as
`docs: add block 4 handoff` (278dd93).

**Frame sampler** — `service/src/frames/sample.ts`, `footage.ts`,
`frames-cli.ts`, registered as `npm run frames -- (--reel <label> | --all)
[--force]` in the root and service `package.json`.

- ffmpeg at ARCHITECTURE §5.5's 2 fps, scaled to 540x960 preserving aspect.
  All five reels are 2160x3840, so the scale factor is exactly 0.25.
- Output at `.local/cv/<video-basename>/frames-2fps/frame-NNNN.png` with
  `frames.json` beside it: source path, width, height, fps, duration, scale
  factor, and `{index, timeS, path}` per frame.
- **`timeS` is the real presentation timestamp**, parsed from ffmpeg's
  `showinfo`. Selection is
  `select='isnan(prev_selected_t)+gte(t-prev_selected_t\,0.5)'` with
  `-fps_mode passthrough`, not the `fps` filter: `fps` resamples onto its own
  grid and hands every emitted frame a synthesised timestamp, which would have
  made the manifest a restatement of `index/2`. The reels are 30000/1001, so
  the second sample is at **0.5005 s** and the divergence grows through a reel.
- The manifest records `timestamps: "pts" | "nominal"`, set by comparing the
  showinfo line count against the files actually written, so a fallback is
  visible in the data and not only in a report. **All five reels sampled at
  `pts`; the nominal branch did not fire.**
- An existing non-empty frame directory is **refused** with `FramesExistError`
  unless `--force`, because the masks beside it were computed from those exact
  frames. Nothing was displaced during this session.

**Sidecar task `segment_person`** — `tools/cv/framopia_cv/segment_person.py`,
dispatched from the existing `cli.py` TASKS table, following `remove_bg`'s
request/response shape, its lazy imports and its stderr-only logging.

- MediaPipe Image Segmenter with `selfie_multiclass_256x256.tflite`. The
  person mask is the sum of the five non-background confidence categories;
  the model is a softmax over the six, so this is the same number as
  `1 - background` and is written the way the rule reads.
- Two PNGs per frame: `<stem>-confidence.png` (8-bit grayscale) and
  `<stem>-binary.png` (thresholded at 0.5), under
  `.local/cv/<video-basename>/masks-2fps/`.
- Per frame the response carries both mask paths, the frame dimensions,
  `personPixelRatio`, and `bbox` normalized 0–1 against the mask's own
  dimensions so nothing downstream depends on the 540x960 working size.
- **No dilation and no smoothing.** The mask that gets judged is the mask the
  model produced.
- **stdout purity was verified explicitly.** MediaPipe and the XNNPACK
  delegate both announce themselves at load; both go to stderr, and a test
  asserts stdout parses as the result with stderr non-empty.

**Model pinned.** `selfie-multiclass-256x256` added to `tools/cv/models.json`
with sha256 `c6748b12…`, 16371837 bytes, wired into `verify-models.sh`.
`tools/cv/setup.sh` downloads it (rembg fetches BiRefNet itself; MediaPipe has
no fetch-on-use path) and refuses a download that does not match the pin;
setup treats "not downloaded" (exit 2) as normal, since BiRefNet is absent on
a fresh machine. `npm run check` verifies both models: `birefnet-general ok`,
`selfie-multiclass-256x256 ok`. `tools/cv/models/` is gitignored.

`mediapipe==1.0.1` pinned in `requirements.txt`. It installs alongside the
existing stack without moving anything: numpy stayed 2.4.6, scipy 1.17.1,
pillow 12.3.0, protobuf 7.36.0.

**Ran on all five reels.** 231 frames sampled and segmented.

| reel | frames | segmentation | ratio min | median | max | null bbox |
|---|---|---|---|---|---|---|
| test-1 | 44 | 6.5 s | 0.2456 | 0.2610 | 0.2664 | 0 |
| test-2 | 45 | 7.0 s | 0.2024 | 0.2382 | 0.2570 | 0 |
| test-3 | 43 | 6.5 s | 0.2499 | 0.2571 | 0.2725 | 0 |
| ground-truth | 47 | 7.1 s | 0.1743 | 0.2080 | 0.2410 | 0 |
| vitasilk | 52 | 8.2 s | 0.3463 | 0.4607 | 0.4978 | 0 |

Total segmentation wall clock 35.2 s; sampling was 65 s for all five, and is
the slower half. Nothing degenerate: no reel approaches ratio 0 or 1, and
vitasilk is higher because it is framed tighter. Median normalized bbox is
0.43–0.89 wide and 0.68–0.75 tall.

**Debug output** at `benchmarks/results/latest-segmentation/`: five
`<reel>-contactsheet.png` (every sampled frame, mask tinted magenta at 40%,
index and timeS drawn under each cell) and six `<reel>-frame-<index>.png` per
reel at full 540x960. 35 files. Rendered by a second sidecar task,
`segment_overlay`, so re-looking at a reel costs a composite rather than
inference over every frame.

**Gitignore:** `benchmarks/results/` was **already** ignored wholesale, so
`latest-segmentation/` needed no new rule and none was added. Confirmed with
`git check-ignore -v`.

**Determinism check.** test-1 re-segmented and compared against hashes taken
before the second pass: **88 of 88 mask files identical by sha256, 0
differing.** One reel, two passes, same machine — that is the whole claim.

**Tests.** `tools/cv/tests/test_segment_person.py`, 15 tests: normalized bbox
arithmetic against constructed masks with known geometry (including the
inclusive-extreme off-by-one and a box spanning several components), the
no-person case returning ratio 0 and a null bbox, the request/response
contract, the confidence mask proven not already binary, stdout purity, a
missing frame file, an empty frame list, a missing model, a corrupt model, and
the model pin accepting a match, **rejecting a tampered file**, and reporting
an absent file as not-downloaded rather than a mismatch.

`verify-models.sh` gained a `FRAMOPIA_MODELS_DIR` override so the rejection
test drives the real script against a fixture rather than reimplementing the
comparison and asserting against itself.

`service/src/frames/sample.test.ts`, 8 tests: `parseShowinfo` reading real
timestamps and frame size out of ffmpeg's log and returning nothing when
showinfo was absent, plus `summarise`'s median, extremes, null-box count and
its refusal of an empty run.

**Bytecode untracked.** 12 compiled `.pyc` files were tracked in git from an
earlier session and churned on every test run; removed from the index and
`__pycache__/` and `.pytest_cache/` added to `.gitignore`. Its own commit.

**CLAUDE.md updated** in this session: the sidecar's four tasks and its pinned
weights, the two new npm scripts, the `.local/cv/` layout with the reason it
is not under `.local/cache/`, and a Block 5 session 1 section carrying the
numbers above.

## Deviations

- **A second sidecar task, `segment_overlay`, was added** beyond the
  `segment_person` the session asked for. The contact sheets and close-ups
  need PIL compositing, and the alternative was a second invocation style in
  `tools/cv/` alongside the JSON-in/JSON-out contract. It follows the same
  contract and is debug-only; nothing in a pipeline stage calls it.
- **`.gitignore` gained `tools/cv/models/`**, which the session did not ask
  for. The weights are 16 MiB and the repo's standing rule is that model
  weights are not committed.
- No deviation on timestamps: real pts were obtained, so the nominal fallback
  named in the brief was not used. It exists in code and is reported in the
  manifest, but has not fired on any reel and is therefore untested against
  real ffmpeg output.

## Failures and open problems

- **The bounding box includes every connected component, and most frames have
  more than one.** 138 of 231 frames carry stray components, up to 18 on a
  single vitasilk frame. The specks are small — median 0.03% of mask pixels,
  worst 2.1% — but `person_stats` boxes all of them, so a speck moves a box
  edge by up to **0.052 of the frame** (median 0.000, 90th percentile 0.028).
  Whether the box should follow the largest component is a placement decision
  and was deliberately not made here: narrowing the box is exactly the kind of
  silent repair the raw mask is meant to expose. **The zone solver will
  inherit an over-wide box on 60% of frames if nothing decides this.**
- **Determinism is measured on one reel on one machine.** Nothing here says
  MediaPipe is deterministic across machines or across a mediapipe upgrade,
  which is what Block 10's golden run actually needs.
- **The `nominal` timestamp fallback has never fired**, so the branch is
  covered only by a unit test over a synthetic log.
- **The no-person path has never been exercised on real footage.** Every one
  of the 231 frames found a person. `personPixelRatio 0` with a null bbox is
  proven only against a constructed all-zero mask.
- **The 0.5 threshold is inherited, not chosen.** No comparison against 0.4 or
  0.6 was run. The raw confidence masks are on disk precisely so that
  comparison costs no inference, and it has not been done.
- **The masks were judged by eye on two renders, not systematically.** The
  vitasilk contact sheet and one close-up were inspected and are clean —
  hair, glasses, scarf, hands and the held bottle all included, edges tight,
  zero interior holes on the frame that was measured. The other four reels'
  sheets were generated but not read frame by frame.
- **A held product is included in the person mask** (MediaPipe's accessories
  category). That is correct for occlusion, but it means `personPixelRatio`
  and the box move when the subject picks something up — vitasilk's range,
  0.346 to 0.498, is the widest of the five for that reason.
- `service/src/frames/segment.ts` imports `runSidecar` from
  `service/src/images/sidecar.ts`. That file was not modified. It is now
  shared by two stages and arguably belongs in `@framopia/core`; moving it was
  out of scope this session.

## Repo state

- Branch `main`, four commits ahead of the session start, nothing pushed.
- HEAD: `678e636 feat: add person segmentation to the cv sidecar`.
  Preceding: `4890640 feat: sample reel frames at 2 fps with real presentation
  timestamps`, `e8b4d53 chore: stop tracking compiled python bytecode`,
  `278dd93 docs: add block 4 handoff`.
- **`npm run check`: exit code 0, `check: PASS`.** core 121 tests / 5 files,
  service 520 / 36, benchmarks 166 / 16 — **807 TS tests**, up from 799.
  pytest **73 passed**, up from 58. Reference verification clean; both model
  pins verified ok.
- **Ledger `.local/costs.jsonl` byte-identical**: 105 entries,
  sha256 `a7e85e4bd5253bda8578aa008629c08a1726e145734ae04b16242f73fc64813d`
  at session start and end. `appendCost` was not reached; no Gemini or
  ElevenLabs call was made.
- No Edit Plan was read or written and no schema changed. No cache code was
  touched. Nothing under `.local/cache/` was read, written or evicted.

## Suggested next step

Decide the bounding-box rule before building zones, because the solver cannot
tell an over-wide box from a correct one: largest connected component, or a
minimum component size, or the union as it stands. The masks are on disk and
the comparison costs no inference.

Then compare the 0.5 threshold against 0.4 and 0.6 from the stored confidence
masks — also free — before zone computation hardens a threshold nobody chose,
and read the four unexamined contact sheets, since a mask defect is cheaper to
find now than through a mis-placed image in Block 8.
