# DECISIONS.md — Framopia Studio Append-Only Decisions Log

All non-trivial technical decisions and their reasons are logged here so no future session re-litigates a settled choice. Append only; never delete or edit past entries.

---

## Locked decisions from spec §25 (seeded at project init — 2026-07-20)

**D-A1 · Input contract (LOCKED)**
Input is always already-cut, single-speaker, 9:16, ~30 seconds. Framopia Studio is a decorator, not an editor. Reason: simplifies every downstream decision; humans handle cutting/retakes before handing off.

**D-A2 · Caption fill mechanism (LOCKED — default)**
Caption template uses mechanism **(A) one text layer per word** initially (spec §11.4). The ExtendScript duplicates a `#TXT_WORD` prototype layer, one instance per word, each timed to its `[start, end]`. Reason: simple, robust, and reliable for bidi + per-word styling; revisit mechanism (B) only if layer count becomes unwieldy (will log that decision if it arises).

**D-A3 · Product name and repo slug (LOCKED)**
Tool name is **Framopia Studio**; GitHub repo/slug is `framopia-studio` under `medanouarzaki`. Reason: settled by owner.

**D-A4 · Single AI provider for v1 (LOCKED)**
Gemini is the sole provider for ASR + understanding + image generation in v1. `GEMINI_API_KEY` is the only required secret. ElevenLabs/Whisper fallback ASR is a future hook only. Reason: one model family keeps auth and billing simple; Gemini handles code-switched Darija+French+English better than MSA-tuned engines.

**D-A5 · Git branching strategy (LOCKED)**
Straight-to-`main` for all normal tasks (tasks are small and tested). Feature branches (`feature/<name>`) only for risky or exploratory work. Reason: tasks are scoped small enough that branch overhead is not justified for v1.

**D-A6 · Claude Code permission mode (LOCKED)**
Claude Code runs `acceptEdits` + allowlist by default (`.claude/settings.json`). Bypass mode (`--dangerously-skip-permissions`) is available for hands-off runs with git as the safety net. Reason: file edits flow without prompts; whitelisted commands (git, gh, pytest, ffmpeg, etc.) run without prompts; anything with external side effects outside the allowlist still asks — a good local safety net.

---

## D-001 · root TASKS.md vs docs/ copy (2026-07-20)

**Decision:** `docs/FRAMOPIA_STUDIO_TASKS.md` is the detailed spec (full task descriptions, acceptance criteria, notes). The root `TASKS.md` is the working checkbox list Executors tick after each task. Both are committed; they serve different purposes and are kept in sync manually — the root copy is the live status board.

**Reason:** The spec states "docs/ holds the canonical copy; root copy is the one Executors tick." Keeping them separate avoids Executors needing to parse the full spec document to find the task status section. The root copy is a concise, scannable checkbox list.

---

## D-002 · Private GitHub repo created via gh CLI (2026-07-20)

**Decision:** The GitHub repo `medanouarzaki/framopia-studio` is private, created and pushed entirely via `gh repo create ... --private --source=. --remote=origin --push` with no manual website steps.

**Reason:** Spec §17.6 requires the build to be fully automated via CLI. Both operators (Mohamed + Younes) have push access; Younes to be added as a collaborator once his GitHub username is provided.

---
