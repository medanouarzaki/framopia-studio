# Framopia Studio

Internal automation tool that turns an already-cut talking-head video (Moroccan Darija / French / English) into a finished vertical reel — captions, B-roll images, music, and motion — by building an After Effects composition from hand-crafted templates.

**Operators:** Mohamed Anouar Zaki + Younes (Framopia). Not a public product.

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

## Build status

See `TASKS.md` for current progress. Currently at M0 (foundations).
