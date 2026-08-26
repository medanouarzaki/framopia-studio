Status: PROBLEM — test-1 slot img004 unplaceable

The solver is built, tested and green, and vitasilk places cleanly. `test-1`'s
last image slot cannot be placed under the constraints as written, so Block 5's
definition of done is **not met** and this is reported rather than worked
around. No API call was made and nothing was billed.

## Done

### 0. Housekeeping

Pushed to `origin/main` (`e6dc45f..90411c0`), fast-forward, no rebase or force.
**Five commits, not three** — session 3's three plus session 2's two
(`20a1b96`, `3c17484`), which had never been pushed. Session 3's report said so;
the brief's count of three was of session 3's own commits. Scanned for AI
attribution before pushing: none.

### 1. Zone geometry, reported before anything was built

Rects normalized against the frame; pixels are source-frame at 2160x3840. The
largest inscribable square is `min(w px, h px)`.

| reel | zone | kind | x | y | w | h | px rect (x, y, w, h) | square px | windows (s) |
|---|---|---|---|---|---|---|---|---|---|
| test-1 | z_top_1 | top | 0.0300 | 0.0000 | 0.9400 | 0.2498 | (65, 0, 2030, 959) | 959 | [0.000, 21.521] |
| test-1 | z_left_1 | left | 0.0000 | 0.0500 | 0.1689 | 0.8000 | (0, 192, 365, 3072) | 365 | [0.000, 21.521] |
| test-1 | z_right_1 | right | 0.8404 | 0.0500 | 0.1596 | 0.8000 | (1815, 192, 345, 3072) | 345 | [0.000, 21.521] |
| test-2 | z_top_1 | top | 0.0300 | 0.0000 | 0.9400 | 0.2529 | (65, 0, 2030, 971) | 971 | [0.000, 22.022] |
| test-2 | z_left_1 | left | 0.0000 | 0.0500 | 0.2467 | 0.8000 | (0, 192, 533, 3072) | 533 | [0.000, 22.022] |
| test-2 | z_right_1 | right | 0.8163 | 0.0500 | 0.1837 | 0.8000 | (1763, 192, 397, 3072) | 397 | [0.000, 22.022] |
| test-3 | z_top_1 | top | 0.0300 | 0.0000 | 0.9400 | 0.2998 | (65, 0, 2030, 1151) | 1151 | [0.000, 21.021] |
| test-3 | z_left_1 | left | 0.0000 | 0.0500 | 0.2078 | 0.8000 | (0, 192, 449, 3072) | 449 | [0.000, 9.009] |
| test-3 | z_left_2 | left | 0.0000 | 0.0500 | 0.2078 | 0.8000 | (0, 192, 449, 3072) | 449 | [10.010, 21.021] |
| test-3 | z_right_1 | right | 0.8348 | 0.0500 | 0.1652 | 0.8000 | (1803, 192, 357, 3072) | 357 | [0.000, 21.021] |
| ground-truth | z_top_1 | top | 0.0300 | 0.0000 | 0.9400 | 0.2612 | (65, 0, 2030, 1003) | 1003 | [0.000, 23.023] |
| ground-truth | z_left_1 | left | 0.0000 | 0.0500 | 0.2467 | 0.8000 | (0, 192, 533, 3072) | 533 | [0.000, 23.023] |
| ground-truth | z_right_1 | right | 0.8181 | 0.0500 | 0.1819 | 0.8000 | (1767, 192, 393, 3072) | 393 | [0.000, 13.514] |
| ground-truth | z_right_2 | right | 0.7978 | 0.0500 | 0.2022 | 0.8000 | (1723, 192, 437, 3072) | 437 | [14.514, 23.023] |
| **vitasilk** | **z_top_1** | **top** | **0.0300** | **0.0000** | **0.9400** | **0.1425** | **(65, 0, 2030, 547)** | **547** | **[0.000, 25.526]** |
| vitasilk | z_left_1 | left | 0.0000 | 0.0500 | 0.1670 | 0.8000 | (0, 192, 361, 3072) | 361 | [7.007, 8.008] |

**vitasilk's top zone is 547 px tall** and five slots depend on it — the number
the conversation was missing. Every side zone spans y 0.05-0.85, which
**intersects the subtitle band**, so its usable piece is the part above the band.

### 2. The solver

`service/src/placement/` — `constants.ts`, `geometry.ts`, `solve.ts`,
`plan-placement.ts`, `place-cli.ts`, driven by `npm run place`. Structure
follows `service/src/analysis/`: pure geometry separate from the solve, a
writer separate from both, a CLI on top.

Hard constraints, all enforced and all re-checked on the finished rect:
a validity window must **contain** the slot's whole span, not overlap it; no
intersection with `SUBTITLE_BAND`; nothing outside the frame or inside
`BOTTOM_EXCLUSION`; concurrent slots may not occupy intersecting rects; manual
zones are candidates like any other.

**`SUBTITLE_BAND` is declared once and is PROVISIONAL** — full width, 600 px
tall per TEMPLATE_LIBRARY_GUIDE §3's 2160x600 comps, centred at 0.75, so
normalized y **0.671875 to 0.828125**. **CHOSEN, NOT MEASURED.**

**Keywords need no separate exclusion on current evidence**, because keyword
templates place at the emphasized word's subtitle position
(TEMPLATE_LIBRARY_GUIDE §6). `KEYWORDS_ARE_INSIDE_SUBTITLE_BAND` records the
assumption in code. **A keyword template declaring an offset breaks it.**

**Determinism proven, not asserted.** Two `--dry-run` passes over vitasilk
produced byte-identical output, sha256 `e57df93a7adee74f…` both times. The seed
is `meta.id:slot.id`, driving a sha256 chain on the Block 3 `assign.ts`
precedent.

### 3. Card and cutout footprints

Not collapsed. A card is a framed image with a visible border, so it is inset
from the zone edge — a border touching the boundary reads as a second frame
cropped by the subject. A cutout's edge is the subject's own silhouette, meant
to sit against the background, so it takes no inset.

- `CARD_EDGE_CLEARANCE = 0.02` of frame width (43 px). **CHOSEN, NOT MEASURED.**
- `CUTOUT_EDGE_CLEARANCE = 0`.

Measured effect on vitasilk: the one cutout placed at **508 px** against cards
at 390-430 px in the same zone. A test asserts the usable square shrinks by
exactly twice the clearance on the binding axis.

**A slot whose presentation is null is treated as a card**, the more demanding
footprint: the gate sets presentation only when every candidate agrees, and
guessing the cheaper footprint would place a bordered image tight against a
zone edge. All four test-1 slots are in that state.

### 4. Jitter, and vitasilk

**Jitter cannot leave its region by construction.** The square's side is drawn
first (from `FILL_FRACTION` 0.88 ± `SCALE_JITTER` 0.08), then its position is
drawn from the travel that side leaves inside the safe region. There is nothing
to clamp. The result is re-validated anyway. A test drives **200 seeds** through
a zone sized to the minimum and asserts every rect stays inside its zone, the
frame, the band and the bottom exclusion.

vitasilk's five placements, all in `z_top_1`:

| slot | zone | presentation | pos x | pos y | scale | placed rect px |
|---|---|---|---|---|---|---|
| img001 | z_top_1 | card | 0.0521 | 0.0169 | 0.3580 | (113, 65) 430 sq |
| img002 | z_top_1 | cutout | 0.5766 | 0.0097 | 0.4230 | (1245, 37) 508 sq |
| img003 | z_top_1 | card | 0.6534 | 0.0128 | 0.3502 | (1411, 49) 420 sq |
| img004 | z_top_1 | card | 0.5541 | 0.0126 | 0.3375 | (1197, 48) 405 sq |
| img005 | z_top_1 | card | 0.1380 | 0.0119 | 0.3252 | (298, 46) 390 sq |

- **x spread 0.0521-0.6534** — 1299 px across the frame, real.
- **y spread 0.0097-0.0169 — 28 px, effectively none.** The zone is 547 px tall
  and the squares are 390-508 px, so there is almost no vertical travel. This is
  arithmetic, not a defect in the jitter.
- **scale spread 0.3252-0.4230**, the largest 30.1% bigger than the smallest.
- **Four of the ten pairs overlap spatially** (img001/img005, img002/img003,
  img002/img004, img003/img004). All four are non-concurrent, so all are legal.

Whether five images in one horizontal band reads as designed or as batched is
the user's eye on `benchmarks/results/latest-placement/vitasilk-overview.png`.
No zone was invented and no constraint relaxed to spread them further.

### 5. Placements on the plan

`ImageSlot.position` and `ImageSlot.scale` are **schema additions, optional with
a default**, validated only when present. Absent means the solver has not run,
which is not a placement at the origin.

**Proven, not asserted** — all five plans reopened after the change:

```
vitasilk:     OPENED words=73 slots=5 keywords=3 groups=41 zones=2 placed=0
test 1:       OPENED words=67 slots=4 keywords=3 groups=38 zones=3 placed=0
test 2:       OPENED words=69 slots=0 keywords=0 groups=35 zones=3 placed=0
test 3:       OPENED words=58 slots=0 keywords=0 groups=30 zones=4 placed=0
ground truth: OPENED words=76 slots=0 keywords=0 groups=38 zones=4 placed=0
```

Writing placements onto vitasilk:

```
changed top-level keys: ['meta', 'pipeline', 'images']
added: []  removed: []
per slot: keys changed ['zoneId']; added ['position', 'scale']   (all five)
```

`schemaVersion`, `source`, `clientMode`, `transcript`, `subtitles`, `keywords`,
`zones`, `sfx`, `watermark`, `costs` and `build` are byte-identical.
**test-1's plan is byte-identical** — the solver throws before writing, which a
test also pins.

A test parses `tools/cv/framopia_cv/zones.py` and fails if the mirrored
`BOTTOM_EXCLUSION` or `MIN_ZONE_SHORT_EDGE` drift from it.

### 6. Debug output

`benchmarks/results/latest-placement/`: `vitasilk-slot-img001..005.png` — the
sampled frame nearest each slot's midpoint, mask tinted, chosen zone outlined,
subtitle band hatched and labelled, placed square hatched and labelled with
slot id, scale and presentation — plus `vitasilk-overview.png` with all five
colour-coded on one frame. Built by extending `overlay.py`
(`placement_render`, `placement_overview`, sidecar task `placement_overlay`),
reusing `tinted` and `draw_zones`.

**No test-1 renders exist**, because the solve throws before reaching them.

`git check-ignore -v benchmarks/results/latest-placement/x.png` →
`.gitignore:10: benchmarks/results/`. **No rule added.**

### 7. Tests

`service/src/placement/solve.test.ts` (16) and `plan-placement.test.ts` (6):
a span no window contains failing loudly; a window that merely overlaps
rejected; no rect intersecting the subtitle band; nothing in the bottom
exclusion; a zone too small refused; **200 seeds on a minimum-sized zone all
inside every bound**; two time-overlapping slots forced into one zone rejected;
the fired/not-fired flag; byte-identical placements across two runs and
different placements for different plans; a plan without zones raising
`NoZonesError` naming `npm run zones`; card clearance shrinking the usable
square and a cutout placing larger than a card in the same zone; a null
presentation treated as a card; the writer changing only three top-level keys
and only `zoneId` on a slot; a plan without position or scale opening; the plan
untouched when a slot cannot be placed; and the two mirrored constants.

**CLAUDE.md updated** in this session.

## Deviations

- **The brief said "push the three session-3 commits"; five were unpushed.**
  Pushing `main` pushed all five. Nothing was reordered or dropped.
- **`--dry-run` was added to `npm run place`**, not asked for. It is how the
  geometry was gathered for this report without writing a plan, and how the
  determinism check ran twice without touching disk.
- **`MIN_PLACED_SHORT_EDGE` mirrors `MIN_ZONE_SHORT_EDGE`'s value but applies to
  the placed rect**, not the zone. The constant was not changed; where it is
  *applied* is a new decision this session had to make, and it is flagged below
  as needing a ruling.

## Failures and open problems

- **STOP CONDITION: `test-1` slot `img004` is unplaceable.** Span
  19.719-21.940 s; every test-1 zone window ends at 21.5215 s, the last sampled
  frame; the reel is 21.9886 s. The slot needs **0.4185 s past the last
  observation**, inside a **0.4671 s unobserved tail**. Session 2 recorded that
  a window ends at the last sample's timestamp and under-counts by about half a
  sample interval; this is the first time it has cost a placement. **Not worked
  around.** Three options, all the user's: sample the final frame, extend the
  last window by one sample interval, or shorten the slot. The first is the only
  one that adds evidence rather than assuming it.
- **The zone predicate and the placement footprint disagree about 0.15.**
  `MIN_ZONE_SHORT_EDGE` admits test-1's 345 px and 365 px side zones; after card
  clearance and the 0.88 fill, neither can hold a placed square of 0.15 frame
  width, so on a card they are not candidates. I applied the floor to the placed
  rect because that is what the constant's stated reason describes — the image a
  viewer sees. **This needs a ruling**, and it means the effective zone
  requirement is larger than the zone predicate states.
- **The time-overlap constraint never fired on real data.** Neither fixture has
  concurrent slots. Implemented and unit-tested; **not exercised in production**.
- **`SUBTITLE_BAND` is unmeasured** and every placement in this report is
  validated against a guess. If Block 6's real band sits higher, side-zone
  placements move; if it sits lower, nothing here changes, because every placed
  rect is in a top zone well above it.
- **`FILL_FRACTION`, `SCALE_JITTER` and both clearances are unmeasured.** The
  claim that 0.02 of frame width is enough clearance for a card border is a
  hypothesis: no card with a real border has been rendered.
- **vitasilk's vertical spread is 28 px and the horizontal spread comes from
  jitter alone.** Whether that reads as designed is unmeasured and is the
  question the overview render exists to answer. Four of ten pairs overlap
  spatially.
- **Only vitasilk has placements.** test-1 threw; test-2, test-3 and
  ground-truth carry zero image slots, so the solver has been exercised on one
  reel of five.
- **The overview render's labels collide** where rects overlap, so two of the
  five are partly unreadable. Cosmetic, unfixed.
- **`FRAME_WIDTH`/`FRAME_HEIGHT` are hardcoded at 2160x3840** in
  `placement/constants.ts`, duplicating `SOURCE_WIDTH`/`SOURCE_HEIGHT` in
  `frames/zones.ts`. Every reel is that size; a reel that is not would be
  mis-scaled. Not consolidated.
- `service/src/frames/segment.ts` and the placement CLI both reach
  `runSidecar` in `service/src/images/sidecar.ts`, untouched per the brief. The
  move to `@framopia/core` stays deferred and on this list, now wanted by four
  call sites.

## Repo state

- Branch `main`. `origin/main` is at `90411c0` after this session's push.
- **HEAD at the time of writing is
  `c257b3b feat: add the deterministic image placement solver`.** The commit
  recording this report follows it and cannot be named here.
- **`npm run check`: exit code 0, `check: PASS`.** core 121 tests / 5 files,
  service 559 / 40, benchmarks 166 / 16 — **846 TS tests**, up from 824. pytest
  **108 passed**, unchanged. Reference verification clean; both model pins ok.
- **Ledger `.local/costs.jsonl` byte-identical**: 105 entries, sha256
  `a7e85e4bd5253bda8578aa008629c08a1726e145734ae04b16242f73fc64813d` at session
  start and end. `appendCost` was not reached.
- **No mask, frame or user asset was modified.** Zero PNG files under
  `.local/cv/` carry a modification time from this session. Only vitasilk's plan
  was rewritten, and only `meta`, `pipeline` and `images` within it.
- No cache code was touched; nothing under `.local/cache/` was read, written or
  evicted. No segmentation model was installed. No frozen constant was changed.

## Suggested next step

Rule on `test-1` `img004`. Sampling the final frame of every reel is the only
option that adds evidence rather than assuming the tail; it is free and local
and would close the gap for any reel whose last slot runs to the end.

Then rule on where 0.15 applies — zone or placed rect — because it decides
whether a 345 px side zone is a placement target at all, and that changes how
much spread the solver has on every reel except vitasilk.

Both are cheap and both block the DoD, which is otherwise one reel away.
