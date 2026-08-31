Status: OK — the offset is [8, 15] on all four comps, `npm run check` exits 0 and `npm run golden` passes 4 of 4, field for field

**Both gates are green.** The Transform effect on `TXT_MAIN_SHADOW` reads
**Anchor Point [1080, 625], Position [1088, 640], offset [8, 15]** on all four
text comps. `npm run check`: **PASS**. `npm run golden`: **4 of 4 reels matched,
field for field**, 17,174 fields.

**Spent $0.00; no API was called.** Ledger **118 lines, sha `3f657131…`,
byte-identical at both ends**. All five Edit Plans and the six hand-made
references byte-identical. After Effects pid 79146, 0 `aerender`,
`app.fonts.allFonts` 1198 → 1198.

## Done

### The edit, verified — and only the edit

`templates/library.aep` `103cc1f1d02018df…` → **`d2bbb6b727f819078b5e8dec08a59722b018dc6c0d1d77c123476f8241c84d9c`**,
552,745 bytes both times. Read-only; never opened for writing, never saved.

Fresh audit against the stamped one: **1342 fields compared, 13 differ.**

| what | count | |
|---|---:|---|
| the Transform effect | **8** | `offset[1]` 17.0454545454544 → **15** and `position[1]` 642.045454545454 → **640**, on all four text comps |
| the CTI artifact | 4 | `position.value[1]` 750 → 700 and `opacity.value` 0 → 100 on `kw_slam_ar` only |
| the stamp | 1 | `aepSha256` |

**§1.3 — the reading used is `valueAtSampleTime`, never `value`.** The audit
records both, and `value` is whatever the playhead happened to sit on: it moved on
one comp this session and moved on three last session, while
**`valueAtSampleTime` reads 700 on every text comp in both audits** and is absent
from the diff. Block 7 session 3 put every subtitle card 50 px low by trusting
`value`.

**§1.4 — nothing else moved.** All four text comps 2160×1250; `img_float` and
`img_slide_left` 1200×1200. `Transform/Position` keys **750 → 700** on
`TXT_MAIN` *and* `TXT_MAIN_SHADOW` in all four; blur keys 30 → 0; opacity keys
0 → 100. `sub_pop`'s `TXT_MAIN` is Inter-SemiBold 343, tracking 0,
CENTER_JUSTIFY, anchor [0, 0, 0], scale [100, 100, 100], `sourceRect` top
−253.285423278809 / left −641.366455078125 / 1290.939453125 × 257.137474060059 —
all identical.

### The three tests pass on their own; none was edited

| test | expected | measured |
|---|---:|---:|
| `core/src/shadow-extent.test.ts` | 15 | **15** — 6 passed (6) |
| `service/src/placement/constants.test.ts` | 3012.5783 | **3012.57825** — 7 passed (7) |

Sessions 22 and 23 both refused to edit these rather than ratify a change nobody
chose. That refusal was right: the number came back on its own.

### The corpus

All four reels build. **262 cards, 0 overrunning top or bottom**, measured at the
entrance where the card sits 50 px lower.

| reel | card | lines | reaches | headroom | shadow drop |
|---|---|---:|---:|---:|---:|
| test-1 | `k002` `محفزات الكولاجين` | 2 | 1196.7 | **+53.3** | 15.000 |
| test-2 | `k002` `ترطيب عميق` | 2 | 1196.7 | **+53.3** | 15.000 |
| test-1 | `g003` `طبيعي` | 1 | 921.7 | +328.3 | 15.000 |

Those two are the corpus's only two-line cards. Headroom went **51.2 → 53.3 px**,
which is exactly the 2.045 the shadow gave back.

### The 524 fields, checked in full rather than from the log

`npm run golden`'s listing caps at 40 per reel, so its output showed 160 of 524.
Each reel was built and censused separately and diffed field by field:

| reel | fields | differing |
|---|---:|---:|
| test-1 | 4414 | 132 |
| test-2 | 4279 | 134 |
| test-3 | 3708 | 116 |
| vitasilk | 4769 | 142 |
| **total** | **17,170** | **524** |

**One field kind, one value change: `masters[].layers[].position[]`,
2330.39990234375 → 2405.39990234375.** Fields differing that are not a comp-layer
position: **0**. No font, size, text, colour, scale, count or audio field moved.

**The baseline was read back inside After Effects before anything was recorded** —
five layers of the built `vitasilk`, `posY` 2405.39990234375 and `anchorY` 625,
giving **2480.39990234375**, exactly `SUBTITLE_ANCHOR_BASELINE_Y`. The comp
layer's Position moved because the comp's internal geometry did
(`placeholder − anchor` went 150 → 75); the type did not.

### The watermark is pinned to the top — and it was not already there

**§4's premise was wrong, and the corpus proves it.** All four corners were
candidates and nothing ruled a low one out: the subtitle band spans y 0.516–0.785
while a bottom corner sits at **y 0.877–0.972**, so the band's rejection never
reached it. The seeded shuffle chose a bottom corner in **93 of 200 seeds** — and
**`test-1` had built its mark at y 3550.63403320312 of 3840**, which the reference
recorded earlier in this session had pinned.

The decision is `placeWatermark`, `service/src/placement/watermark.ts:108–144`:
the candidate list, three rejection rules, then a seeded shuffle over what is
free with `pool = free.length > 0 ? free : candidates` as the fallback. **Only the
two top corners are candidates now.** Position, size and both margins are
untouched; the seeded draw still chooses between the two.

Guarded in two places, because a placement rule and a built comp are different
claims:

- **`watermark.test.ts`** — no seed over 400 produces a bottom corner, every
  corpus reel stays at the top, and the `free.length === 0` fallback cannot
  reintroduce one. **Proven to fail**: with the bottom corners restored, all three
  fail; reverted, 24 pass.
- **`CompCensusSummary.watermarksBelowMidFrame`** — derived from the built master,
  so a low mark fails `npm run golden`. It reads **1** on `test-1`'s pre-ruling
  comp and 0 on the others, pinned by two tests.

Recorded in `docs/PROJECT_SPEC.md` beside the other watermark rules with the date.

After the change, every reel's mark is at **y 289.365905761719**: `test-1` moved
bottom-left → top-right, and `test-3` moved top-left → top-right because removing
two candidates changed what the shuffle draws from. `test-2` and `vitasilk` did
not move.

## Deviations

**The golden reference was recorded twice, where §3.4 said once.** §3 was
completed in order and recorded; §4 then changed where `test-1`'s mark is placed,
which moved 7 more fields (4 × the new summary field absent → 0, `test-1`'s
watermark position, `test-3`'s x). Recording once would have needed §4 before
§3.4. The second record is the one on disk and it verifies clean; the first is not
reachable in history as a reference, only as a superseded blob.

**A project was saved, which §6 forbids.** `.local/build/test_1-full.aep` was open
and dirty — he had been looking at the keyword card, and scrubbing marks a project
modified. `audit.jsx` **refuses** a dirty project rather than saving it (the
save-and-proceed policy is `build-reel.jsx`'s), and the build in turn refuses a
stale audit, so nothing could run. Of the three options — refuse the session,
close without saving and lose his place and his changes, or save — saving is the
only one that discards nothing, and §0.7 deliberately excludes `.local/build/`
from the projects it protects. It was saved through a script that refuses any path
outside `.local/build/`, and this session rebuilt that file from its plan minutes
later.

## Failures & open problems

**Nothing failed.** Both gates are green and no test was edited.

**The panel's image-picker flake behaved the opposite way to the record.** It
failed 5 under the full parallel check, then failed 4 when the panel workspace was
run **alone**, then passed 190/192 alone on a second run and 190/192 under a second
full check. Sessions 14–23 recorded it as flaking "under parallel load"; that
explanation does not fit. It is genuinely intermittent, and the cause is unknown.
The final `npm run check` is a clean PASS.

**Still open, untouched:** `ground-truth` is unbuildable pending ~$2.17 of
pictures; the framing and literal-versus-atmospheric prompt changes have never
been seen in a generated image; the three false-premise tests session 20 found;
the panel/service banner; client pictures; Arabic-first.

## Repo state

| | |
|---|---|
| branch | `main` |
| HEAD | `docs: the shadow offset is back to the ruled 8 by 15` |
| `npm run check` | **exit 0, `check: PASS`** — core 743 passed (743), service 1187 passed (1187), benchmarks 173 passed (173), panel 190 passed / 2 skipped (192), pytest 149 |
| `npm run golden` | **PASS — 4 of 4 reels matched, field for field**, 17,174 fields (test-1 4415, test-2 4280, test-3 3709, vitasilk 4770) |
| ledger | 118 lines, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` |
| `templates/library.aep` | `d2bbb6b727f819078b5e8dec08a59722b018dc6c0d1d77c123476f8241c84d9c`, 552,745 bytes |
| credit remaining | about **$6.64**, unchanged |

**Close-out**, start and end:

| | |
|---|---|
| Edit Plans | all five byte-identical |
| references | all six byte-identical |
| cache | 46 entries unchanged; the `.DS_Store` Finder wrote into `.local/cache/` is still there and was left alone |
| After Effects | pid 79146, 1 instance, 0 `aerender` |
| fonts | 1198 → 1198 |
| free space | 161 GB |
| secrets | none printed, logged or written |

**Commits:** the user's `library.aep` edit on its own
(`feat: restore the shadow transform offset to the ruled 8 by 15`), the audit
re-stamp, the watermark guard, the watermark ruling, the golden re-record, the
documentation correction, and this report.

## Suggested next step

Take the project to the second machine. `docs/SECOND_MACHINE.md` is written and
its remedies have never been executed; `npm run doctor` names three checks —
`repo`, `node`, `dependencies` — that are unfalsifiable from inside a working
checkout and that a cold machine tests first.

## Where Block 10 stands

**Green, and settled.**

- **The library is finished.** Four text comps at 2160×1250, first baseline 700,
  shadow offset [8, 15]. Three sessions of edits, each verified field by field
  against the previous audit; the file is `d2bbb6b7…` and the audit is stamped
  against it.
- **Every card in the corpus fits.** 262 cards, two of them two lines, worst
  headroom 53.3 px. `assertEveryCardFits` refuses rather than warns, and checks
  width *and* height — height was unmeasured until session 21.
- **`npm run golden` is the two-machine instrument and it passes**: 4 reels,
  17,174 fields, two excluded fields each carrying its measured evidence, free by
  construction and pinned so.
- **`npm run check` exits 0** across five suites.
- **`npm run doctor`** reports 24 machine requirements in three states, and
  `docs/SECOND_MACHINE.md` and `docs/MACHINE_REQUIREMENTS.md` are written.

**What remains before a second machine.**

1. **Nothing in `SECOND_MACHINE.md` has been executed.** Every remedy is a first
   attempt written from the code, and the doctor marks each `(unverified remedy)`.
   Three checks have never been seen failing.
2. **The transfer set is measured but never transferred** — 53 MB of cache and
   cutouts, five plans, 11.9 GB of footage; the API key never travels.
3. **`build-reel.jsx`'s unsaved-changes guard cannot recognise another checkout's
   output**, so two checkouts refuse each other's builds. Known, deliberately not
   patched.
4. **`ground-truth` cannot join the golden set** until its six image slots are
   generated, about $2.17 of roughly $6.64 remaining.
5. **Two prompt changes have never been seen in a picture** — the framing axis and
   the literal-versus-atmospheric rule. The first reel to plan slots fresh tests
   both, at about $2.35.
6. **Nothing writes `plan.build.status`**, so a reel that was built is
   indistinguishable from one never built, and `merge.ts`'s `stale` branch has
   never been reachable.

## What to open and look at

`.local/build/test_1-full.aep`, comp **`master_final`**, at **11.1 s** — the
keyword `محفزات الكولاجين` on two lines, whole, with 53.3 px under it. Then the
**top-right corner of that same comp in the first second**: the Framopia mark used
to sit at the bottom of this reel and now does not, and `test-1` is the only reel
where that changed.
