# TASKS.md — Framopia Studio Working Task List

This is the **working checkbox list** for Executors. Tick a task when it is done (change `[ ]` to `[x]`).
The full task descriptions, acceptance criteria, and notes live in `docs/FRAMOPIA_STUDIO_TASKS.md`.

Status legend: `[ ]` TODO · `[~]` IN-PROGRESS · `[x]` DONE · `[B]` BLOCKED · `[H]` HUMAN (AE work)

---

## M0 — Foundations

- [x] **T-000** GitHub + git tooling bootstrap (one-time auth)
- [x] **T-001** Repo scaffolding + state files + create/push private repo
- [x] **T-002** Python backend project + tooling + /health
- [ ] **T-003** Scripted, idempotent Mac environment setup
- [x] **T-004** Edit Plan schema (Pydantic) + golden example + validator
- [x] **T-005** Config + secrets + cost-control scaffolding

## M1 — Backend pipeline (no After Effects)

- [x] **T-101** Job workspace + job manager + async runner
- [x] **T-102** Ingest stage
- [x] **T-103** Audio extraction (ffmpeg)
- [x] **T-104** Gemini client (asr/understand/image) — mockable
- [x] **T-105** ASR stage (transcript_raw.json)
- [x] **T-106** Correction gate API (pause/resume)
- [x] **T-107** Forced alignment stage (words.json)
- [ ] **T-108** Understanding & segmentation stage
- [ ] **T-109** Music library + selection + beat detection
- [ ] **T-110** Visual planning stage
- [ ] **T-111** Image generation & sourcing stage
- [ ] **T-112** Edit Plan assembly + validation
- [ ] **T-113** Backend orchestration + endpoints + live smoke

## M2 — Brand Kit + templates (human-authored) + registry

- [ ] **T-201** Brand Kit structure + config schema + loader
- [ ] **T-202** Template registry schema + validator + contract test
- [H] **T-203** Author the AE template project (HUMAN) + authoring guide
- [ ] **T-204** Template inspection/validation ExtendScript

## M3 — After Effects build (ExtendScript)

- [ ] **T-301** CEP/ExtendScript skeleton + json2.js + fsBuild entry
- [ ] **T-302** Comp assembly core (master comp + speaker base)
- [ ] **T-303** Caption building (per-word, bidi, emphasis)
- [ ] **T-304** Image-reveal + animated-text building
- [ ] **T-305** Motion + transitions
- [ ] **T-306** Audio wiring + build report + graceful degradation
- [ ] **T-307** Full build against a real plan (E2E AE)

## M4 — CEP panel

- [ ] **T-401** CEP panel skeleton + manifest + health indicator
- [ ] **T-402** Job start UI (picker, brand, brief, progress)
- [ ] **T-403** Transcript editor UI
- [ ] **T-404** AE build trigger + build-report display
- [ ] **T-405** Panel end-to-end wiring + error states

## M5 — End-to-end polish

- [H] **T-501** Real reels on the one kit (issue capture)
- [ ] **T-502** Tuning pass (density, emphasis, beats, gain, style)
- [ ] **T-503** "Professional not clumsy" QA checklist + fixes
- [ ] **T-504** Docs + troubleshooting + tag v1.0

---

_Newly discovered tasks go here with a `[ ] T-NNN` id and a brief description, then get added to `docs/FRAMOPIA_STUDIO_TASKS.md` in the next Planner session._
