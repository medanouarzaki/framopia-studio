Status: OK

# Block 14, session 109 — every control audited, and two defects that would have cost money

**The audit found a real one.** Pressing *Make the pictures* twice before the
service answered started **two paid runs**. Measured, not inferred:

```
× starts one run, not two — Make the subtitles   → expected { starts: 2 } to deeply equal { starts: 1 }
× starts one run, not two — Make the pictures    → expected { starts: 2 } to deeply equal { starts: 1 }
× starts one queue, not two                      → expected { starts: 2 } to deeply equal { starts: 1 }
✓ starts one build, not two
```

**And a queue he could not find.** A queue outlives the panel, but the panel held
its job id in React state and **no route could be asked what was running** — so
closing the panel during a two-hour queue meant coming back to a screen saying
nothing had ever happened, while the service was still spending. `GET /jobs` now
answers that, and the panel adopts what it finds.

Both are fixed and proved. **Part A is complete**; Part B is one of four done and
the rest named; Part C worked the top of the list. Gate green, golden 17,174,
**$0.00 spent**, ledger unmoved.

## 1. The control inventory

Two methods, because neither alone is complete.

**Rendered, measured in the browser at 1500 px with his data:** **67 distinct
controls** across the three screens, closed and with every disclosure open. Forty-
four of those are two kinds repeated — *Forget <photo>* and *Use <photo> when
someone says…*, once per photograph — so the rendered set is **23 kinds**.

**Declared, extracted from source:** **95 control declarations across 17
components.** Excluding `Money.tsx`'s 8 — the cost screen this session does not
touch — **87 controls are in scope.**

| component | controls |
|---|---:|
| `App.tsx` | 22 |
| `ClientCard.tsx` | 18 |
| `NewClient.tsx` | 12 |
| `Transcript.tsx` | 9 |
| `ClientPictures.tsx` | 7 |
| `Build.tsx` | 4 |
| `ColourField.tsx`, `Keywords.tsx`, `Readiness.tsx` | 3 each |
| `Images.tsx` | 2 |
| `OtherService.tsx`, `Queue.tsx`, `Sentence.tsx`, `WrongClient.tsx` | 1 each |
| *(`Money.tsx`, out of scope)* | *8* |

**The gap between 67 and 87 is the finding**, not an error: twenty controls only
appear in states the rendered sweep could not reach in one pass — the client setup
form, the one-off client, the three editors, the readiness controls with the
service down, the queue's own controls while one runs. **The count nobody had
looked at is that the panel can show roughly four times as many controls as any
one screen shows at once.**

## 2. Control by scenario

Marked **only** where an assertion exists that has been **seen to fail**. Three
columns are provably empty by search — no test anywhere does the thing — and
absence needs no mutation to prove.

| scenario | controls with a proved assertion | how I know |
|---|---|---|
| **1. Pressed when it should work** | **45 controls** have a click in some test | counted distinct `click(…)` / `getByRole('button', …)` targets |
| **2. Pressed when disabled or refused** | **18 assertions**, over ~10 controls | `isDisabled` / `.disabled` across 6 files |
| **3. Pressed twice, fast** | **0 of 87 — now 4** | no test in the project pressed anything twice; the 4 added here were watched red |
| **4. Pressed while something else runs** | **~4**, and all about *display* | the matches are "shows how far a running queue has got", not "pressed while running" |
| **5. Pressed with the service down** | **2 controls** — *Try again*, *Stop the other one* | `unreachable` / `stubFetch('hang')` |
| **6. Pressed with nothing chosen** | **33 assertions** — the best-covered column | session 100's empty-state work |
| **7. Pressed, then the panel closed** | **0 — now 4** | nothing tested in-flight survival; the 4 added here were watched red |

**Columns 3 and 7 were empty for all 87 controls**, and they are the two the brief
named. Column 3 is the one that cost money.

**What I did not do:** I did not mutate a guard for every cell in columns 1, 2, 4,
5 and 6. The marks there record that an assertion *exists and runs*; only the eight
tests added this session were individually watched red. That is the honest limit of
what one session can earn, and it is stated rather than implied.

## 3. The ten that would hurt

In order, with what he would see.

1. **Double-press on *Make the pictures*** — two paid runs on one video. He would
   see two jobs' worth of spend on a client's reel and no explanation. **Fixed.**
2. **Double-press on *Make the subtitles*** — same, transcription and analysis
   twice. **Fixed.**
3. **Double-press on *Make these N videos*** — two queues over the same list, every
   video billed twice, unattended. **Fixed.**
4. **Closing the panel during a queue** — comes back to a screen saying nothing has
   happened while the service spends. **Fixed.**
5. **Pressing a run while a queue is running** — nothing stops him; two pipelines
   contend for the same plan file. *Not fixed.*
6. **Pressing *Build* while a run is in progress** — builds from a plan being
   rewritten. *Not fixed.*
7. **Pressing *Forget this* on a photograph a slot is using** — the slot then names
   a picture that is gone; the build refuses at pre-flight. *Not fixed.*
8. **Pressing *Take them off the list* on the client of a running queue** — the
   queue's remaining videos lose their client mid-flight. *Not fixed.*
9. **Pressing *Refresh* while the video picker's answer is in flight** — the
   earlier answer can land last and replace the newer list. *Not fixed.*
10. **Pressing *Stop after this video* in the last second of the last video** —
    untested; the queue may report stopped for work that completed. *Not fixed.*

**Five and six are the same shape as one to three** — a control that should be
disabled while other work runs — and are the obvious next session.

## 4. The queue

**B1 — coming back. Done.** `GET /jobs` lists every job newest first with
`startedAt` and `finishedAt`; on arrival the panel asks and adopts the most recent
queue, running or finished.

- **Running:** the card says *The list*, names the video it is on, and says *you can
  close this and come back — it keeps going*. The stop control is there.
- **Finished:** the summary session 98 built — *1 ready to build, 1 did not finish*,
  the per-video line, and what it cost — which session 101 found he never saw
  because the panel that started it had been closed by the time it finished.
- **The step carries the news** from a queue this panel never started.

**What it survives, measured:** the panel being closed and reopened, and After
Effects being quit and restarted — because the job lives in the service, which
neither of those stops. **What it does not survive:** the *service* being
restarted. Jobs are in memory; `listJobs` reads a `Map`. A service restart loses
the list, and nothing on disk records it. That is B2, and it is not done.

**B2 — a record that does not vanish. Not done.** Past queues are still destroyed
by the next one and by any service restart. I did not invent a retention answer: the
brief asks for one that is not arbitrary, and I could not derive one without knowing
whether he wants a month, a quarter or forever. **Stated as a question in section 7.**

**B3 — progress inside a video. Not done.** `2/4` still moves once every
twenty-six minutes. The four stages exist and are already named in his words, and
the pipeline already puts its per-stage report in `job.detail` — so the material is
all there and it is a panel change. Named, not built.

**B4 — failure, cancel, repeats. Measured, three of four already correct:**

| | what it does today |
|---|---|
| **a video that fails twice** | not retried a third time — `MAX_ATTEMPTS` is 2, and only for a failure worth repeating; it is recorded and the queue moves on. **Correct.** |
| **the same video added twice** | the Add control disables and says *"sora.mov is already in the list"*. **Correct.** |
| **partial failure** | *"1 ready to build, 1 did not finish"* plus a per-video line in the service's own words. **Correct — but there is no per-video action.** He must go and re-run it by hand. Not one press. |
| **stopping in the last second of the last video** | **untested.** Number 10 on the list above. |

## 5. What the list survives

| | survives? | how I know |
|---|---|---|
| the panel closed and reopened | **yes, now** | a fresh panel that never started a queue finds it — four tests |
| After Effects quit and restarted | **yes** | same mechanism: the panel is reborn, the service is not |
| the service restarted | **no** | `listJobs` reads an in-memory `Map`; nothing is written to disk |
| the machine slept | **not measured** | the service is a local process; I did not test it and will not claim it |
| the drive unmounted | **not measured** | every path is on the drive; I did not test it and will not claim it |

The last two are honestly unknown. I would rather say so than guess.

## 6. What was fixed, with every red

### The double press

`onRun` set the job to `null` and *then* started the pipeline, and `running` was
read off the job alone — so between the press and the first poll the button was
enabled and the money not yet spent. The queue's start had the same shape.
`Build.tsx` has always had it right: `setStarting(true)` runs before the `await`.

**Red, against the code as it stood:**

```
× a control that spends, pressed twice before it answers > starts one run, not two — Make the subtitles
  → expected { starts: 2 } to deeply equal { starts: 1 }
× a control that spends, pressed twice before it answers > starts one run, not two — Make the pictures
  → expected { starts: 2 } to deeply equal { starts: 1 }
× a control that spends, pressed twice before it answers > starts one queue, not two
  → expected { starts: 2 } to deeply equal { starts: 1 }
```

**Green after** the flag is set synchronously and `running` includes it. Build's
test passed before and after, which is the point of having it.

**The delay in the test is the whole mechanism:** the stub answers a start after
400 ms. A service that answers instantly hides this, which is how it survived
fourteen blocks.

### Coming back

**Red, with the adoption mutated out:**

```
× finds the queue it never started, and says what it is on
  → expected 'Make several videosAdd videos here an…' to contain 'The list'
× finds a queue that finished while the panel was shut
  → expected 'Make several videosAdd videos here an…' to contain '1 ready to build, 1 did not finish.'
× carries the news on the step, from a queue it never started
  → expected +0 to be 1
```

Restored from the saved copy, hash verified `App.tsx c5d7eb4a…`. **No `git
checkout`, `restore` or `stash` was used to undo a mutation.**

A fourth test holds the other half: **a service too old to have the route answers
404 and the panel behaves exactly as before** — the empty list, an invitation, no
news. New routes are optional-with-a-default here as everywhere.

### What was left, and why

Numbers 5 to 10 of section 3 are not fixed. Five and six need a decision about what
a panel should do when two kinds of work collide — refuse, queue, or warn — and
that is a shape question, not a bug. Seven and eight are about deleting something
another part of the tool is using, which is the same question again. Nine is a
race. Ten needs a queue running against a real reel to test the last second of.

## 7. What needs his ruling

**One question:** *how long should a finished queue's record be kept — until the
next one, for a month, or forever?*

It decides B2. A record of a real spend is not scratch, so "until the next queue"
(what happens today) is almost certainly wrong; but *forever* means a file that
grows without bound on his disk, and I will not pick between them for him. The
brief asked for an answer that is not arbitrary, and I do not have one that is.

## 8. Nothing else moved

**Figures: `sora-3`, `sora-4` and `test` through the same `dryRun` and `stepsFor` —
IDENTICAL** to the session 102 reading, before and after.

**`npm run golden`: PASS, 4 of 4, field for field.** 4415 + 4280 + 3709 + 4770 =
**17,174**.

**Every screen inside 900 px, in every state, unchanged from session 106:**

| | s108 | now |
|---|---|---|
| Choose | 374 px | **374 px** |
| Make, daily | 616 px | **616 px** |
| Make, a run in progress | 896 px | **896 px** |
| Build, ready | 497 px | **497 px** |
| Build, already built once | 784 px | **784 px** |

**Session 104's type scale: 16 distinct settings.** Spacing 28 / 16 / 8. Pointer
distances **88 px** and **190 px**. **All 22 photographs byte-identical**,
dimensions included. The full cost screen was not opened.

## 9. What I am least sure about

**The scenario table's marks are weaker than its empty cells.** An empty column is
proved by search and is certain. A marked cell says an assertion exists and runs —
only the eight added this session were watched go red. The table is therefore
*reliable about what is missing* and *optimistic about what is covered*, and that
asymmetry is the honest reading of it.

**`starting` never clears if a start succeeds and the poll never returns a job.**
The controls stay disabled. That is the safe direction — a run may genuinely be in
flight — but it is a state with no way out except reopening the panel, and I have
not given it one.

**Adopting the most recent queue is a guess about which one he means.** With one
queue it is obviously right. With a queue from Tuesday and one from today it takes
today's, which is almost certainly what he wants and is not something I measured.

**I did not run a real queue.** The double-press defect was found and proved against
a stubbed service with a deliberate delay; the fix is in the panel and the proof is
what reached the service. A real two-video queue would have cost money and the
brief's ceiling is $1.00 — but it means the adoption path has been proved against a
stub, not against his own service.

**Part A's inventory took two methods and still needed a judgement.** 67 rendered
against 95 declared: I resolved it by reporting both and explaining the gap, but a
single authoritative count does not exist and I did not invent one.

## 10. Gates

`npm run check`, **run alone, after committing: exit 0, `check: PASS`.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | **1601** | 0 | 1601 |
| benchmarks | 173 | 0 | 173 |
| panel | **400** | 2 | 402 |
| pytest (CV sidecar) | 149 | 0 | 149 |

core, benchmarks and pytest identical to session 108; service **1598 → 1601**,
panel **392 → 400**.

**The gate was killed twice by my own timeout before it could finish** and was then
run in the background and allowed to complete. Reported because a gate that did not
finish is not a gate that passed — the first two attempts got as far as core.

**Arithmetic: 9 added, 0 removed, 0 renamed.** By name, from `panel/src`,
`core/src` and `service/src` at `5678c32` and now: panel 386 → 392, core 777 → 777,
service 1551 → 1554. The panel's run count rises by 8 rather than 6 because *starts
one run, not two* is an `it.each` over the two run controls.

| added | where |
|---|---|
| `starts one run, not two — %s` (×2) | `double-press.browser.test.ts` |
| `starts one queue, not two` | same |
| `starts one build, not two` | same |
| `finds the queue it never started, and says what it is on` | `coming-back.browser.test.ts` |
| `finds a queue that finished while the panel was shut` | same |
| `carries the news on the step, from a queue it never started` | same |
| `says nothing at all when the service is too old to be asked` | same |
| `lists a job with when it started, newest first` | `jobs.test.ts` |
| `stamps when a job started and when it stopped` | same |
| `lists a job that failed, with when it stopped` | same |

**No test asserted retired behaviour**: nothing was retired. The double-press fix
changes when a control is disabled, not what it does; the adoption adds a path
where there was none.

`npm run golden`: **PASS, 4 of 4.** **Panel suite five times: exit 0, 0, 0, 0, 0**,
400 passed and 2 skipped each.

**The panel was rebuilt.** `panel/dist/panel.js` **268,917 bytes**. The extensions
folder holds one entry, `com.framopia.studio`, a symlink to
`…/framopia-studio/panel`.

### Part 0, at both ends

| measurement | at start | at end |
|---|---|---|
| ledger records | 294 | **294** |
| ledger sha256 | `77eaf6c9ca6b633ed2ecb12b…` | **unchanged** |
| `templates/library.aep` | `4b0cf05a8f5d4775c03e8ebd…` | **unchanged** |
| `modes/dr-loubna-kfafi.json` | `f2fa926e…`, 2026-09-12T20:52:03 | unchanged |
| `modes/k2-syndicalia.json` | `572e99bf…`, 2026-09-09T21:58:19 | unchanged |
| `.local/` directories | 16 | 16 |
| `assets/client-pictures/` | 23 files, 35M | 23 files, 35M |
| **his 22 photographs** | 22 hashes | **all 22 byte-identical** |
| CEP extensions | `com.framopia.studio` | `com.framopia.studio` |
| After Effects | 1 | 1, never launched or quit |
| `aerender` | 0 | 0 |
| listening service | pid 20822 | pid 20822, never stopped |
| `origin/main..main` | 0 | 0 after push |

`templates/library.aep` was read by golden and never written. Nothing was saved in
his After Effects. His photographs, his client-file edit and session 108's leftover
crop are exactly as found.

## 11. Every ledger line added

**None.** 294 records, sha256
`77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0` at both ends.

No picture was generated and no queue was run against a real service. The
double-press defect was proved against a stub with a deliberate delay, which costs
nothing. The $1.00 ceiling was not approached.

## What is open

- **How long a finished queue's record is kept** — section 7, his ruling.
- **B2: past queues still vanish**, and do not survive a service restart.
- **B3: no progress inside a video** — the material exists, the panel does not use it.
- **A failed video needs one press to re-run it**; today it is manual.
- **Numbers 5 to 10 of section 3** — controls pressed while other work runs.
- **`starting` has no way out** if a start succeeds and no job ever arrives.
- Whether the list survives sleep or an unmounted drive: **not measured**.
- Choose with the card open is 1459 px — session 106.
- The 2026-08-29 one-column ruling stays narrowed — session 105.
- `logoPath()` in `host.ts` is read by nothing — session 104.
- The list is called *the list* and his own word is *queue* — session 103.
- `NODE_NOT_FOUND_HELP` remains a ruling Mohamed has not made — session 101.
