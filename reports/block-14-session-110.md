Status: OK

# Block 14, session 110 — the queue keeps its record and survives a restart

Four things session 109 named and left unbuilt. **Three are built and proved; one
is half-built and I say which half.**

The record is written **after every video** into `.local/queues/`, kept forever on
Mohamed's ruling, and **a separate process finds what a dead one left** — 891 bytes
for a four-video queue, and $2.30 of already-paid work still known after the service
that spent it is gone. A running video now names which of its four steps it is on.
A failed one is one press from being tried again, bounded by the two attempts the
queue already respects.

**What I did not do: prove a resume at $0.00.** The record carries what was paid
and what remains, but there is no control that acts on it. Section 4 says so
plainly, and section 8 says where I stopped on part 5.

Gate green and **finished**, golden 17,174, **$0.00 spent**, ledger unmoved.

## 1. Where the record lives, and what it costs

`.local/queues/`, one file per queue, beside `.local/plans/` and
`.local/costs.jsonl` — which is where this project already keeps a person's own
material.

**Deliberately not under `.local/cache/`.** Block 13 session 92 measured that the
caches had evicted 6% more of the project's own cost evidence between two sessions.
A record of spending in an evicting store is a record that quietly stops being true.
A test asserts the path is not in the cache, and mutation M3 proves that assertion
fires.

**Measured, by writing one as the runner writes it:**

```
WROTE 1 file(s), 891 bytes for a 4-video queue
PER-VIDEO 223 bytes
```

| | |
|---|---|
| a four-video queue | **891 bytes** |
| per video | **223 bytes** |
| **a thousand videos** | **≈ 223 KB** |
| a thousand videos, at ten per queue | ≈ 100 files |

Two hundred and twenty-three kilobytes is a fifth of one of his photographs. Kept
forever is not a storage question.

**It is written after every video, not at the end** — a queue four videos in that
loses all four has lost real money — and written to a temporary name and renamed,
so a restart mid-write leaves the previous record intact rather than half of a new
one. A test asserts no `.writing` file is ever left behind.

**It is in the backup set**, beside the ledger and for the same reason: *"CANNOT be
regenerated. It records money that was actually spent… a fresh one would be a
different claim about the past."*

## 2. How many are in view

**Six, and the number is measured rather than chosen.**

```
== fifty queues: 6 in view at 18px a row, "44 older", Make ends at 709px
```

Make's daily state is 616 px of the 900 px panel session 106 fits every screen
inside. Six rows with their heading and their fold row cost **93 px**, putting Make
at **709 px with fifty queues recorded** — 191 px still spare. The rest fold behind
the one disclosure this panel uses, labelled *44 older*.

**Why not more, since 191 px is spare:** because the spare room is not really
spare. **Make's worst state — a queue running with its four steps showing — is
896 px**, four short of the fold. Ninety-three pixels of record there would put
Make at 989 px and break the rule every session since 106 has held.

So **the record is not drawn at all while a queue is running.** The running card is
the subject then; the record is what he consults when nothing is running. Measured
with fifty recorded and a queue running:

```
== running, fifty recorded: record 0, Make ends at 484px
```

Six is therefore a decision about margin in the state where the record appears, not
about fit. A row is 18 px; a different panel size moves the number.

**When each ran, without arithmetic on a timestamp:** *today, 10:00*, *yesterday,
14:30*, *Tuesday, 09:15*, then the date. A test asserts no label contains an ISO
fragment.

## 3. What the list survives

| | survives? | how I know |
|---|---|---|
| the panel closed and reopened | **yes** | session 109's four tests, still passing |
| After Effects quit and restarted | **yes** | the job is the service's; neither touches it |
| **the service restarted** | **yes, now** | **a separate process read what the dead one left** |
| the drive unmounted | **partly — measured** | below |
| the machine slept | **not tested** | below |

**The service restart, measured.** A record was written as the runner writes it,
the process ended, and a *different* process read the directory:

```
A NEW PROCESS FINDS 1 record(s), 1 still running
  already paid for: one $1.20, two $1.10
  still to do:      three, four
  spent so far:     $2.30
```

**Nothing resumes by itself.** Spending money is something he presses; a service
that restarted and carried on buying would be the worst possible reading of "it
survived".

**The drive unmounted, measured** by taking the root away:

```
GONE: listQueueRecords -> []
GONE: unfinishedQueues -> []
GONE: writing to a path that is not there -> ENOENT
BACK: 1 record(s) once the drive returns
```

Reading is safe — an empty list, not a crash. **Writing throws `ENOENT`, and the
runner swallows it**: a queue that is spending money must not stop because a record
could not be saved. The honest consequence is that **a queue keeps running and
spending while the drive is away and stops recording**, and its record then reflects
the last video written before the drive went. The record is intact when the drive
returns. In practice the footage is on that drive too, so the videos would fail
anyway — but the record's behaviour is what is stated here, not what is hoped.

**Sleep: not tested, and I will not claim it.** I cannot suspend this machine from
inside a session. A file on disk is plainly unaffected; whether the service process
survives macOS suspend is the half I did not test, so I am not reporting it as
survived.

## 4. Resume at $0.00 — **not proved**

**This is the half of part 2 I did not do.** The record now carries exactly what a
resume needs — which videos are `done` and what each cost, which are `not-reached`
— and `unfinishedQueues` finds the interrupted one. A test asserts the record keeps
each video's spend *so a resume knows what is already bought*.

**But there is no resume control, and I ran no resume.** Claiming $0.00 would be
claiming success for something not run. What is true: the two paid videos are known
to be paid and a resume built on this record would run only the remaining two, and
those would take the cached path sessions 86, 87 and 92 made free. That is an
argument, not a measurement, and it is left as one.

## 5. A twenty-six-minute video, minute by minute

Block 13 session 94 measured the wait: 25.8 minutes from the transcript landing to
the masks being made, with `2/4` moving once in all of it.

| | what he sees |
|---|---|
| **0:00** | *Working on sora-2. You can close this and come back — it keeps going.* Four steps listed. **Writing down the words — doing this now**; the other three *waiting* |
| **0:30** | *Writing down the words — done*. **Choosing what to emphasise and what to picture — doing this now** |
| **2:00** | that step still *doing this now* |
| **2:30** | *Choosing… — done*. **Drawing the pictures — doing this now** |
| **6:00** | still *doing this now* — eight pictures, one model call each |
| **6:30** | *Drawing the pictures — done*. **Finding you in the picture — doing this now** |
| **7:00 – 25:30** | that step, *doing this now*, for nineteen minutes — every frame of the video through the segmenter |
| **25:45** | all four *done*, and the count moves to `3/4` |

The nineteen minutes are still nineteen minutes. What changed is that they are
nineteen minutes of *Finding you in the picture — doing this now* rather than of a
screen that looks stopped.

**No percentage, no bar, nothing that animates** — session 98's rule, and three
tests hold it: no `%` anywhere in the pane, no `progress` or `.bar` element, and
zero elements with an animation or a transition.

**The four names are the pipeline's own**, through `stageName`, which is the single
place ids become his words — so this cannot drift from what one run shows him.

## 6. One press, on the video that failed

A control on the failed video's line in the summary. It starts **a queue of one**,
so everything already paid for is read from the cache and costs nothing — the same
path a re-run has taken since sessions 86 and 92. A test asserts the body sent
contains the failed reel and **not** the one that succeeded.

**It respects the two-attempt rule.** The queue runs a video twice and then records
it and moves on — session 94's rule, measured as holding by session 109. The
control is offered only on a video whose `outcome` is `failed` **and** whose
`attempts` are fewer than two; a video that has used both is offered nothing. A
one-press retry that ignored this would turn a bounded worst case into an unbounded
bill, which is the thing the rule exists to prevent.

It is also guarded against being pressed twice, which session 109's empty column
would otherwise have reopened on a brand-new control.

## 7. Every red, verbatim

**M1 — the retry ignores the two-attempt rule.**

```
× a failed video, one press from being tried again > offers nothing on a video that has already been tried twice
  → expected 1 to be +0
```

**M2 — no step says it is the one running.**

```
× what a queued video says it is doing > names the step it is on — transcription
  → expected [] to have a length of 1 but got +0
```

**M3 — the record moves into the cache that evicts.**

```
× a queue’s record on disk > lands in .local/queues, beside his plans and his ledger
  → expected false to be true
```

Restored from the saved copies, hashes verified: `Queue.tsx 8272ea12…`, `App.tsx
de01ca19…`, `queue-record.ts 87e9067e…`. **No `git checkout`, `restore` or `stash`
was used to undo a mutation.**

## 8. Where I stopped

**Part 5 — the two empty columns for all 87 controls — is not done**, beyond the
three spending controls session 109 fixed and the one new control this session
added.

What exists now, by the brief's own priority of *"every control that spends or
writes first"*:

| control | pressed twice | pressed then closed |
|---|---|---|
| Make the subtitles | ✓ session 109 | — |
| Make the pictures | ✓ session 109 | — |
| Make these N videos | ✓ session 109 | — |
| Build the composition | ✓ session 109 | — |
| **Try again (a failed video)** | **✓ this session** | — |
| the other ~82 | — | — |

The **pressed-then-closed** column is empty for every control. The queue's own
survival across a close is proved four ways, but that is the *work* surviving, not
a control being pressed and the panel shut mid-request.

I stopped there because the queue was the session's title and the four named items
were the deliverable. Doing 82 controls × 2 scenarios properly — each with a
watched red — is a session of its own, and doing it badly would produce exactly the
table session 109 warned about: marks nobody has earned.

## 9. Nothing else moved

**Figures: `sora-3`, `sora-4` and `test` through the same `dryRun` and `stepsFor` —
IDENTICAL** to the session 102 reading, before and after.

**`npm run golden`: PASS, 4 of 4, field for field.** 4415 + 4280 + 3709 + 4770 =
**17,174**.

**Every screen inside 900 px, unchanged:**

| | s109 | now |
|---|---|---|
| Choose | 374 px | **374 px** |
| Make, daily | 616 px | **616 px** |
| Make, a run in progress | 896 px | **896 px** |
| **Make, daily, fifty queues recorded** | — | **709 px** |
| **Make, running, fifty recorded** | — | **484 px** |
| Build, ready | 497 px | **497 px** |

**Session 104's type scale: 16 distinct settings.** Spacing 28 / 16 / 8. Pointer
distances **88 px** and **190 px**. **All 22 photographs byte-identical.** The full
cost screen was not opened.

## 10. What I am least sure about

**The record stops being written when the drive is away, silently.** I made the
write failure non-fatal so a queue spending money cannot be stopped by a disk
problem — which I still think is right — but the consequence is a record that can
be quietly incomplete. Nothing tells him that happened.

**Hiding the record while a queue runs is a real trade.** It keeps Make inside 900
px, which is a rule with nine sessions behind it, but it means the one moment he
most wants to compare *this* queue with the last one is the moment the last one is
not on screen. The alternative was breaking the height rule, and I would rather he
overturn this than discover a screen that scrolls.

**Six is measured against today's Make.** If a future session adds anything to that
screen, six stops being the right number and nothing will notice — the test asserts
six, not that six fits.

**I did not run a real queue.** Every claim about survival is measured on the record
module in a scratch root, with a real second process, which is the part that was
broken. But no reel went through the actual queue this session, so the stage
reporting has been proved against a stub rather than against 25.8 minutes of real
segmentation.

**The service's pid changed under me**, 20822 → 91308, started 22:55. I never
stopped one: rebuilding the service made the running one stale, and the panel
repairs a stale service by restarting it — which is the very behaviour part 2 is
about. I report it rather than present an unchanged pid I did not have.

## 11. Gates

`npm run check`, **run alone, after committing, and allowed to finish: exit 0,
`check: PASS`.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | **1609** | 0 | 1609 |
| benchmarks | 173 | 0 | 173 |
| panel | **413** | 2 | 415 |
| pytest (CV sidecar) | 149 | 0 | 149 |

core, benchmarks and pytest identical to session 109; service **1601 → 1609**,
panel **400 → 413**.

**The gate's first run failed**, exit 1, on two `no-useless-escape` errors in the
new browser test. Fixed, committed separately, and re-run alone from a clean
commit. Reported because both suites were green while the gate was not — the third
session running that lint caught what the tests did not.

**Arithmetic: 17 added, 0 removed, 0 renamed.** By name, from `panel/src`,
`core/src` and `service/src` at `bc1db99` and now: panel 392 → 401, core 777 → 777,
service 1554 → 1562. The panel's run count rises by 13 rather than 9 because *names
the step it is on* is an `it.each` over the four stages.

| added | where |
|---|---|
| `names the step it is on — %s` (×4) | `queue-record.browser.test.ts` |
| `shows no percentage and no bar` | same |
| `says nothing about steps when the service does not report one` | same |
| `offers one press on the video that failed, and starts a queue of one` | same |
| `starts one retry, not two` | same |
| `offers nothing on a video that has already been tried twice` | same |
| `offers nothing on a video that finished` | same |
| `shows six, folds the rest, and stays inside the panel` | same |
| `says when each ran in words, not in ISO` | same |
| `shows nothing, so Make stays inside the panel` | same |
| `lands in .local/queues, beside his plans and his ledger` | `queue-record.test.ts` |
| `reads back what was written, newest first` | same |
| `keeps one file per queue however often it is written` | same |
| `leaves no partial file behind` | same |
| `skips a record it cannot read and returns the rest` | same |
| `says nothing at all before any queue has run` | same |
| `finds the queue that was still running when the service stopped` | same |
| `keeps what each video cost, so a resume knows what is already bought` | same |

**One test asserted retired behaviour and was rewritten, never deleted:**
`says how each group could be recovered, or that it cannot be` listed the seven
things that cannot be regenerated; **`queues` joined them**, for the same reason the
ledger is there.

`npm run golden`: **PASS, 4 of 4.** **Panel suite five times: exit 0, 0, 0, 0, 0**,
413 passed and 2 skipped each.

**The panel was rebuilt.** `panel/dist/panel.js` **271,935 bytes**. The extensions
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
| `.local/` directories | 16 | **16** |
| `assets/client-pictures/` | 23 files, 35M | 23 files, 35M |
| **his 22 photographs** | 22 hashes | **all 22 byte-identical** |
| CEP extensions | `com.framopia.studio` | `com.framopia.studio` |
| After Effects | 1 | 1, never launched or quit |
| `aerender` | 0 | 0 |
| listening service | pid 20822 | **pid 91308** — section 10 |
| `origin/main..main` | 0 | 0 after push |

**`.local/queues/` does not exist in the real project**: no queue has run here, so
nothing was created. The directory count is unchanged at 16.

## 12. Every ledger line added

**None.** 294 records, sha256
`77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0` at both ends.

No queue was run against a real service and no picture was generated. Everything
was proved against scratch roots and a stubbed panel, which costs nothing. The
$1.00 ceiling was not approached.

## What is open

- **A resume control, and the $0.00 proof** — the record carries what it needs;
  nothing acts on it. Section 4.
- **The record stops being written silently** if the drive goes away.
- **Nothing is tested for sleep.**
- **The record is hidden while a queue runs**, which is a trade, not a solution.
- **Part 5: ~82 controls × 2 scenarios** remain unmeasured; the *pressed then
  closed* column is empty for every control.
- **Six in view is asserted, not derived at runtime** — a future addition to Make
  would make it wrong silently.
- Choose with the card open is 1459 px — session 106.
- The 2026-08-29 one-column ruling stays narrowed — session 105.
- `logoPath()` in `host.ts` is read by nothing — session 104.
- `NODE_NOT_FOUND_HELP` remains a ruling Mohamed has not made — session 101.
