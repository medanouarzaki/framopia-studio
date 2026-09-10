Status: OK

# Block 12, session 84 — a video this tool has never seen, built

## 1. Where the corpus catalogue stood in for the real world

The line Mohamed hit is `service/src/dry-run.ts:232`, and it is one of **six
identical ones**:

| file | what it did |
|---|---|
| `dry-run.ts` | `listReels().find((r) => r.label === reelLabel)` |
| `steps.ts` | the same |
| `pipeline.ts` | the same |
| `transcript-view.ts` | the same |
| `keyword-view.ts` | the same |
| `image-view.ts` | the same |

Each wanted the video's path, its duration and whether a plan exists — and each
asked `listReels()`, which is **the five corpus reels plus whatever has been
opened through Browse**. Measured on this machine:

- the picker offers Dr Loubna Kfafi **25** labels, read from her folder;
- `listReels()` knows **7** — `test-1`, `test-2`, `test-3`, `ground-truth`,
  `vitasilk`, `sora`, `Footages/sora`;
- **the 7 are not a subset of the 25.** `September Content/Exports/Work in
  Progress/sora-1` is offered and not resolvable.

`frames/footage.ts` states the root cause in its own words: the corpus catalogue
lives in `benchmarks/` and *"it is the only list of the footage that exists"*.
That was true when it was written.

**There is a second face**, and it is the same defect: `dry-run.ts` reads a
video's sha256 and duration from `.local/videos.json`, **which only Browse
writes**. A video picked from a folder has no entry, so even once the label
resolved it threw `has no edit plan yet, so nothing can be looked up in the cache
by video hash` — telling him about an edit plan he had no way to have made.

**A third face turned up only by running his reel**, and it is reported in §4.

`videoByLabel` — the corpus-only identity lookup — is used by one test and
nothing on the run path, so it is not a seventh face.

## 2. The fix, and where a new video gets each thing instead

One resolver, `findReelByLabel(label)` in `catalogue.ts`, searches **the places
the picker offers from, cheapest first**: the corpus and the registry (two file
reads), then each client's declared folder (a walk, bounded by session 81's two
seconds). It takes **no client id** deliberately — `/transcript`, `/keywords`
and `/images` are asked for by label alone, so a resolver that needed one would
have fixed the stage he happened to hit and left three behind.

| what a run needs | where a corpus reel got it | where his video gets it |
|---|---|---|
| the file's path | `benchmarks/footage.json` | the client's declared folder, walked |
| its sha256 and duration | the plan, or the Browse registry | measured off the file on first pricing |
| its plan | beside the video in the corpus dir | `.local/plans/`, keyed on the sha256 |
| its label | the corpus catalogue | the folder it was found in, session 81 |

**Nothing was added to `benchmarks/footage.json`.** It still describes
benchmarks.

A folder video is now **written down the first time it is priced** — the same
`rememberVideo` call Browse makes, reading duration, shape and hash off the file
— so every later stage finds it without walking a folder again. It costs nothing:
ffprobe and a hash, both local.

Measured: his label resolves in **21 ms**, a corpus reel in **3 ms**.

**Red with the corpus dependency put back**, restored from a saved byte copy:

```
 × a video the tool has never seen > resolves anyway, to the file it names
   → expected undefined to be 'Exports/Work in Progress/sora-1'
 × a video the tool has never seen > resolves one several folders deep
   → expected undefined to be '/var/folders/41/m_f6_p9963xfw686dqq3n…'
   Tests  2 failed | 3 passed (5)
```

## 3. The dry run, quoted

Free — the ledger stood at 165 lines before and after.

```
reel:         September Content/Exports/Work in Progress/sora-1
client:       Dr Loubna Kfafi (v1)
estimate:     $1.4354
  words:      $0.3500 (transcription, analysis)
  pictures:   $1.0854
watermark:    true medium
mismatch:     null
```

with the four stages it would run:

> **Transcribe and correct** — no cache entry for fingerprint `f7223549eba265e7`
> (prompt v4, guide v2.0.0) and none compatible; a run would transcribe and bill.
> $0.17
> **Keywords and image slots** — no transcript on the plan yet, so the analysis
> cache cannot be addressed. $0.18
> **Generate images** — no image slots planned yet; a run would plan about 3 for
> a 10.2 s reel and generate 6 candidates, budgeted at most $1.09.
> **Looking at the video** — free, and done on this machine. It can take a few
> minutes the first time for a video.

`mismatch: null` is session 80's rule agreeing: his footage, his client.

## 4. The real build, stage by stage

| attempt | stage | outcome | cost |
|---|---|---|---|
| 1 | transcription | **done** — 10.2 s of audio | $0.081744 |
| 1 | analysis | **failed** — `analysis keywords failed: fetch failed` | $0 |
| 2 | analysis keywords | done | $0.071294 |
| 2 | analysis slots | **failed** — `MultiSubjectIdeaError` | $0.071306 |
| 3 | analysis (redo) | done, keywords from cache, slots re-planned | $0.050634 |
| 3 | images | 1 generated, 2 candidates | $0.327400 |
| 3 | zones | done, free | $0 |
| 4 | build | **done** in 3.6 s | $0 |

**The first failure was the network**, not the tool: `fetch failed` with both
endpoints answering `200`/`404` on a direct probe a minute later. It cost
nothing and did not recur.

**The second was the session's third corpus-fitted defect.** Slot 1 came back as
*"Vials of Sculptra and Lanluma aesthetic treatments"* and `MultiSubjectIdeaError`
stopped the run — as designed; its own comment says *"the planner is what needs
to change, and a rewrite would hide that behind an idea nobody wrote."*

Slot prompt v3 said *a concrete thing beside an abstract one is two subjects*,
and said **nothing about two concrete things**. The five corpus reels name one
thing at a time; a doctor listing the products she uses names two in a breath
constantly. **Version 4** adds one paragraph — one subject means one thing, not a
pair; if she names two products, take the one the picture is about — and the
three ideas came back singular: *a vial of Sculptra*, *a box of Pluryal*, *a
package of Radiesse*. The idea was never rewritten by hand.

**A fourth thing worth recording, not fixed:** when slot analysis threw, the
analysis stage was still marked `done` on the plan with 0 keywords and 0 slots,
and the next run reported "already on the plan" and skipped to a green finish
with nothing to build. It took an explicit `redo` to recover. A stage that threw
should not be marked done.

## 5. What was made, and where the `.aep` is

**`/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/build/sora-1-8bcbfc38-full.aep`**
— 4,041,795 bytes, written 2026-09-10 18:05:45.

- **27 subtitle cards**, and **0 that do not fit** their comp.
- **1 keyword** — ترطيب.
- **3 pictures**, and **2 of them are her own**: session 53's rule fired on real
  data for the first time — `img001 uses the client's own picture pic014 — its
  label holds the spoken word "Sculptra"`, and `img003 uses pic011 — "Radiesse"`.
  Only `img002` was generated, so the picture bill was a third of the estimate.
- **3 sounds**, one whoosh per picture at −13.64 dB.
- The watermark is on.
- **Built in Dr Loubna Kfafi's own colours** — `#1C1210`, `#123448`, `#E8873A`,
  `#FFF4E8` — from her pinned snapshot, not K2 Syndicalia's red. Session 80's
  rule reported no mismatch, correctly.

**One thing I did not verify**, and will not claim: whether every picture is
clear of the speaker at every frame. Eight zones were measured for the whole
10.2 s, but all three slots carry `zoneId: null` and nothing in the build reads
that field. The build's own check stage ran and passed; I did not independently
measure the comp, so the honest answer is that this is unverified rather than
good.

## 6. What the screen shows now

Eleven red lines under the picker — `Loubna current.aep`,
`1-presentative-horizontal auto-save 10.aep` and nine more — saying his own After
Effects projects could not be opened. Measured after the change: **0 lines.**

An editing project is not a video anyone would expect this tool to offer, so
saying so about each one only buried the failure. **Nothing unreadable is
hidden:** a video in a format this tool will not open (`.webm`, `.flv`, `.wmv`,
`.mpg`, `.mts`) is still named, and so are an empty file, a file that could not
be read, and a folder that could not be opened.

## 7. Why the gate went green

**Every suite proves its work against the five corpus reels and the two reels
already built.** `benchmarks/footage.json` is fixture data checked into the
repository, `npm run golden` rebuilds four reels whose plans already exist, and
every service test that needs a reel names one of the seven. Not one of them ever
asks for a video that has never been seen — so the six lookups agreed with the
picker for every input the suites supply, and disagreed for every input Mohamed
could actually produce.

The same shape covers the other two faces. The registry gap could not appear
because every test reel already has a plan carrying its hash. The slot-prompt
hole could not appear because no corpus transcript names two products in a
breath.

**What would have caught it**, in prose, built nothing:

A test that starts from a client whose folder nothing has ever heard of, with one
small video file in it, and drives the same three entry points the panel drives —
`stepsFor`, `dryRun`, and the pipeline — asserting each gets past resolution.
It needs no key and no money for the first two: `stepsFor` and `dryRun` are free
by construction, and the second face would have shown up in `dryRun` alone,
because pricing is where the hash is needed. The pipeline would need its stage
hooks faked, which `pipeline.test.ts` already does. It belongs beside
`new-video-resolves.test.ts`, which this session added for the first face only.

That would not have caught the slot-prompt hole, because that needs a real model
answering about real speech. What would: one paid run of a reel outside the
corpus, deliberately, as a release step — about $0.60 as measured here — or a
fixture transcript that names two products, fed to the same validator, which is
free and would have caught this exact error.

## 8. Every new assertion, red then green

**Five in `service/src/new-video-resolves.test.ts`** — `is not in the list the
run path used to search`; `resolves anyway, to the file it names`; `resolves one
several folders deep`; `still resolves a corpus reel, and does not go looking for
it`; `answers undefined for a label nothing has`. Red verbatim in §2.

**Four in `service/src/clients/videos.test.ts`** — `says nothing about an editing
project sitting beside the footage`; `still names a video in a format this tool
will not open`; `still names a file it could not read, and an empty one`; `still
names a folder it could not open`.

**One added, one renamed in `service/src/pipeline.test.ts`** — `refuses a reel
that is not in the catalogue, by name` became `refuses a video it cannot find, by
name` (it asserted the retired wording), and `does not blame the benchmark
catalogue for a video it cannot find` is new.

**One added in `core/src/ledger-read.test.ts`** — `has not lost the spending
every session before this recorded`.

**Six rewritten, none deleted**, all of which pinned figures true only while no
session spent anything: the ledger total `18.832129` in two files, six reels by
name, every line unattributed, every reel costed from its plan. Each now asserts
the property rather than the day's contents; `lists only the six reels that were
really paid for` became `lists only reels that were really paid for`, and `reads
the real ledger, which knows no video yet` became `costs a reel from the ledger
when the ledger knows it, and from the plan when not`.

**One red that was my own test's fault**: the scratch client's mode file was
written under a name that was not its id, so `loadMode` could not find it. The
fixture was fixed, not the resolver.

## 9. Gates, and part 0 at both ends

| gate | result |
|---|---|
| `npm run golden` | **PASS** — 4 of 4, **17,174 fields** |
| `npm run check` | **exit 0**, run alone, after committing |
| panel suite ×5 | exit **0, 0, 0, 0, 0** — 285 passed + 2 skipped |

| package | session 83 | now | difference |
|---|---|---|---|
| core | 839 / 0 / 839 | **840** / 0 / 840 | **+1** |
| service | 1464 / 0 / 1464 | **1474** / 0 / 1474 | **+10** (5 + 4 + 1) |
| benchmarks | 173 / 0 / 173 | 173 / 0 / 173 | — |
| panel | 285 / 2 / 287 | 285 / 2 / 287 | — |
| tools/cv (pytest) | 149 | 149 | — |

**The first gate run failed**, on six frozen-ledger assertions and the retired
refusal message — all consequences of the tool doing real work — plus
`the image job against the real sidecar` timing out at 240 s. That last one
**passed alone in 51 s**: contention with the parallel suites, not a failure, and
it is not counted as one.

### Part 0, at both ends

| measurement | start | end |
|---|---|---|
| ledger | 165 lines, `786497a5f371d179` | **172 lines, `fd47e5532815df71`** |
| `templates/library.aep` | `4b0cf05a8f5d4775c03e…` | `4b0cf05a8f5d4775c03e…` |
| `modes/dr-loubna-kfafi.json` | `bbda3d30daa1ae3e`, Sep 9 23:22:51 | unchanged |
| `modes/k2-syndicalia.json` | `572e99bf890ceefb`, Sep 9 21:58:19 | unchanged |
| `assets/client-pictures/` | 14 files | 14 files |
| services | pid 32736, is the handshake pid | identical, untouched |
| After Effects | 1 instance, 0 `aerender` | 1 instance, 0 `aerender` |
| extensions folder | one symlink, Aug 27 19:06:47 | unchanged |
| working tree | clean | clean |

`.local/` grew where the work landed: audio 27→28, build 71→74, cache 159→168,
cv 2234→2348, plans 66→70. Everything else unchanged. Neither client file was
written to. `templates/library.aep` did not move. No service Mohamed started was
stopped, and After Effects was neither launched nor quit.

## 10. Every ledger line added, verbatim

```
{"stage":"transcribe-scribe","model":"scribe_v2","unit":"run","usd":0.0006259957611111112,"video":"725db503fc521e738889c57babf2befbc348cf956476a16dc57afbae479e3402","purpose":"client-work","timestamp":"2026-09-10T16:56:41.207Z"}
{"stage":"transcribe-gemini-correction","model":"gemini-3.1-pro-preview","unit":"run","usd":0.081118,"video":"725db503fc521e738889c57babf2befbc348cf956476a16dc57afbae479e3402","purpose":"client-work","timestamp":"2026-09-10T16:56:41.209Z"}
{"stage":"analysis-keywords","model":"gemini-3.1-pro-preview","unit":"run","usd":0.071294,"client":"dr-loubna-kfafi","video":"725db503fc521e738889c57babf2befbc348cf956476a16dc57afbae479e3402","purpose":"client-work","timestamp":"2026-09-10T16:59:19.988Z"}
{"stage":"analysis-slots","model":"gemini-3.1-pro-preview","unit":"run","usd":0.07130600000000001,"client":"dr-loubna-kfafi","video":"725db503fc521e738889c57babf2befbc348cf956476a16dc57afbae479e3402","purpose":"client-work","timestamp":"2026-09-10T17:00:03.613Z"}
{"stage":"analysis-slots","model":"gemini-3.1-pro-preview","unit":"run","usd":0.050634000000000005,"client":"dr-loubna-kfafi","video":"725db503fc521e738889c57babf2befbc348cf956476a16dc57afbae479e3402","purpose":"client-work","timestamp":"2026-09-10T17:03:39.855Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.15907999999999997,"client":"dr-loubna-kfafi","video":"725db503fc521e738889c57babf2befbc348cf956476a16dc57afbae479e3402","purpose":"client-work","timestamp":"2026-09-10T17:04:02.100Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.16832,"client":"dr-loubna-kfafi","video":"725db503fc521e738889c57babf2befbc348cf956476a16dc57afbae479e3402","purpose":"client-work","timestamp":"2026-09-10T17:04:24.669Z"}
```

**Seven lines, $0.602378** — against an expected $2.60 and a ceiling of $3.50.
Under estimate because two of the three pictures came from her own store instead
of the model. `$19.434507 − $18.832129 = $0.602378` reconciles the ledger's new
total against its old one exactly. Ledger 165 → 172,
`786497a5f371d179` → `fd47e5532815df71`.

Two lines are `analysis-slots`, and both were really paid: the first bought the
plan that `MultiSubjectIdeaError` refused, the second the one under prompt v4.
Nothing was billed twice for the same answer — the keyword call was served from
the cache on the third attempt, at $0.

## What is open

- **A stage that threw is marked `done`** with nothing on the plan, and the next
  run skips it and reports success. Found in §4, not fixed.
- **Picture-vs-speaker clearance is unverified** for this reel: zones were
  measured, no slot carries one, and nothing in the build reads the field.
- **No test drives a never-seen video end to end.** §7 says what one would look
  like and what it would cost.
- The too-deep warning still only knows footage already made into a reel
  (session 80); a machine that cannot bind loopback starts unguarded (79); the
  real sidecar's abort is unproven-fixed (78).
