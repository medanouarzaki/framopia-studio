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

## D-003 · librosa version pin (2026-07-20)

**Decision:** `librosa>=0.10.1,<1.0` in `pyproject.toml`.

**Reason:** librosa 0.10.x is the last thoroughly stable release series with a stable public API. Pinning `<1.0` protects against a future breaking major-version bump. numpy and scipy are left lower-bounded only since librosa's own resolver manages their compatibility.

---

## D-004 · Version string source (2026-07-20)

**Decision:** `__version__ = "0.1.0"` in `backend/app/__init__.py` is the single source of truth. `pyproject.toml` `[project].version` mirrors it (both say `0.1.0`); `/health` reads it via `from app import __version__`.

**Reason:** Avoids `importlib.metadata` (requires the package to be installed, complicates test environments). One definition, imported everywhere — no duplication. If ever driven from VCS tags, only `__init__.py` changes.

---

## D-005 · beat_aligned constrains START only, not end (2026-07-20)

**Decision:** When `beat_aligned=true` on a Visual, the validator requires that `visual.start` is within `1/fps` seconds (one frame) of some beat in the `beats` array. The `end` time is NOT required to be on a beat — it only needs to lie within `[0, reel.duration]`.

**Reason:** Resolves Contradiction #1 (Planner-decided). Spec §8 text said both start/end match a beat, but the golden's v3 has `end=11.5` which is not in its `beats` array. The musical intent is that a visual *begins* on a beat; how long it stays is a pacing choice, not a beat-snap requirement. Using one frame (1/fps) as epsilon accommodates floating-point precision.

**Beat epsilon formula:** `beat_epsilon = 1.0 / reel.fps` — computed at validation time from the plan's own fps. No separate field needed.

---

## D-006 · Motion modeled as a single class with kind discriminator (2026-07-20)

**Decision:** Both motion shapes (`punch_in` and `transition`) are represented by a single `Motion` class with `kind: Literal["punch_in","transition"]`, with `target` and `amount` as optional fields validated by a `model_validator` that requires them when `kind=="punch_in"`.

**Reason:** The two shapes share `kind`, `template`, and `at`. Using a single class with a post-construction validator avoids a Pydantic Union/discriminated-union pattern, which adds complexity for a two-shape case. If a third motion kind is added later with divergent fields, discriminated unions are the upgrade path — log a decision at that point.

---

## D-007 · Transition template name is "transition_whip_pan", not "whip_pan" (2026-07-20)

**Decision:** The transition template in the golden and all code is named `"transition_whip_pan"`, using the `transition_*` prefix from Appendix F's naming convention. Appendix A used the bare name `"whip_pan"` — that was an inconsistency in the spec, resolved in favour of the convention.

**Reason:** Resolves Contradiction #2 (Planner-decided). Appendix F establishes `transition_*` as the sigil-prefix category for transition templates. The registry (T-202) and the authored templates (T-203) will both use this convention; using `"whip_pan"` in the golden would create a mismatch the validator would catch (correctly) as "unknown template". Consistency wins.

---

## D-008 · validate_edit_plan template check is opt-in (known_templates=None skips) (2026-07-20)

**Decision:** `validate_edit_plan()` accepts `known_templates: set[str] | None`. When `None`, the template check is entirely skipped. When a set is provided, every template name in the plan must be in it or a `EditPlanValidationError` is raised.

**Reason:** The golden must be usable as a standalone test fixture before T-202 creates the real registry. Opt-in checking (pass a set to enable) rather than opt-out (pass a flag to disable) is the cleaner API — absence of context means the check doesn't apply yet.

---
