Status: OK

Block 5, session 2: zone computation. No API call was made and nothing was
billed. No stop condition triggered.

## Done

**Housekeeping.** Session 1's commits pushed to `origin/main`
(`05f08f3..e6dc45f`), fast-forward, no rebase and no force. **Five commits, not
four** — the brief said four; `278dd93 docs: add block 4 handoff` was also
session 1's, so all five went. Commit authors and messages scanned for AI
attribution before pushing: none.

**`tools/cv/framopia_cv/zones.py`** — the whole derivation, pure and testable.
`load_mask`, `filter_components`, `component_report`, `free_rects`,
`hysteresis_windows`, `compute_zones`.

**Sidecar tasks added** to the existing `framopia_cv` package, following
`segment_person`'s request/response shape, lazy imports and stderr-only
logging: `compute_zones`, `component_stats`, `zone_overlay`,
`component_overlay`. No second sidecar; the JSON-in/JSON-out contract is
unchanged.

**Node side** — `service/src/frames/zones.ts`, `zones-cli.ts`,
`components-cli.ts`, registered as `npm run zones` and `npm run components`.

**Zones are derived from the mask, never from the bounding box**, as ruled.
Occupancy is read per row and per column over the span each zone actually
covers. `person_stats`' bbox is not an input.

**Constants, all CHOSEN, NOT MEASURED**, declared in `zones.py` with reasons:

| constant | value |
|---|---|
| `PERSON_COMPONENT_FLOOR` | 0.0001 of the frame |
| `ZONE_MARGIN` | 0.02 |
| `MIN_ZONE_AREA` | 0.03 |
| `BOTTOM_EXCLUSION` | 0.15 |
| `LATERAL_INSET` / `VERTICAL_INSET` | 0.03 / 0.05 |
| `OPEN_SAMPLES` / `CLOSE_SAMPLES` | 2 / 1 |

`PERSON_COMPONENT_FLOOR` is set from the corpus distribution below, but the cut
itself is a judgement and is labelled provisional.

### Component analysis (goal 1)

From the stored binary masks. No inference, no re-segmentation, and no mask on
disk was modified — verified: zero PNG files under `.local/cv/` have a
modification time in this session.

| reel | frames | cc=1 | cc=2 | cc=3 | cc 4-9 | cc>=10 | max cc | non-largest n | median | p90 | max |
|---|---|---|---|---|---|---|---|---|---|---|---|
| test-1 | 44 | 23 | 7 | 8 | 6 | 0 | 7 | 51 | 0.000014 | 0.000068 | 0.003669 |
| test-2 | 45 | 10 | 9 | 10 | 15 | 1 | 10 | 105 | 0.000017 | 0.000184 | 0.003056 |
| test-3 | 43 | 40 | 2 | 1 | 0 | 0 | 3 | 4 | 0.000016 | 0.000061 | 0.000077 |
| ground-truth | 47 | 11 | 13 | 10 | 13 | 0 | 6 | 83 | 0.000015 | 0.000220 | 0.000891 |
| vitasilk | 52 | 9 | 7 | 8 | 21 | 7 | 18 | 201 | 0.000015 | 0.000262 | 0.005833 |

Areas are fractions of the frame. Corpus-wide: 444 non-largest components,
median 0.000015, p90 0.000217, p99 0.002206, **max 0.005833**.

The distribution **decays smoothly from 1 px with no natural gap** — 64
components in 1-2 px, 95 in 2-4, down through 4 in 512-1024 px and 1 in
2048-4096 px. There is no histogram feature to cut on, so the floor is a
judgement, taken low per the asymmetric-bias ruling: 0.0001 of the frame is
52 px at 540x960, an order of magnitude under the smallest plausible fingertip
(~100 px) and two under the largest non-largest component in the corpus.

**Stop condition checked: no non-largest component anywhere reaches 1% of the
frame.** The maximum is 0.583%, and that one is *kept*, not dropped.

**The largest component the floor actually drops is `ground-truth` frame 29 at
0.000098 of the frame** (≈51 px).

### The floor's render (goal 2)

`benchmarks/results/latest-components/` — the twelve frames corpus-wide with
the largest dropped component, each component outlined and labelled with its
area fraction, dropped in red against kept in green, plus `components.json`.

**Read, not just generated.** Every dropped component in the worst-case frames
is a fragment at the very bottom edge of the frame — hem and shoe fragments the
matte caught separately from the body — and all of them sit inside
`BOTTOM_EXCLUSION` in any case. **No hand, finger or limb is dropped anywhere
in the corpus.** The floor is provisional but the render supports it.

### Zones (goal 3)

Output is ARCHITECTURE §3's shape: `{id, kind, rect{x,y,w,h}, valid, manual}`
normalized 0-1 against the mask's own dimensions, plus `sampleFps`. Validity
windows are cut on the manifest's real `timeS`, never on index/2.

**All five reels yield zones on every sample. Zero empty samples across 231
frames.** No stop condition triggered.

| reel | top count / area | left count / area | right count / area | valid s per zone | empty samples | wall clock |
|---|---|---|---|---|---|---|
| test-1 | 1 / 0.2348 | 1 / 0.1351 | 1 / 0.1277 | 21.52 | 0 of 44 | 0.4 s |
| test-2 | 1 / 0.2377 | 1 / 0.1973 | 1 / 0.1470 | 22.02 | 0 of 45 | 0.4 s |
| test-3 | 1 / 0.2818 | 1 / 0.0936 | 1 / 0.1321 | 21.02 | 0 of 43 | 0.3 s |
| ground-truth | 1 / 0.2456 | 1 / 0.1973 | 1 / 0.1055 | 23.02 | 0 of 47 | 0.4 s |
| vitasilk | 1 / 0.1340 | 1 / 0.0418 | 0 / — | 25.53 | 0 of 52 | 0.5 s |

Total valid seconds per reel: test-1 64.56, test-2 66.07, test-3 63.06,
ground-truth 69.07, vitasilk 51.05.

**`BOTTOM_EXCLUSION` removes 0.0% of total valid zone seconds on every reel.**
Measured against the identical derivation at `bottom_exclusion=0.0`: 69.07 /
64.56 / 66.07 / 63.06 / 51.05 in both configurations. It changes rectangle
heights, not whether a zone exists. The third stop condition is not triggered,
and the figure is measured rather than argued.

**Bottom-15% mask coverage, measured and not acted on:**

| reel | mean coverage, bottom 15% | mean coverage, rest | occupied rows, bottom 15% | occupied rows, rest | frames with <50% rows |
|---|---|---|---|---|---|
| test-1 | 0.4341 | 0.2302 | 1.0000 | 0.6799 | 0 |
| test-2 | 0.3189 | 0.2215 | 1.0000 | 0.6732 | 0 |
| test-3 | 0.4428 | 0.2264 | 1.0000 | 0.6204 | 0 |
| ground-truth | 0.2135 | 0.2062 | 0.8830 | 0.6657 | 1 |
| vitasilk | 0.6438 | 0.4189 | 0.9947 | 0.7192 | 0 |

Coverage in the band is **higher, not lower, than the rest of the frame on all
five reels**, and occupied rows there are 100% on four of five. The
under-covered dress is **one reel (`ground-truth`) and a few rows**, not a
corpus-wide gap. This does not argue against `BOTTOM_EXCLUSION`, which is a
ruling about where images may go; it does mean the defect that motivated it is
narrower than a single reel's contact sheet suggested.

### Debug output (goal 4)

`benchmarks/results/latest-zones/`, 40 files: per reel a
`<reel>-contactsheet.png` with every sampled frame, mask tinted as in session 1
and the zones active at that instant outlined and labelled by kind; six
`<reel>-frame-<index>.png` at full working resolution; and a
`<reel>-timeline.png` strip per kind with a seconds axis.

Built by extending `overlay.py` — `contact_sheet` and `close_ups` gained an
optional per-frame `zones` list, so `segment_overlay`'s behaviour is unchanged
and there is no parallel compositor. Rectangles are drawn at full frame size
before the cell is scaled down, so an outline does not become a hairline.

`git check-ignore -v` reports both new directories matched by
`.gitignore:10: benchmarks/results/`. **No rule was added; the existing
wholesale ignore already covers them.**

### Threshold sensitivity (goal 5)

Run last, one variable, from the stored confidence masks. Nothing else changed
and no default was altered.

| reel | zones 0.4/0.5/0.6 | mean rect area 0.4/0.5/0.6 (Δ vs 0.5) | total valid s 0.4/0.5/0.6 (Δ vs 0.5) |
|---|---|---|---|
| test-1 | 3/3/3 | 0.1651/0.1659/0.1664 (−0.5%, +0.3%) | 64.56/64.56/64.56 (0.0%, 0.0%) |
| test-2 | 3/3/3 | 0.1940/0.1940/0.1953 (0.0%, +0.7%) | 66.07/66.07/66.07 (0.0%, 0.0%) |
| test-3 | 3/3/3 | 0.1672/0.1692/0.1715 (−1.2%, +1.4%) | 63.06/63.06/63.06 (0.0%, 0.0%) |
| ground-truth | 3/3/3 | 0.1820/0.1828/0.1833 (−0.4%, +0.3%) | 69.07/69.07/69.07 (0.0%, 0.0%) |
| vitasilk | 2/2/2 | 0.0842/0.0879/0.0893 (−4.2%, +1.7%) | 51.05/51.05/51.05 (0.0%, 0.0%) |

**Zone count and total valid seconds are identical at all three thresholds on
all five reels.** Mean rect area moves by at most 4.2%, and that outlier is
vitasilk's thin left strip, where a small absolute change is a large relative
one. Plainly: on this corpus the threshold does not matter to whether a zone
exists or for how long, only marginally to how big it is.

**No recommendation is made and no default changed.**

Re-thresholding the confidence mask at 0.5 reproduces the stored binary masks
**exactly** — byte-identical zone output on all five reels — which validates
that the sweep varied only the threshold.

### Tests (goal 6)

`tools/cv/tests/test_zones.py`, 29 tests: component filtering with a component
**exactly at the floor** (kept, `>=`) and one pixel under it (dropped), and the
input mask proven unmutated; free-rectangle geometry against a constructed mask
whose occupied rows and columns are known by arithmetic; `BOTTOM_EXCLUSION`
clipping, including a mask whose only free space lies inside the excluded band
and therefore yields no zone, and one where a hem inside the band correctly
does **not** kill the left zone; hysteresis open and close on synthetic
sequences; a person filling the frame yielding zero zones without crashing;
normalized-coordinate invariance at 100x100 against 200x200; the ARCHITECTURE
§3 output shape; a missing mask as a named failure; and the constants echoed
with the result.

`service/src/frames/zones.test.ts`, 4 tests over `summariseZones` — the
function that produces this report's per-kind numbers.

**CLAUDE.md updated** in this session: the four new sidecar tasks, the two new
npm scripts, every constant with its reason, the mask-not-bbox ruling, the
MediaPipe freeze, and the numbers above.

## Deviations

- **The brief contradicts itself on hysteresis and I followed the ruling.**
  Goal 3 rules "OPENS after 2 consecutive samples… CLOSES after 1 sample";
  goal 6 asks for a test where "a single-sample dropout must NOT close a zone".
  Those cannot both hold. I implemented the goal-3 ruling (`CLOSE_SAMPLES = 1`)
  because it is stated as the binding mechanism, and wrote the test to assert
  what the code actually does — a single dropout **does** close the zone — plus
  a second test showing that `close_samples=2` makes a dropout survive, so the
  parameter is exercised in both modes. **This needs the user's ruling**, and
  nothing was silently chosen: if the intent was a dropout-tolerant close, the
  constant is one value.
- **Two sidecar tasks beyond `compute_zones`**: `component_stats` (goal 1's
  analysis needs scipy over the stored masks) and `component_overlay` /
  `zone_overlay` (goals 2 and 4's renders need PIL). All follow the same JSON
  contract; none is called by a pipeline stage.
- **`VERTICAL_INSET` is applied at both the top and the bottom of the side
  zones**, then clipped by `BOTTOM_EXCLUSION`, reading the brief's "frame
  height less vertical insets… clipped above BOTTOM_EXCLUSION". At the declared
  constants the exclusion (0.15) is the binding one, so this changes nothing
  today; it only matters if `BOTTOM_EXCLUSION` is ever reduced below 0.05.
- **Each zone carries exactly one validity window** and a second window becomes
  a second zone (`z_top_1`, `z_top_2`). ARCHITECTURE §3 types `valid` as a list
  on one zone, but the emitted rectangle is that window's intersection and two
  windows do not in general share a rectangle. The field stays a list, so the
  schema is honoured.
- Occupancy for each zone is read over the span that zone covers rather than
  the whole frame — see Done. A rectangle is free when nothing occupies *it*.

## Failures and open problems

- **The hysteresis reduction is live but unexercised on real input.** Every one
  of the five reels produced a single unbroken window per zone kind: the
  footage is a fixed camera on one speaker, and no zone ever dropped out. The
  open and close paths are covered only by synthetic unit tests. **A reel with
  movement would be the first real test of the mechanism**, and this corpus
  cannot provide one.
- **`MIN_ZONE_AREA` does not capture usability.** vitasilk's left zone is
  0.052 wide by 0.800 tall: area 0.042, comfortably over the 0.03 floor, and
  a strip no square image fits. Area alone admits slivers. A minimum dimension
  or an aspect bound is missing. **Not fixed here** — the constants are not to
  be tuned this session — and it will bite the solver.
- **Zones overlap each other.** Top overlaps left and right in the frame
  corners, by construction. They are independent candidates and non-overlap is
  the solver's job per ARCHITECTURE §5.5, but nothing in this session's output
  warns a consumer of it.
- **The component floor is provisional.** The render supports it on twelve
  worst-case frames; it has not been checked against a reel where a hand
  separates from the body, which this corpus does not contain.
- **The `free_rects` branch for a frame with nobody in the side band is
  untested on real data** and splits the strip arbitrarily at x=0.5. It cannot
  fire on this corpus, where every frame has a subject.
- **The bottom-15% measurement is a description, not an explanation.** That
  coverage is higher in the band than elsewhere is measured; *why*
  `ground-truth` alone under-covers there is a hypothesis (low-contrast pale
  fabric against a pale floor) and has not been measured.
- **Wall clock is not a like-for-like comparison across reels** — it includes
  process start and mask decode, and the reels differ in frame count.
- `service/src/frames/zones.ts` and `segment.ts` both import `runSidecar` from
  `service/src/images/sidecar.ts`. That file was not modified, per the brief;
  the move to `@framopia/core` stays on the known-issues list and is now wanted
  by three call sites rather than two.

## Repo state

- Branch `main`. `origin/main` was advanced to `e6dc45f` by this session's
  push; two further commits are local and unpushed.
- HEAD: `20a1b96 feat: derive negative-space zones from person masks`,
  followed by the docs commit recorded below.
- **`npm run check`: exit code 0, `check: PASS`.** core 121 tests / 5 files,
  service 524 / 37, benchmarks 166 / 16 — **811 TS tests**, up from 807.
  pytest **102 passed**, up from 73. Reference verification clean; both model
  pins verified ok (`birefnet-general`, `selfie-multiclass-256x256`).
- **Ledger `.local/costs.jsonl` byte-identical**: 105 entries, sha256
  `a7e85e4bd5253bda8578aa008629c08a1726e145734ae04b16242f73fc64813d` at session
  start and end. `appendCost` was not reached; no Gemini or ElevenLabs call was
  made.
- **No mask, frame or user asset was modified.** Zero PNG files under
  `.local/cv/` carry a modification time from this session; the only new files
  there are `zones.json` per reel.
- No Edit Plan was read or written and no schema changed. No cache code was
  touched and nothing under `.local/cache/` was read, written or evicted.
  Neither `ultralytics` nor `torch` was installed; the venv gained nothing.

## Suggested next step

Get the hysteresis ruling settled — `CLOSE_SAMPLES` is 1 or 2 and the brief
asked for both — before the solver is built on top of validity windows that
may be cut differently.

Then give `MIN_ZONE_AREA` a companion minimum dimension, because vitasilk's
0.052-wide left zone will otherwise be offered to the solver as a real
placement and is the first thing that will produce an unusable composition.

The solver itself is the next block of work, and it needs one thing this corpus
cannot give: a reel where the subject moves enough to close a zone.
