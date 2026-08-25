# The four Block 1 reels through the production pipeline

> **Superseded WER figures (Block 4 session 1).** The `ground-truth` reel's
> reference was corrected again: five standalone conjunction and article
> tokens were fused per guide §2, taking it from 81 reference words to 76.
> Every ground-truth WER number below is scored against the old text. The
> re-scored figures and the token list are in
> `RESULTS-block4-refcorrection.md`. The findings here are unaffected; only
> the WER column moved.

First evidence that the production path generalises past `vitasilk`. Every
reel was run through `npm run transcribe` — the same code the `transcribe` job
type runs — rather than through the benchmark harness, so this measures the
shipping pipeline end to end: hash, ffprobe, audio extraction, cached hybrid
transcription, tagging, cleaning, grouping, and a validated Edit Plan.

Guide v1.0.6, `ACTIVE_PROMPT_VERSION` 3, `gemini-3.1-pro-preview`, Scribe v2
batch. Plans are written beside the videos in the gitignored footage folder
and are not committed.

## Headline

**All four reels completed, all four plans validated, total $0.6248.** The
estimate gate said ~$0.8792 for the four; the pessimistic multiplier
over-predicted by 29%, in the expected direction.

**Cleaning has never fired, on any reel.** Zero words carry `removed: true`
across all four reels — and zero would have, because the Scribe drafts contain
no fillers and no immediate repeats to begin with. This is footage, not the
stage: see "Why cleaning is silent" below.

**Every subtitle group is 1 or 2 words**, as `grouping.ts` requires, across
all 148 groups.

**`mixed` still has never been produced.** Four more reels, 291 words, no
`mixed` tag. The enum value remains unexercised in production.

**`langDisagreement` fired zero times** on all four reels. Its only firing to
date is still the `filler` case on vitasilk, which was the cross-check's own
error and is fixed in this session.

## Per reel

| reel | wall clock | actual cost | cache | words | groups | group sizes | removed | arabic script | plan valid |
|---|---|---|---|---|---|---|---|---|---|
| test-1 | 89.3s (94s incl. CLI) | $0.1477 | miss | 72 | 36 | 36×2 | 0 | 19 | yes |
| test-2 | 152.6s (157s) | $0.1830 | miss | 75 | 38 | 1×1, 37×2 | 0 | 9 | yes |
| test-3 | 72.7s (77s) | $0.1209 | miss | 63 | 33 | 3×1, 30×2 | 0 | 11 | yes |
| ground-truth | 100.5s (105s) | $0.1731 | miss | 81 | 41 | 1×1, 40×2 | 0 | 6 | yes |

Every word is in exactly one group in every reel (72/75/63/81 grouped word
ids against 72/75/63/81 words), so grouping drops nothing.

Cost is `scribe + gemini`: $0.0013 + $0.1464, $0.0014 + $0.1816,
$0.0013 + $0.1196, $0.0014 + $0.1717. Scribe is 0.8–1.1% of each reel.

### Token drift

| reel | draft | corrected | delta | fraction | warned |
|---|---|---|---|---|---|
| test-1 | 65 | 72 | +7 | 10.8% | no |
| test-2 | 72 | 75 | +3 | 4.2% | no |
| test-3 | 57 | 63 | +6 | 10.5% | no |
| ground-truth | 76 | 81 | +5 | 6.6% | no |

All four are inside the 15% warning threshold, and all four move the same
direction: the correction pass adds tokens, never removes them. Alignment
interpolated 7 / 3 / 6 / 5 words respectively (those carry `confidence: null`;
the rest inherit Scribe's per-slot confidence).

### Language tag distribution

| reel | darija | msa | fr | en | mixed | null |
|---|---|---|---|---|---|---|
| test-1 | 48 | 19 | 5 | 0 | 0 | 0 |
| test-2 | 51 | 9 | 15 | 0 | 0 | 0 |
| test-3 | 36 | 11 | 15 | 1 | 0 | 0 |
| ground-truth | 60 | 6 | 15 | 0 | 0 | 0 |

Coverage is complete: 291 of 291 words tagged, no nulls, no out-of-enum
values. `msa` tracks the Arabic-script count exactly in every reel, which is
what §6's Arabic-script mandate should produce.

### Removed words

**Zero, on all four reels.** No `removed: true`, so no `removedReason`
breakdown exists to report. Stated plainly because the absence is the finding.

### langDisagreement firings

**Zero, on all four reels.** No word to name.

## Why cleaning is silent

The zero is not `cleaning.ts` failing to fire on input it should have caught.
The Scribe drafts — the raw upstream, before any correction — contain no
filler tokens (`euh`, `eh`, and the Arabic-script equivalents) and no
immediate repeats at all:

| reel | draft words | filler tokens | immediate repeats |
|---|---|---|---|
| test-1 | 65 | 0 | 0 |
| test-2 | 72 | 0 | 0 |
| test-3 | 57 | 0 | 0 |
| ground-truth | 76 | 0 | 0 |
| vitasilk | 73 | 0 | 0 |

Five reels, 343 draft words, zero disfluencies. The footage is scripted and
delivered to camera by a professional; there is nothing to clean. So
`cleaning.ts` is **untested against real input** and will stay that way until
a reel with unscripted speech exists. Its unit tests are the only evidence it
works.

## Cache hit, re-run of test-1

Second run on the same reel: **$0.0000, 4.1s against 89.3s, no ledger line
written** (the ledger's last entry stays the ground-truth reel's). The plan
differs from the first in exactly seven leaves, all bookkeeping:

```
meta.createdAt, meta.updatedAt, pipeline.transcription.completedAt
pipeline.transcription.costUsd  0.14772575 -> 0
pipeline.transcription.cached   false -> true
costs.totalUsd                  0.14772575 -> 0
costs.byStage.transcription     0.14772575 -> absent
```

Transcript, groups, tags and confidences are byte-identical. One wrinkle worth
recording: `costs.byStage.transcription` is **removed** rather than set to 0 on
a cache hit, so a consumer diffing `byStage` keys across runs sees a key
appear and disappear. Not fixed here.

## readEditPlan against real plans

`readEditPlan` had never been called outside its own tests. All four written
plans were read back through it:

```
OK   test 1: schemaVersion=1, 72 words, 36 groups
OK   test 2: schemaVersion=1, 75 words, 38 groups
OK   test 3: schemaVersion=1, 63 words, 33 groups
OK   ground truth: schemaVersion=1, 81 words, 41 groups
```

The schema-version gate was exercised on a real plan for the first time by
rewriting one copy's `schemaVersion` to 99:

```
EditPlanVersionError — edit plan schemaVersion 99 is not supported; this build reads version 1
```

It fires with the right error type and reports a version problem rather than a
wall of missing-field issues, which is what it was written to do.

## WER — generalisation evidence, not a comparison

The adapter fit: `benchmarks/src/score-editplan.ts`, 39 lines, reads only the
word texts out of a plan and hands them to the existing scorer, so it has no
dependency on the service package.

**All figures below are scored against the `v1.0.7-conformant` references.**
Superseded once more in Block 3 session 6: test-1 moved from 31.3% to 27.9%
overall and 33.3% to 0.0% fr/en when the user's listening pass settled the
French article as `dial la vidéo`. The run-C test-1 row it is compared against
moved from 23.9% to 20.6% for the same reason, so **the delta is unchanged**.
The other three reels did not move at all.
They supersede the `v1.0.1-conformant` figures this section carried when it
was written: test-3 was 21.7% overall / 21.2% darija / 12.5% fr/en, and the
run-C test-3 row it is compared against was 20.0%. Straightening one curly
apostrophe in the test-3 reference (Block 3 session 2) turned a substitution
into a match on **both** sides, so every delta below is unchanged. The other
three reels did not move at all.

| reel | overall | darija | fr/en | hyp words | ref words |
|---|---|---|---|---|---|
| ground-truth | 19.8% | 21.7% | 6.3% | 81 | 81 |
| test-1 | 31.3% | 30.4% | 33.3% | 72 | 67 |
| test-2 | 34.3% | 32.7% | 0.0% | 75 | 70 |
| test-3 | 20.0% | 21.2% | 6.3% | 63 | 60 |

Beside run C's hybrid rows, re-scored against the same corrected references:

| reel | run C hybrid (guide v1.0.3, prompt v1) | production (guide v1.0.6, prompt v3) | delta |
|---|---|---|---|
| ground-truth | 16.0% | 19.8% | +3.8 |
| test-1 | 23.9% | 31.3% | +7.4 |
| test-2 | 28.6% | 34.3% | +5.7 |
| test-3 | 18.3% | 20.0% | +1.7 |

**Production scored worse on every reel, three of the four beyond the
3.7-point noise floor.** That is what the numbers say and it should not be
explained away. It is also not yet a finding about prompt or guide quality,
for three reasons that all apply at once:

- **n=1 per reel.** The 3.7-point floor was measured across three identical
  calls on the ground-truth reel alone. Nobody has measured the floor on
  test-1, test-2 or test-3, and these reels are 60–75 reference words, where a
  handful of tokens is worth several points.
- **Two things varied.** Run C used guide v1.0.3 and prompt version 1;
  production uses guide v1.0.6 and prompt version 3. This comparison cannot
  separate them, exactly like the inconclusive session-3 v2 experiment.
- **The hypothesis is longer than the reference on three of four reels**
  (+5, +5, +3 words). Insertions count against WER directly, and the drift
  table shows the correction pass adding tokens on every reel. Whether those
  are real words the reference omits or hallucinated ones is a spotcheck
  question, not a WER question, and no spotcheck was done.

What these numbers do establish: the pipeline runs to completion on four reels
it had never seen, produces structurally valid plans, and lands in the same
20–35% WER band the benchmark harness lands in. Establishing whether v1.0.6 /
prompt v3 is actually worse than v1.0.3 / prompt v1 needs a repeated run on at
least two reels, which is a separate, billable experiment.

## Spend

Eight ledger lines, two per reel, none from the cache-hit run.

| | |
|---|---|
| estimate for the four | $0.8792 |
| actual | $0.624776 |
| ledger all-time before | $4.820226 |
| ledger all-time after | $5.445002 |

Both cost gates held: the first reel came in at $0.1477 against a $0.35 stop,
and cumulative spend peaked at $0.6248 against a $1.20 stop.
