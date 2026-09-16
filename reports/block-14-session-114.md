Status: OK

# Block 14, session 114 — the queue becomes the way the tool works

Mohamed said the queue is not smooth and not logical, and that he works
principally in queues. **The diagnosis was right, and it is structural.** Counted
on his own panel before anything was changed: putting ten videos through cost
**81 actions, 39 of them crossings between screens**. The queue had saved him the
watching and never saved him the work.

It now costs **15 actions and 2 crossings**.

---

## 1. The journey, counted

Measured by driving the real panel and recording every press and every move
between the three screens — `panel/src/the-journey.browser.test.ts`. A press is a
click on a control or a change of a picker; a crossing is a move between Choose,
Make and Build.

| | before | after |
|---|---|---|
| **one video**, start to finished composition | 6 actions (4 presses, 2 crossings) | **6 actions** — unchanged |
| **five queued and built** | 41 actions, 19 crossings | **10 actions, 2 crossings** |
| **ten queued and built** | 81 actions, 39 crossings | **15 actions, 2 crossings** |

Split by half, because the two halves cost him almost exactly the same and the
brief asked which costs most:

| | before | after |
|---|---|---|
| putting **five** in the list | 21 actions | **8** |
| building those five | 20 actions | **2** |
| putting **ten** in the list | 41 actions | **13** |
| building those ten | 40 actions | **2** |

The before-walk, printed step by step, was: pick Client, pick Video, cross to
Make, press *Add sora to the list*, **cross back to Choose**, pick Video, cross to
Make, press *Add …* — ten times over — then, once they were made, **cross to
Choose, pick Video, cross to Build, press Build** ten times again.

**One video is deliberately unchanged at 6 actions.** Making a single video was
never the thing that cost him; it is what the panel was already good at.

**A caution about these figures.** The first version of this walk reported the
new journey as *shorter than it is*, because `press` answers false rather than
throwing and two controls it named had been replaced — it silently skipped the
steps it could not find. The build press is now asserted, not counted, and the
figures above are from the corrected instrument.

---

## 2. Choosing several videos

**He picks the client once, on Choose. Which of that client's videos go in the
list is asked where the list is** — on Make, in the pane that was already there.
The crossing per video is gone entirely.

**One list, not two.** The first draft had the videos to pick from above and the
list being assembled below, with the same video in both. A ticked row carries its
own position instead:

```
1. sora.mov                    in the list
   sculptra-explainer.mov      add
3. botox-myths.mov             in the list
2. skin-booster.mov            in the list
```

So what is in the list, and in what order, is readable off the thing he presses.
Measured: ticking the third, then the first, then the second numbers them 1, 2, 3
in the order he chose them.

**It scrolls rather than growing.** Six rows and then a scroll — a client with
thirty videos would otherwise have put Make past the 900 px every screen has
stayed inside since session 106. Make's daily state is **616 px**, unchanged.

**Reorder: not worth it, and not done.** He can already reorder before starting —
untick and re-tick, and the numbers follow. Reordering a list *while it runs*
would mean the service accepting a mutation to a job mid-flight, and the queue
writes its record per video as it goes, so there would be two sources of truth
about what the list is. Media Encoder needs it because a render is hours and
priorities change; here a video is about 25 minutes and the whole list is
unattended. **If he asks for it, it is a service change, not a panel one.**

**The client does not have to be fixed for a list, and that is deliberate.** Every
item has carried its own client since session 94, and session 80's wrong-client
rule protects the brand **per reel**, not per list. What the restructure had to
fix is that a video chosen under one client became *invisible* when he looked at
another while *Make these N videos* went on counting it — work he could not see
and could not take out. A video already in the list is now shown whichever client
he is looking at. Forcing one client would have meant either refusing a mixed list
or discarding it silently, and neither is better than showing him what he has.

---

## 3. Building them all

**One press builds every finished video in the list.** It sits above the
single-composition card on Build, because that is what he came to Build to do
when he has run a list; building one at a time is untouched and unmoved.

What he presses: **Build all 3**. What he sees:

```
Building them all
  sora.mov            Built
  botox-myths.mov     Did not build
                      That video has not been made yet, so there is nothing to
                      build for it. Put it in a list on the previous step and
                      make it first.
  skin-booster.mov    Built
2 compositions are ready. 1 did not build — it is named above.
```

While it runs, each row says *Building…* or *Waiting*, and one line says why:
**“They are built one after another, because After Effects runs one at a time.”**
That is a hard limit, not a decision — the builder drives the running instance
over AppleScript, and two at once would interleave inside one application. A
control stops it after the one in hand.

**Nothing here is red.** Colour means *this spends money* on every screen in this
panel and building spends nothing.

**Only the videos that finished are offered.** The one that failed in the run
queue is not listed, because there is nothing to build for it.

**A build that fails does not stop the rest**, which is session 94's rule for runs
and matters more here — one bad plan in ten would otherwise cost him the other
nine. Proved by breaking it: with the carry-through replaced by a `break`,

```
 FAIL  service/src/build-queue.test.ts > building every finished video in one
 press > carries a failure through and builds everything after it
AssertionError: expected [ 'reel-1' ] to deeply equal [ 'reel-1', 'reel-3', 'reel-4', …(1) ]

  Array [
    "reel-1",
-   "reel-3",
-   "reel-4",
-   "reel-5",
  ]
```

**One press sends one list.** Measured as what reaches the service, not what the
DOM does: one press, one `build-queue` request, three videos with their plans. Two
fast presses still send one — and with both guards removed:

```
 FAIL  panel/src/building-them-all.browser.test.ts > building every finished
 video > never sends two build lists for one press
AssertionError: expected 2 to be 1
```

---

## 4. The record, and session 111's four rows

**The names were there all along.** Every video's name, its outcome and the cause
of its failure have been written into the record since session 94; the panel put
all of it in a `title` tooltip. What he read was four rows of a timestamp and a
count.

It now reads:

```
Queues you have run
  today, 11:00 AM     1 ready, 1 did not finish · $1.20
                      sculptra.mov did not finish. The paid service turned it
                      away because the account has no credit left. Nothing was
                      charged and nothing already paid for is lost. It will keep
                      refusing until the account has credit again.
```

**Only a failure gets a line**, so the height is paid by the rows that have
something to say and a clean queue costs nothing it did not cost before. The cause
is said the way a live failure says it — the one on his machine is a real 429, and
raw it is a JSON blob with a URL inside it.

The red, which is exactly what he reads today:

```
AssertionError: expected 'Queues you have runtoday, 11:00 AM1 r…' to contain
'sculptra.mov'

Received: "Queues you have runtoday, 11:00 AM1 ready, 1 did not finish · $1.20"
```

### The four rows on his machine

**They are session 111's test queues and they should not be there.** All four ran
within two minutes of each other on 2026-09-14, all cost $0.00, and not one is his
work:

| when | videos | |
|---|---|---|
| 22:38:37 | `a video this tool has never seen` | failed |
| 22:39:29 | `test-2` done, `test-3` failed | a scratch reel and a corpus reel |
| 22:40:28 | `test-1` done, `vitasilk` stopped | corpus reels |
| 22:40:32 | `vitasilk` done | a corpus reel |

**Moved, never deleted**, to `.local/quarantine-session114/`, and the destination
listed afterwards rather than assumed — session 71's rule:

```
2026-09-14T22-38-37-120Z-775f0c60-…json   1094 bytes
2026-09-14T22-39-29-804Z-2d55b101-…json   1524 bytes
2026-09-14T22-40-28-678Z-f4ab43e4-…json   1023 bytes
2026-09-14T22-40-32-788Z-46973d6d-…json    686 bytes
count: 4
adc83ff9114a0df1 bf3048ffe8ee6e81 f27f98aec8bea681 c8401e0f784fa4f2
```

The four sha256 prefixes are the same four measured at the start of the session.
`.local/queues/` is now empty and still there — the store is kept forever; those
four rows were not his record of work.

---

## 5. Every queue behaviour, still firing

The restructure replaced the control five of these tests drove. **Each keeps what
it asserts and moves only how it arrives** — a list is ticked now, not added to
one at a time. Nothing was weakened and nothing was deleted.

| behaviour | proved by | state |
|---|---|---|
| a failure does not stop the queue (94) | `queue.test.ts` | untouched, passing |
| a deleted video fails cleanly (111) | `queue.test.ts` | untouched, passing |
| **a duplicate add is refused (109)** | its control was replaced | **re-earned, §below** |
| a video failing twice is not retried (109) | `queue-record.browser.test.ts` | untouched, passing |
| the record is kept forever (110) | `queue-record.ts` | untouched, passing |
| a running queue is findable from a fresh panel (109) | `coming-back.browser.test.ts` | untouched, passing |
| it survives a service restart (110) | `queue-record.test.ts` | untouched, passing |
| a resume costs $0.00 (111) | `queue-record.browser.test.ts` | untouched, passing |
| **no double-press starts two paid runs (109)** | arrival rewritten | **re-proved, §below** |
| a queue that cannot record says so (111) | `queue-not-recorded.test.ts` | untouched, passing |

### The duplicate rule, re-earned — and the weak test that nearly hid it

Session 109 proved it against *Add X to the list*, which went disabled once its
video was in. That control is gone. The rule is the same and the mechanism is
better: a row toggles, so a list cannot hold one video twice by construction.

**The first version of the replacement test was weak and I caught it by breaking
the code.** It counted the rows marked as chosen; with the toggle replaced by a
plain append, the same video went in five times and **exactly one row was still
marked**, because the mark is found by the first match. The test stayed green over
a list holding five copies.

Rewritten to count what the list would *send*, the same mutation gives:

```
 FAIL  panel/src/building-them-all.browser.test.ts > choosing several videos >
 cannot put the same video in the list twice
AssertionError: expected 5 to be 1
```

### No double-press starts two paid runs

Session 109's test, arriving by ticking instead of adding, still passes — and the
control it guards is still the only one in that pane that spends.

### The enumeration's running-queue state

`a queue running` came back **NOT REACHED**: its arrival pressed the control the
restructure replaced. Fixed, and then it reported *reached, 0 controls* — which
was the instrument again, not the panel. `COUNTING` holds every non-GET for three
seconds on purpose, so at 900 ms the list had not started: the pane still showed
the start control, disabled while in flight. Waiting past the stub gives **1
control, 1 reaching the service** — the real *Stop after this video*.

---

## 6. Session 112's control cells

**84 controls now, 168 cells, all earned.** Session 113 had 81.

| what moved | cells |
|---|---|
| **removed:** *Add X to the list* | its 2 cells go with it |
| **removed:** *take it out*, in the assembled list | its 2 cells go with it — taking a video out is now pressing its row again |
| **added:** one row per client video (4 in the harness) | 8 cells, earned by the enumeration |
| **added:** *Build all N* | 2 cells, earned — and one of them by mutation, §3 |
| **added:** *Stop after this one*, on a build list | rendered only while building; **not** in the enumeration, §8 |
| **re-earned:** *Stop after this video*, a queue running | 2 cells, genuinely reached for the first time |

Per state, after: choose 5 · run **12** · build 8 · choose-everything-open 29 ·
words editor 3 · emphasis editor 2 · picture editor 1 · new client 4 · one-off
client 1 · details 6 · colours 2 · removing 2 · **a queue running 1** · adding a
photograph 2 · the words that choose a photograph 1 · machine facts 2 · service
down 2 · second service 1.

---

## 7. What held

| thing | session 113 | now |
|---|---|---|
| golden | 17,174 fields, 4 of 4 | **17,174, 4 of 4, PASS** |
| `sora-3`, `sora-4`, `test` through `dryRun`/`stepsFor` | session 113's reading | **IDENTICAL, field by field** |
| Choose | 374 px | 374 px |
| Make, an ordinary day | 616 px | 616 px |
| Make, four videos in the list | 616 px | 616 px |
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

**One new state, and it had to be capped.** Build with a list ready to build was
measured at **887 px of 900** with the ten videos Mohamed named — inside, and
thirteen pixels is not margin; eleven videos would have put it out. The list is
capped and scrolls, so the number in it no longer decides the height: **twenty
videos now read 845 px**, and that is the figure the height test holds, measured at
twice his worst case rather than at it.

Nothing on any screen passes 900 px. The type scale, the caps and the width rules
were not touched. The full cost screen was not touched.

---

## 8. What I am least sure about, and what remains

**That the build list survives a restart.** The run queue does — its record is on
disk and session 109's adoption finds a running job from a fresh panel. The build
list has neither: it is derived from the run queue the panel is currently
following, so closing the panel mid-build leaves the builds running in the service
with nothing on screen following them. Building is free and three seconds a video,
so what is lost is the report, not the work — but it is the obvious next thing and
it is not done.

**That deriving the ready list from the running queue job is the right source.**
The durable source is the record on disk, which survives everything. Using the job
means the offer disappears when he reopens the panel, even though the videos are
still built and still ready. **This is the same gap as above and it is the one I
would close first.**

**The *Stop after this one* control on a build list is not in the enumeration.** It
renders only while a build list is running, which the enumeration has no state
for. Its cells are empty and named here rather than assumed.

**Reorder is not built**, §2, and the reasoning is a judgement about his working
week rather than a measurement.

**A mixed-client list is possible and now visible.** I chose to show it rather than
refuse it. Session 80's rule protects each reel, so I believe this is safe — but it
is a decision about his brand and he may want the opposite.

**Everything session 113 left open is still open**: a resume leaves the old record
saying *still going*; a replaced video and a removed client under a running queue
are unmeasured; `test-3` is $2.35 from free and the account's credits are depleted.

---

## 9. Measured

**Gate.** `npm run check`, run alone on `574592c`, allowed to finish: **exit 0**,
`check: PASS`.

```
core        846 passed (846)
service    1637 passed (1637)
benchmarks  173 passed (173)
panel       464 passed | 2 skipped (466)
pytest      149 passed in 10.76s
```

**Golden.** PASS, 4 of 4: 4415 + 4280 + 3709 + 4770 = **17,174 fields identical**.
After Effects 26.0x67, 1198 font names. Ledger read by golden itself: 294 lines,
`77eaf6c9ca6b633e`.

**Test-name arithmetic**, against `cbf04f6`:

```
panel:    406 -> 417  (+11)
core:     777 -> 777
service: 1583 -> 1590  (+7)
```

**Nothing was removed and nothing renamed.** Five tests had their *arrival*
rewritten and kept their names — the behaviour they assert was not retired, only
the route to it.

Added, service (all in `build-queue.test.ts`): *builds them one after another, in
the order they were listed*; *carries a failure through and builds everything
after it*; *never has two builds running at once*; *says which one it is building
and how far it has got*; *stops after the one in hand, and marks the rest
stopped*; *refuses an empty list rather than reporting an empty success*; *is a job
type of its own, and its stop flag is its own*.

Added, panel: *offers the videos the list finished, and not the one that failed*;
*sends every one of them in a single press, with its plan*; *never sends two build
lists for one press*; *says which one did not build, in his words, and never raw*;
*cannot put the same video in the list twice*; *shows what is in the list, and in
what order*; *keeps a video chosen under another client visible, not silently
counted*; *names the video that did not finish, and says why in his words*; *says a
video has not been made yet rather than naming its plan*; *makes one video, start
to finished composition*; *queues %i videos and builds them all*.

The suite counts move by more than the names: panel 452 → 464 is +11 names plus
one extra row, because *queues %i videos and builds them all* is an `it.each` of
two. Service 1630 → 1637 is +7. Both are given because either alone misleads.

**Five panel runs**, each exit 0, 464 passed + 2 skipped:

```
run 1  exit 0   464 passed | 2 skipped   401.45s
run 2  exit 0   464 passed | 2 skipped   375.37s
run 3  exit 0   464 passed | 2 skipped   372.26s
run 4  exit 0   464 passed | 2 skipped   373.61s
run 5  exit 0   464 passed | 2 skipped   381.35s
```

**It moved, and by less than the work added.** Session 113 measured 419, 350,
351, 360, 366 s; this is 401, 375, 372, 374, 381. Runs 2 to 5 sit in a 9 s band
against session 113's 16 s. The twelve new tests include five that drive a
browser, and the enumeration's running-queue state now waits 3.6 s where it waited
0.9 s — the suite is slower by roughly 20 s and it is not flakier. Run 1 is longer
than the rest in both sessions; that is the browsers warming.

**The drive did not go away this session.** Session 113 lost three runs to it
unmounting; these five ran clean and no result here is re-used from an
interrupted run.

**Bundle.** `npm run panel:build` → `panel/dist/panel.js`, **277,902
bytes**. Symlink intact:

```
com.framopia.studio -> /Volumes/T7 Shield/INSEA/Projects/framopia-studio/panel
```

**Part 0, as found at both ends:**

| | start | end |
|---|---|---|
| ledger records | 294 | **294** |
| ledger sha256 | `77eaf6c9ca6b633e…6c1a84d0` | **the same** |
| `templates/library.aep` | `4b0cf05a8f5d4775` | **the same** |
| `modes/dr-loubna-kfafi.json` | `f2fa926e14953b6a`, 2026-09-12T20:52:03 | **the same, same mtime** |
| `modes/k2-syndicalia.json` | `572e99bf890ceefb`, 2026-09-09T21:58:19 | **the same, same mtime** |
| `.local/` directories | 17 | **18** — `quarantine-session114/`, §4 |
| `.local/queues/` | 4 records | **0** — the four moved aside, §4, and the store is still there |
| `.local/quarantine-session114/` | — | **4 records**, the same four sha256 prefixes |
| `assets/client-pictures/` | 24 files, 35M | **24 files, 35M** |
| his 22 photographs | — | **byte-identical, dimensions identical** |
| After Effects | 1, pid 80520 | **1, pid 80520** |
| `aerender` | 0 | **0** |
| Framopia service listening | pid 33414 | **pid 33414** |
| extensions folder | one symlink | **one symlink, unchanged** |

**No After Effects was launched or quit and no project was saved**; the instance
is the one that was already there, same pid at both ends. **The service Mohamed
started was not stopped** — pid 33414 at both ends, unchanged, and nothing this
session needed one.

The 24 files in the picture store are his 22, session 108's leftover crop and a
`.DS_Store`. The working tree at the end holds `modes/dr-loubna-kfafi.json`
modified, his seven untracked photographs and
`assets/client-pictures/k2-syndicalia/` — all there before this session — and this
report.

---

## 10. Money

**No ledger line was added.** Expected none, spent $0.00.

- 294 records at the start, sha256 `77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0`.
- 294 records at the end, the same sha256.
- `npm run golden` read the ledger itself and printed `294 lines, 77eaf6c9ca6b633e`.
- Nothing this session could bill. The build sequence has no ledger writer and no
  ceiling because building calls nothing; the run queue was not touched; and every
  figure in §1 comes from a stubbed panel.
