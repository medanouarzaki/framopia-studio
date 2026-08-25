Status: OK

Block 5, session 3: the short-edge predicate, zones on the Edit Plan, and the
manual override round trip. No API call was made and nothing was billed. No
stop condition triggered.

## Done

### 0. Commit history reconciled

`git log --oneline 05f08f3..e6dc45f` gives **five** commits:

| sha | subject |
|---|---|
| `e6dc45f` | docs: record block 5 session 1 |
| `678e636` | feat: add person segmentation to the cv sidecar |
| `4890640` | feat: sample reel frames at 2 fps with real presentation timestamps |
| `e8b4d53` | chore: stop tracking compiled python bytecode |
| `278dd93` | docs: add block 4 handoff |

`git rev-list --count 05f08f3..e6dc45f` = 5. **Session 2 was right and session
1's report was wrong**, in a specific and structural way: session 1 reported
"four commits ahead" with HEAD `678e636` because it wrote its Repo state
section *before* committing itself. Its own `docs: record block 5 session 1`
commit (`e6dc45f`) is the fifth, and a report cannot name the commit that
contains it. The report was accurate at the instant it was written and stale
the moment it landed.

**Nothing was changed.** No rebase, no amend, no force. This is a read and a
statement. The general defect — a Repo state section that necessarily
predates its own commit — is unfixed and is on the open list below.

### 1. The short-edge measurement, then the constant

Measured first, from the zones derivable under the **old** `MIN_ZONE_AREA`
predicate. Frames are 2160x3840 source; the working masks are 540x960. `w` and
`h` are normalized against the frame; `px w`/`px h`/`short px` are **source
pixels**; `short/W` is the short edge normalized against **frame width**.

| reel | kind | w | h | area | px w | px h | short px | short/W |
|---|---|---|---|---|---|---|---|---|
| vitasilk | left | 0.0522 | 0.8000 | 0.0418 | 113 | 3072 | **113** | 0.0522 |
| test-3 | left | 0.1170 | 0.8000 | 0.0936 | 253 | 3072 | 253 | 0.1170 |
| ground-truth | right | 0.1319 | 0.8000 | 0.1055 | 285 | 3072 | 285 | 0.1319 |
| test-1 | right | 0.1596 | 0.8000 | 0.1277 | 345 | 3072 | 345 | 0.1596 |
| test-3 | right | 0.1652 | 0.8000 | 0.1321 | 357 | 3072 | 357 | 0.1652 |
| test-1 | left | 0.1689 | 0.8000 | 0.1351 | 365 | 3072 | 365 | 0.1689 |
| test-2 | right | 0.1837 | 0.8000 | 0.1470 | 397 | 3072 | 397 | 0.1837 |
| ground-truth | left | 0.2467 | 0.8000 | 0.1973 | 533 | 3072 | 533 | 0.2467 |
| test-2 | left | 0.2467 | 0.8000 | 0.1973 | 533 | 3072 | 533 | 0.2467 |
| vitasilk | top | 0.9400 | 0.1425 | 0.1340 | 2030 | 547 | 547 | 0.2533 |
| test-1 | top | 0.9400 | 0.2498 | 0.2348 | 2030 | 959 | 959 | 0.4441 |
| test-2 | top | 0.9400 | 0.2529 | 0.2377 | 2030 | 971 | 971 | 0.4496 |
| ground-truth | top | 0.9400 | 0.2612 | 0.2456 | 2030 | 1003 | 1003 | 0.4644 |
| test-3 | top | 0.9400 | 0.2998 | 0.2818 | 2030 | 1151 | 1151 | 0.5330 |

Distribution, source pixels: **min 113, median 465, p90 994, max 1151.** Full
sorted list: 113, 253, 285, 345, 357, 365, 397, 533, 533, 547, 959, 971, 1003,
1151.

**`MIN_ZONE_SHORT_EDGE = 0.15` of frame width = 324 px of 2160.** Declared in
`tools/cv/framopia_cv/zones.py`. **CHOSEN, NOT MEASURED.** The reason: 0.15 is
roughly a quarter of TEMPLATE_LIBRARY_GUIDE §3's 1200x1200 image comp working
size, below which a placed square reads as a stamp rather than a design
element. The guide states no minimum — comps are built big and scaled to the
zone — so no documented figure fixes this and the number is a product
judgement.

**`MIN_ZONE_AREA` is removed, not ANDed with it**, in one sentence: a 324x324
source-pixel region is area 0.0127 of the frame, *under* the old 0.03 floor,
and admitting exactly that region is the point of the change.

**Normalized units are anisotropic**, which the brief's phrase "frame-normalized
units" does not settle: `w` is a fraction of 2160 and `h` of 3840, so a bare
`min(w, h)` is wrong by 1.78x on one axis. The constant is therefore in units
of frame **width**, and `short_edge(rect, aspect)` converts `h` through the
aspect ratio. Stated here because it is a basis choice a reader could
otherwise get wrong.

**What the new predicate changes.** It is applied per frame *before* the
temporal reduction, so it re-cuts windows rather than only deleting zones:

| reel | under area 0.03 | under short edge 0.15 |
|---|---|---|
| test-1 | 3 zones, 64.56 s | unchanged |
| test-2 | 3 zones, 66.07 s | unchanged |
| test-3 | left 253 px, one window 21.02 s | left **449 px**, two windows (9.01 + 11.01 s) |
| ground-truth | right 285 px, one window 23.02 s | right **393 px** 13.51 s + **437 px** 8.51 s |
| vitasilk | left 113 px, one window 25.53 s | left **361 px**, one window **1.00 s** |

Removed that the old predicate kept: nothing outright, but three zones were
replaced by narrower-window, wider-rectangle versions. Added that the old
predicate did not have: two extra zones (test-3 left, ground-truth right), both
from window splits. **Every emitted zone now has a short edge of at least
345 px**, against 113 px before.

**vitasilk has one usable zone against five image slots.** Top for the whole
25.53 s, plus a left zone valid for 1.00 s — two samples, at 7.007-8.008 s.
Total valid seconds fall 51.05 → 26.53. Its plan carries 5 image slots.
**Session 4's solver must handle a reel with fewer zones than slots.** The
constant was not lowered to avoid this: the 113 px strip it removed is 5% of
the frame width and no square image fits it.

Per reel after the new predicate:

| reel | zones | top n / mean area / valid s | left | right | total valid s | wall clock |
|---|---|---|---|---|---|---|
| test-1 | 3 | 1 / 0.2348 / 21.52 | 1 / 0.1351 / 21.52 | 1 / 0.1277 / 21.52 | 64.56 | 0.4 s |
| test-2 | 3 | 1 / 0.2377 / 22.02 | 1 / 0.1973 / 22.02 | 1 / 0.1470 / 22.02 | 66.07 | 0.4 s |
| test-3 | 4 | 1 / 0.2818 / 21.02 | 2 / 0.1662 / 20.02 | 1 / 0.1321 / 21.02 | 62.06 | 0.3 s |
| ground-truth | 4 | 1 / 0.2456 / 23.02 | 1 / 0.1973 / 23.02 | 2 / 0.1536 / 22.02 | 68.07 | 0.4 s |
| vitasilk | 2 | 1 / 0.1340 / 25.53 | 1 / 0.1336 / 1.00 | 0 | 26.53 | 0.5 s |

**This is the first time the hysteresis reduction has opened and closed on real
footage.** Session 2 recorded it as live but unexercised — every reel gave one
unbroken window per kind. Under the new predicate a zone narrows below the
floor mid-reel and the window splits, on test-3 and ground-truth.

### 2. Zones on the Edit Plan

**The `zones` container already existed** — ARCHITECTURE §3 defines it,
`createEditPlan` writes `{ sampleFps: 2, zones: [] }`, and all five plans carry
it. What was added is **item** validation (`checkZones` in
`service/src/editplan/validate.ts`): id, kind, `manual`, a rect inside the
normalized frame with positive extent, and `[startS, endS]` windows, plus
duplicate-id detection. This cannot make an older plan unopenable because
there are no items in one to reject.

**Proven, not asserted.** After the change, all five plans reopened through
`readEditPlan`:

```
vitasilk:     OPENED  words=73 slots=5 keywords=3 groups=41 zones=0
test 1:       OPENED  words=67 slots=4 keywords=3 groups=38 zones=0
test 2:       OPENED  words=69 slots=0 keywords=0 groups=35 zones=0
test 3:       OPENED  words=58 slots=0 keywords=0 groups=30 zones=0
ground truth: OPENED  words=76 slots=0 keywords=0 groups=38 zones=0
```

**The writer** is `service/src/frames/plan-zones.ts`, driven by
`npm run zones -- --reel <label> --write-plan`. It reads through
`readEditPlan`, merges, and writes through `writeEditPlan`; it does **not**
route through any cache API.

Writing zones onto vitasilk changed exactly three top-level keys:

```
changed top-level keys: ['meta', 'pipeline', 'zones']
added keys: []  removed: []
meta.updatedAt:  2026-08-25T18:37:04.371Z -> 2026-08-25T23:42:54.480Z
pipeline.zones:  status pending -> done, costUsd null -> 0, cached null -> false
```

`schemaVersion`, `source`, `clientMode`, `transcript`, `subtitles`, `keywords`,
`images`, `sfx`, `watermark`, `costs` and `build` are byte-identical. All five
plans were written.

A second `--write-plan` run on vitasilk reported `keys changed [meta,
pipeline]` — the zones block came out byte-identical, which is the derivation's
determinism shown rather than claimed.

### 3. Manual zone round trip

`mergeZones` replaces the automatic zones and carries every `manual: true` one
across **by reference**, listing them first. A computed zone whose id a manual
zone claims is **dropped rather than renamed**, because the id is what the
panel and the solver refer to.

**Endpoints**, following the existing token-auth and `{ error }` conventions in
`service/src/server.ts`: `POST /zones/manual` with `{ planPath, zone }`, and
`DELETE /zones/manual?planPath=&zoneId=`. Both rewrite only the zones block and
`meta.updatedAt`. The set route forces `manual: true` whatever the caller sends.

**Round trip, run live against the service on vitasilk.** Before the
recomputation:

```
z_top_1        top    manual=false  valid [[0, 25.5255]]      w=0.94000
z_left_1       left   manual=false  valid [[7.007, 8.008]]    w=0.16704
z_manual_hero  right  manual=true   valid [[3, 12]]           w=0.34000
```

After `npm run zones -- --reel vitasilk --write-plan`
(`1 manual kept, 2 automatic written`):

```
z_manual_hero  right  manual=true   valid [[3, 12]]           w=0.34000
z_top_1        top    manual=false  valid [[0, 25.5255]]      w=0.94000
z_left_1       left   manual=false  valid [[7.007, 8.008]]    w=0.16704
```

`manual byte-identical: True`. The automatic zones were re-derived and
rewritten; the manual zone was not touched. Order changed — manual first, by
design.

Error paths exercised live: clearing a non-manual zone → `400 {"error":"zone
z_top_1 is not manual"}`; an out-of-frame rect → `400 {"error":"rect must lie
inside the normalized frame"}`; an unreadable plan → `404`; no token → `401`.
The test manual zone was then cleared, leaving vitasilk's plan with its two
automatic zones and no test residue.

A manual zone is deliberately allowed to break `MIN_ZONE_SHORT_EDGE`: the
predicate exists to stop the *derivation* offering an unusable rectangle, and
an editor who places one anyway has decided something the derivation cannot.

### 4. Debug output

`benchmarks/results/latest-zones/`, refreshed under the new predicate: per reel
a contact sheet, six close-ups, a validity timeline, and the new
`<reel>-shortedge.png` — one mid-reel frame with each zone's short edge drawn
as a dimension line with end caps and labelled in source pixels with a
pass/FAIL verdict, and the floor stated in the corner. Built by extending
`overlay.py` (`short_edge_render`, sidecar task `short_edge_overlay`), reusing
`tinted` and `ZONE_COLOURS` rather than a parallel compositor.

Read, not just generated. test-1's render shows left 365 px and right 345 px as
narrow but placeable strips against a 959 px top zone; vitasilk's shows only
the top zone active mid-reel, which is the one-zone finding visible rather than
tabulated.

`git check-ignore -v benchmarks/results/latest-zones/x.png` →
`.gitignore:10: benchmarks/results/`. **No rule added; the existing wholesale
ignore covers it.**

### 5. Tests

`tools/cv/tests/test_zones.py` — 35 tests, up from 29. New: the short edge
measured in units of frame width; width winning when it is the shorter side;
session 2's 0.052 x 0.800 sliver proven to pass a 0.03 area floor **and** fail
the new predicate; a square zone under the old area floor proven to pass the
new one; a rect **exactly at the constant** kept (`>=`), and one pixel narrower
discarded.

`service/src/frames/plan-zones.test.ts` — 16 tests: automatic zones replaced;
a manual zone carried through untouched and listed first; a computed zone
dropped on id collision; the manual flag forced; an out-of-frame rect refused;
clearing a non-manual zone refused; **clearing restoring automatic behaviour**
for that id; the writer changing only `meta`, `pipeline`, `zones` with every
other key byte-identical; a manual zone byte-identical across a recomputation
while the automatic one around it refreshes; the pipeline stage marked done at
zero cost; **a plan written before any zone item existed opening cleanly**; and
the validator rejecting an out-of-frame rect and duplicate ids.

**CLAUDE.md updated** in this session with the predicate, the corrected
`BOTTOM_EXCLUSION` reason, the plan writer, the manual-zone rule, the endpoints
and the numbers above.

### Rulings applied

- **`CLOSE_SAMPLES` stays 1.** The `close_samples=2` test is kept as
  documentation of the alternative. The comment now records the asymmetry as
  deliberately in the direction of not placing an image.
- **`BOTTOM_EXCLUSION`'s reason is corrected.** It was recorded as compensation
  for a mask that under-covers low-contrast fabric; session 2's measurement
  refuted that premise. The comment now says it is a product rule — no image is
  ever placed at the bottom of a 9:16 frame — and nothing else.

## Deviations

- **The brief's "frame-normalized units" is under-specified and I chose a
  basis.** Normalized units are anisotropic on a 9:16 frame, so "short edge in
  normalized units" has two incompatible readings. I implemented the constant
  in units of frame **width** and convert `h` through the aspect ratio, because
  the alternative silently mis-scales one axis by 1.78x. Flagged for a ruling
  only in the sense that the *basis* should be confirmed; the value 0.15 is
  independent of it once stated.
- **The `zones` block was already in the schema**, so goal 2's "schema
  addition" turned out to be item validation on an existing container rather
  than a new optional field. The stop condition was still checked as written
  and all five plans were proven to open.
- **One extra sidecar task**, `short_edge_overlay`, for goal 4's render. Same
  JSON contract; no pipeline stage calls it.
- **Zones were written to all five plans**, not only vitasilk and test-1. It is
  free and leaves the corpus consistent.
- The short-edge table in goal 1 was measured from zones derived under the old
  predicate, which is the only way to see what the new one changes.

## Failures and open problems

- **`MIN_ZONE_SHORT_EDGE = 0.15` is unmeasured and is the session's weakest
  number.** No documented minimum exists — TEMPLATE_LIBRARY_GUIDE §3 says comps
  are built at 1200x1200 and scaled to the zone, with no floor. The corpus
  separates one clear outlier at 113 px from a cluster at 253 px and up, so
  **any value in 0.06-0.11 would have removed only vitasilk's strip**, while
  0.15 also reshapes test-3's and ground-truth's side zones. Both are
  defensible; I took the stricter one because an unusable placement is a
  visible defect and four reels lose nothing by it. **This wants a ruling**,
  and the `-shortedge.png` renders exist so it can be made by eye.
- **vitasilk: one zone, five slots.** Reported, not solved. Whether the answer
  is fewer slots, overlapping placement in one zone, or a manual zone is
  session 4's and the user's.
- **The claim that a narrower zone reads as "a stamp" is a hypothesis, not a
  measurement.** Nobody has placed an image at 324 px in a 2160-wide frame and
  judged it. The renders show empty rectangles, not filled ones.
- **Zones still overlap each other** — top overlaps left and right in the frame
  corners by construction — and nothing in the output warns a consumer.
  Non-overlap is the solver's job per ARCHITECTURE §5.5.
- **The manual-zone path is proven for one zone on one plan.** Two manual zones
  on one plan, a manual zone whose id collides with a computed one, and a
  manual zone surviving several successive recomputations are covered by unit
  tests only, not live.
- **`writeZonesToPlan` reports changed keys by JSON string comparison**, so a
  key whose contents are reordered but equivalent would read as changed. It did
  not happen here; the method is a diff aid, not a guarantee.
- **A report's Repo state section necessarily predates its own commit**, which
  is exactly the defect goal 0 reconciled. Nothing has been done about it; the
  honest fix is to name the commits a session *will* make, or to stop quoting a
  HEAD sha in the report at all.
- `service/src/frames/zones.ts` and `segment.ts` both import `runSidecar` from
  `service/src/images/sidecar.ts`, untouched per the brief. The move to
  `@framopia/core` stays deferred and stays on this list.
- **`SOURCE_WIDTH`/`SOURCE_HEIGHT` are hardcoded at 2160x3840** in
  `zones.ts` for the short-edge render's labels. Every reel in the catalogue is
  that size, but a reel that is not would be labelled wrongly. The zone
  geometry itself is normalized and unaffected.

## Repo state

- Branch `main`. `origin/main` is at `e6dc45f`; four commits are local and
  unpushed (`20a1b96`, `3c17484` from session 2, and this session's two, plus
  the docs commit recorded below).
- HEAD: `04e7589 feat: persist zones onto the edit plan with manual override`,
  preceded by `f3b2e21 feat: bound zones by short edge instead of area`.
- **`npm run check`: exit code 0, `check: PASS`.** core 121 tests / 5 files,
  service 537 / 38, benchmarks 166 / 16 — **824 TS tests**, up from 811.
  pytest **108 passed**, up from 102. Reference verification clean; both model
  pins verified ok.
- **Ledger `.local/costs.jsonl` byte-identical**: 105 entries, sha256
  `a7e85e4bd5253bda8578aa008629c08a1726e145734ae04b16242f73fc64813d` at session
  start and end. `appendCost` was not reached; no Gemini or ElevenLabs call was
  made.
- **No mask, frame or user asset was modified.** Zero PNG files under
  `.local/cv/` carry a modification time from this session. The five Edit Plans
  were rewritten, by design, and are gitignored.
- No cache code was touched and nothing under `.local/cache/` was read, written
  or evicted. Neither `ultralytics` nor `torch` was installed.
- The placement solver, jitter and slot-to-zone assignment were not started.

## Suggested next step

Settle `MIN_ZONE_SHORT_EDGE` from the `-shortedge.png` renders — 0.15 as
implemented, or ~0.08 to remove only vitasilk's strip. It changes which zones
session 4's solver is offered on two of five reels, so it is cheaper to settle
before the solver than after.

Then decide what a reel with fewer zones than slots should do, because vitasilk
is that reel today and the solver will meet it immediately: drop slots, reuse a
zone across non-overlapping time windows, or require a manual zone.

