Status: OK

# Block 13, session 94 — a queue that runs while he is away

## 1. Where the twenty minutes goes

Every plan records `completedAt` per stage, so the durations below are differences
between what the runs themselves wrote — not a stopwatch held afterwards.

**Nothing records how long transcription takes.** `meta.createdAt` is written when
the transcript lands, so it equals the transcription stage's own end and the
stage's duration is unrecoverable from the plan. It is the one gap, and the
figures below start from the transcript.

| stage | `sora-4` (22.5 s reel) | `sora-5` (30.7 s reel) | `sora-3` (27.7 s reel) |
|---|---|---|---|
| analysis | 88.5 s | 96.2 s | 118.8 s |
| **images** | **1365.0 s** | **1369.8 s** | **2222.7 s** |
| zones (the face masks) | 93.0 s | 71.9 s | 52.3 s |
| **total** | **25.8 min** | **25.6 min** | **39.9 min** |

**The image stage is 88% of it**, and it is not one thing. Taking `sora-4` apart
by its own ledger timestamps:

| | seconds | what it is |
|---|---|---|
| before the first image is billed | 299.2 | starting up, planning, reading the cache |
| first bill to last bill | 385.3 | **the network** — 12 images, a median 21.8 s apart |
| after the last bill | 680.5 | **his own Mac** — cutouts, the gate, the text reading |

`sora-5` is the same shape: 344.1 s, 317.9 s, 707.8 s.

**Waiting on a network:** the analysis, and the ~6 minutes of generation inside
the image stage. **His own Mac working:** the cutouts and gate (~11 minutes) and
the face masks (~1.5 minutes) — so **more of the wait is his own CPU than is the
network**, which is why buying a faster connection would not help and why running
two at once would fight itself.

### How much of it is him

**Essentially none of it.** Across the 25.8 minutes of `sora-4` he does three
things: picks the video and client, presses *Make the subtitles*, and later
presses *Make the pictures*. Call it thirty seconds, plus however long he chooses
to spend reading the transcript — which is judgement, not waiting, and the queue
neither saves nor removes it.

**So the queue buys back about 25 minutes per video of pure sitting.** Five
videos is a little over two hours.

## 2. What Google's cap means for a queue of five

Measured from the ledger, by sliding a real 10-minute window over every Gemini
line this project has ever written:

| | |
|---|---|
| Gemini lines all time | 240, $32.8193 |
| **worst real 10-minute window ever** | **$3.3690** |
| Tier 1 cap | $10.00 |
| headroom | **3.0×** |

Per video, at today's prices: `sora-3` $2.5628 of Google, `sora-4` $2.1973,
`sora-5` $2.8158 — ElevenLabs is under a fifth of a cent each.

**The cap is not a constraint on a serial queue, and the arithmetic says why.** A
video spends its Google money in a burst of about six minutes and then spends
nineteen minutes on local CV work paying nothing. Run one at a time, the busiest
ten minutes the queue can produce is roughly one video's image stage — about
$2.40, against a $10 ceiling. Five videos is about $12.65 in total but it is
spread over two hours, so **the cap is never approached.**

It would matter immediately if videos ran *simultaneously*: four at once puts four
image bursts in the same window, which is $9.60 and one retry away from being
refused. That is a second reason the answer here is a queue.

## 3. The queue

**What it runs:** `QUEUE_STAGE_IDS` is transcription, analysis, images, zones —
everything that costs money or takes time. **It does not build**, by his ruling;
building is free, takes three seconds, and is where he looks at what was made.

**One at a time, in order.** Nothing here runs two videos at once, deliberately.

**A video that fails does not stop the queue.** It is recorded with the stage and
the cause, the next one starts, and the failure is in the summary at the end. It
is never recorded as `done` — Block 12 session 91 is the near miss this guards,
where a stage failed while the run reported success.

**On a network error:** `asStageError` already decides what is worth repeating,
so the queue reuses that judgement rather than inventing a second one.
`fetch failed` — which `sora-4` hit on 2026-09-12 — is retryable and gets
**exactly one more attempt**, `QUEUE_ATTEMPTS = 2`. A ceiling refusal or a missing
file is **not retried at all**, because repeating it cannot help. The caller sees
`attempts`, and the summary says which kind it was.

**On stop:** he can stop it, and the flag is read *between* videos. It finishes
the video it is holding rather than abandoning a stage that has already been paid
for; everything bought is kept, and everything after is marked not started.

**On the panel closing:** the queue is a job in the companion service —
ARCHITECTURE §4, the same route a single video takes — so closing the panel,
closing After Effects, or the panel crashing leaves it running, and the results
are waiting when he opens it again.

**What it does not survive is the service stopping** — a restart, a logout, a Mac
that sleeps deeply. Jobs are held in memory, as every job in this tool is. **A
queue of five is two hours and a sleeping Mac loses the rest of it.** What is
already paid for is not lost: every stage writes what it bought onto the plan as
it finishes, and a re-run reads it back from the cache for nothing. **So a lost
queue costs time, not money** — which is acceptable, and is stated here rather
than discovered.

**Money.** It quotes the whole list before it starts, from the same per-video
estimate the single-video screen uses, and reports the running total as it goes.
`IMAGE_SLOTS_PER_30S` and the monthly cap still apply per video, untouched.

### Proved by mutation — five, each restored

```
### M1 — a failure stops the queue
   × a video that fails > does not stop the queue
     → ENOENT: no such file or directory, open nowhere
   × a video that fails > is reported as failed, and never as done
     → ENOENT: no such file or directory, open nowhere

### M2 — a failed video reported as done (session 91's defect)
   × a video that fails > does not stop the queue
     → expected [ 'done', 'done', 'done' ] to deeply equal [ 'done', 'failed', 'done' ]
   × a video that fails > is reported as failed, and never as done
     → expected 'done' to be 'failed' // Object.is equality

### M3 — retries unbounded
   × a network error > is tried again, and bounded
     → expected 99 to be 2 // Object.is equality

### M4 — stop ignored
   × stopping the queue > stops at the next video, and keeps what has been paid for
     → expected [ 'done', 'done', 'done' ] to deeply equal [ 'done', 'stopped', 'not-reached' ]
   × stopping the queue > stops before spending anything when stopped at once
     → expected "spy" to not be called at all, but actually been called 2 times

### M5 — the queue builds
   × what the queue runs > does not build
     → expected [ 'transcription', 'analysis', …(3) ] to not include 'build'
```

Restored after each; 25 of 25 green.

## 4. What the panel says when he comes back

The sentences are the service's, because whether a failure is worth trying again
is something only the run knows and a second copy of that judgement in a React
bundle is a second place for it to drift.

From the real run in section 5, verbatim:

> **2 videos are ready to build. 1 did not finish.**
>
> - `test` — Ready to build.
> - `a video that is not on this machine` — *[needs you]* Did not finish, and
>   trying it again would fail the same way. Nothing you have already paid for is
>   lost. It said: there is no video called "a video that is not on this machine"
>   any more. Pick it again from the list.
> - `sora-3` — Ready to build.
>
> **It cost $2.20 altogether.**

A connection failure reads differently, because it is a different problem:

> Did not finish — the connection failed, and it was tried 2 times. Nothing was
> lost. Add it to a queue again when you are back online. It said: fetch failed

While it runs it says which video it is on, what has been spent so far, *"You can
close this and come back — it keeps going"*, and offers **Stop after this video**.

**No command, no terminal.** Asserted directly — every sentence the summary can
produce is matched against `/npm run|terminal|quit|restart|reopen|relaunch/i` —
and `leave-the-panel.test.ts`, which reads the whole service since session 91,
passes.

The pane sits under a new heading, **Make several videos**, between *Cost* and
*Change something first*: he picks a client, picks a video, sees what one costs,
and only then is "and four more like it" a question he can ask. **The build step
is untouched.**

## 5. The real queue run

Three videos through the registered job runner — the same code the panel's
`POST /jobs` invokes. I drove it in this process rather than posting into
Mohamed's running service, because his service was live and a queue posted into it
would interleave with his own work.

**Quoted before: $2.5208.** **Actual after: $2.199824.** Wall clock 795.7 s.

| video | time | cost | outcome | needs him |
|---|---|---|---|---|
| `test` (21.2 s, never processed) | **791.6 s** | **$2.1998** | done | no |
| `a video that is not on this machine` | 0.0 s | $0.0000 | **failed**, not retryable | yes |
| `sora-3` (already paid for) | 3.9 s | **$0.0000** | done | no |

**The queue carried on past the failure** and finished the third video — which is
the whole point, and it is the shape the stranger test now pins.

**`sora-3` cost nothing**, which is sessions 86 and 92 holding: everything it
needed was already bought and came back from the cache.

**What `test` produced:** a 21.2 s reel for Dr Loubna — 56 subtitle cards, 3
keywords, 6 images, 6 sfx events, 23 zones, all four stages `done`, and
`build: pending`. **It stopped before building, exactly as ruled.**

### A limit the run found, which is the guard working

An earlier queue included `sora-5` and it **refused**:

> re-generating would discard editor work on 8 slot(s): img002 (a candidate was
> chosen (img002-c2)); … Re-run with --force to discard it.

Mohamed had chosen candidates on eight of its slots. The refusal is right — a
queue must never quietly discard his choices — but it means **the queue is for
videos that have not been curated yet**, and re-queueing one he has worked on will
stop rather than overwrite. That is the safe direction to fail in, and it is
listed as open because the message he sees is the raw guard text rather than a
sentence written for him.

## 6. What he does next

He opens the panel, sees *2 videos are ready to build*, picks each one and presses
**Build the composition**, exactly as he does today.

## 7. The stranger test

Added to session 88's stranger, which costs nothing: a queue of two where the
first fails still finishes the second and reports the first as failed. The money
boundary is `runOne`, which is injected, so the ordering, the outcomes, the retry
bound and the summary he reads are all the shipped code.

**Red, with the queue made to stop on the first failure:**

```
   × a queue the stranger is in > finishes the second video when the first fails, and says which failed
     → ENOENT: no such file or directory
```

Restored: 17 of 17 green.

## 8. Gates

`npm run check`, **run alone, after committing: exit 0, `check: PASS`.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | 1575 | 0 | 1575 |
| benchmarks | 173 | 0 | 173 |
| panel | 288 | 2 | 290 |
| pytest (CV sidecar) | 149 | 0 | 149 |

Measured from the passing run, not carried.

**Arithmetic by name: 26 tests added, 0 removed.** Service 1549 → 1575 is +26;
panel 290 total is unchanged, its one new assertion being an edit to the existing
headings test rather than a new case.

| file | added |
|---|---|
| `queue.test.ts` | **25** — the whole file: what the queue runs (2), a queue of videos (3), a video that fails (4), a network error (3), stopping (3), what it reports while running (3), what he comes back to (7) |
| `a-stranger.test.ts` | 1 — a queue the stranger is in |

`npm run golden`: **PASS, 4 of 4 reels matched, field for field.** 4415 + 4280 +
3709 + 4770 = **17,174**.

**Panel suite: exit 0, 0, 1, 0, 0 — then six more at 0, 0, 0, 0, 0, 0.** The one
failure is reported rather than smoothed over: its output was discarded by the
loop that ran it, so **I cannot say which test failed**, and six captured runs
afterwards reproduced nothing. It is recorded as an unexplained single failure,
not as a pass.

### Part 0, at both ends

| measurement | at start | at end |
|---|---|---|
| ledger records | 278 | **294** |
| ledger sha256 | `0383df9f…cbf0cdef` | **`77eaf6c9…6c1a84d0`** |
| `templates/library.aep` | `4b0cf05a…eca6c22aba` | unchanged |
| `modes/dr-loubna-kfafi.json` | `f2fa926e…`, 2026-09-12T20:52:03 | unchanged |
| `modes/k2-syndicalia.json` | `572e99bf…`, 2026-09-09T21:58:19 | unchanged |
| `.local/` directories | 16 | 16 |
| `assets/client-pictures/` | 22 files, 36M | 22 files, 36M |
| CEP extensions | `com.framopia.studio` | `com.framopia.studio` |
| After Effects | 1 | 1, never launched or quit |
| `aerender` | 0 | 0 |
| listening service | pid 27950 | pid 27950, never stopped |
| `origin/main..main` | 0 | 0 after push |

**The working tree carries seven photographs and a client-file edit that are
Mohamed's, not mine.** `pic016` to `pic022` and `modes/dr-loubna-kfafi.json`
were added through the panel between sessions; his file names 22 pictures where
the repository holds 15. **They are left exactly as found** — every commit this
session named its paths explicitly and none of them named his.

## 9. Every ledger line added

**16 lines, $2.199824, against a $5.00 ceiling and a $3.00 expectation.** All one
video, `d1af55aa7b037db4` — the `test` clip the queue processed.

```
{"stage":"transcribe-scribe","model":"scribe_v2","unit":"run","usd":0.00155377442,"video":"d1af55aa7b037db45b9a8be2d29ce0bb28049b101df98a1083b05433bf4e6168","purpose":"client-work","timestamp":"2026-09-13T14:59:05.844Z"}
{"stage":"transcribe-gemini-correction","model":"gemini-3.1-pro-preview","unit":"run","usd":0.15701,"video":"d1af55aa7b037db45b9a8be2d29ce0bb28049b101df98a1083b05433bf4e6168","purpose":"client-work","timestamp":"2026-09-13T14:59:05.844Z"}
{"stage":"analysis-keywords","model":"gemini-3.1-pro-preview","unit":"run","usd":0.121964,"client":"dr-loubna-kfafi","video":"d1af55aa7b037db45b9a8be2d29ce0bb28049b101df98a1083b05433bf4e6168","purpose":"client-work","timestamp":"2026-09-13T15:00:19.353Z"}
{"stage":"analysis-slots","model":"gemini-3.1-pro-preview","unit":"run","usd":0.078688,"client":"dr-loubna-kfafi","video":"d1af55aa7b037db45b9a8be2d29ce0bb28049b101df98a1083b05433bf4e6168","purpose":"client-work","timestamp":"2026-09-13T15:01:06.220Z"}
```

…followed by twelve `images-generate` lines for the same video, between
`15:01:28.533Z` and `15:05:26.793Z`, of $0.149362 to $0.159192 each, totalling
$1.840408. Every line carries `"purpose":"client-work"` and the same video.

**Nothing else billed.** The first queue run — four videos, all already paid for —
quoted $0.0000, spent $0.0000, and left the ledger at 278 lines with its sha256
unchanged, which is sessions 86 and 92 holding under a queue.

## What is open

- **A queue re-run refuses a video he has curated** (section 5), correctly, but
  shows him the raw guard text. It needs a sentence written for him.
- **Nothing records how long transcription takes** (section 1). Every other stage
  is derivable from the plan; that one is not.
- **A queue does not survive the service stopping.** It costs time, not money, and
  is stated in the code rather than fixed.
- **One unexplained panel failure** (section 8), not reproduced in six captured
  runs afterwards.
- **The queue runs one video at a time and nothing here changes that**, by his
  ruling. Running two at once is a much larger change and would meet the Google
  cap immediately (section 2).
- Everything carried from session 93 that this session did not touch.
