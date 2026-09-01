# Block 10 session 34 — the comps are 1300, and `sora` builds

**Status: PROBLEM.** `sora` builds and `npm run golden` passes at 17,174 fields,
but `npm run check` is red: three tests measure the shadow's Transform offset at
**`[8, 15.6]`** against the ruled `[8, 15]`, because After Effects scaled that
effect again when the canvas grew. The remedy is one edit to the user's own file
and this session may not make it — see §3.

**Spent $0.00; no API was called.** Ledger **144 lines / `d886596…` at both
ends**, last line 2026-08-31T23:18Z (session 32's `sora` images), all-time
**$16.187847**. The six hand-made references, the five corpus plans and `sora`'s
plan are byte-identical at both ends; the cache is unchanged at 71 entries /
128 files / 106 MB; `sora.mov` is unchanged at `344265a0…`. 160 GiB free.
**No project was saved but the builds' own output.**

## 1. The user's edit, and only the user's edit

`templates/library.aep` — his file, `d2bbb6b7…` → **`03b49e23fc7f909f0e8eba78fd
6849702dbf64b044b434c514b93e5d41c52734`**, 552,745 → **552,803 bytes**. This
session never wrote it; it was committed alone (`a49f566`) and the audit
re-stamped against it (`34cc56b`).

**1342 fields compared, 29 differ.** Every one is accounted for:

| fields | what |
|---:|---|
| 1 | `.aepSha256` |
| 12 | `.height` 1250 → **1300** on the four text comps and on both layers of each |
| 12 | the shadow's Transform effect on all four: `anchorPoint[1]` 625 → **650**, `offset[1]` 15 → **15.6**, `position[1]` 640 → **665.6** |
| 4 | `sub_pop_ar`'s `opacity.value` and `position.value[1]` on both layers — **the CTI artifact** |

**Nothing else moved.** Fonts, sizes, tracking, fills, layer names, anchor
points, scale, `sourceRect`, x offsets, blur and opacity keyframes are identical
on all six comps; the two image comps are untouched at 1200×1200. `TXT_MAIN`'s
`Transform/Position` keys read **750 → 700** again on both layers of all four
text comps — read from `valueAtSampleTime`, never `value`, which is what the four
CTI fields above are.

## 2. Where the room runs out

**53 px was never a margin; it was the corpus's luck.** The corpus is 13.1%
Arabic script and its two two-line cards happen to end in shallow glyphs.
`sora.mov` is **94.6% Arabic script**, **all five of its keywords break onto two
lines**, and `الجمال الطبيعي` reached **1282.3 px in the 1250 comp** — 32.3 px
over. On an Arabic-first reel a two-line Arabic keyword is the normal case.

Every card measured at the frame of maximum vertical extent, across all five
reels: **338 corpus cards + 88 `sora` cards, 0 overrunning top or bottom.**

`sora`'s five keywords at 1300:

| keyword | reach | headroom |
|---|---:|---:|
| `الجمال / الطبيعي` | 1282.9 | **+17.1** |
| `Lobna / Kfafi` | 1224.7 | +75.3 |
| `طب / التجميل` | 1197.3 | +102.7 |
| `صحة / البشرة` | 1196.4 | +103.6 |
| `وثقة / جديدة` | 1181.0 | +119.0 |

Corpus tightest per reel: test-1 `محفزات / الكولاجين` **+102.7**, test-2
`ترطيب / عميق` **+102.7**, test-3 `نتائج` (one line) +395.7, vitasilk
`filler glow` +395.4.

**The model**, and it is arithmetic over two measurements: a two-line card
reaches `750 + LINE_SPACING 323 + the second line's ink bottom + the shadow's
15.6`. The budget for a line's ink is therefore **1300 − 750 − 323 − 15.6 =
211.4 px**. Measured in After Effects on a throwaway comp at Almarai-Bold 455:

| final glyph | ink bottom | two-line reach | headroom |
|---|---:|---:|---:|
| **ي** | **194.3** | **1282.9** | **+17.1** |
| ج ح خ ع غ | 172.0 | 1260.6 | +39.4 |
| م | 169.7 | 1258.3 | +41.7 |
| everything else | ≤108.7 | ≤1197.3 | ≥+102.7 |

**Final yeh is the deepest glyph in the Arabic alphabet at this size and it is
what `sora` hit.** 17.1 px in hand. It runs out again if the Arabic keyword size
passes about **495** (from 455), or a client's Arabic face descends more than
**8.8%** deeper than Almarai, or the shadow's drop grows. **A third line can
never fit** at any comp height this project would author: it would need another
323 px of `LINE_SPACING` plus the ink.

## 3. The three tests, not edited

Per the brief, none was touched.

| test | expected | measured |
|---|---:|---:|
| `shadowDescentPx` reads the real templates' offset | 15 | **15.6** |
| `SUBTITLE_BAND` lands on its derived values | bottom 3012.5783 | **3013.17825** |
| `SUBTITLE_BAND` is the ink band plus the shadow's drop | 15 | **15.6** |

**15.6 is 15 × 1300/1250** — After Effects scaling the Transform effect with the
canvas, the same trap sessions 22–24 recorded, recurring for the third time.
**The remedy is one edit to the user's file: set `TXT_MAIN_SHADOW`'s Transform
effect Position to `[1088, 665]`** against its Anchor Point of `[1080, 650]`, on
all four text comps. Nothing was compensated for in code and no test was
adjusted to match a measured value; the offset is a user ruling.

## 4. Both gates, and `sora`

**`npm run golden` — PASS, 4 of 4, 17,174 fields.** Before re-recording, all
**524** differing fields were checked directly: every one is
`masters[].layers[].position[]` moving 2405.39990234375 → **2430.39990234375**,
and **0 are anything else**. The counts are 132 / 134 / 116 / 142 per reel —
exactly twice each reel's text-layer count, which is what a per-card comp-layer
position must be. The +25 is bookkeeping: `placeholder − anchor` went 75 → 50, so
the comp layer absorbs it. **The baseline was read back inside After Effects on
four layers of the built `vitasilk` — 2480.39990234375 on every one**, exactly
`SUBTITLE_ANCHOR_BASELINE_Y`. The reference was re-recorded and a verify run
passed.

**`sora` builds.** `npm run build:reel` exit 0, then censused:

| | |
|---|---|
| `master_final` | 2160×3840, 40.5405 s @ 29.9700317, **112 layers** — 1 footage, 1 watermark, 11 sfx, 11 image, **88 text** |
| `master_subs_only` | 89 layers |
| comps | 107 — 2 master, 99 built, 6 library |
| text comps / layers | 88 / 176 — **83 subtitles + 5 keywords** |
| placeholder words surviving | **0** |
| undeclared text layers · comps missing a declared layer | **0 · 0** |
| placeholder and shadow differing in text or size | **0 · 0** |
| against the plan | 88 compared, **0 mismatched** |
| cards shrunk | **0** — every card fits at its authored size |
| fonts | Almarai-Bold, CormorantGaramondItalic-SemiBoldItalic, Inter-SemiBold — **none outside `k2-syndicalia`** |
| pictures | 11, all at **55.733% (669 px)**, all reported in the top-left corner, `placementIsSafe` asserted per slot |
| sounds | 11 whooshes at −13.64 dB |
| watermark | top-right, 16.84%, audio −20 dB |

By template: `sub_pop_ar` 80 cards, `kw_slam_ar` 4, `sub_pop` 3, `kw_slam` 1 —
which is the 94.6% Arabic figure showing up in the comp. **It was not opened in
front of the user.**

**`npm run check` — FAIL**, at `core`, on the three tests above.

| workspace | files | tests |
|---|---|---|
| core | 50 passed, **1 failed** (51) | 756 passed, **1 failed** (757) |
| service | 94 passed, **1 failed** (95) | 1217 passed, **2 failed** (1219) — `new-video.test.ts` **passes**, 261.7 s |
| benchmarks | 17 (17) | **173 passed** |
| panel | 10 passed, **1 failed** (11) | 208 passed, 2 skipped, **5 failed** (215) |
| pytest | | **149 passed** |

**The panel image-picker flake fired in both runs this session** — the same five
tests in `render.browser.test.ts`, once under the full check and once with the
panel workspace run alone. Fourth session running where running it alone does not
help; the cause is still unknown and it is not this session's change.

## 5. What is written down

`docs/TEMPLATE_LIBRARY_GUIDE.md` §11 and `docs/PROJECT_SPEC.md` §3 were written
against a 1250 comp and now carry the 1300 figures, the glyph table, the model
and the budget, the re-centring trap and its remedy, and the Arabic-first
finding. `CLAUDE.md` carries the new sha256; the old `d2bbb6b7…` survives only in
the historical session records, which are not edited.
