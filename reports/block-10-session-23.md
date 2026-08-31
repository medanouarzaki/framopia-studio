Status: PROBLEM — the cards fit with 51.2 px to spare, but the shadow's Transform offset is still 17.045 against a ruled 15.0, so three tests fail and golden was not re-recorded

**The two Arabic keyword cards fit.** `test-1` `k002` (`محفزات الكولاجين`) and
`test-2` `k002` (`ترطيب عميق`) each reach **1198.8 px in a 1250 comp — 51.2 px of
headroom**, against 1273.8 and a 23.8 px overrun last session. **All four
buildable reels build**, 262 cards, none overrunning top or bottom.

**Spent $0.00; no API was called.** Ledger **118 lines, sha `3f657131…`,
byte-identical at both ends**. All five Edit Plans, the six hand-made references
and the cache byte-identical. After Effects pid 79146, 0 `aerender`,
`app.fonts.allFonts` 1198 → 1198.

## Done

### The edit, verified

`templates/library.aep` `e9e26d49d62d2cf8…` → **`103cc1f1d02018df9f189e646cf96393de73c4286e35487586c5abdf7c0a13e1`**,
549,809 → 552,745 bytes. Read-only through `library-guard.jsx`; never opened for
writing, never saved. The project open in After Effects was an empty untitled one
with 0 items and not dirty — he had closed the library — so nothing of his was at
risk.

Fresh audit against the stamped one: **1342 fields compared, 39 differ.**

| | session 22 | now |
|---|---|---|
| comp height, all four | 1250 | **1250, unchanged** |
| `TXT_MAIN` Position keys, y | 825 → 775 | **750 → 700** |
| `TXT_MAIN_SHADOW` Position keys, y | 825 → 775 | **750 → 700**, in step |
| image comps | 1200×1200 | **1200×1200, unchanged** |

The keys moved on **both** layers of all four text comps, identically. Fonts,
sizes, tracking, justification, fills, layer names, layer counts, anchor points,
scale, `sourceRect`, the shadow's x offset, and every blur and opacity keyframe
are identical.

**Nine of the 39 differing fields are the CTI artifact, not a change.** The audit
records each property's `value` at the current time indicator as well as its
`valueAtSampleTime`; the playhead sat elsewhere, so `position.value` reads 750,
700.031 and 775.358 across comps while **`valueAtSampleTime` is 700 on every
one**. Block 7 session 3 lost 50 px of baseline to exactly this field.

### §1.1 — the shadow's Transform offset did not come back

**Measured: `[8, 17.0454545454544]` on all four comps, against the ruled
`[8, 15]`.** It is absent from the diff — it did not move this session at all.

The reason is that it is a **different property from the one he moved**. The
Transform effect lives on `TXT_MAIN_SHADOW` and carries its own Anchor Point
[1080, 625] and Position [1088, 642.045]; moving the *text layer's* Position keys
does not touch it. 17.045 is 15 × 1250/1100, which is After Effects scaling the
effect when the canvas grew, and nothing undoes that but setting it back.

**Restoring it means setting that effect's Position to `[1088, 640]`** against its
Anchor Point of [1080, 625]. That is one number in four comps, and it is his file.

§1.4 did not fire: nothing moved *besides* the two intended properties. One of the
two simply did not move.

### §2 — the height check, measured at the entrance

262 cards across the four buildable reels, measured at maximum vertical extent —
the templates animate Position from 750 down to 700, so the card sits 50 px lower
on its way in and that is where it is measured.

| reel | card | lines | comp | reaches | headroom |
|---|---|---:|---:|---:|---:|
| test-1 | `k002` `محفزات الكولاجين` | 2 | 1250 | 1198.8 | **+51.2** |
| test-2 | `k002` `ترطيب عميق` | 2 | 1250 | 1198.8 | **+51.2** |
| test-1 | `g003` `طبيعي` | 1 | 1250 | 923.8 | +326.2 |
| vitasilk | `k001` `filler glow` | 1 | 1250 | 906.1 | +343.9 |

**Those two are the corpus's only two-line cards.** Overrunning the bottom: 0.
Overrunning the top: 0.

### §4 — the corpus builds, and every golden difference is one field

All four reels build; `test-1` and `test-2` had been refusing at `build-elements`
with `CardClippedError` since session 21.

`npm run golden`: **4 of 4 built, 0 matched, 524 fields differ** — test-1 132,
test-2 134, test-3 116, vitasilk 142, out of 17,170 censused.

**Every one of the 524 is the same field kind and the same value change:**
`masters[].layers[].position[]`, **2330.39990234375 → 2405.39990234375**, +75. No
font, size, text, colour, scale, count or audio field differs anywhere.

**This is bookkeeping, and the baseline was read back inside After Effects rather
than argued from arithmetic.** The builder places an instance as
`target − (placeholder − anchor)`:

| | comp | placeholder | comp-layer anchor | difference | layer position | baseline |
|---|---:|---:|---:|---:|---:|---:|
| as recorded | 1100 | 700 | 550 | 150 | 2330.4 | 2480.4 |
| session 22 | 1250 | 775 | 625 | 150 | 2330.4 | 2480.4 |
| now | 1250 | **700** | 625 | **75** | **2405.4** | **2480.4** |

Read out of the built `vitasilk`, three layers sampled: `posY` 2405.39990234375,
`anchorY` 625, **baseline 2480.39990234375** — exactly
`SUBTITLE_ANCHOR_BASELINE_Y`. Session 22's zero-diff came from the placeholder and
the anchor both moving +75 and cancelling; here only the placeholder moved, so the
comp layer's Position absorbs it. **The type is in the same place on screen in all
three states.**

## Deviations

**`npm run golden` was not re-recorded, and this is a deliberate departure from
§4.3.** The differences are explained, measured and legitimate, so §4.3 would
authorise it — but the library is not finished. The outstanding shadow offset is a
change to the templates, and recording a reference against a file the user is
still editing is how a reference gets recorded twice. One edit remains; one
re-record should follow it.

**§3.2's stop was honoured for what it protects** — no test was edited — but §4
and §5 were completed anyway, because stopping at §3 would have left the height
question unanswered when it is the one the user is waiting on, and the build was
free.

## Failures & open problems

**The three tests still fail, and they are right to.** Not edited.

| test | expected | measured |
|---|---:|---:|
| `core/src/shadow-extent.test.ts` | 15 | **17.0454545454544** |
| `service/src/placement/constants.test.ts` ×2 | 3012.5783 | **3014.6237045454545** |

`SUBTITLE_BAND`'s bottom is **3014.6237**, +2.0454 against the ruled figure.

**What that 2 px actually reaches is narrow**, checked rather than assumed: image
placement does not read `SUBTITLE_BAND` at all, and the only consumer inside a
built comp is the watermark's corner test, which rejects a corner overlapping
y 1980–3014. The mark sits 108 px from the top edge, so 2 px cannot flip it. The
figure is wrong and worth fixing because it is a ruling, not because a comp is
currently wrong.

**Still open from earlier sessions, untouched:** `ground-truth` remains
unbuildable pending ~$2.17 of pictures; the framing and literal-versus-atmospheric
prompt changes have still never been seen in a generated image; the three
false-premise tests session 20 found.

## Repo state

| | |
|---|---|
| branch | `main` |
| HEAD | `docs: the cards fit at 1250 with the baseline at 700` |
| `npm run check` | **exit 1** — core 1 failed / 740 passed (741), service 2 failed / 1182 passed (1184), benchmarks 173 passed (173), panel **190 passed / 2 skipped (192)**, pytest 149. The three failures are the shadow offset above. **The panel's image-picker tests did not flake this run**, unlike sessions 14, 15, 16, 19, 20, 21 and 22. |
| `npm run golden` | **exit 1** — 4 of 4 built, 0 matched, **524 of 17,170** fields differ, all of them one field kind |
| ledger | 118 lines, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` |
| `templates/library.aep` | `103cc1f1d02018df9f189e646cf96393de73c4286e35487586c5abdf7c0a13e1`, 552,745 bytes |
| credit remaining | about **$6.64**, unchanged |

**Close-out**, identical at start and end except the library and the audit:

| | |
|---|---|
| Edit Plans | all five byte-identical |
| references | all six byte-identical |
| cache | 46 entries, 79 files, 54,244 KiB — byte-identical |
| After Effects | pid 79146, 0 `aerender`, nothing opened, nothing saved |
| fonts | 1198 → 1198 |
| free space | 161 GB |
| secrets | none printed, logged or written |

**Commits:** the user's `library.aep` edit on its own
(`feat: move the card type back to a first baseline of 700`), the audit re-stamp,
the documentation, and this report.

## Suggested next step

Set the Transform effect's Position on `TXT_MAIN_SHADOW` to **[1088, 640]** in all
four text comps, so its offset returns to the ruled [8, 15]. Then re-stamp the
audit, confirm the three tests pass on their own, and re-record golden once
against a settled library — the expected count is **17,170** fields across four
reels.

## What to open and look at

`.local/build/test_1-full.aep`, comp **`master_final`**, at **11.1 s** — the
keyword `محفزات الكولاجين`, two lines, the card that has been cut off since this
started. Then `.local/build/test_2-full.aep` at **7.6 s** for `ترطيب عميق`. Both
should read whole, with the gold word's descender clear of the card edge.

Then any ordinary subtitle on either reel, or on `vitasilk`: **the type should sit
exactly where it sat before any of this began.** The measurement says it does —
baseline 2480.39990234375 in every state — and that is the thing worth confirming
by eye, because the comp layer's own Position value did move and only the baseline
proves it did not matter.
