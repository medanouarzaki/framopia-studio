Status: OK

# Block 13, session 97 — land the three screens

**They are on.** Choose, Make and Build, measured at **705 px, 781 px and 656 px**
of a 900 px panel, with the queue at **601 px** — session 96's figures reproduced
exactly. The panel suite is **312 passed, 2 skipped, 0 failed**, the gate is
green, and the bundle on his machine has been rebuilt so what he opens is what
was tested.

## 1. The four edits, in order

| # | edit | panel suite after |
|---|---|---|
| 4 | the queue above Build — done by moving **Build** below it | 1 failed, 305 passed |
| — | the one-page branch of the headings test, corrected | **306 passed, 0 failed** |
| 1 + 2 | the switcher and the three gates | **306 passed, 0 failed** |
| 3 | Build's own section, with the fonts note | *landed with edit 4* |
| — | the standing proof of the three screens, six new tests | **312 passed, 0 failed** |

**Edit 4 turned out to be the same edit as 3.** `section.do` held the run
controls *and* the Build control, and the queue already sat after it — so the
thing that puts the queue inside Make is taking **Build out and putting it below
the queue**. Doing that is edit 3. They are one move, and it is the first one.

**The count rose once, and I stopped.** After edit 4 the suite went 0 → 1:

```
   × the built panel in a real browser > renders the brand mark and one screen, top to bottom
     → expected [ 'Client', 'Video', 'Cost', …(3) ] to deeply equal [ 'Client', 'Video', 'Cost', …(2) ]
```

**Why:** the new Build section carries an `<h2>`, so a one-page panel now has six
headings and that branch of the test listed five. Transient and expected — the
three-screen branch names Build explicitly. The one-page branch was corrected so
the intermediate state was honest too, rather than carrying a known red forward.

## 2. The queue renders on Make and nowhere else

Proved by a new file, `three-screens.browser.test.ts`, which asks the browser
what is **actually rendered** rather than what is in the page:

```ts
await onScreen(page, 'choose'); expect(await headings(page)).not.toContain('Make several videos');
await onScreen(page, 'run');    expect(await headings(page)).toContain('Make several videos');
await onScreen(page, 'build');  expect(await headings(page)).not.toContain('Make several videos');
```

`headings()` filters on `checkVisibility()`, because a section that is in the DOM
but not rendered still answers `querySelector` — Block 11 session 69 shipped a
test that passed over exactly that.

**Put back the way session 96 had it — the queue between two gates — and it goes
red:**

```
### M1 — the queue outside a gate
   × the three screens > opens on Choose, with the client and the video and nothing else
     → expected [ 'Client', 'Video', …(1) ] to deeply equal [ 'Client', 'Video' ]
   × the three screens > puts the queue on Make and nowhere else
     → expected [ 'Client', 'Video', …(1) ] to not include 'Make several videos'
```

Restored, six of six green.

**One section is outside all three gates on purpose** and the test says so: the
unheaded service-status block at the top, which answers *is anything working at
all*. That belongs on every screen and is part of no step.

## 3. Each screen's height

| screen | content ends at | session 96 | of a 900 px panel |
|---|---|---|---|
| 1. Choose | **705 px** | 705 px | fits |
| 2. Make | **781 px** | 781 px | fits |
| 3. Build | **656 px** | 656 px | fits |

**The queue begins at 601 px**, where it was 990 px — ninety pixels below the
fold — in the one scroll. Every figure matches session 96 to the pixel, measured
independently by the same browser ruler.

A test now holds this rather than a report: *fits every screen inside the panel*
asserts every visible section's bottom is inside 900 px, per screen.

## 4. How the switcher behaves

Three choices, each made deliberately and each pinned.

**It opens on Choose.** Nothing else can be answered before a client and a video
are picked, so any other landing screen would be asking a question out of order —
the same reasoning session 43 used to put Client before Video.

**It never moves him on its own.** Not when a video is chosen, not when a run
finishes, not when a queue ends. Being carried to another screen by a background
poll completing is worse than one press: he may be reading the transcript, and a
run he started is something he chose to start. The cost is that a finished queue
does not announce itself by jumping — which is section 8's doubt.

**Every step stays pressable, including one he cannot use yet.** A disabled tab
cannot explain itself; Build with nothing picked already says what is missing,
and that is more use than a dead control. Nothing is refused silently, and no
screen he can reach says nothing.

**Proved, red then green:**

```
### M2 — the panel opens on Build instead of Choose
   × the three screens > opens on Choose, with the client and the video and nothing else
     → expected [ 'Build', 'Change something first' ] to deeply equal [ 'Client', 'Video' ]
   × the three screens > names all three steps, and marks the one he is on
     → expected '3. Build' to be '1. Choose' // Object.is equality

### M3 — the Build step disabled until it can be used
   × the three screens > names all three steps, and marks the one he is on
     → page.click: Timeout 10000ms exceeded.
        waiting for element to be visible, enabled and stable
```

All restored; six of six green.

**Where he lands when a queue finishes: on Make, where he started it.** The queue
pane itself is what changes — session 94 gives it a headline, a line per video and
a total, and it stays until he dismisses it. That is unchanged by this session and
is why he does not need to be moved.

## 5. The wording, the money, the colours and the buttons

**Every message is the same.** `words.ts`, `spend.ts`, `Queue.tsx` and `Build.tsx`
are untouched — `git status` on all four is empty. Session 95's plain language,
the money to the cent and the money screen's full-precision grand total are
exactly as they were.

**Colour still means one thing.** `button.run.free` is still in `panel.css` and
`spendsMoney` is still read at five places in `App.tsx`.

**No button does anything different**, and this is measured rather than asserted.
The whole diff of `App.tsx` removes **15 lines** — the fonts note and the Build
control — and **every one of those 15 reappears verbatim**:

```
lines removed: 15
of those, absent from what was added: 0
=> every removed line reappears verbatim
```

Everything else in the diff is addition: the switcher, the three gates, and
comments. Same routes, same order, same prices.

**`leave-the-panel.test.ts` passes.** No message names a command or sends him out
of the panel.

## 6. The work is untouched

**`core/` and `service/` — `git status` on both is empty.**

**A video already run:**

```
diff before.json after.json  →  FIGURES IDENTICAL to session 96's baseline
```

`sora-3`, `sora-4` and `test`, through the same `dryRun` and `stepsFor` the panel
uses: every estimate, every stage verdict, cards, keywords, images, sfx, zones and
the un-rounded spend.

**Assertions read extracted values.** The new file's helpers return arrays of
strings and numbers out of `$$eval`; no Playwright handle is held across an
assertion, and nothing reads `textContent` of the whole screen.

### The ambiguity session 96 flagged

Session 96 narrowed two assertions because the queue's controls are `button.run`
too and now sit beside the run buttons on Make. **A narrower selector is enough
for the tests, and it is not enough for him.** On Make he now sees, in order:
*Make the subtitles*, *Make the pictures*, then *Add … to the list* and *Make
these N videos* — four controls in the same shape, two of which spend and two of
which build a list. The colour rule separates spending from free, and nothing
separates *this video* from *the list*. **It reads fine and it is one heading
away from reading better**, which is section 8.

## 7. What he will see

**1. Choose** — the service line at the top, then **Client**: the picker, and once
a client is chosen their card — colours, type, watermark, their own photographs.
Then **Video**: the picker, Refresh, and Browse where the host offers one. Ends at
705 px.

**2. Make** — **Cost**: *See everything spent — $36.25 so far*, what this video
has cost, the soft alarm, and the four stage rows in his words — *Writing down the
words · Already done — nothing to pay*. Then the run controls, red only when they
spend. Then **Make several videos**, visible without scrolling for the first time.
Ends at 781 px.

**3. Build** — the fonts note, then what the composition will contain, *Build the
composition*, and **Change something first**: the transcript, keyword and picture
editors. Ends at 656 px.

**A queue of five while it runs:** on Make, under *Make several videos* — which
video it is on, what has been spent so far, *"You can close this and come back —
it keeps going"*, and **Stop after this video**.

**After it finishes:** the same pane, now with the headline — *"4 videos are ready
to build. 1 did not finish."* — a line per video saying what became of it, the
ones needing him marked, and the total. It stays until he dismisses it, and he
presses **3. Build** to build each one.

## 8. What I am least sure about

**That a finished queue does not fetch him.** He may be on Choose, or have the
panel closed, while two hours of work finishes on Make. I chose never to move him
because being yanked mid-sentence is worse — but the result is that the queue
finishing is silent unless he goes and looks. A count on the *2. Make* step would
fix it without moving him, and that is what I would add next.

**The four controls on Make.** Two spend on this video, two build a list, and they
are the same shape (section 6). A heading over the queue's controls, or moving the
list into its own step, would settle it. I did not do it here because it changes
what he reaches for, and this session was meant to change where things are and
nothing else.

**Build before anything is picked.** It is reachable and says what is missing,
which I think is right. But it is the one screen he can land on and do nothing
with, and I have not watched him meet it.

## 9. Gates

`npm run check`, **run alone, after committing: exit 0, `check: PASS`.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | 1575 | 0 | 1575 |
| benchmarks | 173 | 0 | 173 |
| panel | **312** | 2 | 314 |
| pytest (CV sidecar) | 149 | 0 | 149 |

Measured from the passing run. core, service, benchmarks and pytest are identical
to session 96; panel is **306 → 312**.

**Arithmetic by name: 6 added, 0 removed, 0 renamed**, verified by diffing test
names — `grep '^-  it('` returns **0**. The six are the whole of
`three-screens.browser.test.ts`:

| test |
|---|
| opens on Choose, with the client and the video and nothing else |
| names all three steps, and marks the one he is on |
| puts the queue on Make and nowhere else |
| shows each screen's own sections and no others |
| fits every screen inside the panel |
| leaves every step reachable, even one he cannot use yet |

**One assertion rewritten, none deleted.** In `renders the brand mark and one
screen, top to bottom`, the one-page branch gained `'Build'`:

| old | new |
|---|---|
| `['Client','Video','Cost','Make several videos','Change something first']` | `['Client','Video','Cost','Make several videos','Build','Change something first']` |

That branch is the panel without a switcher. It is dead today and kept correct:
session 96 wrote the test to read the same either way, and a branch that is wrong
whenever it is taken is worse than no branch.

`npm run golden`: **PASS, 4 of 4 reels matched, field for field.** 4415 + 4280 +
3709 + 4770 = **17,174**. A panel change did not move it.

**Panel suite, five times: exit 0, 0, 0, 0, 0**, all five captured, 312 passed and
2 skipped each, no failure in any. Every suite was allowed to finish.

**The panel was rebuilt.** `npm run panel:build` → `panel: built to panel/dist`,
`panel.js` 261,755 bytes. The bundle carries `1. Choose`, `2. Make` and `3. Build`,
and the CEP extensions folder points at this working copy — so what he opens is
what was tested, not session 67's stale-bundle sentence.

### Part 0, at both ends

| measurement | at start | at end |
|---|---|---|
| ledger records | 294 | **294** |
| ledger sha256 | `77eaf6c9…6c1a84d0` | **`77eaf6c9…6c1a84d0`** |
| `templates/library.aep` | `4b0cf05a…eca6c22aba` | unchanged |
| `modes/dr-loubna-kfafi.json` | `f2fa926e…`, 2026-09-12T20:52:03 | unchanged |
| `modes/k2-syndicalia.json` | `572e99bf…`, 2026-09-09T21:58:19 | unchanged |
| `.local/` directories | 16 | 16 |
| `assets/client-pictures/` | 22 files, 36M | 22 files, 36M |
| CEP extensions | `com.framopia.studio` | `com.framopia.studio` |
| After Effects | 1 (pid 6741) | 1 (pid 6741), never launched or quit |
| `aerender` | 0 | 0 |
| listening service | pid 34159 | pid 34159, never stopped |
| `origin/main..main` after fetch | 0 | 0 after push |

No orphaned process from session 96 was found at the start. His seven photographs
and his edit to `modes/dr-loubna-kfafi.json` are exactly as found; no commit named
his paths.

## 10. Every ledger line added

**None.** 294 records and sha256
`77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0` at both ends.
Nothing here could bill: no stage was run, and everything executed was a test, the
gate, golden, a build or a read-only measurement.

## What is open

- **A finished queue does not fetch him** (section 8). A count on the *2. Make*
  step is the fix I would make next.
- **Four same-shaped controls on Make**, two of which spend on this video and two
  of which build a list (section 6).
- **Build before anything is picked** is reachable and says what is missing; it is
  the one screen he can land on and do nothing with, and nobody has watched him
  meet it.
- Everything carried from session 96 that this session did not touch.
