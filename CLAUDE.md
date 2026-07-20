# CLAUDE.md — Framopia Studio Executor Standing Instructions

## Project summary

Framopia Studio is a local, internal automation tool (two operators: Mohamed + Younes) that turns an already-cut talking-head video in Moroccan Darija/French/English into a finished vertical reel — captions, B-roll images, music, motion — by building an After Effects composition from hand-crafted templates. The pipeline lives in a local Python/FastAPI backend; After Effects is driven by ExtendScript; a CEP panel in AE is the operator UI. The Edit Plan JSON is the firm contract between the backend and AE. See `docs/FRAMOPIA_STUDIO_MASTER_SPEC.md` for the full spec.

## Read first every session

Before touching any file: read `PROGRESS.md` (latest entries), `TASKS.md` (next unchecked task), and `DECISIONS.md`. Confirm a clean `git status`. Never invent scope; do exactly one task per session.

## Coding standards (spec §18)

- **Python:** 3.12+, type hints everywhere, Pydantic v2 for all cross-boundary data, `ruff` for lint+format, docstrings on public functions. Small pure functions per pipeline stage; no hidden global state.
- **JS (panel):** modern vanilla, no heavy build step, thin console only.
- **ExtendScript:** ES3 constraints — no `let`/`const`, no arrow functions, no native `JSON` (use bundled `json2.js`). Defensive; wrap builds in `app.beginUndoGroup`/`endUndoGroup`; never assume a layer exists — check and log to build report. Degrade gracefully.
- **Template Contract sigils** (`#IMG`, `#TXT_MAIN`, `#TXT_WORD`, `#COLOR_ACCENT`, `#COLOR_BG`, `#LOGO`, `#SAFE`) are **sacred**. Changing them is a logged decision that touches both templates and code. See spec §9.3 and Appendix F.

## How to run tests

```bash
cd backend && .venv/bin/python -m pytest    # run all backend tests (use venv Python)
cd backend && .venv/bin/ruff check .        # lint
```

The venv lives at `backend/.venv`. Activate it with `source backend/.venv/bin/activate` or prefix
commands with `backend/.venv/bin/` as shown above. The venv is git-ignored.

Always run pytest before committing. Paste results in the completion report. A stage without a passing test is not done.

## Commit and push protocol (spec §17.3)

One task = one commit = one push. Always:

```bash
git add -A
git commit -m "<type>(<scope>): <description>"
git push
```

Conventional commit types: `feat`, `fix`, `chore`, `docs`, `test`. Never batch multiple tasks into one commit.

## State file update protocol

Every Executor session must, as its **final act**, update these four files before committing:
- **`TASKS.md`** — tick the completed task; add any newly discovered tasks.
- **`PROGRESS.md`** — append a dated entry: what was built, what was decided, what was learned, what the next session needs to know.
- **`DECISIONS.md`** — append any non-trivial technical decision + reason.
- **`CLAUDE.md`** — update if standing rules changed.

## The "never" list

- **Never** commit secrets (API keys, tokens) or write them to logs. `.env` is git-ignored; only `.env.example` is committed.
- **Never** invent scope beyond the current task. If it's not in the task, don't build it.
- **Never** change Template Contract sigils without logging a decision and updating both templates and code.
- **Never** skip the human correction gate in the pipeline (spec Stage 4).
- **Never** auto-render and publish a reel — stop at the built AE comp.
- **Never** bind the backend to `0.0.0.0`; localhost (`127.0.0.1`) only.
- **If you find a contradiction** with the spec or assumptions (spec §25): **stop, log it to `PROGRESS.md`, and report it.** Do not guess; the Planner resolves it first.

## Secrets and config

All API keys live in the git-ignored `.env`. Document new keys in `.env.example` (name only, no value). Never print key values in logs or output.

## Git workflow

- Branch `main` is always working and pullable. Commit straight to `main` for normal tasks. Use `feature/<name>` only for risky/experimental work.
- Every task pushes so Younes can pull at any time.
- If Younes has pushed while you were working: pull before push, resolve conflicts in this session.
