Status: OK

# Block 13, session 98 — make each screen say one thing

Three things fixed, two of which session 97 named itself. **The panel suite is
325 passed, 2 skipped, 0 failed**, the gate is green, and the bundle on his
machine has been rebuilt.

## 1. The three changes, in order

| # | change | panel suite after |
|---|---|---|
| 1 | the Make step carries the queue's news | **325 passed, 0 failed** |
| 2 | *This video*, the heading the queue already had | *with 3, below* |
| 3 | the accounting moved below the work | 1 failed, 324 passed |
| — | the second copy of Make's section list, corrected | **325 passed, 0 failed** |

**The count rose once, and I stopped.** After change 3:

```
   × the built panel in a real browser > renders the brand mark and one screen, top to bottom
     → expected [ 'This video', …(2) ] to deeply equal [ 'Cost', 'Make several videos' ]
```

**Why:** session 96's headings test carries its own copy of what is on Make, and I
had updated only the copy in `three-screens.browser.test.ts`. Two places list the
same fact — that is the finding, not the failure — and both now say *This video,
Make several videos, Cost*.

## 2. What the switcher shows

`queueNews()` in `words.ts`, rendered on the **2. Make** step. Four states, and
the news is the only thing that changed about the switcher:

| state | on the step | said in full | tone |
|---|---|---|---|
| running | `2/4` | Making videos — 2 of 4 so far. | muted |
| finished clean | `3 ready` | 3 videos are ready to build. | green |
| finished, some failed | `1 failed` | 2 ready to build, 1 did not finish. | amber |
| he stopped it | `stopped` | You stopped the queue. 2 ready to build. | amber |

**Finished-with-failures leads with the failures**, because that is the part he
has to do something about. **One video is *1 video is*, not *1 videos are*.**

**Never the accent.** Red means *this spends money* and has one meaning on his
screens, so a failed video is the amber already declared in `panel.css` — asserted
two ways: in `words.test.ts` that the tone is only ever `working`, `good` or
`warn`, and on screen by reading the computed colour and comparing it to
`--accent`.

**Nothing animates.** He may be reading a transcript while five videos run.

### When it clears

**When he stands on Make with the queue finished, and not before.** Reading it is
what dismisses it — a badge that cleared on a timer would be Block 12 session 94's
queue vanishing without a summary, in a different place. A queue still running
keeps saying so, because that news is not stale. A new queue is new news, however
the last one ended.

**Proved on screen**, driving the panel's own job route — pick a video, add it to
the list, press the button, poll:

- away from Make while it finishes → the news is there;
- he presses **2. Make** → it goes;
- he wanders off again → it stays gone.

The summary in the queue pane itself is untouched and still stays.

## 3. How the four controls on Make now read

**This video**
  · *Make the subtitles — nothing to pay*
  · *Make the pictures — about $2.17*

**Make several videos**
  · *Add vitasilk to the list*
  · *Make these 2 videos*

The queue already had a heading; the other two had none, which made the
difference look like an accident. **No control moved, no wording changed, no
button does anything different** — one `<h2>` was added, and session 97's
measurement is repeated in section 6 to show it.

## 4. The money on Make

**The primary figure is the one on the button** — *Make the pictures — about
$2.17*. It is the only money figure attached to a decision he is about to take,
it is already there, and it is already red when it spends and not when it does
not.

Everything else is history, and history is now **after** the work rather than in
front of it: *See everything spent — $36.25 so far*, what this video has cost, and
the soft alarm, in the same **Cost** block, unchanged, moved down.

He opened Make and read three money figures and four stage rows before reaching a
button. Now he reads *This video* and two buttons.

**Money to the cent stays** — `spend.ts` is untouched, so `$3.40` and the money
screen's full-precision grand total are exactly as ruled. **The full cost screen
is untouched**: session 70 built it to his eye and nothing here opened it.

## 5. Each screen's height

| screen | session 97 | now | of a 900 px panel |
|---|---|---|---|
| 1. Choose | 705 px | **705 px** | unchanged |
| 2. Make | 781 px | **816 px** | +35 px |
| 3. Build | 656 px | **656 px** | unchanged |
| the queue begins at | 601 px | **539 px** | 62 px higher |

**Make grew by 35 px** — the height of the new heading — and still fits, with 84 px
to spare. **The queue rose 62 px**, because the accounting that sat above it is now
below. A standing test asserts every visible section's bottom is inside 900 px on
every screen, so this cannot drift unnoticed.

## 6. The wording, the colours and the buttons

**The removed-lines measurement, as session 97 reported it:**

```
lines removed: 19
of those, absent from what was added: 0
=> every removed line reappears verbatim
```

The 19 are the `Cost` section, moved. Everything else in the `App.tsx` diff is
addition: the heading, the news, the seen flag, and comments.

**`words.ts` has no removed line.** Every message session 95 settled is intact;
`queueNews` is added beside them, which is what the brief allows — a new label,
not a reworded one.

**`spend.ts`, `Queue.tsx` and `Build.tsx` are untouched** — `git status` on all
three is empty. So the money format, the queue's own summary and the build control
are exactly as they were.

**Colour still means one thing.** `button.run.free` is still in `panel.css`,
`spendsMoney` is still read at five places in `App.tsx`, and the three news colours
are `--muted`, `--ok` and `--warn` — never `--accent`.

**`leave-the-panel.test.ts` passes.** No message names a command or sends him out
of the panel.

## 7. The work is untouched

**`core/` and `service/` — `git status` on both is empty.**

```
diff before.json after.json  →  FIGURES IDENTICAL to the session 95/96/97 baseline
```

`sora-3`, `sora-4` and `test` through the same `dryRun` and `stepsFor` the panel
uses: every estimate, every stage verdict, cards, keywords, images, sfx, zones and
the un-rounded spend.

**Assertions read extracted values.** The new browser tests return strings and
numbers out of `$$eval` and `$eval`; no Playwright handle is held across an
assertion, and nothing reads `textContent` of the whole screen. Visibility is
`checkVisibility()`, so a badge that is in the page but not rendered is not
counted.

## 8. What he will see

**1. Choose** — the service line, then **Client**: the picker and, once chosen,
their card. Then **Video**: the picker, Refresh, Browse. Ends at 705 px.

**2. Make** — the three steps at the top, with **2. Make** carrying the queue's
news if there is any. Then:

- **This video** — the wrong-client and other-service notices if they apply, then
  *Make the subtitles* and *Make the pictures*, red only when they spend, and the
  run report while one is going.
- **Make several videos** — the list he is building, or the queue running, or what
  it left behind. Visible without scrolling, starting at 539 px.
- **Cost** — *See everything spent — $36.25 so far*, what this video has cost, the
  soft alarm, and the stage rows.

Ends at 816 px.

**3. Build** — the fonts note, what the composition will contain, *Build the
composition*, and **Change something first**. Ends at 656 px.

**A queue of five while it runs:** on **Make**, under *Make several videos* — which
video it is on, what has been spent, *"You can close this and come back — it keeps
going"*, and **Stop after this video**. And on the step above it, `0/5` becoming
`1/5`, `2/5`, wherever in the panel he happens to be.

**After it ends:** the step says `5 ready`, or `1 failed` in amber. The pane says
*"4 videos are ready to build. 1 did not finish."* with a line per video and the
total. He presses **2. Make**, the step's news clears because he has read it, and
the pane's summary stays.

## 9. What I am least sure about

**Make is at 816 px of 900.** It was 781, and the heading cost 35. Two more rows
of anything — a longer client name, a third notice, a fifth stage — and something
he needs is below the fold. The test catches it, which is the point, but the
margin is thin and Make is the screen most likely to grow.

**The news disappears the moment he lands on Make.** That is the rule I chose, and
standing on the screen is a weak definition of *read* — he could arrive, look at
the run buttons, and never glance at the queue. A dismiss he presses would be
honest; it would also be a new control, and this session was appearance and
wording.

**There is still no way to dismiss the queue's summary.** It stays until he starts
another queue, which satisfies *stays until he dismisses it* only by never
offering the dismissal. Nobody has ruled on it and I did not invent one here.

**What I would change next:** give the queue pane a dismiss, and let that — rather
than arriving on Make — be what clears the step.

## 10. Gates

`npm run check`, **run alone, after committing: exit 0, `check: PASS`.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | 1575 | 0 | 1575 |
| benchmarks | 173 | 0 | 173 |
| panel | **325** | 2 | 327 |
| pytest (CV sidecar) | 149 | 0 | 149 |

Measured from the passing run. core, service, benchmarks and pytest are identical
to session 97; panel is **312 → 325**.

**Arithmetic by name: 13 added, 0 removed, 0 renamed**, verified by diffing test
names — `grep '^-  it('` returns **0**.

| file | added |
|---|---|
| `words.test.ts` | 8 — what a step says about a queue |
| `three-screens.browser.test.ts` | 5 — the news a step carries, on screen |

**Two assertions rewritten, none deleted**, both listing what is on Make:

| where | old | new |
|---|---|---|
| `three-screens.browser.test.ts` | `['Cost', 'Make several videos']` | `['This video', 'Make several videos', 'Cost']` |
| `render.browser.test.ts` | `['Cost', 'Make several videos']`, and the one-page list | the same order, and `'This video'` added to the one-page list |

`npm run golden`: **PASS, 4 of 4 reels matched, field for field.** 4415 + 4280 +
3709 + 4770 = **17,174**. An appearance change did not move it.

**Panel suite, five times: exit 0, 0, 0, 0, 0**, all five captured, 325 passed and
2 skipped each, no failure in any. Every suite was allowed to finish.

**The panel was rebuilt.** `npm run panel:build` → `panel: built to panel/dist`,
`panel.js` 262,825 bytes, carrying the step news. The CEP extensions folder points
at this working copy, so what he opens is what was tested.

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
| After Effects | 1 (pid 89430) | 1 (pid 89430), never launched or quit |
| `aerender` | 0 | 0 |
| listening service | pid 89548 | pid 89548, never stopped |
| `origin/main..main` after fetch | 0 | 0 after push |

No orphaned process was found at the start. After Effects and his service had both
been restarted since session 97 — both his, both left alone. His seven photographs
and his edit to `modes/dr-loubna-kfafi.json` are exactly as found; no commit named
his paths.

## 11. Every ledger line added

**None.** 294 records and sha256
`77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0` at both ends.
Nothing here could bill: no stage was run, and everything executed was a test, the
gate, golden, a build or a read-only measurement.

## What is open

- **Make is at 816 px of 900** (section 9). The margin is thin on the screen most
  likely to grow.
- **The step's news clears on arrival at Make**, which is a weak definition of
  read.
- **The queue's summary has no dismiss**; it stays until the next queue.
- Everything carried from session 97 that this session did not touch.
