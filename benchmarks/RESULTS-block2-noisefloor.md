# Run-to-run variance of the correction pass

> **Superseded figures.** Every WER number here was scored against the
> pre-`v1.0.1-conformant` reference, which wrote `dl 7olol`, `dl 7essass`,
> `dl vitaminat`. Re-scored against the corrected reference the floor is
> **3.7 points**, not 2.5 — see the addendum in
> `benchmarks/RESULTS-block2-dialrule.md`. The outputs and the token-stability
> findings below are unaffected; only the WER column moved.

## Headline

Three identical calls — same recorded Scribe draft, same audio, same prompt
(version 1), nothing else varied — produced **three different transcripts**.

| | overall WER | darija WER | fr/en WER | tokens | drift |
|---|---|---|---|---|---|
| run 1 | 21.0% | 25.0% | 6.3% | 81 | 8.0% |
| run 2 | 21.0% | 23.3% | 12.5% | 81 | 8.0% |
| run 3 | **18.5%** | **21.7%** | 6.3% | 78 | 4.0% |
| **spread** | **2.5 points** | **3.3 points** | **6.3 points** | 3 | 4.0 points |

**69 of 81 tokens were identical across all three. 12 moved.**

**The practical consequence: any prompt comparison whose effect is smaller
than about 2.5 points of overall WER — or 3.3 on darija, or 6.3 on fr/en — is
not measurable at n=1 on this reel.** A single-call A/B of two prompts is
measuring the sampler, not the prompt.

The runs were not bit-identical, so this says nothing about whether session
3's brand-name variation had another cause; sampling alone is sufficient to
explain that kind of difference.

## Method

The recorded Scribe draft at
`benchmarks/results/2026-08-24T20-34-32-007Z/raw/scribe.json` (75 word tokens,
the ground-truth reel) was replayed three times through the correction pass at
prompt **version 1**, against `.local/bench-audio/ground-truth.wav`. Scribe was
not re-run. Ground truth for WER is `.local/ground-truth/ground-truth.json`,
81 reference words. Raw outputs: `benchmarks/results/noisefloor/ground-truth.json`.

## Cost and thinking ratio

Estimated $0.2676 before spending; actual **$0.4186**.

| run | cost | wall | visible out | thinking | ratio |
|---|---|---|---|---|---|
| 1 | $0.162400 | 258.6 s | 411 | 12396 | 30.2x |
| 2 | $0.115000 | 139.0 s | 413 | 8442 | 20.4x |
| 3 | $0.141200 | 88.9 s | 1189 | 9854 | 8.3x |

Cost varied by **41%** across identical calls ($0.115 to $0.1624), driven
entirely by how long the model chose to think. Wall-clock varied by 2.9x.
Run 3 emitted 1189 visible tokens for a *shorter* transcript than runs 1 and 2
emitted in 411 — the same content in three times the output tokens, so even
visible output is not stable.

Thinking ratios of 30.2x, 20.4x and 8.3x are all above the 5x the estimator
assumed, which is why the actual came in 56% over estimate.

## Pairwise diffs, every differing token

### run 1 vs run 2 — 5 differences, both 81 tokens

1. `awal` / `awl` — `joj dial l7lol awal 7el houa` / `joj dial l7lol awl 7el houa`
2. `lmoddat` / `lmodat` — `l'effet dialha kidom lmoddat sana l7el` / `… kidom lmodat sana l7el`
3. `tani` / `ttani` — `lmoddat sana l7el tani houa la mésothérapie` / `lmodat sana l7el ttani houa …`
4. `cocktail` / `lcocktail` — `li houa wa7d cocktail dial lvitaminat` / `li houa wa7d lcocktail dial lvitaminat`
5. `kadiri` / `katdiri` — `3lih الكافيين li kadiri 4 dial l7essass` / `… li katdiri 4 dial l7essass`

### run 1 vs run 3 — 9 differences (81 vs 78 tokens)

1. `dial` deleted — `3ndi lik joj dial l7lol awal 7el` → run 3 merges it
2. `l7lol` / `dl7loul` — `lik joj dial l7lol awal` / `3ndi lik joj dl7loul awel`
3. `awal` / `awel` — `joj dial l7lol awal 7el houa` / `lik joj dl7loul awel 7el houa`
4. `dial` deleted — `saumon kat7taji joj dial l7essass mabin 7essa`
5. `l7essass` / `dl7essass` — `kat7taji joj dial l7essass mabin` / `saumon kat7taji joj dl7essass mabin`
6. `lmoddat` / `lmodat` — `l'effet dialha kidom lmoddat sana` / `… kidom lmodat sana`
7. `dial` deleted — `houa wa7d cocktail dial lvitaminat w zayd`
8. `lvitaminat` / `dlvitaminat` — `wa7d cocktail dial lvitaminat w zayd` / `houa wa7d cocktail dlvitaminat w zayd`
9. `kay3tiw` / `ki3tiw` — `15 yom w kay3tiw نتائج جد فعالة` / `15 yom w ki3tiw نتائج جد فعالة`

### run 2 vs run 3 — 11 differences (81 vs 78 tokens)

1. `dial` deleted — `3ndi lik joj dial l7lol awl 7el`
2. `l7lol` / `dl7loul` — `lik joj dial l7lol awl 7el` / `3ndi lik joj dl7loul awel 7el`
3. `awl` / `awel` — `joj dial l7lol awl 7el houa` / `lik joj dl7loul awel 7el houa`
4. `dial` deleted — `saumon kat7taji joj dial l7essass mabin 7essa`
5. `l7essass` / `dl7essass` — `kat7taji joj dial l7essass mabin` / `saumon kat7taji joj dl7essass mabin`
6. `ttani` / `tani` — `lmodat sana l7el ttani houa` / `lmodat sana l7el tani houa`
7. `lcocktail` deleted — `li houa wa7d lcocktail dial lvitaminat w`
8. `dial` / `cocktail` — `houa wa7d lcocktail dial lvitaminat` / `li houa wa7d cocktail dlvitaminat`
9. `lvitaminat` / `dlvitaminat` — `wa7d lcocktail dial lvitaminat w zayd` / `houa wa7d cocktail dlvitaminat w zayd`
10. `katdiri` / `kadiri` — `3lih الكافيين li katdiri 4 dial` / `3lih الكافيين li kadiri 4 dial`
11. `kay3tiw` / `ki3tiw` — `15 yom w kay3tiw نتائج` / `15 yom w ki3tiw نتائج`

## What moved and what held

**69 of 81 tokens identical across all three runs.** The 12 that moved, by
run-1 index:

`[15] dial` · `[16] l7lol` · `[17] awal` · `[34] dial` · `[35] l7essass` ·
`[48] lmoddat` · `[51] tani` · `[58] cocktail` · `[59] dial` · `[60] lvitaminat` ·
`[66] kadiri` · `[77] kay3tiw`

They fall into three groups, and none is a transcription disagreement — the
model heard the same thing every time and wrote it differently:

- **Possessive `dial` attached or detached** (`dial l7loul` vs `dl7loul`,
  `dial l7essass` vs `dl7essass`, `dial lvitaminat` vs `dlvitaminat`) —
  six of the twelve. §4 freezes `dial` as a word and §4 also lists `dl`/`dla`
  as a reduced variant deliberately *not* frozen, so run 3 is producing the
  form the guide rejects. This alone accounts for run 3's lower token count
  and its lower WER, since the ground truth writes them attached.
- **Schwa present or absent** (`awal` / `awl` / `awel`, `lmoddat` / `lmodat`,
  `tani` / `ttani`) — the §3 schwa rule is genuinely underdetermined and the
  model resolves it differently each time.
- **Verb prefix** (`kadiri` / `katdiri`, `kay3tiw` / `ki3tiw`) — §4 mandates
  `kat-` and `kay-`; two of three runs comply on each, one does not.

Every moving token is an orthography choice the guide either does not
determine or determines but the model does not always follow. That is a more
useful finding than the spread itself: the variance is concentrated in rules,
not in hearing.

## Context: run C sits in the same band

Run C's recorded output for this reel — the same prompt, the same draft,
recorded in `benchmarks/RESULTS-block1.md` — scored 22.2% overall. Treating it
as a fourth sample of the same configuration widens the observed range to
**18.5% – 22.2%, 3.7 points**.

Session 3's version 2 result was 22.2% overall, which sits at the top of that
band and inside it. This document does not re-open that question; it only
notes where the number falls.

## Consequence

At n=1 on this reel, a prompt change is measurable only if it moves overall
WER by more than ~2.5 points (~3.7 against the four same-prompt samples now on
record). Nothing tried so far comes close. To measure a smaller effect the
options are more samples per arm, a larger evaluation set than one 23-second
reel, or a metric less sensitive to sampling than WER — for example scoring
orthography-rule compliance directly, which is where all twelve moving tokens
landed.

Cost follows the same warning: three identical calls cost $0.115, $0.141 and
$0.162. Any per-reel cost figure quoted from a single call carries roughly
±20%.
