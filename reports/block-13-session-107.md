Status: OK

# Block 13, session 107 — a photograph that is not square

**Nothing was wrong with the placement.** `fitByLongEdge` already puts the whole
picture inside the box and crops nothing, which is the right thing to do with a
photograph a doctor chose. What nobody had looked at is what the picture sits
**on**: the card comp is 1200 px, the `IMG_MAIN` box is 1000 px, and the `CARD`
behind it is **1080 px square**. A 1200 × 630 photograph draws 1000 × 525 and
leaves **238 px of bare card above it and 238 px below**, inside a visible frame.

**And he was told nothing.** None of his six non-square photographs is enlarged
past 200%, so the warning session 59 built never fired on a single one.

Implemented: the fact is measured, said in the build's output, and said in the
panel beside the slot before he spends. **Golden held — 4 of 4, 17,174 fields** —
so nothing happens to a square picture. **Whether the answer is to fit, to fill or
to refuse is his ruling**, and the samples are in section 6.

Gate green, panel **392 passed**, **no picture was generated and the ledger did not
move**.

## 1. Every picture's shape, and where shape is read

Read from file headers only; nothing was decoded, opened for writing or moved.

| where | files | non-square |
|---|---|---|
| generated pictures (`.local/cache`) | **152** | **0** — every one is 2048 × 2048 |
| **his own photographs** | **22** | **6** |
| brand assets | 1 | 1 (the logo, which is not a picture in a reel) |

His six, and what each draws in the 1000 px box on the 1080 px card:

| file | source | ratio | draws | bare card | enlarged |
|---|---|---|---|---|---|
| pic016 | 6000 × 4000 | 1.500 | 1000 × 667 | **167 px** above and below | 16.7% |
| pic017 | 1200 × 630 | **1.905** | 1000 × 525 | **238 px** above and below | 83.3% |
| pic018 | 1100 × 643 | 1.711 | 1000 × 585 | **208 px** above and below | 90.9% |
| pic019 | 4776 × 6432 | 0.743 | 743 × 1000 | **129 px** each side | 15.5% |
| pic021 | 1000 × 665 | 1.504 | 1000 × 665 | **168 px** above and below | 100.0% |
| pic022 | 740 × 494 | 1.498 | 1000 × 668 | **166 px** above and below | 135.1% |
| *a generated one* | 2048 × 2048 | 1.000 | 1000 × 1000 | **none** | 48.8% |

They are pic016–pic022, the seven he added most recently and has not committed —
which is exactly when he reported the problem. pic020 is square.

**Where shape is read.** In two places, and both already read it correctly:

- `core/src/client-pictures.ts` → `fitByLongEdge` takes `sourceWidth` and
  `sourceHeight` and scales by the **long** edge. Its own comment says why it
  exists: *"a phone holds 3024x4032 … Nothing is cropped — cropping a photograph a
  doctor chose is the tool deciding which half of her results matter."*
- `service/src/build/build-reel-cli.ts` calls it for every image element, sets
  `placeholderScalePercent` from it, and centres the layer.

**So a non-square picture is neither stretched, nor cropped, nor placed
off-centre. It is fitted whole and centred — and letterboxed.** What was never
read is the **card behind it**, which is square and 80 px larger than the box.
Nothing anywhere compared the picture's shape to the frame's.

## 2. What he actually sees

The project renders nothing — that is a standing rule, and the deliverable is a
saved `.aep` — so "look" means a sheet, which is the precedent session 58 set with
its two upscale contact sheets. These are composited at the real geometry: the
1000 px box, the 1080 px card, the 1200 px comp, and the card colour from the real
`cardColours` against Dr Loubna's own palette.

**`wide-1-fit-today.png` is what he gets today** with pic017: the photograph
occupies a little over half the card, with a slab of near-black card above it and
another below. It reads as a mistake rather than as a picture with a frame.

**The portrait case is different.** `tall-1-fit-today.png` — pic019 at 0.743 —
leaves 129 px each side, and looks deliberate. The same rule produces an obvious
fault at 1.9:1 and something defensible at 1:1.35.

## 3. Fit, fill or refuse

**What each costs:**

- **Fit** — the whole picture, nothing lost, and bare card beside it. Costs: it
  looks wrong at wide ratios. Gains: it never destroys anything, and it is the
  only option that cannot be wrong about *what matters in the picture*.
- **Fill** — the frame filled, part of the picture cut off. Costs: the tool
  chooses which half of a clinical result he keeps. In the wide sample it crops
  out the practitioner's hand and the device; on a before/after photograph it
  could crop away the point. Gains: it looks like every other picture in the reel.
- **Refuse** — say it is the wrong shape and let him crop. Costs: a photograph may
  exist at one shape and no other, and the slot falls back to a generated picture,
  which is money. Gains: he keeps the choice of what to lose.

**What I chose, and did not choose.**

I implemented only the half that is not in doubt: **a square picture behaves
exactly as today** — 152 of 152 generated pictures, and golden proves it — **and
the tool now says when one is not.** It warns; it does not refuse; it does not
crop.

**I did not choose between fit, fill and refuse, and I should not.** The wide
sample argues for fill and the tall one argues for fit, which is the signature of
a taste question rather than a derivable one. Session 58 refused to pick a
softness threshold and produced contact sheets; Mohamed ruled by eye on 2026-09-05.
This is the same shape of question and gets the same treatment.

**Where a video the tool has never seen gets its answer** — the one thing that had
to be derivable, and is. The threshold for *"is that band worth mentioning"* is the
**margin the template already draws around a square picture**: `(cardPx − boxPx) / 2`,
which is 40 px here. A band thinner than that cannot read as wrong, because the
design already shows one that thick; a band at least that thick is a departure from
what the template looks like when given the shape it was built for. Both figures
are asked of `library.audit.json` by both callers, so it follows the template
rather than remembering it, and a different card would move it by itself.

That lands the threshold at 1000/920 ≈ **1.087**. A 1:1.01 picture is silent — the
brief's own floor — and all six of his are not.

## 4. Does the answer write a modified copy of his photograph?

**No. Nothing this session does touches one of his files.**

- What is added is a measurement and two sentences. No file is written, copied,
  cropped or re-encoded.
- The samples in section 6 read his photographs and write **new** files under
  `.local/evidence/`; his originals were checked byte for byte at both ends and
  every one of the 22 is unchanged, as are their dimensions.

**Said plainly for the ruling ahead:** **choosing *fill* would mean writing a
cropped copy of his photograph** — a new thing the tool does to his file, and his
ruling, not mine. Session 83's rule allows a copy inside the project and forbids
sending it anywhere; a *modified* copy is a further step nobody has taken. Choosing
*refuse* writes nothing. Choosing *fit* is what happens today.

The hard stop from session 84 — a picture must be clear of the speaker at every
frame, `process.exit(1)` otherwise — is untouched by all three: it is about where
the card sits, not what is inside it. Fill would make the picture cover more of its
own card and none of the comp, so the check sees the same card either way.

## 5. What was implemented

| where | what |
|---|---|
| `core/src/client-pictures.ts` | `bandBesideAPicture` — the band, the template's margin, which way the picture is long, and whether the band is worth saying |
| `service/src/build/soft-picture.ts` | `pictureShapeWarning` — the sentence, beside session 59's |
| `service/src/build/build-reel-cli.ts` | calls it per image, asking the audit for `CARD` beside `IMG_MAIN` |
| `service/src/image-view.ts` | `shapeOf`, and `shape` on the slot view — optional, so an older service says nothing rather than claiming the picture is fine |
| `panel/src/Images.tsx` | `WrongShape`, beside `TooSmall`, before any button that spends |

The panel's sentence, in full — no numbers, no jargon, no command:

> This photograph is wider than it is tall and the frame it goes in is square, so
> there will be bare frame beside it. It is still placed and nothing is cut off —
> a square crop of the same photograph would fill the frame.

### Three mutations, each red, each restored from a saved copy

**M1 — the template's margin stops being the yardstick, so everything warns.**

```
× bare card beside a picture that is not square > says nothing about a picture that is 1:1.01
  → expected true to be false
× bare card beside a picture that is not square > starts saying so exactly where the band matches the margin the template draws
  → expected true to be false
```

**M2 — a square picture starts leaving a band.** This is the half that must never
move: every picture the tool makes is square.

```
× bare card beside a picture that is not square > says nothing at all about a square picture
  → expected { bandPx: 40, …(3) } to deeply equal { bandPx: +0, …(3) }
```

**M3 — the panel warns about every photograph, square or not.**

```
× a photograph that is not square > says nothing about a square photograph
  → expected 'BackPictures1 image slot, 0 with cand…' not to contain 'bare frame beside it'
```

Restored from the saved copies, hashes verified: `client-pictures.ts 15fd97c7…`,
`Images.tsx 519d8840…`. **No `git checkout`, `restore` or `stash` was used to undo
a mutation.**

## 6. The samples

Six panels and two sheets, in `.local/evidence/session-107-shape/`. Each panel is
the real geometry — a 1000 px box on a 1080 px card on a 1200 px comp — and the
card colour is what `cardColours` returns for Dr Loubna's palette.

| file | what it is |
|---|---|
| `wide-all-three.png` | pic017 (1200 × 630): **fit as it is today**, **filled**, and a generated picture — what refusing leaves him |
| `tall-all-three.png` | pic019 (4776 × 6432), the same three |
| `wide-1-fit-today.png` … | each panel on its own, at 1200 × 1200 |

```
open "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/evidence/session-107-shape/"
```

**What he is being asked to rule on, in one sentence:** when a photograph is not
the shape of its square frame, should the tool keep showing all of it with bare
frame beside it, crop it to fill the frame, or refuse it and ask for a square one?

**Said plainly about the samples:** the edge-luminance measurement that picks the
card colour did not read back from `ffmpeg`, so both sheets fall back to a
mid-luminance reading, which `cardColours` answers with her background `#1C1210`.
A lighter photograph would get a lighter frame in a real build. The picture
geometry — the part being ruled on — is exact.

## 7. Nothing else moved

**`npm run golden`: PASS, 4 of 4, field for field.** 4415 + 4280 + 3709 + 4770 =
**17,174**. Every corpus picture is 2048 × 2048, `leavesABand` is false for all of
them, and no field moved — which is the check that the rule does nothing to a
square picture.

**Figures: `sora-3`, `sora-4` and `test` through the same `dryRun` and `stepsFor` —
IDENTICAL** to the session 102 reading, before and after.

**The panel's heights, unchanged from session 106**, every state inside 900 px:

| | s106 | now |
|---|---|---|
| Choose | 374 px | **374 px** |
| Make, daily | 616 px | **616 px** |
| Make, a run in progress | 896 px | **896 px** |
| Build, ready | 497 px | **497 px** |
| Build, already built once | 784 px | **784 px** |

**Session 104's type scale: 16 distinct settings**, unchanged. Spacing 28 / 16 / 8.
Pointer distances 88 px and 190 px, unchanged.

**His 22 photographs are byte-identical** at both ends, dimensions included.

## 8. What I am least sure about

**That fill is not simply right.** The wide sample is so much better filled that it
is tempting to just do it. I did not, because the same crop on a before/after
result would remove the "after" — and because `client-pictures.ts` already carries
an argument against cropping that a previous session thought hard about. If he
looks and says fill, the counter-argument was worth one session's delay; if he
says fit, not shipping it was the whole point.

**The threshold is derived, but the derivation is a judgement.** "A band as thick
as the margin the template already draws" is checkable and follows the template —
but *choosing that as the yardstick* is still a choice I made. It is defensible and
it is not measured from anything on his disk.

**The samples are composites, not builds.** Nothing renders in this project, so I
could not put a real frame in front of him. The arithmetic is the builder's own and
the geometry is from the audit, but he is looking at my reproduction rather than at
After Effects.

**I did not build a reel with a non-square photograph end to end.** Doing it would
have meant writing `chosenClientPictureId` into one of his plans, and I judged the
arithmetic certain enough not to touch his data for it. That is a real gap: the
warning has been unit-tested and panel-tested, but no reel has printed it.

**What I would change next:** measure the edge luminance properly so the sheets
carry the frame colour each photograph would really get; and once he rules, the
same `bandBesideAPicture` is what a fill or a refusal would be built on.

## 9. Gates

`npm run check`, **run alone, after committing: exit 0, `check: PASS`.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | **1589** | 0 | 1589 |
| benchmarks | 173 | 0 | 173 |
| panel | **392** | 2 | 394 |
| pytest (CV sidecar) | 149 | 0 | 149 |

core, benchmarks and pytest identical to session 106; service **1577 → 1589**,
panel **388 → 392**.

**Arithmetic: 11 tests added, 0 removed, 0 renamed — 16 more runs.** By name,
extracted from `panel/src`, `core/src` and `service/src` at `f3bda0d` and now:
panel 384 → 386, core 777 → 777, service 1536 → 1542. Two of the eleven are
`it.each`, whose names the extractor does not capture, which is why the run count
rises by more than the name count.

| added | runs | where |
|---|---|---|
| `says nothing at all about a square picture` | 1 | `clients/pictures.test.ts` |
| `says nothing about a picture that is 1:1.01` | 1 | same |
| `starts saying so exactly where the band matches the margin the template draws` | 1 | same |
| `reports the band on %s` | **6** | same — his six, measured off this disk |
| `refuses a picture with no width or height, as the fit does` | 1 | same |
| `names the shape, the size and how much card shows, without jargon` | 1 | `build/soft-picture.test.ts` |
| `says which sides the card shows on when the picture is the tall way` | 1 | same |
| `says there will be bare frame beside it, and still shows the photograph` | 1 | `photograph-warning.browser.test.ts` |
| `says which way it is long, so the sentence matches the picture` | 1 | same |
| `says nothing about %s` | **2** | same — a square photograph, and a service that cannot say |

**No test asserted retired behaviour**, because nothing was retired: the placement
is unchanged and every existing assertion about it still holds.

`npm run golden`: **PASS, 4 of 4.** **Panel suite five times: exit 0, 0, 0, 0, 0**,
392 passed and 2 skipped each.

**The panel was rebuilt.** `panel/dist/panel.js` **268,468 bytes**. The extensions
folder holds one entry, `com.framopia.studio`, a symlink to
`…/framopia-studio/panel`.

### Part 0, at both ends

| measurement | at start | at end |
|---|---|---|
| ledger records | 294 | **294** |
| ledger sha256 | `77eaf6c9…6c1a84d0` | **`77eaf6c9…6c1a84d0`** |
| `templates/library.aep` | `4b0cf05a…eca6c22aba` | **unchanged** |
| `modes/dr-loubna-kfafi.json` | `f2fa926e…`, 2026-09-12T20:52:03 | unchanged |
| `modes/k2-syndicalia.json` | `572e99bf…`, 2026-09-09T21:58:19 | unchanged |
| `.local/` directories | 16 | 16 |
| `assets/client-pictures/` | 22 files, 35M | 22 files, 35M |
| CEP extensions | `com.framopia.studio` | `com.framopia.studio` |
| After Effects | 1 (pid 89430) | 1, never launched or quit |
| `aerender` | 0 | 0 |
| listening service | pid 20822 | pid 20822, never stopped |
| `origin/main..main` | 0 | 0 after push |

`templates/library.aep` was never opened — nothing this session drove After
Effects at all. `.local/evidence/session-107-shape/` is new, inside the existing
`evidence` directory, which is why the top-level count is unchanged. His seven
uncommitted photographs and his client-file edit are exactly as found; no commit
names his paths.

## 10. Every ledger line added

**None.** 294 records, sha256
`77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0` at both ends.

No picture was generated. The samples were composited from pictures already paid
for — his own photographs, read-only, and one generated picture already in the
cache. Nothing this session made a billable call, so the $0.50 ceiling was not
approached.

## What is open

- **The ruling: fit, fill or refuse.** The samples are in section 6. Filling would
  mean writing a modified copy of one of his photographs, which is new.
- **No reel has printed the shape warning end to end** — it is unit- and
  panel-tested only.
- **The sheets' card colour is a fallback**, not the per-picture colour a real
  build derives.
- Choose with the card open is 1459 px — session 106.
- The 2026-08-29 one-column ruling stays narrowed — session 105.
- `logoPath()` in `host.ts` is read by nothing — session 104.
- The list is called *the list* and his own word is *queue* — session 103.
- Nothing says the list kept going while he was away — sessions 101–105.
- `NODE_NOT_FOUND_HELP` remains a ruling Mohamed has not made — session 101.
