# PROGRESS.md — Framopia Studio Append-Only Build Log

One dated entry per completed task. Append only; never edit past entries.
Every Executor session reads the latest entries here before starting work.

---

## 2026-07-20 — T-000 · GitHub + git tooling bootstrap

**What was done:** Verified this machine (Mohamed's Mac) is ready for non-interactive GitHub operations.
- Homebrew 5.1.15 already installed.
- git 2.50.1 (Apple Git-155) already installed.
- gh CLI 2.89.0 already installed.
- `gh auth status` confirmed: logged in as `medanouarzaki` via keyring, HTTPS protocol.
- Token scopes: `repo`, `workflow`, `gist`, `read:org` — sufficient for all future operations.
- `git config --global user.name` = "Mohamed Anouar Zaki"; `user.email` = "zakimohammedanouar@gmail.com" — already set.

**Outcome:** No human browser action was needed (account was already authorized). From this point forward, all git and GitHub operations are fully non-interactive.

**Next session needs to know:** T-001 can proceed immediately.

---

## 2026-07-20 — T-001 · Repo scaffolding + state files + create/push private repo

**What was done:**
- Built the full repository directory tree per spec §15, with `.gitkeep` in all empty directories.
- `docs/FRAMOPIA_STUDIO_MASTER_SPEC.md` and `docs/FRAMOPIA_STUDIO_TASKS.md` were already in `docs/` — no move needed.
- Created and seeded all four state files: `CLAUDE.md`, `PROGRESS.md`, `TASKS.md`, `DECISIONS.md`.
- Created `.gitignore` (ignores `.env`, `/jobs`, music tracks, brand kit samples, caches, venv, node_modules).
- Created `.env.example` documenting `GEMINI_API_KEY` and optional future keys.
- Created `.claude/settings.json` with `acceptEdits` default + full allowlist (git, gh, brew, pytest, python, npm, ffmpeg) + deny list (rm -rf, sudo).
- Created `README.md`, `docs/edit_plan.example.json` (golden plan from spec Appendix A), `music/library.json` (schema + placeholder entries), `brand_kits/framopia-clientA/config.json` (placeholder palette — **humans must fill real palette + choose dual-script font**).
- Initialized git repo, committed all files, created private GitHub repo `medanouarzaki/framopia-studio` via `gh repo create`, and pushed to `main`.

**Repo URL:** https://github.com/medanouarzaki/framopia-studio

**Decisions logged:** D-001 (root TASKS.md vs docs/ copy), D-002 (private repo via gh CLI).

**TODO (flagged):** Younes's GitHub username is unknown. Once provided, run:
```bash
gh api -X PUT repos/medanouarzaki/framopia-studio/collaborators/<YOUNES_USERNAME> -f permission=push
```
This is the only remaining step for T-001.

**What was learned:** The spec and tasks files were already placed in `docs/` before this session started (no move needed). The `docs/edit_plan.example.json` golden artifact was created from spec Appendix A.

**Next session needs to know:** T-002 (Python backend + /health) is next. The backend must bind to `127.0.0.1` only. Brand Kit `config.json` has placeholder palette — Mohamed/Younes need to fill real values before T-201, but that's not a blocker now.

---

## 2026-07-20 — T-002 · Python backend project + tooling + /health

**What was done:**
- Created `backend/pyproject.toml` (hatchling build, Python 3.12+, all runtime + dev deps declared).
- Created `backend/app/__init__.py` with `__version__ = "0.1.0"` as the single version source.
- Created `backend/app/main.py`: FastAPI app with `GET /health` returning `{status, version, ffmpeg_ok, keys_ok}`; `SERVER_HOST = "127.0.0.1"` and `SERVER_PORT = 8000` as the single binding constants; `ffmpeg_ok` and `keys_ok` are stubs (both `True`) until T-005.
- Created `backend/app/config.py`: importable stub only, clearly marked `# T-005: full config`.
- Created `backend/tests/test_health.py`: 4 tests — 200 status, response shape + types, exact key set, localhost-only binding assertion.
- Installed all deps into `backend/.venv` (Python 3.14.2 — satisfies ≥3.12).
- `pytest`: 4/4 passed. `ruff check`: all checks passed (one import-sort auto-fixed).

**Runtime on this machine:** Python 3.14.2 (Homebrew) — newer than the 3.12+ spec minimum; no compatibility issues found.

**Decisions logged:** D-003 (librosa version pin), D-004 (version string source).

**What T-005 needs to know:**
- `ffmpeg_ok` and `keys_ok` in `/health` are explicit stubs; T-005 replaces with real checks.
- `SERVER_PORT = 8000` is in `app/main.py`; T-005 should wire it to `pydantic-settings` config.
- Venv lives at `backend/.venv`; use `backend/.venv/bin/python -m pytest` or activate it.

**What T-004 needs to know:** `backend/app/models/` is empty (only `.gitkeep`); T-004 creates `edit_plan.py` there. `backend/app/__init__.py` exists and exports `__version__`.

**Next task:** T-004 (Edit Plan schema + golden example + validator) or T-005 (config + secrets) — both depend only on T-002. Either can go next; T-004 is the central contract.

---

## 2026-07-20 — T-004 · Edit Plan schema (Pydantic) + golden example + validator

**What was done:**
- Created `backend/app/models/edit_plan.py`: full Pydantic v2 models (`Word`, `CaptionLine`, `Reel`, `Source`, `Visual`, `Motion`, `MusicCue`, `SfxCue`, `AudioPlan`, `Meta`, `EditPlan`) matching spec §8 field-for-field.
- In-plan model_validators: word non-overlap with touching allowed; visual windows within [0, duration] with end>start; beat_aligned visuals' START within 1/fps of some beat (D-005); Motion punch_in requires target+amount; Visual kind/payload consistency.
- Created `backend/app/models/validate.py`: `validate_edit_plan(plan, *, known_templates, check_assets, job_dir)` for external context — template registry check (D-007, skippable before T-202) and asset existence check (skippable by default).
- Created `backend/app/models/__init__.py` exporting all public models.
- The `docs/edit_plan.example.json` golden was already correct (transition_whip_pan, exact beat-start matches) — no changes needed.
- 18 new tests in `backend/tests/test_edit_plan.py`; full suite 22/22 passed; ruff clean.

**Resolved contradictions implemented and logged (D-005, D-007):**
- **Contradiction #1 (beat alignment):** §8 said both start and end must be on a beat, but Appendix A golden's v3 has end=11.5 not in its beats array. Resolution (D-005): beat_aligned constrains START only; END is bounded by [0, duration]. Implemented in `check_plan_constraints`.
- **Contradiction #2 (transition template name):** Appendix A wrote "whip_pan", but Appendix F prefix convention and T-203 require "transition_whip_pan". Resolution (D-007): golden and all code use "transition_whip_pan". Golden was already correct from T-001.

**What T-005 needs to know:** No dependencies on config from models/validate. `EditPlan` and `validate_edit_plan` are importable as-is.

**What T-112 needs to know:** Assembly stage creates the plan dict and calls `EditPlan.model_validate(d)` then `validate_edit_plan(plan, known_templates=registry.template_names())` — the registry check is skipped until T-202 lands.

**What T-202 needs to know:** `validate_edit_plan(..., known_templates=<set>)` is the hook for the real registry check. Pass the set of template names from `registry.json`.

**What the AE side needs to know:** Golden at `docs/edit_plan.example.json` is a valid, complete plan. Load it with `json2.js` in ExtendScript to develop and test T-301+ without the backend.

**Next task:** T-005 (config + secrets + cost-control scaffolding) — completes M0 and unblocks T-101+.

---
