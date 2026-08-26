Status: OK

The band was re-measured from the glyphs the orthography can actually produce.
It shrank by 1.50% and **recovered nothing** — no reel gets a usable torso zone
back, on any honest reading. It was landed anyway because it is better founded.
No API call was made and nothing was billed.

## Done

**Session-start checks.** T7 mounted, repo at
`/Volumes/T7 Shield/INSEA/Projects/framopia-studio`. `git status
--untracked-files=no` empty. Ledger sha256
`a7e85e4bd5253bda8578aa008629c08a1726e145734ae04b16242f73fc64813d`,
**105 lines**. Session 3's four commits were still local and were **pushed**:
`origin/main` went `c70a7b9` → `429f23d`.

### Goal 1 — the real character repertoire

`benchmarks/RESULTS-block6-band-repertoire.md` §1. Derived from the five Edit
Plans (non-removed word text) plus the four `.local/ground-truth/*.txt`
references — nine sources, **81 distinct characters**.

**Latin, 52:** `' 0 1 2 3 4 5 6 7 8 9 ? A B D E F K L M N P R S T V W a b c d
e f g h i j k l m n o p q r s t u v w y z`

**Arabic, 26:** `؟ إ ئ ا ب ة ت ج ح خ د ر ز ش ض ط ع ف ق ك ل م ن ه و ي`

**Accented, 2:** `è` (U+00E8, vitasilk), `é` (U+00E9, ground-truth, test-1,
test-2).

**No Arabic diacritic appears anywhere.** Zero characters in U+064B–U+0652 or
U+0670 across all nine sources — no fatha, damma, kasra, sukun, shadda or
tanwin. Exactly what ORTHOGRAPHY_GUIDE §1 predicts, permitting full
vocalization only for religious quotations, of which the corpus has none.

**Nothing unexpected.** The apostrophe is U+0027 straight throughout — Block 3
session 2's curly-apostrophe fix has held. One space character, U+0020, no
non-breaking space. **No Arabic presentation forms** in the stored text: the
plans hold base codepoints and leave positional shaping to the renderer.

**Caveat, and it is a real one: five reels, one client, one domain, two
speakers.** The Arabic set is missing eleven letters that plainly can occur —
`س ث ذ ص ظ غ أ آ ؤ ى ء`. This is why goal 2 does not measure from the corpus.

### Goal 2 — real ink extents

Glyph bounding boxes read through a pen (composites resolve), from
`~/Library/Fonts/Inter-VariableFont_opsz,wght.ttf` instantiated at `wght=600`
and `~/Library/Fonts/Almarai-Bold.ttf`. **Not OS/2 values.**

**Only default-on layout features are followed** — `ccmp locl rlig liga clig
calt kern mark mkmk init medi fina isol curs rvrn rclt`. Stylistic sets,
`salt`, `zero`, `titl` and the `cvNN` alternates are excluded because After
Effects does not enable them. This mattered: with all features retained,
Inter's extremes landed on `zero.slash.circled` at 2144/−654, a glyph nothing
will ever draw.

| font | size px | tallest | ascent px | deepest | descent px |
|---|---|---|---|---|---|
| Inter Semi-Bold | 343 | `bar` 1970 | 329.90 | `bar` −480 | 80.39 |
| Inter Semi-Bold | 425 | `bar` 1970 | 408.81 | `bar` −480 | 99.61 |
| Almarai Bold | 367.01 | `uniFDF2` 1100 | 403.71 | `uniFEF2` −427 | 156.71 |
| **Almarai Bold** | **454.75** | **`uniFDF2` 1100** | **500.23** | **`uniFEF2` −427** | **194.18** |

Against session 3's usWin: Almarai ascent **−8 units**, descent **−26**; Inter
ascent −299, descent −180. **Inter's large shrink changes nothing** — Almarai
is the taller face at every size and sets the band alone.

**The margin.** The measured set is deliberately wider than the corpus: every
unvocalized Arabic letter U+0621–U+064A in all four positional forms, Arabic
punctuation `؟ ، ؛`, printable ASCII, and §5's accented French set. **The
widening is the margin**, and stated as a figure it is **+300 Almarai ascent
units over corpus-only, 800 → 1100, a 37.5% increase**. **No further numeric
pad was added**, because a number on top of a set that already covers every
permitted glyph would have no evidence behind it. `uniFDF2` is ﷲ, built by
`rlig` from لله; the corpus contains no such sequence (checked directly) but
§6(b) permits religious formulas, so it is carried.

**Vocalization cannot exceed the envelope**, resolved from the font rather than
assumed. The harakat outlines top at **747** (U+0670) and bottom at −312
(U+064D); Almarai's GPOS has 25 `MarkBasePos` subtables whose highest base
anchor is **407** against a highest mark anchor of **390**, so an attached
mark's ink top is bounded by 407 + (747 − 390) = **764**, against an
unvocalized maximum of 1100.

### Goal 3 — the comparison

`benchmarks/RESULTS-block6-band-repertoire.md`, written before anything was
landed.

```
top    = 2480.4 − 500.2250        = 1980.1750 px
bottom = 2480.4 + 323 + 194.1782  = 2997.5783 px
```

| | session 3 (usWin) | candidate | difference |
|---|---|---|---|
| top px | 1976.5370 | **1980.1750** | **3.64 px lower** |
| bottom px | 3009.4017 | **2997.5783** | **11.82 px higher** |
| height px | 1032.8647 | **1017.4033** | **15.46 px shorter (1.50%)** |
| y | 0.5147231771 | **0.5156705729** | |
| h | 0.2689751953 | **0.2649487630** | |

**Torso recovery — no, on every reel.** Placed-square size after card
clearance, `FILL_FRACTION` and `SCALE_JITTER`, against `MIN_PLACED_SHORT_EDGE`
of 324 px:

| reel | session 3 | candidate | usable? |
|---|---|---|---|
| ground-truth | 168.5 | **171.5** | no |
| test-1 | 158.8 | **161.7** | no |
| test-2 | −12.8 | **−9.9** | no |
| test-3 | gone | **gone** | no |

The candidate buys 2.9–3.0 px where 162–324 px are missing. Two more
aggressive readings also fail on all four reels: dropping the Allah ligature
(ascent 997, best reel 209.4) and corpus-only (800, best reel 281.9) — and the
latter would require asserting the orthography can never produce a religious
formula, contradicting §6(b).

**Why the band was never the cause.** For test-1's torso to hold the minimum
square it needs 486.6 px of height, so the band top must sit at ≤ **2180.6
px**, implying a maximum ascent of 299.8 px — **659 Almarai units against the
font's real 1100**. No honest measurement of this font at this size reaches it.
The torso strip was closed by where the subtitle baseline sits, not by how
generously its extent was estimated.

### Goal 4 — landed, and the corpus refreshed

The candidate is smaller, so `SUBTITLE_BAND` was replaced.
`service/src/placement/constants.ts` carries **all three values it has ever
held** — provisional, usWin, repertoire — with the reason each was superseded.
`core/src/typography.ts` `FONT_METRICS` now holds Inter 1970/480 and Almarai
1100/427, with the full provenance and the method's exclusions in the comment.

**No placement moved.** vitasilk 5/5 and test-1 4/4 re-solved onto Block 5
session 6's positions and scales — the third consecutive session in which the
band moved and nothing followed it. **No slot became unplaceable.**

**`npm run zones --all --write-plan` refreshed all five reels**, which session
3 flagged as stale and did not do. **Torso zones went to zero on every reel** —
predicted by the arithmetic above and then confirmed by re-deriving:

| reel | zones before | after | torso before | after |
|---|---|---|---|---|
| ground-truth | 11 | 7 | 4 | **0** |
| test-1 | 24 | 18 | 6 | **0** |
| test-2 | 29 | 19 | 10 | **0** |
| test-3 | 16 | 7 | 9 | **0** |
| vitasilk | 20 | 20 | 0 | 0 |

**29 torso zones across four reels are gone.** vitasilk never had one.

**`npm run place` was run again after the zone refresh**, not only before,
because placements reference zone ids and the zone set had just changed. Output
identical both times; the background zone ids did not renumber.

Plan hashes, session start → session end:

| plan | start | end |
|---|---|---|
| ground truth | `41ee41d61ace4586af9f813da4531634f729b679917d0debb187898fcc3e936d` | `cb7598e8e34ecc71e0d8564ef2297a1e0978292aad577fd13c83c7f10a0d0a6e` |
| test 1 | `a1b7a0adb4eed72d590c207ed4d1f9ff43230dbc47dcee908c2ccf3e78645622` | `a816fb6e4320cc06563bd9e36f05e318f24e66523d155acfa563c504cf715877` |
| test 2 | `414b3b6fea51e8e6a9d39d45303b99688f6618b823992f46b2c4d52c1889c453` | `46efd359ba4e8f2c023da3da243cff04e3a740168da6a26201c6f2cbc4c29c0d` |
| test 3 | `6b10c2c5ebe3f154e7c165291f9022f745fd23e4b9d855fe5bd939662c252e04` | `033ca520dee05cd70402a73c50f577ed2fbae47bf55a2668012dcedc9599bc45` |
| vitasilk | `7bfa3ff8d0d3f688315ed89ad3e758bf22e96144c86a10ec6f551b8a5cdc5064` | `90f1a7fce12ce6f2ff2649a6840acc9393ffd92287cfc90c7f8ca73dc37b4bdb` |

All five changed: four gained a rewritten `zones` block, and vitasilk's zones
came back identical so only `meta`/`pipeline` moved on it.

### Goal 5 — the overlays

Regenerated by the existing `placement_overlay` sidecar task; no new rendering
was written.

- `benchmarks/results/latest-placement/vitasilk-overview.png`
- `benchmarks/results/latest-placement/test-1-overview.png`

Nine per-slot renders alongside them (`<reel>-slot-<slotId>.png`). I looked at
the test-1 overview: the band sits where the arithmetic puts it and every
placed square is clear above it. **The only band caption reads "subtitle band
(measured)"**, which is true of the value now in the constant; the string was
grepped for `provisional`, `chosen` and `estimate` and none remain.

## Deviations

- **`npm run place` was run four times**, twice before the zone refresh and
  twice after. The goals list place before zones, but placements carry zone
  ids and the zone set changed underneath them, so leaving the earlier solve in
  place would have left the plans internally inconsistent. Output was identical
  every time.
- **`npm run zones` was run with `--write-plan`.** Without it nothing reaches
  the plan and the before/after hashes the goal asks for would all be
  unchanged.
- **`uharfbuzz` was not installed** to shape the real strings. The CV venv is
  pinned by `requirements.txt` and its pytest suite runs inside `npm run
  check`; perturbing it for one measurement was not worth it. GSUB closure over
  the repertoire is used instead, which is a superset of what shaping would
  produce and therefore conservative in the right direction.

## Failures and open problems

- **The torso capability is gone and no measurement will bring it back.** This
  session's whole purpose was to test whether the usWin band was the cause, and
  it was not. 29 torso zones are now 0. The kind is still valid in the schema
  and in `assertPlaceable`, so a **manual** torso zone still works, but nothing
  derives one. Recovering it automatically needs a product decision, not a
  better number: move the anchor, reduce the keyword size, lower
  `MIN_PLACED_SHORT_EDGE` for torso zones specifically, or allow an image to
  overlap the band at moments when no subtitle is on screen. **The timing data
  to evaluate that last option already exists on the plans.**

- **GSUB closure is not shaping, and the difference is not measured.** Closure
  asks which glyphs are *reachable* from a character set; shaping asks which
  are *produced* by a string. Closure is a superset, so the band cannot be too
  small on this account — but the Allah ligature is in the measured set purely
  because ل and ه are, and it sets Almarai's ascent. **The band's top is
  therefore governed by a glyph the corpus has never produced.** That is the
  conservative choice and §6(b) justifies it, but it should be named rather
  than buried: without it the band top would be 2027.01 instead of 1980.18.

- **Mark positioning is bounded, not simulated.** The 764 figure is an upper
  bound built from the highest base anchor and the highest mark anchor, which
  need not belong to the same attachment. It is comfortably under 1100 so the
  conclusion holds with room, but it is not a rendered measurement.

- **The `bar` glyph sets Inter's extremes** (1970/−480) and is almost certainly
  never rendered. It costs nothing today because Almarai binds in both
  directions, but if the Latin face ever became the constraint that figure
  would be carrying a pipe character nobody types.

- **`EXTRA_LINES_RENDER_BELOW` is still an assumption** and still unconfirmed
  by the user. It is unchanged from session 3 and still moves the band by 323
  px if wrong — far more than everything measured this session.

- **`npm run place` writes only `meta`/`pipeline` on both fixtures**, so the
  placement figures in the plans are unchanged since Block 5 session 6. Nothing
  has yet exercised a placement that actually responds to a band change.

- **Session 2's blocker is untouched**: §6 term boundaries are still not
  derivable from plan data, so script-aware grouping remains blocked.

## Repo state

- Branch `main`, clean apart from `CLAUDE.md`, staged into the report commit.
  `origin/main` is at `429f23d` — **session 3's commits were pushed this
  session; this session's own commits are local and unpushed.**
- **HEAD at the time of writing is
  `d3fb733 feat: measure the band from the permitted glyph repertoire`**,
  preceded by `928e10b docs: measure the subtitle band from the real
  repertoire`. **The commit carrying this report follows HEAD and cannot be
  named here.**
- **Ledger `.local/costs.jsonl`, session start and session end, identical:**
  sha256 `a7e85e4bd5253bda8578aa008629c08a1726e145734ae04b16242f73fc64813d`,
  **105 lines** at both ends. No billable call was made.
- **`npm run check`: exit code 0, `check: PASS`.** core 127 tests / 6 files,
  service 593 / 42, benchmarks 166 / 16 — **886 TypeScript tests**. pytest
  **141 passed**. Unchanged from session 3: the band moved but no test count
  did, because the pinned values were updated rather than added to.

## Suggested next step

The band is settled as far as measurement can settle it, and two questions now
block on the user rather than on evidence. The first is cheap and should go
first: confirm from the two overview renders whether a wrapped second line
drops below the first or pushes the block upward, because
`EXTRA_LINES_RENDER_BELOW` moves the band 323 px — twenty times everything this
session measured — and every number here is conditional on it. The second is
the torso ruling: images over the mid-torso were a capability the user asked
for in Block 5, this session establishes that no honest reading of the fonts
returns it, and the remaining options are all product choices. Of them, letting
an image overlap the band while no subtitle is on screen looks the most
promising, because the subtitle timing needed to evaluate it is already on the
plans and it costs no visual compromise — but it turns the band from a static
exclusion into a time-varying one, which is a real change to the solver and
should be scoped before it is started.
