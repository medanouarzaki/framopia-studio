Status: OK

# Block 13, session 103 — bring Make and Build inside the window

**Make was 1086 px of a 900 px window in the state he meets daily. It is 867 px.**

**Build was never 964 px.** That figure — session 102's, and the premise of this
session's part 2 — was an artefact of the measuring harness, which omitted one
field and so rendered a typeface warning for a client who has typefaces. With the
field restored Build measures **759 px**, and it has been inside the window all
along. The same class of error that session 102 found in every height since
session 95, found again in session 102's own correction.

Four messages named something that is not there. The service, a video, a client and
the list each have one name again. Panel **369 passed**, gate green, golden 17,174.

## 1. Make and Build, block by block, before

`section.cost`'s 231 px was the only part of Make ever examined with his data in it.
This is the rest, in every state.

### Make

| state | total | readiness | This video | the list | Cost |
|---|---|---|---|---|---|
| **daily — video run, list idle** | **1086 px** | 71 | **379** | 180 | **231** |
| four videos in the list | 1242 px | 71 | 379 | **336** | 231 |
| a run in progress | **1743 px** | 71 | **1035** | 180 | 231 |
| a stage failed | 1615 px | 71 | **908** | 180 | 231 |

Inside *This video*: the finished sentence 77 px, the two run buttons **205 px**,
the watermark 22 px — and in the two run states a progress card of **573 px** and
**507 px**. Inside *Cost*: the way to the full screen 40 px, the spend record
**103 px**, the steps 22 px.

### Build

| state | total | Build | Change something first |
|---|---|---|---|
| nothing chosen | 542 px | 170 | 97 |
| **ready to build** | **759 px** | 387 | 97 |
| already built once | 1075 px | **704** | 97 |
| a client with no typefaces | 964 px | **592** | 97 |

**Session 102 reported 964 px for the state he meets, and that was the last row, not
the second.** `realClients()` shaped a client the way `/modes` does but did not set
the top-level `fonts` field that `listModes` sets. `FontsNote` reads it, so both
real clients — who have chosen their typefaces — rendered *"has no fonts of its own
yet"*, 205 px of warning that is not on his screen. Caught by reading the warning's
source before rearranging Build around it; the harness now sets the field and says
in a comment why it matters.

## 2. What moved, what folded, what was cut

Everything below is `<details class="quibbles">`, the one disclosure Choose and
Build already use. Nothing was deleted.

### Make — *Cost*, 231 px → 129 px

The spend record — what this video has cost so far, and the soft alarm — folds in
**with** the steps rather than beside them, so the whole history is one press and
one summary. Session 98 settled that the figure he acts on is the one on the button;
session 102 named this block as what should go next.

**In view:** *See everything spent — $36.25 so far*. **Behind one press:** *What it
cost, step by step*.

**When anything is still to run the steps stay in full view** and only the record
folds — they are the decision then, which stages cost money and what each will do.
The summary dropped its count because at 420 px the longer sentence wrapped to two
lines and cost 21 px to say the same thing.

### Make — the two run buttons, 205 px → 151 px

*Make the subtitles* and *Make the pictures* are consecutive actions and **46 px of
explanation stood between them** — the same complaint session 102 acted on
elsewhere. Both sentences are unchanged and both are still there, now under the pair
rather than through it, behind *What these two make*.

**They fold only when both buttons can be pressed.** When the pictures button is
disabled, the sentence saying why is the only thing that explains it, and a reason
behind a press makes a dead control.

### Make → Build — the watermark setting

Session 102 put it behind a press on Make and wrote that its home is Build. It is
there now, beside *What else it will use*, which already says *Watermark medium,
324 × 363 px*. **The setting and the sentence stating its effect are on one screen.**
It does exactly what it did: the same two calls, the same plan, the same refusal to
appear when there is no plan to write to.

### The list — untouched

It does not fold, and its explanation does not fold either. It is a first-class part
of Make: he asked for it and could not find it, and its standing paragraph is what
teaches a first-time user what the list is for. The list is **180 px** idle and
**336 px** with four videos in it, and all of it stays.

### Build — nothing folded

Its two everyday states are **542 px** and **759 px**, both inside the window. There
was nothing to cut, and cutting a screen that fits would have been work done against
a number rather than against the panel.

**Change something first stays, and stays open.** It is the third act — press Make,
press Build, look at it, then come back and change the one thing that bothered him —
and it is three controls and 97 px with no prose at all. It is the only door to the
editors; behind a press it would be a door he has no reason to open. Giving it its
own step would make four where session 97 settled three.

## 3. Each screen's height after

| screen | daily state | worst state | stub, answering | stub, not answering |
|---|---|---|---|---|
| 1. Choose | **619 px** | 619 px | 625 px | 683 px |
| 2. Make | **867 px** *(was 1086)* | **1523 px** — a run in progress | 676 px | 734 px |
| 3. Build | **780 px** *(was 759)* | **1097 px** — already built once | 542 px | 600 px |

Every stub figure is unchanged from session 102.

**Make's daily state is inside the window with 33 px to spare.** Four videos in the
list is 1023 px, down from 1242.

**Three states do not fit, and here is why each:**

- **A run in progress, 1523 px.** The progress card is 573 px on its own: four
  stages, each with the reason it is doing what it is doing. It is the one thing he
  is watching, and shortening it means saying less about a run he paid for. What is
  wrong is not its size but that *Cost* and the list still sit under it — neither is
  anything he acts on mid-run. Folding a section by run state is a layout that
  changes as he watches, and nothing in the panel does that yet.
- **A stage failed, 1396 px.** Same card, 507 px, plus the sentence saying what
  happened. Same reasoning.
- **Already built once, 1097 px.** The build's three stages and *Your composition is
  here*. He reads it once and goes to After Effects.

**Build grew 21 px** — the watermark's summary row, moved from Make. Make lost the
same 22 px.

**Session 102's 26 px regression still stands** and is measured: Build with nothing
chosen is **542 px** against session 101's 516. A `<button>` is an atomic inline box
even at `display: inline`, so the pressable phrase in *Choose a client and a video*
cannot break across a line. Fixing it means making the control a `span` with its own
keyboard handling. At 542 px of a 900 px window it costs him nothing, so it is
recorded rather than worked around.

## 4. Messages naming something that is not there

Four, in three classes. All were user-visible.

| where | said | now |
|---|---|---|
| `words.ts` | *…Check it on the* **Settings screen***.* | *…* **Nothing here can change it** *— the key itself has to be replaced before anything that costs money will run.* |
| `words.ts`, `Build.tsx` | *Press* **Run pipeline** *above…* | **Make the subtitles and the pictures** *first…* |
| `App.tsx` | *No client saved for this video yet.* **Run the pipeline** *and it is saved for you.* | *…* **Make the subtitles** *and it is saved for you.* |
| `panel/src/service.ts` | *…use* **Try again** *in the line at the top* | *…* **open Details in the line at the top and press Try again** |
| `core/src/build-fonts.ts` | *…* **PROJECT_SPEC §5 reserves the client's own fonts for Block 9***; everything before the build runs normally.* | *…* **Set theirs with Change their details on their card***; everything else runs normally.* |
| `Images.tsx` | *…* **Analysis** *plans them…* | *…* **Choosing what to emphasise and what to picture** *plans them…* |

**There is no Settings screen** — no component, no route, nothing named Settings in
`panel/src`. And there cannot be one that shows him the key: a secret lives only in
`.local/` and is never printed. So the sentence says what is wrong and what has to
happen, and sends him nowhere.

**There has been no button called *Run pipeline* since session 95** replaced it with
*Make the subtitles* and *Make the pictures*. `App.tsx` says so in its own comment.
Session 102 turned this phrase into a control without noticing the name was dead.

**A 401 or 403 arrives while the service is answering** — and on that line there is
no button at all. *Try again* is behind *Details*. Both names in the new sentence are
rendered controls, in the order he meets them.

**Block 9 is complete**, and since session 54 a client has three faces he sets
himself. The warning described a rule that no longer holds, citing a spec section he
cannot open, in 205 px on the screen where he builds. What replaces the citation is
the control that fixes it — *Change their details* is real, and is where the faces
are set.

***Analysis* is not a name he ever sees.** The stage is *Choosing what to emphasise
and what to picture*.

**Found and correctly left alone:** `Keywords.tsx`' *"add your own below"*, which
really is below; `service.ts`' *"line at the top"*, which is a line at the top; and
`words.ts`' *"press Refresh"* ×3, *"Change their details"*, *"Go to Build"* and
*"Stop after this video"* — every one a control that exists.

## 5. One name for one thing

**Session 101 did not finish it.** It renamed four *the background helper* to *the
companion service* and left **eight** *the background service*, a third name for the
same thing. Seventeen more strings were doubled across five other nouns.

| thing | was | now | how many |
|---|---|---|---|
| the companion service | *The background service* (8) vs *The companion service* (11) | **companion service** (18) | 8 changed |
| a video | *reel* (7 visible) vs *video* (51) | **video** | 7 changed |
| a client | *client mode / the client modes* (3) vs *client* (36) | **client** | 3 changed |
| a run | *Run pipeline*, *the pipeline* (3) | **Make the subtitles / the pictures** | 3, above |
| a picture | *image slots* (3) vs *picture* (51) | **picture slots** | 3 changed |
| doing it again | *Retry*, *Try again*, *Check again* — one handler, three labels | **Try again** | 2 changed |
| the collection | *The queue* (2) vs *the list* (7) | **the list** | 2 changed |

**Checked and found not to be doubled:** *step* and *stage* — the switcher's three
steps and a run's stages are different things, and neither is shown as a bare noun;
*the list of videos* / *the list of clients* in `service.ts`, which are different
lists, not the one on Make.

**One string keeps the word *image* and should:** `words.ts`' `'no image slots on the
plan'` is a **lookup key** for the service's own reason string. What it renders is
*No pictures were wanted*.

**Said plainly about the collection:** Mohamed's own word for it is *queue* — session
94's brief quotes him. The panel's controls have said *the list* since session 97
(*Add … to the list*, *take it out*, *Take them off the list*), seven readable
strings against two, and a name he presses teaches better than one he reads. It went
to *the list* on that count. If he wants his own word, it is two strings back the
other way, and this paragraph is where the next session should look.

## 6. Colours, buttons, wording, and the distances

**Nothing free is red and no failure is red.** No rule in `panel.css` changed at all
this session — the file is untouched.

**No button does anything different.** The watermark toggle makes the same two calls
against the same plan; the three retry buttons call the same `onRetry` they always
did; every other control is untouched. **`spend.ts` is untouched** and money is still
to the cent. **The full cost screen was not opened.**

**No wording changed except parts 3 and 4** — the six messages in section 4 and the
twenty-five names in section 5, each quoted old and new.

**Session 102's distances did not grow:**

| distance | session 102 | now |
|---|---|---|
| client picker → video picker, Choose | 101 px | **101 px** |
| run button → the list's first control, Make | 220 px | **190 px** |

The second **shrank by 30 px**, because the watermark's summary row left the gap. A
test asserts it is no more than session 102's 220 and prints what it measured.

## 7. `core/`, `service/`, and the figures

**`service/`: 0 files changed.** `git status --porcelain -- service` is empty.

**`core/`: 2 files, 4 removed lines**, which is exactly part 3's allowance:

| file | removed | what it was |
|---|---|---|
| `core/src/build-fonts.ts` | 3 | the warning's three composed lines |
| `core/src/build-fonts.test.ts` | 1 | `expect(warning).toContain('Block 9')` |

No condition, no number, no ratio, no `source`, no route. The one test line asserted
retired behaviour and was **rewritten, not deleted**: it now asserts the warning
names the control that fixes it, and names no block, spec section or document he
cannot open — a stronger assertion than the one it replaces.

**Session 102's figures reading reproduces exactly.** Its `figures.mjs` and
`after102.json` were still in the scratchpad; run against this tree, before and
after the core edit:

```
diff after102.json after103.json    → identical
diff after102.json after103b.json   → identical (after the core edit)
```

`sora-3`, `sora-4` and `test` through the same `dryRun` and `stepsFor`: **IDENTICAL**.
`build-fonts` is not on either path.

### Removed lines, per file

| file | removed |
|---|---|
| `panel/src/App.tsx` | 54 |
| `panel/src/near-the-last-one.browser.test.ts` | 32 |
| `panel/src/service.ts`, `render.browser.test.ts` | 8 each |
| `panel/src/host.ts`, `App.test.tsx` | 4 each |
| `panel/src/words.ts`, `Transcript.tsx`, `Images.tsx` | 3 each |
| `core/src/build-fonts.ts` | 3 |
| `panel/src/Build.tsx` | 2 |
| `words.test.ts`, `run-gate.ts`, `measure-height…`, `Readiness.tsx`, `Queue.tsx`, `Keywords.tsx`, `build-fonts.test.ts` | 1 each |
| `panel/src/browser-harness.ts`, `panel/src/panel.css` | 0 |

App.tsx's 54 are the watermark block lifted whole from one screen to the other, and
the two run explanations regrouped. Every sentence in them is still rendered.

## 8. The walkthrough

### 1. Choose — 619 px, and 619 px at its worst

The service line. *Client*, reading **Dr Loubna Kfafi**. One closed row: *Dr Loubna
Kfafi's colours, type, photographs and details*. *Video*, a dropdown, *Refresh* and
*Browse…*, and the folder. **Nothing is below the fold in any state.**

### 2. Make — 867 px daily, 1523 px at its worst

*This video*: **Everything for this video is made. Go to Build to put the composition
together**, *Go to Build* underlined. *Make the subtitles again — nothing to pay*,
then directly under it *Make the pictures — nothing to pay*, then one closed row:
*What these two make*. *Make several videos*: what the list does, and *Add … to the
list*. *Cost*: *See everything spent — $36.25 so far*, and one closed row: *What it
cost, step by step*.

Worst: a run in progress, 1523 px. The four stages with their reasons are 573 px and
they push *Cost* and the list past the fold — neither of which he acts on mid-run.

### 3. Build — 780 px ready, 1097 px after a build

*Build*, the card — the video and client, what it will contain, that it replaces what
is there, that it is free — *What else it will use* closed, one closed row *The
watermark on this video*, *Build the composition*, and *Change something first* with
*Words*, *Emphasis*, *Pictures*.

Worst: already built once, 1097 px — the three build stages and *Your composition is
here*, read once before he goes to After Effects.

### Journey one: open → client → video → subtitles → pictures → build

| step | distance to next |
|---|---|
| the client dropdown | **101 px** to the video dropdown |
| the video dropdown | one press to **2. Make** |
| *Make the subtitles* | **directly under it** — the explanation that stood in the gap is folded |
| *Make the pictures* | the finished sentence carries *Go to Build* |
| *Go to Build* | one press to Build |
| *Build the composition* | — |

**Everything in this journey is above the fold at every step**, which was not true
before: Cost began at 1011 px and the sentence he reads first sat above 379 px of
block.

### Journey two: four videos → start → come back → build one

Pick each on Choose, *Add … to the list* on Make — **190 px** from the run button,
down from 220. *Make these 4 videos*, at 1023 px: the only thing past the fold is the
foot of *Cost*, which he is not using. He closes the panel.

He comes back: **2. Make** carries `4 ready` in green. The card is headed **The
list**, names each video and what it cost, and ends *Pick a video above and build it,
the same way you always do* — *Pick a video* takes him to Choose.

**Still missing:** nothing says *this kept going while you were away*. Carried from
sessions 101 and 102.

### Journey three: a finished video → build it

Client, video — **101 px** apart. **2. Make**, 867 px, and the first thing he reads is
*Everything for this video is made*. One press, and *Build the composition* is 592 px
below the switcher, inside a 780 px screen.

## 9. What I am least sure about

**I nearly rearranged Build around a warning that is not on his screen.** The 205 px
came from my own harness omitting one field, and the only reason it was caught is
that I read the warning's source before cutting it. Every screen figure this project
has reported for nine sessions has been wrong at least once in exactly this way, and
the ruler is still a stub of his panel rather than his panel.

**The three states that do not fit all have the same shape**: a block he is actively
watching, with two blocks under it that he is not. The honest fix is a layout that
depends on run state, and nothing in the panel does that — I did not want to invent
it inside a session that was told to change no logic.

**The list's name went against Mohamed's own word.** Seven strings against two is the
rule I applied everywhere else this session, and applying it consistently mattered
more than my guess at his preference — but this is the one of the twenty-five I would
most expect him to reverse.

**Folding the run explanations is conditional**, and conditional layout is how the
`subtitlesDone` flag becomes load-bearing for something it was not written for.

**What I would change next:** fold *Cost* and the list while a run is in progress;
make coming back mid-list say so; and drive the ruler from a real service instead of
a shaped payload, so the next field it forgets fails loudly.

## 10. Gates

`npm run check`, **run alone, after committing: exit 0, `check: PASS`.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | 1577 | 0 | 1577 |
| benchmarks | 173 | 0 | 173 |
| panel | **369** | 2 | 371 |
| pytest (CV sidecar) | 149 | 0 | 149 |

core, service, benchmarks and pytest identical to session 102; panel **367 → 369**.

**Arithmetic by name: 2 added, 2 renamed, 0 removed.** Verified by extracting every
`it(…)` name from `panel/src` and `core/src` at `c011c72` and now — panel 367 → 369,
core 777 → 777 with an empty diff both ways.

| added | where |
|---|---|
| `measures Make in the states he meets` | `measure-height.browser.test.ts` |
| `measures Build in the states he meets` | same |

| renamed | to |
|---|---|
| `takes the watermark setting out of the way of the two actions` | `keeps the watermark setting out of the path, and on the screen it affects` |
| `says plainly when a question has none on this reel` | `says plainly when a question has none on this video` |

**Nine tests were rewritten in place and none deleted or weakened** — three watermark
tests moved from Make to Build; the fonts gate, the build-preview sentence, the
`runIt` phrase, `Pick a client.`, `video list` and `The companion service was out of
date` followed their renames; and `expect(warning).toContain('Block 9')` was replaced
by a stronger pair.

`npm run golden`: **PASS, 4 of 4, field for field.** 4415 + 4280 + 3709 + 4770 =
**17,174**.

**Panel suite five times: exit 0, 0, 0, 0, 0**, 369 passed and 2 skipped each, no
failure and no hook timeout.

**The panel was rebuilt.** `panel/dist/panel.js` **267,662 bytes**. The extensions
folder holds one entry, `com.framopia.studio`, a symlink to
`…/framopia-studio/panel` — this working copy.

### Three mutations, each red, each restored from a saved copy

**M1 — the spend record back out in the open, beside the steps rather than in with
them.**

```
× what is behind one press, and what is not > folds the four rows away once every one of them says the same thing
  → expected { there: 2, drawn: +0 } to deeply equal { there: 3, drawn: +0 }
```

**M2 — the watermark setting back on Make, in the path between the two actions.**

```
× what is behind one press, and what is not > keeps the watermark setting out of the path, and on the screen it affects
  → expected { there: 1, drawn: +0 } to deeply equal { there: +0, drawn: +0 }
```

**M3 — the dead spec reference back in the fonts warning.**

```
× buildFonts > names both fallback fonts in the warning, so the user knows what will render
  → expected 'K2 Syndicalia has no typefaces of the…' to contain 'Change their details'
```

Restored from the saved copies, hashes verified equal: `App.tsx feab428c…87add369`,
`build-fonts.ts 931a3f3c…78c8282f`. **No `git checkout`, `restore` or `stash` at any
point.**

**Assertions holding a live Playwright handle: none left.** Session 102 found three
of its own failing with `RangeError: Invalid string length` and rewrote them to read
extracted counts; the file was re-read this session and every assertion in it reads
an extracted value. The two new ones do the same.

### Part 0, at both ends

| measurement | at start | at end |
|---|---|---|
| ledger records | 294 | **294** |
| ledger sha256 | `77eaf6c9…6c1a84d0` | **`77eaf6c9…6c1a84d0`** |
| `templates/library.aep` | `4b0cf05a…eca6c22aba` | unchanged |
| `modes/dr-loubna-kfafi.json` | `f2fa926e…`, 2026-09-12T20:52:03 | unchanged |
| `modes/k2-syndicalia.json` | `572e99bf…`, 2026-09-09T21:58:19 | unchanged |
| `.local/` directories | 16 | 16 |
| `assets/client-pictures/` | 22 files, 35M | 22 files, 35M |
| CEP extensions | `com.framopia.studio` | `com.framopia.studio` |
| After Effects | 1 (pid 89430) | 1, never launched or quit |
| `aerender` | 0 | 0 |
| listening service | pid 31676 | pid 31676, never stopped |
| `origin/main..main` | 0 | 0 after push |

His seven photographs and his edit to `modes/dr-loubna-kfafi.json` are exactly as
found; no commit names his paths. Nothing was saved in his After Effects.

## 11. Every ledger line added

**None.** 294 records, sha256
`77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0` at both ends.
Nothing this session made a billable call.

## What is open

- **Three states are past the fold** — a run in progress (1523 px), a failure
  (1396 px), a build already made (1097 px) — each because a block he is watching
  sits above two he is not.
- **The list is called *the list*, and his own word is *queue*.** Two strings.
- **The ruler is still a shaped payload, not his service**, and that is how it
  invented 205 px of Build this session and 3381 px of Choose last session.
- **A pressable phrase cannot break across lines**, costing Build's empty state
  26 px since session 102.
- **Nothing says the list kept going while he was away** — sessions 101, 102.
- `NODE_NOT_FOUND_HELP` remains a ruling Mohamed has not made — session 101.
- The one-off client option, the file-extension notice, and the stagger: untouched
  since they were named.
