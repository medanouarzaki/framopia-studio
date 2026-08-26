Status: OK

Torso zones, the solver ranking that governs them, and Block 5's definition of
done. No API call was made and nothing was billed. No stop condition fired.

## Done

### 0. Housekeeping

**Four commits** were unpushed (`c78228b`, `4f5e2d6`, `4663493`, `371557a`);
all pushed to `origin/main` (`5258088..371557a`), fast-forward, no rebase or
force. Scanned for AI attribution first: none.

### 1. Torso zones

`tools/cv/framopia_cv/zones.py` — `head_bottom_y`, `torso_rect`, and torso
rectangles fed through the existing per-frame → IoU matching → hysteresis
machinery.

A torso zone is bounded **above** by the lowest head pixel at
`HEAD_THRESHOLD` plus `HEAD_CLEARANCE`, **below** by whichever of
`BOTTOM_EXCLUSION` (0.85) and `SUBTITLE_BAND` (0.671875) sits higher in the
frame — the band — and **laterally by where the body IS**. I took the
**narrow** side of that boundary: the person's own column extent within the
zone's rows, intersected across the window by the same machinery. A rectangle
inside the body on every frame reads as placed on the speaker; one overhanging
the background reads as a mistake.

**Ruling 3 is enforced as a property, not a mechanism.** A frame whose head
drops lower either shrinks its window's intersected rectangle or fails the IoU
match and splits the window in two. Both satisfy the ruling; what never happens
is an emitted rectangle overlapping a head pixel on a frame it claims. A test
asserts exactly that, over every zone and every frame in its window. **My first
draft of the docstring claimed the intersection always does it — that was
wrong, a test caught it, and the docstring is corrected.**

**New constants, both CHOSEN, NOT MEASURED**: `HEAD_THRESHOLD = 0.25`,
`HEAD_CLEARANCE = 0.04` of frame width (86 px, twice `ZONE_MARGIN`).

**`SUBTITLE_BAND` is passed into the sidecar rather than mirrored**, honouring
session 4's ruling that it is declared once in
`service/src/placement/constants.ts`. Without it no torso zone is derived, and
a test pins that.

**The enum widening.** `kind` gains `torso`. A widening cannot be
optional-with-default the way a new field can, so **all five plans were
reopened**:

```
vitasilk:     OPENED words=73 slots=5 zones=20 kinds=left/right/top placed=5
test 1:       OPENED words=67 slots=4 zones=18 kinds=left/right/top placed=4
test 2:       OPENED words=69 slots=0 zones=19 kinds=left/top       placed=0
test 3:       OPENED words=58 slots=0 zones=7  kinds=left/right/top placed=0
ground truth: OPENED words=76 slots=0 zones=7  kinds=left/top       placed=0
```

**The widening had a second home I nearly missed**: `assertPlaceable` in
`plan-zones.ts` carried its own hardcoded `['top','left','right']` and rejected
a manual torso zone with a 400 until it was pointed at `ZONE_KINDS`. Found by
running the round trip, not by reading.

| reel | torso? | longest window rect (normalized) | (source px) | window | largest square | bounded by |
|---|---|---|---|---|---|---|
| ground-truth | yes, 4 | (0.3444, 0.4381, 0.3889, 0.2337) | (744, 1682, 840, 898) | [4.505, 9.009] 4.50 s | 840 px | frame 17, 8.508 s, head y 0.4156 |
| test-1 | yes, 6 | (0.2963, 0.4413, 0.4333, 0.2306) | (640, 1694, 936, 886) | [11.511, 16.016] 4.50 s | 886 px | frame 32, 16.016 s, head y 0.4188 |
| test-2 | yes, 10 | (0.3259, 0.4965, 0.4167, 0.1754) | (704, 1906, 900, 674) | [0.000, 5.005] 5.00 s | 674 px | frame 1, 0.500 s, head y 0.4740 |
| test-3 | yes, 9 | (0.2537, 0.5465, 0.5167, 0.1254) | (548, 2098, 1116, 482) | [8.008, 12.012] 4.00 s | 482 px | frame 19, 9.509 s, head y 0.5240 |
| **vitasilk** | **no** | — | — | — | — | — |

Largest square across all of a reel's torso zones: ground-truth 872, test-1
894, test-2 894, test-3 514 px.

**vitasilk gets no torso zone, and that is correct.** Its head mask reaches
y **0.9510** at frame 12 (6.006 s) — long hair over the shoulders — against a
lower bound of 0.6719. **48 of its 53 frames have a head that alone blocks the
entire band.** Nothing was relaxed.

**What `HEAD_THRESHOLD = 0.25` costs, measured against 0.5:**

| reel | thr | zones | largest square px | total valid s | longest window s |
|---|---|---|---|---|---|
| ground-truth | 0.25 | 4 | 872 | 13.71 | 4.50 |
| ground-truth | 0.5 | 1 | 812 | 23.22 | 23.22 |
| test-1 | 0.25 | 6 | 894 | 9.94 | 4.50 |
| test-1 | 0.5 | 1 | 878 | 21.96 | 21.96 |
| test-2 | 0.25 | 10 | 894 | 12.78 | 5.00 |
| test-2 | 0.5 | 1 | 844 | 22.29 | 22.29 |
| test-3 | 0.25 | 9 | 514 | 12.15 | 4.00 |
| test-3 | 0.5 | 1 | 482 | 21.15 | 21.15 |
| vitasilk | either | 0 | 0 | 0.00 | 0.00 |

**It does not cost rect size — the largest square is 3-7% *larger* at 0.25 on
every reel.** What it costs is **contiguity**: a single 21-23 s window becomes
4-10 windows totalling 10-14 s, longest 4-5 s. The cause is a hypothesis, not a
measurement: a larger head mask has a more variable bottom edge, so rectangles
vary more and the IoU match breaks more often. **The constant was not changed
on this number**, per ruling 4.

I first reported this as a "total area" figure, which was wrong — summing
overlapping fragments made 0.25 look 300-870% *larger*. The figures above are
the corrected comparison.

### 2. Torso placement rules

- **`TORSO_ZONE_IS_LAST_RESORT = true`** (`service/src/placement/constants.ts`).
  Torso zones are tried only after every background zone that fits.
  **Unmeasured design choice.** Reason: PROJECT_SPEC §4 and ARCHITECTURE §5.5
  both place images in negative space, and taking the departure only when
  negative space does not serve keeps default behaviour closest to the spec.
  Implemented in the candidate ordering, not configurable.
- **Cutout versus card over a body is undecided, and the solver is
  indifferent**: with torso zones last-resort a slot only reaches one when
  nothing else fits, so refusing it there on presentation grounds would leave
  the slot unplaced. **What would decide it** is the user's eye on a built comp
  in Block 7, with a cutout and a card over the same torso.
  `TORSO_PRESENTATION_IS_UNDECIDED` records that in code.

### 3. Debug renders

`benchmarks/results/latest-torso/`, 39 files: per reel a contact sheet with the
head tinted, the torso zone outlined in its own colour, and both the subtitle
band and the bottom exclusion drawn; six evenly spaced full-resolution frames;
and **the bounding frame rendered separately and named**
`<reel>-bounding-frame-<index>.png`, because that one frame governs the whole
window. Built by extending `overlay.py` (`torso_render`,
`torso_contact_sheet`, sidecar task `torso_overlay`), reusing `head_tinted`,
`draw_zones` and `_draw_band`.

`torso` was added to `ZONE_COLOURS` because it defaulted to white, the same
colour as the subtitle band drawn alongside it.

Read, not just generated: `test-1-bounding-frame-3.png` shows the torso
rectangle on the chest and midriff with clear separation below the head tint,
above the subtitle band, and inside the body laterally.

`git check-ignore -v benchmarks/results/latest-torso/x.png` →
`.gitignore:10: benchmarks/results/`. **No rule added.**

### 4. Re-solve and fragmentation's cost

**vitasilk: 5 of 5 placed. test-1: 4 of 4 placed.**

| reel | slot | zone | kind | presentation | position | scale | placed px | candidates |
|---|---|---|---|---|---|---|---|---|
| vitasilk | img001 | z_left_4 | left | card | (0.0202, 0.3325) | 0.2933 | (44, 1277) 352 sq | 3 |
| vitasilk | img002 | z_left_2 | left | cutout | (0.0840, 0.0641) | 0.6184 | (181, 246) 742 sq | 2 |
| vitasilk | img003 | z_left_4 | left | card | (0.0712, 0.3292) | 0.2869 | (154, 1264) 344 sq | 2 |
| vitasilk | img004 | z_left_3 | left | card | (0.1118, 0.0634) | 0.5343 | (242, 243) 641 sq | 3 |
| vitasilk | img005 | z_top_4 | top | card | (0.6170, 0.0122) | 0.4472 | (1333, 47) 537 sq | 3 |
| test-1 | img001 | z_top_1 | top | card | (0.5548, 0.0358) | 0.6605 | (1198, 138) 793 sq | 2 |
| test-1 | img002 | z_top_2 | top | card | (0.0578, 0.0486) | 0.6323 | (125, 187) 759 sq | 2 |
| test-1 | img003 | z_left_4 | left | card | (0.0567, 0.2899) | 0.4065 | (122, 1113) 488 sq | 2 |
| test-1 | img004 | z_top_1 | top | card | (0.5809, 0.0127) | 0.5976 | (1255, 49) 717 sq | 4 |

**Every slot on both fixtures had more than one candidate zone** — 5 of 5 and
4 of 4. **Fragmentation costs no choice for background zones.**

**It costs every torso placement.** test-1 has 6 torso zones and **not one has
a window containing a slot's full span**: its longest is [11.511, 16.016] while
img003 runs 10.939-12.539. **Zero of the nine placements use a torso zone**, so
the torso placement path is implemented, unit-tested, and **unexercised on real
data**.

**vitasilk's spread against session 4**, which is what the rework was for:

| | session 4 | now |
|---|---|---|
| x spread | 1299 px | 1289 px |
| **y spread** | **28 px** | **1230 px** (44x) |
| **scale spread** | **30.1%** | **115.5%** |

**Every spatial overlap found is non-concurrent and therefore legal**:
vitasilk img001/img003 and img002/img004; test-1 img001/img004. **Zero
concurrent overlaps.**

### 5. Block 5 definition of done

| item | verdict | evidence |
|---|---|---|
| on real footage, computed zones visibly avoid the speaker | **yes** | the user reviewed the reworked zone renders and the head contact sheets on all five reels this conversation and approved both (ruling 1) |
| the solver places all fixture slots without overlaps | **yes** | vitasilk 5/5, test-1 4/4; three spatial overlaps, all between non-concurrent slots, zero between concurrent ones |
| manual override round-trips | **yes** | a `torso`-kind manual zone set through `POST /zones/manual`, survived recomputation **byte-identical**, listed first, with 24 automatic zones refreshed around it, then cleared with a 200 |

Manual round trip, before and after `npm run zones -- --reel test-1
--write-plan` (`1 manual kept, 24 automatic written`):

```
BEFORE: [{"id":"z_manual_torso","kind":"torso","rect":{"x":0.28,"y":0.46,"w":0.44,"h":0.2},
          "valid":[[2,20]],"manual":true}]   automatic: 24
AFTER:  [{"id":"z_manual_torso","kind":"torso","rect":{"x":0.28,"y":0.46,"w":0.44,"h":0.2},
          "valid":[[2,20]],"manual":true}]   automatic: 24
manual byte-identical: True     first zone in the block: z_manual_torso
```

With the manual torso zone present and containing img002's and img003's spans,
**placement was unchanged** — which is `TORSO_ZONE_IS_LAST_RESORT` working.

### 6. Tests

`tools/cv/tests/test_torso.py` (14): the head bottom is the row below the last
head pixel; no head has no bottom; **0.25 includes a soft edge that 0.5
excludes entirely**, and a soft fringe moves the bound from 400 to 470; the top
edge is head bottom plus clearance; the bottom edge is whichever bound sits
higher; lateral bounds come from the body; **a head reaching past the bound, a
head below the bottom exclusion, no head at all, and a body absent from the
torso rows each yield no zone**; **no emitted zone contains a frame whose head
intrudes**; a reel whose head always blocks gets nothing; and no subtitle band
means no torso zone.

`service/src/placement/solve.test.ts` (+5): a torso zone is a candidate; it is
tried only after a background zone that also fits; it *is* used when the
background zone does not contain the span; it honours every hard constraint;
a manual torso zone is a candidate.

`service/src/frames/plan-zones.test.ts` (+4): the validator accepts `torso`; a
plan of only pre-widening kinds still opens; a manual torso zone stays
byte-identical across a recomputation; `setManualZone` accepts `torso` and
forces the flag.

**CLAUDE.md updated** in this session, including that Block 5 is complete.

## Deviations

- **The brief said "push any unpushed commits" without a count; there were
  four.** Reported rather than assumed.
- **`assertPlaceable` in `plan-zones.ts` was widened too.** The brief named the
  enum in `types.ts`; a second hardcoded list existed and would have made
  torso manual zones unsettable. Found live, not by reading.
- **`torso` was added to `ZONE_COLOURS`** so the render does not draw it in the
  same white as the subtitle band. Not asked for; the render was illegible
  otherwise.
- **A `torso_overlay` sidecar task was added** for goal 3. Same JSON contract.
- **My first threshold-cost measurement was wrong** and is corrected above:
  summing the areas of overlapping fragments made 0.25 look far larger than
  0.5, when what actually changes is contiguity.

## Failures and open problems

This is the block's last session, so this list is exhaustive rather than tidy.

**Every unmeasured constant in Block 5**, all labelled unmeasured in code:

| constant | value | where |
|---|---|---|
| `PERSON_COMPONENT_FLOOR` | 0.0001 of frame | `zones.py` — distribution-informed, cut chosen |
| `ZONE_MARGIN` | 0.02 of frame width | `zones.py` |
| `MIN_ZONE_SHORT_EDGE` | 0.15 of frame width | `zones.py` — the narrower 0.06-0.11 reading was never ruled out |
| `BOTTOM_EXCLUSION` | 0.15 | `zones.py` — a product rule, not a measurement |
| `LATERAL_INSET` / `VERTICAL_INSET` | 0.03 / 0.05 | `zones.py` |
| `OPEN_SAMPLES` / `CLOSE_SAMPLES` | 2 / 1 | `zones.py` |
| `HEAD_THRESHOLD` | 0.25 | `zones.py` — cost measured, value not fitted |
| `HEAD_CLEARANCE` | 0.04 of frame width | `zones.py` |
| `GRID_DOWNSAMPLE` | 4 | `rects.py` |
| `MAX_ZONES_PER_FRAME` | 4 | `rects.py` — never swept |
| `MATCH_MIN_IOU` | 0.5 | `rects.py` — never swept |
| `SUBTITLE_BAND` | y 0.6719-0.8281 | `placement/constants.ts` — **provisional, no document states it** |
| `CARD_EDGE_CLEARANCE` / `CUTOUT_EDGE_CLEARANCE` | 0.02 / 0 | `placement/constants.ts` |
| `FILL_FRACTION` / `SCALE_JITTER` | 0.88 / 0.08 | `placement/constants.ts` |
| `MIN_PLACED_SHORT_EDGE` | 0.15 of frame width | `placement/constants.ts` |
| `TORSO_ZONE_IS_LAST_RESORT` | true | `placement/constants.ts` |
| `FINAL_FRAME_EPSILON_S` | 1/60 s | `sample.ts` |

**Code paths never exercised on real data:**

- **Torso placement.** Zero of nine fixture placements use a torso zone. The
  ranking, the geometry and the constraints are unit-tested only.
- **The time-overlap constraint.** Neither fixture has concurrent slots, so it
  has never fired outside tests, across three sessions.
- **The `between` case.** Rectangles fitting no kind are dropped and **not
  counted**, so nothing reports how much area is lost that way.
- **The `nominal` timestamp fallback** in `sample.ts` has never fired.
- **The no-person branch** in the segmenter and the "nobody in the side band"
  branch in `free_rects` cannot fire on this corpus.
- **`hasFinalFrame: false`** — no reel's final frame landed on the grid, so the
  dedupe branch is untested on real input.
- **A manual zone that collides with a computed id**, and **two manual zones on
  one plan**, are unit-tested only.
- **`presentation: null`** is the state of all four test-1 slots, so the
  "candidates disagree" path from Block 4 is still untested on real data.

**Claims resting on one reel or one observation:**

- **vitasilk is the only reel with generated candidates** and the only one
  whose slots carry a presentation. Everything about cutout-versus-card
  footprint rests on its single cutout.
- **test-1 is the only reel besides vitasilk with image slots**; test-2,
  test-3 and ground-truth carry zones and no slots, so the solver has run on
  two reels of five.
- **The whole corpus is five reels, two speakers, fixed camera, one framing.**
  Every zone finding may be an artefact of that.
- **Segmentation determinism is measured on one machine.** Block 10's golden
  run on a second machine has never been attempted.
- **Head coverage was read frame by frame on ground-truth and vitasilk only**
  by me; the user reports having reviewed all five (ruling 1).

**Known defects and open questions:**

- **Fragmentation.** vitasilk 2→20 zones, test-1 3→24. Harmless for background
  placement, fatal for torso placement. The cause — IoU matching breaking on
  rectangle variation — is a **hypothesis**, not measured.
- **`emptySamples` reads "0 of 0"** under the maximal method, which emits no
  `perFrame` array. The number is meaningless, and with it the zone contact
  sheets no longer verify that a drawn zone was free in that exact frame.
- **The zone predicate and the placement footprint disagree about 0.15**
  (session 3), unresolved by ruling and still true.
- **20-29 zones on a plan is untested downstream** — the panel, the
  buildability checks and the builder have never seen more than four.
- **`FRAME_WIDTH`/`FRAME_HEIGHT` are hardcoded 2160x3840** in
  `placement/constants.ts`, duplicating `SOURCE_WIDTH`/`SOURCE_HEIGHT` in
  `frames/zones.ts`. Every reel is that size; one that is not would be
  mis-scaled.
- **A report's Repo state necessarily predates its own commit.** Unfixed across
  the block; handled by stating it.
- `service/src/frames/segment.ts` and the placement CLI still import
  `runSidecar` from `service/src/images/sidecar.ts`. The move to
  `@framopia/core` was deferred every session and is now wanted by five call
  sites.

## Repo state

- Branch `main`. `origin/main` is at `371557a` after this session's push; three
  commits are local and unpushed.
- **HEAD at the time of writing is
  `8a6816e feat: render torso zones with their bounding frame`**, preceded by
  `c69c8b4 feat: rank torso zones as a last resort in the solver` and
  `8ba01ea feat: derive torso zones over the speaker's body`. **The commit
  recording this report follows HEAD and cannot be named here.**
- **`npm run check`: exit code 0, `check: PASS`.** core 121 tests / 5 files,
  service 573 / 40, benchmarks 166 / 16 — **860 TS tests**, up from 851. pytest
  **141 passed**, up from 127. Reference verification clean; both model pins ok.
- **Ledger `.local/costs.jsonl` byte-identical**: 105 entries, sha256
  `a7e85e4bd5253bda8578aa008629c08a1726e145734ae04b16242f73fc64813d` at session
  start and end. `appendCost` was not reached.
- **All 944 frames and masks byte-identical**, none added, none removed. Five
  Edit Plans rewritten (zones and placements) and all five reopen.
- No cache code touched, nothing under `.local/cache/` read, written or
  evicted. No segmentation model installed. No frozen constant changed.

## Suggested next step

Block 6 is templates, and the one thing it must carry forward is
`SUBTITLE_BAND`: it is provisional, no document states it, and every placement
in this block was validated against a guess. Replacing it with the real value
once the subtitle comps exist is one edit in one file, and it should be the
first thing Block 6 does rather than the last.

Then decide whether torso zones are worth keeping. They exist on four reels and
have never been used, because fragmentation leaves no window long enough to
contain a slot. Either the matching rule needs measuring — the lever nobody has
swept — or torso zones are a feature that only pays off on footage this corpus
does not contain.
