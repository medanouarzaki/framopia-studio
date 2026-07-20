# FRAMOPIA STUDIO — Task Breakdown (Build Order)

> Companion to `FRAMOPIA_STUDIO_MASTER_SPEC.md`. This document slices the whole build into small, individually-verifiable tasks in dependency order. Each task is shaped to become an **Executor prompt** via Appendix E.1 of the spec. The Planner works down this list one task at a time.

**Version:** 1.0 · **Owner:** Mohamed Anouar Zaki · **Partner:** Younes

---

## How to use this document

1. **Planner** reads the state files (`PROGRESS.md`, `DECISIONS.md`, `TASKS.md`), finds the first task whose status is `TODO` and whose dependencies are all `DONE`, and expands it into an Executor prompt (spec Appendix E.1) using the task's fields below.
2. **Human** pastes it into Claude Code (the Executor).
3. **Executor** does exactly that one task, autonomously, then commits, pushes, updates state files, and prints its completion report (spec Appendix E.2).
4. **Human** pastes the report back to the Planner, and performs any **HUMAN CHECK** the task calls for (mostly visual, in After Effects).
5. Repeat.

### Task ID scheme
`T-<milestone><nn>` — e.g. `T-001` (M0), `T-101` (M1), `T-203` (M2). Milestones map to spec §24.

### Status legend
`TODO` · `IN-PROGRESS` · `DONE` · `BLOCKED` · `HUMAN` (requires human work in AE that no AI can do).
Keep the status column in this file current — the Executor updates it as the final step of each task.

### Definition of Done (applies to every task unless it is a `HUMAN` task)
- Code + tests written; `pytest` green (Executor pastes results).
- Acceptance criteria each mapped to evidence in the completion report.
- `TASKS.md` status updated; `PROGRESS.md` appended; `DECISIONS.md` appended if a decision was made; `CLAUDE.md` updated if standing rules changed.
- One conventional commit; pushed to `main`.
- No secrets in code or logs. Template Contract sigils respected.
- For `HUMAN` and human-check tasks: the human confirms the visual/AE result before the task is `DONE`.

### Golden rule
If an Executor finds anything that contradicts the spec or an assumption (spec §25), it **stops, logs it to `PROGRESS.md`, and reports it** rather than guessing. The Planner resolves it before continuing.

---

## One-time GitHub setup (the only manual step in the whole project)

The operator (Mohamed) does not use git/GitHub and wants everything automated. That is the default: **Claude Code performs all git and GitHub operations** — repo creation, privacy, collaborator add, and every commit/push — via the `gh` CLI, driven entirely by prompts.

Exactly two identity actions cannot be delegated to any AI, are done **once**, and take ~5 minutes total:
1. **A GitHub account must exist.** If Mohamed has none, he creates one at github.com (email + verify). Skip if he already has one.
2. **The Mac is authorized once.** In T-001, Claude Code runs `gh auth login` and prints a one-time code; the human approves it in the browser (one click). After this, all pushes are automatic forever.

**Not a blocker:** git works locally with no setup. T-001 initializes the repo and commits locally regardless; if GitHub auth is not yet done, it commits locally, marks the remote step "pending auth" in `PROGRESS.md`, and the next session pushes once authorized. The build never waits on GitHub.

To fully automate the collaborator add, the Planner should obtain **Younes's GitHub username** and pass it into the T-001 prompt; if unknown, T-001 creates the repo and a later one-line prompt adds him.

---

## Task index

| ID | Milestone | Title | Depends on | Type |
|----|-----------|-------|-----------|------|
| T-000 | M0 | GitHub + git tooling bootstrap (one-time auth) | — | code+human |
| T-001 | M0 | Repo scaffolding + state files + create/push private repo | T-000 | code+human |
| T-002 | M0 | Python backend project + tooling + /health | T-001 | code |
| T-003 | M0 | Scripted, idempotent Mac environment setup | T-002 | code+human |
| T-004 | M0 | Edit Plan schema (Pydantic) + golden example + validator | T-002 | code |
| T-005 | M0 | Config + secrets + cost-control scaffolding | T-002 | code |
| T-101 | M1 | Job workspace + job manager + async runner | T-004,T-005 | code |
| T-102 | M1 | Ingest stage | T-101 | code |
| T-103 | M1 | Audio extraction (ffmpeg) | T-101 | code |
| T-104 | M1 | Gemini client (asr/understand/image) — mockable | T-005 | code |
| T-105 | M1 | ASR stage (transcript_raw.json) | T-103,T-104 | code |
| T-106 | M1 | Correction gate API (pause/resume) | T-101,T-105 | code |
| T-107 | M1 | Forced alignment stage (words.json) | T-106 | code |
| T-108 | M1 | Understanding & segmentation stage | T-107 | code |
| T-109 | M1 | Music library + selection + beat detection | T-101 | code |
| T-110 | M1 | Visual planning stage | T-108,T-109 | code |
| T-111 | M1 | Image generation & sourcing stage | T-104,T-110 | code |
| T-112 | M1 | Edit Plan assembly + validation | T-110,T-111 | code |
| T-113 | M1 | Backend orchestration + endpoints + live smoke | T-112 | code+human |
| T-201 | M2 | Brand Kit structure + config schema + loader | T-005 | code |
| T-202 | M2 | Template registry schema + validator + contract test | T-004,T-201 | code |
| T-203 | M2 | Author the AE template project (HUMAN) + authoring guide | T-202 | human |
| T-204 | M2 | Template inspection/validation ExtendScript | T-202,T-203 | code+human |
| T-301 | M3 | CEP/ExtendScript skeleton + json2.js + fsBuild entry | T-004 | code+human |
| T-302 | M3 | Comp assembly core (master comp + speaker base) | T-301 | code+human |
| T-303 | M3 | Caption building (per-word, bidi, emphasis) | T-302,T-203 | code+human |
| T-304 | M3 | Image-reveal + animated-text building | T-302,T-203 | code+human |
| T-305 | M3 | Motion + transitions | T-302,T-203 | code+human |
| T-306 | M3 | Audio wiring + build report + graceful degradation | T-302 | code+human |
| T-307 | M3 | Full build against a real plan (E2E AE) | T-303..T-306,T-113 | code+human |
| T-401 | M4 | CEP panel skeleton + manifest + health indicator | T-301 | code+human |
| T-402 | M4 | Job start UI (picker, brand, brief, progress) | T-401,T-113 | code |
| T-403 | M4 | Transcript editor UI | T-402,T-106 | code |
| T-404 | M4 | AE build trigger + build-report display | T-403,T-307 | code+human |
| T-405 | M4 | Panel end-to-end wiring + error states | T-404 | code+human |
| T-501 | M5 | Real reels on the one kit (issue capture) | T-405 | human |
| T-502 | M5 | Tuning pass (density, emphasis, beats, gain, style) | T-501 | code+human |
| T-503 | M5 | "Professional not clumsy" QA checklist + fixes | T-502 | code+human |
| T-504 | M5 | Docs + troubleshooting + tag v1.0 | T-503 | code |

---

# M0 — Foundations

*Outcome: the contract exists and validates; the repo, tooling, and state files are in place; setup is scripted.*

### T-000 — GitHub + git tooling bootstrap (one-time auth) · `TODO`
**Depends on:** — · **Type:** code+human
**Files:** none (environment setup only).
**Goal:** Make the machine able to create and push GitHub repos non-interactively, so every later task is fully automated. This is the **only** task in the whole project that requires a manual human action, and it happens once.
**Details (Executor runs these):**
- Ensure Homebrew is present (install if missing), then `brew install git gh`.
- Run `gh auth status`. If already authenticated as `medanouarzaki`, skip the rest and report success.
- If not authenticated, run `gh auth login --web --git-protocol https --hostname github.com` and **surface the one-time code and URL to the human**. Tell the human exactly: "Open <URL>, paste this code: <CODE>, click Authorize. That's the only manual step in the entire project."
- After the human authorizes, verify with `gh auth status` and `gh api user` (confirm login == `medanouarzaki`).
- Configure git identity: `git config --global user.name` / `user.email` to the account's values (fetch email via `gh api user`), if not already set.
**Acceptance criteria:** `gh auth status` shows authenticated as `medanouarzaki`; `gh api user` succeeds; git global identity set. From here on, no human git/GitHub action is ever needed.
**Tests:** none (environment); paste `gh auth status` + `gh api user` login into the report.
**Human check:** the human performs the single browser authorize step when prompted. Nothing else.
**Notes:** run the very first Claude Code session in no-prompt mode (`claude --dangerously-skip-permissions`, accept the one-time warning) so installing `gh` and authenticating never stop to ask. This is the bootstrap; `.claude/settings.json` (created in T-001) governs later sessions.

### T-001 — Repo scaffolding + state files + create/push private repo · `TODO`
**Depends on:** T-000 · **Type:** code+human
**Files:** repo root; `.gitignore`, `.env.example`, `README.md`, `CLAUDE.md`, `PROGRESS.md`, `TASKS.md`, `DECISIONS.md`, `.claude/settings.json`, empty dir tree per spec §15.
**Goal:** Initialize the repo exactly as spec §15 describes, wire the four state files, configure Claude Code for autonomous operation, **create the private GitHub repo via `gh` and push** — no manual GitHub steps.
**Details:**
- Create the directory tree from spec §15 (backend/, ae_panel/{CSXS,client,host,lib}, brand_kits/, music/, jobs/, docs/, setup/) with `.gitkeep` where empty.
- Move `FRAMOPIA_STUDIO_MASTER_SPEC.md` and this `FRAMOPIA_STUDIO_TASKS.md` into `docs/`.
- `CLAUDE.md`: one-paragraph project summary + standing rules (coding standards spec §18, how to run tests, commit/push protocol, the "never" list: no secrets in code/logs, no scope invention, respect Template Contract sigils, stop-and-report on contradictions).
- `PROGRESS.md`: seed with a "project initialized" entry.
- `DECISIONS.md`: seed with the locked decisions from spec §25 (A1–A6) + name = Framopia Studio.
- `TASKS.md`: this file lives at repo root as the working task list (docs/ holds the canonical copy; root copy is the one Executors tick — or symlink; decide and log).
- `.gitignore`: `.env`, `/jobs`, media in `/music` and `brand_kits/*/samples`, caches, venv, node_modules.
- `.env.example`: `GEMINI_API_KEY=`, `# ELEVENLABS_API_KEY=` (future), any ports.
- `.claude/settings.json`: `acceptEdits` default + allowlist + deny list per spec §17.5, **and add `Bash(gh:*)`, `Bash(brew:*)`, `Bash(git:*)` to the allowlist** so no future session ever prompts on git/GitHub/install commands.
- Create the private repo and push, all via CLI (no website): `git init` (if needed) → `git add -A` → `git commit` → `gh repo create medanouarzaki/framopia-studio --private --source=. --remote=origin --push`.
- Add Younes as a collaborator with push access: `gh api -X PUT repos/medanouarzaki/framopia-studio/collaborators/<younes_github_username> -f permission=push`. If Younes's username is unknown, do everything else, then **ask the human for it** and add it (or leave a clearly-flagged TODO in `PROGRESS.md`).
**Acceptance criteria:**
- Directory tree matches spec §15.
- Four state files present and seeded; docs moved into `docs/`.
- `.env` is git-ignored (verify `git status` shows no `.env`); `.env.example` committed.
- `.claude/settings.json` valid JSON matching §17.5, including `gh`/`brew`/`git` in the allowlist.
- Private repo `medanouarzaki/framopia-studio` created and pushed on `main`, entirely via `gh` (confirm with `gh repo view`).
- Younes added as a push collaborator (or flagged pending his username).
**Tests:** a tiny check script (or documented `git status` + `gh repo view`) proving `.env` is ignored, the tree exists, and the repo is private.
**Human check:** none required for git/GitHub — it is fully automated here (the only manual moment was the one-time auth in T-000). Optionally the human provides Younes's GitHub username.
**Notes:** everything git/GitHub is done by the Executor via `gh`; the human never opens the GitHub website. Record the repo URL in `PROGRESS.md`.

### T-002 — Python backend project + tooling + /health · `TODO`
**Depends on:** T-001 · **Type:** code
**Files:** `backend/pyproject.toml`, `backend/app/main.py`, `backend/app/config.py` (stub), `backend/tests/test_health.py`, ruff/pytest config.
**Goal:** A runnable FastAPI backend with `/health`, linting, and a first green test.
**Details:** Python 3.12 project; deps: fastapi, uvicorn, pydantic v2, pydantic-settings, httpx, ruff, pytest, ffmpeg-python (or subprocess), librosa (pin for later), numpy. `GET /health` returns `{status:"ok", version, ffmpeg_ok, keys_ok}` (ffmpeg_ok/keys_ok may be stubs for now). Bind `127.0.0.1` only.
**Acceptance criteria:** `pytest` green; `uvicorn` serves `/health` returning ok; `ruff check` clean; backend binds localhost only.
**Tests:** `test_health.py` asserts 200 + shape.
**Human check:** none.

### T-003 — Scripted, idempotent Mac environment setup · `TODO`
**Depends on:** T-002 · **Type:** code+human
**Files:** `setup/mac_setup.sh`, `setup/README.md`, `setup/check_health.sh`.
**Goal:** One script that makes a fresh Mac ready, safe to re-run. Per spec Appendix D.
**Details:** install Homebrew if missing; `brew install python@3.12 ffmpeg node`; create venv; install backend (`pip install -e backend` or `uv`); install the forced aligner + Arabic model (chosen in T-107 — leave a clearly-marked hook if T-107 not done yet, or sequence T-003 after aligner choice is logged); copy/symlink `ae_panel/` into `~/Library/Application Support/Adobe/CEP/extensions/com.framopia.studio/` and set `PlayerDebugMode`; create `.env` from `.env.example` if absent; run `check_health.sh` and print a ✅/❌ readiness checklist.
**Acceptance criteria:** script is idempotent (second run makes no destructive changes); prints a clear readiness report; documented in `setup/README.md`.
**Tests:** a dry-run/lint of the script (shellcheck) + a documented manual run result pasted into the report.
**Human check:** Mohamed runs it on his Mac and confirms the checklist is all ✅ (aligner + CEP steps may be validated after their tasks land — note in report).
**Notes:** the aligner install line depends on T-107's choice; if T-107 is not yet done, implement everything else and leave a TODO-marked, clearly-labeled placeholder for the aligner, and log it.

### T-004 — Edit Plan schema (Pydantic) + golden example + validator · `TODO`
**Depends on:** T-002 · **Type:** code
**Files:** `backend/app/models/edit_plan.py` (+ related models), `backend/app/models/validate.py`, `docs/edit_plan.example.json`, `backend/tests/test_edit_plan.py`.
**Goal:** The central contract, as code + a golden JSON, with a strict validator. Per spec §8 + Appendix A.
**Details:** Pydantic v2 models: `EditPlan, Reel, Source, CaptionLine, Word (text, script: Literal["arabic","latin"], start, end, emphasis), Visual (kind: Literal["generated_image","client_asset","animated_text"], asset|text, template, start, end, beat_aligned), Motion, AudioPlan, MusicCue, SfxCue, Meta`. Validator enforces spec §8 rules: word non-overlap within a segment, times within `[0,duration]`, beat-aligned visuals match a beat within epsilon, referenced assets exist (skippable in unit tests via a flag), template names exist in a provided registry. Write the complete golden `docs/edit_plan.example.json` (full version of Appendix A) — it must validate.
**Acceptance criteria:** golden validates; a battery of malformed plans is rejected with clear errors (overlapping words, out-of-range window, bad script enum, unknown template); models match §8/Appendix A field-for-field.
**Tests:** `test_edit_plan.py` covers valid + each invalid case + the bidi caption line `"Salam بزاف ديال promo"` producing correctly script-tagged non-overlapping words.
**Human check:** none.

### T-005 — Config + secrets + cost-control scaffolding · `TODO`
**Depends on:** T-002 · **Type:** code
**Files:** `backend/app/config.py`, `backend/app/util/cost.py`, `backend/tests/test_config.py`.
**Goal:** Typed config from `.env`, cost guardrails, and health reporting of readiness. Per spec §16.
**Details:** pydantic-settings Settings: `gemini_api_key`, optional `elevenlabs_api_key`, `backend_port`, `max_images_per_job` (default 8), `cheap_mode` (bool), `cost_ceiling_usd`. A `CostMeter` util accumulating estimated spend, never logging keys. Wire `/health` `keys_ok`/`ffmpeg_ok` to real checks (key present? ffmpeg on PATH?).
**Acceptance criteria:** config loads from a fixture env; missing required key surfaces a clear (non-crashing) health failure, not a stack trace with the key; keys never appear in logs.
**Tests:** load from fixture; a test asserting the key value never appears in any log output; cost meter accumulation.
**Human check:** none.

---

# M1 — Backend pipeline (no After Effects)

*Outcome: given a take + brief (+ corrected transcript), the backend emits a valid `edit_plan.json` and all assets on disk. Everything tested against fixtures with mocked APIs; one manual live smoke.*

### T-101 — Job workspace + job manager + async runner · `TODO`
**Depends on:** T-004, T-005 · **Type:** code
**Files:** `backend/app/jobs/manager.py`, `backend/app/jobs/paths.py`, `backend/app/models/job.py`, tests.
**Goal:** Create/track jobs, own the `/jobs/<id>/` workspace, run the pipeline as an async background task with a status model. Per spec §14.2.
**Details:** `JobStatus` model (`stage, progress_pct, state ∈ {running, awaiting_correction, ready_for_ae, error}, message`). `JobManager.create()` scaffolds the workspace (`job.json`, subfolders `assets/{images,audio,client}`, `log.txt`). A stage runner that writes each artifact to disk before advancing and updates status. Structured per-stage logging (spec §20).
**Acceptance criteria:** creating a job scaffolds the workspace; status transitions are correct with a fake two-stage pipeline; artifacts land on disk; logs contain no secrets.
**Tests:** fake-stage pipeline drives status through `running → ready_for_ae`; workspace assertions.
**Human check:** none.

### T-102 — Ingest stage · `TODO`
**Depends on:** T-101 · **Type:** code
**Files:** `backend/app/pipeline/ingest.py`, tests + a tiny sample take fixture.
**Goal:** Validate + intake the take and client assets; write `job.json`. Per spec Stage 1.
**Details:** probe input (ffprobe) for w/h/fps/duration; reject non-9:16 and absurd durations with a clear message; warn on unusual fps; copy input + client assets into the workspace; record metadata.
**Acceptance criteria:** valid 9:16 sample ingests and records correct metadata; a 16:9 sample is rejected with a helpful message; client assets land in `assets/client/`.
**Tests:** valid + wrong-aspect + missing-file cases.
**Human check:** none.

### T-103 — Audio extraction (ffmpeg) · `TODO`
**Depends on:** T-101 · **Type:** code
**Files:** `backend/app/clients/ffmpeg.py`, `backend/app/pipeline/audio.py`, tests.
**Goal:** Extract normalized mono 16 kHz `audio.wav`. Per spec Stage 2.
**Details:** ffmpeg wrapper (subprocess, checked errors); output props asserted (sample rate, channels).
**Acceptance criteria:** extraction from the sample take yields a 16 kHz mono wav; ffmpeg errors surface clearly.
**Tests:** run on the tiny sample (real ffmpeg) and assert wav properties.
**Human check:** none.

### T-104 — Gemini client (asr/understand/image) — mockable · `TODO`
**Depends on:** T-005 · **Type:** code
**Files:** `backend/app/clients/gemini.py`, `backend/tests/fixtures/gemini/*`, tests.
**Goal:** One thin, mockable interface to Gemini for `transcribe(audio)`, `understand(...)`, `generate_image(prompt, model)`. Retry/backoff; cost-meter hooks; model ids from config (`gemini-3.1-flash-image`, `gemini-3-pro-image`, current flagship for asr/understand).
**Details:** all methods injectable/mocked in tests via recorded responses; never log keys; respect cheap_mode/ceiling for images.
**Acceptance criteria:** methods callable with mocks returning fixture data; retry on transient error; cost meter increments; model ids sourced from config.
**Tests:** mocked transcribe/understand/generate_image; a retry test; a key-not-logged test.
**Human check:** none. **Notes:** no real API calls in unit tests.

### T-105 — ASR stage (transcript_raw.json) · `TODO`
**Depends on:** T-103, T-104 · **Type:** code
**Files:** `backend/app/pipeline/asr.py`, prompt in `backend/app/prompts/asr.md`, tests.
**Goal:** Produce `transcript_raw.json` segments with the mixed-script, code-switch prompt. Per spec Stage 3 + §11.2.
**Details:** prompt instructs Gemini to output segments preserving French/English/technical words in Latin and Darija/Arabic words in Arabic script, with rough timings + confidence; pass the brief as domain context.
**Acceptance criteria:** given a mocked Gemini response, produces well-formed segments with per-word/segment script hints; prompt encodes the §11.2 rule verbatim.
**Tests:** mocked response → expected `transcript_raw.json` shape; prompt contains the script rule.
**Human check:** none.

### T-106 — Correction gate API (pause/resume) · `TODO`
**Depends on:** T-101, T-105 · **Type:** code
**Files:** `backend/app/main.py` routes, `backend/app/jobs/manager.py` (resume), tests.
**Goal:** Endpoints `GET /jobs/{id}/transcript` and `POST /jobs/{id}/transcript`; job pauses in `awaiting_correction` after ASR and resumes on POST. Per spec Stage 4 + §14.1.
**Details:** after T-105 the job halts; GET returns segments for the editor; POST stores `transcript_corrected.json` and resumes downstream.
**Acceptance criteria:** job reaches `awaiting_correction`; GET returns the transcript; POST resumes to the next stage; malformed corrected transcript rejected.
**Tests:** state-transition tests through the gate.
**Human check:** none.

### T-107 — Forced alignment stage (words.json) · `TODO`
**Depends on:** T-106 · **Type:** code
**Files:** `backend/app/clients/aligner.py`, `backend/app/pipeline/align.py`, tests + a tiny aligned fixture, `DECISIONS.md` (aligner choice).
**Goal:** Per-word timings from the **corrected** text → `words.json` with `{word, script, start, end, segment_index}`. Per spec Stage 5 + §6.2.
**Details:** choose and log the aligner (MFA Arabic / aeneas / WhisperX-align seeded with corrected text); handle mixed script (keep surface form + script tag; align phonetically). This is the timing source; accuracy of words comes from the human gate, not here.
**Acceptance criteria:** given the sample audio + corrected transcript, produces monotonic non-overlapping word timings; mixed-script line handled; aligner choice logged in `DECISIONS.md`.
**Tests:** alignment on the fixture yields ordered, non-overlapping words incl. the bidi test line.
**Human check:** spot-check that a couple of word timings look right against the sample (quick).
**Notes:** update T-003's aligner install line once chosen.

### T-108 — Understanding & segmentation stage · `TODO`
**Depends on:** T-107 · **Type:** code
**Files:** `backend/app/pipeline/understand.py`, `backend/app/prompts/understand.md`, tests.
**Goal:** `understanding.json` = summary + segments (with `visual_intent`) + `emphasis_word_indices`. Per spec Stage 6 + §11.3.
**Details:** Gemini reasons over corrected transcript + words + brief; emphasis rule = nouns, numbers, brand/product names, punchy verbs.
**Acceptance criteria:** mocked response yields valid `understanding.json`; emphasis indices reference real words; visual_intent present per segment (or explicit "speaker only").
**Tests:** mocked → schema-valid understanding; emphasis indices in range.
**Human check:** none.

### T-109 — Music library + selection + beat detection · `TODO`
**Depends on:** T-101 · **Type:** code
**Files:** `backend/app/pipeline/music.py`, `backend/app/clients/beats.py`, `music/library.json` (schema + a couple of fixture entries), tests + a tiny audio fixture.
**Goal:** Pick a track by mood/energy and produce the beat grid. Per spec Stage 9 + §13.
**Details:** `library.json` entries `{file,type,mood[],energy,bpm,has_vocals,duration}`; selection prefers instrumental, adequate length, mood/energy match; librosa beat tracking → `beats.json`.
**Acceptance criteria:** selection returns a sensible track for a given brief mood; beat detection on the fixture returns a plausible ascending beat list.
**Tests:** selection logic (fixtures) + beats ascending/non-empty on the sample.
**Human check:** none. **Notes:** actual track files are git-ignored; `library.json` is committed.

### T-110 — Visual planning stage · `TODO`
**Depends on:** T-108, T-109 · **Type:** code
**Files:** `backend/app/pipeline/plan_visuals.py`, tests.
**Goal:** Decide the concrete visual track: per moment choose client-asset / generate / animated-text, pick templates, snap windows to beats, enforce density sanity, add punch-ins + transitions. Per spec Stage 7 + §12.1.
**Details:** decision order §12.1 (client asset wins when relevant → else generate → else animated-text/speaker); density ~ new visual every ~5s or on key moments, never strobing; windows snapped to nearest beats; deterministic given a seed.
**Acceptance criteria:** produces a draft visual track for a fixture understanding+beats; windows beat-aligned; density within sane bounds; client-asset priority honored when a matching asset exists.
**Tests:** fixture → expected visual track (deterministic); density + snapping + priority assertions.
**Human check:** none.

### T-111 — Image generation & sourcing stage · `TODO`
**Depends on:** T-104, T-110 · **Type:** code
**Files:** `backend/app/pipeline/images.py`, tests.
**Goal:** For each "generate" visual, build the prompt (brand style + intent + negatives + 9:16/no-text constraints), call Nano Banana 2 (Pro for hero), save images; for "client_asset", select + reframe to 9:16-safe; cache by prompt hash; enforce ceiling/cheap-mode. Per spec Stage 8 + §12.
**Acceptance criteria:** with mocked image API, generates + saves images for each requirement; prompt embeds brand style + negatives + constraints; client assets reframed; identical prompts hit cache (one call); ceiling enforced (stops + flags at limit).
**Tests:** mocked generation; prompt-construction assertions; cache-hit test; ceiling test.
**Human check:** none. **Notes:** real generation only in the live smoke (T-113), never CI.

### T-112 — Edit Plan assembly + validation · `TODO`
**Depends on:** T-110, T-111 · **Type:** code
**Files:** `backend/app/pipeline/assemble_plan.py`, tests.
**Goal:** Combine captions (from words + emphasis), visuals, motion, audio, beats, meta into `edit_plan.json`; validate against the schema **and** the Brand Kit registry; fail loud on any broken reference. Per spec Stage 10.
**Acceptance criteria:** a full fixture pipeline yields a schema-valid, registry-valid plan; missing asset / unknown template / out-of-range window all fail with clear errors; captions carry correct per-word script + emphasis + timing.
**Tests:** happy path → valid plan; each failure mode.
**Human check:** none.

### T-113 — Backend orchestration + endpoints + live smoke · `TODO`
**Depends on:** T-112 · **Type:** code+human
**Files:** `backend/app/main.py` (full `/jobs` wiring), `backend/app/jobs/manager.py` (full pipeline), `backend/scripts/live_smoke.py`, tests.
**Goal:** Wire Stages 1–10 behind `POST /jobs`, `/status`, transcript endpoints, `/edit_plan`; provide a human-run live smoke on a real 5s clip. Per spec §14.1.
**Acceptance criteria:** with mocks, `POST /jobs` → pause at correction → resume → `ready_for_ae` with a valid `edit_plan.json`; endpoints return correct shapes; `live_smoke.py` documented.
**Tests:** end-to-end orchestration with mocks; endpoint shape tests.
**Human check:** Mohamed runs `live_smoke.py` on a real short clip with real Gemini keys and confirms a plausible transcript + plan + images are produced. Log cost + observations in `PROGRESS.md`.
**Notes:** this is the first real-API run; expect Darija ASR imperfections — that is exactly what the correction gate is for.

---

# M2 — Brand Kit + templates (human-authored) + registry

*Outcome: the one v1 Brand Kit exists with a fillable, contract-compliant template set. This is where **you and Younes design in After Effects**; Claude builds the config, registry, validation, and a precise authoring guide — it cannot design the motion for you.*

### T-201 — Brand Kit structure + config schema + loader · `TODO`
**Depends on:** T-005 · **Type:** code
**Files:** `backend/app/models/brand_kit.py`, `backend/app/brand_kits.py` (loader + `/brand_kits` route), `brand_kits/framopia-clientA/config.json`, tests.
**Goal:** Define + load the Brand Kit config (palette, fonts, caption_style, image_style). Per spec §10.
**Details:** Pydantic model matching the §10 `config.json`; loader that lists kits and returns one; `/brand_kits` endpoint. Create the v1 kit's `config.json` (real palette/fonts TBD by humans — commit sensible placeholders they can edit).
**Acceptance criteria:** config validates; `/brand_kits` lists the v1 kit; loader returns a typed object; `per_video_override_allowed` respected downstream (hook).
**Tests:** config validation + loader + endpoint.
**Human check:** Mohamed/Younes fill real palette + choose the **dual-script font** (must render Arabic + Latin) in `config.json`.

### T-202 — Template registry schema + validator + contract test · `TODO`
**Depends on:** T-004, T-201 · **Type:** code
**Files:** `backend/app/models/registry.py`, `brand_kits/framopia-clientA/templates/registry.json`, plan-validator wiring, tests.
**Goal:** Machine-readable half of the Template Contract: every template name, category, placeholder inventory. Validate Edit Plan template names against it. Per spec §9.3.
**Details:** registry entry `{name, category, placeholders:[sigils], params}`; validator (extends T-004) rejects plans referencing unknown templates or templates missing required placeholders; encode the sigil list (§9.3 / Appendix F) as constants.
**Acceptance criteria:** registry validates; a plan with an unknown template fails; a plan whose template lacks a required sigil fails; sigil constants match Appendix F.
**Tests:** valid + unknown-template + missing-sigil cases.
**Human check:** none.

### T-203 — Author the AE template project (HUMAN) + authoring guide · `HUMAN`
**Depends on:** T-202 · **Type:** human (Claude produces the guide + registry entries; humans build the .aep)
**Files (Claude writes):** `docs/TEMPLATE_AUTHORING_GUIDE.md`, matching entries in `registry.json`, a checklist. **Files (humans create):** `brand_kits/framopia-clientA/templates/templates.aep`.
**Goal:** Hand-author the v1 template comps in After Effects, following the naming contract, so Framopia Studio can fill them. This is the quality keystone.
**Templates to author (v1 set):**
- `caption_karaoke_default` — word-by-word pop, current-word highlight, emphasis (larger/bolder), **mixed Arabic+Latin bidi** in one line, lower-third safe-area (`#SAFE` guide). Placeholder(s) per the chosen caption mechanism (§11.4, default (A) one-layer-per-word — expose a `#TXT_WORD` prototype the script duplicates).
- `image_reveal_slideup`, `image_reveal_scalein` — reveal an `#IMG` placeholder with motion; honor an in/out window.
- `transition_whip_pan` — self-contained transition.
- `punch_soft` — scale/position emphasis for the speaker.
- `animtext_bold` — full-frame branded text card with `#TXT_MAIN`.
**Claude's part (the guide):** for each template, spell out the exact required layer names/sigils, the expected structure, how the script will fill/time it, and a visual acceptance bar; include the mixed-script test line `"Salam بزاف ديال promo"`; write the matching `registry.json` entries.
**Acceptance criteria:** all v1 templates exist in `templates.aep`, named exactly per the contract; `registry.json` matches; the caption template renders the bidi test line correctly (Arabic RTL + Latin LTR in one line) with emphasis working — **confirmed by human visual check**; templates look professional (the quality bar).
**Tests:** none automated here; T-204 mechanically validates the contract.
**Human check:** the core of this task — Mohamed/Younes build and eyeball every template.
**Notes:** Claude cannot create the .aep; if asked, it must refuse to fake it and instead deliver the guide + registry. Log the chosen caption mechanism (A or B) in `DECISIONS.md`.

### T-204 — Template inspection/validation ExtendScript · `TODO`
**Depends on:** T-202, T-203 · **Type:** code+human
**Files:** `ae_panel/host/validate_templates.jsx`, `docs/` note, tests (JSON-level).
**Goal:** An ExtendScript that opens `templates.aep` and verifies every registry template comp exists and exposes its required sigil layers; writes a report. Ties human work to the machine contract. Per spec §9.3.
**Acceptance criteria:** running it in AE against the authored `templates.aep` reports all templates present + all required sigils found, or lists exactly what's missing.
**Tests:** unit-test the registry-vs-report comparison logic in isolation (feed a fake report).
**Human check:** Mohamed runs it in AE; report is all-green (fix templates until it is).

---

# M3 — After Effects build (ExtendScript)

*Outcome: a valid Edit Plan becomes a built master comp from the templates — captions, images, motion, audio — then stops. Verified against the golden plan, then a real plan. Each task needs a human to run it in AE and eyeball.*

### T-301 — CEP/ExtendScript skeleton + json2.js + fsBuild entry · `TODO`
**Depends on:** T-004 · **Type:** code+human
**Files:** `ae_panel/host/main.jsx`, `ae_panel/host/json2.js`, `ae_panel/host/util.jsx` (readFile, findLayerBySigil, report), tests (JSON-level).
**Goal:** Host-side skeleton: `fsBuild(planPath)` reads + parses the plan (json2.js), creates an empty master comp at reel dims, scaffolds `build_report.json`. Per spec §9.4 steps 1–2 + Appendix B.
**Acceptance criteria:** running `fsBuild(golden)` in AE creates a master comp of the correct size/fps/duration and writes a build report; ES3-safe (no let/const/arrow/native JSON).
**Tests:** unit-test the plan-reading/report helpers where logic is JSON-level; AE run is human-verified.
**Human check:** Mohamed runs it in AE against the golden plan; empty comp appears.
**Notes:** enable "Allow Scripts to Write Files and Access Network" in AE prefs (document in guide).

### T-302 — Comp assembly core (master comp + speaker base) · `TODO`
**Depends on:** T-301 · **Type:** code+human
**Files:** `ae_panel/host/build_core.jsx`, tests (logic-level).
**Goal:** Import `input.mp4` + all plan assets; add the speaker as the full-frame bottom layer; wrap in an undo group. Per spec §9.4 steps 3–4.
**Acceptance criteria:** against the golden plan, the speaker layer is placed full-frame at the bottom; all referenced assets import; missing asset is logged (not fatal).
**Human check:** Mohamed runs against a golden plan with a real sample take; speaker fills the frame.

### T-303 — Caption building (per-word, bidi, emphasis) · `TODO`
**Depends on:** T-302, T-203 · **Type:** code+human
**Files:** `ae_panel/host/build_captions.jsx`, tests (logic-level).
**Goal:** Instantiate `caption_karaoke_default` and drive it from the plan's word timings via mechanism (A): one timed text layer per word (duplicating `#TXT_WORD`), with current-word highlight + emphasis + correct Arabic/Latin script per word. Per spec §11.4.
**Acceptance criteria:** against the golden plan, each word appears/pops at its `[start,end]`; emphasized words render larger/bolder; the mixed-script line shows Arabic RTL + Latin LTR correctly in one line.
**Human check:** Mohamed plays the comp; captions sync + read correctly (the bidi line especially).
**Notes:** if mechanism (B) was chosen in T-203, implement that instead and reconcile with `DECISIONS.md`.

### T-304 — Image-reveal + animated-text building · `TODO`
**Depends on:** T-302, T-203 · **Type:** code+human
**Files:** `ae_panel/host/build_visuals.jsx`, tests (logic-level).
**Goal:** For each `visuals[]`: for image kinds, duplicate the named `image_reveal_*` template, set its `#IMG` source to the asset, trim to `[start,end]`, place above speaker; for `animated_text`, use `animtext_*` and set `#TXT_MAIN`. Per spec §9.4 step 5.
**Acceptance criteria:** against the golden plan, images reveal within their windows using the right template; animated-text card shows its text; unknown template logged + skipped (graceful).
**Human check:** Mohamed confirms images appear on time with the intended motion.

### T-305 — Motion + transitions · `TODO`
**Depends on:** T-302, T-203 · **Type:** code+human
**Files:** `ae_panel/host/build_motion.jsx`, tests (logic-level).
**Goal:** Apply `punch_*` to the speaker at each motion `at` with `amount`; place `transition_*` templates at their times. Per spec §9.4 step 7.
**Acceptance criteria:** punch-ins scale the speaker subtly at the right times; transitions land at their (beat-aligned) times.
**Human check:** Mohamed confirms motion is subtle + on-beat.

### T-306 — Audio wiring + build report + graceful degradation · `TODO`
**Depends on:** T-302 · **Type:** code+human
**Files:** `ae_panel/host/build_audio.jsx`, `ae_panel/host/build_report.jsx` (finalize), tests (logic-level).
**Goal:** Add the music as an audio layer at its gain from the plan; add SFX at their cue times; finalize `build_report.json` (placed vs failed); ensure the whole build degrades gracefully on any missing template/asset. Per spec §9.4 steps 8–10 + §20.
**Acceptance criteria:** music plays at the specified gain; SFX at cue times; build report accurately lists placed + failed items; a deliberately missing template does not abort the build.
**Human check:** Mohamed confirms audio + reviews the report.

### T-307 — Full build against a real plan (E2E AE) · `TODO`
**Depends on:** T-303, T-304, T-305, T-306, T-113 · **Type:** code+human
**Files:** integration notes; small fixes across `host/`.
**Goal:** Run a **real backend-produced** `edit_plan.json` (from T-113) through the full AE build; the comp opens complete and is not rendered. Per spec §7 Stage 11.
**Acceptance criteria:** a real plan builds a complete comp (captions + images + motion + audio) that opens and stops for review; build report clean or explained.
**Human check:** Mohamed does full visual QA on a real reel; notes issues for M5.

---

# M4 — CEP panel

*Outcome: the whole flow runs from inside After Effects via the panel.*

### T-401 — CEP panel skeleton + manifest + health indicator · `TODO`
**Depends on:** T-301 · **Type:** code+human
**Files:** `ae_panel/CSXS/manifest.xml`, `ae_panel/client/index.html|css|js`, `ae_panel/lib/CSInterface.js`, setup integration.
**Goal:** A loadable panel with a backend-health indicator (polls `/health`), installed into the extensions folder. Per spec §9.5 + Appendix C.
**Acceptance criteria:** panel loads in AE 2026; shows green/red backend health; `manifest.xml` targets AE + correct extension id `com.framopia.studio`.
**Human check:** Mohamed loads the panel in AE; health light works.

### T-402 — Job start UI · `TODO`
**Depends on:** T-401, T-113 · **Type:** code
**Files:** `ae_panel/client/*`.
**Goal:** File picker + Brand Kit dropdown (from `/brand_kits`) + brief field + Process button → `POST /jobs`; progress readout polling `/status`. Per spec §4 steps 1–3.
**Acceptance criteria:** selecting a take + kit + brief and clicking Process starts a job and shows live progress through the stages.
**Human check:** Mohamed runs a job from the panel to the correction pause.

### T-403 — Transcript editor UI · `TODO`
**Depends on:** T-402, T-106 · **Type:** code
**Files:** `ae_panel/client/*`.
**Goal:** On `awaiting_correction`, render segments editably (one line per segment, low-confidence hints), Continue → `POST /transcript`. Fast + keyboard-friendly. Per spec §4 step 4 + §7 Stage 4.
**Acceptance criteria:** transcript shows editably; edits persist; Continue resumes the pipeline; under-a-minute ergonomics.
**Human check:** Mohamed edits a real transcript and continues.

### T-404 — AE build trigger + build-report display · `TODO`
**Depends on:** T-403, T-307 · **Type:** code+human
**Files:** `ae_panel/client/*`, glue to `host/`.
**Goal:** On `ready_for_ae`, call `fsBuild(planPath)` via `evalScript`; show the build report; offer restart-backend. Per spec §9.5.
**Acceptance criteria:** from the panel, a completed plan builds the comp in AE and the report is shown.
**Human check:** Mohamed triggers a full build from the panel.

### T-405 — Panel end-to-end wiring + error states · `TODO`
**Depends on:** T-404 · **Type:** code+human
**Files:** `ae_panel/client/*`.
**Goal:** The complete flow from inside AE — pick → process → correct → build → review — with graceful handling of backend-down, job errors, and cancels. Per spec §4 whole.
**Acceptance criteria:** a full reel is produced end-to-end from the panel with no CLI; error/cancel/backend-down states are handled clearly.
**Human check:** Mohamed produces a full reel start-to-finish from the panel only.

---

# M5 — End-to-end polish

*Outcome: reels good enough to ship to a client. Human-driven tuning; Claude implements the tweaks.*

### T-501 — Real reels on the one kit (issue capture) · `HUMAN`
**Depends on:** T-405 · **Type:** human
**Goal:** Run several real Framopia takes through the full tool; capture every "clumsy" moment (caption timing, script errors, image relevance/style, density, beat feel, gain) into an issues list in `PROGRESS.md`.
**Acceptance criteria:** a concrete, prioritized issues list exists.
**Human check:** this task *is* the human check.

### T-502 — Tuning pass · `TODO`
**Depends on:** T-501 · **Type:** code+human
**Files:** prompts, `config.json`, planning params, snap tolerance, gain defaults.
**Goal:** Address the T-501 issues by tuning config/prompts/params (image style, emphasis rule, density, beat-snap tolerance, music gain) — no architecture changes.
**Acceptance criteria:** re-running the same takes visibly improves the flagged issues.
**Human check:** Mohamed re-reviews the same reels and confirms improvement.

### T-503 — "Professional not clumsy" QA checklist + fixes · `TODO`
**Depends on:** T-502 · **Type:** code+human
**Files:** `docs/QA_CHECKLIST.md` + targeted fixes.
**Goal:** A repeatable QA checklist (captions synced + correct script, images on-brand + relevant, motion subtle + on-beat, audio balanced, safe-areas respected) and fixes for anything failing it.
**Acceptance criteria:** a fresh real reel passes the full checklist.
**Human check:** Mohamed signs off a reel as client-ready.

### T-504 — Docs + troubleshooting + tag v1.0 · `TODO`
**Depends on:** T-503 · **Type:** code
**Files:** `README.md`, `docs/TROUBLESHOOTING.md`, state files, git tag.
**Goal:** Usage docs (from zero: setup → produce a reel), troubleshooting, final state-file update, tag `v1.0`.
**Acceptance criteria:** a person can go from clone → produced reel using only the README; `v1.0` tagged + pushed.
**Human check:** Younes follows the README on his Mac from scratch and succeeds.

---

## Appendix — expanding a task into an Executor prompt

For any task above, the Planner fills spec Appendix E.1 like so: **TASK** = the task's Goal + Details; **FILES YOU MAY TOUCH** = the task's Files; **ACCEPTANCE CRITERIA** = the task's Acceptance criteria + Tests; **DONE MEANS** = the standard block (tests green, state files updated, one commit + push, completion report). For `HUMAN`/human-check tasks, the prompt additionally states exactly what the human must build or look at, and instructs the Executor **not to fake** any artifact it cannot create (e.g. the `.aep`) — it delivers the guide/registry/validation instead and marks the task awaiting human completion.

*End of Framopia Studio Task Breakdown v1.0. Begin with T-001.*
