Status: PROBLEM — the two states he meets most are rebuilt and proved; eleven of the eighteen are inventoried and left as they are, and this session did not finish them.

# Block 13, session 100 — design every state, not just the happy one

**Too big for one session, and section 1 says which parts were done.** The service
not answering — the state Mohamed has photographed most, and 211 px of it — and
the three empty states his partner meets on first open are rebuilt, proved and
pinned. The other eleven are inventoried with the three questions answered, and
three of them cannot be fixed without touching `core/` or `service/`, which this
session must not.

Panel suite **349 passed, 2 skipped, 0 failed**; gate green; bundle rebuilt.

## 1. Every state, designed or accidental

**Two states are missing from the brief's list and I found them:**

- **19. A one-off client** — *"Just this video…"* in the client picker. Accidental:
  it is an option in a dropdown with no explanation of what it means or what
  happens to the video afterwards.
- **20. The host has no file dialog.** Real and reachable — the panel says *"This
  copy of After Effects offers no file chooser"* and lists ten file extensions.
  Accidental, and the extension list is the tool talking to itself.

| # | state | designed? | done this session |
|---|---|---|---|
| 1 | first open, no clients | **accidental** — a dropdown label and nothing else | **rebuilt** |
| 2 | a client, no videos | **accidental** — a path and an apology | **rebuilt** |
| 3 | client with no video folder | **accidental** — indistinguishable from 2 | **rebuilt** |
| 4 | waiting for the lists | accidental — three fetches, three re-renders | left |
| 5 | a run in progress | **designed** — session 95's stage rows | left |
| 6 | a queue running | **designed** — sessions 94, 98 | left |
| 7 | a step taking minutes | **designed** — the note says so | left |
| 8 | a video fully run | accidental — every row *already done*, buttons *$0.00* | left |
| 9 | a composition rebuilt | **designed** — session 99's *replacing what is there* | left |
| 10 | **service not answering** | **accidental** — 211 px, raw cause, attempt count | **rebuilt** |
| 11 | a stage failed | **designed** — session 95's `causeWords` | left |
| 12 | a queued video refused | **accidental** — raw guard text | **blocked**, needs `service/` |
| 13 | panel running older code | **designed** — session 67, the one exemption | left |
| 14 | two services running | **designed** — session 79 | left |
| 15 | very long names | accidental → **now designed** by session 99's shortening | — |
| 16 | a queue of fifteen, or one | **designed** — session 98 | left |
| 17 | closed the panel mid-queue | **accidental** — the work survives, nothing says so | left |
| 18 | after a build succeeds | **designed** — session 99's *Your composition is here* | left |
| 19 | a one-off client | **accidental** — found this session | left |
| 20 | no file dialog | **accidental** — found this session | left |

### The three questions, per state

**Rebuilt this session**

- **1. First open, no clients.** *Knows what happened:* yes — *No clients yet.*
  *Knows what to do:* **now yes** — *"Start by setting one up — their name, their
  colours, and the folder their videos are in."* Before: nothing. *Proportionate:*
  yes, one line.
- **2. No videos in the folder.** *What happened:* yes. *What to do:* **now yes** —
  *"Put a video in it and press Refresh, or set a different folder on their card
  above."* *Proportionate:* one line, and **no path** where a path used to be the
  whole explanation.
- **3. No folder set.** *What happened:* **now yes, and told apart from 2** —
  *"This client has no video folder yet."* *What to do:* *"Open their card above
  and set the folder…"* *Proportionate:* one line.
- **10. Service not answering.** *What happened:* **now in his words** — *"The
  background helper has not answered yet. It usually starts on its own."* *What to
  do:* **Try again**, on the same line. *Proportionate:* **211 px → 129 px.**

**Left as they are, with the answers as they stand**

- **4. Waiting.** Knows: partly — the dot says *Starting…*. What to do: nothing, correctly. Proportionate: yes, but it **reflows** as three fetches land, which is the stagger he described. **Not fixed.**
- **5. Run in progress.** Knows: yes — *Doing this now*, and which stage. What to do: wait. Proportionate: yes.
- **6. Queue running.** Knows: yes, on Make and on the step from anywhere. What to do: nothing, or **Stop after this video**. Proportionate: yes.
- **7. A minutes-long step.** Knows: yes. What to do: wait. Proportionate: yes.
- **8. Fully run.** Knows: **poorly** — four rows of *Already done — nothing to pay* and two buttons at *nothing to pay* read as though nothing ever happened. What to do: **unclear** — the next thing is Build, and nothing says so. Proportionate: yes. **Not fixed, and the strongest candidate for next.**
- **9. Rebuilt.** Knows: yes — *replacing what is there*. What to do: press it. Proportionate: yes.
- **11. Stage failed.** Knows: yes, since session 95. What to do: yes, one thing. Proportionate: one sentence.
- **12. Queued video refused.** Knows: **no** — raw guard text, *"re-generating would discard editor work on 8 slot(s): img002 (a candidate was chosen (img002-c2)); …"*. What to do: **no**. **Blocked:** the sentence is composed in `service/src/queue.ts`.
- **13. Older code.** Knows: yes. What to do: yes — the one exempt command. Proportionate: yes.
- **14. Two services.** Knows: yes. What to do: yes, one button. Proportionate: yes. **Never seen by anyone**, so untested against reality.
- **15. Long names.** Fixed in session 99 — 44.1 to 9.6 characters.
- **16. Fifteen, or one.** Knows: yes. What to do: yes. Proportionate: yes.
- **17. Came back mid-queue.** Knows: **only if he looks at Make** — the step's news says `3/5`, which session 98 added, so this is better than it was. Nothing says *"this kept going while you were away"* on return. Partly answered.
- **18. Build succeeded.** Knows: yes — *Your composition is here*, the path, *"It is open in After Effects now, and nothing was rendered"*. What to do: look at After Effects — **said**. Proportionate: yes.
- **19. One-off client.** Knows: **no**. What to do: **no**. Not fixed.
- **20. No file dialog.** Knows: partly. What to do: yes. **Not proportionate** — it lists `png, psd, ai, eps, tif, tiff, tga, jpg, jpeg, gif, bmp`, which is the tool talking to itself.

## 2. Every message still in the tool's language

| where | old | new |
|---|---|---|
| service down, first line | `{state.error.cause}` — e.g. **`connect ECONNREFUSED`** | **The background helper has not answered yet. It usually starts on its own.** |
| service down, cannot start | the raw spawn error | **The background helper could not be started on this Mac.** |
| service down, not retryable | the raw error | **The background helper cannot start, and trying again will not help.** |
| service down, footer | **`first check at 14:23:05`** | *(nothing — "first check" is noise)* |
| service down, after a retry | **`attempt 3 at 14:23:05`** | **Looked 3 times, last at 14:23:05.** |
| client picker, empty | `No clients set up yet` and nothing else | **Start by setting one up — their name, their colours, and the folder their videos are in.** |
| video picker, empty | `There are no videos in /Volumes/…` | **No videos in this client's folder** → *"Put a video in it and press Refresh, or set a different folder on their card above."* |
| video picker, no folder | *(indistinguishable from the above)* | **This client has no video folder yet** → *"Open their card above and set the folder their videos are in, then press Refresh."* |

**Two sentences pass through untouched**, because they were already written for a
person and replacing them would throw away the only instruction there is: the Node
help, and `serviceTrouble`'s *"the panel is using an old connection… use Try again
in the line at the top"*. Session 95 learned this when its first `causeWords`
swallowed the picture-tools crash; a test pins it.

**Still in the tool's language, and not fixed:**

- **`NODE_NOT_FOUND_HELP`** reaches his screen and says *"…`which node` in a
  terminal prints the path — then reopen the panel."* It lives in
  **`core/src/node-path.ts`**, which this session must not touch, and it is
  outside `leave-the-panel.test.ts`'s scan. **It names a terminal and a command on
  his screen and nothing catches it.**
- **The queued-video refusal**, composed in `service/src/queue.ts`.
- **The file-extension list** in the no-dialog notice.

## 3. Every dead end

| dead end | now |
|---|---|
| first open, no clients — a dropdown saying there are none | **one next thing: set one up** |
| a client with no videos — a path and an apology | **one next thing, and it differs by reason** |
| a client with no folder — nothing said it was the reason | **named, with one next thing** |
| service down — *Try again*, and if that fails, nothing | still a dead end after the second press; the sentence says whether trying again can help, which is new |
| **a queued video refused** | **still a dead end** — raw guard text, no next thing. Blocked on `service/` |
| **a one-off client** | **still a dead end** — no explanation of what it does |

## 4. The states rebuilt, in order

| group | panel suite after |
|---|---|
| 10 — the service not answering | 2 failed, 336 passed |
| — the two tests asserting retired behaviour, rewritten | **337 passed, 0 failed** |
| 1, 2, 3 — the empty states | **347 passed, 0 failed** |
| — the test M3 showed was missing | **349 passed, 0 failed** |

**The count rose once and I stopped.** Two tests asserted what this session was
asked to retire: one required the service's own cause on screen, the other waited
on `.attempt`, which had moved. Both rewritten (section 10), neither deleted.

**A mutation found a gap, as in session 99.** M3 turned the teaching line back
into the apology and **no test noticed** — I had changed a state with nothing
pinning it. Two browser tests were written for that, and M3 then failed against
them:

```
### M1 — the raw cause back in front of him
   × service state > shows unreachable in his words, with the cause kept where it can be asked for
     → expected 'a service is registered on port 51234…' to be 'The background helper has not answere…'

### M2 — 'attempt N' back, and shown on the first check
   × when the companion service is not answering > says how many times it has looked, in words, and nothing on the first
     → expected 'attempt 1 at 14:23:05' to be null

### M3 — the empty state apologises instead of teaching
   × the news a step carries > tells him what to do first when there are no clients
     → expected 'No clients yet.' to contain 'Start by setting one up'
```

All restored from saved copies — **not with `git checkout`**, which is how session
99 destroyed its own uncommitted work.

### One thing I nearly got wrong

Hiding the looked-twice line with the raw cause made **Try again silent**: he
presses it and the screen does not move. That is its own kind of dead end. It is
back in view, one short line, and only after the first look.

## 5. Each screen's height, both service states

| screen | answering (s99) | answering (now) | unreachable (s99) | unreachable (now) |
|---|---|---|---|---|
| 1. Choose | 566 px | **625 px** | 705 px | **683 px** |
| 2. Make | 676 px | **676 px** | 816 px | **734 px** |
| 3. Build | 516 px | **516 px** | 656 px | **574 px** |

**Every unreachable figure fell by 82 px** — the service-down block went from
211 px to 129 px. **Choose grew 59 px in both**, which is the teaching line, and
it only renders when there are no clients: these figures are Choose's *empty*
first-open state, its worst case. Everything is inside 900 px in both states, and
both are pinned by tests.

## 6. The colours, the buttons and the settled wording

**Nothing free is red, and neither is a failure.** The service-down block uses
`.readiness.bad`, which was already there; nothing new asks for `--accent`.
`button.run.free` and `spendsMoney` are untouched.

**The removed-lines measurement, per file, ignoring indentation:**

| file | removed | reappear verbatim | changed |
|---|---|---|---|
| `App.tsx` | **0** | — | **0** |
| `words.ts` | **0** | — | **0** |
| `Readiness.tsx` | 8 | 6 | **2** |

**The two changed lines are the two this session was asked to rewrite** — *"This
usually clears on its own"*, now folded into the one sentence, and `attempt N at
HH:MM`. Everything else is addition.

**`spend.ts` is untouched**, so money is still to the cent and the money screen
keeps its precision. **The full cost screen was not opened.**
**`leave-the-panel.test.ts` passes.**

## 7. The work is untouched

**`core/` and `service/` — `git status` on both is empty.**

```
diff before.json after.json  →  FIGURES IDENTICAL to the session 95-99 baseline
```

`sora-3`, `sora-4` and `test` through the same `dryRun` and `stepsFor`: every
estimate, stage verdict, card, keyword, image, sfx, zone and the un-rounded spend.

**Assertions read extracted values and use `checkVisibility()`.** The
unreachable-state test reads the visible sentence *by element* and the raw cause
*inside the disclosure* separately, because `text()` returns what a closed
`<details>` is hiding — session 69's lesson, and session 99 met it again.

## 8. The walkthrough

**First open, nothing set up.** The service line, then **Client**: a picker
reading *No clients set up yet*, and under it, in his words: *"Start by setting
one up — their name, their colours, and the folder their videos are in."* Then
**Video**, empty and disabled. One next thing, on the first screen, where there
was none.

**The service is not answering.** At the top: a red dot, **Not working**, and
**Try again** on the same line. Beneath it: *"The background helper has not
answered yet. It usually starts on its own."* Below that, closed, *What it said* —
`connect ECONNREFUSED`, if anyone asks. He presses Try again and a line appears:
*"Looked twice, last at 14:23:05."* **129 px, where it was 211.**

**A run that failed.** On Make, the stage rows show which one *Stopped here*, and
under them one sentence: *"One of the picture ideas asked for two things in a
single picture, so it was left out. The rest were made. Run the pictures again and
a fresh idea is asked for."* Unchanged from session 95, and still right.

**A queue of fifteen while he is on Choose.** He sees **2. Make** carrying `3/15`,
in muted grey, not moving. Nothing else changes. He can keep reading.

**Coming back after closing the panel mid-queue.** The step says `9/15` if it is
still going, or `15 ready` if it finished — because the work is a job in the
service and the panel is only a window on it. **Nothing says "this kept going
while you were away"**, which is section 9.

**The moment a build succeeds.** *Your composition is here*, the path on its own
line, and *"It is open in After Effects now, and nothing was rendered."*

## 9. What I am least sure about

**That I stopped at four states.** Eighteen were asked for, twenty exist, four are
rebuilt. The four are the ones he meets most — his partner's first screen and the
state he has photographed most — but *a video fully run* (state 8) is the one he
meets every single day, and it still reads as though nothing happened.

**`NODE_NOT_FOUND_HELP` names a terminal on his screen** and nothing catches it,
because `leave-the-panel.test.ts` does not scan `core/src/node-path.ts`. That scan
was widened in session 91 to the whole service and stopped at core's doorstep. I
did not widen it, because fixing what it would then catch means editing `core/`.

**"The background helper"** is a new name for a thing the rest of the panel calls
*the companion service*. I chose it because *service* is a word he has no use for,
but the panel now has two names for one thing, and that is worse than either.

**What I would change next:** state 8 — a fully-run video should say *ready to
build* rather than four rows of *already done*; then state 12's raw guard text,
which needs a session that can touch `service/`.

## 10. Gates

`npm run check`, **run alone, after committing: exit 0, `check: PASS`.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | 1575 | 0 | 1575 |
| benchmarks | 173 | 0 | 173 |
| panel | **349** | 2 | 351 |
| pytest (CV sidecar) | 149 | 0 | 149 |

core, service, benchmarks and pytest identical to session 99; panel **337 → 349**.

**Arithmetic by name: 11 added, 2 renamed, 0 deleted.** `+12` reconciles:
`words.test.ts` +9, `three-screens.browser.test.ts` +2, `measure-height` +1 (one
test became two, over both service states), `App.test.tsx` 0 net.

**The two renames, both rewrites of retired behaviour:**

| old | new |
|---|---|
| `shows unreachable with the service's own cause and a way forward` | `shows unreachable in his words, with the cause kept where it can be asked for` |
| `measures every section, top to bottom` | `measures every section, top to bottom — %s`, over both service states |

`npm run golden`: **PASS, 4 of 4, field for field.** 4415 + 4280 + 3709 + 4770 =
**17,174**.

**Panel suite five times: exit 0, 0, 0, 0, 0**, all captured, 349 passed and 2
skipped each, **no failure and no hook timeout** — session 99's hook bounds held.

**The panel was rebuilt.** `panel.js` 265,167 bytes; the extensions folder points
at this working copy.

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
| listening service | pid 61958 | pid 61958, never stopped |
| `origin/main..main` | 0 | 0 after push |

No orphan at the start. His photographs and his client-file edit are as found; no
commit named his paths.

## 11. Every ledger line added

**None.** 294 records, sha256
`77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0` at both ends.

## What is open

- **Eleven states inventoried and not rebuilt** (section 1), of which **state 8 —
  a fully-run video reading as though nothing happened — is the one he meets
  daily**.
- **State 12's raw guard text** and **`NODE_NOT_FOUND_HELP`'s terminal** both need
  a session that can touch `service/` and `core/`.
- **`leave-the-panel.test.ts` does not scan `core/src/node-path.ts`**, and there is
  a message there that would fail it.
- **Two names for one thing** — *the background helper* and *the companion
  service*.
- **The stagger (state 4) is unfixed**; session 95 measured its cause as three
  fetches in three effects.
- Everything carried from session 99 that this session did not touch.
