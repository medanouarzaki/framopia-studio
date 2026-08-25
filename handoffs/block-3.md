# Handoff — Block 3: Semantic analysis
Date: 2026-08-25 · Conversation model: Claude Opus · Sessions run: 6

## Status vs BLOCKS.md

DoD met: **yes**, itemized:

- **Analysis on the Block 2 fixture yields sensible keywords/slots, user eyeballs once** — yes. `vitasilk` and `test-1` both carry 3 keywords covering label and promise, and 5 and 4 image slots respectively with fully composed prompts. User reviewed and approved the final output at the close of session 6.
- **Deterministic given same inputs** — yes, *through the cache*, which is the only place it can hold. A cache hit reproduces selection byte-identically. Everything downstream of the model response is deterministic and tested. The Gemini call itself is not reproducible and no code comment, doc, or report claims otherwise.
- **Cached** — yes. Analysis fingerprint covers prompt version, model pin, mode id and version, transcript content, and candidate count; a mode version bump invalidates, verified live.
- Regression rule active: `npm run check` green, exit 0, **588 tests** (core 69, service 374, benchmarks 145).

**Caveat qualifying all of it:** every figure comes from two reels. Keyword selection is stable on `vitasilk` across four calls and wobbles on `test-1` across three.

## Decisions made (and why)

1. **Keyword criteria: label and promise are co-primary.** Sessions 3–5 selected six keywords and all six were names, because the original ranking (semantic weight primary, brand/domain vocabulary as tiebreak) let the model pick nameable nouns. The user ruled that both the label (product, brand, procedure) and the promise (benefit, result, claim) must be covered. **The mix is enforced in the pure selector, not asked of the model** — at least one of each per reel.
2. **Keyword count stays at 3.** PROJECT_SPEC §5's 3–5 per 30 s, pro-rata at a midpoint of 4, rounded, floored at 1. The user chose to force the mix within the locked number rather than loosen it, with the explicit note that raising it is a one-line change if Block 7's built comp reads thin.
3. **Keyword spans capped at 2 words.** TEMPLATE_LIBRARY_GUIDE §4 designs keyword templates for 1–2 short words; session 3 produced a five-token span. Longer candidates are narrowed to the strongest 1–2 contiguous tokens, never dropped. The prompt also asks for short spans, so narrowing is a fallback rather than the norm.
4. **A §6 Arabic-script domain term of 3+ tokens is narrowed for emphasis only.** The term renders whole and correctly spelled in the subtitle track; the emphasis layer selects a subset of it. Resolved toward the template contract because the text must physically fit a comp built for two words.
5. **Head-term diversity enforced**, after session 3 spent two of three emphasis moments on collagen stimulation. A label and a promise about the same product are explicitly *not* duplicates.
6. **The conjunction `w` attaches to the following word** (ORTHOGRAPHY_GUIDE v1.0.7). Ruled for a display reason — a standalone `w` is a legal group of one and would flash a single character for ~100 ms. It proved to be the dominant cause of the production-vs-run-C WER gap: 22 attached, 0 standalone across five reels after the prompt fix, and WER inverted on three of four reels.
7. **The French article is decided by what was spoken.** §2's attached article is the Arabic `l-` and governs Darija nouns; a French noun spoken with its French article keeps it (`dial la vidéo`), while a French-rooted noun with Darija morphology takes the attached form (`dial lvitaminat`). Settled by the user's ear on the spotcheck row.
8. **Display timing is separate from speech timing.** Word timings remain the single timing authority per ARCHITECTURE §3 and were never modified. Subtitle groups gained `displayStart`/`displayEnd`, extending forward into silence to reach the template's floor, merging with a neighbour only where the result stays ≤2 words and neither group is keyword-superseded. Chosen over constraining Block 6's motion design to near-zero-intro templates.
9. **A keyword span replaces its subtitle group's rendering**, recorded explicitly in the plan rather than left for Block 7 to infer. Grouping became keyword-aware via a re-grouping pass in the analysis stage: before, 4 of 6 keywords had no single group to replace (2 straddled two groups); after, all 6 align exactly, none dropped, every group still ≤2 words.
10. **Template assignment is deterministic via seeded shuffle** with a no-adjacent-repeat constraint, seeded from element id and `meta.id`. Replaced session 4's strict rotation, which produced a visible A,B,C cycle across 42 elements — determinism satisfied, PROJECT_SPEC §1's "no robotic uniformity" not.
11. **Images: palette dominant, everything else varies.** `imageStyle.stylePrompt` is the invariant half carrying the mode palette; `imageVariation` (composition, lighting, crop) varies per slot, drawn deterministically from slot index and `meta.id`. Prompt rules: the idea reads clearly at a glance, and nothing in frame that is not carrying the idea. Palette dominance reads from the active mode file — it is per-client, never hardcoded.
12. **Schema fragility rule, now standing:** `readEditPlan` validates on read, so a structural schema addition makes every previously written plan unopenable, including for migration. Session 5 hit this and backed out. Every future schema addition is optional-with-default or ships a migration path that does not read through the new validator.
13. **`appendCost` fires at the point of spend only.** Session 3's first `cached.ts` billed in the wrapper, so unit tests injecting a fake model wrote **eight fabricated ledger lines totalling $0.08**. They were identified, removed, and the ledger verified back at 55 entries / $5.445002 before work continued. Restated here because `.local/costs.jsonl` is gitignored and the reports are the only permanent record.

## Amendments proposed to plan/docs

- **ORTHOGRAPHY_GUIDE.md → v1.0.7** (in repo; replace the project-knowledge copy): `w` attaches to the following word; the French-article rule of decision 7; the emphasis-narrowing note of decision 4.
- **PROJECT_SPEC.md §5 (Important words)**, add: "Keyword selection must cover both the label (product, brand, procedure name) and the promise (the benefit or claim). The mix is enforced in code, not requested of the model. Spans are capped at 2 words to match the keyword template contract; longer candidates are narrowed, never dropped."
- **PROJECT_SPEC.md §7**, add: the standalone-`w` tokenization mismatch accounted for the bulk of the production-vs-benchmark WER gap. After v1.0.7 the production hybrid beats the Block 1 run-C hybrid on three of four reels (test-1 14.7% vs 20.6%, test-2 22.9% vs 28.6%, test-3 16.7% vs 18.3%; fr/en 0.0% on test-1 and test-2). Reference defects (curly apostrophes, one wrong article) were real but minor by comparison.
- **ARCHITECTURE.md §3**, six schema departures introduced this block — full verbatim table in `reports/block-3-session-6.md`, including subtitle display timing, keyword-group supersession, the transcript content hash, and the keyword `kind` field. All optional-with-default per decision 12.
- **ARCHITECTURE.md §6**, add: the analysis stage has its own fingerprint covering analysis prompt version, model pin, mode id and version, transcript content, and candidate count. `evictStaleEntries` is now stage-scoped — without it `MAX_ENTRIES_PER_VIDEO` was a shared budget and an analysis write could evict a transcription entry still in use.
- **CLAUDE_CODE_GUIDELINES.md §3**, add the schema fragility rule (decision 12) and the point-of-spend billing rule (decision 13).

## Repo state

- `main` @ origin, clean tree, pushed. HEAD region: `e796673`, session-6 close-out.
- New/changed top-level paths: `service/src/analysis/` (count, keywords, select, slots, regrouping, template assignment, sfx derivation, buildability, fingerprint/cache/cached, job), `templates/manifest.json` (stub), `assets/sfx/sfx.json` (stub, **no audio files exist**), `modes/k2-syndicalia.json` (v2), six session reports, five benchmark results files.
- `npm run check` green, **588 tests** (core 69, service 374, benchmarks 145).
- **Block 3 spend $2.735836 over 37 calls.** All-time $7.556062 across 84 entries. Roughly half of Block 3's spend was session 6's forced cache invalidation.

## Known issues & risks

- **18 subtitle groups remain unbuildable** (vitasilk 10 of 42, test-1 8 of 39, down from 31 and 25). Every image slot passes. Real template timings arrive in Block 6 and may absorb the rest; nothing was artificially extended.
- **Zero-duration words exist.** vitasilk's g016 holds a word whose start equals its end, produced by alignment interpolation. Reported, not repaired — a Block 2 alignment defect carried forward.
- **`ground-truth`'s reference is non-conformant to v1.0.7** (standalone `w` in `Mabin 7essa w 7essa`, `wa7d l cocktail`). Six exact tokens named in the results file. Ruled: correct mechanically in Block 4 session 1 and re-score free. Until then its +6.2 figure penalises a correct transcript.
- **Keyword span boundaries wobble on test-1** (`شد` vs `شد طبيعي` across identical calls) while `vitasilk` held across four. Same moment, different span length. Scores move 0.90–0.99 on the same word and reasons are reworded every call — neither is data.
- **Two `7ta` tokens remain genuinely ambiguous** and were deliberately left in the references.
- **Code paths never executed against real data:** narrowing, diversity skipping, all three re-group drop reasons, `--force`, and the entire multi-variant template assignment path. The transcript-changed merge branch fired for real in session 6.
- **The language cross-check fires zero times on all five plans.** Intended after the lexicon pruning — it only speaks where spelling decides — but a check with no firings on real data is indistinguishable from a disabled one.
- **Cleaning has still never marked a word.** Five reels, 343 draft words, zero fillers or repeats. The footage is scripted; unit tests remain its only evidence.
- **The freeze-list fuzzy matcher still produces near-miss noise** on forms §4 names as correct. Third block open.
- **Two of test-1's three keywords are Arabic script**, meaning RTL text in a keyword template. Block 6 must know this before templates are built and Block 7 before ExtendScript sets Source Text.
- **Preview model pin** `gemini-3.1-pro-preview`. Watch for GA release or retirement notices.
- **Session count:** BLOCKS.md estimated 2–4 and this ran 6. Sessions are estimates, not quotas; no amendment needed.
- **External-SSD dependency:** any session without the T7 mounted stops immediately (`Status: PROBLEM`).

## Exact next steps

1. **Block 4 prompt #1:** correct the six standalone-`w` tokens in the `ground-truth` reference to ORTHOGRAPHY_GUIDE v1.0.7, bump and re-score from recorded outputs (free); then begin image generation — Gemini image API wiring, per-mode style prompting from the composed prompts already sitting in both plans, 2–4 candidates per slot.
2. Then per BLOCKS.md Block 4: Python sidecar `remove_bg` (rembg/BiRefNet), quality metrics and gate with card fallback, caching keyed on prompt fingerprint, per-image cost tracking, regenerate-with-tweak and own-prompt endpoints.
3. Apply the amendments above to the project-knowledge docs.

## User inputs collected this block

- **Keyword criteria ruling:** semantic weight first, brand/domain vocabulary second, delivery not a criterion; later extended to label *and* promise, count held at 3.
- **Image prompt rulings:** idea clear at a glance; nothing in frame not carrying the idea; client-mode palette dominant; composition, lighting and crop vary across slots so the set reads as designed rather than batched.
- **Orthography rulings:** `w` attaches to the following word; the French article follows what was spoken (`dial la vidéo`).
- **Listening pass over 16 flagged tokens** — all recoveries, zero hallucinations. Twelve of the flagged insertions turned out to be tokenization artifacts rather than reference omissions; only one reference edit was warranted.
- **Final eyeball** on both reels' keyword and slot output: approved.
