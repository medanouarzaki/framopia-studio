# Handoff — Block 1: Repo foundation + transcription benchmark
Date: 2026-08-24 · Conversation model: Claude Opus · Sessions run: 6

## Status vs BLOCKS.md
DoD met: **yes**, itemized:
- Benchmark ran on real footage: yes — 4 real reels (88.8 s total), 4 engines, three scored runs (A/B/C).
- Configuration frozen with recorded evidence: yes — hybrid; evidence in `docs/DECISION-transcription-config.md` + `benchmarks/RESULTS-block1.md` (runs A and B preserved in sibling files).
- Repo builds and checks green: yes — `npm run check` green, 127 tests (service 14, benchmarks 113).

## Decisions made (and why)
1. **Frozen transcription config: HYBRID** — Scribe v2 batch (timestamps + raw pass) → Gemini `gemini-3.1-pro-preview` correction pass (audio + Scribe draft + ORTHOGRAPHY_GUIDE v1.0.3 + shared SCRIPT_RULES) → Levenshtein anchor alignment onto Scribe timings, linear interpolation for unmatched words. Run C: 24.8% overall WER, 26.1% darija, 6.5% fr/en, p90 5 ms vs Scribe. Rejections: scribe-alone (outputs Darija in Arabic script — cannot meet the Arabizi spec alone), gemini-alone (timestamp drift, human-verified 9/15 spotcheck with accumulating offset), whisper (translates Darija to MSA; retained only as free liveness check).
2. **Human timestamp evidence is part of the freeze record**: user spotcheck on ground-truth reel — hybrid 14/15 hits, gemini 9/15 with accumulating drift. The freeze rests on timestamps more than on the 1.8-point WER margin.
3. **Orthography guide frozen at v1.0.3** through three user-decision rounds: ق always `9`; definite article attached (`lkhdma`); frozen `nchaalah`, `bzaf`; `dial`/`diali` (overrode draft's `dyal` — user habit wins, settled 2026-08-24); French/English keep proper spelling with accents; numbers as digits (standalone digit tokens are numbers; 3/7/9 remain letters in-word); Arabic script for medical/aesthetic domain terms (procedures, anatomy, substances, register outcome phrases), **term-level only** — connective/function words stay Arabizi (rejected clause-level: a word's script must not depend on its neighbours); +23 freeze-list words mined from ground truth.
4. **ElevenLabs**: Starter plan ($6/month, recurring — the project's only fixed cost), API key restricted to Speech-to-Text only, auto-disable-if-leaked on. Actual Scribe batch price $0.22/audio-hour (docs said ~$0.40 — cheaper than planned).
5. **Google**: AI Studio key with billing. New key format `AQ.` prefix (mid-rollout) — config validation accepts both `AIza` and `AQ.`; never reject on prefix. Usage draws down $300 trial credit + $10 prepaid first; card charges begin only after those.
6. **Reporting convention (amendment, binding for all future Claude Code prompts)**: every session writes `reports/latest.md` (always overwritten — the only file the user reads) AND `reports/block-N-session-M.md` (archive). First line: `Status: OK` or `Status: PROBLEM — <cause>`.
7. **Repo relocated**: lives at `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (external APFS SSD; must be mounted for any session). Footage inside the repo folder under `my files/test videos/` (gitignored). Stale `~/dev` copy must not be touched.
8. **Pre-existing repo content archived**: `framopia-studio` on GitHub already held an unrelated Python/FastAPI implementation; its tip is preserved at branch `archive/python-backend-2026-07-21`.
9. **Ground truth**: written by the user for all four reels (~92 s — equals the planned 1–2 min subset, spread over 4 files), no timestamps by design; timestamp quality assessed via cross-engine deviation + human spotcheck HTML instead.
10. **Spotchecks mirror to a stable path** `benchmarks/results/latest-spotcheck/<reel>-<engine>.html` on every run (per-reel naming, deliberately not a single overwritten pair).

## Amendments proposed to plan/docs
- **HANDOFF_PROTOCOL.md §3** (Claude Code prompt requirements), add: "Every prompt restates the reporting convention: write `reports/latest.md` (overwritten) plus the per-session archive file; first line `Status: OK` or `Status: PROBLEM — <cause>`."
- **PROJECT_SPEC.md §7**: already amended in-repo (one line pointing to `docs/DECISION-transcription-config.md`, which wins where they disagree).
- **PROJECT_SPEC.md §2 / ARCHITECTURE.md §7** (dev environment), add: "Repo and footage live on the external T7 Shield SSD (APFS) at `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`; the drive must be mounted for any session. `.local/` (keys, caches, ledger) exists only there — code safety comes from GitHub, `.local/` has no second copy."
- **PROJECT_SPEC.md §7 note**: Scribe batch is $0.22/audio-hour (not ~$0.40). Gemini 3.x bills thinking tokens at output rate (`thoughtsTokenCount`), ≈5× visible output on this workload → transcription of a 90 s reel ≈ $0.35–0.55 and ~5–7× realtime. Per-reel envelope unchanged ($0.80–1.60 incl. images) but "transcription is negligible" is retired.
- **ORTHOGRAPHY_GUIDE.md**: at v1.0.3 in-repo; project-knowledge copy should be replaced with the repo version.

## Repo state
- `main` @ origin, clean tree. Session-6 HEAD region: `docs: record the block 1 config freeze in operating memory` (preceded by freeze-decision, run-C results, spotcheck-mirror, per-engine aggregate resolution commits).
- New/changed top-level paths this block: `service/` (config/server/jobs/costs skeleton, 14 tests), `benchmarks/` (full harness: scorers, engines, runner, spotchecks, `RESULTS-block1*.md`, `footage.json`, `freeze-list.json`), `docs/DECISION-transcription-config.md`, `reports/` (6 session reports + `latest.md`), `CLAUDE.md` current.
- Regression check: `npm run check` green, 127 tests, typecheck + lint clean.

## Known issues & risks
- **Evidence base is thin**: 88.8 s, one speaker, one domain (aesthetics). Hybrid's margin over rejected configs is wide; its 1.8-point WER margin over gemini-alone is within plausible noise — the freeze is safe because of timestamps, not WER. Revisit if production reels behave differently.
- **Preview model pin**: `gemini-3.1-pro-preview` (gemini-2.5-pro was retired mid-block; no GA Pro exists). Model swap is a config edit in `bench-config.json`; watch for GA release or retirement notices.
- **`ou`/`و` corruption in the hybrid path** (correction pass resolving Arabic و to French `ou`): did not recur in run C but nothing prevents it; Block 2 prompt-fix candidate.
- **Orthography conformance scorer cannot judge Arabic-script words** (48 in run C) — the §6 domain-term rule is unscoreable without a term list that doesn't exist yet. Also freeze-list fuzzy matching skips words <4 chars.
- **Cross-run WER comparability**: ground truth changed between runs (v1.0.1→v1.0.3), so scribe/whisper columns moved without their outputs changing; never compare columns across runs A/B/C casually.
- **`config.ts`/`costs.ts` duplicated** between `service/` and `benchmarks/` (no npm workspace yet) — ledger format drift risk; unify in Block 2.
- **One ledger line understates** (single Gemini call at session-4 19:50:06, written before the thinking-token fix).
- **Bench CLI paths resolve relative to `benchmarks/`**, not repo root (documented, not changed).
- External-SSD dependency: any session without the T7 mounted must stop immediately (`Status: PROBLEM`).

## Exact next steps
1. **Block 2 prompt #1**: cheap robustness check first — one reel from a second speaker or non-aesthetics domain (~$0.14) through the frozen config, recorded as evidence-base widening; then begin the production pipeline: npm workspace unification (kill the config/costs duplication), production hybrid module in `service/` (port from benchmark code, address `ou`/`و` with an explicit prompt rule), Edit Plan schema v1 implementation.
2. Then per BLOCKS.md Block 2: language/script tagging, cleaning flags, subtitle grouping, confidence propagation, caching, CLI entry; regression rule active (`npm run check` at every session end, result in report).
3. Apply the amendments above to project-knowledge docs.

## User inputs collected this block
- ElevenLabs Starter subscription + STT-restricted API key; Google AI Studio key (`AQ.` format) with billing (prepaid $10 + $300 trial credit). Keys in `.local/config.json` (T7), never in transcripts.
- 4 raw reels (~22 s each, 2160×3840@29.97) at `my files/test videos/`, catalogued in `benchmarks/footage.json`.
- Hand-written ground truth for all four reels in `.local/ground-truth/` (UTF-8; RTF mishap recovered via `textutil -format rtf`).
- Orthography decisions (§9 + three follow-up rounds) — now law in ORTHOGRAPHY_GUIDE v1.0.3.
- Timestamp spotcheck evidence: hybrid 14/15, gemini 9/15 with accumulating drift.
- Operational preferences: `reports/latest.md` single-file monitoring; maximal automation (manual steps only where technically unavoidable).
