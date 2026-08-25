# Handoff — Block 2: Transcription production pipeline
Date: 2026-08-25 · Conversation model: Claude Opus · Sessions run: 7

## Status vs BLOCKS.md

DoD met: **yes**, itemized against the live `vitasilk` run of session 7:

- **A real reel produces a correct, cached, validated Edit Plan with transcript + groups** — yes. `my files/test videos/vitasilk.editplan.json`, 74 words, 40 groups all of size 1–2, every group `wordId` resolving to a transcript word, `schemaVersion: 1`. `writeEditPlan` validates before writing, so an invalid plan cannot reach disk.
- **Re-run hits cache** — yes. Run 1 miss $0.136398 / 86.6 s; run 2 hit $0.0000 / 2.7 s, no ledger line written. Plans differ in exactly `createdAt`, `updatedAt`, `completedAt` and cost bookkeeping; normalising those, byte-identical.
- **Unit tests on merge/grouping/cleaning** — yes. `align.test.ts` (20 tests), `grouping.test.ts` (14), `cleaning.test.ts` (9).
- Regression rule active: `npm run check` green, exit 0, **327 tests** (core 23, service 168, benchmarks 136).

**Caveat that qualifies all of the above:** every DoD item is met on exactly one reel. `vitasilk` is the only video that has ever produced an Edit Plan.

## Decisions made (and why)

1. **The noise floor is 3.7 WER points** (14.8 / 16.0 / 18.5 on three identical correction calls — same recorded Scribe draft, same prompt, same everything — scored against the `v1.0.1-conformant` reference). Any prompt effect smaller than this is not measurable at n=1. **Consequence for Block 1: its headline "hybrid beats gemini-alone by 1.8 points" sits entirely inside the noise and must never be quoted as evidence again.** The freeze itself stands — it rested on the human timestamp spotcheck (hybrid 14/15 vs gemini 9/15), a far larger margin. The earlier 2.5-point figure is superseded; results files scored against the pre-correction reference carry supersession notices.
2. **Prompt version 3 is active** — version 1 plus a per-word `lang` request, nothing else changed. Activated on two criteria set before the run: the six Arabic-script domain terms tagged `msa` in all three runs (18/18, against 6/18 under guide v1.0.5), and WER mean 15.6% against version 1's 15.2% — a 0.4-point delta inside the 3.7-point floor. Recorded as an amendment in `docs/DECISION-transcription-config.md`. **Honest reading:** the criteria were chosen to be decidable, not conclusive; the guide fix moved version 3 from the wrong side of a coin flip to the right one rather than proving it better.
3. **Prompt version 2 rejected, retained in code for reference.** Its `و` → `w` rule fixed a corruption that occurred in neither version on any reel — zero standalone `ou` across sixteen transcripts. Replaced by detection in the conformance scorer, which costs nothing and works on every future run. The session-3 experiment that produced version 2 varied two things at once and ran each arm once; it is uninterpretable and is labelled as such in its results file.
4. **ORTHOGRAPHY_GUIDE v1.0.3 → v1.0.6**, three bumps, each measured against the floor:
   - **v1.0.4** — `bach` frozen in §4. Its absence let the conformance matcher flag it as a near-miss of `wach` while both were spelled correctly.
   - **v1.0.5** — `dial` is always written separate from the following word (`dial l7loul`, never `dl7loul`); pronoun suffixes stay attached (`diali`, `dialha`). Six of the twelve tokens unstable across identical calls were this one word. The rule took: 5/5 governing occurrences separate in all three runs, token stability 69/81 → 79/81.
   - **v1.0.6** — a term written in Arabic script under §6 is tagged `msa`. `script` is read off the characters; `lang` is a property of the word; tagging a term `darija` because its neighbours are Darija is the clause-level reasoning §6 already rejected at term level. Tag stability 75/81 → 81/81.
5. **The ground-truth reference was non-conformant and was corrected.** `dl 7olol` / `dl 7essass` / `dl vitaminat` → `dial l7olol` / `dial l7essass` / `dial lvitaminat`, noun spellings preserved exactly. This was a **v1.0.1** violation, not a v1.0.5 one — §4 has listed `dl`/`dla` as superseded since v1.0.1 (eleven `dial` against three `dl`). Every run improved 4.9–6.2 points from the reference edit alone, **except** noise-floor run 3, which was unchanged and went from best-of-six to worst: it had been winning only because the reference agreed with the form the guide forbids.
6. **References are versioned.** `ground-truth` and `test-3` are `v1.0.1-conformant`; **`test-1` and `test-2` are `v1.0-unrevised`** — they contain real violations (`dla vidéo`, `joj dl 7essass` ×2), found by scorer rather than by eye, reported and deliberately not fixed. Version markers propagate through `bench:tag` into `GroundTruth.version`, so every scored result can name its reference.
7. **Vowel-less cluster detection is a warning, not a score component.** It cannot separate correct schwa-drops (`jbt`, `ymkn`, `ch3rk`, `msbsb`) from unreadable clusters (`7l`, `l7l`) without syllable modelling; as a scored rule it cost a previously perfect transcript 6.8 points. `findOuConjunctions` and `findDialAttachment` remain scored — both detect unambiguous stated rules.
8. **`THINKING_TOKEN_MULTIPLIER` raised 5 → 15**, deliberately pessimistic and documented as a gate rather than a best estimate, with all observed ratios and their sources in the comment. Observed ratios ran 5×–30.2×. A spend gate can only protect from above; actuals still come from `usageMetadata` and are never estimated.
9. **Cost variance is ±58%.** Three identical calls cost $0.1074 / $0.1630 / $0.1692 with wall-clock spanning 3.6×. No single-call cost figure anywhere in this repo is better than ±20%.
10. **npm workspace with `@framopia/core`**, killing the `config.ts`/`costs.ts` duplication Block 1 flagged. Core also holds pricing, `paths.ts`, `SCRIPT_RULES`, `normalizeToken`, `align`, `appVersion()`. Consumers import core's **built** output, so core builds first in every script.

## Amendments proposed to plan/docs

- **PROJECT_SPEC.md §7**, add: "WER differences below ~3.7 points on a single 23-second reel are within measured run-to-run variance of the Gemini correction pass and are not evidence. Prompt or guide changes are validated by three runs per arm against the recorded noise floor, never by a single run. Two changes are never bundled into one experiment."
- **PROJECT_SPEC.md §7**, add: Block 1's 1.8-point WER margin between hybrid and gemini-alone is inside the noise floor and is retired as evidence; the freeze rests on the timestamp spotcheck (hybrid 14/15 vs gemini 9/15).
- **ARCHITECTURE.md §3**, record the Edit Plan departures now in force: `lang` nullable (model omission or pre-v3 cache entry — no longer the normal case, since version 3 tags 81/81), `clientMode` and `watermark` nullable (transcription runs before a mode is chosen and before the watermark file is measured), and `PlanWord.langDisagreement` added — the schema had nowhere to say that two sources conflict.
- **ARCHITECTURE.md §6**, add: the cache fingerprint covers `ACTIVE_PROMPT_VERSION`, the Gemini model pin, the ORTHOGRAPHY_GUIDE version (read from the file, so a bump invalidates automatically), and the Scribe model id. Eviction keeps `MAX_ENTRIES_PER_VIDEO = 3` per video hash by manifest mtime; the bound is chosen, not measured.
- **CLAUDE_CODE_GUIDELINES.md §3**, add: reference transcripts carry a `# reference-version:` header; a change to any reference is versioned and everything re-scored, never silently applied.
- **ORTHOGRAPHY_GUIDE.md**: at v1.0.6 in-repo; the project-knowledge copy should be replaced with the repo version.

## Repo state

- `main` @ origin, clean tree. HEAD: `docs: update operating memory for the end of block 2`.
- New/changed top-level paths this block: `core/` (shared package: config, cost ledger, pricing, model pin, paths, script rules, alignment, app version); `service/src/transcription/` (scribe, correction with three prompt versions, hybrid, align, tagging, cleaning, grouping, cache, fingerprint, cached, plan-builder); `service/src/editplan/` (types, validate, io); `scripts/check.sh`; `handoffs/block-1.md`; seven session reports; six benchmark results files (`RESULTS-block1*.md`, `-robustness.md`, `-promptv2.md`, `-noisefloor.md`, `-dialrule.md`, `-langtagging.md`).
- Regression check: `npm run check` green, exit 0, **327 tests** (core 23, service 168, benchmarks 136).
- **Block 2 spend: $2.568100** across 23 ledger lines. Block 1 was $2.252126; all-time $4.820226. Roughly 70% of Block 2's spend went on measuring variance and prompt changes rather than on transcription itself — that is what establishing the noise floor cost.

## Known issues & risks

- **Everything is proven on one reel.** `vitasilk` is the only video that has produced an Edit Plan. The noise floor, all three guide bumps and the version-3 activation rest on three runs of one 23-second Block 1 reel.
- **Cleaning has never marked a word on real output.** No filler or stutter has appeared in any real transcript. `removed`/`removedReason` and the "removed words never group" path are covered by unit tests only. This may mean the speaker doesn't produce them, or that the rule doesn't fire when it should — nothing yet distinguishes those.
- **`readEditPlan` is called by nothing** outside its own tests. The schema-version gate has never run in anger.
- **`mixed` has never been produced** by any run, live or replayed. `en` appeared for the first time in session 7 (8 words on the vitasilk plan).
- **`test-1` and `test-2` are non-conformant references.** Any WER scored against them is measured against a reference that violates a stated rule — the same situation `ground-truth` was in until session 6. Ruled: correct them in Block 3, then re-score.
- **`deriveLang`'s French lexicon wrongly claims `filler`.** The language cross-check's only real firing to date was its own error (model said `en` in "le filler glow", derivation said `fr`; the model is defensible). Ruled: fix in Block 3. A cross-check that cries wolf gets ignored.
- **Eviction has never fired on real data** (two entries against a bound of three) and it ranks by manifest mtime, so a constantly-read entry looks as stale as an abandoned one. Nothing prunes whole video directories.
- **The freeze-list fuzzy matcher still produces near-miss noise** on forms §4 explicitly names as correct (`dialo`) but that the list does not carry.
- **Preview model pin** `gemini-3.1-pro-preview` — watch for GA release or retirement notices. A swap is a config edit.
- **Orthography conformance cannot judge Arabic-script words.** Carried from Block 1 and still open: §6 describes domain terms in prose with no enumerated term list, so nothing automated can check whether the model chose the right script. A seed list mined from real reels is Block 3 work; K2's real vocabulary arrives at Block 9.
- **Accepted gap:** `vitasilk`'s Darija timing spans — roughly 60% of that reel — have no automated or human check. The 0 ms cross-engine deviation figure covers 29 of 73 tokens, all French/English code-switches, because hybrid transliterates Darija out of text-matching range. The user was asked twice for a spotcheck; this is recorded as accepted, not covered.
- **Session count:** BLOCKS.md estimated 3–5 sessions and this block ran 7. Sessions are explicitly estimates rather than quotas, so no amendment is needed — the extra two went on establishing the noise floor and on two guide bumps the plan did not anticipate.
- **External-SSD dependency:** any session without the T7 mounted must stop immediately (`Status: PROBLEM`).

## Exact next steps

1. **Block 3 prompt #1:** correct `dl`/`dla` in the `test-1` and `test-2` reference files and version them `v1.0.1-conformant`, re-scoring everything against them; fix the `filler` entry in `deriveLang`'s French lexicon; then run the four Block 1 reels through the live CLI (~$0.45) — the first evidence the pipeline generalises past `vitasilk`, and the only way to learn whether cleaning ever fires.
2. Then per BLOCKS.md Block 3: keyword detection (auto + propose modes, scores + reasons), image slot planner (5–6 per 30 s, spread, prompts composed from mode style fragments + global negatives), deterministic template assignment from the mode's allowed variants, SFX event derivation against a stub manifest, Edit Plan enrichment + tests.
3. Apply the amendments above to the project-knowledge docs.

## User inputs collected this block

- **One additional reel:** `vitasilk.mov` (25.692 s, 2160×3840, 29.97 fps, ProRes, pcm_s24le 48 kHz), second speaker (woman), hair-product domain, one-off test footage rather than a client. In `my files/test videos/`, catalogued in `benchmarks/footage.json` with no ground truth.
- **Orthography rulings** across three guide bumps: `bach` frozen; `dial` written separate; Arabic-script domain terms tagged `msa`; hair-care vocabulary explicitly **not** admitted to §6(a) — §6(a) is scoped by clinical register rather than by body part, and its existing anatomical-regions bullet already covers hair discussed clinically.
- **Ruling** that the ground-truth reference be corrected to the frozen `dial` spelling rather than the rule relaxed, and the same for `test-1`/`test-2` in Block 3.
- **Finding for Block 3 and Block 9:** one brand name came out three different ways across three calls of the same prompt (`Vita Silk`, `Vita silk`, `Vitasilk`), which makes mode-vocabulary keyterm wiring load-bearing for proper nouns.
