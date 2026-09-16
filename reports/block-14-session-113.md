Status: OK

# Block 14, session 113 — a failure must cost nothing and lose nothing

Every real defect since session 84 was found by Mohamed using the tool, not by a
test. So this session did not try to stop the next one. It measured what one
costs.

**It found a defect doing it**, and not a small one: a run that bought the
keywords and then lost the network before the image slots were planned left a
reel that could never hold a picture, said nothing, and reported every stage
green on the next press. $0.35 paid, silently, with no way out from the panel.
That is fixed, proved red and green, and the money screen that told the same lie
is fixed with it.

---

## 1. What a failure costs, measured

Eight ways a run can stop, plus the two the measuring found. Every row in the
first table was produced by failing the run at that point and reading the plan,
the ledger and the caches afterwards — `service/src/what-a-failure-costs.test.ts`
does it, against a scratch reel, a scratch plan and a scratch ledger.

| where it fails | paid by then | kept | to redo | what he sees |
|---|---|---|---|---|
| **the network drops mid-transcription** | $0.00 | nothing to keep — the plan still says `transcription: pending` | the transcript | *"The connection dropped. Nothing was lost and nothing extra was charged. Try it again."* |
| **the network drops after the transcript** | $0.17 | the transcript, on the plan | the keywords and the slots | the same sentence |
| **the model returns something unusable** (a picture idea naming two subjects) | the transcript and the words | everything before it; the other pictures were made | one press of the pictures | *"One of the picture ideas asked for two things in a single picture, so it was left out. The rest were made. Run the pictures again and a fresh idea is asked for."* |
| **the model is busy (5xx)** | whatever finished | every finished stage | the stage that failed | *"The service we use was busy and turned it away. Nothing was charged. Try it again shortly."* |
| **Google refuses — 429, the account out of credit** | whatever finished | every finished stage | nothing until the account has credit | **new this session:** *"The paid service turned it away because the account has no credit left. Nothing was charged and nothing already paid for is lost. It will keep refusing until the account has credit again."* |
| **the drive unmounts** | whatever finished | everything on the plan; the plan is on the drive and comes back with it | the stage that failed | *"A file it needed was not where it expected. If the drive is unplugged, plug it in and press Refresh."* |
| **the service dies mid-run** | whatever finished | every finished stage, on the plan | the stage it died in | the panel's own service sentence: *"The companion service stopped answering. It usually clears on its own."* |
| **After Effects is closed** | nothing — it is not in a run | everything | nothing | a run does not touch After Effects; only Build does, and it refuses before it starts |
| **he stops it himself** | whatever finished | every finished stage | the rest, when he presses again | the queue says *"You stopped the list. N ready to build."* |
| **the machine sleeps** | whatever finished | every finished stage, on the plan | the stage it slept in, and the rest of a queue | the socket error's sentence — *"The connection dropped…"* |
| **the ceiling is reached** | up to $4.00 | everything bought | nothing; it refuses before the request | *"This would have cost more than the limit set for one video, so nothing was spent. Raise the limit or use a shorter video."* |

**Two more the measuring turned up, which no list of outside causes would have
named:**

| where it fails | paid by then | kept | to redo | what he saw |
|---|---|---|---|---|
| **between the two halves of the analysis stage** | **$0.35** | the transcript and the keywords — but the plan claimed the whole stage was done | **nothing could be redone from the panel** | nothing. Every stage green, no picture, ever. |
| **part-way through the pictures** | whatever the finished candidates cost | **every finished picture, in the cache** | only the candidates that did not finish | the stage's own cause |

### The measured lines, verbatim from the harness

```
  [1] transcription fails: plan.transcription=pending ledger +0 cause="fetch failed"
      retry: transcription=done analysis=done images=done zones=done planSpent=$0.41
  [2] Google refuses at keywords: transcription=done spent=$0.17 cause="429 RESOURCE_EXHAUSTED"
      retry: transcription=skipped analysis=done images=done zones=done transcribe called 0 time(s)
  [3] the slots half fails: analysis=done slots=0 spent=$0.35
      retry: transcription=skipped analysis=done images=done zones=done keywords x0 slots x1 slots on plan=5
  [4] the pictures fail: slots=5 analysis=done spent=$0.41
      retry: transcription=skipped analysis=skipped images=done zones=done words re-bought 0 time(s)
  [5] the look at the video fails last: analysis=done images=done spent=$0.41
      retry: transcription=skipped analysis=skipped images=done zones=done re-bought 0 stage(s)
  [6] the pictures die on candidate 5 of 8: the model was asked 5 time(s), then 4 more — 4 of 8 came back free
```

Line [3] is the fix; before it, that line read
`retry: … analysis=skipped images=skipped zones=done keywords x0 slots x0 slots on plan=0`.

---

## 2. Which lose money or work, ranked

Ranked by what a mistake costs, which is the order the brief asked for: money
first, then work, then time.

1. **A failure between the keywords and the slots — lost the work outright, and
   made the money already spent unusable.** $0.35 bought a transcript and
   keywords for a reel that could then never have a picture. Nothing was
   *re-charged*, which is why it never showed up as a money defect; what was lost
   is that the $0.35 bought nothing deliverable. **Fixed.**
2. **The money screen for a reel in that state read $0.00 for a press that spends
   $2.17.** `test 2` is in exactly that state on this machine. **Fixed.**
3. **A 429 told him nothing he could act on.** No money lost; time lost pressing
   a button that could not work. **Fixed.**
4. **A queue does not survive the service stopping** — a restart, a logout, a deep
   sleep. A queue of five is about two hours and a sleeping Mac loses the rest of
   it. **No money is lost**: every finished stage is on the plan and every
   finished picture is in the cache, so restarting costs time. **Not fixed, and
   named in §6.**

**Nothing else on the table loses money.** Every other row keeps what was bought:
the plan records each stage as it finishes, and the image cache is written per
picture, before the next one is asked for.

---

## 3. What was fixed, with the ledger before and after

**No ledger line was added by anything in this session.** 294 records at the
start and 294 at the end, the same sha256, and the harness that produced every
figure above writes to a temporary ledger which is asserted to be empty at the
end of its own run.

### The analysis stage resumes at the half that did not finish

`analyseKeywordsForPlan` writes `pipeline.analysis = done` and saves the plan
*before* `planImageSlotsForPlan` is called at all. The runner asked one question —
is the analysis done — and got a yes that was true of the record and false of the
work. The two halves are asked about separately now, by the record each of them
writes.

The red, with the fix removed and `service/src/pipeline.ts` restored from the
saved copy:

```
 FAIL  service/src/what-a-failure-costs.test.ts > what a failure costs, measured at
 every point a run can stop > what a failure between the keywords and the slots
 leaves behind
AssertionError: expected +0 to be 1 // Object.is equality

- Expected
+ Received

- 1
+ 0

 ❯ service/src/what-a-failure-costs.test.ts:324:24
    322|     expect(keywordsAgain).toBe(0);
    323|     /* The slots half never ran, so this press must run it. */
    324|     expect(slotsAgain).toBe(1);
```

**What it would have done to him in production:** he presses *Make the
subtitles*, the network drops, he presses again, every row goes green, and he
goes to Build to find a reel with no pictures — and pressing *Make the pictures*
does nothing either, because there are no slots for it to fill. The only way out
was a flag reachable from a terminal he does not use.

**Ledger:** 294 before, 294 after. The keywords are not re-bought — `keywords x0`
in line [3] — so the fix costs nothing to apply to a reel already in this state.

### The money screen agrees with the run

The dry run read the same half-written record and said *"no image slots on the
plan, and analysis has already run without planning any"* — priced at nothing.
`test 2` is the reel in that state on this machine:

```
BEFORE  test-2: estimate $0.00     images pending/run/$0
        note: no image slots on the plan, and analysis has already run without planning any
AFTER   test-2: estimate $2.1708   images pending/run/$2.1708
        note: no image slots planned yet; a run would plan about 6 for a 22.3s reel
              and generate 12 candidates, budgeted at most $2.17
```

The red:

```
 FAIL  service/src/what-a-failure-costs.test.ts > … > does not tell him a reel in
 that state costs nothing
AssertionError: expected 'no image slots on the plan, and analy…' not to contain
'without planning any'

Expected: "without planning any"
Received: "no image slots on the plan, and analysis has already run without planning any"
```

**Ledger:** 294 before, 294 after. This is a reading, not a run.

### An account with no credit says so

Session 111 hit a real 429: the Google account's prepayment credits are depleted.
It fell through to the general sentence, which is true and useless — it does not
say that pressing again is the one thing that cannot work. The red:

```
 FAIL  panel/src/words.test.ts > what went wrong, in his words > says that an
 account with no credit will keep refusing
AssertionError: expected 'It stopped before finishing. Nothing …' to contain
'no credit left'

Expected: "no credit left"
Received: "It stopped before finishing. Nothing you have already paid for is lost."
```

It sits **after** the 5xx rule, and a second test holds that in place: a busy
service and an empty account are opposite instructions, and *"try it again
shortly"* must keep going to the first.

**Ledger:** 294 before, 294 after.

### A picture paid for is never bought again

Not a fix — a proof the brief asked for, and it holds. The picture stage writes
each image into the cache the moment it returns, before the next is requested,
and the fingerprint that addresses it is the prompt, the model, the resolution
and the candidate index, none of which a retry changes. Killed on candidate 5 of
8, then run again:

```
  [6] the pictures die on candidate 5 of 8: the model was asked 5 time(s),
      then 4 more — 4 of 8 came back free
```

Four bought, four kept, four asked for on the retry. Session 90 lost $0.61 to the
opposite; that shape is closed and now has a test watching it.

---

## 4. What he sees when a single video fails, outside a queue

The run stops at the stage that failed. That stage's row goes amber — never red;
red means *this spends money* — the rows before it stay `Done` with what each
cost, and one sentence appears beneath them. Nothing moves him off the screen and
nothing is thrown away.

The thirteen causes the tool can produce, and the sentence each becomes,
measured by calling `causeWords` with the real cause text:

| cause | he reads |
|---|---|
| `fetch failed` | The connection dropped. Nothing was lost and nothing extra was charged. Try it again. |
| `503 Service Unavailable` | The service we use was busy and turned it away. Nothing was charged. Try it again shortly. |
| `429 RESOURCE_EXHAUSTED` | The paid service turned it away because the account has no credit left. Nothing was charged and nothing already paid for is lost. It will keep refusing until the account has credit again. |
| `ENOENT … /Volumes/T7 Shield/…` | A file it needed was not where it expected. If the drive is unplugged, plug it in and press Refresh. |
| `socket hang up` (a sleeping Mac) | The connection dropped. Nothing was lost and nothing extra was charged. Try it again. |
| the ceiling | This would have cost more than the limit set for one video, so nothing was spent. Raise the limit or use a shorter video. |
| the video is gone | That video is not there any more. Press Refresh and choose it again. |
| no face masks | It has not looked at this video yet, so it does not know where you are in the frame. Make the pictures for it and that happens first. |
| a two-subject picture idea | One of the picture ideas asked for two things in a single picture, so it was left out. The rest were made. Run the pictures again and a fresh idea is asked for. |
| `not authorised` | The key for the paid services was not accepted. Nothing here can change it — the key itself has to be replaced before anything that costs money will run. |
| already-chosen pictures | You have already chosen pictures for this video, and running it again would throw those choices away. Nothing was changed. |
| nothing at all | It stopped and did not say why. Nothing else was changed. |
| anything unwritten | It stopped before finishing. Nothing you have already paid for is lost. |

No sentence names a command, a file, a stage number or a screen that does not
exist; a test asserts that across all of them.

**In a queue** the video is retried once if the cause is worth retrying — a
ceiling refusal retried is a refusal twice — then marked failed, and the queue
moves to the next video. Session 94 built that and session 111 proved it with a
deleted video.

---

## 5. The three photograph controls, pressed twice against a copy

Session 112's largest honest gap, closed from both ends.

**The panel side** joins the enumeration in `every-control.browser.test.ts`. They
were not reachable before because the add form renders only when the host offers
a file chooser; two new states give it one and fill the field that gates the Add
button.

```
  == adding a photograph to a client: 2 controls, 1 reach the service
  == changing the words that choose a photograph: 1 controls, 1 reach the service
```

Three controls, pressed twice against an answer held for three seconds, and
pressed then abandoned mid-request. **None sends two requests for one action.**

**The store side** is `service/src/clients/pressed-twice.test.ts`, against a
scratch client and three scratch photographs made in a temporary directory.

```
  add, pressed twice: ids pic001 and pic002, 2 file(s) in the store — pic001.png, pic002.png
  save the words, pressed twice: "Profhilo" then "Profhilo"
  forget, pressed twice: 5 file(s) in the store before, 5 after
```

**Would a double press damage a photograph? No.** Measured, not argued:

- **The file he chose is never written to.** `keepPicture` reads the source and
  copies; it has no path that writes to it. Every scratch photograph is
  byte-identical after every control was pressed twice.
- **Nothing is deleted.** *Forget* twice removes a row from the client file and
  touches the store not at all — five files before, five after. The second press
  is a filter that removes nothing.
- **Saving the words twice** leaves one picture with those words.
- **Adding twice makes a duplicate**, and this is the one finding worth his
  attention: a second press writes a second row **and a second copy of the
  photograph** — about 1.6 MB for one of his, pushed to the public repository with
  the rest. Not damage, not deletion, but a duplicate he would have to forget by
  hand.

**I predicted this one wrong and am recording that rather than the prediction.**
The test was written expecting `keepPicture` to recognise the identical bytes and
return the file it already had. It does not: it is asked for `pic002`,
`pic002.png` is not there, and it copies. The comment in the test says so.

So the panel's guard is what stands between him and that duplicate, and it is not
decoration — which is exactly why it is now measured rather than assumed.

**His 22 photographs are byte-identical, dimensions included**, at both ends.
The scratch client's file and its store directory were deleted, and the deletion
is asserted rather than claimed.

---

## 6. What still cannot be protected

Named, not half-fixed.

**What a failure still costs him, after this session:**

- **A queue does not survive the service stopping.** A restart, a logout, or the
  Mac sleeping deeply enough ends it. A queue of five is about two hours. No money
  is lost — every finished stage is on the plan and every finished picture is in
  the cache — but the time is. He would press Carry on and wait again.
- **A resume leaves the old record saying *still going*.** Open since session 111.
- **A video replaced or a client removed under a running queue** is still
  unmeasured. Session 111 measured a deleted video and left these two.
- **Adding a photograph twice leaves a duplicate**, §5. The guard holds; nothing
  cleans up after it if it ever does not.

**What has never been tested, and why:**

- **Sleep.** Nothing here can make a Mac sleep and watch what happens; the socket
  failure it produces is tested, the sleep itself is not. What is asserted is the
  consequence, which is not the same thing.
- **A drive that unmounts mid-run.** The sentence is tested; the unmount is not —
  except that **it happened by itself during this session's panel runs**, and the
  repository came through it intact: three runs died with `EACCES mkdir /Volumes/T7
  Shield` and `uv_cwd`, and the ledger, `templates/library.aep` and the working
  tree were all unchanged afterwards. That is one accidental data point, not a
  test.
- **A different shape of video.** The tool refuses anything but 2160×3840 by name,
  and that refusal is tested. What a 1080p reel would look like if the refusal were
  lifted is unknown and deliberately so.
- **Two panels against one service**, and **the same video in two queues at once.**
- **The three controls that write a photograph, against his real store.** They
  were pressed against a copy, on purpose. A guard that holds on a scratch client
  holds on his — the code is the same — but the measurement is not his.

**What would tell him first, if one of these happens:**

- **A queue lost to sleep**: the step on Make stops changing. It says `2/5` and
  keeps saying it. Nothing announces it, and that is the honest answer — the panel
  cannot tell a service that died from one that is thinking.
- **A duplicate photograph**: the client card, immediately. Two cards with the same
  picture and the same description, next to each other.
- **A drive that goes away**: the next thing he presses, with the sentence about
  plugging it in.
- **Money going somewhere it should not**: *See everything spent*, which reads the
  ledger and nothing else.

---

## 7. What held

| thing | session 112 | now |
|---|---|---|
| golden | 17,174 fields, 4 of 4 | **17,174, 4 of 4, PASS** |
| `sora-3`, `sora-4`, `test` through `dryRun` and `stepsFor` | session 102's baseline | **IDENTICAL, field by field** |
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

Nothing on any screen passes 900 px. The type scale, the caps and the width rules
were not touched.

**One figure moved, and it is named:** `test-2`'s dry run went from **$0.00 to
$2.17**. It moved to the truth — a run on that reel plans six slots and generates
twelve candidates — and it is the defect in §3, not a side effect of it.

---

## 8. What I am least sure about

**That `pipeline.images` is the right thing to ask about the slots half.** It is
the record `planImageSlotsForPlan` writes and the only thing that writes it, so it
is an honest answer today. It is also a field named for the picture stage being
used to describe the analysis stage — a double-naming this codebase already
records as open. If someone untangles that naming without reading the runner, this
fix comes undone quietly. `pipeline-stages.test.ts` holds the two views together
but would not catch that.

**That the failure table is complete.** It is complete for the ways a *stage* can
throw, which is what the harness can reach. A failure that leaves no exception —
a stage that returns successfully having done nothing — is exactly the shape of
the defect this session found, and I found it by reading the code rather than by
running the harness. There may be another one of those.

**The sleep row.** It says the socket dies and the sentence is right. What a Mac
that sleeps for six hours in the middle of an ffmpeg pass does to a half-written
audio file, I do not know.

**That the duplicate photograph is only a duplicate.** I checked that nothing is
deleted and nothing is written to. I did not check what a plan does if it has
already chosen the first of two identical pictures and the second arrives.

---

## 9. Measured

**Gate.** `npm run check`, run alone on `8ff54ba`, allowed to finish: **exit 0**,
`check: PASS`.

```
core        846 passed (846)
service    1630 passed (1630)
benchmarks  173 passed (173)
panel       452 passed | 2 skipped (454)
pytest      149 passed in 7.10s
```

**Golden.** PASS, 4 of 4: 4415 + 4280 + 3709 + 4770 = **17,174 fields identical**.
After Effects 26.0x67, 1198 font names, against the reference recorded
2026-09-01. Ledger read by golden itself: 294 lines, `77eaf6c9ca6b633e`.

**Test-name arithmetic**, against `80dcba8`:

```
panel:    404 -> 406   (+2)
core:     777 -> 777
service: 1570 -> 1583  (+14 added, -1 removed)
```

Added, panel: *says that an account with no credit will keep refusing*; *still
tells him to try again when the service was merely busy*.

Added, service: the eight measurements in `what-a-failure-costs.test.ts`
(*loses the transcript when transcription itself fails…*, *keeps the transcript
when the stage after it fails*, *what a failure between the keywords and the
slots leaves behind*, *does not tell him a reel in that state costs nothing*,
*keeps every slot when the picture stage fails part-way*, *keeps the pictures
when the free look at the video fails after them*, *buys a picture once, however
many times the stage is interrupted*, *never writes a ledger line of its own*);
the four in `pressed-twice.test.ts` (*adds a photograph twice…*, *never writes to
the file he chose…*, *saves the same words twice…*, *forgets a photograph twice
and deletes no file at all*); and two in `steps.test.ts`.

**Removed: one, and it was rewritten rather than deleted.** *prices nothing for
images when no slot will ever be planned* asserted the retired reading against
`test-2`, which is not a reel whose planner planned none but one whose planner
never finished. It is now *prices nothing for images when the slot planner ran
and planned none* and builds the state it means to check, restoring the plan
byte-identically afterwards; the state `test-2` is really in has a test of its
own, *prices the pictures for a reel whose slot planner never finished*.

The suite counts move by more than the names: panel 446 → 452 is +2 names and +4
rows in the enumeration's two `it.each` tables (two new states × two scenarios).
Service 1617 → 1630 is +14 −1. Both numbers are given because either alone
misleads.

**Five panel runs**, each exit 0, 452 passed + 2 skipped:

```
run 1  exit 0   452 passed | 2 skipped   419.55s
run 2  exit 0   452 passed | 2 skipped   350.28s
run 3  exit 0   452 passed | 2 skipped   351.02s
run 4  exit 0   452 passed | 2 skipped   359.90s
run 5  exit 0   452 passed | 2 skipped   366.40s
```

Runs 2 to 5 sit in a 16 s band. Run 1 is 60 s longer than the rest and that is
the browsers warming, not a flake — it was the first of the day on a machine that
had just finished the gate.

**The suite's time moved again**, and it is the enumeration: session 112 took it
from ~200 s to ~330 s adding twelve states, and the two added here take it to
~420 s. Each new state presses every control in it twice against an answer
deliberately held for three seconds. It is slower and it is not flakier.

**An interruption worth recording.** The first attempt at these five runs lost
runs 3, 4 and 5 to the external drive unmounting and remounting under them —
`EACCES mkdir '/Volumes/T7 Shield'`, then `uv_cwd`. Runs 1 and 2 had already
finished clean. The ledger, `templates/library.aep`, the working tree and the git
history were all unchanged afterwards, and the three were run again. It is
reported rather than quietly re-run because it is the first time this project has
watched the drive go away during work, and §6 says so.

**Bundle.** `npm run panel:build` → `panel/dist/panel.js`, **273,188
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
| `.local/` directories | 17 | **17** |
| `.local/queues/` — kept forever, never scratch | 4 files, 16K | **4 files, 16K** |
| queue record hashes | `adc83ff9114a0df1 bf3048ffe8ee6e81 f27f98aec8bea681 c8401e0f784fa4f2` | **the same four** |
| `assets/client-pictures/` | 24 files, 35M | **24 files, 35M** |
| his 22 photographs | — | **byte-identical, dimensions identical** |
| After Effects | 1, pid 89430 | **1, pid 89430** |
| `aerender` | 0 | **0** |
| a Framopia service listening | none | **none** |
| extensions folder | one symlink | **one symlink, unchanged** |

The 24 files in the picture store are his 22, session 108's leftover crop and a
`.DS_Store`. **No After Effects was launched or quit and no project was saved**;
the one running instance is the one that was already there, with the same pid at
both ends. **No service was started or stopped** — there was none listening at
either end, because Mohamed's panel is closed, and this session had no need of
one: everything measured runs in-process.

The working tree at the end holds `modes/dr-loubna-kfafi.json` modified, his
seven untracked photographs and `assets/client-pictures/k2-syndicalia/` — all of
them there before this session started. Nothing else.

---

## 10. Money

**No ledger line was added.** Expected none, spent $0.00.

- 294 records at the start, sha256 `77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0`.
- 294 records at the end, the same sha256.
- `npm run golden` read the ledger itself and printed `294 lines, 77eaf6c9ca6b633e`.
- The harness that produced every figure in §1 writes to a temporary ledger, and
  asserts at the end of its own run that it wrote nothing to it.
- Nothing in this session could reach a paid API: every stage is injected, the
  image client is a fake, and `what-a-failure-costs.test.ts` replaces `fetch` with
  a recorder that throws and asserts the recording is empty when it finishes.
