#!/usr/bin/env python3
"""Framopia Studio — HUMAN-RUN live smoke test (T-113).

Runs the FULL M1 pipeline against the REAL Gemini API (ASR + understanding +
image generation) and the real WhisperX aligner / librosa beat detector, on a
real short talking-head clip. This makes ACTUAL, BILLED Gemini API calls.

    ⚠ This script COSTS REAL MONEY and requires a real GEMINI_API_KEY in
      backend/.env. It is NEVER run by pytest / CI. It is not imported by
      any test module. Do not add real network calls to the test suite —
      this script is the one place they belong.

## Usage

    cd backend
    .venv/bin/python scripts/live_smoke.py /path/to/clip.mp4 \\
        --brand-kit kitA \\
        --brief "cold-brew coffee promo, upbeat"

The clip should be a real ~5s (up to ~30-90s) 9:16 talking-head take, per the
input contract (D-A1). The script:

    1. Creates a job and runs Stages 1-3 (ingest, audio, ASR) for real.
    2. Pauses at the correction gate (spec Stage 4) and prints the raw
       transcript. You review it — Darija ASR will have imperfections; that
       is exactly what this gate exists to catch (spec §11.2 / BUILD_STATE).
    3. Prompts you to either accept it as-is (press Enter) or point at a
       corrected JSON file (same shape as the printed transcript) to use
       instead.
    4. Resumes the pipeline (align -> understand -> music -> plan_visuals ->
       images -> assemble_plan) for real.
    5. Prints every artifact's path on disk, the final edit_plan.json path,
       and the accumulated cost estimate (see the cost-tracking caveat
       below).

## What to check afterwards (and log in PROGRESS.md — see CLAUDE.md)

    - Is the transcript plausible for the clip's actual speech?
    - Spot-check a couple of WhisperX word timings in words.json against the
      audio (spec §7 Stage 5) — do the start/end times line up by ear?
    - Does the assembled edit_plan.json look sane (captions, visuals, music)?
    - Confirm or adjust the D-022 text-model id (gemini-2.5-flash placeholder)
      based on real output quality.
    - Note the actual USD cost observed here in PROGRESS.md.

## Known cost-tracking gap (D-050 / T-506)

meta.cost_estimate_usd in the final edit_plan.json ONLY reflects image
generation spend today. ASR and understanding Gemini calls are not yet
metered. Treat the printed number as a lower bound, not the true total,
until T-506 wires a job-wide CostMeter through those stages.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

# Allow running as `python scripts/live_smoke.py` from backend/ without
# installing the package first.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import get_settings  # noqa: E402
from app.jobs.manager import JobManager, build_pipeline_stages  # noqa: E402
from app.jobs.paths import DEFAULT_JOBS_ROOT  # noqa: E402
from app.models.job import JobState  # noqa: E402
from app.models.transcript import Transcript  # noqa: E402

_ARTIFACT_FILES = [
    "input.mp4",
    "audio.wav",
    "transcript_raw.json",
    "transcript_corrected.json",
    "words.json",
    "understanding.json",
    "beats.json",
    "music.json",
    "visual_plan.json",
    "images.json",
    "edit_plan.json",
    "log.txt",
]


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("video_path", type=Path, help="Path to a real ~5-90s 9:16 talking-head clip")
    parser.add_argument("--brand-kit", default="kitA", help="Opaque brand kit id (M2 not built yet)")
    parser.add_argument("--brief", default="", help="Operator brief text")
    parser.add_argument(
        "--jobs-root",
        type=Path,
        default=DEFAULT_JOBS_ROOT,
        help=f"Jobs workspace root (default: {DEFAULT_JOBS_ROOT})",
    )
    return parser.parse_args()


def _confirm_real_money() -> None:
    settings = get_settings()
    if settings.gemini_api_key is None or not settings.gemini_api_key.get_secret_value():
        print("ERROR: No GEMINI_API_KEY configured in backend/.env. Aborting.", file=sys.stderr)
        sys.exit(1)
    print("=" * 72)
    print("This will make REAL, BILLED Gemini API calls (ASR + understanding +")
    print("image generation) against your configured GEMINI_API_KEY.")
    print("=" * 72)
    reply = input("Type 'yes' to proceed: ").strip().lower()
    if reply != "yes":
        print("Aborted.")
        sys.exit(0)


def _print_artifacts(job_dir: Path) -> None:
    print(f"\nJob workspace: {job_dir}")
    for name in _ARTIFACT_FILES:
        p = job_dir / name
        marker = "✓" if p.exists() else " "
        print(f"  [{marker}] {p}")


async def _run(args: argparse.Namespace) -> None:
    if not args.video_path.exists():
        print(f"ERROR: video not found: {args.video_path}", file=sys.stderr)
        sys.exit(1)

    mgr = JobManager(jobs_root=args.jobs_root)
    job = mgr.create(
        brand_kit=args.brand_kit,
        brief=args.brief,
        source_path=str(args.video_path.resolve()),
    )
    job_dir = args.jobs_root / job.job_id
    print(f"Created job {job.job_id}")

    stages = build_pipeline_stages()  # all real: Gemini, WhisperX, librosa, music/library.json
    await mgr.run_pipeline(job.job_id, stages)

    status = mgr.status(job.job_id)
    if status.state == JobState.ERROR:
        print(f"\nPipeline FAILED before the correction gate: {status.message}", file=sys.stderr)
        _print_artifacts(job_dir)
        sys.exit(1)
    if status.state != JobState.AWAITING_CORRECTION:
        print(f"\nUnexpected state before the gate: {status.state.value}", file=sys.stderr)
        sys.exit(1)

    raw_path = job_dir / "transcript_raw.json"
    print("\n--- Raw ASR transcript (spec Stage 4 correction gate) ---")
    print(raw_path.read_text(encoding="utf-8"))
    print("---")
    reply = input(
        "Press Enter to accept as-is, or paste a path to a corrected transcript JSON file: "
    ).strip()

    if reply:
        corrected_raw = Path(reply).read_text(encoding="utf-8")
    else:
        corrected_raw = raw_path.read_text(encoding="utf-8")

    corrected = Transcript.model_validate_json(corrected_raw)
    corrected_data = corrected.model_dump()
    corrected_data["job_id"] = job.job_id
    (job_dir / "transcript_corrected.json").write_text(
        json.dumps(corrected_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("\nResuming pipeline (align -> understand -> music -> plan_visuals -> "
          "images -> assemble_plan)...")
    await mgr.resume(job.job_id)

    status = mgr.status(job.job_id)
    _print_artifacts(job_dir)

    if status.state != JobState.READY_FOR_AE:
        print(f"\nPipeline did not complete: state={status.state.value} message={status.message}",
              file=sys.stderr)
        sys.exit(1)

    edit_plan_path = job_dir / "edit_plan.json"
    plan = json.loads(edit_plan_path.read_text(encoding="utf-8"))
    cost = plan.get("meta", {}).get("cost_estimate_usd")

    print(f"\nDONE. Final Edit Plan: {edit_plan_path}")
    print(f"Cost estimate (images only — see D-050 caveat above): ${cost:.4f}" if cost is not None
          else "Cost estimate: unavailable")


def main() -> None:
    args = _parse_args()
    _confirm_real_money()
    asyncio.run(_run(args))


if __name__ == "__main__":
    main()
