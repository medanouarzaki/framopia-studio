Status: OK

Final-frame sampling, the top-zone diagnosis, maximal free rectangles, and head
masks. No API call was made and nothing was billed. No stop condition fired.

## Done

### 0. Housekeeping

**Two commits** were unpushed (`c257b3b`, `5258088`); both pushed to
`origin/main` (`90411c0..5258088`), fast-forward, no rebase or force. Scanned
for AI attribution first: none.

### 1. Final-frame sampling

`service/src/frames/sample.ts` appends each reel's last decodable frame outside
the 2 fps grid, flagged `final: true`, with `hasFinalFrame` on the manifest.

It is found by seeking one second from the end (`-sseof -1 -copyts`) and
decoding, not by trusting a container's frame count: the question is which
frame actually decodes. `-copyts` keeps the timestamp absolute so it is
comparable with the grid's. The file is named **`frame-final.png`, never
numbered** — a stale numbered file would be swept into the `frame-NNNN.png`
grid list and desynchronise showinfo's timestamps from the files they describe.
A final frame within `FINAL_FRAME_EPSILON_S` (1/60 s) of the last grid sample
is that sample and is not appended.

| reel | grid frames | last grid | final frame | gap closed | duration | tail left |
|---|---|---|---|---|---|---|
| test-1 | 44 | 21.5215 | 21.9553 | 0.4338 | 21.9886 | 0.0334 |
| test-2 | 45 | 22.0220 | 22.2889 | 0.2669 | 22.3223 | 0.0334 |
| test-3 | 43 | 21.0210 | 21.1545 | 0.1335 | 21.1878 | 0.0334 |
| ground-truth | 47 | 23.0230 | 23.2232 | 0.2002 | 23.2566 | 0.0334 |
| vitasilk | 52 | 25.5255 | 25.6590 | 0.1335 | 25.6923 | 0.0334 |

The 0.0334 s remaining is one frame at 29.97 fps — the final frame's own
duration — so nothing is left unobserved.

**test-1 `img004` spans 19.719-21.940 s and the last observation is now
21.9553 s, so its span is contained.** The new last window end for test-1's top
zone is 21.955 s and the slot places.

**The 231 pre-existing frames are byte-identical after the `--force`
resample**, hashed before and after. Five final frames were added.

**Fixed-interval assumptions, every place checked** — only one did arithmetic
on the interval:

| place | verdict |
|---|---|
| `sample.ts` nominal fallback `index / SAMPLE_FPS` | **the only arithmetic use**; the final frame is appended after the map and never takes it |
| `zones.py hysteresis_windows` | uses the supplied timestamps only |
| `zones.py compute_zones` / `frame_rectangles` | per frame, no interval |
| `segment-cli.ts` | pairs by array position with a length check |
| `zones.ts maskFramesFor` | pairs by position with an explicit length check |
| `place-cli.ts nearest()` | compares absolute times |
| `overlay.py evenly_spaced` / `close_ups` | positional, no time |
| `plan-zones.ts`, editplan `zones.sampleFps` | metadata carried onto the plan, never used for arithmetic |
| `zone_overlay` timeline | uses reel duration and window times |

### 2. Diagnosis, before any geometry changed

**Both hypotheses hold, and (a) is decisive for vitasilk.**

(a) Per-frame top-rectangle height against the emitted intersection, source px:

| reel | frames | min | median | p90 | max | emitted | median − min |
|---|---|---|---|---|---|---|---|
| test-1 | 45 | 959 | 971 | 971 | 983 | 959 | 12 |
| test-2 | 46 | 971 | 987 | 1003 | 1003 | 971 | 16 |
| test-3 | 44 | 1151 | 1165 | 1167 | 1171 | 1151 | 14 |
| ground-truth | 48 | 1003 | 1015 | 1019 | 1031 | 1003 | 12 |
| **vitasilk** | 53 | **547** | **879** | 970 | 1015 | **547** | **332** |

**One frame — index 14 at 7.007 s, 547 px — governs vitasilk's whole 25.53 s
window**, while 34 of 53 frames exceed 800 px and only 5 sit within 50 px of the
minimum. On the other four reels intersection costs 12-16 px, nothing.

(b) Free area captured by the three fixed rectangles, median frame:

| reel | free area | coverage | top | left | right |
|---|---|---|---|---|---|
| test-1 | 0.6567 | 0.8202 | 0.3626 | 0.2933 | 0.2955 |
| test-2 | 0.6652 | 0.8064 | 0.3668 | 0.3229 | 0.2472 |
| test-3 | 0.6606 | 0.8067 | 0.4287 | 0.2736 | 0.2445 |
| ground-truth | 0.6715 | 0.7599 | 0.3663 | 0.2934 | 0.2162 |
| **vitasilk** | 0.5044 | **0.5830** | 0.4702 | 0.1351 | **0.0000** |

The three kinds capture 76-82% of free area on four reels and **58% on
vitasilk**, whose right rectangle captures nothing.

### 3. Maximal free rectangles

`tools/cv/framopia_cv/rects.py`, wired as `compute_zones`'s default method;
`--method three` keeps the old decomposition selectable because every Block 5
figure before this session was measured with it.

**Method: largest-rectangle-under-histogram with a monotonic stack per row**,
objective changed from area to `min(width, height)`. Chosen because the working
grid is isotropic (540x960 for 2160x3840 is a quarter on both axes) so the
smaller side in cells *is* the inscribable square, and area would reward a long
thin strip no square image fits. Extraction is greedy — take the best, mark it
occupied, repeat — because enumerating every maximal rectangle returns
quadratically many overlapping candidates needing their own selection rule,
while greedy extraction is deterministic and yields non-overlapping rectangles a
solver can use directly.

`kind` is now **a label derived from position**: `top` above the person's
topmost row, `left`/`right` beside the columns the person occupies **within the
rectangle's own rows** — which is what puts the beside-the-head region on a side
instead of nowhere. **A rectangle fitting none returns None and is dropped; no
fourth enum value was invented.** If one were needed the honest name would be
`between` — a gap enclosed by the subject on both sides, such as between a
raised arm and the torso — and it is a session-6 decision.

**New constants, all CHOSEN, NOT MEASURED**: `GRID_DOWNSAMPLE = 4` (a cell is
16 source px, well under ZONE_MARGIN's 43; coarsening max-pools so it can only
shrink a free region), `MAX_ZONES_PER_FRAME = 4`, `MATCH_MIN_IOU = 0.5`.

**The matching rule is a new decision.** The fixed kinds matched implicitly — a
frame's top rectangle was obviously the previous frame's top rectangle.
Rectangles found by position carry no identity, so a rectangle joins the track
of the same kind whose last rectangle it overlaps most by intersection over
union, above `MATCH_MIN_IOU`; one matching nothing starts a new track.
Hysteresis then runs per track exactly as before.

BOTTOM_EXCLUSION, ZONE_MARGIN, MIN_ZONE_SHORT_EDGE, PERSON_COMPONENT_FLOOR and
the hysteresis constants are unchanged. ZONE_MARGIN is applied as a dilation of
the subject — clearance from the person is the same requirement whatever shape
the free region takes.

| reel | method | zones | largest square px | total valid s | coverage |
|---|---|---|---|---|---|
| test-1 | three | 3 | 959 | 65.87 | 0.8202 |
| test-1 | maximal | **18** | 959 | **79.31** | 0.5357 |
| test-2 | three | 3 | 971 | 66.87 | 0.8064 |
| test-2 | maximal | **19** | **1023** | **76.14** | 0.5941 |
| test-3 | three | 4 | 1151 | 62.46 | 0.8067 |
| test-3 | maximal | **7** | **1184** | **78.61** | 0.6735 |
| ground-truth | three | 4 | 1003 | 68.67 | 0.7599 |
| ground-truth | maximal | **7** | **1007** | **90.39** | 0.5730 |
| vitasilk | three | 2 | 547 | 26.66 | 0.4702 |
| vitasilk | maximal | **20** | **816** | **83.12** | **0.6563** |

**Zone count rose on every reel**, so the stop condition did not fire.
**vitasilk's largest square goes 547 → 816 px** and **test-1's side zones go
345/365 px → 624-656 px**, because a maximal rectangle is bounded by the person
only where it actually sits rather than by the widest point of the arms over the
whole frame height.

**Coverage fell on four of five reels, and that is reported rather than
hidden.** The old side rectangles spanned the full frame height and counted a
great deal of area they could never hold a square in; the new ones are capped at
`MAX_ZONES_PER_FRAME` and do not overlap each other. Coverage was a diagnostic
for goal 2, not the objective — the objective is a large square valid for long
enough to hold a slot — but **whether 4 rectangles per frame is the right cap is
unmeasured** and is the obvious lever if coverage turns out to matter.

Wall clock rose from ~0.2 s to ~2.0 s per reel; still free and local.

### 4. Head masks, data only

`segment_person` writes `<stem>-head.png` — hair plus face skin (categories 1
and 3), 8-bit confidence — for all 236 frames. **No torso zone, no new zone
kind, no placement change, no schema change from this goal.**

**Existing masks were never rewritten.** `_write_or_verify` compares an
existing mask against the model's fresh output and writes only new files, so
byte-identity is guaranteed by construction rather than by determinism holding.
**All 462 pre-existing masks are byte-identical, and all 472 decoded
comparisons matched**, which re-verifies session 1's determinism claim without
risking the evidence.

| reel | head/frame min | median | max | head/person median | bottom y min | median | max |
|---|---|---|---|---|---|---|---|
| test-1 | 0.0190 | 0.0211 | 0.0224 | 0.0810 | 0.4104 | 0.4146 | 0.4208 |
| test-2 | 0.0165 | 0.0200 | 0.0220 | 0.0845 | 0.4042 | 0.4156 | 0.4229 |
| test-3 | 0.0249 | 0.0295 | 0.0315 | 0.1144 | 0.5073 | 0.5177 | 0.5240 |
| ground-truth | 0.0149 | 0.0170 | 0.0179 | 0.0819 | 0.4073 | 0.4125 | 0.4167 |
| vitasilk | 0.0701 | 0.0893 | 0.1018 | 0.1962 | 0.5854 | 0.6583 | **0.8510** |

The bottom edge is the upper bound of any future torso zone. **vitasilk's
reaches 0.851 on one frame** — long hair over the shoulders — leaving essentially
nothing between it and `BOTTOM_EXCLUSION` at 0.85. **A torso zone on vitasilk may
not exist at all**, and session 6 should expect that.

Head/person ratio is reported because a raw frame ratio is not a thinness test:
a subject further from camera has a smaller head without the mask being thin.
The minimum head/person ratio per reel is 0.065-0.160, with no outlier.

**Checked by eye**, not only by number:
`benchmarks/results/latest-head/<reel>-contactsheet.png` tints the head
distinctly from the body. On ground-truth (48 frames) and vitasilk (53 frames)
hair, face and glasses are fully covered on every frame, with no thin or partial
head. **The other three sheets were generated but not read frame by frame.**

### 5. Zones and placement re-derived

All five reels re-derived under the maximal method and written to their plans;
`benchmarks/results/latest-zones/` refreshed (60 files). **All five plans
reopen**: vitasilk 73 words / 5 slots / 20 zones / 5 placed; test-1 67 / 4 / 18
/ 4 placed; test-2 69 / 0 / 19; test-3 58 / 0 / 7; ground-truth 76 / 0 / 7.

**vitasilk — five slots now spread across four zones** (was all five in one):

| slot | zone | presentation | position | scale | placed px |
|---|---|---|---|---|---|
| img001 | z_left_4 | card | (0.0202, 0.3325) | 0.2933 | (44, 1277) 352 sq |
| img002 | z_left_2 | cutout | (0.0840, 0.0641) | 0.6184 | (181, 246) 742 sq |
| img003 | z_left_4 | card | (0.0712, 0.3292) | 0.2869 | (154, 1264) 344 sq |
| img004 | z_left_3 | card | (0.1118, 0.0634) | 0.5343 | (242, 243) 641 sq |
| img005 | z_top_4 | card | (0.6170, 0.0122) | 0.4472 | (1333, 47) 537 sq |

**test-1 — all four place, `img004` included:**

| slot | zone | position | scale | placed px |
|---|---|---|---|---|
| img001 | z_top_1 | (0.5548, 0.0358) | 0.6605 | (1198, 138) 793 sq |
| img002 | z_top_2 | (0.0578, 0.0486) | 0.6323 | (125, 187) 759 sq |
| img003 | z_left_4 | (0.0567, 0.2899) | 0.4065 | (122, 1113) 488 sq |
| img004 | z_top_1 | (0.5809, 0.0127) | 0.5976 | (1255, 49) 717 sq |

The time-overlap constraint fired on neither reel. Sizes rose from 390-508 px
(vitasilk) and a single zone (test-1) to 344-742 px across four zones and
488-793 px across three.

### 6. Tests

`tools/cv/tests/test_rects.py` (15): coarsening only ever shrinks a free
region; an empty frame is one rectangle and a full-frame subject none; the
objective is the inscribable square and not area; extraction is greedy and
non-overlapping; **a plus-shaped occupancy where the three-kind method's side
rectangle is provably narrower than the region beside the head**; kind labelling
above, beside, and the None case; IoU; and the matching rule on a synthetic
sequence — **a drifting rectangle stays one zone, a jumping one becomes two**.

`tools/cv/tests/test_segment_person.py` gained 4: head is hair plus face skin
and nothing else on a constructed six-category output; the bottom edge is the
last row holding a head pixel; a frame with no head reports no bottom edge; and
**an existing mask is verified and never rewritten**, with a changed value
reported as a mismatch rather than overwritten.

`service/src/frames/sample.test.ts` gained 5: the final frame flagged; a real
timestamp past the last grid sample and inside the reel; **the interval before
it shorter than 1/SAMPLE_FPS**; exactly one frame flagged; and the final frame
excluded from the numbered grid filter.

**CLAUDE.md updated** in this session.

## Deviations

- **The brief said "push any unpushed commits" without a count; there were
  two.** Reported rather than assumed.
- **Segmentation was re-run over all 236 frames, not only the 5 appended
  ones.** Goal 4 needs head masks for every frame, which requires the model on
  every frame. The safety the brief wanted is stronger than it asked for:
  existing masks are not rewritten at all, so byte-identity holds by
  construction.
- **The three-kind frame insets are applied after labelling, as a clip.** They
  were kind-specific — the top rectangle inset laterally, the sides vertically —
  and a generalized search has no kind until the rectangle exists. Clipping
  rather than shrinking, so a rectangle already clear of the border is not made
  smaller for nothing. `LATERAL_INSET` and `VERTICAL_INSET` are unchanged.
- **A `head_overlay` sidecar task was added** for goal 4's contact sheet, and
  `--method` added to `npm run zones`. Neither was named in the brief.
- **`emptySamples` reads "0 of 0" under the maximal method**, which does not
  emit a `perFrame` array. The number is meaningless rather than wrong, and is
  on the open list.

## Failures and open problems

- **The new decomposition fragments tracks.** test-1 goes 3 → 18 zones and
  vitasilk 2 → 20, from 6 and 10 tracks respectively. Many windows are 0.5-1.0 s
  — long enough for nothing. The cause is a hypothesis, not a measurement: a
  rectangle that momentarily fails `MIN_ZONE_SHORT_EDGE` or drops below
  `MATCH_MIN_IOU` closes its track, and close-after-one reopens it as a new
  zone. **Not measured, and I did not tune `MATCH_MIN_IOU` to reduce it.**
- **Free-area coverage fell on four of five reels** (0.82 → 0.54 on test-1).
  Explained above as an artefact of comparing overlapping full-height
  rectangles against capped non-overlapping ones — **that explanation is a
  hypothesis**; the measurement that would settle it is coverage as a function
  of `MAX_ZONES_PER_FRAME`, which was not run.
- **`MAX_ZONES_PER_FRAME = 4`, `MATCH_MIN_IOU = 0.5` and `GRID_DOWNSAMPLE = 4`
  are unmeasured**, in those words. No sweep was run on any of them.
- **20 zones on a plan is untested downstream.** The solver handles it, but the
  panel, the buildability checks and the eventual builder have never seen more
  than 4.
- **Three head contact sheets were generated but not read frame by frame**
  (test-1, test-2, test-3). Their numbers show no outlier, but under-covering a
  head is the dangerous direction and only two reels were actually looked at.
- **The `between` case is dropped silently in count.** Rectangles that fit no
  kind are skipped and not counted, so nothing reports how much area is being
  lost that way. That count should exist before session 6 decides on a fourth
  enum value.
- **The old `perFrame` output is gone under the maximal method**, so the zone
  contact sheets draw zones by validity window rather than by per-frame
  rectangle. Nothing checks that the drawn zone was actually free in that exact
  frame any more.
- **No reel was re-checked for whether the final frame changes a zone's
  geometry adversely.** The final frame is 0.13-0.43 s past the last grid
  sample and is a real observation, but if the subject moves in that interval it
  can only shrink an intersected rectangle.
- `service/src/frames/segment.ts` still imports `runSidecar` from
  `service/src/images/sidecar.ts`; the move to `@framopia/core` stays deferred
  and on this list.

## Repo state

- Branch `main`. `origin/main` is at `5258088` after this session's push; three
  commits are local and unpushed.
- **HEAD at the time of writing is
  `4663493 feat: find maximal free rectangles instead of three fixed kinds`**,
  preceded by `4f5e2d6 feat: write a head mask alongside the person mask` and
  `c78228b feat: sample each reel's final decodable frame`. **The commit
  recording this report follows HEAD and cannot be named here.**
- **`npm run check`: exit code 0, `check: PASS`.** core 121 tests / 5 files,
  service 564 / 40, benchmarks 166 / 16 — **851 TS tests**, up from 846. pytest
  **127 passed**, up from 108. Reference verification clean; both model pins ok.
- **Ledger `.local/costs.jsonl` byte-identical**: 105 entries, sha256
  `a7e85e4bd5253bda8578aa008629c08a1726e145734ae04b16242f73fc64813d` at session
  start and end. `appendCost` was not reached.
- **231 pre-existing frames byte-identical; 462 pre-existing masks
  byte-identical.** 5 final frames and 236 head masks added. Nothing deleted.
- All five Edit Plans rewritten (zones and placements) and all five reopen. No
  cache code touched, nothing under `.local/cache/` read, written or evicted. No
  segmentation model installed. No frozen constant changed.
- `git check-ignore -v` confirms `benchmarks/results/` covers
  `latest-head/` and `latest-placement/`; **no rule was added.**

## Suggested next step

Measure the fragmentation before building the torso zone. Zone counts of 18-20
with many sub-second windows are the one thing this session made worse, and the
lever — `MATCH_MIN_IOU`, or merging tracks whose rectangles are near-identical
across a gap — should be chosen from a measurement rather than from the same
kind of causal story goal 2 was written to prevent.

Then the torso zone, with vitasilk's head bottom edge at 0.851 as the case that
decides whether it can exist at all on a reel with long hair.
