Status: OK

Block 3 session 3. Settled the image variation axis in the mode file, built
keyword detection end to end — count derivation, the structured call,
deterministic selection, the analysis cache, and Edit Plan enrichment — ran it
live on two reels, measured selection stability across three identical calls,
and added the `dial lvidéo` spelling question to the test-1 spotcheck.

**Session spend $0.267718 over 5 billable calls.** Both cost gates held.

## Done

**1. Image variation axis** (bd108ed).
`modes/k2-syndicalia.json` gained `imageVariation` and went to **version 2**;
`core/src/mode.ts` gained the schema doc, the `ImageVariation` type and
`validateImageVariation`.

- Three axes: `composition`, `lighting`, `crop`, four values each.
- `imageStyle.stylePrompt` is the invariant half and applies unchanged to
  every slot — that is what keeps the palette dominant. `imageVariation` is
  the varying half. Both are mode data: no palette value and no composition,
  lighting or crop term is written in any source file.
- Validation rejects an axis with fewer than two values ("an axis with one
  value does not vary"), duplicate values, an empty axes block, and any axis
  value naming a colour literally.
- Five new tests. Which value a slot draws is deliberately **not** decided —
  that is session 4.

**2. Keyword count** (6c2091d). `service/src/analysis/count.ts`.
`keywordCountFor(durationS)` = PROJECT_SPEC §5's 3–5 per 30 s taken at its
midpoint of **4**, pro-rata, rounded half away from zero, floored at 1. Pure
and total; throws `RangeError` on a negative, NaN or infinite duration. Six
tests covering 0 s, 0.4 s, exactly 3.75 s (the 0.5 boundary where the floor
decides), 15 s, exactly 30 s, 60 s, 90 s, non-integers, and the five real reel
durations — **all five reels get 3**.

**3 + 4. Keyword detection and determinism** (cc949be).

- `analysis/keywords.ts` — `ACTIVE_ANALYSIS_PROMPT_VERSION = 1`, prompt,
  parser, and the one structured Gemini call. Criteria stated in the prompt in
  priority order, verbatim as specified: primary semantic weight, secondary
  brand and domain vocabulary as tiebreak only, and "Delivery and vocal
  emphasis are NOT criteria. Nothing in this pipeline hears prosody." Asks for
  `max(8, 3 × count)` candidates and says the final count is imposed
  downstream. Removed words are not shown to the model at all. Mode vocabulary
  goes in as an explicit term list — empty for K2, and the non-empty path is
  covered by a fixture test.
- `analysis/select.ts` — pure, and where the count is imposed. Score
  descending, documented tiebreak on start time then first word id, so the
  order is total and can never depend on incoming order (asserted by feeding
  the same candidates reversed). Drops and counts as resolution failures:
  unknown word id, removed word, overlap with an already-selected keyword,
  empty id list, score outside 0–1. **Nothing is fuzzy-matched into place.**
  Text is taken from the plan; a model disagreement is recorded as a text
  mismatch rather than accepted.
- `analysis/fingerprint.ts`, `cache.ts`, `cached.ts` — the §6 cache, reusing
  `cacheEntryDir` and `evictStaleEntries` from `transcription/cache.ts` rather
  than a parallel system. Fingerprint covers analysis prompt version, Gemini
  model pin, **mode id and mode version**, transcript content and candidate
  count. Tested: stable on identical inputs, invalidates on a mode version
  bump, on a different mode id, on edited transcript text, and on a word's
  `removed` flag flipping; ignores timings, which the prompt never sees.
- **Determinism is claimed only where it holds.** The cache gives
  byte-identical selection on a hit (tested). Everything downstream of the
  model response is deterministic (tested). The doc comment on
  `runKeywordAnalysis` says the call is **not** reproducible and cites the
  Block 2 evidence. No comment, doc or line of this report claims otherwise.
- `auto` and `propose` produce identical selections; only `approved` differs.
  Asserted in unit tests and confirmed live.

**5. Edit Plan enrichment** (ff68e16).

- `analysis/job.ts` — reads a plan, enriches `keywords` with id, wordIds,
  text, score, reason, approved, start, end, `templateId: null`; sets
  `pipeline.analysis` (status, config, costUsd, cached, completedAt, error)
  the way transcription does; sets `costs.byStage.analysis` and recomputes
  `costs.totalUsd` from `byStage`. **Zero on a cache hit, never absent** — the
  bug fixed for transcription last session is not reintroduced, and the live
  diff confirms the key is present and 0.
- `editplan/validate.ts` — `checkKeywords` now covers every keyword field and
  three rules beyond shape: word ids must resolve, a removed word cannot be a
  keyword, and two keywords cannot claim the same word. Eleven tests confirm a
  malformed keyword block cannot reach disk, since `writeEditPlan` validates
  first.
- `service/src/analyse-cli.ts` + `npm run analyse`.

**6. Live run** (986416e). Full numbers in
`benchmarks/RESULTS-block3-keywords.md`.

Ledger all-time before spending: **$5.445002** (55 entries). Estimate printed:
~$0.0040 per call.

**vitasilk — 25.7 s, 3 keywords, $0.0514, 29.4 s, cache miss, 0 resolution
failures, 0 text mismatches:**

| id | keyword | score | span | reason (verbatim) |
|---|---|---|---|---|
| k001 | `filler glow` | 0.95 | 6.98–7.58 s | names the specific product being promoted |
| k002 | `Vita Silk` | 0.95 | 8.24–8.86 s | identifies the core brand |
| k003 | `lissage brésilien` | 0.90 | 15.76–16.88 s | defines the cosmetic procedure |

**test-1 — 22.0 s, 3 keywords, $0.0498, 29.4 s, cache miss, 0 resolution
failures, 0 text mismatches:**

| id | keyword | score | span | reason (verbatim) |
|---|---|---|---|---|
| k001 | `محفزات الكولاجين` | 0.95 | 5.74–6.76 s | names the primary cosmetic procedure being discussed |
| k002 | `تحفيز طبيعي للكولاجين` | 0.92 | 1.66–2.90 s | states the main biological mechanism and claim |
| k003 | `18 7ta l 25 chher` | 0.88 | 15.72–17.16 s | asserts the specific duration of the treatment effect |

**Selection stability — three cache-bypassed vitasilk runs:**

- Appearing in **all three: 3** — `filler glow`, `Vita Silk`,
  `lissage brésilien`, identical word ids, identical spans, identical order.
- Appearing in **two of three: 0**. Appearing **once: 0**.
- The first (billed) run picked the same three, so the set held across four
  independent calls.
- What did move: scores (0.90–0.98 on the same word), reasons (reworded every
  single time), wall clock 30.2–93.2 s, cost $0.0530–$0.0582.

Reported plainly and not scored. No similarity index was computed and no
verdict on acceptability is offered — that reading is the user's.

**Cache hit:** $0.0000, **no new ledger line** (60 before, 60 after), plan
identical but for six bookkeeping leaves, `costs.byStage.analysis` present and
zero.

**7. Spotcheck row** (184d04c). One extra row on
`benchmarks/results/latest-spotcheck/test-1-insertions.html`, same tool, same
1 s lead-in, sorted in by timestamp beside the existing `la` row. It answers
**`dial lvidéo` / `dial la vidéo`** rather than recovery / hallucination, and
its context explains that row 1 asks whether `la` is audible while this row
asks which spelling wins. `spotcheck.ts` gained an optional per-row `choices`
override; the summary now counts by answer instead of against one expected
value, so a mixed page reads correctly. **The reference was not changed and
the guide was not changed.**

Spotcheck pages, all regenerated:

```
benchmarks/results/latest-spotcheck/ground-truth-insertions.html   1 row
benchmarks/results/latest-spotcheck/test-1-insertions.html         7 rows (6 insertions + 1 spelling question)
benchmarks/results/latest-spotcheck/test-2-insertions.html         5 rows
benchmarks/results/latest-spotcheck/test-3-insertions.html         3 rows
```

**8. `CLAUDE.md` updated** for the variation axis, the analysis module, the new
command, where determinism holds, the live figures, the estimator caveat and
the transcribe-overwrites-keywords gap.

## Deviations

- **Eight fabricated ledger lines were written and then removed.** My first
  version of `cached.ts` called `appendCost` in the wrapper rather than in the
  call, so running `cached.test.ts` — which injects a fake model — appended
  eight `$0.01` `gemini-test` entries to `.local/costs.jsonl`, $0.08 of spend
  that never happened. I removed exactly those eight lines (matched on
  `stage === 'analysis-keywords' && model === 'gemini-test'`) and verified the
  ledger back at 55 entries / $5.445002 before continuing. The ledger is
  append-only for *real* entries; leaving fabricated ones in would corrupt the
  all-time total permanently, which is worse than the edit. The architecture
  was then fixed so it cannot recur: `appendCost` now lives inside
  `runKeywordAnalysis`, at the point of spend, exactly as `hybrid.ts` does it,
  so a stubbed call cannot bill. The full suite was re-run afterwards and the
  ledger stayed at 55 lines.
- **`evictStaleEntries` gained a `stage` parameter** and the transcription
  call site now passes one. Without it, `MAX_ENTRIES_PER_VIDEO = 3` is a
  shared budget across stages and an analysis write could evict a
  transcription entry still in use. More entries are kept overall than before.
- **`spotcheck.ts` and `insertions-cli.ts` were modified again** to support
  per-row answers. Goal 7 asked for a differently-labelled row on an existing
  page, which the page-wide `choices` could not express. The existing rows and
  the timestamp pages a benchmark sweep produces are unchanged.
- **`analysis/select.ts` was split out of `keywords.ts`.** The goal named
  `keywords.ts`; the selection logic is pure and heavily tested, and mixing it
  with the network call would have made it awkward to test without a stub.
- **The mode file version was bumped 1 → 2** as part of goal 1, which also
  exercises the fingerprint's mode-version invalidation for real.
- **`propose` mode was run live** (a free cache hit) to confirm identical
  selection, then the plan was re-run in `auto` so the reel is left in the
  default state.

## Failures & open problems

- **Re-running `npm run transcribe` on a reel discards its keywords.**
  `transcribeVideo` builds a fresh plan and writes it, rather than merging
  into the existing one, so the analysis block is lost. Not fixed. It becomes
  a real problem as soon as two stages both write a plan, which is session 4.
- **The two enriched plans show `byStage` without a `transcription` key.**
  Both were written by transcribe runs that predate last session's fix, so
  they never had one; the analysis stage preserves `byStage` and adds its own.
  A plan written by current transcribe code would carry both. Not repaired,
  because repairing it means re-running transcribe, which per the point above
  would delete the keywords.
- **Stability was measured on one reel in one domain.** vitasilk has a brand
  name and a procedure name in it, which is the easiest possible case for this
  prompt. Nothing was measured on a reel where the strongest candidates sit
  close together, and test-1 was run once. Three runs on one reel is not a
  characterisation of the stage.
- **Scores are not stable and must not be compared across runs.** The same
  word scored 0.90 and 0.98 in different calls. Ranking survived because the
  gaps were wide; on a closer reel it may not.
- **Reasons are reworded on every call.** They are model prose, not data, and
  nothing downstream should key on their text.
- **The resolution-failure path has never fired on real data.** Zero failures
  and zero text mismatches across five live calls, so the drop-and-count
  behaviour is exercised only by unit tests.
- **`test-1`'s third keyword is `18 7ta l 25 chher`**, a four-word span that
  includes the inserted `7ta` flagged by the session-2 insertion analysis and
  still unlistened-to. If that token is a hallucination, a keyword is built on
  it.
- **The CLI's cost estimate is meaningless for this stage** — duration-based,
  passed 0, prints ~$0.0040 against ~$0.05 actual. The gate still works
  because actuals are checked after each call, but the number shown before
  spending is not informative.
- **The insertion spotcheck listening pass is still not done**, carried over
  from last session. Every row on all four pages remains unjudged, now
  including the new spelling question.
- **`analyse-cli.ts` has no unit tests.** Its behaviour was verified only by
  the live runs above.

## Repo state

- Branch: `main`. **Pushed** at the end of the session (see below).
- HEAD: `184d04c` `test: add the vidéo article token to the test-1 spotcheck`,
  plus the CLAUDE.md and report commit that follows it.
- Session commits: bd108ed, 6c2091d, cc949be, ff68e16, 986416e, 184d04c.
- `npm run check`: **PASS**, exit 0, `check: PASS` marker present.
  **419 tests** — core 50, service 224, benchmarks 145 (up from 363).
- Session spend: **$0.267718** over 5 billable calls, 5 ledger lines.
- Ledger all-time: **$5.712720** across 60 entries, up from $5.445002 / 55.

## Suggested next step

Session 4 should start by fixing the plan-merge gap rather than adding image
slots on top of it: right now two stages both write `<video>.editplan.json`
and the earlier one clobbers the later one's work, so the moment image slots
land there will be three writers and the failure will be silent — a plan that
looks complete but lost a stage. The cheap fix is for `transcribeVideo` to
read an existing plan and merge into it the way `analyseKeywordsForPlan`
already does, with the transcript hash deciding whether downstream blocks are
still valid or must be cleared. Doing that first also settles what happens
when a transcript changes underneath keywords that reference its word ids,
which is a correctness question the current code answers only by accident —
the analysis fingerprint invalidates, but nothing clears the stale
`keywords.items` already sitting in the plan.
