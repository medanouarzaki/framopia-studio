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
