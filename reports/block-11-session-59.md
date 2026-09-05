Status: OK

# Block 11 session 59 — a picture enlarged past 200% now says so

**Expected spend $0.00. No paid call of any kind and no picture generated. The
ledger is unmoved at 165 lines and the same sha256 at both ends.**

**Golden did not move: 17,174 fields, 4 of 4.** Nothing was written into a plan.

---

## 1. Where the threshold lives

`core/src/client-pictures.ts`, immediately above `fitByLongEdge`:

```ts
/**
 * How far a picture may be enlarged before anyone is told about it.
 *
 * **200%, and it is a taste ruling — not a measured constant.** Mohamed chose it
 * by eye on 2026-09-05, looking at the two contact sheets Block 11 session 58
 * produced:
 *
 * ```
 * .local/evidence/session-58-upscale/upscale-fine-detail.png
 * .local/evidence/session-58-upscale/upscale-flatter.png
 * ```
 *
 * Each sheet shows the same picture drawn at 925 px — the median size a picture
 * really gets in a reel — from sources of 2048, 1000, 800, 667, 500, 333, 250
 * and 200 px, labelled with the percentage each represents. His reasons were
 * that a picture is small on screen and softness does not read at that size,
 * and that the topmost rung was too far.
 *
 * **Nothing on this disk implies this number.** Every one of the 122 pictures
 * the project holds is 2048 x 2048 and draws at 48.83%, so the corpus contains
 * no evidence about softness at all — which is why the sheets were made. Do not
 * re-derive it from anything here; it changes when he looks again and says so.
 *
 * It is compared against **the picture and its box**, never against a pixel
 * size, so a video the tool has never seen gets the same answer as this one.
 */
export const SOFT_ENLARGEMENT_PERCENT = 200;
```

`fitByLongEdge` now returns two more fields beside the three it already did:

```ts
const enlargementPercent = (boxPx / long) * 100;
return {
  scalePercent,
  drawnWidth: sourceWidth * factor,
  drawnHeight: sourceHeight * factor,
  enlargementPercent,
  // Strictly past: at exactly 200% nothing is said, which is the ruling.
  tooEnlarged: enlargementPercent > SOFT_ENLARGEMENT_PERCENT,
};
```

**`enlargementPercent` is `boxPx / long`, not `scalePercent`.** The two are equal
only while a template's own scale is 100, and what is being judged is the
picture, not the layer.

**It computes and does not decide.** Nothing in `core` prints, throws or refuses
on either field.

**Additive, and no caller broke**: every existing caller destructures the three
original fields. The only production caller is `build-reel-cli.ts:589`.

### How each of the four routes reaches it

Session 58 established that all four converge on this one function, and they
still do:

| route | reaches `fitByLongEdge` via |
|---|---|
| a generated picture | `candidateFileFor` → the candidate's `path` → `imageSize` → `fitByLongEdge` |
| a cut-out of one | the same, with `presentation: 'cutout'` selecting `cutoutPath` |
| a client's own photograph | `clientPictureFileFor` → the client's `path` → the same two lines |
| a picture attached to one video | `clientPictureFileFor` → `plan.pictures` → the same two lines |

A check anywhere earlier — in `checkPicture`, say — would catch photographs and
miss cut-outs, and would have to guess the box size, which only the audit knows.

---

## 2. Every new assertion, proved to fire

**Eight in `service/src/clients/pictures.test.ts`, two in
`panel/src/render.browser.test.ts`.** Five breaks, each restored.

### Red 1 — the ruling loosened from 200% to 500%

```
× a picture too small for the space it is given > says nothing at exactly 200%
  → expected 200 to be close to 500, received difference is 300, but expected 5e-10
× a picture too small for the space it is given > warns a hair past 200%
  → expected 200.4008016032064 to be greater than 500
× a picture too small for the space it is given > measures the long edge, whichever it is
  → expected false to be true // Object.is equality
× a picture too small for the space it is given > warns about the 200 px picture that started this
  → expected false to be true // Object.is equality
```

### Red 2 — `>=` instead of `>`, so exactly 200% would warn

```
× a picture too small for the space it is given > says nothing at exactly 200%
  → expected true to be false // Object.is equality
Tests  1 failed | 14 passed (15)
```

The boundary is the ruling, and it is pinned in both directions.

### Red 3 — measured against a pixel size instead of the box

`(boxPx / long)` replaced by `(1000 / long)`, which is right on this corpus and
wrong anywhere else:

```
× a picture too small for the space it is given > is measured against the box, never against a pixel size
  → expected 200 to be close to 80, received difference is 120, but expected 5e-10
Tests  1 failed | 14 passed (15)
```

**This is the test that stops the rule being fitted to this disk.** The same
picture is silent in a 400 px box and warned about in a 2000 px one.

### Red 4 — the panel never says it

```
× the image candidate picker > says a small picture will look soft, and still shows it
  → expected 'img001on screen 0.1s to 1.6sA single …' to contain 'small for the space it fills'
```

### Red 5 — the panel says it on every slot

```
× the image candidate picker > says nothing about a picture that is big enough
  → expected 'img001on screen 0.1s to 1.6sA single …' not to contain 'small for the space it fills'
```

**All five restored, and green again:** service `Tests 15 passed (15)` on
`pictures.test.ts`, panel `Tests 17 passed | 105 skipped (122)` on the picker.

### What the eight cover

| test | what it pins |
|---|---|
| is measured against the box, never against a pixel size | the same picture is fine in a small box and stretched in a large one |
| says nothing at exactly 200% | the boundary is *past*, not *at* |
| warns a hair past 200% | 499 px in a 1000 px box fires |
| says nothing about a picture drawn at its own size | 100% is silent |
| says nothing about a generated picture, even in the largest box the frame allows | 2048 px in the 2030 px frame bound is silent |
| says nothing about a picture larger than its box | a 3024×4032 phone photograph is silent |
| measures the long edge, whichever it is | 400×100 and 100×400 both fire at 250% |
| warns about the 200 px picture that started this | the session-53 case, 500% |

The panel's two assert the sentence appears on a small picture and does not on a
normal one, that **the slot's three pictures are still there and still drew**
(read as extracted values, never as live handles), and that the sentence names
no terminal, no command and no restart.

---

## 3. The exact sentence

Shown beside the slot it is about, in `panel/src/Images.tsx`:

> **This picture is small for the space it fills, so it will look soft. It is
> still placed — a bigger version of the same picture would look sharper.**

**No percentage on screen.** A number there would invite tuning; what he can act
on is whether to use a bigger file.

**It never replaces anything** — asserted, not assumed: the slot's pictures are
still rendered and still load while the sentence is up.

**The build says it too**, so a warning is not lost when a build runs with nobody
watching. `build-reel-cli.ts`, after the existing scale line:

```
warning [img002]: this picture is 200x200px and is being drawn at 1000px, so it is
enlarged 500% and will look soft. It is still placed; a larger copy of the same
picture would look sharper.
```

`leave-the-panel.test.ts` passes — 2 tests.

---

## 4. Golden did not move

**17,174 fields, 4 of 4 matched field for field**: test-1 4415, test-2 4280,
test-3 3709, vitasilk 4770. Identical to the reference; no reconciliation is
needed and the reference was **not** regenerated.

**The enlargement is computed and displayed, never written into a plan.** It is
derived at the moment the images view is asked for, from the picture on disk and
the audited box — both of which already exist — so there is no new field on any
plan and nothing for the census to count.

---

## 5. Every picture path, audited

**96 paths checked across every client and every plan. None is missing.**

| what was checked | count |
|---|---|
| pictures on `modes/k2-syndicalia.json` and `modes/dr-loubna-kfafi.json` | 0 — neither real client has attached one yet |
| logos on those two clients | 0 — neither names one |
| `plan.pictures` on all seven plans | 0 — no reel has its own picture yet |
| candidate `path` and `cutoutPath` across all seven plans | 96 |
| **missing** | **0** |

**The session-53 scratch client is not on the live list.** `modes/` holds
`dr-loubna-kfafi.json` and `k2-syndicalia.json` and nothing else — session 53
moved the scratch client to `.local/quarantine-session53/` at the time.

Checked there as well, because that is where the 500% case lives: all four of
its pictures **still exist** at `/private/tmp/framopia-s53-w1rKxh/`, including
`small.png` at 200×200, and the quarantined plan still names `img001->pic001`
and `img002->pic003`. It is a temp directory that a reboot will sweep, and the
quarantined client and plan will then name four dead paths.

**Nothing was fixed, deleted or cleaned up.** What to do about a quarantined
scratch client pointing at `/private/tmp` is its own decision and not this
session's.

---

## 6. Gates, arithmetic and fingerprints

**`npm run check` — PASS, exit 0.** Measured:

| workspace | before | measured | change |
|---|---|---|---|
| core | 777 | **777** | none |
| service | 1358 (+1 skipped) | **1366** (+1 skipped) | **+8** |
| benchmarks | 173 | **173** | none |
| panel | 233 (2 skipped) | **235** (2 skipped) | **+2** |

**Reconciled by name — +8 in `service/src/clients/pictures.test.ts`**, all in the
new `describe('a picture too small for the space it is given')`:

1. is measured against the box, never against a pixel size
2. says nothing at exactly 200%
3. warns a hair past 200%
4. says nothing about a picture drawn at its own size
5. says nothing about a generated picture, even in the largest box the frame allows
6. says nothing about a picture larger than its box
7. measures the long edge, whichever it is
8. warns about the 200 px picture that started this

**+2 in `panel/src/render.browser.test.ts`**, both in `the image candidate picker`:

1. says a small picture will look soft, and still shows it
2. says nothing about a picture that is big enough

8 + 2 = 10. Nothing was removed or renamed. The arithmetic closes exactly.

**Five panel runs, each one:**

| run | result |
|---|---|
| 1 | 235 passed, 2 skipped (237) |
| 2 | 235 passed, 2 skipped (237) |
| 3 | 235 passed, 2 skipped (237) |
| 4 | 235 passed, 2 skipped (237) |
| 5 | 235 passed, 2 skipped (237) |

No test failed on any of the five. The picker flake closed in session 57 stayed
closed with two more tests added to the same view — evidence about five runs.

**`npm run golden` — PASS**, 4 of 4, 17,174 fields, reference unchanged.

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

## 7. Money

**No ledger lines added.** 165 lines at both ends, byte-identical by sha256.
Nothing here could bill: a comparison of two numbers, a sentence, and a test.
