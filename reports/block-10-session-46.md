# Block 10 session 46 — what this project has cost, exactly

**Status: OK.** A read-only accounting. Nothing was modified; the ledger is
byte-identical at both ends and $0.00 was spent.

## The exact total

**$16.274417 — sixteen dollars and twenty-seven cents.** 145 calls, from
**2026-08-24 18:30 UTC** to **2026-09-01 15:49 UTC**.

**That figure is every API call the tool has made. It is not a bill, and it does
not include a single subscription, licence or piece of hardware** — the ledger
only ever records the tool's own calls, so anything paid for on a card and not
through the API is invisible to it.

## Done

### A — every line of the ledger

**By what it was for.** Splitting the 145 lines into the six reels' own
production runs and the experiments that built the tool:

| | calls | spend |
|---|---:|---:|
| **Making the six videos** | 104 | **$11.772136** |
| **Building the tool** — benchmarks and prompt experiments | 41 | **$4.502282** |
| | **145** | **$16.274417** |

**By stage:**

| stage | calls | spend |
|---|---:|---:|
| `images-generate` | 51 | $7.589354 |
| `transcribe-gemini-correction` | 13 | $1.914916 |
| `analysis-keywords` | 18 | $1.647432 |
| `benchmark-hybrid` | 9 | $1.188942 |
| `benchmark-gemini` | 9 | $1.166072 |
| `analysis-slots` | 9 | $0.600828 |
| `langtagging-v106-gemini` | 3 | $0.475914 |
| `dialrule-gemini` | 3 | $0.439596 |
| `langtagging-gemini` | 3 | $0.437754 |
| `noisefloor-gemini` | 3 | $0.418626 |
| `promptv2-validation-gemini` | 2 | $0.240580 |
| `benchmark-gemini-correction` | 1 | $0.123540 |
| `transcribe-scribe` | 13 | $0.019606 |
| `benchmark-scribe` | 8 | $0.011258 |

**By model — and this is the split between the two suppliers:**

| model | calls | spend | supplier |
|---|---:|---:|---|
| `gemini-3-pro-image` | 44 | $6.743752 | Google |
| `gemini-3.1-pro-preview` | 54 | $6.175646 | Google |
| `gemini` | 10 | $1.289612 | Google |
| `gemini-3.1-flash-image` | 7 | $0.845602 | Google |
| `hybrid` | 9 | $1.188942 | **both, and not separable** |
| `scribe_v2` | 13 | $0.019606 | ElevenLabs |
| `scribe` | 8 | $0.011258 | ElevenLabs |

**Google: $15.054612 across 115 calls. ElevenLabs: $0.030863 across 21 calls.**
The nine `hybrid` lines are a benchmark engine that made a Scribe call and a
Gemini call and recorded one figure for the pair, so **$1.188942 cannot be split
between the two suppliers from the ledger.**

**By reel.** The ledger has **no reel field** — a line records stage, model,
unit, amount and timestamp, and nothing else — so a reel's spend has to be
recovered from the cache, which is keyed by the video's own sha256. Every cache
directory matched a reel; none was orphaned.

| reel | length | transcription | keywords | slots | pictures | total |
|---|---:|---:|---:|---:|---:|---:|
| **sora** (his client) | 40.5 s | $0.154031 | $0.206746 | $0.178922 | $3.368984 | **$3.908683** |
| vitasilk | 25.7 s | $0.411414 | $0.149492 | $0.127974 | $2.064065 | **$2.752945** |
| test-1 | 22.0 s | $0.356742 | $0.247568 | $0.133112 | $1.220660 | **$1.958082** |
| test-2 | 22.3 s | $0.350936 | $0.183518 | — | — | **$0.534454** |
| ground-truth | 23.3 s | $0.338936 | $0.111662 | $0.064822 | — | **$0.515420** |
| test-3 | 21.2 s | $0.245274 | — | — | — | **$0.245274** |
| | | | | | | **$9.914858** |

**What cannot be attributed to a reel: $6.359559.** Of that, **$4.502282** is
the benchmark and prompt-experiment work, which was never about one video —
comparing transcription engines, testing the orthography rules, validating a
prompt version. The remaining **$1.857278 is production spend whose cache entry
no longer exists**: the caches keep a fixed number of entries per video and
evict the oldest, so calls that were paid for have had their record removed.
That money was spent on the six reels; which reel each dollar belongs to is no
longer recoverable.

**By month:** 2026-08 — 144 calls, $16.187847. 2026-09 — 1 call, $0.086570.

**By day**, which is the granularity to set against a statement:

| date | calls | spend |
|---|---:|---:|
| 2026-08-24 | 42 | $4.207914 |
| 2026-08-25 | 63 | $6.347858 |
| 2026-08-26 | 3 | $0.412818 |
| 2026-08-30 | 10 | $1.397144 |
| 2026-08-31 | 26 | $3.822113 |
| 2026-09-01 | 1 | $0.086570 |

**First entry:** 2026-08-24T18:30:24.255Z, `benchmark-scribe`, $0.0014212344.
**Last entry:** 2026-09-01T15:49:51.767Z, `analysis-slots`, $0.0865700.

### B — what the ledger does and does not capture

**When a line is written.** `appendCost` appends one JSON line — stage, model,
unit, amount, timestamp — and is called at five places, in every case **after
the API call has returned**, so a call that failed outright is never recorded.

**Which figures are measured and which are computed.** This matters, because
they are not the same kind of number:

| stage | figure | measured or computed |
|---|---|---|
| images | `computeImageCostFromUsage` on the response's own `usageMetadata` | **measured** |
| keywords, slots, correction | `computeGeminiCost` on `usageMetadata` | **measured** |
| **Scribe (ElevenLabs)** | `estimateScribeCost` — duration × **$0.22 per audio hour**, +20% when keyterms are used | **computed from a rate constant** |

**ElevenLabs returns no usage or billing figure at all**, so its $0.030863 is
the tool's own arithmetic against a rate someone typed into `core/src/pricing.ts`.
If that rate is wrong, that column is wrong — and `PROJECT_SPEC` §research
records the researched rate as **~$0.40 per audio hour**, nearly double the
constant. **The Scribe total is the least trustworthy number in this report**,
though it is also the smallest: three cents.

**`IMAGE_COST_MULTIPLIER` is 1.35, and the ledger does not use it.** It exists
only for the *pre-spend gate* — the estimate shown before a picture run and the
ceiling it is checked against — and it is deliberately pessimistic, set to clear
the worst observed published-to-actual gap (1.261) by seven per cent. The ledger
records what `usageMetadata` said the call actually used. **So the ledger holds
what was charged, not what was budgeted**, and the two differ: the budget is
about 35% higher than the ledger by design.

**Every billable call, and whether it records.**

| call | records? |
|---|---|
| Scribe + Gemini correction (`hybrid.ts`) | yes, both legs, after both return |
| keyword analysis (`keywords.ts`) | yes |
| slot planning (`slots.ts`) | yes |
| image generation (`generate.ts`) | yes — **with one gap, below** |
| the benchmark harness (`benchmarks/run.ts`) | yes |

**The one gap, and it is real.** In `images/generate.ts` the returned image's
dimensions are checked *before* the ledger line is written, and a mismatch
throws. Its own comment says so: *"The call has already cost money either way,
but a wrong-shaped image must not enter the cache or the plan."* **An image that
came back the wrong size was paid for and never recorded.** Nothing in the repo
says whether that ever happened, so the total is understated by an unknown but
probably small amount. A retried transient failure has the same shape: if Google
billed a call that threw, the ledger never saw it.

**Nothing was spent before the ledger existed.** `.local/` is gitignored so the
file has no history of its own, but the cost ledger was committed on
**2026-08-10** (`025b9eb`, block 1 session 1) — before any key was acquired — and
block 1 session 3's report records *"First live API call made: Scribe on the
ground-truth reel, $0.0014, recorded to `.local/costs.jsonl`."* That is the
ledger's own first line, to the cent, on 2026-08-24. **The ledger covers the
project's entire billable history.** The July commits are a scaffold that was
replaced wholesale on 2026-08-10 and made no API calls.

**The figures quoted in past reports all reconcile**, except the credit balances:

- **$3.82** (session 32, `sora`'s run) = the ledger's 2026-08-31 total exactly,
  and `sora`'s own plan records `spentUsd` 3.822113. ✓
- **$3.37** = `sora`'s 22 pictures, $3.368984. ✓
- **$1.22** = `test-1`'s 8 pictures, $1.220660. ✓
- **$2.35** = the *estimate* for a run that was never made — a projection, not a
  charge, and correctly absent from the ledger. ✓
- **$6.82 and $2.71** are **not ledger figures at all.** They are the user's own
  Google credit balance, quoted in reports. Taking $6.82 as at 2026-08-30 and
  subtracting the ledger's Google spend after that date gives **$2.91**, against
  the $2.71 the later reports carry — a **$0.20 discrepancy** the repository
  cannot explain. Either an earlier balance was rounded, or something was
  charged that the ledger never saw.

**Session 44's bill-then-crash: no spend was lost.** In `slots.ts` the
`appendCost` is on line 244, immediately after the response is parsed and
*before* the cache is written and before `planSlots` runs — and `planSlots` is
what can throw on a multi-subject idea. So the line is already on disk when the
crash happens. **A call that billed and then crashed still recorded itself.**
Session 41's own crash is in the ledger: the 2026-09-01 line, $0.086570.

### C — what is not in the repository at all

**ElevenLabs.** The ledger's Scribe lines are **pay-as-you-go API usage
computed from a per-audio-hour rate**, not a subscription. **A subscription fee
would not appear anywhere** — `appendCost` is only ever called with a per-call
amount. The repo records that a key with "paid Scribe access" was to be acquired
(`docs/BLOCKS.md`, `PROJECT_SPEC` §"API keys") and **no price, no plan name, no
invoice and no receipt.** Whether a first month was charged, and how much, is
not in this repository.

**Google AI Studio / Gemini.** The repo knows the model prices it computes
against, and nothing about the account. **How the credit was funded — prepaid,
subscription, or billed in arrears — is recorded nowhere**, and neither is any
top-up. The words *prepaid*, *top-up*, *invoice* and *receipt* appear nowhere in
`docs/` or `reports/`. `PROJECT_SPEC` §"API keys" notes only that a consumer
Gemini Pro subscription is **not** API access and that a key with billing
enabled was needed. **The $6.82 figure entered the reports as the user's own
statement of his balance; nothing derived it and nothing checks it.**

**Everything else with a price: no record found.** Searched for and not present —

- **After Effects / Adobe** — no cost, plan or licence figure. `MACHINE_
  REQUIREMENTS.md` names Adobe Fonts as running but explicitly says no
  subscription is involved *for the fonts*; it says nothing about AE itself.
- **The three fonts** (Inter, Almarai, Cormorant Garamond) — no purchase record.
- **The T7 Shield drive** — named as the location on every page, priced nowhere.
- **Storage, a domain, any hosting or service** — no record of any.
- The one non-API price in the docs is the **budget target** of $0.50–2.00 of
  API cost per reel (`PROJECT_SPEC` §Budget), which is a goal, not a payment.

### D — the shape of the spend

**The corpus against the real client.** The five test reels used to build the
tool cost **$6.006175**; `sora`, the one real client video, cost **$3.908683**.
Adding the $4.502282 of benchmarks and prompt experiments, **$10.508457 — 65% of
everything — went into building and proving the tool, and $3.91 into the only
video a client will see.** The $1.857278 whose cache entry was evicted is
production spend and sits inside the corpus/sora split without being assignable
to either.

**What a video costs now**, from the most recent complete run rather than an old
estimate. `sora`, 40.5 s, prompt v3:

| stage | measured |
|---|---:|
| transcription (Scribe + Gemini correction) | $0.1540 |
| keywords | $0.2067 |
| slots | $0.0866 |
| **the words, subtotal** | **$0.4473** |
| pictures — 22 images at **$0.1531** each | $3.3690 |
| **total** | **$3.8163** |

The per-image rate is steady across every reel: $0.1531 on `sora`, $0.1526 on
`test-1`, $0.1474 on `vitasilk` — **$0.1512 across all 44 images on disk.**

**Pictures are 88% of a reel's cost, and their count follows duration** at eight
slots per thirty seconds, two candidates each. So:

| reel length | slots | images | pictures | words | **total** |
|---:|---:|---:|---:|---:|---:|
| **22 s** | 6 | 12 | $1.8376 | ~$0.2430 | **~$2.08** |
| 25.7 s | 7 | 14 | $2.1439 | ~$0.2839 | ~$2.43 |
| **40.5 s** | 11 | 22 | $3.3690 | $0.4473 | **$3.82** |
| 60 s | 16 | 32 | $4.8386 | ~$0.6627 | ~$5.50 |

The word-stage figures for lengths other than 40.5 s are scaled by duration and
marked *~* — they follow transcript length, which is not exactly duration.
**Only the 40.5 s row is measured; the rest are arithmetic on it.**

**Both are above the $0.50–2.00 per-reel budget in `PROJECT_SPEC` §Budget** — a
22-second reel is just over the top of the band and a 40-second one is nearly
double it.

**What was paid for and then discarded:**

- **4 pictures on `vitasilk`, $0.513621** — generated, superseded, and still in
  the cache but no longer named by any slot on the plan.
- **7 image calls, $0.935645**, whose cache entry is gone entirely — 4 of them
  `gemini-3.1-flash-image`, which is the model bakeoff that compared flash
  against pro.
- **$1.857278 of production spend** across all stages whose cache entry has been
  evicted, of which the image portion above is part.
- **Nothing was lost to the bill-then-crash path**, confirmed above.

**The credit remaining is $2.71 — his figure, not the ledger's.** At the
measured rate that is:

- **0.7 of a 40-second reel** — not enough for one.
- **1.3 of a 22-second reel** — enough for one, with $0.63 left.
- **17 pictures** if nothing else were run.

## What the repository knows

Everything above under A, B and D. In one line: **the tool has spent
$16.274417 on 145 API calls, $15.05 of it with Google and $0.03 with
ElevenLabs, with $1.19 that cannot be split between them.**

## What it cannot know

The subscription and account side, entirely. No receipt, invoice, plan name or
account balance is recorded anywhere in this repository, and the ledger is
structurally incapable of holding one.

## Repo state

Branch `main`, tree clean, **nothing modified but the two reports**.

| | at start | at end |
|---|---|---|
| `.local/costs.jsonl` | **145 lines**, `d4fe2de37f5eb0c8553423b744bc5010be80738a611cd6cb065a008104b14ab1` | **identical** |
| `templates/library.aep` | `4b0cf05a8f5d4775c03e8ebd86f713f0e7eb985d80e46f3874cb28eca6c22aba` | identical |

After Effects was not used. No plan, cache entry, mode or document was touched
except the two reports. No key, prefix or account identifier was read, printed or
written.

## Suggested next step

The $0.20 that will not reconcile between the credit balances and the ledger is
the only loose thread the repository can see. Comparing the ledger's daily
column above against the Google billing page for 24–31 August would settle
whether it is a rounding of a remembered balance or a real charge the tool never
recorded.

---

## The figures only he can supply

Six things, and then the total is complete:

1. **The ElevenLabs first-month subscription** — what was charged, and whether
   it was a one-off or is still recurring.
2. **How the Google AI Studio credit was funded** — the amount, the date, and
   whether it was prepaid or billed in arrears.
3. **Any Google top-up** after the first.
4. **The After Effects / Creative Cloud cost** for the period, if it is being
   counted against this project.
5. **The T7 Shield drive**, and any font licence that was paid for.
6. **The Google billing total for 24–31 August**, to settle the $0.20.

Against those, the tool's own $16.274417 is exact and needs nothing added to it.
