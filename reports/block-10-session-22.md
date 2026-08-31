Status: PROBLEM — the comps are 1250 tall and that is 23.8 px short; `test-1` and `test-2` still refuse to build

**Spent $0.00; no API was called.** Ledger **118 lines, sha
`3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c`, byte-identical
at both ends**. `templates/library.aep` was not edited by this session — the file
the user handed over is the file that was read, `e9e26d49d62d2cf8…`, 549,809 bytes,
identical at both ends. All five Edit Plans, the seven hand-made references and
the cache byte-identical. After Effects pid unchanged, 0 `aerender`,
`app.fonts.allFonts` 1198 → 1198.

## 1. The edit did what he said, and two things he did not mention

The four text comps are **2160×1250**, up from 2160×1100. `img_slide_left` and
`img_float` are untouched at 1200×1200.

Diffing the fresh audit against the stamped one: **1342 fields compared, 61
differ.** Beyond the height, exactly two properties moved, and they moved
**identically on all four comps**:

| | before | after |
|---|---|---|
| comp height | 1100 | **1250** |
| `TXT_MAIN` Position keys, y | 750 → 700 | **825 → 775** |
| `TXT_MAIN_SHADOW` Transform offset, y | 15.0 | **17.045** |

Identical on every comp: fonts, font sizes, tracking, justification, fill
colours, layer names, layer counts, anchor points, scale, `sourceRect`, the
shadow's x offset, and every blur and opacity keyframe.

**Neither is a mistake he made.** After Effects re-centres a comp's contents when
the canvas grows, so the baseline moved by **+75 — exactly half of +150** — and
the shadow's Transform offset scaled with the layer. He did leave the first
baseline at 700 in the sense he meant: relative to the type, nothing moved. In
the comp's own coordinates it is at 775.

**This is §1.3's stop condition and it is reported rather than worked around.**
The audit was re-stamped and §2 proceeded, because the two moved properties are
consequences of the resize rather than separate edits, and stopping without
measuring what they cost would have left the user with no number.

## 2. What the re-centring costs, measured

**The baseline move is invisible on screen.** The builder positions an instance
as `target − (placeholder − anchor)`, and that difference is **150 both before
and after** — the comp layer's anchor moved 550 → 625 with the placeholder's
750 → 825. Verified by building and censusing the two reels with no two-line
card, against the recorded golden reference with `measuredAt`, `aepSha256`,
`aeVersion` and `fontNameCount` excluded and paths normalised:

| reel | fields compared | differing |
|---|---:|---:|
| `test-3` | 3708 | **0** |
| `vitasilk` | 4769 | **0** |

Not one field. §3.4's question — whether a reel with no two-line card moved — is
answered no, on both reels, by measurement.

**The shadow's 2.045 px is not invisible.** `shadowDescentPx` reads that offset
out of the audit and `SUBTITLE_BAND` is derived from it, so the band's bottom
moved **3012.5783 → 3014.6237 px**. The band bounds where every image is placed.
Three tests fail on it and **were left failing**:

- `core/src/shadow-extent.test.ts` — expected 15, got 17.045
- `service/src/placement/constants.test.ts` ×2 — expected 3012.5783, got 3014.6237

They are not tests asserting retired behaviour. The +8/+15 shadow offset is a
user ruling, §5 forbids changing it, and updating the tests would ratify a change
nobody decided to make.

## 3. 1250 is not enough, and here is the number

| reel | worst card | reached | comp | verdict |
|---|---|---:|---:|---|
| `test-1` | `k002` `محفزات الكولاجين`, Almarai-Bold 455, two lines | **1273.8** | 1250 | **23.8 px short** |
| `test-2` | `k002` | 1273.8 | 1250 | **23.8 px short** |
| `test-3` | — | — | 1250 | builds |
| `vitasilk` | — | — | 1250 | builds |

Both refuse at `build-elements` with `CardClippedError`, before anything is
saved. **`npm run golden` therefore fails and the reference was not re-recorded**
— two of the four reels do not build, and the two that do are byte-identical to
what is already recorded, so there is nothing to record.

**Why 1250 fell short of the computed 1197 minimum.** That minimum assumed the
type stayed where it was. Because the contents re-centre, **+150 of comp height
buys +72.955 of room below the card**: +75 is spent moving the baseline down and
2.045 more on the shadow reaching further.

**Two ways out, both his:**

- **Make the comps ≥ 1298.8.** At 1300 the margin is 0.6 px; at 1400 it is 49.2.
  Anything under 1298.8 fails again, and re-centring will move the baseline and
  the shadow again by half the new increment.
- **Keep 1250 and put the first baseline back at 700** inside the taller comp.
  Worth **+53.3 px** on its own, which clears the 23.8 px shortfall with room,
  costs no further height, and restores the shadow offset to 15.0 and
  `SUBTITLE_BAND` to 3012.5783 — which would make the three failing tests pass
  again for the right reason.

The second is the smaller edit and the one that leaves every constant where it
was ruled. **This session made neither**; the comps are his file.

## 4. Written down

`docs/TEMPLATE_LIBRARY_GUIDE.md` §3 records the new size and gains §11, which
states what has to fit from the baseline down, that `assertEveryCardFits` refuses
rather than warns, the 1273.8/1250 figure, and the re-centring trap with both
remedies. `docs/PROJECT_SPEC.md` §3 records the same under the existing
clipped-card ruling.

**No file outside `reports/` and `handoffs/` carried the old library sha256**, so
there was nothing to update: `handoffs/block-9.md` states it as a fact about that
session and is history.

## 5. `npm run check`

**Exit 1.** Per workspace: core **1 failed / 740 passed (741)**, service **2
failed / 1182 passed (1184)**, benchmarks **173 passed (173)**, panel **5 failed /
185 passed / 2 skipped (192)**, pytest 149.

The three core and service failures are §2's, deliberate. The five panel failures
are the known image-picker browser flake under parallel load — the same five that
have appeared in sessions 14, 15, 16, 19, 20 and 21; they pass when the panel
workspace is run alone.

## 6. Close-out

| | |
|---|---|
| spend | **$0.00**, ledger byte-identical |
| `templates/library.aep` | not edited by this session, identical at both ends |
| Edit Plans | all five byte-identical |
| hand-made references | all seven byte-identical |
| cache | byte-identical |
| After Effects | same pid, 0 `aerender`, nothing opened, nothing saved |
| `app.fonts.allFonts` | 1198 → 1198 |
| secrets | none printed, logged or written |

**Commits:** the user's `templates/library.aep` edit on its own
(`feat: make the text card comps 1250 tall`), the audit re-stamp, the
documentation, and this report.

**Open, and blocking:** the corpus is not green and `npm run golden` cannot run
until the comps clear 1298.8 or the baseline goes back to 700.
