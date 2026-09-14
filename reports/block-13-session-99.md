Status: OK

# Block 13, session 99 — stop the panel shouting, and give Make room

Three things fixed, and the third turned out not to need fixing: **the 84 px of
room session 98 flagged on Make was 224 px all along**, and every height reported
from session 95 to 98 was measured against a panel whose service was not
answering. The panel suite is **337 passed, 2 skipped, 0 failed**; the gate is
green; the bundle is rebuilt.

## 1. The three changes, in order

| # | change | panel suite after |
|---|---|---|
| 1 | a video row shows the shortest text that tells it from the others | **335 passed, 0 failed** |
| 2 | Build: four facts in front of him, the rest behind one press | **335 passed, 0 failed** |
| 3 | Make's room — measured, and the measurement was the defect | **337 passed, 0 failed** |

The count never rose. Two tests were added at change 3 rather than any code.

### The duplication session 98 found

**It still existed, and this session ended it by measurement rather than by
merging.** Two files each listed what is on Make — `render.browser.test.ts`'s
headings test and `three-screens.browser.test.ts` — and neither moved this
session, because nothing about Make's sections changed. What did change is that
the fold assertions now come in two states rather than one, and both live in
`three-screens.browser.test.ts`, which is the file that owns screen shape. I did
not merge the two lists: the headings test asserts the panel reads the same with
or without a switcher, which is a different question from what each screen holds,
and collapsing them would lose that.

## 2. What a video row shows

**The rule.** For each label, the shortest of: the file's own name; the first
folder with the middle elided; a longer suffix, one folder at a time; the whole
label — whichever is first unique **among the labels shown together**. The whole
label is always available on hover.

**Measured on his real folder, read on 2026-09-14 — 32 videos, not 25:**

| | |
|---|---|
| mean label length before | **44.1 characters** |
| mean after | **9.6 characters** |
| distinct shown | **32 of 32** |

**No two of his are ambiguous**, and that is the property the rule exists for
rather than a happy outcome: step four is the label itself, and labels are unique
by construction since Block 12 session 81. A test asserts it against his real
folder, not an invented one.

**His three `sora`s keep what separates them:**

| stored label | shown |
|---|---|
| `August content/Exports/Work in Progress/sora` | `August content/…/sora` |
| `September Content/Exports/Work in Progress/sora` | `September Content/…/sora` |
| `Framopia Studio Inputs/Footages/sora` | `Framopia Studio Inputs/…/sora` |
| `September Content/Exports/Work in Progress/sora-2` | **`sora-2`** |
| `September Content/Footage/Video/MVI_9499` | **`MVI_9499`** |

**The stored label did not move.** Session 81's reasoning stands and plans, cache
keys and routes all still hold it — `core/` and `service/` are untouched, and one
video's figures are identical (section 6).

**The shown text depends on the set, on purpose.** If he adds a second `sora-2`,
both rows grow a folder — which is exactly the information he needs at the moment
he needs it. That is the opposite of the stored label, which must never shift.

## 3. What Build shows now

**In front of him, four facts:**

> sora-2, for Dr Loubna Kfafi — the client recorded on the plan.
> Will contain 69 subtitle cards, 3 emphasised keywords, 7 images, 7 sounds.
> Writes /Volumes/T7 Shield/…/sora-2-f6c580b5-full.aep, replacing what is there.
> Building is free. It calls nothing and bills nothing.

**Behind one press, under *What else it will use*:**

> Watermark medium, 324 × 363 px.
> Type set in Inter Semi-Bold and Almarai Bold, with Cormorant Garamond SemiBold Italic for emphasised words.
> Built with Dr Loubna Kfafi's look as it was when this video was set up.

**Seven paragraphs to four.** *"replacing what is there"* is a warning and stayed
in front of him; so did *"Building is free"*, because every other control here can
spend and silence about cost reads as a cost. **Nothing was deleted and nothing
was reworded** — the disclosure is `.quibbles`, which Build already uses for its
short-card notes, so there is no second way of hiding things.

## 4. Each screen's measured height

**The figure session 98 reported was measured against a broken panel.** `open()`
in the browser tests leaves the companion service unreachable, and that branch of
the readiness block is **211 px** of error, retry button and attempt count — where
a healthy service is **one line of 71 px**.

| screen | service unreachable | service answering | session 98 reported |
|---|---|---|---|
| 1. Choose | 705 px | **566 px** | 705 px |
| 2. Make | 816 px | **676 px** | 816 px |
| 3. Build | 656 px | **516 px** | 656 px |

**So Make's room is 224 px, not 84.** Nothing was added to buy it back, because
there was nothing to buy — and changes 1 and 2 shorten the queue's rows and Build
further in real use, neither of which the stub exercises.

**Both states are now pinned.** The existing fold test keeps the unreachable case,
which is the worst case and the right one for a fold — if it fits with the service
down it fits when it is up. A second test asserts the ordinary case with **a
hundred pixels of headroom**, and says in its own comment why it exists.

## 5. The wording, the colours and the buttons

**The removed-lines measurement, per file, ignoring indentation** — because
Build's block moved into a `<details>` and is indented one level deeper:

| file | lines removed | reappear verbatim | changed |
|---|---|---|---|
| `Build.tsx` | 20 | **19** | 1 |
| `App.tsx` | 6 | 0 | 6 |
| `Queue.tsx` | 3 | 0 | 3 |
| **total** | **29** | **19** | **10** |

**All ten changed lines are label renderings** — `r.label` → `nameOf(r.label)`,
`item.reel` → `nameOf(item.reel)`, plus a `title` attribute — checked rather than
asserted. That is change 1 itself. Every other line in the three components moved
untouched or was added.

**`words.ts` and `spend.ts` are untouched** — `git status` on both is empty. Every
message session 95 settled is intact, money is still to the cent, and the money
screen's grand total keeps its precision. **The full cost screen was not opened.**

**Colour still means one thing.** `button.run.free` is in `panel.css`,
`spendsMoney` is read at five places, and the queue's news is `--muted`, `--ok`,
`--warn` — never `--accent`.

**`leave-the-panel.test.ts` passes.** No message names a command or sends him out
of the panel.

## 6. The work is untouched

**`core/` and `service/` — `git status` on both is empty.**

```
diff before.json after.json  →  FIGURES IDENTICAL to the session 95-98 baseline
```

`sora-3`, `sora-4` and `test` through the same `dryRun` and `stepsFor`: every
estimate, every stage verdict, cards, keywords, images, sfx, zones and the
un-rounded spend.

**Assertions read extracted values and use `checkVisibility()`.** The Build test
reads only the paragraphs actually being rendered — a closed `<details>` still has
its text in the page, and Block 11 session 69 shipped a test that read exactly
that kind of hidden text as if it were on screen.

### A mistake worth recording

**I used `git checkout` to undo a mutation and destroyed uncommitted work.**
Reverting mutation M3 took `App.tsx` and `three-screens.browser.test.ts` back to
HEAD, which threw away this session's label wiring and the healthy-state fold
test. Both were rebuilt from scratch. The project's rule is to restore from a
saved copy and never from git, and it exists for precisely this; I knew it and did
it anyway.

## 7. What he will see

**1. Choose** — the service line, **Client** with their card, **Video** with the
picker now reading `sora-2 — 23.3s` rather than `September Content/Exports/Work in
Progress/sora-2 — 23.3s`. Ends at 566 px.

**2. Make** — the three steps, with **2. Make** carrying the queue's news. Then
**This video** and its two controls; **Make several videos** and its list; **Cost**
last. Ends at 676 px.

**3. Build** — four facts, *What else it will use* closed beneath them, *Build the
composition*, and **Change something first**. Ends at 516 px.

**Fifteen rows, as they would read** — the fifteen he is most likely to queue:

```
   1. sora-1                        9. MVI_9501
   2. sora-2                       10. MVI_9502
   3. sora-3                       11. vid-2
   4. sora-4                       12. vid-2-2
   5. sora-5                       13. vid-2-3
   6. sora-6                       14. vid-3
   7. September Content/…/sora      15. vid-4
   8. MVI_9499
```

Fourteen of the fifteen are six to eight characters. The one that is not is the
one that has to be.

**A queue of five running:** on Make, *Working on sora-3. You can close this and
come back — it keeps going*, and `2/5` on the step above, wherever he is.

**After it ends:** `5 ready`, or `1 failed` in amber; the pane keeps its headline,
a line per video and the total, each row reading `sora-3` rather than a path.

## 8. What I am least sure about

**The shown name changes when the folder changes.** Add a second `sora-2` and the
row he knows as `sora-2` becomes `September Content/…/sora-2`. I argued that is
the information he needs at that moment, and I still think so — but it is the
behaviour session 81 refused for the stored label, and he may dislike it for the
same reason in a different place.

**`Framopia Studio Inputs/…/sora` is 29 characters** and the elision hides the
folder that would actually mean something to him — `Footages`. The rule picks the
*first* folder because that is stable; the *most distinguishing* folder would often
read better and would move as siblings appeared.

**Build's four facts may still be one too many.** *"Building is free"* is there
because silence about cost reads as a cost, and the Build button is already not
red. If the colour rule is doing that work, the sentence is redundant.

**What I would change next:** give the queue's summary a dismiss, which is still
open from session 98, and let that clear the step's news rather than arriving on
Make.

## 9. Gates

`npm run check`, **run alone, after committing: exit 0, `check: PASS`.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | 1575 | 0 | 1575 |
| benchmarks | 173 | 0 | 173 |
| panel | **337** | 2 | 339 |
| pytest (CV sidecar) | 149 | 0 | 149 |

Measured from the passing run. core, service, benchmarks and pytest identical to
session 98; panel **325 → 337**.

**Arithmetic by name: 12 added, 0 removed, 0 renamed** — `grep '^-  it('` returns
**0**.

| file | added |
|---|---|
| `video-names.test.ts` | 10 — the whole file |
| `render.browser.test.ts` | 1 — puts four facts in front of him and the rest behind one press |
| `three-screens.browser.test.ts` | 1 — fits every screen with the service answering, with room to spare |

**No assertion was rewritten this session.** The two Make-section lists did not
need to move, because Make's sections did not change.

**A gap the mutations found.** M2 un-grouped Build's facts and **no test noticed** —
I had changed the layout with nothing pinning it. The test above was written for
that, and M2 then failed against it. Without the mutation I would have shipped an
unasserted change.

`npm run golden`: **PASS, 4 of 4 reels matched, field for field.** 4415 + 4280 +
3709 + 4770 = **17,174**.

**Panel suite five times: exit 0, 0, 0, 0, 0** — after a fix. The first sweep was
**0, 0, 0, 1, 0**, and because the output was captured the cause is known:
`Hook timed out in 10000ms` while **all 337 tests passed**. Nine browser files each
launch their own Chromium and seven were on vitest's ten-second default, on a Mac
also running After Effects. The bound is a hang detector, not a measurement of how
fast a browser starts, so all nine now have a generous one — the same correction
session 90 made to the CV sidecar's. Five runs afterwards: clean, with no hook
timeout in any.

**The panel was rebuilt.** `panel: built to panel/dist`, `panel.js` 263,682 bytes.
The extensions folder points at this working copy.

### Part 0, at both ends

| measurement | at start | at end |
|---|---|---|
| ledger records | 294 | **294** |
| ledger sha256 | `77eaf6c9…6c1a84d0` | **`77eaf6c9…6c1a84d0`** |
| `templates/library.aep` | `4b0cf05a…eca6c22aba` | unchanged |
| `modes/dr-loubna-kfafi.json` | `f2fa926e…` | unchanged |
| `modes/k2-syndicalia.json` | `572e99bf…` | unchanged |
| `.local/` directories | 16 | 16 |
| `assets/client-pictures/` | 22 files, 36M | 22 files, 36M |
| CEP extensions | `com.framopia.studio` | `com.framopia.studio` |
| After Effects | 1 (pid 89430) | 1, never launched or quit |
| `aerender` | 0 | 0 |
| listening service | pid 52533 | pid 52533, never stopped |
| `origin/main..main` | 0 | 0 after push |

No orphaned process at the start. His seven photographs and his edit to
`modes/dr-loubna-kfafi.json` are exactly as found; no commit named his paths.

## 10. Every ledger line added

**None.** 294 records and sha256
`77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0` at both ends.
Nothing here could bill.

## What is open

- **A shown name changes when a sibling appears** (section 8).
- **The elision hides the folder that would mean most to him.**
- **The queue's summary still has no dismiss**, carried from session 98.
- **Every height reported in sessions 95–98 was against an unreachable service** —
  those reports are wrong by 140 px and this one records the correction rather
  than amending them.
- Everything carried from session 98 that this session did not touch.
