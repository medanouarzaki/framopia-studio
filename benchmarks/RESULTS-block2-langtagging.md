# Prompt version 3: per-word language tags, measured

All WER in this document is scored against the **`v1.0.1-conformant`**
reference.

## Headline

**Coverage is complete: 81 of 81 words tagged in every run, zero null, zero
out-of-enum.** The model answers the question reliably.

**The tags are stable except on exactly one boundary.** 75 of 81 words carry
the same tag in all three runs. All six that move are the Arabic-script
tokens, and they move together: runs 1 and 2 call them `darija`, run 3 calls
them `msa`. Nothing else wavers.

**WER did not move beyond the floor, and the spread is the floor.** Version 3
gave 17.3% / 14.8% / 18.5% — a 3.7-point spread, exactly the corrected floor —
against version 1's 16.0% / 14.8% / 14.8% from the dial experiment. Mean 16.9%
against 15.2%, a 1.7-point difference that this reel cannot resolve.

**The local derivation never contradicted the model.** 15 agreements, 66
no-opinions, **0 disagreements**.

This document does not rule on whether version 3 stands.

## Method

The recorded Scribe draft at
`benchmarks/results/2026-08-24T20-34-32-007Z/raw/scribe.json` (75 word tokens)
— the same draft used for the noise floor and the dial experiment — replayed
three times under prompt version 3, guide v1.0.5, nothing else varied. Scribe
was not re-run. Raw outputs: `benchmarks/results/langtagging/ground-truth.json`.

Version 3 is version 1 plus a per-word `lang` in the response shape: the
conjunction rule and the keyterms position are untouched, verified by a test
that strips the response-shape block from both and asserts the remainder is
identical.

## WER

| prompt | run 1 | run 2 | run 3 | mean | spread |
|---|---|---|---|---|---|
| v1 (dial experiment) | 16.0% | 14.8% | 14.8% | 15.2% | 1.2 pts |
| **v3** | 17.3% | 14.8% | 18.5% | **16.9%** | **3.7 pts** |

| v3 run | overall | darija | fr/en | drift |
|---|---|---|---|---|
| 1 | 17.3% | 18.3% | 12.5% | 8.0% |
| 2 | 14.8% | 16.7% | 6.3% | 8.0% |
| 3 | 18.5% | 21.7% | 6.3% | 8.0% |

Version 3's best run ties version 1's best. Its worst is 3.7 points below,
which is the whole floor — so the 1.7-point mean difference is not
distinguishable from sampling. Token-count drift is identical at 8.0% in all
three.

Text stability did drop: **74 of 81** tokens identical across the three v3
runs, against 79 of 81 under v1 in the dial experiment. The extra movement is
in the same places as always — `awal`, `7el`, `lmodat`, `l7el`, `kaddiri`,
`kay3tiw`, plus `pigmentés` — schwas and verb prefixes, not new failures. With
three runs per arm this may be noise, but it is the direction that matters if
asking for a second output field costs attention on the first.

## Coverage

| run | words | tagged | null | in-enum | out-of-enum |
|---|---|---|---|---|---|
| 1 | 81 | 81 | 0 | 81 | 0 |
| 2 | 81 | 81 | 0 | 81 | 0 |
| 3 | 81 | 81 | 0 | 81 | 0 |

The null-fallback path was therefore never exercised by this experiment. It
remains covered by unit tests only.

## Distribution across the enum

| run | darija | fr | msa | en | mixed |
|---|---|---|---|---|---|
| 1 | 66 | 15 | 0 | 0 | 0 |
| 2 | 66 | 15 | 0 | 0 | 0 |
| 3 | 60 | 15 | 6 | 0 | 0 |
| **reference** | **60** | **16** | **5** | 0 | 0 |

**`mixed` was never used, in any run, for any word.** Neither was `en`. On
this reel there is nothing genuinely bilingual at token level and no English,
so that is the right answer rather than a gap — but it means the two values
are untested by real output.

Run 3's distribution is the one that matches the reference: 60 darija, and the
Arabic-script tokens as `msa`.

## Stability: the one boundary that moves

75 of 81 words carry the same tag in all three runs. The six that do not are
every Arabic-script token in the transcript, and they move as a block:

| index | token | run 1 | run 2 | run 3 |
|---|---|---|---|---|
| 20 | `الإبرة` | darija | darija | **msa** |
| 21 | `الحريرية` | darija | darija | **msa** |
| 64 | `الكافيين` | darija | darija | **msa** |
| 78 | `نتائج` | darija | darija | **msa** |
| 79 | `جد` | darija | darija | **msa** |
| 80 | `فعالة` | darija | darija | **msa** |

This is not random. These are exactly the medical and aesthetic domain terms
that ORTHOGRAPHY_GUIDE §6 mandates be written in Arabic script — `الإبرة
الحريرية` (the silk thread needle), `الكافيين` (caffeine), `نتائج جد فعالة`
(very effective results). The guide tells the model to write them in Arabic
script; it does not tell it what language they are. A Darija speaker saying a
clinical term in Arabic script is arguably speaking Darija; the term itself is
arguably MSA. The model has no basis to pick, and picks differently.

The reference tags all five of its Arabic-script words `msa`, but only because
its tagger assigns `msa` to anything in Arabic script by construction — that
is a convention, not an independent judgement.

So the practical answer to "are the tags stable enough to depend on": **yes
for Latin-script words, no for Arabic-script domain terms.** Every word that
would drive a Latin-vs-Arabic rendering decision under PROJECT_SPEC §5 is
already in Arabic script, and those are precisely the six that are unstable.

## Model tag versus local derivation

| | count |
|---|---|
| agree | 15 |
| derivation had no opinion | 66 |
| **disagree** | **0** |

The derivation only speaks up for French and English — a closed-class
wordlist, accents, and elided articles, all of which Arabizi never carries. On
this reel it had an opinion on 15 words, every one French, and the model
agreed with all 15: `les`, `cernes`, `la`, `vidéo`, `Alors`, `polynucléotides`,
`du`, `saumon`, `l'effet`, `la`, `mésothérapie`, `cocktail`, `caféine`,
`dernière` and the rest of the code-switched vocabulary.

Zero disagreements is a weak result rather than a strong one: the derivation
is silent on 81% of the transcript, so it can only confirm the easy cases. It
would catch a model that tagged `mésothérapie` as darija, and nothing subtler.
No word in the plan carries `langDisagreement` from this run.

## Cost and thinking ratio

Estimated $0.6863; actual **$0.437754**.

| run | cost | wall | thinking ratio |
|---|---|---|---|
| 1 | $0.156500 | 92.7 s | 14.3x |
| 2 | $0.135500 | 77.9 s | 12.1x |
| 3 | $0.145800 | 85.8 s | 10.7x |

Cost varied 15% and wall-clock 19% — much tighter than the 58% and 3.6x seen
in the dial experiment, though three samples cannot say whether asking for a
second field actually settles the model's thinking or that is chance too.

## What this does and does not tell us

**Does:** asking for `lang` works. Every word comes back tagged, always inside
the enum, and the tags agree with the local derivation wherever the derivation
has an opinion. The cost is unchanged and WER stays inside the floor. Latin
tokens are tagged consistently across runs.

**Does not:** it does not show version 3 is free. Its WER mean is 1.7 points
worse and its text stability 74/81 against 79/81, both inside the noise but
both in the same direction, and three runs cannot separate that from sampling.
It says nothing about `mixed` or `en`, which were never produced. And it
leaves the one question the tags were wanted for partly unanswered: the
darija-versus-msa call on Arabic-script domain terms is exactly where the
model is unstable, and no amount of re-running will fix that without the guide
saying which it wants.
