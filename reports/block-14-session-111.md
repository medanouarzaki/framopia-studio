Status: OK

# Block 14, session 111 — resume proved for real, and the audit's first column closed

**The resume is proved by running one.** A queue of `test-1` and `vitasilk` was
started against the live service and stopped after the first video; the record
named exactly what was left; carrying on ran that one alone:

```
FIRST QUEUE done: test-1:done vitasilk:stopped $0.0000
RECORD SAYS canResume=true -> [{"reel":"vitasilk","modeId":"k2-syndicalia"}]
RESUMED with [{"reel":"vitasilk","mode":"k2-syndicalia"}]
RESUME done: vitasilk:done $0.0000
LEDGER BEFORE 294 … LEDGER AFTER RESUME 294
```

**The drive going away is no longer silent** — proved by making the write genuinely
fail, not by stubbing a rejection.

**The audit's double-press column is closed for 51 of the 79 controls in scope**,
by enumeration rather than by hand, and **the pressed-then-closed column is closed
for the same 51** — it was empty for all 87 an hour ago. Where I stopped is section 6.

Gate green and finished, golden 17,174, **$0.00 spent, ledger 294 at both ends**.

## 1. The resume control

**Where it is:** on an unfinished queue's row in the record on Make — where session
110 put the record and where he finds it.

**What it says:** *Carry on*, labelled *Carry on today, 10:00* for a screen reader,
and *Starting…* while it goes.

**What it runs:** the videos whose outcome is `stopped` or `not-reached`. Not the
ones that are `done` — those are paid for — and **not a `failed` one**, which has
its own control bounded by the two attempts the queue respects; sweeping it in here
would route around that bound.

**How it knows where it stopped:** the record. Every item carries the outcome
written after the video that produced it, so *stopped* is the one the queue was
holding when he stopped it — which never ran — and *not-reached* is everything after.

### The ledger, before and after a real resume

| | ledger records |
|---|---|
| before the first queue | **294** |
| after the first queue (`test-1` done, `vitasilk` stopped) | **294** |
| after carrying on (`vitasilk` done) | **294** |

**$0.0000 at every step, measured, not argued.** Both videos were fully cached —
`npm run dry-run` shape: every stage `skip` for both — so the resume took the free
path sessions 86, 87 and 92 built.

**The four corpus plans are byte-identical afterwards.** `test 1`, `test 2`,
`test 3` and `vitasilk`'s Edit Plans were saved before the runs and compared after:
all four `IDENTICAL`. A run where every stage skips writes nothing.

**One earlier run did bill nothing and fail, and it is reported rather than
hidden:** a queue of `test-2` and `test-3` ran `test-2` to done at $0.0000 and
`test-3` failed with

> `analysis keywords failed: {"error":{"code":429,"message":"Your prepayment credits are depleted…`

That is the Google account, not the tool, and it cost nothing — `test-3` is the one
corpus reel whose analysis is not cached ($2.35 by dry run). It is why I checked
every reel's dry-run estimate before the resume proof and used only the two that
are genuinely free.

## 2. When the videos changed underneath it

| what changed | what happens, measured |
|---|---|
| **a video deleted** | the queue runs it, it **fails** with *"there is no video called "a video this tool has never seen" any more. Pick it again from the list."*, `retryable: false` so it is **not retried**, **$0.00**, the queue moves on and the record keeps it as failed |
| **a video replaced** | not measured — see section 9 |
| **a client removed** | not measured — see section 9 |

The first is measured because it happened: the scratch fixtures from earlier
sessions point at temp-directory videos long since deleted, and the first real
queue I ran hit exactly that. The other two I did not construct, and I will not
report a behaviour I did not see.

## 3. The drive that goes away

**It keeps working. It stops being silent.**

The queue still does not stop when the record cannot be written — a disk problem
must not kill work being paid for, which is session 110's trade and it stands. What
changed is that the failure travels with the progress the panel already polls, and
**carries what has been spent since the last successful write**:

> This queue is still running, but it cannot write to the disk, so what it does is
> not being recorded. **$2.50 has been spent since the record was last saved** —
> write that down.

He sees it on the next poll — within a second or two of the first failed write —
not afterwards as a gap in the record. It is `warn`, never the accent: nothing here
is a thing that spends.

**The failure is real, not simulated.** `.local/queues` is replaced by a *file*, so
`mkdir` cannot create the directory and the write throws exactly as an unmounted
volume makes it throw. Nothing is stubbed to reject.

**Red, with the guard removed:**

```
× a queue’s record on disk > lands in .local/queues, beside his plans and his ledger
  → expected false to be true
```

and the integration, asserting both halves — that both videos still ran and were
paid for, and that the last report carries the money:

```
expect(done.items.map((i) => i.outcome)).toEqual(['done', 'done'])
expect(last?.spentUsd).toBeCloseTo(2.5, 6)
expect(String(last?.why)).toMatch(/ENOTDIR|EEXIST|ENOENT|not a directory/i)
```

## 4. The control table

**My order, stated before starting: controls that spend, then controls that write,
then the rest.** The enumeration finds that order empirically rather than taking my
word for it — it presses each control and watches **what reached the service**, so a
control that spends or writes is one that POSTs, and one that does not cannot
double-spend.

| screen / state | controls found | reach the service | pressed twice | pressed then closed |
|---|---:|---:|:---:|:---:|
| Choose | 5 | 0 | ✓ | ✓ |
| Make | 9 | 2 | ✓ | ✓ |
| Build | 8 | 1 | ✓ | ✓ |
| Choose, everything open | 29 | **22** | ✓ | ✓ |
| **total enumerated** | **51** | **25** | **✓** | **✓** |

The twenty-two on the opened Choose screen are the *Forget this* buttons, one per
photograph — the largest single block of writing controls in the panel, and every
one proved.

**What is counted is what reached the service, not what the DOM did.** A guard that
disables a button after the first click but still fires twice would pass a DOM
assertion and fail this one. The stub answers a POST after **350 ms** on purpose: a
guard that only works against an instant answer is not a guard, which is how
session 109 found the original defect.

**Two different requests are not a double-press.** A control that posts a change and
then re-reads is one action; only the *same* request arriving twice is counted.

### Plus the controls proved by hand

| control | pressed twice | how |
|---|---|---|
| Make the subtitles | ✓ | session 109, red at `{ starts: 2 }` |
| Make the pictures | ✓ | session 109 |
| Make these N videos | ✓ | session 109 |
| Build the composition | ✓ | session 109 |
| Try again (a failed video) | ✓ | session 110 |
| **Carry on (resume)** | **✓** | **this session — section 5** |

## 5. Every fix, and every control already safe

**Fixed this session: none needed fixing.** Every one of the 51 enumerated controls
already sent one request for one action, and none threw when the panel went
mid-request.

**How I know that is a measurement and not an assumption:** the enumeration counts
service traffic, with a deliberately slow answer, and I proved the assertion can
fail. On the one new spending control I added — *Carry on* — I removed its guards
one at a time:

**M2 — the handler's guard removed: green.** The `disabled` attribute caught it
alone, so the test passed and told me nothing.

**M2b — the `disabled` removed as well:**

```
× carrying on a queue from the record > starts one resume, not two
  → expected 2 to be 1
```

That is the point of the exercise and it is worth stating plainly: **a passing test
is not the same as a working guard.** *Carry on* has two independent guards and
needs both removed before it double-fires; the comment in `PastQueues.tsx` records
why.

**M1 — the resume stops respecting what was paid for:**

```
× carrying on a queue that did not finish > runs what never ran, and nothing that did
  → expected [ { reel: 'paid', modeId: 'c' }, …(3) ] to deeply equal [ { reel: 'held', modeId: 'c' }, …(1) ]
× carrying on a queue that did not finish > leaves out the video that was paid for
  → expected [ 'paid', 'broke', 'held', 'never' ] to not include 'paid'
```

Restored from the saved copies, hashes verified: `queue-record.ts a2180ddac…`,
`App.tsx 0940c765f…`. **No `git checkout`, `restore` or `stash` was used to undo a
mutation.**

## 6. Where I stopped

**51 of 79 controls in scope** (87 declared, less the 8 on the untouched cost
screen). **Both columns are closed for those 51.**

**The 28 not reached** are in states this harness does not produce in one pass:

| not enumerated | why |
|---|---|
| the client setup form (12) | reached by choosing *Set up a new client…*, which replaces the screen |
| the one-off client | same |
| the three editors' internals (~12) | `Words`, `Emphasis` and `Pictures` open over the screen |
| the readiness controls (3) | need the service unreachable |
| the queue's running controls | need a queue in flight |

I stopped there rather than write a second enumeration for each, because the first
one had already taught me something worth acting on: **it made the suite
unreliable.** Opening a fresh browser page per control put a hundred Chromiums on a
machine already running nine, and three unrelated tests timed out at five seconds.
A test that makes other tests fail is worse than no test. It now re-navigates one
page per control — Playwright re-applies init scripts on navigation — and the suite
is green five times in a row. Extending the same pattern to five more states is the
next session's work, not a thing to bolt on at the end of this one.

## 7. All three screens

| | s110 | now |
|---|---|---|
| Choose | 374 px | **374 px** |
| Make, daily | 616 px | **616 px** |
| **Make, a run in progress** | **896 px** | **896 px** |
| Build, ready | 497 px | **497 px** |

**The 896 px margin is untouched.** Nothing this session added draws while a queue
is running: the *Carry on* control lives in the record, and the record is not drawn
while a queue runs — session 110's measured reason. The not-recorded sentence does
draw during a run, but only when the disk has failed, which is not a state the
height rule was measured against and is one where a person needs the sentence more
than the margin. **That is a judgement and it is named in section 9.**

## 8. Nothing else moved

**Figures: `sora-3`, `sora-4` and `test` through the same `dryRun` and `stepsFor` —
IDENTICAL** to the session 102 reading, before and after **two real queue runs**.

**`npm run golden`: PASS, 4 of 4, field for field**, after those runs. 4415 + 4280 +
3709 + 4770 = **17,174**.

**Session 104's type scale: 16 distinct settings.** Spacing 28 / 16 / 8. Pointer
distances **88 px** and **190 px**. **All 22 photographs byte-identical.** The full
cost screen was not opened.

## 9. What I am least sure about

**The not-recorded sentence can push Make past 900 px.** Make's worst state is
896 px and this adds a two-line sentence on top of it. I chose telling him over the
margin, because a queue spending money it cannot record is the one moment a
sentence matters more than a fold — but it is a rule this project has held for six
sessions and I broke it in one state without measuring the result.

**Two of part 1's three "changed underneath" cases are unmeasured.** A deleted video
happened to me and is reported verbatim. A *replaced* video and a *removed client* I
did not construct, and I would rather leave two rows empty than fill them from
reading the code.

**The enumeration proves 51 controls and names 28 it does not reach.** The 51 are
earned — pressed, counted, with the assertion proved able to fail. The 28 are not
claimed.

**`test-3` failing on depleted credits was luck.** It cost nothing and it told me
something true about the account, but if that reel's analysis *had* been cached I
would not have learned that one corpus reel is $2.35 away from free, and I would
have been one step closer to spending money I was told not to.

**A resume starts a new queue rather than continuing the old record.** The new one
gets its own record; the old stays unfinished forever. That is honest — the old
queue genuinely did not finish — but a person looking at six rows will see one that
says *still going* about work that was carried on somewhere else.

## 10. Gates

`npm run check`, **run alone, after committing, and allowed to finish: exit 0,
`check: PASS`.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | **1617** | 0 | 1617 |
| benchmarks | 173 | 0 | 173 |
| panel | **424** | 2 | 426 |
| pytest (CV sidecar) | 149 | 0 | 149 |

core, benchmarks and pytest identical to session 110; service **1609 → 1617**,
panel **413 → 424**.

**Arithmetic: 11 added, 0 removed, 0 renamed.** By name, from `panel/src`,
`core/src` and `service/src` at `7e397b6` and now: panel 401 → 404, core 777 → 777,
service 1562 → 1570. The panel's run count rises by 11 rather than 3 because the
enumeration is two `it.each` blocks of four.

| added | where |
|---|---|
| `never sends two requests for one action — %s%s` (×4) | `every-control.browser.test.ts` |
| `never throws when the panel goes mid-request — %s%s` (×4) | same |
| `runs only what never ran, and nothing already paid for` | `queue-record.browser.test.ts` |
| `starts one resume, not two` | same |
| `offers nothing when there is nothing left to carry on` | same |
| `runs what never ran, and nothing that did` | `queue-record.test.ts` |
| `leaves out the video that was paid for` | same |
| `leaves a failed video to the control that is bounded` | same |
| `keeps the order the queue had` | same |
| `says there is nothing to carry on when every video ran` | same |
| `answers the same from a record read off the disk` | same |
| `throws, rather than reporting a success it did not have` | same |
| `keeps running, and says what has been spent since it stopped recording` | `queue-not-recorded.test.ts` |

**No test asserted retired behaviour**: nothing was retired. The resume adds a path
where there was none, and the not-recorded sentence adds a report where there was
silence.

`npm run golden`: **PASS, 4 of 4.** **Panel suite five times: exit 0, 0, 0, 0, 0**,
424 passed and 2 skipped each.

**An earlier set of five runs had run 1 fail** — three unrelated tests timed out at
five seconds because the first version of the enumeration had saturated the machine.
That is section 6; the enumeration was made cheap, committed separately, and the
five runs repeated clean. Reported rather than quietly re-run.

**The panel was rebuilt.** `panel/dist/panel.js` **272,834 bytes**. The extensions
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
| `.local/` directories | 16 | **17** — `queues/` |
| `.local/queues/` | absent | **4 files, 16K** |
| `assets/client-pictures/` | 23 files, 35M | 23 files, 35M |
| **his 22 photographs** | 22 hashes | **all 22 byte-identical** |
| CEP extensions | `com.framopia.studio` | `com.framopia.studio` |
| After Effects | 1 | 1, never launched or quit |
| `aerender` | 0 | 0 |
| **listening service** | **pid 91308** | **pid 91308 — the same one** |
| `origin/main..main` | 0 | 0 after push |

**`.local/queues/` is new and holds four records** — the real queues this session
ran. They are what the session proved with, and they are kept, which is the ruling.
**The service pid did not change**, unlike session 110's; I never stopped one.
`templates/library.aep` was read by golden and never written.

## 11. Every ledger line added

**None.** 294 records, sha256
`77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0` at both ends.

**Four real queues were run against the live service** — seven videos in total — and
every one billed **$0.0000**, because each reel's stages were already cached and the
two that were not cached refused before spending. A resume that costs anything is
the defect; this one cost nothing and the ledger proves it.

## What is open

- **The not-recorded sentence can push Make past 896 px.** Section 9.
- **A replaced video and a removed client**, under a running queue: unmeasured.
- **28 of 79 controls** are not enumerated — the setup form, the one-off client, the
  three editors, the readiness controls, the queue's running controls.
- **A resume leaves the old record saying *still going* forever.**
- **`test-3` is $2.35 from free** — its analysis is the one corpus stage not cached.
- **The Google account's prepayment credits are depleted**, measured today.
- Choose with the card open is 1459 px — session 106.
- The 2026-08-29 one-column ruling stays narrowed — session 105.
- `logoPath()` in `host.ts` is read by nothing — session 104.
- `NODE_NOT_FOUND_HELP` remains a ruling Mohamed has not made — session 101.
