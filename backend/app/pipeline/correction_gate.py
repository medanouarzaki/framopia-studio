"""ASR correction gate stage — the quality keystone (spec Stage 4 / §14.1).

This stage does no computation. Its sole purpose is to carry is_gate=True so
the T-101 runner pauses in AWAITING_CORRECTION after ASR completes and stores
the remaining stages in _pending. The pipeline only continues when the operator
POSTs a corrected transcript to POST /jobs/{id}/transcript (T-106).

The gate MUST NEVER be auto-skipped. Omitting it from a pipeline is wrong.
Replacing its is_gate=True with is_gate=False is wrong.
Calling mgr.resume() without receiving a corrected transcript is wrong.
"""

from __future__ import annotations

from app.jobs.manager import JobContext, Stage


async def _correction_gate_run(ctx: JobContext) -> None:
    """No-op run — the pause is handled by is_gate=True in the T-101 runner.

    The runner calls this, then checks stage.is_gate and stores remaining
    stages in _pending[job_id] before returning. The operator must POST
    a corrected transcript to resume.
    """


CORRECTION_GATE_STAGE = Stage(
    name="correction_gate",
    run=_correction_gate_run,
    is_gate=True,
)
