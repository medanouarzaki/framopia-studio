# The `dial` rule (guide v1.0.5) against the measured noise floor

> **Superseded WER figures (Block 4 session 1).** The `ground-truth` reel's
> reference was corrected again: five standalone conjunction and article
> tokens were fused per guide §2, taking it from 81 reference words to 76.
> Every ground-truth WER number below is scored against the old text. The
> re-scored figures and the token list are in
> `RESULTS-block4-refcorrection.md`. The findings here are unaffected; only
> the WER column moved.

> **The WER numbers in this section are scored against the old reference.**
> See the addendum at the end for the same runs re-scored against
> `v1.0.1-conformant`, where the floor is 3.7 points and the comparison
> changes direction.

## Headline

**The `dial` instability disappeared.** Across three identical calls under
v1.0.5, every one of the five governing occurrences is written `dial` +
separate noun, and `dialha` stays attached. Under v1.0.4, run 3 fused three of
them (`dl7loul`, `dl7essass`, `dlvitaminat`). Token stability across the three
runs rose from **69/81 to 79/81**; only two tokens still move.

**WER did not move beyond the floor.** v1.0.5 gave 22.2% / 21.0% / 21.0%
against v1.0.4's 21.0% / 21.0% / 18.5%. The worst v1.0.5 run is 1.2 points
above the worst v1.0.4 run, well inside the 2.5-point floor this reel
established. The mean rose from 20.2% to 21.4% — also inside it.

**But the ground truth writes `dl`, not `dial`.** In all three positions the
rule targets, the user's own hand-written transcript reads `dl 7olol`,
`dl 7essass`, `dl vitaminat` — the reduced form, written separate. That is
neither the fused `dl7loul` the rule forbids nor the `dial l7loul` it
mandates. This is reported, not resolved: §4's own tie-break is that the
user's habit wins, and on this reel the habit is `dl`. See "The ground truth
disagrees" below.

Nothing here rules on whether the change stands.

## Method

The recorded Scribe draft at
`benchmarks/results/2026-08-24T20-34-32-007Z/raw/scribe.json` (75 word tokens,
the ground-truth reel) — the same draft the noise floor used — was replayed
three times through the correction pass at prompt version 1, with
ORTHOGRAPHY_GUIDE at v1.0.5 injected verbatim. Scribe was not re-run. The
v1.0.4 column is the noise-floor run recorded in
`benchmarks/RESULTS-block2-noisefloor.md`, unchanged. Raw outputs:
`benchmarks/results/dialrule/ground-truth.json`.

Ground truth: `.local/ground-truth/ground-truth.json`, 81 reference words.

## WER, side by side

| guide | run | overall | darija | fr/en | tokens | drift |
|---|---|---|---|---|---|---|
| v1.0.4 | 1 | 21.0% | 25.0% | 6.3% | 81 | 8.0% |
| v1.0.4 | 2 | 21.0% | 23.3% | 12.5% | 81 | 8.0% |
| v1.0.4 | 3 | 18.5% | 21.7% | 6.3% | 78 | 4.0% |
| | **spread** | **2.5 pts** | 3.3 | 6.3 | | |
| v1.0.5 | 1 | 22.2% | 26.7% | 6.3% | 81 | 8.0% |
| v1.0.5 | 2 | 21.0% | 25.0% | 6.3% | 81 | 8.0% |
| v1.0.5 | 3 | 21.0% | 25.0% | 6.3% | 81 | 8.0% |
| | **spread** | **1.2 pts** | 1.7 | 0.0 | | |

The v1.0.5 spread is half the v1.0.4 spread on every measure, and the fr/en
subset is now identical across all three runs. Three samples per arm is far
too few to call that a real narrowing, but it is the direction a rule that
removes a degree of freedom would produce.

## `dial` in every run

Five occurrences govern a following noun; one (`dialha`) takes a pronoun
suffix and must stay attached.

| run | [8] | [15] | [34] | [46] | [59] | [68] |
|---|---|---|---|---|---|---|
| v1.0.4 r1 | `dial la` | `dial l7lol` | `dial l7essass` | `dialha kidom` | `dial lvitaminat` | `dial l7essass` |
| v1.0.4 r2 | `dial la` | `dial l7lol` | `dial l7essass` | `dialha kidom` | `dial lvitaminat` | `dial l7essass` |
| v1.0.4 r3 | `dial la` | **`dl7loul`** | **`dl7essass`** | `dialha kidom` | **`dlvitaminat`** | `dial l7essass` |
| v1.0.5 r1 | `dial la` | `dial l7loul` | `dial l7essass` | `dialha kidom` | `dial lvitaminat` | `dial l7essass` |
| v1.0.5 r2 | `dial la` | `dial l7loul` | `dial l7essass` | `dialha kidom` | `dial lvitaminat` | `dial l7essass` |
| v1.0.5 r3 | `dial la` | `dial l7loul.` | `dial l7essass` | `dialha kidom` | `dial lvitaminat` | `dial l7essass` |

Six of six occurrences comply in all three v1.0.5 runs. The conformance
checker agrees: `dialAttachment` counts 3 on v1.0.4 run 3 and **0 on every
v1.0.5 run**.

## The twelve previously-unstable tokens

Stability across the three runs of each arm, measured by anchor alignment
against run 1 of that arm:

| | stable | moved |
|---|---|---|
| v1.0.4 | 69/81 | `[15] dial` `[16] l7lol` `[17] awal` `[34] dial` `[35] l7essass` `[48] lmoddat` `[51] tani` `[58] cocktail` `[59] dial` `[60] lvitaminat` `[66] kadiri` `[77] kay3tiw` |
| v1.0.5 | **79/81** | `[17] awel` `[66] katdiri` |

Ten of the twelve stabilised. Token by token:

- `dial` ×3, `l7lol`, `l7essass`, `lvitaminat` — **stabilised.** All six were
  the attachment question the rule addresses; they are now fixed.
- `cocktail` (`cocktail` vs `lcocktail`) — **stabilised**, though the rule does
  not mention it. The definite article on a French noun was probably always
  downstream of the same uncertainty about where `dial` ends.
- `lmoddat` / `lmodat`, `tani` / `ttani`, `kay3tiw` / `ki3tiw` — **stabilised**,
  and nothing in the rule explains why. With three samples per arm this may
  be chance rather than effect.
- `awal` / `awel` / `awl` — **still moving.** A schwa the guide does not
  determine.
- `kadiri` / `katdiri` — **still moving.** §4 mandates the `kat-` prefix, so
  this is the model failing an existing rule, not a gap in the guide.

## The ground truth disagrees

The hand-written reference for this reel writes the reduced form, separate:

| position | ground truth | v1.0.5 output |
|---|---|---|
| [15] | `dl 7olol` | `dial l7loul` |
| [34] | `dl 7essass` | `dial l7essass` |
| [60] | `dl vitaminat` | `dial lvitaminat` |
| [8] | `dial la` | `dial la` |
| [46] | `dialha kidom` | `dialha kidom` |
| [69] | `dial l7essass` | `dial l7essass` |

So the reference uses `dial` where the noun is French or already carries its
own article, and `dl` before an Arabizi noun with the definite article fused
on. v1.0.5 writes `dial` everywhere.

Two consequences worth stating plainly:

1. This is why v1.0.4 run 3 scored the **lowest** WER of all six runs (18.5%).
   Its fused `dl7loul` is closer to the reference's `dl 7olol` than
   `dial l7loul` is, so the run that broke the new rule scored best against
   the ground truth. The small WER rise under v1.0.5 is that effect, not a
   transcription regression.
2. §4's own tie-break — "the user's habit wins", the rule that replaced `dyal`
   with `dial` in v1.0.1 — points at `dl` for these positions. v1.0.5 was
   decided from the instability evidence; the ground truth was not consulted.

Neither observation is a recommendation. The options a reader can see from
here are: keep v1.0.5 and accept that the ground truth is now non-conformant
for three tokens; amend v1.0.5 to allow `dl` as a separate token before a
definite-article noun; or re-transcribe the reference. Deciding is the user's.

## Conformance under the corrected scorer

Warnings are listed separately and do not touch the percentage.

| run | conformance | `dial` violations | `ou` violations | warnings |
|---|---|---|---|---|
| v1.0.4 r1 | 97.5% | 0 | 0 | none |
| v1.0.4 r2 | 97.5% | 0 | 0 | none |
| v1.0.4 r3 | 94.9% | 3 | 0 | none |
| v1.0.5 r1 | 97.5% | 0 | 0 | none |
| v1.0.5 r2 | 97.5% | 0 | 0 | none |
| v1.0.5 r3 | 97.5% | 0 | 0 | none |

The residual 2.5% in every run is the same two `l7essass` tokens, matched as
near-misses of the frozen `7essass` — the definite article attached to a
frozen word, which the freeze-list matcher cannot model. No vowel-less
warnings on this reel under either guide version.

## Cost and thinking ratio

Estimated $0.6863 (the multiplier is now deliberately pessimistic); actual
**$0.439596**.

| run | cost | wall | visible out | thinking | ratio |
|---|---|---|---|---|---|
| 1 | $0.163036 | 96.0 s | — | — | 9.5x |
| 2 | $0.107368 | 61.6 s | — | — | 18.8x |
| 3 | $0.169192 | 224.1 s | — | — | 31.0x |

Cost varied 58% and wall-clock 3.6x across three identical calls, consistent
with the ±20% warning from the noise floor and, if anything, worse. The
estimate was 56% high, which is the intended direction for a gate.

## What this does and does not tell us

**Does:** the rule took. Six of six `dial` occurrences comply in every run, the
checker confirms zero violations, and ten of the twelve unstable tokens
stabilised. WER stayed inside the measured floor, so the change costs nothing
detectable at this sample size.

**Does not:** three runs per arm cannot establish that the narrower spread
(1.2 vs 2.5 points) is real rather than luck. It does not explain why
`lmoddat`, `tani` and `kay3tiw` stabilised when the rule says nothing about
them. And it does not settle the conflict with the ground truth, which is now
the more important open question: the reference this project scores every
future run against does not follow the rule that was just added.

---

# Addendum (Block 2 session 6): re-scored against the corrected reference

Everything above this line was scored against the **old** reference, which
wrote `dl 7olol`, `dl 7essass`, `dl vitaminat`. Those three tokens have since
been corrected to `dial l7olol`, `dial l7essass`, `dial lvitaminat`, and the
reference is now versioned `v1.0.1-conformant`. The original numbers are left
as recorded; these are the same outputs re-scored, with no new API calls.

## Every recorded run, both references

| run | old ref | new ref | delta | darija old → new | fr/en old → new |
|---|---|---|---|---|---|
| run C gemini | 21.0% | 14.8% | −6.2 | 21.7% → 13.3% | 12.5% → 12.5% |
| run C hybrid | 22.2% | 16.0% | −6.2 | 25.0% → 16.7% | 12.5% → 12.5% |
| session 3 prompt v2 | 22.2% | 16.0% | −6.2 | 26.7% → 18.3% | 6.3% → 6.3% |
| noise floor run 1 (v1.0.4) | 21.0% | 14.8% | −6.2 | 25.0% → 16.7% | 6.3% → 6.3% |
| noise floor run 2 (v1.0.4) | 21.0% | 16.0% | −4.9 | 23.3% → 16.7% | 12.5% → 12.5% |
| noise floor run 3 (v1.0.4) | 18.5% | **18.5%** | **+0.0** | 21.7% → 21.7% | 6.3% → 6.3% |
| dial run 1 (v1.0.5) | 22.2% | 16.0% | −6.2 | 26.7% → 18.3% | 6.3% → 6.3% |
| dial run 2 (v1.0.5) | 21.0% | 14.8% | −6.2 | 25.0% → 16.7% | 6.3% → 6.3% |
| dial run 3 (v1.0.5) | 21.0% | 14.8% | −6.2 | 25.0% → 16.7% | 6.3% → 6.3% |

Eight of nine runs improve by 4.9–6.2 points, purely because the reference now
spells three tokens the way the guide requires. The fr/en subset is untouched,
as expected — the edit is entirely inside the darija subset.

The exception is the whole point: **noise-floor run 3 is unchanged at 18.5%**.
It was the run that produced `dl7loul`, `dl7essass`, `dlvitaminat`, and it was
the best-scoring of the six only because it matched a reference that was
itself non-conformant. Against the corrected reference it is now the **worst**
of the nine.

## The corrected noise floor

**3.7 points**, from 14.8% to 18.5% across the three v1.0.4 noise-floor runs
(run C hybrid at 16.0% sits inside that range and does not widen it).

The floor got *wider*, not narrower: 2.5 → 3.7 points. Correcting the
reference removed the accidental credit run 3 was getting, and run 3 was the
outlier. **This 3.7-point figure supersedes the 2.5-point figure** for any
comparison scored against the corrected reference.

## v1.0.4 versus v1.0.5, both against the corrected reference

| guide | run 1 | run 2 | run 3 | mean | spread |
|---|---|---|---|---|---|
| v1.0.4 | 14.8% | 16.0% | 18.5% | 16.4% | **3.7 pts** |
| v1.0.5 | 16.0% | 14.8% | 14.8% | 15.2% | **1.2 pts** |

Re-scoring changes the picture from the original section above. Under the old
reference v1.0.5 looked very slightly worse (21.4% against 20.2%); under the
corrected one it is slightly better (15.2% against 16.4%) and its spread is a
third the size. Both differences remain inside the 3.7-point floor, so neither
is measurable at three runs per arm — but the direction has flipped, and the
reason is that the old reference was rewarding exactly the fused spelling the
rule forbids.

This addendum still does not rule on whether v1.0.5 stands.
