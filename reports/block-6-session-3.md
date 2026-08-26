Status: OK

The subtitle band is measured now rather than guessed. It derives from the
user's anchor and from ink extents read out of the two font files, both
fixtures re-solved unchanged, and the band was rendered for the user's eye.
No API call was made and nothing was billed.

## Done

**Session-start checks.** T7 mounted, repo at
`/Volumes/T7 Shield/INSEA/Projects/framopia-studio`. `git status
--untracked-files=no` empty. HEAD was `7b09373 docs: record block 6
session 2`, as expected. Ledger sha256
`a7e85e4bd5253bda8578aa008629c08a1726e145734ae04b16242f73fc64813d`,
**105 lines**.

### Goal 1 — the real subtitle band

**Both fonts are installed and were read directly. Nothing is estimated.**

| face | file | bytes |
|---|---|---|
| Inter (variable) | `~/Library/Fonts/Inter-VariableFont_opsz,wght.ttf` | 874,708 |
| Almarai Bold | `~/Library/Fonts/Almarai-Bold.ttf` | 152,744 |

Read with fontTools 4.63.0, already present in the CV sidecar venv
(`tools/cv/.venv`), so nothing was installed. Raw values, in font units:

| | Inter | Almarai Bold |
|---|---|---|
| `head.unitsPerEm` | 2048 | 1000 |
| `head.yMax` / `yMin` | 2269 / −660 | 1100 / −427 |
| `OS/2.usWinAscent` / `usWinDescent` | **2269 / 660** | **1108 / 453** |
| `OS/2.sTypoAscender` / `sTypoDescender` | 1984 / −494 | 905 / −211 |
| `hhea.ascender` / `descender` | 1984 / −494 | 905 / −211 |

**usWin metrics are used, not typo metrics.** Typo metrics describe
comfortable line spacing; usWin is the font's own statement of maximum ink
reach, and a placement exclusion has to cover the reach. For Inter usWin
equals the global glyph bbox exactly; for Almarai it exceeds it (1108 > 1100,
453 > 427), so it is the conservative choice in both files.

**Inter Semi-Bold is an instance of a variable font, and that was checked
rather than assumed.** Its `MVAR` table varies only `xhgt`, `stro`, `strs`,
`undo`, `unds` — no vertical metric tag among them. Instantiating at
`wght=600` at both ends of the `opsz` axis (14 and 32) reproduces
`yMax=2269 / yMin=−660 / usWinAscent=2269 / usWinDescent=660` exactly, so the
extents above hold for Semi-Bold specifically. The `fvar` table confirms a
named `SemiBold` instance at `{opsz: 14, wght: 600}`.

**The arithmetic, every step.**

Ink extent in pixels = `units / unitsPerEm × sizePx`.

| case | size px | ascent px | descent px | ink height |
|---|---|---|---|---|
| Inter Semi-Bold, subtitle | 343 | 380.0132 | 110.5371 | 490.5503 |
| Almarai Bold, subtitle | 343 × 1.07 = 367.01 | 406.6471 | 166.2555 | 572.9026 |
| Inter Semi-Bold, keyword | 425 | 470.8618 | 136.9629 | 607.8247 |
| **Almarai Bold, keyword** | 425 × 1.07 = **454.75** | **503.8630** | **206.0018** | **709.8648** |

**Almarai Bold is the taller face in both directions** at the keyword size —
503.86 against 470.86 above, 206.00 against 136.96 below. The 1.07 ratio and
its heavier descenders more than cover Inter's taller nominal ascent. The band
is built on Almarai, and the keyword size dominates the subtitle size in both
directions, so one band serves both tracks.

Worst case is two lines at the keyword size:

```
top    = baseline − ascent          = 2480.4 − 503.8630            = 1976.5370 px
bottom = baseline + leading + desc  = 2480.4 + 323 + 206.0018      = 3009.4017 px
height =                              3009.4017 − 1976.5370        = 1032.8647 px
```

Normalized against the 3840 px frame height:

```
y = 1976.5370 / 3840 = 0.5147231771
h = 1032.8647 / 3840 = 0.2689751953   (bottom = 0.7836983724)
```

Full frame width is kept (`x: 0, w: 1`): the anchor is centred, a wrapped
keyword can run wide, and nothing in the pipeline measures the horizontal
extent of a string.

### Goal 2 — landed, and what moved

`service/src/placement/constants.ts` no longer contains a number. It imports
the typography and computes `SUBTITLE_BAND_TOP_PX`, `SUBTITLE_BAND_BOTTOM_PX`
and `SUBTITLE_BAND` from it. The comment records that it derives from measured
font metrics plus the user's anchor, names Block 6 session 3, and **keeps the
old provisional value in full** (full width, 600 px, centred at 0.75,
y 0.671875–0.828125, 2580–3180 px) so the change is auditable.

**Against the old band the new one is 603 px higher at the top and 171 px
higher at the bottom, and 1.72x taller.** The guess left the whole of the
first line's ascent unprotected and excluded 171 px below the type that
nothing ever draws in.

**No placement moved. Not one.** Both fixtures re-solved onto Block 5 session
6's recorded positions and scales exactly:

| reel | slot | zone | pos | scale | vs Block 5 |
|---|---|---|---|---|---|
| vitasilk | img001 | z_left_4 | (0.0202, 0.3325) | 0.2933 | identical |
| vitasilk | img002 | z_left_2 | (0.0840, 0.0641) | 0.6184 | identical |
| vitasilk | img003 | z_left_4 | (0.0712, 0.3292) | 0.2869 | identical |
| vitasilk | img004 | z_left_3 | (0.1118, 0.0634) | 0.5343 | identical |
| vitasilk | img005 | z_top_4 | (0.6170, 0.0122) | 0.4472 | identical |
| test-1 | img001 | z_top_1 | (0.5548, 0.0358) | 0.6605 | identical |
| test-1 | img002 | z_top_2 | (0.0578, 0.0486) | 0.6323 | identical |
| test-1 | img003 | z_left_4 | (0.0567, 0.2899) | 0.4065 | identical |
| test-1 | img004 | z_top_1 | (0.5809, 0.0127) | 0.5976 | identical |

**vitasilk 5 of 5 and test-1 4 of 4 still place. No slot became unplaceable.**

**No placed rect intersects either band**, so the "inside the old band but
outside the new one, or the reverse" question is empty on this corpus. The
lowest rect on either reel bottoms at 1629 px (vitasilk img001), 347 px above
the new band top. The solver had already pushed everything into the upper
zones.

**`npm run place` writes to the plan as its normal behaviour**, so it was
allowed to. It reported `keys changed [meta, pipeline]` on both — timestamps
only, since the placements are identical. Hashes:

| plan | before goal 2 | after |
|---|---|---|
| ground truth | `41ee41d6…` | `41ee41d6…` **untouched** |
| test 1 | `0df0077d…` | `a1b7a0ad…` |
| test 2 | `414b3b6f…` | `414b3b6f…` **untouched** |
| test 3 | `6b10c2c5…` | `6b10c2c5…` **untouched** |
| vitasilk | `83594625…` | `7bfa3ff8…` |

(test-1 and vitasilk were each written twice — once for the placements, once
when the overlays were re-rendered after the label fix — so their final hash
differs from the intermediate one; only `meta`/`pipeline` moved either time.)

### Goal 3 — the visual check

Rendered by the **existing** `placement_overlay` sidecar task, which already
draws the band and the placed rects; no new rendering was written. Exact paths:

- `benchmarks/results/latest-placement/vitasilk-overview.png`
- `benchmarks/results/latest-placement/test-1-overview.png`

Nine per-slot renders sit alongside them
(`<reel>-slot-<slotId>.png`). I looked at both overviews: the band sits where
the arithmetic puts it, spans full width, and every placed square is clear
above it. **The band label read "subtitle band (provisional)" and now reads
"(measured)"** — it would have been a false caption on the very image the user
is meant to confirm from.

### Goal 4 — where the type constants live

**Global, in `core/src/typography.ts`.** PROJECT_SPEC §5 settles it twice
over: "Subtitle visual style and position are global across all clients" and
"Global (not per-mode): subtitle position, subtitle base style, SFX set." §5
also named Inter Semi-Bold directly and left the Arabic face as
`TBD_ARABIC_FONT`, to be "collected at the start of Block 6 and recorded here
by amendment" — which is this session. `docs/PROJECT_SPEC.md` §5 is amended
with Almarai Bold, the 1.07 ratio, the anchor, the three sizes and the 90%
scale note.

`core` rather than `service/src/placement/` because the Block 7 ExtendScript
builder needs the same font names and sizes to author the comps, and the band
is only one consumer of them. Placement imports and derives.

**Nothing was added to the mode and no version was bumped, so no cache was
invalidated.** `modes/k2-syndicalia.json` stays at v5 with
`fonts: { status: "tbd" }`.

**One spec tension I am flagging rather than resolving.** §5 line 49 says
"per-client only font/palette applied through the template", while line 50
names the subtitle fonts as global, and line 75 says K2's "Fonts and further
visual identity: provided by the user at Block 9; do not invent them." The
reading I acted on is that the *subtitle track's* faces are global and the
mode's `fonts` field is for the client's wider identity, which is why
`requireFonts` still throws for K2. **If the user intends the mode to override
the subtitle face per client, that is a different design and I have not built
it.**

## Deviations

- **`npm run place` was run four times, not twice.** Twice as `--dry-run` to
  read the numbers without writing, then twice for real, then twice more after
  the overlay label fix to regenerate the renders. Only `meta`/`pipeline`
  changed on any of them.
- **Four existing tests in `solve.test.ts` had to be edited**, and this is the
  change most worth scrutinising. Its torso fixture was `y: 0.44, h: 0.23`,
  bottoming at 0.67 — which is where the *old* band started. Once the band
  moved the fixture was clipped to 287 px and stopped being a placeable torso
  zone, so four tests failed for a reason unrelated to what they test. The
  fixture now derives its bottom from `SUBTITLE_BAND.y` so it cannot drift
  again, and its top moved to 0.36 to clear `MIN_PLACED_SHORT_EDGE` after card
  clearance and the 0.88 fill. **No constraint was relaxed and no threshold
  was moved.**
- **A `constants.test.ts` was added to `service/src/placement/`**, which the
  goals did not ask for. The band is now computed rather than typed, so the
  arithmetic needed pinning somewhere.

## Failures and open problems

- **The measured band eliminates every torso zone in the corpus.** This is the
  session's real cost and it was not anticipated by the goals. Torso zones are
  bounded below by `SUBTITLE_BAND.y` (passed into the sidecar by
  `zones-cli.ts`), which rose 603 px. Re-bounding Block 5 session 6's recorded
  torso rects against the new top:

  | reel | old height | new height | verdict |
  |---|---|---|---|
  | ground-truth | 898 px | 295 px | fails `MIN_PLACED_SHORT_EDGE` |
  | test-1 | 886 px | 283 px | fails |
  | test-2 | 674 px | 71 px | fails |
  | test-3 | 482 px | **negative** | starts below the band top; gone |

  None survives after card clearance and the 0.88 fill. Block 5 session 6's
  headline deliverable is dead on the measured geometry. **It costs no
  placement today** — torso was last-resort and zero of the nine placements
  used one — but the kind is now reachable only through a manual zone. Whether
  that is acceptable is the user's call; the alternative is admitting images
  over the upper chest, which is inside the band.

- **The zones stored on all five plans are stale.** They were computed with the
  old band, so their torso entries claim space the band now occupies.
  `npm run zones --write-plan` (free, local) would refresh them. **I did not
  run it**: goal 2 scoped the writing to `npm run place`, and re-deriving zones
  on five reels is a larger change than this session was asked to make. Nothing
  is unsafe in the meantime — `solve.ts` re-checks every rect against
  `SUBTITLE_BAND` and would reject an intruding one — but the plans and the
  constant currently disagree.

- **One assumption, and it is the only soft part of the geometry.** A second
  line is taken to render **below** the first (`EXTRA_LINES_RENDER_BELOW` in
  `core/src/typography.ts`). That is what an AE point-text layer anchored at
  0,0 does, and I am confident in it, but it is a reading of AE's behaviour
  rather than something measured off the user's comp. If the templates grow
  upward the band becomes **y 0.4306085937, h 0.2689751953** (1653.54 to
  2686.40 px) — same height, shifted up by exactly `LINE_SPACING`. One edit.
  **The overview renders are the place to settle it by eye.**

- **The horizontal extent is not measured.** The band is full width because
  nothing computes how wide a rendered string is. That is conservative for an
  exclusion, but it means an image can never sit beside a short subtitle, which
  on a 2160 px frame may be leaving usable space unused.

- **The 1.07 ratio is the user's optical judgement, not a derivation.** It is
  recorded as such in `typography.ts`. Nothing verifies that Almarai at 1.07x
  actually matches Inter optically; that is an eye question.

- **Untested paths.** The band is exercised only against these two fixtures and
  the synthetic solver fixtures. `FONT_METRICS` is pinned by a test but nothing
  re-reads the font files at test time — deliberately, since the suite must run
  without those fonts installed — so **a font substitution or a font update on
  this machine would not be caught**.

- **Session 2's blocker is untouched** and still blocks script-aware grouping:
  §6 term boundaries are not derivable from plan data.

## Repo state

- Branch `main`, clean apart from `CLAUDE.md`, which is staged into the report
  commit. `origin/main` was at `c70a7b9` at session start; **nothing was pushed
  this session.**
- **HEAD at the time of writing is
  `34e96dd docs: record the arabic font and subtitle geometry in the spec`**,
  preceded by `90208fc fix: label the placement overlay band as measured` and
  `09fd56c feat: derive the subtitle band from measured font metrics`. **The
  commit carrying this report follows HEAD and cannot be named here.**
- **Ledger `.local/costs.jsonl`, session start and session end, identical:**
  sha256 `a7e85e4bd5253bda8578aa008629c08a1726e145734ae04b16242f73fc64813d`,
  **105 lines** at both ends. No billable call was made.
- **The five plans**, session start → session end:

| plan | start | end |
|---|---|---|
| ground truth | `41ee41d61ace4586af9f813da4531634f729b679917d0debb187898fcc3e936d` | unchanged |
| test 1 | `0df0077d058c09a07f8a63c02ee92c1316aecd2e0603ea2c9675cfcd2a75ad76` | `a1b7a0adb4eed72d590c207ed4d1f9ff43230dbc47dcee908c2ccf3e78645622` |
| test 2 | `414b3b6fea51e8e6a9d39d45303b99688f6618b823992f46b2c4d52c1889c453` | unchanged |
| test 3 | `6b10c2c5ebe3f154e7c165291f9022f745fd23e4b9d855fe5bd939662c252e04` | unchanged |
| vitasilk | `83594625479afd9d68c5dd5dad7feb6548ad023f5e9dc2d1d543710c12269132` | `7bfa3ff8d0d3f688315ed89ad3e758bf22e96144c86a10ec6f551b8a5cdc5064` |

- **`npm run check`: exit code 0, `check: PASS`.** core 127 tests / 6 files,
  service 593 / 42, benchmarks 166 / 16 — **886 TypeScript tests**, up from
  875 (+6 typography, +5 band). pytest **141 passed**, unchanged.

## Suggested next step

Confirm the band by eye on the two overview renders before anything is built
on it — specifically whether a wrapped second line drops below the first or
pushes the block upward, because that is the one number here that is a reading
of After Effects rather than a measurement, and it moves the band by 323 px.
Once it is settled, the next session should re-derive zones on all five reels
with `npm run zones --write-plan` (free, local) so the stored zones stop
disagreeing with the constant, and decide what happens to torso zones: on the
measured geometry the band consumes the whole region Block 5 session 6 built
them in, and the honest options are to accept that torso placement is dead on
this framing, to lower `MIN_PLACED_SHORT_EDGE` for torso zones specifically, or
to rule that an image may overlap the subtitle band when no subtitle is on
screen at that moment — which is a real possibility the current
always-excluded band forecloses, and which the timing data to evaluate already
exists on the plans.
