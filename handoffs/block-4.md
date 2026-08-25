# Handoff — Block 4: Image generation service
Date: 2026-08-25 · Conversation model: Claude Opus · Sessions run: 7

## Status vs BLOCKS.md

DoD met: **yes**, itemized against `vitasilk`:

- **All slots get candidates** — 5 slots × 2 candidates = 10, all `status: generated`.
- **Gated cutouts on disk with metrics** — 10 PNGs; every candidate carries the four §5.4 metrics, a `gate` verdict, `cutoutQuality` and a text verdict.
- **Costs recorded** — 10 ledger lines at the point of spend, $1.550444, actuals from `usageMetadata`, never the price table.
- **Cache prevents regeneration** — re-run: `10 already cached, 0 to generate`, `billed 0`, ledger sha unchanged. This was also the eviction fix's first full multi-batch test.
- Regression rule active: `npm run check` green, exit 0, **799 TypeScript tests** (core 121, service 512, benchmarks 166) plus **58 sidecar pytest tests**.

**Caveat qualifying all of it:** one reel. `vitasilk` is the only plan with candidates. `test-1` was deliberately not run ($1.21 buying no DoD item).

**The block's substantive result is not the DoD.** The quality gate passes 2 of 10 candidates. Four of the eight failures are genuine retained background; the pipeline as configured sends 80% of what it generates to the `card` fallback.

## Decisions made (and why)

1. **Image config frozen: `gemini-3-pro-image`, 2K, 1:1, 2 candidates per slot** (`docs/DECISION-image-config.md`). Pro won on **prompt fidelity, not prettiness** — it rendered droppers where flash drifted to pump-tops and caps, i.e. serum versus fragrance. The doc states plainly that the cutout metrics did **not** separate the two models and that the decision rests on the user's eye across three pairs; it must not be defended with the metrics.
2. **Two candidates, not three.** ARCHITECTURE §5.4's default was 3; pro's measured $0.151/image puts 3 candidates on a five-slot reel at $2.26, outside PROJECT_SPEC's $2.00 envelope. At 2 the reel costs ~$1.71 including transcription, leaving ~$0.29 — one regenerated slot, not a second pass.
3. **Never 4K.** The largest negative zone in a 2160×3840 frame is ~1700 px and image comps work at 1200×1200. 4K is paid-for pixels that get scaled away. Rejected in validation, 4K named.
4. **Text on products is allowed** (user ruling); **uncontrolled text is not.** `no text` left the negative prompt; OCR changed from a presence check to a **correctness** check against the slot's idea plus mode vocabulary. `HAIR SERUM` on a hair-serum slot passes; invented brand words are an advisory warning. Never a delete. Rationale: Block 2 saw one brand name emerge three ways across three identical calls.
5. **A negative prompt is not a control.** One pro image rendered legible English on a Darija reel despite `no text`. Detection, not instruction, is what enforces it. `no watermark` and `no logo` remain **untested** as controls.
6. **The halo bound stays 0.10, and the metric was fixed rather than the threshold.** `edge_halo` now excludes ring pixels bright in the original (luma ≥ 0.5). **The premise was refuted**: no ring pixel on any of sixteen images reaches the boundary (ring p50 0.022), zero verdicts changed, and the rendered rim lives *inside* the mask (inside-edge luma 0.921 vs 0.079 core). The four halo-alone failures are real retained background; raising the bound would admit real defects.
7. **Slot ideas must be single-subject** (user ruling). The mode invariant `one subject, centred and unobstructed` wins over multi-object ideas. Validated at plan time as a **hard failure naming the slot and phrase**, never a silent rewrite — the planner is what needs to change. Flags `img003` and `img005` on `vitasilk`, nothing on `test-1`.
8. **The plan records cumulative spend** (user ruling). `costs.spentUsd` / `spentByStage` accumulate across runs; `byStage` stays last-run for diffability. Named to read as *spent on this reel*, not *cost to produce* — a regenerated slot adds rather than replaces. Block 8's $2.00 soft alarm cannot read a number that vanishes on re-run.
9. **The cost ceiling is a running check, not a pre-flight one.** Session 3 overran $1.00 by $0.33 because the ceiling was evaluated once against an estimate and never again. It now sums actual ledger spend before every request and **aborts** rather than truncates. It estimates only *billable* images, so a fully cached re-run is never refused for want of budget.
10. **`IMAGE_COST_MULTIPLIER = 1.35`**, a deliberately pessimistic gate on the `THINKING_TOKEN_MULTIPLIER` precedent, with all observed ratios at the constant. **Twenty of twenty images billed over the published rate**, mean +15.7%, never under. The published per-image rate is a floor, not a price; the token count for a served aspect ratio is not derivable from area, so the table prices exact published (size, aspect) pairs only.
11. **Decision docs are tested against the constants they freeze.** Session 5's pre-flight caught `DEFAULT_IMAGE_CONFIG` still on flash-at-1K after pro-at-2K was frozen — ten wrong images would have passed every check. The test parses the markdown and asserts against code, and immediately caught `DECISION-transcription-config.md` recording prompt version 3 while the code had run 4 for three sessions.
12. **Analysis fingerprints on a content hash of the fields the call reads, not the mode version.** Mode v3→v5 bumped three times this block and every analysis entry still hit at $0.00. Without it, a font landing at Block 9 would bill a full re-analysis on every reel.
13. **BiRefNet pinned by sha256** (`58f621f0…`, 972,666,916 bytes), verified in `npm run check`, fails-as-well-as-passes. Block 10's DoD is a golden run green on both machines; an unpinned ~1 GB download means machine #2 can produce different mattes on identical input.

## Amendments proposed to plan/docs

All are written and verified against the repo in `docs/BLOCK4-AMENDMENTS.md`; the list below is the index.

- **PROJECT_SPEC §5 (Images)**: frozen config pointer to `docs/DECISION-image-config.md`; candidate default 2 with the arithmetic; slot ideas are single-subject and the planner may not write multi-object ideas; product text is permitted and checked for correctness rather than presence.
- **ARCHITECTURE §5.4**: four amendments — candidate count, cost-field semantics, the gate's measured yield, and the `edge_halo` definition including its light-background blindness. The section's base text had been absorbed into an amendment paragraph by an earlier edit and was restructured so it precedes them.
- **ARCHITECTURE §3**: twelve schema additions this block, every one confirmed optional by reading the type — `metrics`, `gate`, `detectedText`, `textVerdict`, `promptModeVersion`, `spentUsd`, `spentByStage` among them.
- **ARCHITECTURE §6**: composition fingerprints separately from analysis; analysis keys on content hashes rather than mode version.
- **CLAUDE_CODE_GUIDELINES §3**: decision docs are tested against their constants.
- **CLAUDE_CODE_GUIDELINES §4**: a defect report names the state it destroyed, not only that the defect occurred — session 3 reported the eviction fix unverified but not that two cache entries were gone, which made session 4's first instruction unrunnable.
- **`docs/DECISION-transcription-config.md`**: drift correction, `ACTIVE_PROMPT_VERSION` 3 → 4.

## Repo state

- `main` @ origin, clean tree, pushed. HEAD `6aca993` — `docs: sweep the block 4 amendments and record the halo precision`.
- New/changed top-level paths: `service/src/images/` (client, estimate, generate, cache, fingerprint, quality, job, CLI, probe mode); `tools/cv/` (Python 3.11 venv, pinned `requirements.txt`, `framopia_cv/` with `remove_bg`, metrics, gate, `text_check`, `models.json`, `verify-models.sh`, 58 pytest tests); `docs/DECISION-image-config.md`; `docs/BLOCK4-AMENDMENTS.md`; `modes/k2-syndicalia.json` at **v5**; seven session reports; four benchmark results files; `benchmarks/results/latest-imagebakeoff/` and `latest-cutouts/`.
- `npm run check` green, exit 0: 799 TS + 58 pytest, `references: PASS`, `models: birefnet-general ok`.
- **Block 4 spend $2.999710** across 21 billed images, of which **$0.514522 (17.2%) wasted** — all of it session 3's eviction defect. All-time **$10.555772** over 105 entries. Images are now the largest stage, ahead of transcription correction at $1.763362. Account balance ≈ **$8.45**.

## Known issues & risks

- **Gate yield is 2/10 and the halo fix did not improve it.** Four failures are genuine retained background. The options are down to two: accept `card` for these, or move the bound on evidence that does not exist yet. **Block 5's placement solver must handle both footprints** — a cutout and a card occupy negative space differently, and on current evidence most slots are cards.
- **The bound decides at the fifth decimal.** `img005-c1` passes by 43 parts per million, `img001-c1` fails by 422; five of sixteen sit within 0.35% of 0.10. Proposed answer, deferred to Block 8: a **borderline band** surfaced to the editor as "uncertain" rather than a binary verdict. PROJECT_SPEC §5 already gives the editor the override; the panel should say where the machine isn't sure.
- **A tension with no current answer:** the mode grounds everything against `#1A0000`, and the retained background *is* that near-black ground — a lighter backdrop would matte more cleanly, but `edge_halo` goes blind on a light ground by construction. The first client mode with a light ground needs this revisited, not trusted.
- **`edge_halo`'s exclusion path has never fired on real data.** No ring pixel on sixteen images reaches the 0.5 boundary; only the constructed case exercises it. Same shape as `edge_noise` and `hole_ratio` reading 0.00000 for a whole block before session 5's degradation test.
- **`img003` and `img005` are flagged but still on the plan.** Re-planning costs a Gemini call and was deliberately not spent, so the plan and the rule disagree. Honest, and it must be cleared before either is treated as a valid fixture.
- **The multi-subject marker list is incomplete by construction** — it misses `scientific molecular structures` in the very idea it flags on a different word. A hard failure built on a word list will keep missing cases.
- **The ledger has no reel identifier.** Cumulative per-reel spend can only accumulate forward; `vitasilk`'s `spentUsd` was **backfilled by hand** from ten attributable lines, so the accumulation path is not proven end-to-end from zero on real data.
- **Cutouts are not cached** — the sidecar re-ran all ten on the second pass (~3 minutes local CPU, no money) because it loads the ~928 MiB model per subprocess. Fine at five slots.
- **The "candidates disagree" presentation is untested on real data** — every slot's two candidates agreed, so `slotPresentation` returning null has never happened outside tests.
- **Two `gemini-3-pro-image` cache entries deleted in session 3 are permanently gone.** Regenerating them would produce different images; the corpus files stay authoritative and the cache stays incomplete.
- **Pro's wall clock is unexplained** — 33–215 s in session 3, 25–30 s in session 6.
- **`no watermark` and `no logo` have never been tested** as controls. Only `no text` was, and it failed.
- Carried forward: `cleaning.ts` has never marked a word on real footage across five reels; the Block 3 insertions listening pass is unjudged; the freeze-list fuzzy matcher still produces near-miss noise.
- **Session count:** BLOCKS.md estimated 3–4 and this ran 7. Sessions are estimates, not quotas. The extra went on two halted sessions (an `aspectRatio` defect, depleted credits) and on the gate work the plan did not anticipate.
- **External-SSD dependency:** any session without the T7 mounted stops immediately (`Status: PROBLEM`).

## Exact next steps

1. **Block 5 prompt #1:** the CV sidecar already exists with a pinned model, a venv and a JSON contract — add `segment_person` to it rather than starting fresh. MediaPipe Image Segmenter per ARCHITECTURE §1.4, with YOLO11-seg assessed on real frames and the decision recorded. Visual debug output (frames with overlaid masks) from the first session, because that is how the DoD is judged.
2. Then per BLOCKS.md Block 5: `compute_zones` (stability + validity windows), the placement solver honouring subtitle-band and concurrency constraints with bounded jitter, the manual-zone data model and service endpoints.
3. Apply the amendments in `docs/BLOCK4-AMENDMENTS.md` to the project-knowledge docs.
4. Whenever a second fixture is worth $1.21: clear the two flagged ideas on `vitasilk` (one Gemini analysis call) and run `test-1`.

## User inputs collected this block

- **Candidate-count and model ruling:** pro at 2 candidates, after reviewing six images — chosen for prompt fidelity (droppers vs pump-tops) rather than appearance.
- **Rim-light ruling:** the bright edge is present in the original, not created by the cutout. This is what kept the halo threshold from being wrongly loosened, and it seeded the metric fix that then refuted its own premise.
- **Text ruling:** product text is permitted; the check became correctness rather than presence.
- **Single-subject ruling:** the mode invariant wins over multi-object slot ideas.
- **Cost ruling:** the plan records cumulative spend per reel.
- **Lighting rulings:** `no modelling` and `shadows barely readable` pruned from the axis; a diffuse-and-modelled entry is the user's to write at Block 9, like the fonts.
- **$10 Gemini prepayment top-up** after credits depleted mid-block; ≈$8.45 remains.
