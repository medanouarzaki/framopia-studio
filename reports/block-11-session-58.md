Status: OK

# Block 11 session 58 — the upscale measured, and the question put on screen

**Expected spend $0.00. No paid call of any kind and no picture generated. The
ledger is unmoved at 165 lines and the same sha256 at both ends.**

Nothing was fixed and no limit was chosen. This session produced evidence.

---

## 1. Five, not six

Session 57's part 2 table named **five** tests; its parts 3 and 6 said **six**.
**The answer is five, and the table was the correct one.**

Measured by extracting every `it()` body from `render.browser.test.ts` at
`b4ed902` (before session 57) and at `def19a3` (session 57's test commit) and
comparing them:

```
it() bodies parsed  before: 119   after: 119
CHANGED BODIES: 5
added: none      removed: none
```

The five:

1. *shows the picture the build will place, not the cut-out of it*
2. *offers the picture before the background was removed, on a cutout slot only*
3. *still shows the pictures when the service is older than the panel*
4. *says a picture is gone only when the service says it is gone*
5. *encodes the spaces in a real path*

**There is no sixth.** `git diff` over the file contains no added or removed
`it(` line at all. What session 57 miscounted was almost certainly the **sixth
changed region**, which is not a test: the fixture-and-helper block above the
`describe` — `CORPUS_PLAN`, `realFile`, `picturesSettled`, `shotsOnScreen` — which
the diff shows as its own hunk at line 552. Five tests changed what they assert;
a sixth block changed and is shared machinery.

*(The parser reads 119 bodies from 120 `it()` names because one test name occurs
twice in different `describe` blocks. No name is unaccounted for.)*

---

## 2. Where the scale is set, and what caps it

**`core/src/client-pictures.ts:61`**, inside `fitByLongEdge`:

```ts
const long = Math.max(sourceWidth, sourceHeight);
const scalePercent = (boxPx / long) * templateScalePercent;
```

Called once, from **`service/src/build/build-reel-cli.ts:589`**:

```ts
const fit = fitByLongEdge({
  boxPx: solid.width,
  templateScalePercent: solid.scalePercent,
  sourceWidth: src.width,
  sourceHeight: src.height,
});
e.placeholderScalePercent = fit.scalePercent;
```

`solid` is the audited `IMG_MAIN` layer. Measured from
`templates/library.audit.json`: **1000 × 1000 px at 100%**, on both image
templates (`img_float`, `img_slide_left`). So in practice

```
scalePercent = 100000 / max(sourceWidth, sourceHeight)
```

and a picture is enlarged whenever its long edge is under 1000 px.

**Nothing caps it. Nothing warns. Nothing records it as anything but a number.**
Searched for `Math.min`, `clamp`, `MAX_SCALE`, `maxScale` on this path — no
match. The value goes straight from `fitByLongEdge` to
`panel/jsx/build-reel.jsx:427`:

```js
layer.property('Scale').setValue([pl.scalePercent, pl.scalePercent]);
```

The only trace is one line of build stdout, which nobody reads after the build
succeeds:

```
img002: 200x200px, content 200px -> scale 500.0000% -> draws 1000x1000px inside a 1000px solid and an 1080px frame
```

---

## 3. Measured: every picture the project holds

**122 files** — 56 generated pictures in the cache, 19 cut-outs under the corpus
reels, 47 cut-outs under the browsed clients' plans.

| group | files | min | median | max | over 100% |
|---|---:|---:|---:|---:|---:|
| generated (cache) | 56 | 48.83% | 48.83% | 48.83% | **0** |
| cut-outs (corpus) | 19 | 48.83% | 48.83% | 48.83% | **0** |
| cut-outs (browsed plans) | 47 | 48.83% | 48.83% | 48.83% | **0** |
| **all** | **122** | **48.83%** | **48.83%** | **48.83%** | **0** |

**Every one of the 122 is 2048 × 2048.** There is one distinct pixel size on
disk and one distinct scale. Not a single picture this project has ever made is
enlarged.

### The 500% case, exactly

| | |
|---|---|
| file | `/private/tmp/framopia-s53-w1rKxh/small.png` |
| pixel size | **200 × 200** |
| picture | `pic003`, label `Tiny`, on client `a-scratch-client-for-session-53` |
| slot | `img002` |
| reel | *a scratch reel for session 53* (plan `…-36014bc4`) |
| drawn to | 1000 × 1000 inside the solid → **scale 500.0000%** |
| then placed at | **897 px** on screen |

It was a scratch client and a throwaway reel built in session 53 to prove a
labelled picture reaches a comp. **It is not a client's real photograph — no
real photograph has ever been through this path**, which is why the defect has
never been seen in a delivered reel.

### Can a generated picture ever be upscaled? No — and the bound is exact

A generated picture arrives at **2048 × 2048**, measured from the 56 files on
disk rather than from the configuration. (`gemini-3-pro-image` is configured 2K
1:1; the files agree.)

The largest a picture is ever **drawn on screen** is bounded twice over:

- **Measured**, across every reel with a recorded placement — `ground truth`,
  `test 1`, `vitasilk`, 15 slots: **min 837 px, median 925 px, max 969 px.**
  The two client reels, from their build logs: 837–1073 px.
- **Bounded by the frame**: a square in the top-left corner with a
  `TOP_LEFT_MARGIN` of 0.03 on a 2160 px frame cannot exceed **2030 px**, and
  `placementIsSafe` refuses anything that falls outside the frame.

**2048 ≥ 2030 ≥ every size any slot can ask for.** A generated picture is
therefore never enlarged — not on any reel that exists, and not at the
theoretical maximum either.

**So the defect is reachable only through a picture that is not 2048 px: a
client's own photograph, or a picture attached to one video.** Both arrive
through the file picker, and neither is ever resized.

---

## 4. Every step a client's photograph passes through untouched

Traced from the file picker to the layer's scale. Nothing on this path reads its
pixel dimensions.

| step | where | what it does to the picture |
|---|---|---|
| the file chooser | `panel/src/file-dialog.ts` → `cep.fs.showOpenDialogEx` | returns a path |
| the format check | `panel/src/still-formats.ts` `judgeStill` | checks the **extension**, nothing else |
| the thumbnail | `panel/src/ClientPictures.tsx` | draws it in an `<img>`; reads no size |
| the service check | `service/src/clients/create.ts:322` `checkPicture` | **absolute path, file exists, description not empty — and nothing more** |
| written to the client | `addPicture` → `modes/<client>.json` | stores `{id, path, description, label?}`; no size field exists |
| or written to the reel | `service/src/video-pictures.ts` `addVideoPicture` | same three checks, same three fields |
| chosen for a slot | `analysis/client-picture-slots.ts` or the picker | records an id |
| resolved for the build | `service/src/build/client-picture.ts` | returns `{path, id}` |
| pre-flight | `build/preflight.ts` `assertPathsPresent` | checks the file **exists**; not its size |
| the size is read | `build-reel-cli.ts:569` `imageSize(e.imagePath)` | **first and only time the dimensions are looked at** |
| the scale is set | `fitByLongEdge` | `100000 / long`, uncapped |
| written to After Effects | `panel/jsx/build-reel.jsx:427` | `setValue([scale, scale])` |

**Ten steps, and the dimensions are read at the eleventh — one line before they
are used.** `readImageDimensions` exists in `service/src/images/` but is applied
only to bytes returned by Gemini; it never sees a photograph.

---

## 5. The contact sheets

**Nothing was generated.** Both sheets are made by shrinking a picture the
project already paid for and enlarging it back.

**The two pictures**, chosen by measurement rather than by eye — the
high-frequency energy of each of `vitasilk`'s ten generated candidates was
measured, and the extremes taken:

| sheet | candidate | detail | why |
|---|---|---|---|
| `upscale-fine-detail` | `img003-c2` | 27.42 | **the most detailed** of the ten — fine gold filigree and small specular highlights, the kind of thing an enlargement has to invent |
| `upscale-flatter` | `img002-c2` | 15.82 | **the flattest** of the ten — a bottle on a dark ground, large smooth areas and one soft edge |

**Drawn at 925 px**, which is the **median placed side measured across the
corpus** — `ground truth` 957–969, `test 1` 917–925, `vitasilk` 837–925. Not a
convenient number: it is the size a picture really gets.

Each sheet holds **eight samples**: the picture as it arrives, then 100%, 125%,
150%, 200%, 300%, 400% and 500%. Every sample is drawn at the same 925 px, so
the only difference between them is how few pixels it was enlarged from. Each
carries **its scale percentage and its source pixel size printed on it**, so no
sample can be mistaken for another.

**The full paths:**

```
/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/evidence/session-58-upscale/upscale-fine-detail.png
/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/evidence/session-58-upscale/upscale-flatter.png
```

**The command that opens both:**

```
open "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/evidence/session-58-upscale/"
```

Each sheet is 2160 px wide — the video's own width, so a 925 px square is the
right fraction of the frame it will sit in — and 4618 px tall, which is as tall
as eight samples at true size need. **Viewed at 100% zoom, every square is
exactly the size it will be in a reel.**

**No threshold is recommended here and the samples are not described.** Where
"too small" begins is Mohamed's ruling, and he makes it by looking.

**Where they went, and why.** `.local/evidence/session-58-upscale/` — inside
`.local/`, which `.gitignore` excludes at line 1, verified with
`git check-ignore`. They are 11 MB of evidence for one decision, not a
deliverable, and nothing in the product reads that directory.

---

## 6. What a warning would have to be — for the next session

**Where it sits: `fitByLongEdge`, in `core/src/client-pictures.ts`.** It is
already the single place every picture's scale is decided, and it is reached by
**all four routes** a picture can arrive by:

| route | reaches `fitByLongEdge` via |
|---|---|
| a generated picture | `candidateFileFor` → `imagePath` |
| a cut-out of one | the same, with `presentation: 'cutout'` |
| a client's own photograph | `clientPictureFileFor` → the client's `path` |
| a picture attached to one video | `clientPictureFileFor` → `plan.pictures` |

A check anywhere else — in `checkPicture`, say — would catch photographs and
miss cut-outs, and would have to guess the box size, which only the audit knows.
`fitByLongEdge` already has both numbers and needs nothing new.

**The panel can say it before the build runs, and should.** The size is knowable
the moment a picture is attached, and the panel already reads `imageSize`-shaped
facts through the images view. The natural place is
`service/src/image-view.ts`, which already computes what each slot will cost and
how big each picture will be drawn — it would add *how much this one has to be
enlarged*, and `panel/src/Images.tsx` would show it beside the slot it affects.
That way the sentence appears next to the picture that caused it, before any
money moves, rather than at the end of a build.

**What it should do when it fires: warn and continue. It must not refuse.**

Three reasons, in order of weight:

1. **A refusal would throw away the only picture the client has.** A logo, a
   product shot, a photograph of a place — some of these exist at one size and
   no other. Refusing means the reel cannot be built at all, and the tool has
   substituted its judgement for the client's about their own material.
2. **This project already ruled on this shape.** The gate on generated pictures
   *advises and never blocks* — it rejects 8 of 10 candidates on this corpus and
   the user overrides it routinely. A softness rule is the same kind of
   judgement and deserves the same standing.
3. **Refusal has a worse failure mode than a soft picture.** A comp with a soft
   picture is a comp he can look at and decide about; a build that refuses tells
   him nothing about what it would have looked like.

**The number must not be fitted to this disk.** Every picture here is 2048 px
and every scale is 48.83%, so this corpus contains **no evidence at all** about
where softness begins — which is exactly why the contact sheets exist. The
threshold has to come from Mohamed looking at the ladder, and the rule that
follows from it should be expressed as *"a picture enlarged past N%"*, computed
from the picture and the box, so a video the tool has never seen gets the same
answer as this one. **A value derived from the corpus would be a value derived
from nothing.**

Written as prose only. No code, no constant, no test — that is the next
session's work, after the ruling.

---

## 7. Gates and fingerprints

**`npm run check` — PASS, exit 0.** Measured:

| workspace | measured | expected | moved? |
|---|---|---|---|
| core | 777 passed | 777 | no |
| service | 1358 passed, 1 skipped | 1358 (+1 skipped) | no |
| benchmarks | 173 passed | 173 | no |
| panel | 233 passed, 2 skipped | 233 (2 skipped) | no |

**Nothing moved, so there is no arithmetic to reconcile.** This session added no
test and changed no source file — it measured, and it wrote two images into an
ignored directory.

**`npm run golden` — PASS.** 4 of 4 matched field for field: test-1 4415,
test-2 4280, test-3 3709, vitasilk 4770 — **17,174 fields**. Ledger as golden
reports it: 165 lines, `786497a5f371d179`.

| | at start | at end |
|---|---|---|
| ledger lines | **165** | **165** |
| ledger sha256 | `786497a5f371d179…` | `786497a5f371d179…` |
| `templates/library.aep` | `4b0cf05a8f5d4775…` | `4b0cf05a8f5d4775…` |
| `modes/k2-syndicalia.json` | `c600905c5e36ecbc…` | `c600905c5e36ecbc…` |
| `modes/dr-loubna-kfafi.json` | `f60749f5629b2ced…` | `f60749f5629b2ced…` |
| `.local/quarantine-session51/` | present | present |
| `.local/quarantine-session53/` | present | present |
| After Effects instances | 1 | 1 |
| `aerender` processes | 0 | 0 |

After Effects was driven only by `npm run golden`, through `DoScript` into the
already-running instance.

---

## 8. Money

**No ledger lines added.** 165 lines at both ends, byte-identical by sha256.
Nothing here could bill: files were measured, and two contact sheets were made
by shrinking a picture that was paid for in Block 4.
