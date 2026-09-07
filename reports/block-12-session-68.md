Status: OK

# Block 12 session 68 — what the ledger can answer, and what it will answer from now on

**Expected spend $0.00. No paid call of any kind, no picture generated, no video
transcribed. The ledger is unmoved at 165 lines and the same sha256 at both
ends — including across a full `npm run check` and a full `npm run golden`.**
Golden did not move: 17,174 fields, 4 of 4. `npm run check` passed whole.

**The headline measurement: 45.1% of the money spent can no longer be attributed
to any client or video, and that share falls every time anything is spent.**

---

## 1. What the 165 lines hold

Six fields, and only six:

| field | lines carrying it |
|---|---|
| `stage` | 165 / 165 |
| `model` | 165 / 165 |
| `unit` | 165 / 165 |
| `usd` | 165 / 165 |
| `timestamp` | 165 / 165 |
| `note` | **15** / 165 |

**Does a line say which client it was for? No.**
**Does a line say which video? No.**

Neither field exists. Fifteen lines carry a free-text `note`, and some of those
name a reel in prose — *"on the recorded ground-truth scribe draft"* — but as
English, not as a field anything can read.

## 2. Which of the six questions history can answer

| question | from the 165 lines |
|---|---|
| total since the beginning | **yes** — $18.832129 |
| per day | **yes** — 7 days, 2026-08-24 to 2026-09-03 |
| per month | **yes** — 2026-08 $16.187847, 2026-09 $2.644282 |
| per stage | **yes** — 14 distinct stages |
| per client | **no** |
| per video | **no** |
| what a single reel cost | **no** |

### How much can be recovered another way, and how fast that is falling

Session 46 produced a per-reel table, and said plainly how: *"The ledger has no
reel field … so a reel's spend has to be recovered from the cache, which is keyed
by the video's own sha256."* The cache manifests carry `costUsd` and `modeId`.

**Re-measured today:**

| | amount | share |
|---|---|---|
| recoverable from `.local/cache/` | **$10.344745** | **54.9%** |
| attributable to nothing | **$8.487384** | **45.1%** |

Session 46 measured 60.9% recoverable. **It has fallen six points**, because the
caches keep a fixed number of entries per video and evict the oldest. Every run
makes the history less answerable than it was.

By client, from the cache: `k2-syndicalia` $8.057525, `dr-loubna-kfafi`
$2.287220. By video: six directories, `sora-995f2d27` $3.754652 the largest.

**A second gap.** Thirteen transcription cache entries carry **no cost field at
all** — only `analysis`, `imageslots` and `images` entries do. So even the cache
route cannot attribute transcription spend, which is $2.205013 of the total.

## 3. The totals

**Per stage**, largest first:

| stage | lines | total |
|---|---:|---:|
| images-generate | 63 | $9.436246 |
| transcribe-gemini-correction | 15 | $2.183756 |
| analysis-keywords | 20 | $1.933828 |
| benchmark-hybrid | 9 | $1.188942 |
| benchmark-gemini | 9 | $1.166072 |
| analysis-slots | 11 | $0.754760 |
| langtagging-v106-gemini | 3 | $0.475914 |
| dialrule-gemini | 3 | $0.439596 |
| langtagging-gemini | 3 | $0.437754 |
| noisefloor-gemini | 3 | $0.418626 |
| promptv2-validation-gemini | 2 | $0.240580 |
| benchmark-gemini-correction | 1 | $0.123540 |
| transcribe-scribe | 15 | $0.021257 |
| benchmark-scribe | 8 | $0.011258 |

**Per model:** `gemini-3-pro-image` $8.590644 · `gemini-3.1-pro-preview`
$6.884814 · `gemini` $1.289612 · `hybrid` $1.188942 · `gemini-3.1-flash-image`
$0.845602 · `scribe_v2` $0.021257 · `scribe` $0.011258.

**First line** 2026-08-24T18:30:24.255Z. **Last line** 2026-09-03T23:49:11.350Z.

**Total $18.832129 — it reconciles with the $18.832129 on record exactly, to the
cent, difference $0.000000.**

### The 65% figure

**The ledger cannot support it, and it was never claimed to.** Session 46
computed it from the cache, as its own report states. Its arithmetic was
$6.006175 corpus + $4.502282 benchmarks = $10.508457, which is 64.5% of the
$16.274417 the ledger held *then*.

Against today's $18.832129 the same $10.508457 is 55.8%, but that comparison is
not sound: $2.56 has been spent since and is not classified. **The honest
statement is that the split was a one-off reconstruction from a cache that has
since evicted 6% more of its evidence, and it cannot be recomputed today.**

## 4. What is now recorded

`CostEntry` gains three optional fields — `client`, `video`, `purpose` — and the
165 existing lines are untouched: never rewritten, never reformatted, never
migrated. A line without them means *unknown*, not zero.

### `appendCost` did not move, and no wrapper was added

Each of the four points of spend already takes an options object, so the video is
one more option on it. The line is still written where the money is spent:

| point of spend | client | video | purpose |
|---|---|---|---|
| `analysis/keywords.ts` | `mode.id` | passed down | derived |
| `analysis/slots.ts` | `mode.id` | passed down | derived |
| `images/generate.ts` | `mode.id` | already in scope | derived |
| `transcription/hybrid.ts` | **not in scope** | passed down | derived |

**Why transcription records no client, measured rather than assumed.** The
pipeline calls the transcription stage with `videoPath`, `cacheRoot` and `log`
and nothing else, and logs *"no plan yet; this reel has never been transcribed"* —
**on a first run the reel is transcribed before any client is attached**, so there
is no client to record and no plan to read one from. The video identifies the
client through the plan afterwards, so no spend is left unattributable.

### How building-versus-client-work is decided

**Derived from which video the money went on**, never set by hand:

- a video in `benchmarks/footage.json` → **building the tool**
- any other video → **the client's work**
- no video at all → **building** (benchmarks and prompt experiments, $4.502282 of
  the existing lines)

The decision lives in one function, `spendPurposeFor` in `core/src/costs.ts`, and
reads the same catalogue the doctor checks the corpus against — so a reel added
to or removed from the corpus changes the answer without anyone remembering to.
Verified against real data: all five corpus reels → building; `sora` → client-work.

### Every new assertion, proved

**A spend site stops saying where the money went:**

```
 FAIL  src/spend-context.test.ts > every point of spend > records which video it was for, and what the spend was for
+   "service/src/analysis/slots.ts: no video",
+   "service/src/analysis/slots.ts: no purpose",
```

**The purpose typed by hand instead of derived:**

```
 FAIL  src/spend-context.test.ts > every point of spend > derives what the spend was for rather than asserting it
+   "service/src/analysis/slots.ts",
```

**A fifth module writes a ledger line:**

```
 FAIL  src/spend-context.test.ts > every point of spend > is the only place in the service that writes a ledger line
+   "service/src/pipeline.ts",
```

**And session 65's guard, re-proved on the thing this session extends** — a
billing call in a test losing its scratch ledger:

```
 FAIL  src/costs.test.ts > the ledger a test writes to > is never the real one, in any workspace
+   "service/src/images/generate.test.ts",
```

All restored byte-identical from saved copies, green re-verified between each.

**A false positive I introduced and fixed.** That guard scanned raw text
including comments, so my own doc comment naming `appendCost` with its bracket
was reported as a billing call. Its sibling test already stripped comments and
`pictures.test.ts` does the same; now it does too. The mutation above was re-run
after the fix to confirm the guard still bites.

## 5. The two measurements

### What was paid for and thrown away — **nothing has been, yet**

| reel | slots | candidates | surplus once chosen |
|---|---:|---:|---:|
| test 1 | 4 | 8 | 4 |
| vitasilk | 5 | 10 | 5 |
| sora-6a60ced1 | 4 | 8 | 4 |
| sora-995f2d27 | 11 | 22 | 11 |
| **total** | **24** | **48** | **24** |

**Every one of the 30 slots across every plan carries `chosenCandidateId = null`.**
No picture has ever been chosen, so nothing has been discarded and the question
has no measured answer.

What can be said: 56 image candidates are still cached at $8.500601, an average
of **$0.151796 each**. If one of each pair is eventually kept, the 24 surplus
candidates represent **$3.6431 — 50% of image spend**. **That is a projection
from an average, not a measurement**, and it is marked as one.

### Estimate against actual — **estimates were never recorded**

The plans carry `costs.totalUsd` and `costs.spentUsd`, which read like an
estimate and an actual. **They are both actuals.** The type's own documentation
says `totalUsd` is *"what the most recent run of each stage cost"* and adds
*"This is not what the reel cost. See `spentUsd`"*, which is the cumulative
actual.

**This corrects a reading I made earlier in the session.** Comparing the two
fields per reel produced a table — vitasilk showing +$1.379786 — that meant
nothing: it was last-run transcription against cumulative images. I found it by
reading the type rather than trusting the field names.

The only estimate the tool computes is `estimateUsd` in `service/src/dry-run.ts`.
It is returned to the panel and **never written to disk**. So no past run has an
estimate to compare against, and estimate-versus-actual begins whenever a session
is asked to record it — this session did not, because recording an estimate
happens at a different moment and place from recording a spend, and doing it
inside a session about the ledger's own fields would have meant guessing at that
design.

## 6. The screen, in prose

Written to `docs/MONEY_SCREEN.md`. No code, no component, no mock. In short:

**The banner** shows total spent — the ledger answers this exactly — and credit
remaining, which **the tool cannot know and must be told**. Nothing in the
repository records a balance; session 46 found the $6.82 and $2.71 in old reports
were read off a billing page, and carrying one forward left a $0.20 gap it could
not explain. So credit is entered and dated, and the banner shows what was
entered, when, and what has been spent since.

**The filters** are day, month, client, video and stage. Day, month and stage
work over the whole history; client and video work from this session forward.

**Cost per second** comes from the plan's duration and `spentUsd` — `sora` at
40.5 s and $3.908683 is $0.0965 a second.

**A cap** sits beside the button, showing the estimate against what is left. It
**warns and never refuses**, the ruled standing.

**It must never** write to the ledger, edit or reformat the 165 lines, hide a
line it does not understand, or attribute an old line to a client by inference.

**For the old lines it cannot show** per-client or per-video totals, and it says
so rather than back-filling from a cache that is still evicting.

## 7. Gates, arithmetic and fingerprints

**`npm run check`: PASS**, exit 0, run with nothing else touching the tree. **No
workspace was built while a gate was in flight.** **`npm run golden`: PASS** —
4415 + 4280 + 3709 + 4770 = **17,174**, field for field.

```
check: counted with 5/5 corpus Edit Plans and 5/5 reels (11.93 GB) on this disk — the suite sizes depend on both, so this signature belongs to this machine, not to the commit
```

| suite | passed | skipped | total | session 67 |
|---|---|---|---|---|
| core | **803** | 0 | **803** | 797 at its commit; 796 as reported |
| service | **1400** | 1 | **1401** | 1397 passed |
| benchmarks | 173 | 0 | 173 | 173 |
| panel | 254 | 2 | 256 | 254 passed |

**+6 in core**, every one in `costs.test.ts`, verified by diffing the full list
of test names before and after rather than by subtracting totals:

1. `a ledger line that says where the money went > carries the client, the video and what the spend was for`
2. `… > writes no field that was not given, so an old line stays an old line`
3. `what a spend was for > calls every reel in the corpus building the tool`
4. `… > calls anything else a client's work`
5. `… > calls a spend with no video at all building the tool`
6. `… > reads the corpus from the catalogue the doctor checks`

The name diff shows those six and nothing else.

**The base is 797, not the 796 session 67 reported, and the reason is worth
recording.** Measured in a detached worktree at session 67's own commit
`5103322`, core is **797**. Session 67 reported 796 because **its gate ran before
it committed**, and `core/src/messages.test.ts` generates its cases from
`git grep` **at `HEAD`** — session 64 built it that way deliberately, so the
count is a property of the commit rather than of the disk.

Session 67's new sentence put `npm run panel:build` into `core/src/build-stamp.ts`.
Measured: at `be60eb2` that phrase appears only in `.test.ts` files, which the
scan excludes; at `5103322` it appears in `build-stamp.ts`, a scanned non-test
file. So committing it created one more generated case.

**A gate run before committing reports the previous commit's generated-case
count.** That is the mechanism working as designed, and it means 797 + 6 = 803
closes exactly.

**+3 in service**, all in the new `service/src/spend-context.test.ts`:

7. `every point of spend > records which video it was for, and what the spend was for`
8. `… > derives what the spend was for rather than asserting it`
9. `… > is the only place in the service that writes a ledger line`

**Five panel runs, each with its exit status:** 254 passed, 2 skipped (256),
exit 0 — five times.

**Part 0, as found at both ends:**

| | at start | at end |
|---|---|---|
| After Effects instances | 1 | 1 |
| `aerender` processes | 0 | 0 |
| **ledger lines** | **165** | **165** |
| **ledger sha256** | **`786497a5f371d179…`** | **`786497a5f371d179…`** |
| `templates/library.aep` | `4b0cf05a8f5d4775…` | `4b0cf05a8f5d4775…` |
| `modes/.gitkeep` | `e3b0c44298fc1c14…` | same |
| `modes/dr-loubna-kfafi.json` | `f60749f5629b2ced…` | same |
| `modes/k2-syndicalia.json` | `c600905c5e36ecbc…` | same |
| `assets/client-pictures/` | 0 files | 0 files |

**The extensions folder, byte-identical**, timestamps included:
`com.framopia.studio -> /Volumes/T7 Shield/INSEA/Projects/framopia-studio/panel`,
Aug 27 19:06.

**Every directory in `.local/`, unchanged at both ends:** `audio` 27 ·
`bench-audio` 5 · `build` 70 · `cache` 159 · `cv` 1759 · `deleted-clients` 0 ·
`doctor` 1 · `evidence` 3 · `ground-truth` 10 · `plans` 49 ·
`quarantine-session51` 363 · `quarantine-session53` 139 ·
`quarantine-session54` 1 · `transcripts` 1.

After Effects was driven only by `npm run golden`, through `DoScript` into the
already-running instance. It was never launched and never quit. No `.aep` was
written and Mohamed's own project was never saved.

## 8. Money

**No ledger lines added.** 165 lines at both ends, byte-identical by sha256, and
the count was re-checked after a full `npm run check` and a full `npm run golden`
as well as at the end. Nothing here could bill: reading a file, adding optional
fields, and a document.
