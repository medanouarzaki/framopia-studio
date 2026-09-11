Status: PROBLEM — the spreading works and is proven, but I spent $0.686980 of the session's $1.289868 on two mistakes of my own: I ran the analysis against the wrong client, and a re-plan re-bought two pictures the reel already owned.

# Block 12, session 90 — spread the pictures across the whole reel

## 1. Is the darkness a long-reel problem, or universal?

**Universal.** Measured on every reel with a plan on this disk, under the code as
it stood at the start of the session. "Dark" is the longest stretch with no
picture on screen, which on a reel whose pictures hold until the next one
arrives is the longest gap between consecutive picture *starts*, or the run from
the last picture to the end.

| reel | length | budget | candidates | pictures | longest dark | share | where |
|---|---|---|---|---|---|---|---|
| `sora` | 40.54 s | 11 | 22 | 9 | **23.24 s** | 57% | from 17.30 s |
| `sora-2` | 23.32 s | 6 | 12 | 7 | **13.30 s** | 57% | from 10.02 s |
| `sora-6a` | 13.51 s | 4 | 8 | 7 | 4.32 s | 32% | from 6.44 s |
| `sora-1` | 10.24 s | 3 | 18 | 8 | 2.40 s | 23% | from 7.84 s |

The two worst are the two longest, but the shape is the same at every length and
it is not about length: it is about **whether the model proposes more good
moments than the reel can afford**. `sora-1` is 10 seconds and had 18 candidates
for a budget of 3. Where the reel can afford everything (`sora-6a`, 8 candidates
for a budget of 4 plus free ones) there is nothing to go wrong and the reel is
evenly covered. So it is not a long-reel defect; long reels simply have more
moments to lose.

What Mohamed saw on `sora-2` — seven pictures, all in the first half, the last
holding 13.30 s — was the budget being spent **front to back**. Selection walked
the reel once in time order and took what it met, so it ran out of money before
it reached its own second half. The five candidates it refused were all in that
second half, at 12.58 s, 13.46 s, 14.90 s, 17.44 s and 18.58 s.

## 2. The spreading, and what "strongest" means

The reel is cut into as many equal stretches as there are pictures to buy, and
each stretch buys at most one. That number is not a new constant — **it is the
budget**, so a reel that can afford six pictures is considered in sixths.
`IMAGE_SLOTS_PER_30S = 8` is untouched: this session did not open `count.ts`.

**"Strongest" is the model's own ranking and nothing else.** `slots.ts` line 143
has asked for it since slot prompt v3: `Return the ${candidateCount} strongest
slots, best first.` So the order the model replies in *is* the ranking, and the
selector now carries each candidate's index in that reply as `rank`. Nothing is
scored here, and no rule is inferred from Mohamed's videos — I looked for one
and did not need one, because the measure already existed and was being thrown
away.

Two things soften the grid so it cannot repeat session 87's defect:

- A stretch whose candidates do not fit **leaves its money unspent rather than
  losing it**, and a second pass spends what is left on the best remaining
  moment anywhere. A reel therefore never buys fewer pictures than it used to.
- A moment the reel has **already paid for wins its stretch outright**, ahead of
  rank. That is not a judgement about the picture — it is the standing rule that
  a picture Mohamed has approved is never bought again.

`rank` is deliberately not written onto the slot: it decides which candidate
wins a stretch and is not part of a picture.

### Proof by mutation

Front-to-back selection restored from `HEAD`, in place, then restored from a
saved copy (never `git checkout`). Three reds, verbatim:

```
   × planSlots > drops the weaker of a crowded pair rather than the whole second half
     → expected [ 'first', 'a second later', …(2) ] to deeply equal [ Array(4) ]
   × where a reel spends its picture budget > puts a picture in each quarter of the reel rather than four in the first
     → expected [ +0, +0, +0, +0 ] to deeply equal [ +0, 1, 2, 3 ]
   × where a reel spends its picture budget > keeps the model’s strongest candidate when two share a stretch
     → expected [ 'idea 0', 'idea 1', 'idea 2', …(1) ] to not include 'idea 1'
```

`[ +0, +0, +0, +0 ]` is Mohamed's complaint written as an array: four pictures,
all four in the first quarter.

A second mutation deleted the leftover-budget pass. Seven reds, including
`spends a stretch’s unused money elsewhere rather than losing it → expected [
{ wordIds: [ 'w0' ], …(7) } ] to have a length of 4 but got 1`. Restored, 43 of
43 green both times.

## 3. What moved on the short reels, and on golden

**Golden did not move: 4 of 4 reels matched, field for field, 17,174 fields**,
run twice — once after the selector change and once after everything. It is
unmoved because the four golden reels have no `budget-spent` refusals: their
budgets cover their candidates, so both the old selector and the new one accept
everything, and the final ordering is by time either way. There is nothing to
reconcile field by name because no field changed.

No reel got worse. Every reel got better, and none lost a picture:

| reel | dark before | dark after | pictures before | pictures after |
|---|---|---|---|---|
| `sora` | 23.24 s (57%) | **6.48 s (16%)** | 9 | **10** |
| `sora-2` | 13.30 s (57%) | **6.44 s (28%)** | 7 | 7 |
| `sora-6a` | 4.32 s (32%) | **2.75 s (20%)** | 7 | 7 |
| `sora-1` | 2.40 s (23%) | **1.88 s (18%)** | 8 | 8 |

`sora-1` is the reel session 87 was about, and it is the one to watch for harm:
it keeps all eight pictures and its darkest stretch shrinks. Its *set* changes —
it now keeps `Glowing radiant facial skin`, `Sharply defined jawline` and
`Dermal filler syringe`, which the old selector refused, and drops three it used
to keep. That is the ruling working: same count, different places. `sora` gains
a picture because a stretch that used to lose its money now passes it on.

## 4. `sora-2`, re-run

The transcript was never touched. The analysis **was served from cache — `Cost:
$0.0000 — served from cache, nothing billed`** — on the run that counts, though
see section 6 for the one I paid for first by my own error.

| | before (what he watched) | after |
|---|---|---|
| 0.06 s | Falling autumn leaves | Falling autumn leaves |
| 1.06 s | Hair falling out | Hair falling out |
| 2.68 s | A puzzled woman | *gone* |
| 3.68 s | Regenera device (hers, free) | Regenera device (hers, free) |
| 5.70 s | Microscopic view of stem cells | Microscopic view of stem cells |
| 8.46 s | Mesotherapy syringe | Mesotherapy syringe |
| 10.02 s | A multivitamin capsule | *gone* |
| 14.90 s | — | **Polynucleotides vial** (new) |
| 18.58 s | — | **Hair filler syringe** (new) |

Seven pictures before, seven after. **Longest dark stretch: 13.30 s (57%) →
6.44 s (28%).** The last picture used to appear at 10.02 s and now the reel is
still showing pictures at 18.58 s of 23.32 s.

```
open "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/build/sora-2-f6c580b5-full.aep"
```

### What I think of it, before he opens it

It is better and it is not finished.

The 6.44 s hold between `Mesotherapy syringe` at 8.46 s and `Polynucleotides
vial` at 14.90 s is the honest cost of ranking inside a stretch: the third
stretch's strongest candidate happens to sit at its far end, and the second
stretch's at its near end, so the two winners are further apart than the
stretches are. I could close that by preferring the candidate nearest a
stretch's centre, but that would be a rule I invented about his videos rather
than one he ruled or the model supplied, so I did not.

**The last 4.74 s still has nothing new in it**, and that is not the budget —
the model proposed no idea at all after 18.58 s. No amount of spreading fixes a
stretch with nothing in it. If he wants the tail covered, that is a question for
the slot prompt, not the selector.

Two pictures he has already paid for — `A puzzled woman` and `A multivitamin
capsule`, four generated candidates — are no longer in the reel. They were not
re-bought and they are still on disk; they simply lost their moment to a
stronger candidate in the same stretch. That is the ruling doing what he asked,
but it is money already spent that this reel no longer shows, and he should know
it rather than discover it.

## 5. A defect the re-run exposed: a re-plan was doubling his cap

Re-planning `sora-2` produced **twelve slots against a budget of six** — and it
does so at `HEAD` too, so this predates the session. Every span the reel had
already bought was counted as *free*, free spans raise the number of slots a
reel may hold, and the budget then bought six more on top. A second re-plan
would have gone further.

Two of his rulings were folded into one set and they pull opposite ways:

- **2026-08-26** — a picture from the client's own store is placed *as well as*
  the ones the budget buys, not instead of one.
- **2026-08-29**, and again **2026-09-11** — the count is capped, and the count
  is exactly what does not change.

I separated them: the client's own pictures are still extra, and **an
already-bought span is now a discount, not a free pass** — it competes for one
of the reel's places like any other candidate and costs nothing when it wins
one. `sora-2` re-plans to 7 slots and stays there.

**This is a decision, and it is his to confirm, not mine to absorb.** It resolves
the conflict in favour of the cap, and the price is the one named above: a bought
picture can lose its moment. Three tests written by sessions 86 and 87 asserted
the opposite and I rewrote them rather than leave them asserting retired
behaviour; each rewrite says in its own comment what changed and why. If he
rules the other way, those three tests and one `??` are where it lives.

## 6. What I got wrong, and what it cost

**$1.289868 spent, of which $0.686980 bought nothing.** Both were my errors, not
the tool's.

- **$0.077400 — I ran the analysis against the wrong client.** `npm run analyse`
  defaults `--mode` to `k2-syndicalia` and does not read the client the plan
  already names. The plan says `dr-loubna-kfafi` in two places. I omitted the
  flag, missed the cache keyed on her, paid for a fresh analysis and got a reel
  planned in K2's red. Re-run with `--mode dr-loubna-kfafi` it was free. **The
  CLI should take the client from the plan and refuse to disagree with it**; I
  have not changed that, because a default that silently contradicts the plan is
  a decision about how the tool behaves and not a thing to slip into this
  session.
- **$0.609180 — a re-plan re-bought two pictures the reel already owned.** The
  spread dropped two slots, every later slot was renumbered, and the two that
  moved from `img005`/`img006` to `img004`/`img005` were generated a second time
  **in the same run that logged them as kept**. The cause: the image cache keys
  on the composed prompt, and part of the prompt is a variation drawn from the
  slot's *index*. Renumbering alone is enough to miss.

I fixed the second. A span that survives a re-plan now keeps the prompt its
pictures were bought against, instead of having a new one drawn for it. Proven
twice: re-running the whole thing afterwards printed **`billed 0, cached 12,
this run $0.000000`**, and a new test in `job.test.ts` goes red when the carry is
removed — `expected 'a freshly drawn prompt' to be 'the prompt its pictures were
bought a…'`. I did not reseed the variation on something stable instead, because
that would change the prompt of every slot in every existing plan and strand
every image this project has paid for.

While chasing this I also found that the guard which protects bought pictures
tells the operator to *"Re-run with --force"*, and `analyse-cli.ts` never
declared `--force`, so it answered `Unknown option '--force'`. The escape hatch
its own message named was unreachable from the terminal. Declared.

## 7. The stranger test

The assertion is added and **it cannot bite on this fixture. I am saying so
rather than leaving it to be found.**

The stranger is 1.5 seconds long, so its budget is one picture, the reel is
considered in one stretch, and "no two bought pictures share a stretch" is true
of any single picture. The test asserts the rule in its general form, so it
becomes load-bearing the moment the fixture grows, and its comment says plainly
that it is vacuous at this length.

Making it bite needs a longer stranger. The video is three seconds of ffmpeg; the
obstacle is the transcript, which is a recording of a real Scribe answer about
these 1.5 seconds. A longer reel needs a longer recording, which is a billable
call on footage that does not exist yet. **That is a decision for Mohamed and I
did not spend against it.**

## 8. The sidecar timeout — fixed, and why it kept failing

It passed this session, inside a full gate run, with macOS storage management
taking 89% of a core in the background. But it has timed out under gate load in
sessions 84, 86 and 89, so passing once proves nothing.

Measured again today, alone: **58.02 s**. The bound was 240 s, derived from a
measured 3.9x contention factor — 58.02 × 3.9 = 226 s against 240 s, which is
6% of headroom, and 6% is not headroom. That derivation is the bug: the bound
was written as a performance assertion.

It is a **hang detector**, and it now says so and is ten minutes. The two
failures are not symmetric. Too wide costs a slower report of a sidecar that has
genuinely hung. Too narrow fails the gate on a machine that was merely busy —
and a gate that cries wolf three sessions running is worse than no gate.

## 9. Gates

| gate | result |
|---|---|
| `npm run golden` (after the selector change) | `4 of 4 reels matched, field for field` |
| `npm run golden` (after everything) | `4 of 4 reels matched, field for field` |
| `npm run check`, run alone | **exit 0** |
| `service/src/analysis/slot-select.test.ts` | 43 passed |
| `service/src/analysis/job.test.ts` | 23 passed |
| `service/src/a-stranger.test.ts` | 12 passed |
| panel, run 1–5 | exit 0, 0, 0, 0, 0 |

The gate failed once mid-session on `'_rank' is assigned a value but never used`
from the destructuring that keeps `rank` off the slot; rewritten and re-run
alone to exit 0.

## 10. Every ledger line this session added

Nine lines, `$1.289868`. All-time `$26.376707` across 223 lines.

| time | stage | client | usd | what it bought |
|---|---|---|---|---|
| 02:30:38 | analysis-slots | **k2-syndicalia** | 0.077400 | nothing — wrong client, my error |
| 02:34:31 | images-generate | dr-loubna-kfafi | 0.152118 | nothing — re-buy, stem cells c1 |
| 02:34:51 | images-generate | dr-loubna-kfafi | 0.155478 | nothing — re-buy, stem cells c2 |
| 02:35:11 | images-generate | dr-loubna-kfafi | 0.149712 | nothing — re-buy, mesotherapy c1 |
| 02:35:32 | images-generate | dr-loubna-kfafi | 0.151872 | nothing — re-buy, mesotherapy c2 |
| 02:35:54 | images-generate | dr-loubna-kfafi | 0.150312 | Polynucleotides vial c1 |
| 02:36:15 | images-generate | dr-loubna-kfafi | 0.152712 | Polynucleotides vial c2 |
| 02:36:37 | images-generate | dr-loubna-kfafi | 0.148872 | Hair filler syringe c1 |
| 02:36:56 | images-generate | dr-loubna-kfafi | 0.151392 | Hair filler syringe c2 |

`$0.603288` of that is the four genuinely new pictures. `$0.686980` is waste.

## What is open

- **The 6.44 s hold in the middle of `sora-2`**, and the 4.74 s tail with no
  candidate in it. The first needs a ruling on what decides inside a stretch;
  the second is a slot-prompt question, not a selector one.
- **Whether the cap wins over "a bought picture is extra"** (section 5). I ruled
  for the cap and it is his to confirm.
- **`npm run analyse` defaults to the wrong client** and will silently bill for
  it. Not changed this session.
- **The stranger test's spreading assertion is vacuous at 1.5 s** (section 7).
  Lengthening its transcript is billable.
- Everything carried from session 89 that this session did not touch.
