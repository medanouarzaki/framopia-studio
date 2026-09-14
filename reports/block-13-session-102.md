Status: OK

# Block 13, session 102 — the next thing to press is where the last one was

Mohamed: *"when I click a button, the next button I'm going to click on should be
near to it."*

**Every height reported since session 95 was a height of an empty panel.** Measured
with his own data, Choose was **4000 px of a 900 px window** — the client card alone
3500 px of it, sitting between the two decisions Choose exists for. It is now
**619 px**, with 281 px to spare.

Six sentences named a place and left him to find it; all six now carry the way
there inside them, with no word changed. Panel **367 passed**, gate green, golden
17,174.

## 1. The real height of each screen, against the stub figures

Both rulers are kept, named. The stub one is the floor — what the panel costs
before anyone uses it. The other is what he sees.

| screen | stub (session 99–101) | **his data, before** | how far past 900 px |
|---|---|---|---|
| 1. Choose | 625 px | **4000 px** | **3100 px** |
| 2. Make | 676 px | **2044 px** | **1144 px** |
| 3. Build | 516 px | **964 px** | 64 px |

Where Choose's 4000 px went: `section.client` **3500 px**, `section.video` 225 px.
Where Make's went: *Cost* **968 px**, *This video* 414 px, the queue 336 px — which
matches his screenshot putting the cost figure near 1395 px.

**The stub was wrong by 6.4× on the screen he opens on.** It renders no client, so
no card; no video, so no stages and no cost; no queue. The new ruler is driven the
way he drives it — Dr Loubna Kfafi chosen from her real file, a video run all the
way through, four videos in the list — and the clients are read by `loadMode`,
shaped by `listModes`' own four derivations.

It measures **only with the service answering**, and that is not an omission: his
data *comes from* the service, so "his data, service not answering" is the empty
panel the stub ruler already measures under its own name.

## 2. Every instruction that named a place

Seven. Six now carry the way there; the seventh is named rather than touched.

| where | what it said | what it is now |
|---|---|---|
| `words.ts` | *Everything for this video is made.* **Go to Build** *to put the composition together.* | **Go to Build** goes to Build |
| `words.ts` | **Open their card** *above and set the folder their videos are in, then press Refresh.* | **Open their card** opens it |
| `words.ts` | *Put a video in it and press Refresh, or* **set a different folder on their card** *above.* | opens it |
| `Build.tsx` | **Choose a client and a video** *above, and this will say what the composition will contain.* | goes to Choose |
| `Build.tsx` | *…* **Press Run pipeline** *above, and this will say what the composition will contain.* | goes to Make |
| `Queue.tsx` | **Pick a video** *above and build it, the same way you always do.* | goes to Choose |

**Four of these said *above* and meant another screen.** Since session 97 the
pickers are on Choose and Run is on Make; *above* has been wrong for five sessions.

**Not changed — and it is a defect:** `words.ts` says *"The key for the paid
services was not accepted. Check it on the Settings screen."* **There is no
Settings screen in this panel** — no component, no route, nothing named Settings
anywhere in `panel/src`. Fixing it is rewording, and `words.ts` is settled, so it
stands and is written down here instead.

**Checked and correctly left alone:** `Keywords.tsx`' *"add your own below"* — that
one really is below, inside the editor; and `service.ts`' *"line at the top"*,
which is about a file, not a place on screen.

**No wording changed anywhere.** All seven settled sentences are still present,
character for character, each exactly once:

```
1  Choose a client and a video above, and this will say what the composition will contain.
1  Press Run pipeline above, and this will say what the composition will contain.
1  There is nothing to build for this video yet.
1  Pick a video above and build it, the same way you always do.
1  Everything for this video is made. Go to Build to put the composition together.
1  Open their card above and set the folder their videos are in, then press Refresh.
1  Put a video in it and press Refresh, or set a different folder on their card above.
```

`aroundPhrase` splits a sentence around its phrase and a test asserts
`before + phrase + after` is the sentence — so a session that rewords one without
moving its phrase goes red rather than losing the way there in silence.

### After a run, and after a queue

**After a run finishes** the next thing is build, and the control is the sentence at
the top of *This video* — which now goes there. **Where it should be** is at the
foot of the run's own progress block, where his pointer actually is when the last
stage turns green. Not moved; named in section 9.

**After a queue finishes** the next thing is build, and the control is the summary's
last line, which now goes to Choose. Choose is the honest destination: a queue runs
many videos and he has to say which one.

### The steps still mean something

All three remain pressable, none is disabled, and going back is still going back — a
test presses the way there and then walks back to Choose. Nothing drags him forward.

## 3. What went behind one press, and what stayed in view

One mechanism throughout: `<details class="quibbles">`, the disclosure Build already
uses for *What else it will use*. No second visual language, no library, no
animation.

| what | where | why |
|---|---|---|
| the client card | Choose | reference, 3500 px, between two decisions |
| the watermark control | Make | a setting standing in the path between two actions |
| the four stage rows | Make | **only once every one of them says the same thing** |

**Stayed in view on Choose:** the client picker and the video picker, now **101 px
apart**.

**Stayed in view on Make:** the finished-video sentence, the wrong-client and
second-service notices, both run buttons with their prices, the queue, the way to
the full cost screen, and what this video has cost so far.

**What is behind each press is named, not *More*:** *Dr Loubna Kfafi's colours,
type, photographs and details*; *The watermark on this video*; *What was done — all
4 steps*.

**Where the watermark belongs is Build**, beside *What else it will use*, which
already states the watermark this composition will get — the setting and the
sentence describing its effect in one place. It is collapsed on Make this session
rather than moved: moving a control between screens is a larger change than a
layout pass, and it would put a control that writes to the plan on the screen that
builds.

**What the cost block needs at a glance**, and what does not:

- *At a glance*: what this video has cost so far, and the way to the full screen.
  The figure he acts on is on the button — *Make the pictures — about $2.17* —
  which session 98 settled as the primary.
- *Behind*: the four rows once they are done (done), and **the soft-alarm
  threshold**, which is a constant rather than a fact about his video and belongs
  with the rest of the accounting. Not moved — it is a figure, and nothing is
  deleted this session.

`section.cost` went **968 px → 231 px**.

## 4. Whether four rows of the same thing earn their space

**Not once they all say it.** *Writing down the words — Already done, nothing to
pay*, four times over, is 150 px saying one thing, and since session 101 there is a
sentence at the top of Make saying exactly that in one line.

So they fold — **and only when everything is done**. While anything is still to run
they are the decision itself: which stages cost money and what each will do, and
they stay in full view, as they do during a run when they are what he is watching.
Two tests hold that apart: one asserts all four rows are present and undrawn on a
finished video, the other that there is **no disclosure at all** and all four are
drawn when three stages are still pending.

Nothing is deleted — the summary says how many are behind it.

## 5. Each screen's height after

| screen | stub, answering | stub, not answering | **his data** |
|---|---|---|---|
| 1. Choose | 625 px *(was 625)* | 683 px *(was 683)* | **619 px** *(was 4000)* |
| 2. Make | 676 px *(was 676)* | 734 px *(was 734)* | **1242 px** *(was 2044)* |
| 3. Build | **542 px** *(was 516)* | **600 px** *(was 574)* | **964 px** *(was 964)* |

**Choose now fits, with 281 px to spare.** Make is **342 px** past the fold with
four videos in the list; Build is 64 px past, unchanged.

**Build's stub grew by 26 px, and it is the one regression here.** A `<button>` is
an atomic inline box even at `display: inline`, so making *Choose a client and a
video* pressable stops the line breaking inside it and costs one line. It affects
only the state where Build has no preview — with his data Build is 964 px before
and after, because a video that has been run renders the preview instead.

## 6. Colours, buttons and the settled wording

**Nothing free is red and no failure is red.** The way there carries no colour of
its own — a test reads its computed style and asserts it is not the accent
`rgb(237, 28, 36)`, that its background is transparent, and that it is underlined.

**`.linky` had no CSS rule at all** before this session — it was the queue's *take
it out*, drawing as a native grey button in the middle of a list. It has one now,
and that is the only new rule in `panel.css`.

**No button does anything different.** The two run buttons, the queue's controls,
Build and the three editors are untouched. `spend.ts` is untouched; money is still
to the cent. **The full cost screen was not opened.**

Removed lines, per file, ignoring indentation:

| file | removed | what they were |
|---|---|---|
| `App.tsx` | 10 | an import, and three JSX wrappers regrouped |
| `Build.tsx` | 7 | one `<p>` split into three branches |
| `Queue.tsx` | 3 | one `<p>` around an unchanged sentence |
| `panel.css`, `words.ts`, `words.test.ts`, `browser-harness.ts` | 0 | additions only |
| `Sentence.tsx`, `near-the-last-one.browser.test.ts` | 0 | new files |

**No settled sentence is among them** — every one reappears verbatim, proved above.

## 7. `core/` and `service/` untouched, and the figures

`git status --porcelain -- core service` is **empty**. Against the session-start
commit `9df464b`, in a throwaway worktree:

```
diff -r --brief core/src    <worktree>/core/src     → CORE IDENTICAL
diff -r --brief service/src <worktree>/service/src  → Only in service/src: .DS_Store
```

A Finder artefact, gitignored, not a source file. **Every byte that computes a
figure is the same byte it was**, so `sora-3`, `sora-4` and `test` through `dryRun`
and `stepsFor` cannot differ, and the run confirms it.

**Said plainly**: the script that produced the session 95–101 `before.json` is no
longer in the scratchpad — what is left there under its name is a one-line stub —
and its field derivations could not be recovered, so its absolute numbers are not
reproducible by a script I can show. The byte-level identity above is the stronger
claim and is the one this session rests on. A reading with a script whose
derivations are written down is recorded for session 103 to diff against.

## 8. The walkthrough, and what the pointer travels

### 1. Choose — 619 px

The service line. *Client*, a dropdown reading **Dr Loubna Kfafi**. Under it one
closed row: *Dr Loubna Kfafi's colours, type, photographs and details*. Then
*Video*, a dropdown, *Refresh* and *Browse…*, and *From /Volumes/…/Dr Loubna Kfafi*.

### 2. Make — 1242 px with four in the list

*This video*. **Everything for this video is made. Go to Build to put the
composition together** — *Go to Build* underlined. *Make the subtitles again —
nothing to pay*; *Make the pictures — nothing to pay*. One closed row: *The
watermark on this video*. Then *Make several videos*, four rows with *take it out*,
and *Make these 4 videos*. Then *Cost*: *See everything spent — $36.25 so far*,
*$3.40 spent on this video so far*, *soft alarm $2.00*, and one closed row: *What
was done — all 4 steps*.

### 3. Build — 964 px

*Build*, the fonts note, the card — the video and client, what it will contain,
that it replaces what is there, that it is free — *What else it will use* closed,
*Build the composition*, and *Change something first* with its three editors.

### Journey one: open → client → video → subtitles → pictures → build

| step | pointer | distance to next |
|---|---|---|
| the client dropdown | Choose, 253 px | **101 px** to the video dropdown |
| the video dropdown | Choose, ~394 px | one press to **2. Make** |
| *Make the subtitles* | Make | ~50 px to *Make the pictures*, directly under it |
| *Make the pictures* | Make | the sentence appears above the buttons; *Go to Build* is in it |
| *Go to Build* | Make | one press, and he is on Build |
| *Build the composition* | Build | — |

The client card used to be **3500 px** of that first step. It is one closed row.

### Journey two: four videos in the list → start → come back → build one

Pick each video on Choose, press *Add … to the list* on Make. **The run button to
the queue's first control is 220 px folded, 287 px with the watermark open** — the
setting is no longer in the path. *Make these 4 videos*. He closes the panel.

He comes back: **2. Make** carries `4 ready` in green. The queue's summary names
each video and what it cost, and ends *Pick a video above and build it, the same way
you always do* — **Pick a video** takes him to Choose.

**What is still missing**: nothing says *this kept going while you were away*.
Section 9, carried from session 101.

### Journey three: open a finished video → build it

Choose the client, choose the video — **101 px** apart. **2. Make**. The first thing
he reads is *Everything for this video is made*, and the way to Build is in the
sentence. One press, and *Build the composition* is 592 px below the switcher he
just pressed.

## 9. What I am least sure about

**A button cannot break across lines, and I did not know that before measuring.**
It cost Build's empty state 26 px. Any sentence made pressable in future will pay
the same price, and it will be paid quietly.

**The watermark is collapsed where it does not belong.** Its home is Build; this
session put it behind a press on Make, which is an improvement to a thing in the
wrong place. A future session that moves it should not have to undo this.

**Make is still 342 px past the fold** with four videos in the list. What is left
is real content — a queue he is watching, and his accounting — and the honest next
cut is the soft-alarm threshold and the queue's standing explanation, neither of
which I touched because both are figures or settled words.

**`openReference` makes thirteen existing tests indifferent to whether a thing is
collapsed.** That is what let them be converted once instead of every session — and
it also means none of them would notice if a disclosure were removed. That is why
the six new tests in `near-the-last-one.browser.test.ts` exist, and they are the
only thing holding any of this session's layout in place.

**What I would change next:** put the way to Build at the foot of the run progress
block, where his pointer is when the last stage finishes; move the watermark to
Build; and make coming back mid-queue say so.

## 10. Gates

`npm run check`, **run alone, after committing: exit 0, `check: PASS`.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | 1577 | 0 | 1577 |
| benchmarks | 173 | 0 | 173 |
| panel | **367** | 2 | 369 |
| pytest (CV sidecar) | 149 | 0 | 149 |

core, service, benchmarks and pytest identical to session 101; panel **353 → 367**.

**Arithmetic by name: 14 added, 0 removed, 0 renamed.** Verified by extracting every
`it(…)` name from `panel/src` at `9df464b` and now: 353 before, 367 after, and the
`comm` of the two lists shows fourteen additions and an empty removal side.

| file | added |
|---|---|
| `words.test.ts` | 4 — the sentence comes back verbatim; the phrase is found where it is; a missing phrase says so; every way there is still in its sentence |
| `near-the-last-one.browser.test.ts` | 9 — *Go to Build* arrives; no colour of its own; all three steps still pressable; the two decisions are adjacent; the summary names what is behind it; the card opens and still works; the watermark is out of the path; the rows fold when done; the rows stay when anything is pending |
| `measure-height.browser.test.ts` | 1 — the ruler with his data |

**Thirteen tests were taught to open a disclosure and none was deleted or
weakened.** One was strengthened while being taught: *shows the colours, the type
and his own line* read the whole section's `textContent`, which returns what
`display:none` is hiding — Block 11 session 69's trap — and now reads only what is
drawn.

`npm run golden`: **PASS, 4 of 4, field for field.** 4415 + 4280 + 3709 + 4770 =
**17,174**.

**Panel suite five times: exit 0, 0, 0, 0, 0**, 367 passed and 2 skipped each, no
failure and no hook timeout.

**The panel was rebuilt.** `panel/dist/panel.js` **266,962 bytes**. The extensions
folder holds one entry, `com.framopia.studio`, a symlink to
`…/framopia-studio/panel` — this working copy, so what he opens is what was tested.

### Three mutations, each red, each restored from a saved copy

**M1 — the client card back in the flow, not behind the press.**

```
× what is behind one press, and what is not > keeps the two decisions on Choose next to each other
  → expected true to be false
```

**M2 — the sentence renders as plain prose, with no control in it.**

```
× turns “Go to Build” into the control that goes to Build
  → expected null to be 'Go to Build'
× gives the way there no colour of its own
  → page.$eval: Failed to find element matching selector "section.do p.say button.linky"
× leaves all three steps pressable after it has taken him somewhere
  → page.click: Timeout 30000ms exceeded.
```

**M3 — the rows fold whether or not anything is left to run.** This one found a
defect in my own test before it found the mutation: the assertion held a live
Playwright handle, so the red was

```
FAIL … RangeError: Invalid string length
 ❯ printObjectProperties …/@vitest/pretty-format/dist/index.js:122:47
```

— a real failure that says nothing about what broke. Three such assertions were
rewritten to read extracted counts, and the mutation then reported itself:

```
× keeps the rows in full view while anything is still to run
  → expected { there: 1, drawn: 1 } to deeply equal { there: +0, drawn: +0 }
```

Restored from the saved copies, hashes verified equal:
`App.tsx 4cd37cef…a9a29ca3`, `Sentence.tsx 4fc87ea4…3c95fceddd`. **No `git checkout`,
`restore` or `stash` was used at any point**, which is session 99's lesson.

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
| listening service | pid 11415 | pid 11415, never stopped |
| `origin/main..main` | 0 | 0 after push |

His seven photographs and his edit to `modes/dr-loubna-kfafi.json` are exactly as
found; no commit names his paths. Nothing was saved in his After Effects.

## 11. Every ledger line added

**None.** 294 records, sha256
`77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0` at both ends.
Nothing this session made a billable call.

## What is open

- **`words.ts` sends him to a Settings screen that does not exist** (section 2).
- **The watermark is behind a press on the wrong screen** — its home is Build.
- **Make is 342 px past the fold** with four videos queued.
- **Nothing says a queue kept going while he was away** — carried from session 101.
- **A pressable phrase cannot break across lines**, and costs Build's empty state
  26 px.
- **A sentence names a step** and nothing catches it going stale — carried from
  session 101.
- `NODE_NOT_FOUND_HELP` remains a ruling Mohamed has not made — session 101.
- The one-off client option, the file-extension notice, and the stagger: all
  untouched since they were named.
