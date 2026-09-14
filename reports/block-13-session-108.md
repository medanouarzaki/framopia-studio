Status: OK

# Block 13, session 108 — crop a photograph to fill its frame

Mohamed ruled fill. A photograph that is not square is cropped to the centre and a
**square copy is written beside the original**, which is read and never written.

**The crop fired on a real build**, which was session 107's honest gap:

```
img001: this picture is 1600x700px, wider than it is tall, and the frame it goes in is
square, so 56% of it is cropped off the sides to fill the frame. The square copy is made
and kept beside the original, which is untouched.
img001: 700x700px, content 700px -> scale 142.8571% -> draws 1000x1000px inside a 1000px
solid and an 1080px frame
```

It draws **1000 × 1000** — the whole frame — where it would have drawn 1000 × 437.
**Golden held, 4 of 4, 17,174 fields**, so nothing happens to a square picture.
**All 22 of his photographs are byte-identical at both ends**, dimensions included.
Gate green, panel **392**, service **1598**, **$0.00 spent**.

## 1. Where the crop falls

**Centre — and it is measured, not assumed.**

The worry is real: a product to one side of a wide photograph is cut out by a
centre crop, and he would find out watching the finished video. The CV sidecar
already finds a person in a frame, so before choosing I ran it over all six
non-square photographs and asked where a person-aware crop would put its centre
against where a centre crop puts it:

| file | person covers | a person-aware crop would move the centre |
|---|---|---|
| pic018 | 86.3% | **0 px** |
| pic019 | 80.6% | **0 px** |
| pic021 | 70.6% | **0 px** |
| pic022 | 52.8% | **0 px** |
| pic017 | 45.1% | 68 px |
| pic016 | **1.2%** | **512 px** |

**On five of six a person-aware crop *is* the centre crop.** The person fills so
much of the frame that the mask's bounding box is centred on the frame. The one
case where it would move the crop a long way is the one where it found almost
nothing — and where the mask it returned did not even match the file's own shape
(it came back 4000 × 6000 for a 6000 × 4000 file, which `sips`, `ffprobe` and PIL
all agree on).

**So the sidecar cannot help.** It is MediaPipe's *selfie* multiclass segmenter —
confident about a speaker facing a camera, silent about a product on a table,
which is exactly the case the worry is about. It is local and free, so cost is not
the objection; being confidently wrong where it matters most is.

**Centre holds for a photograph the tool has never seen** because it reads nothing
but two numbers and is fitted to nothing: the same arithmetic for a portrait, a
panorama and a square. An honest default beats a clever guess.

**And he can see what was cut**, which is the real protection — section 5.

## 2. The copy

**Where it lands:** `assets/client-pictures/<owner>/<pictureId>-square-<sha16>.<ext>`
— beside the original, in the one store session 62 established and session 83
pushes to GitHub, so both rules carry it with nothing further to do.

**Nothing can collide**, by construction rather than by hoping:

| two of what | what keeps them apart |
|---|---|
| two clients | different owner directory |
| two photographs | different picture id, unique within its owner |
| two videos' own pictures under one client | the source's sha256 is in the name |

**The owner is read off the original's own path** — the directory a photograph is
stored in *is* its owner — so a crop cannot land under a different owner than the
picture it came from.

**It is not re-cropped every build.** The name is a function of the source's bytes,
so a build that finds the file finds the crop it would have made. A test asserts
the second call reports `made: false` and the file's mtime is unchanged.

**If he replaces the photograph, the crop is remade** — different bytes, different
sha, a name not on disk yet. **How I know:** the key is `sha256` of the file's
contents, not its path or its mtime.

**Nothing is deleted.** A superseded crop keeps its own name and stays beside the
new one; a test asserts the old file still exists after the source is replaced.

**The frame is deliberately not in the key.** The crop is to a square at the
source's full resolution and every square box wants the same square; only a
template that stopped being square would invalidate it, and that would change
`bandBesideAPicture` first.

**It is never sent anywhere.** Session 83 left an allow-list of one destination.
`squareCopyOf` asks `isInClientPictureStore` before a byte is written and throws
otherwise — asserted, not remembered, and mutation M3 proves it fires.

**His files are untouched.** All 22 hashed at both ends: identical, dimensions
included. The crop test also asserts it on a scratch file, and `squareCopyOf`
takes `repoRoot` as a parameter precisely so a test can never write beside his
photographs.

## 3. What is square stays exactly as it is

Below session 107's threshold — a band as thick as the margin the template already
draws, asked of the audit — **nothing happens: no crop, no copy, no warning.**

**`npm run golden`: PASS, 4 of 4, field for field.** 4415 + 4280 + 3709 + 4770 =
**17,174**. Every corpus picture is 2048 × 2048; **no crop line appears anywhere in
the golden log**, which is the direct evidence that the rule never reached them.

## 4. What the panel says now

Session 107's sentence described a problem. It now describes an action:

> This photograph is **wider than it is tall** and the frame it goes in is square,
> so the **sides** will be cropped off to fill the frame. **The picture above is
> what will be used. Your own file is not changed.**

A tall photograph says *top and bottom*. It sits beside the slot, before any button
that spends, where session 59's soft-picture warning sits. No numbers, no jargon, no
command, and a test asserts the sentence contains no digit.

**"The picture above is what will be used" is true, and making it true was work.**
The picker drew `picture.path` — the original — so the sentence would have been a
lie. The service now makes the square copy when it builds the picker's list and
sends `squarePath`; the panel draws `squarePath ?? path`. Cropping at preview time
is the point: he sees the crop before he presses anything, and the build then finds
the copy already there.

## 5. The real reel

Built through the build the panel drives, on **a scratch plan and a scratch
photograph** — never his:

- scratch photograph: a 1600 × 700 `testsrc` pattern in the session scratchpad
- scratch plan: `.local/plans/session-108-crop-scratch.editplan.json`, a copy of
  `test 1`'s plan with `img001` pointed at a picture attached to the reel

**What it produced**, verbatim, is at the head of this report: 56% cropped off the
sides, the square copy made and kept, and the picture drawing **1000 × 1000 inside
a 1000 px solid and an 1080 px frame**.

**Every picture is still clear of the speaker.** Session 84's stop is not a
formality that happened to pass — it actively bounded all four:

```
img001: 925px in the top-left corner, bounded by the space above the speaker
img002: 917px in the top-left corner, bounded by the space above the speaker
img003: 921px in the top-left corner, bounded by the space above the speaker
img004: 917px in the top-left corner, bounded by the space above the speaker
  rejected top-left: overlaps something already on screen
```

The crop changed what is drawn — 1000 × 1000 rather than 1000 × 437 — and the
placement still bounded it by the space above her. The build exited 0 and saved.

```
open "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/build/session-108-crop-scratch-full.aep"
```

**Three artefacts this session created**, named so nothing is unexplained:

| what | where |
|---|---|
| the built `.aep` | `.local/build/session-108-crop-scratch-full.aep` |
| the scratch plan | `.local/plans/session-108-crop-scratch.editplan.json` |
| the scratch crop the `.aep` references | `assets/client-pictures/k2-syndicalia/own001-square-36edce6bb5292d42.png` |

The third is the one untracked file in a pushed directory. It is **not one of his
photographs** — it is a crop of a `testsrc` pattern I generated — and it is kept
only because deleting it would leave the `.aep` pointing at nothing. It is his to
delete once he has looked.

## 6. His six, before and after

```
open "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/evidence/session-108-crop/"
```

`all-six.png` is all six at once; each `picNNN-both.png` is one, fitted on the left
and cropped on the right, on the real 1080 px card.

| file | loses | what it loses |
|---|---|---|
| **pic016** reception | 33% | the sofa and table at the left, part of the red banner at the right. **The "Dr Loubna Kfafi" sign becomes legible** — it is better cropped |
| **pic017** laser on face | 48% | the practitioner's pink-gloved second hand and the red-clothed figure at the right |
| **pic018** FOCUS device | 42% | shoulder and towel at the right |
| **pic019** portrait | 26% | the top of her head and a little of her neck |
| **pic021** syringe to hairline | 34% | a strip of bed and wall either side |
| **pic022** injection | 33% | part of the gloved hand at the lower left |

**Not one of the six loses its subject.** In all six the face and the device being
applied survive and are larger; pic016 is improved. That is a favourable sample and
I will not generalise from it — every one is a centre-composed clinical photograph,
which is the case a centre crop is best at. A product sitting off to one side is
the case that would suffer, and it is the reason the panel shows the crop.

## 7. Every new assertion

**M1 — the crop takes the long edge**, so it asks for pixels that are not there.

```
× a square copy of a photograph that is not square > crops a wide picture to its short edge, and says what was lost
  → Command failed: … -vf crop=1200:1200:0:-285 …
× a square copy of a photograph that is not square > crops a tall picture the same way
  → Command failed: … -vf crop=1024:1024:-192:0 …
```

**M2 — the crop stops being named after the bytes**, so replacing the photograph
does nothing.

```
× writes into the picture store, under the owner, named after the bytes
  → expected 'pic001-square-aaaaaaaaaaaaaaaa.png' to be 'pic001-square-923c876683c3bd7c.png'
× remakes the crop when the photograph is replaced, and keeps the old one
  → expected '/var/folders/…' not to be '/var/folders/…'
```

**M3 — session 83's allow-list of one destination goes.**

```
× refuses to write anywhere but the picture store
  → expected function to throw an error, but it didn't
```

Restored from the saved copies, hashes verified: `client-pictures.ts 8176a695…`,
`crop.ts 2790eb00…`, `Images.tsx 08b52c7d…`. **No `git checkout`, `restore` or
`stash` was used to undo a mutation.**

## 8. Nothing else moved

**Figures: `sora-3`, `sora-4` and `test` through the same `dryRun` and `stepsFor` —
IDENTICAL** to the session 102 reading, before and after.

**The panel's heights, unchanged from sessions 106 and 107:**

| | s107 | now |
|---|---|---|
| Choose | 374 px | **374 px** |
| Make, daily | 616 px | **616 px** |
| Make, a run in progress | 896 px | **896 px** |
| Build, ready | 497 px | **497 px** |

**Session 104's type scale: 16 distinct settings**, unchanged. Spacing 28 / 16 / 8.
Pointer distances 88 px and 190 px.

## 9. What I am least sure about

**Cropping at preview time writes files when he opens the picture editor.** It is
what makes "the picture above is what will be used" true, and it means six crops
appear in his store the first time he opens that editor on a plan of hers. Nothing
is destroyed and nothing is sent, but a screen that writes to disk on being looked
at is a thing worth him knowing about, and I have not asked.

**56% of a photograph is a lot to take.** The build says the figure out loud and
the panel shows the result, but a number in a log is not the same as him noticing.
If a crop ever does remove the point of a photograph, the first thing he will see
is the picker's thumbnail — which is why that had to be the crop and not the
original.

**Centre is right for his six and I cannot promise it for the seventh.** The
measurement says the sidecar would not have helped on any of these; it does not say
a better rule is impossible, only that the one tool available is not it.

**The scratch crop sits in a real client's directory.** The scratch photograph lived
outside the store, so the owner fell back to the plan's client, `k2-syndicalia`.
That is correct behaviour — the client owns the reel — but it means a reel-attached
picture from outside the store files its crop under the client rather than under
the video. The sha in the name prevents collision, so nothing breaks; it is a
tidiness question I did not resolve.

**What I would change next:** say in the panel that opening the editor makes the
crops, or make them on choosing rather than on looking.

## 10. Gates

`npm run check`, **run alone, after committing: exit 0, `check: PASS`.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | **1598** | 0 | 1598 |
| benchmarks | 173 | 0 | 173 |
| panel | **392** | 2 | 394 |
| pytest (CV sidecar) | 149 | 0 | 149 |

core, benchmarks, pytest and panel identical to session 107; service **1589 → 1598**.

**The gate's first run failed**, exit 1, on one `no-unused-vars` in the new crop
test. The import was dropped, committed separately, and the gate re-run alone from
a clean commit. Reported because both suites were green while the gate was not —
the same shape of miss as session 106.

**Arithmetic: 11 added, 3 rewritten, 0 deleted.** By name, from `panel/src`,
`core/src` and `service/src` at `852b688` and now: panel 386 → 386, core 777 → 777,
service 1542 → 1551.

| added — all in `service/src/clients/crop.test.ts` unless noted |
|---|
| `crops a wide picture to its short edge, and says what was lost` |
| `crops a tall picture the same way` |
| `writes into the picture store, under the owner, named after the bytes` |
| `does not crop again when the crop is already there` |
| `remakes the crop when the photograph is replaced, and keeps the old one` |
| `refuses to write anywhere but the picture store` |
| `says so rather than guessing when the picture is not there` |
| `leaves the source byte-identical` |
| `does not claim to have made a copy that was already there` — `soft-picture.test.ts` |
| plus two `soft-picture.test.ts` names below, rewritten rather than added |

**Three tests asserted retired behaviour and were rewritten, never deleted** —
session 107's sentence described a problem and now describes an action:

| was | is |
|---|---|
| `says there will be bare frame beside it, and still shows the photograph` | `says the sides will be cropped off, and still shows the photograph` |
| `names the shape, the size and how much card shows, without jargon` | `names the shape, the size and how much was cut, without jargon` |
| `says which sides the card shows on when the picture is the tall way` | `says which sides were cut when the picture is the tall way` |

Each keeps every assertion it had — the size, the shape, no jargon, no command, no
refusal — and each gained one: that the sentence says his original is untouched.

`npm run golden`: **PASS, 4 of 4.**

**Panel suite five times: exit 1, 0, 0, 0, 0 — then 0, 0, 0, 0, 0.** The first
attempt's run 1 failed on the build-stamp check (*expected … to contain 'The
companion service was out of date'*): the lint fix had changed `service/src` after
the last `panel:build`, so the bundle carried a stamp older than the service's.
Both were rebuilt and the five runs repeated clean. Reported rather than quietly
re-run.

**The panel was rebuilt.** `panel/dist/panel.js` **268,540 bytes**. The extensions
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
| `assets/client-pictures/` | 22 files, 35M | **23 files**, 35M |
| **his 22 photographs** | 22 hashes | **all 22 byte-identical, dimensions identical** |
| CEP extensions | `com.framopia.studio` | `com.framopia.studio` |
| After Effects | 1 (pid 89430) | 1, never launched or quit |
| `aerender` | 0 | 0 |
| listening service | pid 20822 | pid 20822, never stopped |
| `origin/main..main` | 0 | 0 after push |

The 23rd file is the scratch crop named in section 5 — a crop of a generated test
pattern, not a photograph of hers. `templates/library.aep` was read by the build
and never written; its sha256 is unchanged. Nothing was saved in his After Effects.

## 11. Every ledger line added

**None.** 294 records, sha256
`77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0` at both ends.

No picture was generated. A crop is ffmpeg on local pixels and bills nothing; the
reel was built, and building is free. The $0.50 ceiling was not approached.

## What is open

- **Opening the picture editor writes the crops.** Section 9.
- **The scratch crop in `k2-syndicalia/`** is his to delete once he has opened the
  `.aep`.
- **A reel-attached picture from outside the store files its crop under the
  client**, not the video. No collision; a tidiness question.
- Choose with the card open is 1459 px — session 106.
- The 2026-08-29 one-column ruling stays narrowed — session 105.
- `logoPath()` in `host.ts` is read by nothing — session 104.
- The list is called *the list* and his own word is *queue* — session 103.
- Nothing says the list kept going while he was away — sessions 101–105.
- `NODE_NOT_FOUND_HELP` remains a ruling Mohamed has not made — session 101.
