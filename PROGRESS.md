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

## 2026-07-20 — T-005 · Config + secrets + cost-control scaffolding (pre-flight + main task)

**Pre-flight (bidi lock guard R2):**
Verified by codepoint inspection that the golden's Arabic words are stored in correct logical Unicode order:
- بزاف = U+0628 U+0632 U+0627 U+0641 (correct) ✓
- ديال = U+062F U+064A U+0627 U+0644 (correct) ✓
Added `test_bidi_caption_arabic_logical_codepoint_order` to `test_edit_plan.py` asserting character-by-character equality so any byte-reversal breaks a test. Committed separately as `bc4598f`.

**What was built (T-005):**
- `backend/app/config.py`: pydantic-settings `Settings` class with `gemini_api_key: SecretStr | None` (optional, boot-and-report), `elevenlabs_api_key`, `backend_port`, `max_images_per_job`, `cheap_mode`, `cost_ceiling_usd`. `get_settings(_env_file)` with `@cache` for injectable test isolation; `clear_settings_cache()` for test teardown.
- `backend/app/util/__init__.py` + `backend/app/util/cost.py`: `CostMeter` — `add()`, `total()`, `exceeds_ceiling()`, `reset()`. Pure, no I/O, no secrets.
- `backend/app/main.py`: `/health` now returns real `ffmpeg_ok` (shutil.which) and `keys_ok` (gemini_api_key non-None + non-empty). `SERVER_PORT` from `Settings.backend_port`; `SERVER_HOST` remains hardcoded to `"127.0.0.1"` (not configurable by design).
- `backend/tests/test_config.py`: 15 tests covering fixture load, defaults, missing-key no-crash, SecretStr masking in repr/str/logs, cache/cache-clear, and CostMeter.
- `backend/tests/test_health.py`: updated — `ffmpeg_ok`/`keys_ok` assertions now check types only (not hardcoded True), plus a reality-check test for each.
- 40/40 tests green; ruff clean.

**⚠ Python runtime flag for T-003:**
This machine runs Python 3.14.2 (Homebrew default). The spec (§6.1 / Appendix D) pins `python@3.12`. The current venv is built from 3.14. T-003's `mac_setup.sh` will run `brew install python@3.12` and may build a second venv from that, creating two subtly different runtimes. T-003 must decide: (a) standardize the venv on 3.12 per spec (rebuild the current .venv), OR (b) formally accept 3.14 as the project runtime (log as a decision). Do not resolve here; flag for T-003.

**Decisions logged:** D-009 (optional key + boot-and-report), D-010 (host not configurable), D-011 (cost ceiling default 5.0 USD).

**What M1 (T-101+) needs to know:**
- Import config via `from app.config import get_settings`.
- Never call `.get_secret_value()` in logging paths.
- `CostMeter` lives in `app.util.cost`; pipeline stages call `meter.add(estimated_usd)` after each billable Gemini call.
- `get_settings().cost_ceiling_usd` is the ceiling; `get_settings().max_images_per_job` caps image count.
- `get_settings().cheap_mode` disables Pro-tier image generation when True.

**M0 is now COMPLETE.** T-000 through T-005 are all done. Next: T-101 (job workspace + job manager + async runner) starts M1.

---

## 2026-07-20 — T-101 · Job workspace + job manager + async stage runner

**What was done:**
- Created `backend/app/models/job.py`: `JobState` (`enum.StrEnum` — values "running", "awaiting_correction", "ready_for_ae", "error"), `JobStatus` (state, stage, progress_pct clamped [0,100], message), `Job` (durable record — job_id, created_at, brand_kit, brief, width/height/fps/duration/model_ids).
- Updated `backend/app/models/__init__.py` to export `Job`, `JobState`, `JobStatus`.
- Created `backend/app/jobs/paths.py`: `WorkspacePaths` frozen dataclass with `jobs_root + job_id` constructor; properties for `job_dir`, `assets_dir`, `images_dir`, `audio_dir`, `client_dir`, `log_path`, `job_json_path`. `DEFAULT_JOBS_ROOT = <repo_root>/jobs/`.
- Created `backend/app/jobs/joblog.py`: `JobLogger` — append-only JSON Lines to `log.txt`; `log_stage()`, `log_error()`, `log_gate()`. Never logs secret values (spec §20).
- Created `backend/app/jobs/manager.py`: `JobContext` (job_id, paths, job, logger, settings), `Stage` (name, run callable, is_gate flag), `_PipelineState` (gate-pause record), `JobManager` (`create()`, `status()`, `get_job()`, `list_jobs()`, `run_pipeline()`, `resume()`, `_run_stages()`).
- Stage runner: iterates stages, updates status progress before each, calls `await stage.run(ctx)`, logs duration on success, sets ERROR + halts on exception, pauses at gate stages (saves `_PipelineState` in `_pending`), sets READY_FOR_AE + progress=100 on completion.
- `resume()` pops from `_pending`, re-enters `_run_stages()` with remaining stages.
- Created `backend/tests/test_jobs.py`: 15 tests — JobState string values, workspace scaffolding, job.json round-trip, initial status, tmp_path isolation, straight-through pipeline, progress advancement, gate pause, resume, resume-without-gate error, error halt, error message no-secret, log no-secret, progress_pct clamp, list_jobs.
- 55/55 tests green; ruff clean.

**Decisions logged:** D-012 (job ID format), D-013 (in-memory status scope), D-014 (jobs_dir not in Settings).

**What T-102 (ingest) needs to know:**
- Receive a `JobContext`; fill `ctx.job.width/height/fps/duration` and write updated `job.json` via `ctx.paths.job_json_path.write_text(ctx.job.model_dump_json(indent=2))`.
- Source video is at `ctx.paths.client_dir / <filename>` (provided by the operator; ingest validates its existence).
- Call `ctx.logger.log_stage("ingest", duration_s, width=w, height=h, fps=f, duration_s=d)` on success.

**What T-106 (correction gate API) needs to know:**
- Mark the ASR correction stage as `is_gate=True` in the pipeline stages list.
- After the operator submits a corrected transcript, call `await mgr.resume(job_id)` to continue downstream.
- `mgr._pending[job_id]` holds the remaining stages + ctx — the gate mechanism is generic.

**Next task:** T-102 (ingest stage) — first real pipeline stage.

---

## 2026-07-20 — T-102 · Ingest stage

**Pre-flight (commit 1c07f20 check):**
`git show 1c07f20` confirmed: authored by Mohamed Anouar ZAKI (same email as all prior commits),
message "Update operator name in README.md", diff adds surname "Derfoufi" to Younes's name in
README.md. One file changed; no state files (TASKS.md, PROGRESS.md, DECISIONS.md) touched.
**Verdict: benign — Mohamed's own commit, not a foreign/unexpected change. No contradiction with
state files. Pre-flight passes.**

**What was built:**
- `backend/app/pipeline/__init__.py` — new pipeline package.
- `backend/app/pipeline/ingest.py` — ingest stage:
  - `_run_ffprobe()`: shells out to `ffprobe -v quiet -print_format json -show_streams
    -show_format`; converts all failure modes (not found, timeout, bad exit, invalid JSON) to
    human-readable `IngestError` instead of raw stack traces.
  - `_effective_wh()`: reads display rotation from `side_data_list` first, falls back to
    `tags.rotate`; swaps w/h for 90°/270° (D-018).
  - `_parse_fps()`: converts `r_frame_rate` "num/den" to float.
  - `run_ingest(ctx)`: validates aspect (D-016, ±2%, 9:16 required), duration (D-017, 1–300 s),
    warns on unusual fps (D-019, outside 24–60), copies take → `job_dir/input.mp4`, copies client
    assets → `client_dir`, fills `ctx.job.width/height/fps/duration`, writes `job.json`.
- `backend/app/models/job.py` (additive): added `source_path: str | None` and
  `client_asset_paths: list[str]` to `Job` — stored in job.json, read by ingest (D-015).
- `backend/app/jobs/manager.py` (additive): extended `create()` with optional `source_path` and
  `client_asset_paths` parameters — backward-compatible, all existing tests still pass.
- `backend/tests/test_ingest.py` — 20 tests:
  - Unit: `_parse_fps` fraction/integer, `_effective_wh` no-rotation/90/270/180/side_data.
  - No-fftools: missing file, no source_path, ffprobe non-zero exit (mocked), ffprobe not found
    (mocked), invalid JSON (mocked).
  - Integration (fftools required): valid 1080×1920 records metadata + updates job.json, take
    copied to canonical location, client assets copied to client_dir, 1920×1080 rejected with
    "9:16" + dimensions in message, rejection does not write input.mp4, 720×1280 accepted,
    through-runner success → READY_FOR_AE, through-runner rejection → ERROR.

**Test results:** 75/75 passed (20 new + 55 prior). `ruff check .` clean.

**Input-plumbing decision (D-015):** `source_path` and `client_asset_paths` recorded on the Job
model at `create()` time. Stored in job.json so the decision is durable and auditable. The
`Stage.run(ctx)` interface needed no change. See DECISIONS.md.

**Decisions logged:** D-015 (input plumbing), D-016 (9:16 tolerance), D-017 (duration bounds),
D-018 (rotation handling), D-019 (fps warning range).

**What T-103 needs to know:**
- The canonical take is at `ctx.paths.job_dir / "input.mp4"` after ingest completes.
- The ffprobe helper is in `app/pipeline/ingest.py` — task spec says T-103 builds the full
  `app/clients/ffmpeg.py`; at that point the ingest helper should be consolidated there.
- `ctx.job.fps` is `round(fps)` (int); raw float fps is in the log entry.

**Next task:** T-103 (audio extraction with ffmpeg).

---

## 2026-07-21 — T-103 · Audio extraction stage + shared ffmpeg client

**What was built:**
- `backend/app/clients/__init__.py` — new clients package.
- `backend/app/clients/ffmpeg.py` — shared subprocess wrapper:
  - `FfmpegError(RuntimeError)` — public error type for all ffmpeg/ffprobe failures.
  - `probe(path) -> dict` — runs ffprobe, returns parsed JSON; raises FfmpegError on all
    failure modes (not found, timeout, bad exit, invalid JSON).
  - `extract_audio(src, dst)` — runs ffmpeg to extract `-vn -ac 1 -ar 16000 -c:a pcm_s16le`
    WAV; raises FfmpegError on all failure modes.
- `backend/app/pipeline/audio.py` — audio extraction stage:
  - Checks `input.mp4` exists (AudioError if missing).
  - Probes for an audio stream via `clients.ffmpeg.probe()` — AudioError if no audio stream
    (talking-head takes must have speech; absence is a real error, not a silent empty wav).
  - Calls `clients.ffmpeg.extract_audio()` — AudioError on FfmpegError.
  - Verifies output with `wave` module: `getframerate()==16000`, `getnchannels()==1`.
  - Writes to `job_dir/audio.wav` (JOB ROOT — NOT assets/audio/).
  - Logs `ctx.logger.log_stage("audio", elapsed, sample_rate=16000, channels=1, out_bytes=N)`.
- `backend/tests/test_audio.py` — 12 tests (all passed):
  - Error type checks (FfmpegError, AudioError are RuntimeError).
  - Missing input.mp4, ffprobe failure (mocked), ffmpeg non-zero exit (mocked),
    ffmpeg not found during extract (mocked), no audio stream (mocked).
  - Integration: 16 kHz mono WAV verified via wave module, audio.wav at job root NOT
    assets/audio/, real video-only clip rejected, through-runner success (ready_for_ae),
    through-runner no-audio error state.

**ffprobe consolidation outcome (D-020 — DEFERRED):**
`test_ingest.py` patches `app.pipeline.ingest.subprocess.run` at three mock call sites.
Moving `_run_ffprobe` into `app/clients/ffmpeg.py` would require updating those patch paths to
`app.clients.ffmpeg.subprocess.run` — touching T-102 tests, which the task explicitly prohibits.
Consolidation deferred. `probe()` is in `ffmpeg.py` for use by new stages; ingest.py retains its
own `_run_ffprobe`. A future session can clean this up by updating the T-102 mock targets.

**Test results:** 87/87 passed (12 new + 75 prior). `ruff check .` clean (2 style fixes auto-applied).

**Decisions logged:** D-020 (ffprobe consolidation deferred), D-021 (audio.wav at job root).

**What T-104 (Gemini client) needs to know:**
- `app/clients/` is now the home for external client wrappers — Gemini client goes there too.
- `FfmpegError` is the established error pattern: public RuntimeError subclass + human-readable
  message; stage wraps in domain-specific error (AudioError). Follow same pattern for GeminiError.

**Next task:** T-104 (Gemini client — asr/understand/image, mockable).

---

## 2026-07-21 — T-104 · Mockable Gemini client

**What was built:**
- `backend/app/clients/gemini.py` — thin transport + retry client:
  - `GeminiError(RuntimeError)` + `GeminiTransientError(GeminiError)` error hierarchy.
  - Result types: `TranscriptSegment`, `TranscribeResult`, `UnderstandResult`, `ImageResult`.
  - `GeminiClient(transport=None, max_attempts=3, backoff_s=1.0)`:
    - `transcribe(audio_path, *, prompt=None, brief=None) -> TranscribeResult` — reads audio bytes,
      sends as base64 to Gemini, parses JSON array of segments from model output.
    - `understand(*, transcript, prompt=None, words=None, brief=None) -> UnderstandResult` — sends
      transcript; returns raw_text for T-108 to parse.
    - `generate_image(prompt, *, model=None, meter=None) -> ImageResult` — decodes base64 image
      bytes; increments CostMeter after successful generation.
  - Retry: bounded max_attempts on GeminiTransientError (429/5xx/timeout); non-transient errors
    propagate immediately without retry. backoff_s injectable so tests pass backoff_s=0.
  - Secrets discipline: key obtained via `.get_secret_value()` only in `_get_api_key()`;
    passed to transport; never logged or embedded in error messages.
  - Production HTTP transport via httpx (never called in tests — seam replaces it).
- `backend/app/config.py` (additive): three new model-ID fields — `gemini_text_model`,
  `gemini_image_model`, `gemini_image_pro_model` (D-022).
- `backend/tests/fixtures/gemini/` — three recorded fixture files:
  - `transcribe_response.json`: 2-segment Darija/French response with start/end/script.
  - `understand_response.json`: summary + segments JSON for understanding stage.
  - `image_response.json`: base64-encoded 1×1 PNG for image generation.
- `backend/tests/test_gemini.py` — 24 tests covering all methods, retry, cost meter, key safety.

**Injectable seam (for T-105/T-108/T-111 authors):**
Create a transport callable with signature `(method: str, model_id: str, payload: dict, api_key: str) -> dict`.
Pass it as `GeminiClient(transport=my_transport, backoff_s=0)`. The transport returns
`{"text": str, "model_id": str}` for text calls and `{"image_bytes_b64": str, "model_id": str}` for
image calls. Fixture files in `tests/fixtures/gemini/` show the exact dict shapes.

**Text model ID decision (D-022):** spec says "flagship audio-capable" but gives no concrete ID.
Chose `gemini-2.5-flash` as the 2025-era flagship audio+reasoning model. T-105/T-108 can
override per-job via `.env` (`GEMINI_TEXT_MODEL=...`) without touching code.

**Test results:** 111/111 passed (24 new + 87 prior). `ruff check .` clean.

**Decisions logged:** D-022 (model IDs in Settings), D-023 (injection seam design), D-024 (image
cost estimates), D-025 (retry policy).

**What T-105 (ASR stage) needs to know:**
- Import `GeminiClient` from `app.clients.gemini`.
- Write `app/prompts/asr.md` with the §11 script-and-code-switch prompt; pass it as
  `client.transcribe(audio_path, prompt=asr_prompt, brief=ctx.job.brief)`.
- The result is `TranscribeResult` — use `result.segments` (list of `TranscriptSegment`) and
  `result.raw_text` to build `transcript_raw.json`.
- In tests: `GeminiClient(transport=<fixture_transport>, backoff_s=0)`.

**What T-108 (understanding stage) needs to know:**
- Call `client.understand(transcript=..., prompt=understand_prompt, brief=ctx.job.brief)`.
- Parse `result.raw_text` as JSON to build `understanding.json`.

**What T-111 (image stage) needs to know:**
- Call `client.generate_image(prompt, meter=meter)` for Nano Banana 2 workhorse images.
- Call `client.generate_image(prompt, model=settings.gemini_image_pro_model, meter=meter)` for Pro.
- The CostMeter accumulates spend and T-111 enforces the ceiling.

**Next task:** T-105 (ASR stage — transcript_raw.json).

---

## 2026-07-21 — T-105 · ASR stage (transcript_raw.json)

**What was built:**
- `backend/app/prompts/asr.md` — ASR prompt encoding §11.2 mixed-script rule (LOCKED):
  - French/English/technical words → Latin script (marketing, promo, WhatsApp).
  - Darija/Arabic words → Arabic script (سلام، بزاف، كيفاش، مزيان، ديال).
  - Specifies JSON output format: `{text, start, end, confidence, script}` per segment.
  - No preamble, no markdown fences — model must return raw JSON array only.
- `backend/tests/fixtures/gemini/asr_transcribe_response.json` — ASR fixture with real Arabic
  codepoints: segment 0 is Darija (سلام، كيفاش تدير marketing؟, script:"arabic"),
  segment 1 is mixed (promo 300 dirham بزاف, script:"latin"). Codepoints verified: سلام =
  U+0633 U+0644 U+0627 U+0645; بزاف = U+0628 U+0632 U+0627 U+0641.
- `backend/app/pipeline/asr.py` — ASR stage:
  - Checks `job_dir/audio.wav` exists (AsrError if missing — T-103 must run first).
  - Reads `app/prompts/asr.md` at runtime (AsrError on OSError).
  - Calls `GeminiClient.transcribe(audio, prompt=prompt, brief=ctx.job.brief)`.
  - Shapes result into `{job_id, model_id, segments: [{index, text, start, end, confidence, script?}]}`.
  - Writes to `job_dir/transcript_raw.json` with `ensure_ascii=False` (preserves Arabic).
  - Injection seam: `run_asr(ctx, *, _gemini_client=None)` — tests pass
    `functools.partial(run_asr, _gemini_client=client)` to `Stage`.
- `backend/tests/test_asr.py` — 13 tests (all green):
  - Prompt file exists; prompt contains Latin-script rule + concrete French/English examples;
    prompt contains Arabic-script rule + Arabic codepoint examples.
  - Happy path: transcript_raw.json produced with correct job_id, model_id, 2 segments.
  - Segment shape: all required keys present, 0-based index ordering.
  - Placement: at job root, NOT under assets/.
  - Arabic codepoints (BIDI trap defence): seg0[0..3] asserted by exact codepoint value
    (U+0633 U+0644 U+0627 U+0645 = سلام); seg1 has both Latin + Arabic codepoints.
  - Script hint: "arabic" and "latin" carried through into output.
  - Missing audio.wav: error state, "audio.wav"+"not found" in message; no transcript written.
  - GeminiError surfaces as stage error with non-empty message.
  - Through-runner success: state=ready_for_ae, progress=100.0, transcript on disk.
  - Through-runner failure: state=error with message.

**Test results:** 124/124 passed (13 new + 111 prior). `ruff check .` clean (2 style fixes auto-applied to test_asr.py).

**BIDI trap institutional memory:**
Arabic stored in logical (Unicode) order in both the fixture and the output JSON. All test assertions
use codepoint integers, not string equality against visual representations. Future sessions that touch
ASR/caption must continue this practice: verify Arabic content with `ord(c)` checks, not display.

**What T-106 (correction gate API) needs to know:**
- After ASR completes, the operator can edit `transcript_raw.json` manually.
- The correction gate is a `Stage(is_gate=True)` that pauses the pipeline after ASR writes its output.
- T-106 adds an HTTP endpoint for the operator to submit the corrected transcript (or confirm as-is),
  then calls `mgr.resume(job_id)` to proceed to T-107 (forced alignment).
- The `transcript_raw.json` at job root is the editable artifact between ASR and alignment.

**What T-107 (forced alignment) needs to know:**
- Input: `job_dir/transcript_raw.json` (after operator correction gate).
- Output: `job_dir/words.json` with per-word `{text, start, end, confidence}` timings.
- Word-level alignment is the input to T-108's visual segmentation.

**Next task:** T-106 (correction gate API — pause/resume endpoint).

---

## 2026-07-21 — T-106 · Transcript correction gate API

**Pre-flight:** T-105 commit `2709fdb` confirmed on origin/main. Tree clean.

**What was built:**
- `backend/app/models/transcript.py` — shared Pydantic models (spec §14.3):
  - `TranscriptSegment`: `{index: int, text: str, start?, end?, confidence?, script?}`
  - `Transcript`: `{job_id: str, model_id: str, segments: list[TranscriptSegment]}`
  - Same shape used for `transcript_raw.json` (read by GET), POST body (validated by Pydantic),
    and `transcript_corrected.json` (written by POST). Shape field-for-field consistent with T-105.
- `backend/app/pipeline/correction_gate.py` — `CORRECTION_GATE_STAGE`:
  - `Stage(name="correction_gate", run=_noop, is_gate=True)`.
  - The noop run does nothing; `is_gate=True` in the T-101 runner handles the actual pause.
  - Module docstring explicitly states the gate MUST NEVER be skipped.
  - T-113 (pipeline assembly) will wire this between the ASR stage and downstream stages.
- `backend/app/main.py` — two new endpoints + lazy manager singleton:
  - `_get_manager(request)` dependency: returns `app.state.job_manager`, initialised on first
    use with the default `jobs_root`. Tests override by setting `app.state.job_manager = mgr`.
  - `GET /jobs/{id}/transcript`: reads `transcript_raw.json`; 404 on unknown job or missing file.
  - `POST /jobs/{id}/transcript`: validates body as `Transcript` (Pydantic → 422 on malformed);
    409 if job not in `awaiting_correction`; 404 if unknown; writes `transcript_corrected.json`
    at job root with `ensure_ascii=False`; schedules `mgr.resume(job_id)` via BackgroundTasks
    (§14.2: POST returns immediately, remaining stages run asynchronously).
  - `job_id` from the URL always overrides `job_id` in the body (D-027).
- `backend/app/models/__init__.py` — exports `Transcript`, `TranscriptSegment`.
- `backend/tests/test_correction_gate.py` — 21 tests (all green):
  - Gate is real pause: state=awaiting_correction; downstream did NOT run before POST.
  - transcript_raw.json exists on disk at the gate.
  - GET happy path: returns raw segments, job_id, model_id.
  - GET 404: unknown job; transcript not ready.
  - POST happy path: writes transcript_corrected.json at job root (not under assets/), resumes
    pipeline, downstream stub runs, state→ready_for_ae, progress=100.
  - POST: job_id from URL wins over body.
  - POST malformed: 422, job stays paused, no corrected.json written, downstream didn't run.
  - POST to non-awaiting job: 409 with "awaiting_correction" in detail.
  - POST after already resumed: 409 (second POST rejected).
  - Arabic codepoints: سلام (U+0633..U+0645) preserved in logical order; `ensure_ascii=False`
    means raw UTF-8 chars in file (no \\uXXXX escapes).

**Test results:** 145/145 passed (21 new + 124 prior). `ruff check .` clean (4 issues fixed: B008
`noqa` for two FastAPI `Depends` calls, B904 `from None` on two `raise HTTPException` in except).

**Resume via BackgroundTasks (D-028):**
`mgr.resume()` is an async coroutine. Using `background_tasks.add_task(mgr.resume, job_id)`
schedules it in FastAPI/Starlette's async execution after the response is sent. In TestClient
tests, background tasks complete before `client.post()` returns, so assertions after the POST
call reliably observe the post-resume state. No `asyncio.create_task` needed.

**Manager wiring (D-029):**
Lazy init via `_get_manager` dependency (no `lifespan` needed). Tests set `app.state.job_manager`
directly before TestClient calls, which overrides the lazy singleton. This keeps existing
`test_health.py` tests unaffected (they don't call job endpoints).

**What T-107 (forced alignment) needs to know:**
- Input: `job_dir/transcript_corrected.json` (NOT `transcript_raw.json` — operator's corrections
  must be honoured). If the operator confirmed without changes, the corrected file is a copy of raw.
- `Transcript` model is in `app/models/transcript.py` — import and use to read/validate the input.
- `transcript_corrected.json` is always at job root (D-021 placement consistency).
- Output: `job_dir/words.json` with per-word `{text, start, end, confidence}` timings.

**Next task:** T-107 (forced alignment stage — words.json).

---

## 2026-07-21 — T-107 · Forced alignment stage (words.json)

**Pre-flight:** T-106 commit `1e1f376` confirmed on origin/main. Tree clean.

**What was built:**
- `backend/app/clients/aligner.py` — aligner interface + WhisperX adapter:
  - `AlignerError(RuntimeError)` — client-level error.
  - `AlignerCallable = Callable[[Path, list[str]], list[tuple[float, float]]]` — the public type
    contract: `(audio_path, words) -> [(start_s, end_s), ...]`.
  - `make_whisperx_aligner(*, model_name, language, device) -> AlignerCallable` — factory that
    returns a closure; heavy imports (`whisperx`) are INSIDE the closure body, so importing this
    module does NOT require WhisperX/torch to be installed. The unit-test suite is unaffected.
- `backend/app/pipeline/align.py` — forced-alignment stage:
  - `AlignError(RuntimeError)` — stage-level error.
  - `_ARABIC_RANGES` — five Arabic Unicode blocks from spec §6.2 / D-031.
  - `_MONO_EPSILON = 1e-4` — 0.1 ms tolerance for floating-point monotonicity checks.
  - `_derive_script(word) -> "arabic"|"latin"` — codepoint-based, NOT inherited from segment hint.
  - `_read_audio_duration(audio_path)` — reads PCM WAV header via stdlib wave module.
  - `run_align(ctx, *, _aligner=None)` — stage entry point:
    1. Checks audio.wav and transcript_corrected.json exist (AlignError if missing).
    2. Reads + validates corrected transcript via Transcript Pydantic model.
    3. Tokenizes each segment's text with `.split()` → `(word, segment_index)` pairs.
    4. Gets audio duration from WAV header.
    5. Calls aligner (injected fake in tests; WhisperX via `make_whisperx_aligner()` in prod).
    6. Validates count match (timings == words).
    7. For each word: validates `end > start`, `start >= 0`, `end <= audio_duration`,
       and monotonicity (`start[i] >= end[i-1] - epsilon`).
    8. Writes `job_dir/words.json` flat list with `{word, script, start, end, segment_index}`,
       `ensure_ascii=False`, at job root (D-021).
    9. Logs `("align", elapsed, words=N, aligner=name)`.
  - Injection seam: `run_align(ctx, *, _aligner=None)` → tests use
    `functools.partial(run_align, _aligner=my_fake)` in Stage. Same pattern as T-105.
- `backend/app/models/words.py` — `WordTiming(BaseModel)` with
  `{word, script: Literal["arabic","latin"], start, end, segment_index}`.
- `backend/app/models/__init__.py` — exports `WordTiming`.
- `backend/tests/fixtures/aligner/corrected_transcript.json` — two-segment fixture:
  - Seg 0 (index=0): "Salam بزاف ديال promo" → 4 words.
  - Seg 1 (index=1): "مزيان le design" → 3 words.
  - Total: 7 words. Audio: synthetic silent 5.0 s WAV via wave+struct (no ffmpeg needed).
- `backend/tests/test_align.py` — 24 tests (all green):
  - Unit: `_derive_script` for latin ASCII, Arabic-block words, mixed-script word, punctuation.
  - Happy path: words.json at job root, not under assets/, is a flat list, count=7, shape.
  - Reading order + monotonic starts.
  - Segment index attribution (first 4 → 0, last 3 → 1).
  - Bidi canonical: Salam→latin, بزاف→arabic (U+0628..U+0641 codepoint-verified), ديال→arabic,
    promo→latin. Surface forms preserved. ensure_ascii=False (no \\uXXXX escapes).
  - Seg 1 مزيان → arabic by codepoint (U+0645).
  - Missing audio.wav: error state + "audio.wav"/"not found" in message.
  - Missing transcript_corrected.json: error state + "transcript_corrected.json"/"not found".
  - Missing audio → words.json not written.
  - Count mismatch: error + "mismatch"/"count" in message; no words.json.
  - Overlap violation: error + "overlap"/"monoton" in message.
  - end < start violation: error.
  - Out of bounds: error + "duration"/"exceeds".
  - Through-runner success: ready_for_ae, progress=100.
  - Through-runner missing audio: error state.

**Test results:** 169/169 passed (24 new + 145 prior). `ruff check .` clean (2 fixes: B905
`strict=True` on zip; F401 unused `torch` import removed from WhisperX adapter).

**Chosen aligner backend: WhisperX (D-030)**
WhisperX was chosen over MFA and aeneas because it:
(a) accepts seeded text via `whisperx.align()` — aligns GIVEN words, does NOT re-transcribe;
(b) is pip-installable on macOS (no conda/kaldi);
(c) supports Arabic/Darija via HuggingFace wav2vec2 models;
(d) handles mixed-script content at the segment level.
Mixed-script limitation: Arabic model used for the whole audio segment; French/English word
timings have adequate accuracy (±100 ms) for caption display. See D-030.

**T-003 install-line flag (DO NOT EDIT T-003 HERE — just record for the Planner):**
`mac_setup.sh` must include:
  pip install whisperx torch torchvision torchaudio
  # Model auto-downloaded on first use via HuggingFace cache:
  # jonatasgrosman/wav2vec2-large-xlsr-53-arabic
This is a NEW requirement not in the current T-003 spec. Planner must add it before T-003 runs.

**What T-108 (understanding stage) needs to know:**
- Inputs: `job_dir/transcript_corrected.json` (operator-corrected text) + `job_dir/words.json`
  (per-word timings with script tags) + `ctx.job.brief` (operator brief).
- `words.json` is a flat list of `{word, script, start, end, segment_index}`.
- `WordTiming` model in `app/models/words.py` can be used to read/validate the file.
- The `Transcript` model in `app/models/transcript.py` has the corrected-transcript structure.
- T-108 calls `GeminiClient.understand(transcript=..., words=..., brief=..., prompt=...)` and
  writes `job_dir/understanding.json` (the segment/visual plan for T-110).

**Real-aligner timing spot-check DEFERRED to T-113 live smoke** (see COMPLETION REPORT).

**Next task:** T-108 (understanding & segmentation stage).

---

## 2026-07-21 — T-108 · Understanding & segmentation stage

**Pre-flight:** T-107 commit `147f55e` confirmed on `origin/main`; tree clean.

**What was done:**
- Created `backend/app/prompts/understand.md` — the operator-editable understanding prompt encoding the §11.3 emphasis rule (nouns, numbers, brand/product names, punchy verbs) and the `"speaker only"` visual_intent convention.
- Created `backend/app/models/understanding.py` — `Understanding` and `UnderstandingSegment` Pydantic models for `understanding.json` (shape per spec Stage 6).
- Created `backend/app/pipeline/understand.py` — the stage: reads `transcript_corrected.json` + `words.json`, calls `GeminiClient.understand()` via the injection seam, parses the raw text as JSON, validates with the Pydantic model, validates emphasis indices in range [0, len(words)-1] and visual_intent non-empty, writes `understanding.json` at the job root (`ensure_ascii=False`, D-021).
- Added `Understanding` and `UnderstandingSegment` exports to `backend/app/models/__init__.py`.
- Created `backend/tests/fixtures/gemini/understand_t108_response.json` — canonical Gemini fixture with Arabic summary, two segments (one "show product packaging", one "speaker only"), emphasis indices referencing the 7-word fixture list.
- Created `backend/tests/fixtures/understand/` — `corrected_transcript.json` (2-segment, 7-word Darija/French fixture) and `words.json` (7-word flat list matching the aligner fixture).
- Created `backend/tests/test_understand.py` — 20 tests; all PASSED.

**Decisions:** D-033 (understanding.json shape), D-034 (emphasis-index validation), D-035 (visual_intent sentinel).

**What was learned:**
- `JobStatus.progress_pct` (not `.progress`) is the correct field name.
- Fixture `text` field contains the raw model output as a JSON-encoded string (the Gemini transport internal format); the stage owns parsing that raw string into structured data.
- `pytest.MonkeyPatch().context()` + `mp.setattr("app.clients.gemini.get_settings", lambda: ...)` is the correct pattern for this codebase; `app.config._settings` does not exist as a module-level var.

**Test results:** 189/189 passed. ruff clean.

**What T-109 (music library + selection + beat detection) needs to know:**
- `understanding.json` at the job root provides a `summary` (paragraph) and a `segments` list.
- Each segment has `visual_intent` (a visual concept or `"speaker only"`) and `emphasis_word_indices` (global indices into `words.json`).
- T-109 should use the `summary` and `segments` for music mood selection (match energy level, pacing).
- The full `understanding.json` is available via `ctx.paths.job_dir / "understanding.json"`.
- `Understanding` model in `app/models/understanding.py` can be used to read/validate it.

**What T-110 (visual planning stage) needs to know:**
- Same `understanding.json` is the primary input.
- `visual_intent` per segment tells the visual planner WHAT to show; T-110 decides HOW (which image slot, what B-roll concept to generate in T-111).
- `emphasis_word_indices` indicate which words should get visual emphasis in the caption layer.

**Next task:** T-109 (music library + selection + beat detection).

---

## 2026-07-21 — T-109 · Music library + selection + beat detection

**Pre-flight:** T-108 commit `8d7dc9b` confirmed present on `origin/main`; tree clean; no foreign
commits.

**Ordering note (spec Stage 7):** Music selection + beat detection MUST run before final visual
placement (T-110), so visuals can snap to the beat grid. This stage's `run_music` is designed to
be placed in the pipeline's stage list before any future visual-planning stage. Do not reorder.

**What was built:**
- `backend/app/clients/beats.py` — `BeatDetectionError` + `detect_beats(audio_path) -> list[float]`.
  Heavy `librosa` import is guarded inside the function body (module import never requires
  librosa). Returns a strictly ascending, non-empty list of beat timestamps by sorting and
  de-duplicating librosa's `beat_track()` output.
- `backend/app/models/music_library.py` — `MusicLibraryEntry` Pydantic model for
  `music/library.json` entries: `{file, type: "music"|"sfx", mood, energy (1-5), bpm, has_vocals,
  duration}`.
- `backend/app/pipeline/music.py` — the stage:
  - `MusicSelectionError(RuntimeError)` — stage-level error.
  - `_load_library()` reads + validates `music/library.json` (fails loud if missing/invalid).
  - `_target_energy()` / `_score()` / `_select_track()` — deterministic selection: hard-reject
    tracks shorter than the reel, then sort by `(mood_matches, -energy_delta, instrumental_bonus)`
    descending (see D-036 for the full scoring rationale).
  - `run_music(ctx, *, _beat_detector=None, _library_path=None)` — stage entry point: loads the
    library, selects a track, copies it into `ctx.paths.audio_dir`, runs beat detection (real
    librosa in prod, injectable fake in tests), writes `beats.json` and `music.json` at the job
    root, logs via `ctx.logger.log_stage("music", ..., beats=N, track=..., duration_fallback_used=...)`.
  - `DEFAULT_MUSIC_GAIN_DB = -14.0` — Brand Kit default (§13.2), `TODO(T-201)`-marked hook.
  - `_FALLBACK_REEL_DURATION_S = 30.0` — used and logged when `ctx.job.duration` is unset.
- `music/library.json` — populated the pre-existing (T-001-seeded) empty `{tracks, sfx}` scaffold
  with 3 fixture MUSIC entries (one instrumental cozy, one instrumental upbeat, one vocal
  energetic) so the schema is concrete. Real audio files are NOT committed (git-ignored, confirmed
  `.gitignore` already covers `/music/*.wav` etc. from T-001).
- `backend/tests/test_music.py` — 13 tests, all green: selection logic (instrumental preference,
  duration rejection, mood/energy scoring, SFX-entries ignored), real-librosa beat detection on an
  in-test-synthesized click-track (numpy, no committed media) asserting strictly ascending +
  non-empty, missing/empty/all-too-short library → error state through the runner, full
  runner-integration test (fake detector) asserting `beats.json` + `music.json` + copied audio
  artifact all land correctly and the job reaches `ready_for_ae`, duration-fallback logging, and
  beat-detector-error wrapping.

**Decisions:** D-036 (beats.json/music.json placement at job root + `AudioPlan` reuse for the
chosen-track record; library schema kept as `{tracks, sfx}`; scoring function; duration fallback;
Brand Kit gain hook).

**What was learned:**
- `music/library.json` already existed as an empty scaffold from T-001 (`{tracks: [], sfx: []}`
  with a comment documenting mood/energy conventions) — no contradiction, just populated it rather
  than creating a new file.
- Reusing `AudioPlan`/`MusicCue`/`SfxCue` from `app/models/edit_plan.py` for the chosen-track
  record avoided a second, parallel model family — T-112 (Edit Plan assembly) can consume
  `music.json` directly as `EditPlan.audio`.
- `JobManager._jobs[job_id].duration = X` (direct mutation, mirroring the ingest-stage pattern in
  `app/pipeline/ingest.py:266`) is the established way to set a job's duration in tests before
  `create()` doesn't accept it as a parameter.
- The T-101 runner's own generic `ctx.logger.log_stage(stage.name, duration, stages_done=...)`
  call (in `manager.py`) writes a SECOND `"music"`-stage log line after the stage's own structured
  log line — tests that inspect `log.txt` for stage-specific keys must filter for those keys, not
  just take the last `"music"` entry.

**Test results:** 202/202 passed (189 prior + 13 new). `ruff check .` clean.

**What T-110 (visual planning stage) needs to know:**
- `job_dir/beats.json` is a flat JSON array of ascending float beat timestamps — the grid visuals
  and transitions snap to.
- `job_dir/music.json` has the `AudioPlan` shape (`{music: {asset, gain_db, start}, sfx: []}`) —
  T-110 does not need to read it (T-112 assembly will), but its presence confirms T-109 completed.
- Both files are guaranteed to exist together — the stage never writes one without the other.

**Next task:** T-110 (visual planning stage).

---

## 2026-07-21 — T-110 · Visual planning stage

**Pre-flight:** T-109 commit `751f147` confirmed present on `origin/main`; tree clean; no foreign
commits.

**Ordering note (kept true):** `plan_visuals` runs AFTER `music` in the eventual pipeline stage
list — it reads `beats.json` produced there and snaps every visual start onto it. This stage is
fully deterministic and makes no Gemini/API calls (depends only on T-108 + T-109 artifacts).

**What was built:**
- `backend/app/pipeline/plan_visuals.py` — the stage:
  - `PlanVisualsError(RuntimeError)` — stage-level error.
  - `_tokenize()` / `_find_client_asset()` — client-asset relevance via filename/intent
    keyword-token overlap (D-038).
  - `_looks_like_text_card()` — digit/keyword heuristic routing a segment to `animated_text`
    instead of `generated_image` (D-039).
  - `_classify()` — implements spec §12.1's decision order per segment: client_asset →
    (speaker-only → none) → text-card → animated_text → else generated_image.
  - `_snap_start_on_or_after()` — smallest beat ≥ a candidate time, or `None` if the grid is
    exhausted (visual gets dropped, not forced out of range).
  - `run_plan_visuals(ctx, *, _seed=None)` — stage entry point: reads `understanding.json` +
    `beats.json`, enumerates `ctx.paths.client_dir` (sorted), derives a reproducible seed from
    `ctx.job_id` (sha256-based, override via `_seed` for tests), classifies + places each segment's
    visual sequentially (non-overlapping, `MIN_VISUAL_DURATION_S=1.5` floor, D-040), emits
    `punch_soft` motion for no-visual segments and `transition_whip_pan` between consecutive
    visuals (D-041), writes `job_dir/visual_plan.json` (D-037), logs via
    `ctx.logger.log_stage("plan_visuals", ..., visuals=N, motion=M, reel_duration_fallback_used=...)`.
  - Reused `Visual`/`Motion` from `app/models/edit_plan.py` directly — no parallel model (D-037),
    mirroring T-109's `AudioPlan` reuse.
  - Reel-duration fallback imports T-109's `_FALLBACK_REEL_DURATION_S` constant from
    `app.pipeline.music` rather than re-deciding the value, per the task's explicit instruction.
- `backend/tests/test_plan_visuals.py` — 22 tests, all green: all four §12.1 branches
  (client_asset priority, speaker-only → no visual, text-card → animated_text, plain concept →
  generated_image, no-client-asset fallback), only-V1-template-names, start-on-beat, window-in-
  range, non-overlap, min-duration, motion presence + punch fields + transition-only-between-
  visuals, determinism (two separate jobs + explicit shared seed → byte-identical JSON; same
  job_id re-run with default seed → byte-identical), a full `EditPlan` construction/validation
  test proving T-112 will accept this output, missing/empty-input error states, duration-fallback
  logging, and runner integration.

**Decisions:** D-037 (visual_plan.json placement + model reuse + seed recording), D-038
(client-asset relevance heuristic), D-039 (generated_image vs animated_text heuristic), D-040
(density bounds), D-041 (motion placement rule).

**What was learned:**
- No `BUILD_STATE.md` file exists in the repo — it is referenced only in code/PROGRESS comments
  from prior sessions (align.py, understand.py, asr.py, main.py) as an external/institutional
  reference, never as a committed doc. Not treated as a new contradiction: the task itself
  supplied the concrete V1 template-name list needed here (`image_reveal_slideup`,
  `image_reveal_scalein`, `animtext_bold`, `punch_soft`, `transition_whip_pan`), so nothing was
  guessed. Flagging for the Planner in case `BUILD_STATE.md` was meant to exist and is missing
  from the repo.
- The committed golden (`docs/edit_plan.example.json`) already uses `transition_whip_pan` (not the
  spec-prose's bare `whip_pan`), confirming D-007 was already applied there — no drift to fix.
- `EditPlan`'s own validator does NOT check visual non-overlap (only window-in-range + end>start +
  beat-alignment-on-start) — T-110's non-overlap guarantee is a stage-level invariant, tested here,
  not something T-112 assembly re-derives.

**Test results:** 224/224 passed (202 prior + 22 new). `ruff check .` clean.

**What T-111 (image generation & sourcing) needs to know:**
- `visual_plan.json` at the job root lists every `generated_image` visual with `asset =
  "assets/images/<id>.png"` (e.g. `"assets/images/v3.png"`) — T-111 must generate and save exactly
  that file for each such visual; the file does not exist yet when T-110 finishes (by design —
  `Visual` doesn't check file existence, only `validate_edit_plan(check_assets=True)` at T-112
  does).
- `visual.template` on `generated_image`/`client_asset` visuals is already the reveal template
  (`image_reveal_slideup` or `image_reveal_scalein`) — T-111 does not choose or touch templates.
- `client_asset` visuals reference `assets/client/<original filename>` — those files already exist
  (copied by ingest, T-102); T-111 has nothing to do for those.

**What T-112 (Edit Plan assembly) needs to know:**
- `visual_plan.json`'s `visuals`/`motion` arrays deserialize directly into `Visual`/`Motion` model
  instances (`Visual.model_validate(v)` / `Motion.model_validate(m)`) — no translation needed.
- `visual_plan.json` also carries `seed`, `reel_duration`, and `reel_duration_fallback_used` for
  audit/reproducibility; assembly should prefer `ctx.job.duration` when set and only fall back to
  the recorded `reel_duration` (or re-derive via the same fallback) if it's still unset at
  assembly time.
- Every visual's `start` is guaranteed to be an exact value from `beats.json` (not just within one
  frame), so beat-alignment validation at `EditPlan` construction is satisfied for free as long as
  the SAME `beats.json` (T-109's) is passed through to `EditPlan.beats`.

**Next task:** T-111 (image generation & sourcing stage).

---

## 2026-07-21 — T-111 · Image generation & sourcing stage

**Pre-flight:** T-110 commit `eec433b` confirmed present on `origin/main`; tree clean; no foreign
commits.

**Contradiction found and resolved (not a stop-worthy spec conflict — see D-045):** T-110's
`Visual` model carries `visual_intent` only for `animated_text` (`text` field); `generated_image`
visuals have no such field and nothing in `visual_plan.json` links a visual back to its originating
`understanding.json` segment. Building a spec-compliant prompt (§12.2) needs that visual_intent.
Since modifying `plan_visuals.py`/`Visual` was explicitly out of this session's file-touch list,
T-111 re-reads `understanding.json` and recovers the intent via time-window overlap
(`_match_segment_intent()`) instead. Logged as D-045 and flagged as **T-505** (low priority: add
`Visual.segment_index` traceability) for a future session — the heuristic works reliably given how
T-110 constructs windows, so this is not blocking.

**What was built:**
- `backend/app/pipeline/images.py` — the stage:
  - `ImagesError(RuntimeError)` — stage-level error.
  - `_build_prompt(visual_intent, brief)` — style + subject + optional brief override + negative +
    hard constraints (9:16, no on-image text, no watermark, safe-area), per §12.2.
  - `_match_segment_intent()` — D-045's overlap-based visual→segment recovery.
  - `_select_model()` — D-044: always Flash (`settings.gemini_image_model`), no hero/Pro escalation
    in v1.
  - `_probe_dimensions()` / `_is_already_9x16()` / `_reframe_to_9x16()` — self-contained ffprobe/
    ffmpeg subprocess calls (D-043), NOT added to `app/clients/ffmpeg.py` (out of this task's
    touch-list; mirrors D-020's stage-isolation precedent).
  - `run_images(ctx, *, _gemini_client=None)` — stage entry point: reads `visual_plan.json` +
    `understanding.json`, for each visual: `generated_image` → build prompt → cache-hash lookup →
    (cache hit / ceiling check / real `client.generate_image()` call) → write bytes to the EXACT
    `visual.asset` path T-110 named; `client_asset` → probe dims → reframe-or-skip (no Gemini call);
    `animated_text` → no-op. Writes `job_dir/images.json` (D-042), logs via
    `ctx.logger.log_stage("images", ..., generated=N, cached=C, client_reframed=R,
    skipped_ceiling=S)`.
  - No changes to `app/clients/gemini.py` — its existing `generate_image(prompt, model=, meter=)`
    signature already covered every need.
- `backend/tests/test_images.py` — 15 tests, all green: prompt-construction substring assertions,
  exact-asset-path generation, animated_text no-op, cache-hit-one-call (two visuals sharing a
  prompt), ceiling-stop-and-flag + CostMeter increment, cheap_mode/Flash-always (parametrized),
  client-asset reframe vs already-9:16-skip vs no-Gemini-call (ffmpeg-gated,
  `skip_no_fftools`-guarded like `test_audio.py`), missing-input error states, and runner
  integration.

**Decisions:** D-042 (images.json placement + style/negative hooks), D-043 (client-asset reframe
rule), D-044 (no hero escalation in v1), D-045 (visual_intent recovery via overlap), D-046 (cache
key + scope).

**What was learned:**
- `ctx.settings` (already part of `JobContext`) is the right place to read `max_images_per_job` /
  `cheap_mode` / `gemini_image_model` — no need for the stage to call `get_settings()` itself; only
  `app.clients.gemini`'s OWN internal calls (`_get_api_key()`, `generate_image()`'s model default)
  need the `app.clients.gemini.get_settings` monkeypatch in tests, confirming the BUILD_STATE
  learned pattern from T-108/T-109 still holds and generalizes cleanly.
- `GeminiClient.generate_image()` already accepted `model=` and `meter=` from T-104 — no client
  changes were needed at all for this stage.

**Test results:** 239/239 passed (224 prior + 15 new). `ruff check .` clean.

**What T-112 (Edit Plan assembly) needs to know:**
- Every `generated_image` visual named in `visual_plan.json` now has a real file on disk at its
  exact `asset` path (`job_dir/assets/images/<id>.png`) UNLESS `images.json` flags it
  `"status": "skipped_ceiling"` — assembly/validation should treat ceiling-skipped visuals as
  needing operator attention (e.g. drop them from the plan, or block `check_assets=True` with a
  clear message) rather than assuming every named asset exists.
- `client_asset` visuals may now have a `_9x16` sibling file; `images.json`'s per-visual `asset`
  field tells you which path is the RIGHT one to put in the final `EditPlan` (the reframed path
  when `status=="reframed"`, the original when `"unchanged"`) — `visual_plan.json`'s own `asset`
  field was intentionally left untouched (T-110 stays authoritative for windows/templates/kind;
  T-111 only reports what it did).
  `animated_text` visuals are unaffected (no file, `visual_plan.json`'s `asset=null` stays correct).
- `job_dir/images.json` is the manifest to read for all of the above; it also carries
  `cost_estimate_usd` for this stage's spend, which assembly's `meta.cost_estimate_usd` should
  aggregate alongside other stages' costs (T-109's music selection has no cost; ASR/understanding
  costs aren't tracked yet either — a future session should reconcile job-wide cost aggregation).

**Next task:** T-112 (Edit Plan assembly + validation).

---

## 2026-07-21 — T-112 · Edit Plan assembly + validation

**Pre-flight:** T-111 commit `d120e76` confirmed present on `origin/main`; tree clean; no foreign
commits.

**This is the M1 convergence point.** `assemble_plan.py` reads every upstream job-root artifact
(`words.json`, `understanding.json`, `visual_plan.json`, `images.json`, `music.json`,
`beats.json`) plus `ctx.job`, and produces `job_dir/edit_plan.json` — the artifact T-113's
endpoints will serve and the AE side (M3) consumes. No API calls; fully deterministic given fixed
inputs + an injected clock.

**What was built:**
- `backend/app/pipeline/assemble_plan.py` — the stage:
  - `AssembleError(RuntimeError)` — stage-level error; nothing partial is ever written on failure
    (the file is only written after BOTH `EditPlan` construction AND `validate_edit_plan()` pass).
  - `V1_TEMPLATE_NAMES` — the six-name V1 template stub (D-051), `TODO(T-202)`-marked.
  - `_build_captions()` — groups `words.json` (flat, global order) by `segment_index` into
    `CaptionLine`s (`template="caption_karaoke_default"`), setting `emphasis=True` from
    `understanding.json`'s per-segment `emphasis_word_indices` (GLOBAL indices, D-034). Relies on
    `CaptionLine`'s own Pydantic validator to fail loud on overlap — no silent reordering.
  - `_reconcile_visuals_and_motion()` — D-047: drops `skipped_ceiling` generated_image visuals,
    swaps in `images.json`'s authoritative `asset` for `client_asset` visuals (the `_9x16` path
    when reframed), leaves `animated_text` untouched, and drops only the `transition` motion item
    whose `at` matches a dropped visual's `start`.
  - `run_assemble_plan(ctx, *, _now=None)` — reads all six artifacts (fail-loud per-file with a
    named upstream stage in the error message), builds `reel`/`source`/`meta` (duration fallback
    imported from T-109 per instruction, D-049 extends the same convention to width/height/fps),
    constructs `EditPlan(...)`, runs `validate_edit_plan(known_templates=V1_TEMPLATE_NAMES,
    check_assets=True, job_dir=...)`, writes `edit_plan.json` only on success, logs via
    `ctx.logger.log_stage("assemble_plan", ..., captions=N, visuals=V, dropped=D, dropped_ids=[...],
    motion=M, beats=B, duration_fallback_used=..., reel_dims_fallback_used=...)`.
  - No changes to `app/models/edit_plan.py` or `app/models/validate.py` — every EditPlan/CaptionLine/
    Visual/Motion/AudioPlan/Meta/Reel/Source model and the `validate_edit_plan()` external checks
    are reused exactly as built at T-004/T-008's related work.
- `backend/tests/test_assemble_plan.py` — 13 tests, all green: happy-path assembly +
  re-validation, caption grouping/emphasis/bidi-codepoint preservation, overlap fail-loud,
  ceiling-skip drop + transition removal (dedicated 3-visual fixture), reframed client-asset path
  used, only-V1-templates-used, unknown-template rejection, missing-asset-for-non-skipped-visual
  fail-loud, out-of-range-window fail-loud, missing-input-file fail-loud, meta/cost-aggregation,
  determinism (two separate jobs + fixed clock → byte-identical after normalizing `job_id`), and
  runner integration.

**Decisions:** D-047 (ceiling-skip drop + transition-removal rule), D-048 (determinism via
injectable clock), D-049 (reel-dims fallback), D-050 (cost aggregation gap — ASR/understanding
untracked), D-051 (V1_TEMPLATE_NAMES stub + TODO(T-202) hook).

**What was learned:**
- `validate_edit_plan(check_assets=True)` also checks `plan.source.video`/`plan.source.audio`
  existence under `job_dir` (not just visual/audio assets) — test fixtures needed `input.mp4` and
  `audio.wav` stub files too, not just the images/client-asset/track files.
- D-008's opt-in template check (`known_templates=None` skips it) is exercised here for the first
  time with a real, non-None set — confirms the opt-in design worked as intended: earlier stages
  could validate the golden standalone before this stage existed.

**Test results:** 252/252 passed (239 prior + 13 new). `ruff check .` clean.

**What T-113 (backend orchestration + endpoints) needs to know:**
- `job_dir/edit_plan.json` is the final artifact — `GET /jobs/{id}/edit_plan` (spec §14.1) should
  serve this file directly once T-113 wires the full pipeline stage list (ingest → audio → asr →
  correction gate → align → understand → music → plan_visuals → images → assemble_plan) behind
  `POST /jobs`. Successful completion of `assemble_plan` is what should put a job at
  `ready_for_ae` in a real end-to-end run (T-101's runner already does this automatically once
  `assemble_plan` is the last stage in the list).
- `meta.cost_estimate_usd` currently ONLY reflects image-generation spend — see D-050 / **T-506**
  (new task: wire ASR/understanding into cost tracking) before treating this number as a complete
  per-job cost.
- `V1_TEMPLATE_NAMES` in `assemble_plan.py` is a `TODO(T-202)` stub — when the template registry
  loader lands, replace the hardcoded set with the registry's actual template set (D-051).
- **T-505** (from T-111) is still open: `Visual` has no segment traceability, so both T-111 and any
  future stage needing segment context must re-derive it (T-111 does, via time-window overlap,
  D-045). T-112 itself did NOT need this — it consumes `images.json`'s manifest and
  `understanding.json`'s emphasis indices directly, no overlap-matching required here.

**Next task:** T-113 (backend orchestration + endpoints + live smoke) — the last M1 task, and the
first one that will exercise ASR/understanding/image generation against the REAL Gemini API (not
just fixtures).

---

## 2026-07-21 — T-113 · Backend orchestration + endpoints + live smoke (CODE HALF)

**Pre-flight:** T-112 commit `3cc1d4c` confirmed present on `origin/main`; tree clean; no foreign
commits. This is the LAST M1 task.

**This is the M1 convergence point.** The ten pipeline stages built across T-102–T-112 are now
wired into one ordered list behind a real `POST /jobs`, with the full spec §14.1 endpoint set
completed and a mocked end-to-end test proving a job can go from creation to `ready_for_ae` with a
validated `edit_plan.json` on disk.

**What was built:**
- `backend/app/jobs/manager.py` — added `build_pipeline_stages(*, _gemini_client=None,
  _aligner=None, _beat_detector=None, _library_path=None) -> list[Stage]`: assembles the fixed
  ordered stage list `ingest → audio → asr → correction_gate (is_gate=True) → align → understand →
  music → plan_visuals → images → assemble_plan`. All pipeline-module imports are LOCAL to the
  function (avoids a circular import, since every pipeline module imports `JobContext`/`Stage`
  from this same file). The four injection-seam kwargs pass straight through to the relevant
  stages via `functools.partial`, letting tests replace every external dependency (Gemini,
  WhisperX, librosa, the committed music library) with fast deterministic fakes while running the
  REAL stage code end to end.
  - Also added `JobManager.cancel(job_id) -> JobStatus`: idempotent-safe — cancelling an
    already-terminal job (`ready_for_ae`/`error`) is a clean no-op; cancelling a
    running/awaiting-correction job discards its `_pending` continuation (if any) and sets
    `state=ERROR, message="Job cancelled by operator."`. `_run_stages()` now checks for this
    terminal state at the top of every loop iteration so a cancel between stages actually stops
    further progress (a cancel mid-await inside an already-running stage is NOT interrupted — no
    asyncio task-handle tracking exists in v1; documented as a known limitation in the method's
    docstring, consistent with D-013's in-memory-only scope).
- `backend/app/main.py` — completed the spec §14.1 endpoint set:
  - `GET /brand_kits` — stub, returns `[]`, code comment notes the T-201 dependency.
  - `POST /jobs` — `{video_path, brand_kit, brief, client_asset_paths[]} → {job_id}` via a new
    `CreateJobRequest` Pydantic model (local to main.py — not a cross-boundary contract type like
    `Transcript`). Calls `mgr.create(...)` then schedules `mgr.run_pipeline(job_id, stages)` via
    `BackgroundTasks` — same D-028 pattern as the T-106 correction-gate resume, so the endpoint
    returns immediately in production while remaining fully synchronous/deterministic under
    `TestClient` in tests.
  - `GET /jobs/{id}/status` — `{stage, progress_pct, state, message}`, 404 unknown.
  - `GET /jobs/{id}/edit_plan` — serves `edit_plan.json`; 404 (with a clear message) if the job is
    unknown, not yet `ready_for_ae`, or the file isn't on disk.
  - `GET /jobs/{id}/build_report` + `POST /jobs/{id}/build_report` — minimal passthrough
    (read/write `build_report.json` at job root); the POST side is for the future AE panel (M3+).
  - `POST /jobs/{id}/cancel` — 404 unknown; otherwise calls `mgr.cancel()` and returns the
    resulting state/message (200 in both the "actually cancelled" and "already terminal" cases —
    idempotent per the acceptance criteria).
  - The existing T-106 `GET`/`POST /jobs/{id}/transcript` endpoints were left untouched (still
    422/409/404 correctly) — confirmed by the full suite staying green, not just by inspection.
- `backend/tests/test_orchestration.py` — 6 new tests, all green:
  - **The big one:** `test_full_pipeline_pauses_at_gate_then_resumes_to_ready_for_ae` — a real
    `TestClient(app)` end-to-end run. Synthesizes a real 5.0s 1080×1920 av clip with `ffmpeg`
    (skipped, not failed, when ffmpeg/ffprobe are unavailable — same `skip_no_fftools` pattern as
    T-102/T-103/T-111's tests), monkeypatches `app.main.build_pipeline_stages` to inject a single
    Gemini transport fixture (serving ASR then understand as ordered "text" calls, plus any number
    of "image" calls), a deterministic fake WhisperX aligner, a dense fake beat grid, and a
    tmp_path music library + real silent-WAV track. `POST /jobs` → job pauses at
    `awaiting_correction` → `GET`/`POST /jobs/{id}/transcript` (operator confirms as-is,
    round-trip pattern from T-106's own tests) → resumes → `ready_for_ae`, `progress_pct==100`.
    Asserts the served `edit_plan.json` round-trips through `EditPlan.model_validate` AND
    `validate_edit_plan(known_templates=V1_TEMPLATE_NAMES, check_assets=True, job_dir=...)` — the
    exact acceptance-criteria gate — plus a caption-count and a generated-image-visual sanity
    check.
  - `test_edit_plan_404_before_ready_and_status_404_for_unknown_job` — 404 shape coverage for all
    five job-scoped GET/POST endpoints against an unknown job, plus edit_plan 404 on a freshly
    created (still-running) job.
  - `test_brand_kits_stub_returns_empty_list`, `test_post_jobs_returns_promptly_with_job_id`
    (asserts `POST /jobs` returns `{job_id}` immediately even though the injected `video_path`
    doesn't exist — ingest fails cleanly into `error` state in the background, the endpoint itself
    never blocks on or reflects that failure), `test_cancel_running_job_then_idempotent_on_terminal`,
    `test_build_report_post_then_get`.
  - The fixture content (2-segment, 7-word Darija/French transcript; `"show product packaging"`
    vs. `"speaker only"` visual intents) is the SAME canonical content T-107/T-108's own fixture
    files already use, kept inline in this file rather than re-read from disk so the whole chain
    (ASR → align → understand → plan_visuals → images) is traceable in one place.
- **ffprobe consolidation (D-052, closes D-020's deferral):** `ingest.py`'s private
  `_run_ffprobe()` and `images.py`'s private `_probe_dimensions()` were both removed in favor of
  `app.clients.ffmpeg.probe()`, each stage now catching `FfmpegError` and re-raising its own
  stage-level error type with the message preserved. `test_ingest.py`'s three
  `subprocess.run` mock targets were updated from `app.pipeline.ingest.subprocess.run` to
  `app.clients.ffmpeg.subprocess.run`; `test_images.py` needed no changes.
- **CostMeter decision (D-053):** Deferred wiring a job-wide CostMeter through ASR/understanding
  to **T-506** — see DECISIONS.md for the full reasoning (scope containment).
- `backend/scripts/live_smoke.py` — new, HUMAN-RUN ONLY. Not imported by any test, not under
  `tests/` (pytest's `testpaths = ["tests"]` already excludes it structurally), makes real Gemini/
  WhisperX/librosa calls only when a human runs it directly, with a `y/N`-style confirmation gate
  before spending any money. Uses `build_pipeline_stages()` with all injection kwargs left `None`
  (real everything) via `JobManager` directly (in-process, not an actual HTTP round-trip — the
  script mirrors what `POST /jobs` does rather than literally calling it, since a full server
  process isn't needed to exercise the identical pipeline code path). Prints the raw transcript
  at the correction gate, accepts either Enter (accept as-is) or a path to a corrected JSON file,
  resumes, and prints every artifact's on-disk path plus the final `edit_plan.json` path and its
  (partial — D-050) cost estimate.
- `README.md` — added a "Live smoke test (HUMAN ONLY — costs real money)" section documenting
  usage and the cost caveat; updated the "Build status" line to reflect M1 code-completion.

**Test results:** 258/258 passed (252 prior + 6 new). `ruff check .` clean (no fixes needed).

**What was learned:**
- The existing per-stage injection-seam convention (T-105/T-107/T-108/T-109/T-110/T-111's
  `_gemini_client` / `_aligner` / `_beat_detector` / `_library_path` kwargs) composed cleanly into
  one `build_pipeline_stages()` factory with zero changes needed to any individual stage module —
  the seams were already designed for exactly this composition, even though no prior session
  wired them together.
- T-107's and T-108's existing test fixtures (`tests/fixtures/aligner/corrected_transcript.json`
  and `tests/fixtures/understand/corrected_transcript.json` + `words.json`) already share the
  IDENTICAL 2-segment, 7-word Darija/French transcript content — confirming the fixtures were
  already designed to chain, even though nothing before this session actually chained them through
  a real multi-stage run.
- `JobManager.create()` requires `_library_path` to point at a directory containing BOTH
  `library.json` and the real (even if silent/synthetic) audio file it references — the committed
  `music/library.json`'s three fixture tracks reference files that are intentionally git-ignored
  and absent on a fresh checkout (per T-109/D-036), so any end-to-end run (including the live-smoke
  script in production mode) requires the operator to have added real licensed audio files under
  `music/` locally before `POST /jobs` can reach `ready_for_ae`. This was already true from T-109;
  T-113 didn't change it, but it's the first session to actually hit it end-to-end.

**Contradictions found:** none. No stop-and-report was needed this session.

**Human live-smoke — STILL PENDING (Mohamed, separately, after this push):**
Run `backend/scripts/live_smoke.py` (see the new README section) against a real ~5s Darija clip
with a real `GEMINI_API_KEY`. Confirm a plausible transcript + edit_plan + images, spot-check a
couple of WhisperX word timings (spec §7 Stage 5) by ear, confirm or adjust the D-022
`gemini-2.5-flash` text-model id based on real output quality, and note the actual observed cost
plus any other observations as a new PROGRESS.md entry. Expect Darija ASR imperfections — that is
exactly what the correction gate exists to catch. Also add real licensed audio files under
`music/` locally first (see "What was learned" above) — the committed `music/library.json` fixture
entries reference files that are git-ignored and not present on a fresh checkout.

**Younes GitHub collaborator TODO (from T-001):** still open. `gh api
repos/medanouarzaki/framopia-studio/collaborators` shows only `medanouarzaki` as of this session —
his GitHub username is still needed.

**M1 is now CODE-COMPLETE** (T-101 through T-113). M2 (Brand Kit + templates + registry) is next,
starting with T-201.

---
