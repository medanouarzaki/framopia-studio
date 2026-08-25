# Keyword detection on two reels, and selection stability across repeats

First live run of `service/src/analysis/`. Two reels analysed, then vitasilk
run three more times with the cache bypassed to see whether identical inputs
produce identical keyword sets.

Mode `k2-syndicalia` v2, analysis prompt version 1,
`gemini-3.1-pro-preview`. Count derived from duration: 4 per 30 s pro-rata,
rounded, floored at 1 — both reels are ~22–26 s, so both get **3**.

## Per reel

### vitasilk — 25.7 s, 3 keywords, $0.0514, 29.4 s wall, cache miss

0 resolution failures, 0 text mismatches.

| id | keyword | score | span | reason (verbatim) |
|---|---|---|---|---|
| k001 | `filler glow` | 0.95 | 6.98–7.58 s | names the specific product being promoted |
| k002 | `Vita Silk` | 0.95 | 8.24–8.86 s | identifies the core brand |
| k003 | `lissage brésilien` | 0.90 | 15.76–16.88 s | defines the cosmetic procedure |

### test-1 — 22.0 s, 3 keywords, $0.0498, 29.4 s wall, cache miss

0 resolution failures, 0 text mismatches.

| id | keyword | score | span | reason (verbatim) |
|---|---|---|---|---|
| k001 | `محفزات الكولاجين` | 0.95 | 5.74–6.76 s | names the primary cosmetic procedure being discussed |
| k002 | `تحفيز طبيعي للكولاجين` | 0.92 | 1.66–2.90 s | states the main biological mechanism and claim |
| k003 | `18 7ta l 25 chher` | 0.88 | 15.72–17.16 s | asserts the specific duration of the treatment effect |

Two of test-1's three keywords are Arabic-script multi-word spans, and the
third is a four-word span including the inserted `7ta` that the Block 3
session 2 insertion analysis flagged and that has not been listened to yet.

## Selection stability — vitasilk, three bypassed runs

Three calls with identical inputs and the cache bypassed.

| run | cost | wall | k001 | k002 | k003 |
|---|---|---|---|---|---|
| 1 | $0.0553 | 93.2 s | `filler glow` 0.95 | `Vita Silk` 0.95 | `lissage brésilien` 0.95 |
| 2 | $0.0582 | 35.0 s | `filler glow` 0.98 | `Vita Silk` 0.95 | `lissage brésilien` 0.92 |
| 3 | $0.0530 | 30.2 s | `filler glow` 0.98 | `Vita Silk` 0.98 | `lissage brésilien` 0.95 |

**Overlap across the three runs:**

- Keywords appearing in **all three**: **3** — `filler glow`, `Vita Silk`,
  `lissage brésilien`, each with identical word ids and identical spans.
- Keywords appearing in **two of three**: **0**.
- Keywords appearing in **one** run only: **0**.

The order was also the same in all three.

What did move, run to run:

- **Scores.** `filler glow` 0.95 / 0.98 / 0.98, `Vita Silk` 0.95 / 0.95 / 0.98,
  `lissage brésilien` 0.95 / 0.92 / 0.95. The ranking is unaffected because
  the gaps between candidates are larger than the wobble, but the scores are
  not stable numbers and should not be compared across runs.
- **Reasons.** Reworded every time; no two runs produced the same wording for
  any keyword. Examples for `filler glow`: "it names the specific product
  being introduced" / "naming the exact product being pitched" / "names the
  specific product being pitched".
- **Wall clock**, 30.2 s to 93.2 s — a 3x spread on identical input.
- **Cost**, $0.0530 to $0.0582, a 9.8% spread.

The first vitasilk run (the cache miss above, $0.0514) picked the same three
keywords as all three repeats, so the set held across four independent calls.

This is one reel, one domain, with a brand name and a procedure name in it —
the conditions most favourable to a stable answer. Nothing here is a claim
about a reel where the strongest candidates are closer together.

## Cache hit

Re-running vitasilk without `--no-cache`:

- **$0.0000**, "Cache hit — no billable calls for this run."
- **No new ledger line**: 60 lines before, 60 after.
- Plan identical but for six bookkeeping leaves:

```
meta.updatedAt, pipeline.analysis.completedAt
pipeline.analysis.costUsd     0.052996 -> 0
pipeline.analysis.cached      false -> true
costs.totalUsd                0.052996 -> 0
costs.byStage.analysis        0.052996 -> 0
```

`costs.byStage.analysis` is **present and zero**, not dropped — the bug fixed
for transcription last session is not reintroduced here.

## auto and propose select identically

Running the same plan in `propose` mode (a cache hit, $0.0000) returned the
same three keywords with the same ids, spans, scores and reasons, and the only
difference in the written plan was `approved: true` becoming `approved: false`
and `keywords.mode`. Verified by stripping `approved` from both and comparing:
identical. The mode never reaches the model.

## Spend

| | |
|---|---|
| billable calls | 5 |
| session spend | $0.267718 |
| ledger all-time before | $5.445002 (55 entries) |
| ledger all-time after | $5.712720 (60 entries) |

Both gates held: vitasilk's first run came in at $0.0514 against a $0.30 stop,
and cumulative spend peaked at $0.2677 against a $0.90 stop.

The CLI's printed estimate (~$0.0040) is **not a useful forecast for this
stage**. `estimateGeminiCallCost` is duration-based and this call sends no
audio, so it was passed a duration of 0 and models almost nothing. Actual cost
came in ~13x higher. Every figure above is an actual, from `usageMetadata`.
