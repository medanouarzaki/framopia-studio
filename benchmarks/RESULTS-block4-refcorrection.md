# The ground-truth reference under ORTHOGRAPHY_GUIDE v1.0.7

Block 3 session 6 attached the conjunction `w` (guide §2, v1.0.7) and the
production transcripts complied immediately: 22 attached conjunctions and 0
standalone across all five reels. The `ground-truth` reel then *lost* ground
against run C while the other three inverted, and
`RESULTS-block3-final.md` identified why — **the reel's own reference was
still writing the conjunction and the article standalone**, so the transcript
was being penalised for being right. The tokens were named there but not
corrected, because the listening pass had not covered them.

This session corrects them. **No API call was made.** Every figure below comes
from recorded engine outputs already on disk, re-scored against the corrected
reference; the ledger holds 84 entries before and after.

## What changed in the reference

Five tokens on five lines of `.local/ground-truth/ground-truth.txt`, taken
verbatim from `RESULTS-block3-final.md`'s list rather than re-derived by eye:

| line | before | after | rule |
|---|---|---|---|
| 31 | `Mabin 7essa w 7essa` | `Mabin 7essa w7essa` | §2 (v1.0.7), conjunction attaches |
| 33 | `W l'effet dialha kidom lmodat sana` | `Wl'effet dialha kidom lmodat sana` | §2 (v1.0.7), conjunction attaches |
| 35 | `Li houa wa7d l cocktail dial lvitaminat` | `Li houa wa7d lcocktail dial lvitaminat` | §2, definite article attaches |
| 36 | `Wzayd 3lih l caféine` | `Wzayd 3lih lcaféine` | §2, definite article attaches |
| 38 | `Mabin 7essa w 7essa 15 yom` | `Mabin 7essa w7essa 15 yom` | §2 (v1.0.7), conjunction attaches |

Nothing else moved: no spelling was changed, no line was re-wrapped, and the
trailing space on line 36 is preserved. A grep for a standalone `w` or a
standalone `l` in the file now returns nothing.

**Unlike the Block 3 reference corrections, this one is not token-for-token.**
Fusing two tokens into one removes a token, so the reel's reference went from
**81 words to 76**. Every WER denominator for this reel moved with it, which
is why the engine rows below move even though not one engine output changed.

### Two discrepancies against the session brief, both reported rather than reasoned past

- The brief said six tokens; the results file names **five**, and the file is
  what was used. `CLAUDE.md`'s "standalone on four lines and the article on
  two" is a miscount of the same list — the conjunction is standalone on
  three lines (31, 33, 38), the article on two (35, 36).
- The brief said to bump the header from `v1.0.1-conformant` to
  `v1.0.7-conformant`. **The header already read `v1.0.7-conformant`** before
  this session touched anything. It was bumped in Block 3 session 6 while the
  content still violated the rule the version names, so the file has been
  claiming a conformance it did not have. The header is now true; it was not
  changed.

## Before and after

Recorded engine outputs, re-scored. `production` is the current Edit Plan at
`my files/test videos/ground truth.editplan.json`, read through
`benchmarks/src/score-editplan.ts`.

### ground-truth — the only reel affected

| engine | overall WER before | after | move |
|---|---|---|---|
| scribe | 75.3% | 80.3% | +5.0 |
| gemini | 14.8% | 25.0% | +10.2 |
| whisper | 92.6% | 92.1% | −0.5 |
| hybrid (run C) | 16.0% | 23.7% | +7.7 |
| **production** | **22.2%** | **11.8%** | **−10.4** |

darija and fr/en subsets, same runs:

| engine | darija before | after | fr/en before | after |
|---|---|---|---|---|
| scribe | 98.3% | 98.2% | 6.3% | 7.1% |
| gemini | 13.3% | 17.5% | 12.5% | 14.3% |
| whisper | 95.0% | 94.7% | 100.0% | 100.0% |
| hybrid | 16.7% | 19.3% | 12.5% | 14.3% |
| production | 23.3% | 12.3% | 25.0% | 14.3% |

The production plan now scores **0 insertions and 0 deletions** on this reel:
9 substitutions against 76 reference words, down from 13 substitutions and 5
deletions. The five deletions were the five fusions — the transcript had
written one token where the reference wanted two.

### The other three reels did not move

Re-scored in the same pass as a control, since their references were
untouched. Every figure reproduces the recorded v1.0.7 numbers exactly:

| reel | ref words | hybrid (run C) | production |
|---|---|---|---|
| test-1 | 68 | 20.6% | 14.7% |
| test-2 | 70 | 28.6% | 22.9% |
| test-3 | 60 | 18.3% | 16.7% |

### Pooled, all four reels

| engine | before | after |
|---|---|---|
| scribe | 71.3% | 72.6% |
| gemini | 23.3% | 26.3% |
| whisper | 87.5% | 87.2% |
| hybrid | 20.8% | 23.0% |

## The measured size of the defect: 10.4 points, not 6.2

Block 3 estimated this reference was costing a correct transcript about **6.2**
points. The measured figure is **10.4** — the production plan goes 22.2% →
11.8%.

**That is materially larger than the estimate and it is not being reconciled.**
The 6.2 figure was the *gap between production and run C hybrid* on the old
reference, which is a different quantity: it netted the transcript's penalty
against the credit run C was simultaneously getting for making the same
non-conformant choice the reference made. Correcting the reference moves both
sides at once. Production improves by 10.4; run C hybrid worsens by 7.7. The
gap between them therefore swings by 18.1 points, from +6.2 (production worse)
to **−11.9** (production better).

**The inversion is now complete on all four reels.** Production beats run C
hybrid on every one:

| reel | run C hybrid | production | gap |
|---|---|---|---|
| ground-truth | 23.7% | **11.8%** | −11.9 |
| test-1 | 20.6% | **14.7%** | −5.9 |
| test-2 | 28.6% | **22.9%** | −5.7 |
| test-3 | 18.3% | **16.7%** | −1.6 |

ground-truth was the one reel where the Block 1 config still looked better.
It no longer does, and it now shows the largest margin of the four.

## The noise floor widened again: 3.7 → 5.2 points

The floor is measured on this reel, so correcting the reference re-scores it.
The three identical correction calls of `RESULTS-block2-noisefloor.md`,
re-scored from their recorded outputs:

| | before | after |
|---|---|---|
| run 1 | 21.0% | 22.4% |
| run 2 | 21.0% | 21.1% |
| run 3 | 18.5% | 26.3% |
| **spread** | **3.7 points** | **5.2 points** |

It widened for the same reason it widened last time. Run 3 was the outlier and
the *best* of the three at 18.5%; it is now the outlier and the *worst* at
26.3%. It is the run that emitted 78 tokens instead of 81 — it was dropping
conjunctions, and the old reference paid it for that.

**Any prompt comparison whose effect is under 5.2 points of overall WER is not
measurable at n=1 on this reel.** The 3.7-point figure is superseded, and so is
the 2.5-point figure before it.

One caveat on the new number, stated because it limits what it can be used
for: these three calls ran prompt version 1 under an older guide, and the
production prompt is now version 4. 5.2 points is the re-scored spread of that
recorded set. It is the best available estimate of sampler variance on this
reel and nothing here re-measures the current prompt, which would cost a
sweep.

For completeness, the other recorded three-call sets on this reel, re-scored:

| set | before spread | after spread | after range |
|---|---|---|---|
| noisefloor (prompt v1) | 3.7 | **5.2** | 21.1–26.3% |
| dialrule (guide v1.0.5) | — | 1.3 | 22.4–23.7% |
| langtagging (prompt v3) | — | 3.9 | 22.4–26.3% |

## Files re-scored and superseded

- `RESULTS-block1.md` was regenerated by `npm run bench:aggregate` from disk.
  Only its ground-truth rows and its pooled rows moved; cost, wall time and
  timestamp deviation are untouched. It carries a notice pointing here.
- `RESULTS-block2-noisefloor.md`, `RESULTS-block2-dialrule.md`,
  `RESULTS-block2-langtagging.md`, `RESULTS-block2-promptv2.md`,
  `RESULTS-block3-generalisation.md`, `RESULTS-block3-insertions.md` and
  `RESULTS-block3-final.md` all carry ground-truth WER figures scored against
  the old reference and each now carries a notice.
- `RESULTS-block1-runA.md` and `RESULTS-block1-runB.md` already carry blanket
  supersession blocks saying nothing in them should be quoted as a current
  figure. That still holds and they were not re-scored.
- The **findings** in every one of those files — token stability, drift, lang
  tagging agreement, insertion analysis — are unaffected. Only WER moved.

---

# Addendum — `test-3`, Block 4 session 2

Session 1 corrected `ground-truth` from a hand-written token list. Session 2
threw the lists away and **scanned mechanically instead**: a standalone token
is one bounded by whitespace on both sides, run over all four references for
both proclitics §2 governs.

The scan found **two standalone conjunctions in `test-3` that no list ever
named.** Line 18 was mentioned once in passing in `RESULTS-block3-final.md`;
**line 17 appears in no list anywhere.** `test-3`'s own header comment block
asserted "No edit: all three flagged tokens are the attached `w`" while the
file carried two that were not.

## The scan, all four references

| reel | standalone `w` | standalone `l` | lines |
|---|---|---|---|
| ground-truth | 0 | 0 | — |
| test-1 | 0 | 0 | — |
| test-2 | 0 | 0 | — |
| **test-3** | **2** | 0 | 17, 18 |

`wa7d l cocktail`, which Block 3 named in `ground-truth`, **was already
corrected** by session 1 to `wa7d lcocktail`. The bare-`l` scan confirms it:
zero standalone articles anywhere.

The three prior counts — six (Block 3 handoff), five (results file), four
(CLAUDE.md) — were all describing `ground-truth` alone and all of them were
wrong about the whole corpus, because none of them looked at `test-3`.

## What changed

| line | before | after | rule |
|---|---|---|---|
| 17 | `W bdebt 3la le RRS eyes` | `Wbdebt 3la le RRS eyes` | §2, conjunction attaches |
| 18 | `... non réticulé w مادة الكافيين` | `... non réticulé ومادة الكافيين` | §2, same rule and same letter in Arabic script |

Line 18 is the case §2 spells out directly: "In Arabic script it is the same
rule with the same letter: `إشراقة ونضارة`, never `إشراقة و نضارة`." The Latin
`w` before an Arabic-script noun becomes the attached Arabic `و`, which is
what the production transcript had already been writing.

`test-3` goes from **60 reference words to 58.**

## Before and after — test-3

Recorded engine outputs, re-scored. No API call.

| engine | before | after | move |
|---|---|---|---|
| scribe | 56.7% | 53.4% | −3.3 |
| gemini | 23.3% | 25.9% | +2.6 |
| whisper | 85.0% | 82.8% | −2.2 |
| hybrid (run C) | 18.3% | 24.1% | +5.8 |
| **production** | **16.7%** | **12.1%** | **−4.6** |

The other three reels did not move, which is the control:
ground-truth 23.7/11.8, test-1 20.6/14.7, test-2 28.6/22.9 for hybrid and
production respectively — identical to session 1's table.

**The same shape as `ground-truth`, for the same reason.** Production improves
4.6 points; run C hybrid worsens 5.8, because run C was being paid for writing
the conjunction standalone against a reference that did the same. The gap
swings 10.4 points, from −1.6 to **−12.0**.

## Production against run C hybrid, all four reels, final

| reel | run C hybrid | production | gap |
|---|---|---|---|
| ground-truth | 23.7% | **11.8%** | −11.9 |
| test-1 | 20.6% | **14.7%** | −5.9 |
| test-2 | 28.6% | **22.9%** | −5.7 |
| test-3 | 24.1% | **12.1%** | **−12.0** |

test-3 moves from the narrowest margin of the four to the widest. Production
beats the Block 1 frozen config on every reel by between 5.7 and 12.0 points.

## The noise floor did not move again

Still **5.2 points** (22.4 / 21.1 / 26.3). It is measured on the
`ground-truth` reel, which session 2 did not touch; re-derived from the
recorded three-call set rather than assumed. `dialrule` 1.3 and `langtagging`
3.9 are likewise unchanged.

## Why the lists kept being wrong

Three hand-written counts of the same defect disagreed with each other and all
three were incomplete, because each was derived by reading rather than by
matching. §2 has claimed since v1.0.7 that "a standalone `w` is a spelling
error, and the conformance scorer treats it as one" — **the scorer did not.**
`w` appeared in the scorer only as a vowel-less *exception*, which suppresses
a warning rather than raising one.

Session 2 adds `findProclitics` to `benchmarks/src/orthography.ts`, a scored
violation for a standalone `w`, `و` or bare `l`, and
`benchmarks/src/verify-references.ts` gates every reference file's
`# reference-version:` header on a clean pass. Both run in `npm run check`.
The guide's claim about the scorer is now true.
