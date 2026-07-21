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
