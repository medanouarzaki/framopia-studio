# Block 10 session 35 — the shadow is back to 15, and `sora` is ready to build

**Status: PROBLEM — `npm run check` exits 1 on two browser tests whose fixtures
point at files that no longer exist; nothing about the library, the build or the
reel is wrong.**

**One gate is green and one is not.** `npm run golden` **passes — 4 of 4 reels,
17,174 fields, not one differing**. `sora.mov` builds. `npm run check` fails on
two test files that both drive Chromium and neither of which touches the
templates, the placement or the build.

**`sora`'s built composition is at**

```
.local/build/sora-995f2d27-full.aep
```

It was built, censused and left alone. It was not opened in front of the user.

**Spent $0.00; no API was called.** Ledger **144 lines / `d886596…` at both
ends**, all-time $16.187847. `templates/library.aep` is
`4b0cf05a8f5d4775c03e8ebd86f713f0e7eb985d80e46f3874cb28eca6c22aba` at both ends —
this session never wrote it. The six hand-made references, the cache (71 entries
/ 128 files / 106 MB) and `sora.mov` (`344265a0…`) are byte-identical at both
ends. **No project was saved but the builds' own output.** 157 GiB free.

## Done

### The edit is right, and it is the only thing that changed

Measured read-only through `library-guard.jsx`, on all four text comps:

| | |
|---|---|
| Anchor Point | `[1080, 650]` |
| Position | `[1088, 665]` |
| **offset** | **`[8, 15]`** — the ruling, restored |

Read with **`valueAtTime`, not `.value`**, at each comp's midpoint. Both
properties carry **zero keyframes**, so the two readings cannot disagree — which
is also why none of session 34's four playhead artifacts reappeared.

**1342 audit fields compared, 9 differ**, and every one is the intended edit:
`offset[1]` 15.6 → 15 and `position[1]` 665.6 → 665 on each of `kw_slam`,
`kw_slam_ar`, `sub_pop` and `sub_pop_ar`, plus the file's sha256. **Nothing else
moved at all** — no height, font, size, tracking, fill, layer name, count, anchor
point, scale, `sourceRect`, x offset, blur or opacity keyframe.

Independently confirmed in the same read: the four text comps are still
**2160×1300**, `TXT_MAIN`'s Position keys still read **750 → 700** on both layers
of each, and the two image comps are still **1200×1200**.

The audit was re-stamped. The user's edit is committed on its own (`086ceee`),
the stamp separately (`df8c3c0`).

### The three tests pass, none edited

| | measured | expected |
|---|---:|---:|
| `shadowDescentPx(manifest, audit)` | **15** | 15 |
| `SHADOW_DESCENT_PX` | **15** | 15 |
| `SUBTITLE_BAND` top | 1980.175 | 1980.175 |
| `SUBTITLE_BAND` bottom | **3012.57825** | 3012.5783 |

`core/src/shadow-extent.test.ts` 6 of 6, `service/src/placement/constants.test.ts`
7 of 7. No test was touched.

### Golden did not move by one field

All four corpus reels rebuilt, then compared:

```
ok  test-1    4415 fields identical
ok  test-2    4280 fields identical
ok  test-3    3709 fields identical
ok  vitasilk  4770 fields identical
golden: 4 of 4 reels matched, field for field    (17,174)
```

**Zero fields differed, so nothing was re-recorded** and the reference is
untouched at `18f5fc5d…`. This is worth stating plainly: the 0.6 px moved
`SUBTITLE_BAND`'s bottom, which governs where a *picture* may sit, and on these
four reels it changed no placement decision and no card geometry. Session 34's
+25 px shift came from the height change, not from the shadow.

The baseline was still read back out of After Effects rather than trusted:
**2430.39990234375 on four subtitle comp layers** of the built `sora`, which is
`SUBTITLE_ANCHOR_BASELINE_Y` (2480.4, stored as 2480.39990234375) less the 50 px
a 1300 comp with its first baseline at 700 and its placeholder at 750 puts
between anchor and layer.

### Every card fits, and the tightest one got its 0.6 px back

Measured at each card's frame of maximum vertical extent, from the shrink record
each build writes. **350 cards across the four corpus reels and `sora`; none
overruns, top or bottom.** The shadow's drop reads **15** on every one.

`sora`'s five keywords, all two lines:

| keyword | reach in a 1300 comp | headroom | at 15.6 |
|---|---:|---:|---:|
| `k001` الجمال / الطبيعي | 1282.3 | **+17.7** | +17.1 |
| `k005` Lobna / Kfafi | 1224.1 | +75.9 | +75.3 |
| `k003` طب / التجميل | 1196.7 | +103.3 | +102.7 |
| `k004` صحة / البشرة | 1195.8 | +104.2 | +103.6 |
| `k002` وثقة / جديدة | 1180.4 | +119.6 | +119.0 |

**Yes — the 0.6 px came back, one for one, on every card.** `k001` is still the
tightest card in the project by a factor of four; it ends in final yeh, the
deepest glyph in the alphabet at 455.

Tightest card per corpus reel: `test-1` `محفزات / الكولاجين` **+103.3**, `test-2`
`ترطيب / عميق` **+103.3**, `test-3` the single-line `نتائج` +396.3, `vitasilk`
`filler glow` +396.0. Minimum top clearance across all five reels is 334.1 px.

### `sora` builds

`npm run build:reel` exit 0, then censused:

| | |
|---|---|
| `master_final` | 2160×3840, 40.5405 s @ 29.9700317, **112 layers** — 1 footage, 1 watermark, 11 sfx, 11 image, **88 text** |
| `master_subs_only` | 89 layers |
| comps | 107 — 2 master, 99 built, 6 library |
| text comps | **88 = 83 subtitles + 5 keywords**; 176 text layers |
| placeholder words surviving | **0** |
| missing declared layer · undeclared text layer | **0 · 0** |
| placeholder and shadow differing in text or size | **0 · 0** |
| against the plan | 88 compared, **0 mismatched** |
| cards shrunk | **0** — every card at its authored size |
| fonts | Almarai-Bold, CormorantGaramondItalic-SemiBoldItalic, Inter-SemiBold — **none outside `k2-syndicalia`** |

By template: `sub_pop_ar` 80, `kw_slam_ar` 4, `sub_pop` 3, `kw_slam` 1 — the
reel's 94.6% Arabic showing up in the comp.

The **11 pictures**, every one at **55.733% (669 px)** and every one placed in the
top-left corner against the speaker's own face mask:

| | position | | position |
|---|---|---|---|
| 1 | 413.3, 421.9 | 7 | 424.7, 420.3 |
| 2 | 402.2, 427.7 | 8 | 408.3, 426.7 |
| 3 | 406.0, 427.6 | 9 | 429.6, 399.2 |
| 4 | 438.3, 441.1 | 10 | 434.0, 399.2 |
| 5 | 433.6, 416.1 | 11 | 436.6, 399.2 |
| 6 | 430.2, 416.7 | | |

Each is reported as bounded by the space above or beside the speaker, and the
build asserts `placementIsSafe` per slot — it exits non-zero if any picture is
not clear of him, and it exited 0. **11 whooshes at −13.64 dB**; the watermark
top-right at [1890, 289.4], 16.84%, −20 dB.

### The panel flake, measured — and the recorded cause is wrong

**It is not parallel load.** Load was tested directly and ruled out.

The five that fail, all in `src/render.browser.test.ts` under
`describe('the image candidate picker')`:

1. *shows the picture the build will place, not the cut-out of it* — that a card
   slot shows its own picture and a cutout slot its cut-out, once each.
2. *offers the picture before the background was removed, on a cutout slot only* —
   that exactly one `figure.rawshot` is offered.
3. *still shows the pictures when the service is older than the panel* — the
   session 31 defect: against a service predating `renderedPath`, all three
   candidates still show.
4. *says a picture is gone only when the service says it is gone* — that "no
   longer on the disk" appears only for `renderedExists: false`.
5. *encodes the spaces in a real path* — that the `file://` URL is percent-encoded.

**What actually fails.** Never an assertion about the panel's behaviour. Every
failure is that `img.shot.built` is **absent from the DOM** — either
`page.waitForSelector('img.shot.built')` times out at 5000 ms, or `$$eval`
returns `[]` where 2 or 3 were expected. `Images.tsx:271` renders that element
only while `picture.state === 'ready' && !unreadable`, and `Images.tsx:276` sets
`unreadable` from the `<img>`'s own `onError`.

**Why `onError` fires: the three files the fixtures name do not exist.**

```
my files/test videos/cutouts/img001-c1.cutout.png   MISSING
my files/test videos/cutouts/img001-c2.cutout.png   MISSING
my files/test videos/cutouts/img002-c1.cutout.png   MISSING
```

The cutouts moved into per-reel subdirectories — they are now at
`cutouts/test 1/img001-c1.cutout.png` and alongside, 19 files under three
directories. The test still hardcodes the flat path. The comment above those
constants (line 755) records the earlier repair in as many words: fixtures
pointing at nowhere *"raced that removal: the assertions passed only when they
ran before the error arrived… These are files that exist, so the error never
fires."* **That premise is no longer true, and nothing asserts it, so the race it
closed has been open ever since — silently.**

Measured failure rates on this machine:

| how it was run | runs | result |
|---|---:|---|
| the describe alone (`-t`), idle | 8 | **8 passed** |
| the describe alone, all 8 cores saturated | 3 | **3 passed** |
| `render.browser.test.ts` whole, alone | 3 | **3 failed** — 2, 3 and 3 tests |
| the whole panel workspace, alone | 1 | **1 failed** — 3 tests |
| the whole panel workspace, under `npm run check` | 1 | **1 failed** — 4 tests |

Saturating every core changed nothing; running the other ~105 tests in the same
file first changed everything. The variable is not machine load but whether the
browser has already been driven — a cold renderer delivers the `file://` failure
after the assertion, a warm one before it. That is why *"run the workspace on its
own"* never helped, and why the count varies run to run.

**To confirm it, put a real file at one of those three paths and run the file
whole.** If it goes green, that is the cause. **Not fixed here, as instructed**,
and no timeout was widened. The repair is to point the fixtures at cutouts that
exist and to assert in `beforeAll` that they do, so this can never rot silently
again.

## Deviations

None. No billable stage was run, nothing was written to `templates/`, and
`sora.mov`, the cache, the candidates and the references were not touched.

## Failures & open problems

1. **`npm run check` exits 1**, on two files, neither about the library:
   - `panel/src/render.browser.test.ts` — **4 failed** in the check run (215
     tests, 209 passed, 2 skipped), the image-picker family above.
   - `core/src/align-sheet.browser.test.ts` — **all 9 of its tests pass**; the
     file fails on `Error: Hook timed out in 10000ms` in `afterAll`, which closes
     Chromium and removes its temp directories. `beforeAll` is given 120 s;
     `afterAll` takes vitest's 10 s default. Measured **1 failure in 4 runs of
     that file alone** — a second, separate browser-teardown flake, and new since
     session 34. Not fixed, and it is a different problem from the one above.

   The rest of `npm run check` is green, read from its own output: core **757
   tests passed** (51 files, 1 file failed in teardown), service **1219 passed /
   95 files**, benchmarks **173 passed / 17 files**, `tools/cv` **149 passed**,
   and every typecheck, lint, ES3 and manifest gate.

2. **`ground-truth` still cannot be built** — its six image slots have never been
   generated, and its shrink record predates the vertical measurement, so it is
   the one corpus reel absent from the height figures above. Unchanged.

3. `.local/build/ground_truth-shrink.json` is stale for the same reason and
   carries no `vertical` block; nothing reads it.

## Repo state

Branch `main`, clean. Four commits:

| | |
|---|---|
| `086ceee` | chore: put the shadow's transform offset back to 8 and 15 — the user's file, alone |
| `df8c3c0` | chore: re-stamp the template audit against the restored offset |
| `3df9024` | docs: record the restored offset and the real cause of the panel flake |
| this one | docs: report block 10 session 35 — a commit cannot name its own hash |

`docs/PROJECT_SPEC.md` §3 and `docs/TEMPLATE_LIBRARY_GUIDE.md` §11 said the
offset was outstanding at `[8, 15.6]`, the ink budget was 211.4 px and the
tightest card cleared by 17.1 px. All three were true yesterday and are false
now; they carry the measured figures instead, and the recurrence is written down
as a rule rather than a discovery — **after any change to a text comp's height,
put the shadow's Transform Position back to Anchor Point + [8, 15]**. Three
height changes, three times the same repair. `CLAUDE.md` no longer says the panel
tests *"flake for a reason nobody has found"*.

The five plans that were built carry a new `built` record and their sha256s moved
accordingly — `test 1` `a2836481…`, `test 2` `04c67454…`, `test 3` `ff0ccdf8…`,
`vitasilk` `9bcfdfa2…`, `sora` `8181bda6…`. `ground truth` is unchanged at
`0712e412…`.

## Suggested next step

Repair the two browser tests, in that order: point `render.browser.test.ts`'s
three cutout fixtures at files that exist and assert their presence in
`beforeAll`, then give `align-sheet.browser.test.ts`'s `afterAll` a timeout that
matches the 120 s its `beforeAll` already has. Both are test-harness faults with
no product behind them, and together they are all that stands between this repo
and a green `npm run check`.
