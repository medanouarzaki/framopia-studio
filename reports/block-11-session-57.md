Status: OK

# Block 11 session 57 — the image-picker tests now assert something real

**Expected spend $0.00. No paid call of any kind. The ledger is unmoved at 165
lines and the same sha256 at both ends.**

Open item 6 is closed.

---

## 1. The 278 commits, reconciled — nothing is unaccounted for

Measured, not carried:

| range | count |
|---|---:|
| `d53a70b..85a08eb` — everything up to and including session 53's report | **271** |
| `85a08eb..c7df82f` — session 54 | **5** |
| `c7df82f..661f387` — session 55 | **2** |
| **total** `d53a70b..661f387` | **278** |

271 + 5 + 2 = 278. **The five are session 54's, and they were never missing.**

**Where the confusion came from.** `271` is the correct count *as of the end of
session 53*. It was printed by a `git status` during session 54 — before session
54 had committed anything — and session 54's report quoted it. **Session 55 then
repeated `271` as a measurement of its own, and it was not one**: by the time
session 55 ran, the true figure was 276 at its start and 278 at its end. Session
56 said the difference was "sessions 54 and 55", which is right in substance —
5 + 2 = 7 — but its wording implied session 54's commits came after the 271 was
taken, when in fact all five came before it was quoted.

**No session committed more than its report claimed.** Session 54 reported five
commits and made five; session 55 reported two and made two. Session 54's five:

```
48309e2  feat: write a picture's label and edit a client in the panel
1a4459d  feat: attach pictures to one video, labelled the same way
bef6e04  feat: replace run pipeline with make the subtitles and the pictures
a008e68  test: click every new control in the real built panel
c7df82f  docs: report block 10 session 54
```

The range spans Block 9 session 1 through Block 10 session 55 — it was never
"sessions 54 and 55", it was every session since 29 August.

---

## 2. What the tests actually asserted

**One file exercises the image picker:** `panel/src/render.browser.test.ts`,
`describe('the image candidate picker')` — **15 tests**. `panel/src/picture.test.ts`
tests `pictureFor` and `fileUrl` as functions and touches no fixture path.

### The fixtures, and where the files really are

| fixture | path it named | on disk today |
|---|---|---|
| `REAL_C1` | `my files/test videos/cutouts/img001-c1.cutout.png` | **missing** |
| `REAL_C2` | `my files/test videos/cutouts/img001-c2.cutout.png` | **missing** |
| `REAL_CUT` | `my files/test videos/cutouts/img002-c1.cutout.png` | **missing** |

All three moved into per-reel folders in Block 10 session 35. The real folders
are **`my files/test videos/cutouts/vitasilk/`** (11 files) and
**`my files/test videos/cutouts/test 1/`**, which is what `cutoutDirFor` produces:
`<planDir>/cutouts/<planStem>/`.

The comment sitting directly above those three constants said:

> *"These are files that exist, so the error never fires and the ready branch is
> what is under test."*

That had stopped being true months ago, and nothing noticed.

### Proving the tests vacuous

**Experiment 1 — point the fixtures at a folder that cannot exist.** `CUTOUTS`
changed to `<repo>/no such folder anywhere/cutouts`:

```
Tests  15 passed | 105 skipped (120)
```

**All fifteen stayed green against pictures that could not possibly render.**
The assertions compare the panel's `src` attribute against a URL built from the
*same constant*, so they move together and can never disagree.

**Experiment 2 — the fixture makes its own headline claim untestable.** On the
card slot `img001-c1`, the fixture set

```
imagePath:    REAL_C1
cutoutPath:   REAL_C1
renderedPath: REAL_C1
```

— the same `.cutout.png` in all three roles. So *"shows the picture the build
will place, **not the cut-out of it**"* could not tell the two apart at all,
whatever the panel did.

**Experiment 3 — what they do catch.** Breaking `fileUrl` so it stops encoding
turned three of the fifteen red. They are not vacuous about the *string*; they
are vacuous about **whether anything rendered**.

### The table

| test | what it claims | what it actually asserted | when the picture was broken |
|---|---|---|---|
| shows the picture the build will place, not the cut-out of it | the built file is shown, not its cut-out | `src` equals a string built from the same constant; the fixture made both roles the same file | **still green** |
| offers the picture before the background was removed, on a cutout slot only | a second picture is offered on cutout slots | counted `figure.rawshot` elements; never that either drew | **still green** |
| still shows the pictures when the service is older than the panel | the fallback picks the right file | `src` strings only | **still green** |
| says a picture is gone only when the service says it is gone | two pictures survive, one is replaced | counted elements; a load failure removes elements too, so the count was ambiguous | **still green** |
| encodes the spaces in a real path | the URL is escaped so the file loads | `src` contains `%20`; never that the file loaded | **still green** |
| the other ten | text on screen | text on screen — genuinely, and not vacuous | n/a |

### The race, demonstrated

**The two racing things:**

1. **The browser's failed `file://` load reaching `onError`.**
   `Images.tsx:307` calls `setUnreadable(true)`, and React then **replaces**
   `<img class="shot built">` with `<span class="tag">this picture is on the disk
   but the panel could not display it</span>`.
2. **The test's `waitForSelector('img.shot.built')` followed by `$$eval`.**

The test passed only when the read won. Because the fixtures named files that do
not exist, the error always fired — the only question was whether it arrived
first.

**Demonstrated by slowing the read side**, not by reasoning. A single
`await page.waitForTimeout(1500)` inserted between `waitForSelector` and
`$$eval`, changing nothing else:

```
× the image candidate picker > shows the picture the build will place, not the cut-out of it
  → expected [] to include 'file:///Volumes/T7%20Shield/INSEA/Pro…'
```

The array is **empty**: every `img.shot.built` had already been replaced. Remove
the pause and it passes again. That is the flake that failed a run in session 54
and another in session 55.

---

## 3. The rewrite

**The fixtures now come off `vitasilk`'s own Edit Plan** and are not written down
in the test at all. The plan is what the pipeline writes; its candidate paths are
what the builder places; a generated picture lives under the **video's sha256**
the way `service/src/video-identity.ts` decides
(`.local/cache/99dfe0e5…/images-<fingerprint>/image.jpg`). If they move again,
the test follows them.

**`realFile` refuses a path that is not on disk**, so the whole class — a fixture
quietly naming a file that moved — cannot come back silently.

**Each role is now a different file**, as the plan really holds them, so *built
picture* and *its cut-out* are finally distinguishable.

**The race is removed by waiting on the condition**, not on a timer:
`picturesSettled` waits until every `img.shot` reports `complete`, so the answer
is the same whichever side would have won.

**The assertion is now `loaded`** — `img.complete && img.naturalWidth > 0` —
extracted as a value. Never a live Playwright handle: session 54 lost a run to
vitest serialising an `ElementHandle` into a failure diff and exhausting the heap.

### Every rewritten assertion, proved to fire

**Red 1 — stop encoding the path, so a picture with a space cannot load:**

```
× the image candidate picker > shows the picture the build will place, not the cut-out of it
  → expected [ …(3) ] to include 'file:///Volumes/T7%20Shield/INSEA/Pro…'
× the image candidate picker > offers the picture before the background was removed, on a cutout slot only
  → expected 'file:///Volumes/T7 Shield/INSEA/Proje…' to be 'file:///Volumes/T7%20Shield/INSEA/Pro…' // Object.is equality
× the image candidate picker > still shows the pictures when the service is older than the panel
  → expected [ …(3) ] to include 'file:///Volumes/T7%20Shield/INSEA/Pro…'
× the image candidate picker > encodes the spaces in a real path
  → expected [ …(3) ] to include 'file:///Volumes/T7%20Shield/INSEA/Pro…'
Tests  4 failed | 11 passed | 105 skipped (120)
```

**Red 2 — show the cut-out on a card slot, the exact thing the test names.**
`pictureFor` changed to prefer `cutoutPath`:

```
× the image candidate picker > shows the picture the build will place, not the cut-out of it
  → expected [ …(3) ] to include 'file:///Volumes/T7%20Shield/INSEA/Pro…'
Tests  1 failed | 119 skipped (120)
```

**This claim could not be tested at all before**, because the fixture made the
two files the same.

**Red 3 — the fixture guard, when a picture moves the way session 35 moved
them.** `REAL_CUT` pointed one suffix away from where the plan says:

```
⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯
Error: img002-c1 cutout: the corpus plan names /Volumes/T7 Shield/INSEA/Projects/framopia-studio/my files/test videos/cutouts/vitasilk/img002-c1.cutout.png.moved, which is not on disk
Tests  no tests
```

The suite refuses to run rather than racing an error handler.

**Red 4 — a file that exists but is not a picture**, so the load genuinely fails.
`REAL_C1` pointed at the plan's own JSON:

```
× the image candidate picker > shows the picture the build will place, not the cut-out of it
  → expected [ { …(2) }, { …(2) } ] to have a length of 3 but got 2
× the image candidate picker > still shows the pictures when the service is older than the panel
  → expected [ { …(2) }, { …(2) } ] to have a length of 3 but got 2
Tests  2 failed | 13 passed | 105 skipped (120)
```

**This is the same situation that used to be the flake, and it is now a
deterministic failure** — the wait for `complete` means the error has always
landed by the time the assertion runs.

All four restored, and green again: `Tests 15 passed | 105 skipped (120)`.

**No test asserts retired behaviour, and none was deleted.** The 120 test names
in the file are byte-identical before and after — `diff` over the extracted names
is empty. What changed is what six of them assert.

---

## 4. Ten panel runs, each one

| run | result |
|---|---|
| 1 | 233 passed, 2 skipped (235) |
| 2 | 233 passed, 2 skipped (235) |
| 3 | 233 passed, 2 skipped (235) |
| 4 | 233 passed, 2 skipped (235) |
| 5 | 233 passed, 2 skipped (235) |
| 6 | 233 passed, 2 skipped (235) |
| 7 | 233 passed, 2 skipped (235) |
| 8 | 233 passed, 2 skipped (235) |
| 9 | 233 passed, 2 skipped (235) |
| 10 | 233 passed, 2 skipped (235) |

**No test failed on any of the ten.** That is evidence about these ten runs. The
reason to expect it to hold is not the count: it is that the failure mode was a
race that has been removed by waiting on the load condition, and that the same
situation which used to flake now fails deterministically — shown in Red 4 above.

---

## 5. What is covered now, and what is not

### Covered, by an assertion proved to fire

- **A candidate's picture actually renders** — `complete && naturalWidth > 0`,
  per picture, not a URL that looks right.
- **The build's file is shown, not its cut-out**, on a card slot — testable for
  the first time, because the two are now different files.
- **A cutout slot offers the picture the cut-out was made from**, and it draws.
- **The fallback for a service older than the panel** picks the right file *and*
  it draws.
- **A picture the service calls gone** is replaced by a sentence while the other
  two still draw.
- **Spaces in a path are encoded**, and the picture loads with them.
- **A fixture may not name a file that is not there** — the suite refuses.

### Not covered, by name

The picker is the surface sessions 53 and 54 built the label matching on, and
**none of that matching is exercised here:**

- **A label matching a spoken word** — that a picture with `label: "Botox"` is
  chosen when `Botox` is said. Covered in the service
  (`core/src/client-picture-match.test.ts`, `analysis/client-picture-slots.test.ts`)
  and **not** through the picker.
- **A picture belonging to one video beating a client's** when both labels hold
  the word. Covered in `service/src/video-pictures.test.ts`; **not** in the panel.
- **An unlabelled picture waiting to be chosen by hand** — that it appears in the
  picker and is not chosen automatically. **Not covered anywhere in the panel.**
- **Choosing one of the client's own pictures for a slot** through the picker —
  `client-editing.browser.test.ts` covers attaching and labelling pictures, not
  choosing one for a slot from the picker's *Or use one of your own pictures* list.
- **What a picture looks like once chosen** — that the slot then shows the
  client's photograph rather than a generated candidate.

### Found and deliberately not fixed

- **`my files/test videos/cutouts/` still holds no loose files**, only the two
  per-reel folders. Nothing points at the old flat layout any more, but nothing
  cleans it up either; the empty parent is harmless and was left alone.
- **`picture.test.ts` never touches a fixture path**, so it did not have this
  defect and was not changed.
- Nothing else was found broken. A second change in this session would have made
  the ten-run result uninterpretable, which is why the uncovered behaviours above
  are listed rather than written.

---

## 6. Gates, arithmetic and fingerprints

**`npm run check` — PASS, exit 0.** Measured:

| workspace | measured | expected | moved? |
|---|---|---|---|
| core | 777 passed | 777 | no |
| service | 1358 passed, 1 skipped | 1358 (+1 skipped) | no |
| benchmarks | 173 passed | 173 | no |
| panel | **233 passed, 2 skipped** | 233 (2 skipped) | **no** |

**The panel count did not move, and the arithmetic is exact: 233 → 233.** No test
was added, removed or renamed — the 120 `it(` names extracted from
`render.browser.test.ts` before and after are identical, `diff` empty. This
session changed what six existing tests assert, not which tests exist.

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

After Effects was not driven by this session. `npm run golden` drives it, and it
was run as the gate.

---

## 7. Money

**No ledger lines added.** 165 lines at both ends, byte-identical by sha256.
Nothing here could bill: a browser reading local files, and two gates.
