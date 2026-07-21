# Framopia Studio

Internal automation tool that turns an already-cut talking-head video (Moroccan Darija / French / English) into a finished vertical reel — captions, B-roll images, music, and motion — by building an After Effects composition from hand-crafted templates.

**Operators:** Mohamed Anouar Zaki + Younes Derfoufi (Framopia). Not a public product.

## Quick links

- Full specification: `docs/FRAMOPIA_STUDIO_MASTER_SPEC.md`
- Task breakdown: `docs/FRAMOPIA_STUDIO_TASKS.md`
- Working task list: `TASKS.md`
- Build log: `PROGRESS.md`
- Decisions log: `DECISIONS.md`
- Executor standing instructions: `CLAUDE.md`

## Setup

```bash
cp .env.example .env
# Fill in GEMINI_API_KEY in .env

bash setup/mac_setup.sh   # installs all dependencies (T-003)
```

## Running the backend

```bash
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

## Running tests

```bash
cd backend && python -m pytest
```

## Live smoke test (HUMAN ONLY — costs real money)

`backend/scripts/live_smoke.py` runs the full M1 pipeline against the REAL
Gemini API, WhisperX, and librosa on a real short clip — it is never run by
pytest/CI and makes no network calls at import time. Requires a real
`GEMINI_API_KEY` in `backend/.env`.

```bash
cd backend
.venv/bin/python scripts/live_smoke.py /path/to/a/real/~5s-clip.mp4 \
    --brand-kit kitA \
    --brief "cold-brew coffee promo, upbeat"
```

It pauses at the transcript correction gate, lets you accept it as-is or
supply a corrected JSON file, resumes, and prints every artifact's path plus
the final `edit_plan.json` and an (incomplete — see D-050) cost estimate.

## Build status

See `TASKS.md` for current progress. M1 (backend pipeline) is code-complete
as of T-113, pending a human live-smoke run against the real Gemini API.
