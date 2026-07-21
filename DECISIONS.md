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

## D-009 · gemini_api_key is Optional — boot-and-report, not crash-on-missing (2026-07-20)

**Decision:** `gemini_api_key: SecretStr | None = None` in `Settings`. A missing key does NOT raise a ValidationError at startup. Instead, `/health` returns `keys_ok: false`, clearly signalling the missing key to the operator.

**Reason:** Spec §14.1 defines `/health` as the readiness surface. Crashing on import or server start before the operator can even see the health endpoint is a poor UX — especially during T-003 setup when the key may not yet be present. Boot-and-report (import succeeds, health shows red) matches how production services handle missing credentials.

---

## D-010 · SERVER_HOST is hardcoded, never configurable via env (2026-07-20)

**Decision:** `SERVER_HOST = "127.0.0.1"` is a constant in `app/main.py`, not a field in `Settings`. It will never be sourced from `.env` or any config.

**Reason:** Spec §21 requires the backend to bind to `127.0.0.1` only. If the host were a config field, a misconfigured `.env` or a future operator error could expose the service on `0.0.0.0`. Making it structurally impossible (not in config = cannot be overridden) is the only reliable enforcement. `SERVER_PORT` is in config (reasonable per-machine variation); host is not.

---

## D-011 · cost_ceiling_usd default = 5.0 USD (2026-07-20)

**Decision:** `cost_ceiling_usd: float = 5.0` in `Settings`.

**Reason:** The spec (§16.4) says to enforce a configurable ceiling but does not pick a value. For an internal two-operator tool, 5 USD per job is generous (a 30s reel with 8 images at ~4¢ each + ASR/text calls costs well under $1). 5 USD gives headroom for larger jobs while providing a meaningful guard against runaway loops. Operators override via `.env` for their workflow.

---

## D-012 · Job ID format: YYYYMMDD-HHMMSS-<6hex> (2026-07-20)

**Decision:** Job IDs are generated as `{UTC-timestamp}-{uuid4().hex[:6]}`, e.g. `20260720-143022-a3f9e1`.

**Reason:** Timestamp prefix makes IDs lexicographically sortable by creation time with no extra index. Six hex chars from uuid4 give 16^6 = ~16M collision resistance per second — more than adequate for a two-operator local tool. Human-readable without decoding. Job directories on disk sort in creation order.

---

## D-013 · In-memory status: source of truth for live state only (2026-07-20)

**Decision:** `JobManager._statuses` and `_jobs` dicts are the live source of truth. They are NOT persisted to disk beyond `job.json` (which holds durable metadata only, not live state). Cross-process-restart resume is OUT OF SCOPE for v1.

**Reason:** v1 is a local, two-operator tool. Restarts are intentional (config changes, code updates). In-flight jobs are uncommon and short (under a minute end-to-end). Adding durable state (a SQLite db, Redis, etc.) would increase complexity without proportional benefit. If a restart kills a job, the operator re-submits — acceptable tradeoff. Revisit for v2 if usage patterns change.

---

## D-014 · jobs_dir is NOT in Settings (2026-07-20)

**Decision:** The `jobs_root` path is NOT a `Settings` field and is never sourced from `.env`. `JobManager` accepts it as a constructor argument (defaulting to `DEFAULT_JOBS_ROOT = <repo_root>/jobs/`). Tests inject `tmp_path` directly.

**Reason:** Jobs root is a structural repo path, not an operator secret or environment variable. Putting it in Settings would invite operators to misconfigure it (e.g. writing jobs outside the repo). Keeping it hardcoded as a constant with an injectable override for tests is simpler, safer, and consistent with D-010 (host also not configurable). The repo's `.gitignore` already ignores `/jobs/`.

---

## D-015 · Input plumbing for ingest: source_path recorded on Job at create() (2026-07-21)

**Decision:** `source_path: str | None` and `client_asset_paths: list[str]` are added as optional fields on the `Job` model and stored in `job.json`. `JobManager.create()` accepts them as optional keyword arguments. The ingest stage reads them from `ctx.job.source_path` and `ctx.job.client_asset_paths`.

**Reason:** The `Stage.run(ctx)` interface only receives `JobContext`, so external inputs must reach the stage via `ctx`. Two clean options: (a) record on `Job` at `create()` time — durable, explicit, auditable in `job.json`; (b) pre-placement convention — operator drops file in `client_dir` before running pipeline, ingest scans. Option (a) is better: eliminates "which file is the source?" ambiguity when multiple videos are in `client_dir`, is self-documenting, and requires only an additive field addition with no breaking changes to the T-101 surface.

---

## D-016 · 9:16 aspect-ratio tolerance = ±2% (2026-07-21)

**Decision:** Accept a take when `|width/height − 9/16| ≤ 0.02` (2%). Reject otherwise with a human-readable message including effective dimensions and the required ratio.

**Reason:** 1080×1920 and 720×1280 have exact 9/16 ratios (0.5625). Some codecs produce codec-aligned dimensions like 1088×1920 (aspect 0.5667, delta 0.0042) — within 2% and should be accepted. 2% is wide enough to catch codec alignment and floating-point imprecision while firmly rejecting 16:9 (delta ~1.2), 4:3, and other landscape ratios.

---

## D-017 · Duration bounds: 1 s minimum, 300 s maximum (2026-07-21)

**Decision:** Reject takes shorter than 1.0 s or longer than 300.0 s (5 minutes). Takes within [1.0, 300.0] s are accepted.

**Reason:** Spec §3 targets ~30 s reels, up to ~90 s without breaking. 1 s minimum rejects nonsense clips and test flashes that would produce empty or degenerate Edit Plans. 300 s (5 min) ceiling is ~3.3× the spec maximum (90 s), giving generous headroom for operator use-cases while guarding against accidental full-episode ingests that would blow cost ceilings and AE composition limits.

---

## D-018 · Rotation handling: swap w/h for 90°/270°; 0°/180° unchanged (2026-07-21)

**Decision:** Read display rotation from `side_data_list[].rotation` (modern ffprobe) first; fall back to `tags.rotate`. Normalize with `% 360`. Swap width/height when rotation is 90° or 270°. Leave 0°/180° unchanged (180° rotates image but preserves landscape/portrait orientation). Other rotation values are not swapped.

**Reason:** Phone cameras often store footage as 1920×1080 + 90° rotation tag; the displayed image is portrait 1080×1920. Not swapping would cause these valid portrait takes to fail the 9:16 check. The 90°/270° case covers all known phone models. Other angles (45°, etc.) are exotic and don't swap portrait/landscape; leaving them unswapped is the safer default.

---

## D-019 · FPS warning range: 24–60 fps (2026-07-21)

**Decision:** Warn (do NOT reject) when `fps < 24.0` or `fps > 60.0`. Warning is included in the ingest log entry. Pipeline proceeds normally.

**Reason:** The design target is standard social-media frame rates (24/25/30/60 fps). Outside this range, the take may still be usable (e.g. 120 fps slow-mo content can be ingested at its native rate and matched in AE). Rejection would be too strict; warning surfaces the anomaly so the operator can verify the AE comp frame rate matches before the build stage.

---

## D-020 · ffprobe consolidation deferred to a future session (2026-07-21)

**Decision:** The `_run_ffprobe()` helper in `app/pipeline/ingest.py` is NOT moved to `app/clients/ffmpeg.py` in this session. `probe()` was added to `ffmpeg.py` for use by new stages; ingest keeps its own private copy.

**Reason:** `test_ingest.py` mocks `app.pipeline.ingest.subprocess.run` at three call sites. Consolidating would require changing those patch targets to `app.clients.ffmpeg.subprocess.run` — i.e. touching T-102 tests. The task spec explicitly prohibits that. Deferred. A future session (e.g. T-113 cleanup) can update the three mock paths in `test_ingest.py` and then move `_run_ffprobe` to `ffmpeg.py`.

---

## D-022 · Gemini model IDs in Settings (2026-07-21)

**Decision:** Three model-ID fields added to `Settings` (all overridable via `.env`):
- `gemini_text_model: str = "gemini-2.5-flash"` — for ASR (Stage 3) and understanding (Stage 6).
- `gemini_image_model: str = "gemini-3.1-flash-image"` — Nano Banana 2, default workhorse image model.
- `gemini_image_pro_model: str = "gemini-3-pro-image"` — Nano Banana Pro, hero-shot escalation.

**Reason (text model):** Spec §6.2/§6.3 calls for "current Gemini flagship audio-capable model" but gives no concrete model ID. `gemini-2.5-flash` is the 2025-era flagship that handles audio + reasoning and code-switched Darija. If Google renames the model, operators update `GEMINI_TEXT_MODEL=...` in `.env` without touching code. T-105/T-108 should rely on `settings.gemini_text_model`, not a hardcoded string. (**Flag for Planner:** confirm or adjust this model ID before T-105 is tested against the live API.)

**Reason (image models):** Spec §6.4 names `gemini-3.1-flash-image` and `gemini-3-pro-image` explicitly — these are taken verbatim.

---

## D-023 · Gemini injection seam: class-based injectable transport (2026-07-21)

**Decision:** `GeminiClient.__init__` takes an optional `transport: GeminiTransport | None` callable. If None, the real `_http_transport` is used. Tests always inject a fixture-returning callable; `backoff_s=0` zeroes the retry sleep.

**Reason:** A class-based seam is explicit, typed, and doesn't require monkeypatching module globals — the injection is visible at the call site in tests. Alternative (module-level `_transport` var with monkeypatch) was considered but is less visible and can cause test-isolation issues if teardown is incomplete. The `backoff_s` parameter makes retry tests fast without a separate `unittest.mock.patch` on `time.sleep`.

---

## D-024 · Image cost estimates: $0.04 Nano Banana 2, $0.08 Nano Banana Pro (2026-07-21)

**Decision:** `_COST_NANO_BANANA_2_USD = 0.04` and `_COST_NANO_BANANA_PRO_USD = 0.08` (constants in `gemini.py`).

**Reason:** Spec §6.4 states "~4¢/image" for Nano Banana 2 and "~2× cost" for Pro. These are estimates — actual Gemini pricing depends on resolution and API tier. The CostMeter uses these to give the operator an indicative ceiling guard; T-111 enforces the ceiling. If pricing changes, update the constants (not the ceiling logic).

---

## D-025 · Retry policy: 3 attempts, 1s default backoff, transient-only (2026-07-21)

**Decision:** `max_attempts=3` (2 retries), `backoff_s=1.0` by default, both injectable on `GeminiClient`. Only `GeminiTransientError` (429, 5xx, timeout) triggers retries. Any other `GeminiError` propagates immediately.

**Reason:** Three attempts covers most transient bursts (quota reset, brief 5xx). More than 3 attempts risks pipeline stalls inside a ~30s reel job. The 1s backoff is gentle for a low-volume internal tool. Making both injectable allows tests to pass `backoff_s=0` for speed without mocking `time.sleep`. The transient/non-transient split means auth failures (4xx) surface immediately rather than wasting 3 attempts.

---

## D-026 · §11.2 mixed-script rule is LOCKED in asr.md prompt (2026-07-21)

**Decision:** The script-assignment rule (French/English/technical → Latin; Darija/Arabic → Arabic)
is encoded verbatim in `app/prompts/asr.md` and marked LOCKED. The rule text must not be weakened
or reversed by any future session without a Planner decision and a new DECISIONS.md entry.

**Reason:** Spec §11.2 locks this rule. Mixed-script captions with correct bidi shaping depend on
the ASR output using the right script for each word. If this rule were relaxed (e.g. Darija in Latin
transliteration), the entire caption rendering pipeline (T-303) would produce incorrect output. The
lock makes the constraint explicit so no Executor changes it thinking it's incidental.

**Enforcement:** `test_asr_prompt_contains_latin_script_rule` and
`test_asr_prompt_contains_arabic_script_rule` in `tests/test_asr.py` fail if the rule is removed from
the prompt, providing a test-level guard.

---

## D-027 · POST /jobs/{id}/transcript: URL job_id overrides body job_id (2026-07-21)

**Decision:** When writing `transcript_corrected.json`, the `job_id` is taken from the URL path
parameter, not from the `Transcript` body's `job_id` field. The body's `job_id` is ignored.

**Reason:** The URL is the authoritative identifier. If the operator round-trips the raw transcript
(copy GET response, POST it back), the `job_id` in the body is the same as the URL. But if the
body has a wrong or stale `job_id` (e.g. pasted from a different job), using the URL avoids
silently writing a self-inconsistent file. Tests assert this with a "WRONG-ID" body.

---

## D-028 · Correction gate POST uses FastAPI BackgroundTasks for resume (2026-07-21)

**Decision:** `POST /jobs/{id}/transcript` schedules `mgr.resume(job_id)` via
`background_tasks.add_task(mgr.resume, job_id)` (FastAPI `BackgroundTasks`) rather than
awaiting it directly in the endpoint.

**Reason:** Spec §14.2 states remaining pipeline stages run asynchronously; the panel polls
`/status`. If resume is awaited directly, the POST blocks until all downstream stages complete —
for a real pipeline with Gemini calls, this could take 30–60+ seconds. BackgroundTasks returns the
response first, then runs the resume. TestClient (Starlette) completes background tasks before
returning from `client.post()`, so tests remain deterministic.

---

## D-029 · JobManager singleton via lazy app.state + dependency injection (2026-07-21)

**Decision:** A single `JobManager` instance is stored in `app.state.job_manager` and exposed via
a FastAPI `_get_manager(request)` dependency. It is initialised lazily on the first request (no
`lifespan` needed). Tests override it by directly assigning `app.state.job_manager = mgr` with a
tmp_path-based manager before calling any endpoint.

**Reason:** A lifespan context manager would run during `TestClient(app)` setup, creating a manager
with the default `jobs_root`. Tests would then need to override it anyway. The lazy approach is
simpler: tests assign before the first request, the lazy check never fires. Existing `test_health.py`
tests are unaffected since they don't call job endpoints. This is NOT T-113's full `POST /jobs`
orchestration endpoint — just the minimal manager wiring needed for T-106.

---

## D-030 · Forced aligner backend: WhisperX (2026-07-21)

**Decision:** WhisperX (`pip install whisperx`) is the chosen production forced-alignment backend,
using the Arabic wav2vec2 model `jonatasgrosman/wav2vec2-large-xlsr-53-arabic` by default.

**Reason — chosen over MFA:**
MFA requires per-language pronunciation dictionaries + kaldi + conda. Mixed-script Darija+French
in a single segment requires a multilingual dictionary MFA does not natively provide. Conda install
overhead is large; MFA is the heaviest option.

**Reason — chosen over aeneas:**
aeneas uses eSpeak NG for phoneme synthesis (system dep, not pip-only) and works at fragment level
with per-fragment language specification. Handling code-switched segments (Arabic and French words
in the same sentence) requires splitting by language and re-merging — fragile for Darija.

**Reason — chosen WhisperX:**
WhisperX's `align()` function accepts pre-set `segments` (seeded text) and aligns them to audio
without re-transcribing. It is pip-installable (no conda), supports Arabic via HuggingFace models,
and is designed for exactly this use case. The Arabic xlsr-53 model covers Darija phonetics
adequately for caption-display timing accuracy (±100 ms).

**Mixed-script limitation:** A single Arabic model is used for the full audio of each segment.
French/English words in a code-switched segment get Arabic-phoneme alignment, which may be ±100–
200 ms off for individual words. This is acceptable for caption display timing in v1. If needed,
T-113 can detect per-segment dominant language and switch models (log a decision at that point).

**T-003 install requirement (Planner action needed):**
mac_setup.sh must add: `pip install whisperx torch torchvision torchaudio`
Model `jonatasgrosman/wav2vec2-large-xlsr-53-arabic` downloads automatically on first use via HF
cache. This was NOT in the original T-003 spec; Planner must add it before T-003 runs.

---

## D-031 · Per-word script derived from codepoints, not segment hint (2026-07-21)

**Decision:** In `run_align`, the `script` tag for each word is derived from the word's OWN Unicode
codepoints. Any codepoint in the Arabic blocks (U+0600–U+06FF, U+0750–U+077F, U+08A0–U+08FF,
U+FB50–U+FDFF, U+FE70–U+FEFF) → `"arabic"`; otherwise → `"latin"`. The T-105 segment-level `script`
hint is NOT inherited.

**Reason:** The segment hint is a coarse approximation for the dominant script of a whole segment.
A segment labelled `"arabic"` may contain French words ("promo", "design", "marketing") that are
`"latin"` at the word level. The T-303 caption builder and bidi text shaping need per-word script
accuracy, not segment-level. Codepoint derivation is unambiguous, has no external dependencies, and
is consistent with the §11.2 mixed-script rule. The segment hint is still written to
`transcript_raw.json` for operator reference but is not used downstream.

---

## D-032 · words.json is a flat list, not a nested object (2026-07-21)

**Decision:** `words.json` is a JSON array (not `{job_id, words: [...]}`), placed at the job root:
`job_dir/words.json`. Each element: `{word, script, start, end, segment_index}`.

**Reason:** Spec Stage 5 describes the output as "a flat list of per-word timings." A flat list
is the simplest shape for T-108 (understanding) and T-303 (AE caption builder) to consume — both
iterate the list linearly. Adding a wrapper object would require callers to navigate one extra
level with no benefit. The `segment_index` field maintains segment provenance without nesting.
Placement at job root is consistent with `audio.wav`, `transcript_raw.json`, and
`transcript_corrected.json` (D-021).

---

## D-021 · audio.wav lives at job_dir/audio.wav, NOT assets/audio/ (2026-07-21)

**Decision:** The extracted speech WAV is written to `ctx.paths.job_dir / "audio.wav"` (the job root), not to `ctx.paths.audio_dir` (`assets/audio/`).

**Reason:** Spec §5 workspace diagram places `audio.wav` at the job root alongside `input.mp4` and `job.json`. `assets/audio/` is reserved for music/SFX assets referenced by the Edit Plan (e.g. `track_cozy_01.wav` selected by T-109). Mixing the speech track into `assets/audio/` would require the music-selection stage to distinguish them, adding fragility. Keeping them at different levels makes the distinction structural.

---
