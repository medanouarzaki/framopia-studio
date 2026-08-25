# Inserted and deleted tokens against the four references

Production WER came out 1.7–7.4 points worse than run C on every reel, and the
correction pass added tokens on every one. WER cannot tell a word the
reference omitted from a word the model invented, and only one of those two
reaches a client's subtitles. This file separates them by name so a human ear
can rule on each.

**No API calls were made.** Everything here is computed from the Edit Plans
and references already on disk, using the same `align` and `normalizeForWer`
the scorer uses, so an edit listed here is an edit the WER figure charged for.

**This file draws no conclusion about prompt or guide quality.** It is the
input to a listening pass, not the result of one.

## Method

Alignment runs in normalized space, so a normalized slot no longer addresses
the token it came from. `benchmarks/src/insertions.ts` rebuilds that
provenance by repeating the normalizer's steps one token at a time, then names
each insertion and deletion in source tokens. Numerals are mapped exactly as
WER maps them, so `khmstach` against `15` is a match here too and does not
show up as an invented word.

Substitutions are counted but **not listed**: a substitution has a reference
word behind it, which makes it a spelling or hearing question rather than the
"did the model invent this" question this analysis exists for.

## Counts

| reel | inserted | deleted | substitutions | matches |
|---|---|---|---|---|
| ground-truth | 1 | 1 | 14 | 66 |
| test-1 | 6 | 1 | 14 | 52 |
| test-2 | 5 | 0 | 19 | 51 |
| test-3 | 3 | 0 | 10 | 50 |

| reel | darija | msa | fr | en | mixed | on freeze list |
|---|---|---|---|---|---|---|
| ground-truth | 1 | 0 | 0 | 0 | 0 | 0 |
| test-1 | 5 | 0 | 1 | 0 | 0 | 3 |
| test-2 | 5 | 0 | 0 | 0 | 0 | 2 |
| test-3 | 3 | 0 | 0 | 0 | 0 | 0 |

15 insertions and 2 deletions across 291 production words and 278 reference
words. The insertions are not spread evenly over the vocabulary: **8 of the 15
are the conjunction `w`**, and 5 of the remaining 7 are on the §4 freeze list.
Nothing was inserted in Arabic script, and nothing was tagged `msa`, `en` or
`mixed`.

Three of the 15 carry **interpolated** timings — alignment inferred them
because Scribe never emitted the token, so the audio cue for those rows is
approximate rather than measured. They are all `w`, and all three have a
zero-length span (`start == end`). The other 12 inherit a real Scribe slot.

## Per token

### ground-truth — 1 inserted

| token | start | end | timing | lang | script | freeze | context |
|---|---|---|---|---|---|---|---|
| `w` | 21.34s | 21.58s | scribe | darija | latin | no | 7essa 15 yom [w] kay3tiw نتائج جد |

### ground-truth — 1 deleted

| token | context |
|---|---|
| `l` | Li houa wa7d [l] cocktail dial lvitaminat |

### test-1 — 6 inserted

| token | start | end | timing | lang | script | freeze | context |
|---|---|---|---|---|---|---|---|
| `la` | 3.74s | 4.08s | scribe | fr | latin | no | tal lkher dial [la] vidéo lyoma ghadi |
| `w` | 6.81s | 6.81s | interpolated | darija | latin | no | 3la محفزات الكولاجين [w] hia des injections |
| `f` | 10.12s | 10.16s | scribe | darija | latin | yes | تحفيز طبيعي للكولاجين [f] الوجه dialna w |
| `w` | 10.86s | 10.88s | scribe | darija | latin | no | f الوجه dialna [w] kay3tiwna شد خفيف |
| `7ta` | 13.30s | 13.42s | scribe | darija | latin | yes | kat7taji mabin 7essa [7ta] l joj 7essass |
| `7ta` | 15.92s | 16.26s | scribe | darija | latin | yes | kidom mabin 18 [7ta] l 25 chher |

### test-1 — 1 deleted

| token | context |
|---|---|
| `ljawda` | kat7ssen lik mn [ljawda] dial البشرة dialk |

### test-2 — 5 inserted

| token | start | end | timing | lang | script | freeze | context |
|---|---|---|---|---|---|---|---|
| `w` | 11.99s | 11.99s | interpolated | darija | latin | no | خفيف للبشرة إشراقة [w] نضارة kat7taji mabin |
| `w` | 14.08s | 14.52s | scribe | darija | latin | no | 2 dial l7essass [w] mabin 7essa w |
| `mabin` | 14.58s | 14.70s | scribe | darija | latin | yes | dial l7essass w [mabin] 7essa w 7essa |
| `7essa` | 14.74s | 14.88s | scribe | darija | latin | yes | l7essass w mabin [7essa] w 7essa chher |
| `chhor` | 17.84s | 18.24s | scribe | darija | latin | no | 6 tal 8 [chhor] kat9edri diri l |

### test-2 — 0 deleted

None.

### test-3 — 3 inserted

| token | start | end | timing | lang | script | freeze | context |
|---|---|---|---|---|---|---|---|
| `w` | 12.12s | 12.12s | interpolated | darija | latin | no | les petites ridules [w] li 3ndhom les |
| `w` | 17.78s | 17.98s | scribe | darija | latin | no | l7essass mabin 7essa [w] 7essa 15 yom |
| `w` | 19.08s | 19.20s | scribe | darija | latin | no | 7essa 15 yom [w] kay3ti نتائج جد |

### test-3 — 0 deleted

None.
## The `la` insertion is the open `dial lvidéo` question

`test-1` 3.74s: production wrote `dial la vidéo`, the corrected reference
writes `dial lvidéo`, so `la` scores as an insertion and `lvidéo` scores as a
substitution against `vidéo` — the one token costs test-1 two errors. That
correction is under user review from Block 3 session 1 and was deliberately
not touched. This row is evidence for that decision, not a verdict on it: the
model wrote the French article separately, which is what guide §5 would
predict and what §2's attachment rule would not.

## Spotcheck pages

One page per reel, containing only that reel's inserted tokens. Each row shows
the token, its transcript context, and a play control that starts **1 s before
the token** and runs 2.6 s, so the run-up to the word is audible. Mark each
row **recovery** (the word is in the audio and the reference omitted it) or
**hallucination** (it is not in the audio).

```
benchmarks/results/latest-spotcheck/ground-truth-insertions.html   1 token
benchmarks/results/latest-spotcheck/test-1-insertions.html         6 tokens
benchmarks/results/latest-spotcheck/test-2-insertions.html         5 tokens
benchmarks/results/latest-spotcheck/test-3-insertions.html         3 tokens
```

Generated by the existing spotcheck tool, which gained a context column, a
configurable lead-in and configurable answer labels for this; the timestamp
pages it produces during a benchmark sweep are unchanged. `benchmarks/results/`
is gitignored, so the pages are not committed — regenerate them with
`npx tsx src/insertions-cli.ts` from `benchmarks/`.

## What this does not tell you

The listening pass has **not been done**. Every row above is unjudged. Until
it is, nothing here says whether the pipeline invents words, and the WER delta
against run C stays unexplained.
