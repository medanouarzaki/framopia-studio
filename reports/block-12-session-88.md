Status: OK

# Block 12, session 88 — the gate runs a video the tool has never seen

## 1. The four defects, and why no test caught them

| defect | the suite that should have caught it | what it asserts instead |
|---|---|---|
| **84** — every stage resolved a label against the benchmark catalogue, so a video picked from a client's folder was refused by name | `pipeline.test.ts` | It runs the pipeline on **`vitasilk`**, which is in `benchmarks/footage.json`, so the lookup always succeeded. Its one unknown-label case, `'nope'`, asserts that resolution **fails** — the opposite of the thing that broke. |
| **85** — the client's picture labels never reached the transcriber | `pipeline.test.ts` | Its `fakeStages()` makes `transcribe`, `keywords`, `slots` and `images` **throw if they are called**. Nothing has ever looked at what a stage is handed, so `keyterms` could be absent and no assertion could tell. |
| **86** — a picture the client's own store answers spent from the budget that limits what is bought | `slot-select.test.ts` | Its `mode()` fixture has **no `pictures` key at all**, so `answeredFree` was always empty and the free/paid distinction never arose in any case it ran. |
| **87** — the spacing floor compared word spans while its purpose was about screen time | `slot-select.test.ts` | It asserted the old rule directly — `rejects a slot closer than the minimum gap` — so it **encoded the defect** rather than catching it. Its fixture words are a second apart, so a pair 0.08 s apart never occurred. |

**What every fixture has in common.** The reel is always one of the seven the tool
already knows — `vitasilk` appears **134 times** across the run-path suites,
`test-3` 22, `test 1` 16, `test 2` 15, `test-1` 13, `ground-truth` 12, `ground
truth` 11 — each with an entry in the corpus catalogue, a plan already beside it,
and a hash already in the cache. The stages, where they are exercised at all, are
stubs that refuse to run.

## 2. The gap, in one sentence

**Every test on the run path is handed a reel the tool already knows and stages
that never run, so nothing has ever asserted what the panel's own route does with
a video it has never seen, or what it hands the stages when it gets there.**

## 3. How a stranger is made

`service/src/a-stranger.test.ts` builds one at run time:

- **A real video**, 2160×3840 upright — the only shape this tool builds, and it
  refuses others by name, which is how the first draft of this test found out.
- **A hash that has never existed.** Its metadata carries
  `process.hrtime.bigint()`, so every run produces a different file and no cache
  anywhere can hold an answer for it.
- **A client nothing has heard of**, in a scratch modes directory, whose
  `videoFolder` is a scratch folder, with one picture labelled for a word the
  reel actually says.
- **In no catalogue**: not in `benchmarks/footage.json`, not in the video
  registry, and with no plan.

It takes **the panel's route, in the panel's order**: `listVideosFor` offers it →
`findReelByLabel` resolves it → `dryRun` prices it → `stepsFor` refuses the rest
by name → `runPipeline` runs it. Not one inner function called directly.

It **does not skip**. ffmpeg is in `MACHINE_REQUIREMENTS` and the gate already
refuses a machine without it; if it is missing, this throws and the gate goes red
rather than quietly excusing the one test that runs a stranger.

## 4. Four reds

**Defect 1 — the corpus catalogue is the resolver again** (session 84):

```
 × resolves to the file the picker offered, not to a catalogue entry
   → expected undefined to be '/var/folders/41/m_f6_p9963xfw686dqq3n…'
 × is priced without an edit plan, and reaches the stages that would bill
   → there is no video called "September/Exports/a stranger" any more. Pick it again from the list.
 × offers its first step and refuses the rest, by name
   → there is no video called "September/Exports/a stranger" any more. Pick it again from the list.
 × hands the transcriber the words this client has labelled
   → there is no video called "September/Exports/a stranger" any more. Pick it again from the list.
 × does not spend the picture budget on a picture the client already answered
   → there is no video called "September/Exports/a stranger" any more. Pick it again from the list.
 × gives every picture longer than its entrance before the next replaces it
   → there is no video called "September/Exports/a stranger" any more. Pick it again from the list.
```

**Defect 2 — the client's labels never reach the transcriber** (session 85):

```
 × hands the transcriber the words this client has labelled
   → the given combination of arguments (undefined and string) is invalid for this assertion.
   Tests  1 failed | 6 passed (7)
```

**Defect 3 — a free picture spends the paid budget** (session 86):

```
 × does not spend the picture budget on a picture the client already answered
   → expected 0 to be greater than or equal to 1
 × gives every picture longer than its entrance before the next replaces it
   → expected 1 to be greater than or equal to 2
   Tests  2 failed | 5 passed (7)
```

**Defect 4 — the floor measures word spans again** (session 87):

```
 × does not spend the picture budget on a picture the client already answered
   → expected 0 to be greater than or equal to 1
 × gives every picture longer than its entrance before the next replaces it
   → expected 1 to be greater than or equal to 2
   Tests  2 failed | 5 passed (7)
```

**Four of four**, each restored from a saved byte copy afterwards and each
verified green again.

**Defect 4 did not catch on the first attempt, and that is worth recording.** My
first two recorded ideas sat far apart in the recording, so the old word-span
floor never bit and the test stayed green with the defect restored. The fixture
now picks **the word before the labelled one**: in the recording those two are
**0.08 s apart as spans and 0.74 s apart as starts** — exactly the shape of
Mohamed's sentences — and the test asserts that shape before using it, so it
keeps meaning what it says if the recording is ever replaced.

## 5. Where the money would have been

Four calls cost money: Scribe, the Gemini correction, the Gemini slot analysis
and the image model. **Each is replaced at its own boundary and nothing above it
is:**

| replaced | what still runs for real |
|---|---|
| `runHybrid` — the Scribe and correction calls | the hash, the probe, the audio extraction, `transcribeHybridCached`'s cache logic, the alignment, and the plan written **and validated** |
| `runAnalysis` — the slot call | `planSlotsCached`, `planSlots`, the budget, the pacing floor, the client-picture match, template assignment and sfx |

The image model is not reached: the test stops at planning.

**What that substitution stops this proving.** It cannot see a real model's
answer. It cannot tell whether a transcript is right, whether handing over a
keyterm actually changed what was heard, whether an idea is any good, or whether
a generated picture is usable. **Session 85's defect would have been caught here
as "the labels were not passed" — not as "Planiti came back as Lanluma."** The
first is a wiring fact and this test owns it; the second needs money and a
person's ear, and this test claims nothing about it.

## 6. What this still cannot catch

- **Anything that depends on a model's real answer** — transcription accuracy,
  whether a keyterm changed a word, whether an idea is worth a picture, whether a
  picture is usable. The recording is the same every time.
- **Anything about how the composition looks.** It stops at the plan: no comp is
  built, so nothing here sees a card that does not fit, a picture over the
  speaker, a colour, or the pacing as a viewer experiences it.
- **Anything about a second client, or two clients interfering.** One scratch
  client, one reel.
- **Anything about the panel's own code.** It drives the service the way the
  panel does; it does not run the panel.
- **Anything about a reel long enough for the counts to bind.** The stranger is
  1.5 s with a 25.7 s recorded transcript, which is a mismatch chosen for speed;
  the density budget and the window arithmetic are exercised by their own unit
  tests, not by this.
- **Cost.** It asserts nothing about what a run would charge, because it charges
  nothing.

## 7. The stranger proved unknown

Three checks, all inside the file so they run on every gate:

- **In no corpus catalogue** — asserted by label, by the bare filename, and by
  comparing its path against every reel in `benchmarks/footage.json`.
- **In no video registry** — `knownVideos()` does not contain its path.
- **No cache holds its hash** — checked in both the real `.local/cache` and the
  scratch root.

**Run in isolation**, with nothing else having run: `Tests 10 passed (10)` in
1.21 s.

**Proved it notices a reel that is known.** Its label was added to
`benchmarks/footage.json` and the file went red by name:

```
 × the stranger is really a stranger > is in no corpus catalogue, by label or by path
   → expected [ 'test-1', 'test-2', 'test-3', …(3) ] to not include 'September/Exports/a stranger'
 × resolves to the file the picker offered, not to a catalogue entry
   → expected '/tmp/a stranger.mov' to be '/var/folders/41/m_f6_p9963xfw686dqq3n…'
 × is priced without an edit plan, and reaches the stages that would bill
   → September/Exports/a stranger is catalogued but /tmp/a stranger.mov is not on this machine
```

The second line is the defect itself showing through: with an entry present, the
resolver returns the **catalogue's** path instead of the file the picker offered.
`benchmarks/footage.json` was restored to `f9bc8308f11f1e01`, byte-identical.

**One thing the test was doing wrong, found by measuring.** It wrote a cache
entry and an extracted audio file into the **real** `.local/` on every run — 13
of each accumulated while building it. Everything it makes now lives in its own
directory. The 13 were removed by name and the real cache is untouched: **212
files across 8 video hashes, exactly the session-start figures.**

## 8. Gates, and part 0 at both ends

| gate | result |
|---|---|
| `npm run golden` | **PASS** — 4 of 4, **17,174 fields**, unmoved |
| `npm run check` | **exit 0**, run alone, after committing, **995 s** |
| panel suite ×5 | exit **0, 0, 0, 0, 0** — 285 passed + 2 skipped |

| package | session 87 | now | difference |
|---|---|---|---|
| core | 847 / 0 / 847 | 847 / 0 / 847 | — |
| service | 1493 / 0 / 1493 | **1503** / 0 / 1503 | **+10** |
| benchmarks | 173 / 0 / 173 | 173 / 0 / 173 | — |
| panel | 285 / 2 / 287 | 285 / 2 / 287 | — |
| tools/cv (pytest) | 149 | 149 | — |

The ten, all in `a-stranger.test.ts`: `is in no corpus catalogue, by label or by
path`; `is in no video registry`; `has a hash nothing has ever seen`; `is offered
by the picker, from the client's own folder`; `resolves to the file the picker
offered, not to a catalogue entry`; `is priced without an edit plan, and reaches
the stages that would bill`; `offers its first step and refuses the rest, by
name`; `hands the transcriber the words this client has labelled`; `does not
spend the picture budget on a picture the client already answered`; `gives every
picture longer than its entrance before the next replaces it`.

**How much longer the gate takes: 2,414 ms**, measured from the gate's own output
(`✓ src/a-stranger.test.ts (10 tests) 2414ms`) against a total of 995 s — about
a quarter of one percent. Run alone the file takes 1.21 s; the difference is
contention with the parallel suites.

### Part 0, at both ends

| measurement | start | end |
|---|---|---|
| ledger | 197 records, `772c955cab1a14b6`, $22.809072 | **identical** |
| `templates/library.aep` | `4b0cf05a8f5d4775c03e…` | `4b0cf05a8f5d4775c03e…` |
| `modes/dr-loubna-kfafi.json` | `97ece86d34ae284c`, Sep 11 01:19:45 | unchanged |
| `modes/k2-syndicalia.json` | `572e99bf890ceefb`, Sep 9 21:58:19 | unchanged |
| `assets/client-pictures/` | 15 files, 27,390,712 bytes | unchanged |
| services | pid 21020, is the handshake pid | identical, untouched |
| After Effects | 1 instance, 0 `aerender` | 1 instance, 0 `aerender` |
| extensions folder | one symlink, Aug 27 19:06:47 | unchanged |
| working tree | his 15th picture uncommitted | clean |
| `origin/main..main` | 0 | 0 |

`.local/` identical at both ends: audio 28 · bench-audio 5 · build 76 · cache 212
· cv 2348 · deleted-clients 0 · doctor 1 · evidence 3 · ground-truth 10 · plans
84 · quarantine-session51 363 · quarantine-session53 139 · quarantine-session54 1
· quarantine-session69 3 · quarantine-session71 0 · transcripts 1.

**The brief said 195 records; there are 197.** The total, $22.809072, matches the
brief exactly, so the content is precisely what session 87 left and only the
count was two low.

**Mohamed added a fifteenth picture** before this session, labelled `pluryal`,
and edited her client file. It was committed as found — a product mockup like the
other fourteen, looked at before it was pushed — and it answers session 87's loss:
Pluryal will now be answered from his own store instead of bought.

## 9. Ledger lines added

**None.** 197 records at the start, 197 at the end, `772c955cab1a14b6` at both,
total $22.809072 unchanged. Expected spend $0.00, actual $0.00, against a $0.50
ceiling that was never approached. **Nothing in this session called a paid API**;
the two that would have been are replaced by a recording that was already in
`service/fixtures/`.

## What is open

- **The gate now catches the four shapes we know about, and §6 is the list of
  what it does not.** A green stranger test is not a working tool, and the
  largest thing it cannot see is whether a model's real answer is any good.
- **The stranger is 1.5 s with a 25.7 s transcript**, chosen so the gate stays
  fast. A reel long enough for the density budget to bind would test more, and
  would cost seconds on every gate run.
- **`extractAudio` prints ffmpeg's banner and progress into the gate log.** Noise,
  not a failure, and not introduced here — but this test made it visible on every
  run.
- A stage that threw is still marked `done` (session 84); the too-deep folder
  warning knows only footage already made into a reel (80); a machine that cannot
  bind loopback starts unguarded (79); the sidecar's abort is unproven-fixed (78).
