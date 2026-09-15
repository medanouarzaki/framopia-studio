Status: OK

# Block 14, session 112 — the last of the control audit

The audit Mohamed asked for in session 109 is closed. Every control this panel
can show has now been pressed twice fast and pressed then abandoned, or is named
below with the reason its cell is empty. No browser pages were added: the states
one pass could not reach are reached by navigating the one page that was already
there.

Spend this session: **$0.00**. The ledger is 294 lines at both ends of the
session, same sha256.

---

## 1. The controls session 111 left, named, with the state each needs

Session 111's brief said 28. **It is 39, not 28** — three controls were added to
the panel between session 109's count and this one, and session 109's 87 counted
control *instances on screen*, not declarations in the source. The count is
stated here in the units that can be checked: **72 `<button>`/`<summary>`
declaration sites in `panel/src`, of which 5 are Money's and out of scope, so 67
in scope.**

Thirty-three of those 67 declaration sites render the **78 control instances**
this session enumerated. The remaining 34 are §5.

The states, and why one pass does not reach them. Each is a *navigation* on the
same page — `panelAt` re-`goto`s, and Playwright re-applies `addInitScript` on
every navigation, so a `goto` resets both the counter and the panel for a
fraction of what a new page costs.

| state | how it is reached | controls it adds |
|---|---|---|
| the words editor | Build → press the `Words` opener | 3 |
| the emphasis editor | Build → press the `Emphasis` opener | 2 |
| the picture editor | Build → press the `Pictures` opener | 1 |
| setting up a new client | Choose → pick `__new` in the Client select | 4 |
| a client for one video only | Choose → pick `__once` | 1 |
| changing a client's details | Choose → open the details → `Change their details` | 6 |
| changing a client's colours | Choose → open the details → `Change their colours` | 2 |
| taking a client off the list | …details → `Take them off the list` | 2 |
| a queue running | put one video in the list, start it, adopt `/jobs` | 1 |
| the machine facts behind Details | Choose → `Details` in the readiness block | 2 |

Two more cannot be navigated to, because the panel has to be **born** into them —
both are decided before the first render, so each gets its own page. That is two
pages, not thirty-nine:

| state | how it is reached | controls |
|---|---|---|
| the service not answering | no `realPanelRoutes`; the panel starts against nothing | 2 |
| a second service running | `health.otherService` set before load; a video picked so the notice's block exists | 1 |

Scoping matters and was learned the hard way. The first run of the client-card
states enumerated all 31 controls inside `section.client` — 22 of them the
*Forget* buttons the everything-open pass already covers — and took **660 s**.
Scoping each state to the region its press reveals (`.clientdetails`,
`.paletteedit`, `.confirmremove`) brought it to **306 s**. A state is worth
testing for the controls it *adds*.

---

## 2. The complete table

What is counted is **what reached the service**, not what the DOM did. A guard
that disables a button after the first click but still fires twice passes a DOM
assertion and fails this one.

`✓` = an assertion exists and has been watched go red. Empty = named in §5.

### The four screens

| # | control | where | pressed twice | pressed then closed |
|---|---|---|---|---|
| 1 | Details | every screen | ✓ | ✓ |
| 2 | 1. Choose | every screen | ✓ | ✓ |
| 3 | 2. Make | every screen | ✓ | ✓ |
| 4 | 3. Build | every screen | ✓ | ✓ |
| 5 | Refresh | Choose | ✓ | ✓ |
| 6 | Go to Build | Make | ✓ | ✓ |
| 7 | Make the subtitles again — nothing to pay | Make | ✓ | ✓ |
| 8 | Make the pictures — nothing to pay | Make | ✓ | ✓ |
| 9 | Add sora.mov to the list | Make | ✓ | ✓ |
| 10 | See everything spent — $36.25 so far | Make | ✓ | ✓ |
| 11 | Build the composition | Build | ✓ | ✓ |
| 12 | Words 68 | Build | ✓ | ✓ |
| 13 | Emphasis 3 | Build | ✓ | ✓ |
| 14 | Pictures 5 | Build | ✓ | ✓ |

### The client card, everything open

| # | control | pressed twice | pressed then closed |
|---|---|---|---|
| 15 | Change their colours | ✓ | ✓ |
| 16 | Change their details | ✓ | ✓ |
| 17–38 | Forget ejal40, gana, gouri, hyalift, lola, neauvia stimulate, opera, planiti, profhilo structura, profhilo, radiesse, regenera, restylane, sculptra, pluryal, Cabinet Dr Loubna Kfafi, epilation, hifu, hydrafacial, pbserum, prp, skinbooster — **22 controls, one row each** | ✓ | ✓ |

### Behind a screen that replaces the screen

| # | control | state | pressed twice | pressed then closed |
|---|---|---|---|---|
| 39 | Back | the words editor | ✓ | ✓ |
| 40 | Read | the words editor | ✓ | ✓ |
| 41 | Edit | the words editor | ✓ | ✓ |
| 42 | Back | the emphasis editor | ✓ | ✓ |
| 43 | Emphasise another word | the emphasis editor | ✓ | ✓ |
| 44 | Back | the picture editor | ✓ | ✓ |
| 45 | Back | setting up a new client | ✓ | ✓ |
| 46 | Choose folder… | setting up a new client | ✓ | ✓ |
| 47 | Choose file… | setting up a new client | ✓ | ✓ |
| 48 | Choose a photo… | setting up a new client | ✓ | ✓ |
| 49 | Back | a client for one video only | ✓ | ✓ |
| 50 | Choose *Their video folder* | changing their details | ✓ | ✓ |
| 51 | Clear *Their video folder* | changing their details | ✓ | ✓ |
| 52 | Choose *Their logo* | changing their details | ✓ | ✓ |
| 53 | Save their details | changing their details | ✓ | ✓ |
| 54 | Cancel | changing their details | ✓ | ✓ |
| 55 | Take them off the list | changing their details | ✓ | ✓ |
| 56 | Save their colours | changing their colours | ✓ | ✓ |
| 57 | Cancel | changing their colours | ✓ | ✓ |
| 58 | Yes, take Dr Loubna Kfafi off the list | the confirmation | ✓ | ✓ |
| 59 | Keep them | the confirmation | ✓ | ✓ |
| 60 | take it out | a queue running | ✓ | ✓ |
| 61 | Hide details | the machine facts | ✓ | ✓ |
| 62 | Try again | the machine facts | ✓ | ✓ |

### When the service is wrong

| # | control | state | pressed twice | pressed then closed |
|---|---|---|---|---|
| 63 | Try again | the service not answering | ✓ | ✓ |
| 64 | What it said | the service not answering | ✓ | ✓ |
| 65 | Stop the other one | a second service running | ✓ | ✓ |

**The arithmetic.** 65 rows, of which row 17–38 is 22 controls, so **78 control
instances**, each with two cells: **156 cells, 156 earned, 0 empty among the 78
reached.** They come from 33 of the 67 in-scope declaration sites. The other 34
sites are §5 and have no cells at all rather than unearned ones.

Per state, and how many of each state's controls actually reached the service:

| state | controls | reach the service |
|---|---|---|
| Choose | 5 | 0 |
| Make | 9 | 2 |
| Build | 8 | 1 |
| Choose, everything open | 29 | 22 |
| the words editor | 3 | 0 |
| the emphasis editor | 2 | 0 |
| the picture editor | 1 | 0 |
| setting up a new client | 4 | 0 |
| a client for one video only | 1 | 0 |
| changing a client's details | 6 | 1 |
| changing a client's colours | 2 | 1 |
| taking a client off the list | 2 | 1 |
| a queue running | 1 | 1 |
| the machine facts behind Details | 2 | 0 |
| the service not answering | 2 | 0 |
| a second service running | 1 | 1 |
| **total** | **78** | **30** |

Thirty controls can reach the service. A control that posts nothing cannot
double-spend — and that is *measured* here, by pressing it and watching what
arrived, not asserted.

---

## 3. Proof the table bites, and the one thing that was fixed

### The red, verbatim

`disabled={busy}` removed from the *Forget this* button in
`panel/src/ClientPictures.tsx`, everything else untouched, the file restored
afterwards from the saved copy:

```
AssertionError: expected [ …(22) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "Forget ejal40: DELETE /clients/pictures?client=dr-loubna-kfafi&picture=pic001 ×2",
+   "Forget gana: DELETE /clients/pictures?client=dr-loubna-kfafi&picture=pic002 ×2",
+   "Forget gouri: DELETE /clients/pictures?client=dr-loubna-kfafi&picture=pic003 ×2",
+   "Forget hyalift: DELETE /clients/pictures?client=dr-loubna-kfafi&picture=pic004 ×2",
+   … 18 more
+ ]
```

**What that would have done to him in production:** a second `DELETE` for a
photograph already gone. It does not delete his file — the route unlinks the
picture from the client, never the bytes — but the second call answers 404 and
the panel would show him an error for an action that in fact worked.

### What was fixed, and the correction to the record

One fix, and it needs stating plainly because **the first diagnosis was wrong**.

Commit `a45b850` added a `useRef` guard to `change()` in
`panel/src/ClientCard.tsx`, on the strength of 20 then 8 double-fires seen in a
panel run. It did not fix them. The actual cause was **the instrument, not the
panel**: the stub answered after 350 ms, and under load Playwright's two clicks
land about 400 ms apart, so the first request had already finished and the second
was a *legitimate* second press being counted as a double-submit. Raising the
stub to **3000 ms** makes the two unambiguous — two requests now means the second
arrived while the first was still in flight, always.

Against the 3 s instrument the panel is clean, and the ref turns out not to be
load-bearing (§4). Commit `2fae745` corrects both the instrument and the claim in
the source comment rather than leaving a false one standing. **No production
defect was found by the two scenarios this session.** The 30 controls that reach
the service each send exactly one request for one action.

---

## 4. Which guards needed removing twice

A passing test is not a working guard. Each relied-on guard was removed on its
own, against the 3 s instrument.

| guard | removed alone | verdict |
|---|---|---|
| `disabled={busy}` on *Forget this* (`ClientPictures.tsx`) | **red**, 22 controls, verbatim above | load-bearing, alone |
| the `working` ref in `change()` (`ClientCard.tsx`) | **green** — 30 tests pass | **not load-bearing**; `disabled={busy}` alone holds |

So of the two guards on the client-card change path, only one was ever needed.
The ref stays — it is the pattern this project settled on for this class of
control and it costs nothing — but the source comment now says outright that it
was added on the strength of a red the *instrument* produced, not the panel, and
that removing it does not turn the test red. A comment claiming a defect that was
never measured is worse than no comment.

The `Carry on` control in `PastQueues.tsx` carries two guards (`disabled` plus a
check inside the handler) from session 111; it is not in this session's
enumeration (§5) and neither guard was re-tested here.

---

## 5. Every empty cell, with its reason

Thirty-four in-scope declaration sites are not in this session's enumeration.
None of them is marked. Grouped by what each would need:

**Needs a `<details>` opened on a screen the pass did not open one on** — the
enumeration selects `main button, nav.moments button`, which does not include
`<summary>`:

- `Build.tsx:194` — *N cards are too short to hold*
- `Build.tsx:309` — *What else it will use*
- `App.tsx:857` — *…'s colours, type, photographs and details*
- `App.tsx:1283` — *What this video has cost so far*
- `App.tsx:1296` — *What it cost, step by step*
- `App.tsx:1354` — *The watermark on this video*
- `App.tsx:1833` — *What these two make*
- `PastQueues.tsx:118` — *N older*

**Needs real data this reel does not have:**

- `Images.tsx:203`, `Images.tsx:275` — the image picker's two choose controls. `sora` has no generated slots on this plan; generating them costs money and the ceiling this session was $0.00.
- `Keywords.tsx:135` (drop a keyword), `Keywords.tsx:169` (promote a word) — need an emphasis list with items in it; the editor opened empty.
- `Transcript.tsx:199` (filter), `:272` (a word), `:307` (restore), `:311` (the script chip), `:326`/`:334` (nudge earlier/later) — all live inside the words editor's *Edit* mode, which the enumeration reaches but does not enter.
- `ClientPictures.tsx:174` (choose a photograph), `:222` (add it), `:321` (save a label) — the add-a-photograph form. Reachable with the chooser stub, but adding a photograph **writes to his store**, and no control that writes a user asset was pressed twice against live data.

**Needs a failure that did not happen:**

- `Build.tsx:377` — the retry after a build that failed
- `App.tsx:1574` — *Try again* after a pipeline run that failed
- `Queue.tsx:233` — *Try again* on a failed queue row
- `PastQueues.tsx:99` — *Carry on* (session 111 closed this one by hand; it is not in the enumeration)
- `WrongClient.tsx:52` — the wrong-client offer (session 109 closed this one by hand)

**Reachable, and deliberately not pressed:**

- `App.tsx:897` — *Browse…*. Opens the OS file dialog through CEP. The chooser is stubbed elsewhere; pressing it twice here would prove the stub, not the panel.
- `App.tsx:1107` — the queue's own start button. It is *pressed* to reach the running-queue state, so it is exercised, but it disables itself on the first press and cannot be enumerated as a cell.
- `App.tsx:1632` — the three picture-size buttons; they are a radio group, and pressing one twice is a legitimate second press.
- `App.tsx:1747` — *Make this video*, the single-video run button. On this plan the Make screen shows the two halves instead. Reaching it means a plan with nothing done, which means a video that has not been transcribed.
- `NewClient.tsx:381` — *Save*, disabled until the new-client form is valid; filling it in creates a client.
- `NewClient.tsx:746` — *Use the usual*, only rendered once the baseline field has been changed.
- `Queue.tsx:202` — *Stop after this video*. Stopping a queue is a state change the enumeration's second press would then be pressing against.
- `Sentence.tsx:46` — the inline pressable phrase; it is a rendering of whatever it was given and has no action of its own.

**Out of scope, per the brief:** the 5 declarations in `Money.tsx`.

---

## 6. The fold Mohamed has not ruled on — there is nothing to rule on

Session 111 flagged that its *cannot record* sentence might push Make past the
896 px it already measured, and past the 900 px ceiling. Measured:

```
Make worst, recording fine:   694px  (warnings 0, steps 4)
Make worst, cannot record:    754px  (warnings 1, steps 4)
```

Both inside 900. The sentence costs **60 px** and buys nothing back.

The reason session 111's worry was unfounded is that **the two states are
disjoint**. The 896 px state is a single-video pipeline run, rendered by
`RunProgress`. The `notRecorded` sentence only ever appears on a *queue*, which
is rendered by `Queue` and never shows `RunProgress` at all. The panel cannot be
in both at once, so the heights do not add.

**No choice needs putting to him.** The sentence stays, untouched.

---

## 7. What held

| thing | before | after |
|---|---|---|
| golden | 17,174 fields, 4 of 4 | **17,174, 4 of 4, PASS** |
| the figures Mohamed reads | session 102's reading | **identical**, field by field |
| Choose | 374 px | 374 px |
| Make, an ordinary day | 616 px | 616 px |
| Make, a run in progress | 896 px | 896 px |
| Make, a stage failed | 891 px | 891 px |
| Build, ready | 497 px | 497 px |
| Build, nothing chosen | 347 px | 347 px |
| Build, built once | 784 px | 784 px |
| Build, no typefaces | 621 px | 621 px |
| distinct type settings | 16 | 16 |
| the two decisions, apart | 88 px | 88 px |
| run button to queue | 190 px | 190 px |
| spacing | 28 / 16 / 8 | 28 / 16 / 8 |

Nothing on any screen passes 900 px.

**The suite's timing moved, and by a lot.** The panel suite went from roughly
200 s to **330 s**, entirely because of the twelve states added to the
enumeration. Five consecutive runs: **333.36 s, 329.47 s, 329.42 s, 329.29 s,
328.83 s** — a 4.5 s spread across five runs, which is as stable as it was
before. It is slower and it is not flakier.

---

## 8. What I am least sure about

**That the 3 s stub is now long enough.** It is long enough on this Mac under the
load this session put on it. The 350 ms that preceded it was also long enough
until it was not. Three seconds is a number chosen to be comfortably past the
gap two Playwright clicks can open under load, not a number derived from
anything. If the suite ever reports a double-fire again, suspect the instrument
before the panel — that is the whole lesson of §3.

**That "reached the service" is the right thing to count.** It is the right
thing for money and for writes, which is why the order was chosen. It is blind to
a control that double-fires something purely local — two `setState`s, two
navigations. Nothing this session measured such a defect, and nothing this
session would have.

**The twelve states are reached by a script, and a script's idea of a state is
not his.** `the picture editor` finds exactly one control — `Back` — because this
plan's picture editor has nothing else in it. That is a true measurement of this
reel and a thin one of that screen.

**The three controls that write a user asset were not pressed twice against his
store**, by choice. They are the ones where a double-press would matter most and
the ones I was least willing to run live. That is the largest honest gap in the
audit.

---

## 9. Measured

**Gate.** `npm run check`, run alone on `2fae745`, allowed to finish: **exit 0**,
`check: PASS`.

```
core        846 passed (846)
service    1617 passed (1617)
benchmarks  173 passed (173)
panel       446 passed | 2 skipped (448)
pytest      149 passed in 6.75s
```

**Golden.** PASS, 4 of 4, 4415 + 4280 + 3709 + 4770 = **17,174**.

**Test-name arithmetic**, against `a4cd9c3`:

```
panel:    404 -> 404
core:     777 -> 777
service: 1570 -> 1570
```

No test names were added or removed, and none was weakened or deleted. The panel
run count went **424 → 446, +22**, because the twelve new states are rows in two
`it.each` tables rather than new `it(…)` names: ten states × two scenarios = 20,
plus the two born-into states = 22. Both numbers are stated because either alone
misleads.

**Five panel runs**, on `2fae745` with core, service and panel all rebuilt so the
build stamps match: exit **0, 0, 0, 0, 0**; 446 passed + 2 skipped each time;
333.36 s, 329.47 s, 329.42 s, 329.29 s, 328.83 s.

**Bundle.** `npm run panel:build` → `panel/dist/panel.js`, **272,894 bytes**.
Symlink intact:

```
com.framopia.studio -> /Volumes/T7 Shield/INSEA/Projects/framopia-studio/panel
```

**Part 0, both ends — every figure identical:**

| | start | end |
|---|---|---|
| ledger lines | 294 | **294** |
| ledger sha256 | `77eaf6c9ca6b633ed2ecb12b` | **same** |
| `templates/library.aep` | `4b0cf05a8f5d4775c03e8ebd` | **same** |
| `modes/dr-loubna-kfafi.json` | `f2fa926e14953b6a`, 2026-09-12T20:52:03 | **same** |
| `modes/k2-syndicalia.json` | `572e99bf890ceefb`, 2026-09-09T21:58:19 | **same** |
| `.local/` directories | 17 | **17** |
| `.local/queues/` | 4 files, 16K | **4 files, 16K** |
| queue record hashes | `adc83ff9114a0df1 bf3048ffe8ee6e81 f27f98aec8bea681 c8401e0f784fa4f2` | **same** |
| `assets/client-pictures/` | 24 files, 35M | **24 files, 35M** |
| service pid | 91308 | **91308**, not restarted |
| After Effects | 1 running | **1 running** |
| `aerender` | 0 | **0** |

The 24th file in the picture store is `.DS_Store`, not a photograph: 22 of his,
plus session 108's crop, plus that.

**His 22 photographs: byte-identical, dimensions included.** Verified by sha256
of every file under `assets/client-pictures/dr-loubna-kfafi/`, diffed against the
list taken at the start — no differences.

**Working tree** at the end: `modes/dr-loubna-kfafi.json` modified and the
untracked photographs, both expected. Nothing else.

---

## 10. Money

**No ledger line was added.** 294 at the start, 294 at the end, same sha256.
Expected $0.00, spent $0.00. Nothing this session could bill: the enumeration
runs against a stubbed `fetch`, and the two screen measurements are geometry.

---

## What is left

- **`Images.tsx`'s two picker controls** stay unproved until a reel with
  generated slots exists. `ground-truth` is the natural one and still cannot
  build until its six slots are generated.
- **The three controls that write to his picture store** were deliberately not
  pressed twice against live data. Closing them needs a scratch client and a
  throwaway photograph, not his.
- **The words editor's *Edit* mode** — six controls — is reachable in one more
  navigation and was not added this session because the enumeration is already
  330 s.
- Everything session 111 left open stays open: a resume leaves the old record
  saying *still going*; a replaced video and a removed client under a running
  queue are unmeasured; `test-3` is $2.35 from free and the Google account's
  prepayment credits are depleted.
