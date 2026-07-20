"""Audio extraction stage — spec Stage 2 / §7 / §14.3.

Reads job_dir/input.mp4 (placed by the ingest stage), checks for an audio
stream, extracts mono 16 kHz PCM audio via ffmpeg, writes job_dir/audio.wav,
and verifies the output with the stdlib wave module.

IMPORTANT: audio.wav lives at the JOB ROOT (job_dir/audio.wav), NOT in
assets/audio/. The assets/audio/ directory is reserved for music/SFX assets
referenced by the Edit Plan (e.g. track_cozy_01.wav).
"""

from __future__ import annotations

import time
import wave

from app.clients.ffmpeg import FfmpegError, extract_audio, probe
from app.jobs.manager import JobContext

_EXPECTED_SAMPLE_RATE: int = 16_000
_EXPECTED_CHANNELS: int = 1


class AudioError(RuntimeError):
    """Raised when the audio-extraction stage fails.

    The message is human-readable and safe to surface to the operator.
    """


async def run_audio(ctx: JobContext) -> None:
    """Audio-extraction stage entry point.

    Called by the T-101 stage runner via Stage(name="audio", run=run_audio).
    Raises AudioError on any failure so the runner sets job state to ERROR with
    the human-readable message.
    """
    t0 = time.monotonic()

    src = ctx.paths.job_dir / "input.mp4"
    dst = ctx.paths.job_dir / "audio.wav"

    # ------------------------------------------------------------------
    # 1. Verify input.mp4 exists (ingest must have run first)
    # ------------------------------------------------------------------
    if not src.exists():
        raise AudioError(
            f"input.mp4 not found at {src}. "
            "Run the ingest stage before the audio stage."
        )
    if not src.is_file():
        raise AudioError(f"input.mp4 is not a regular file: {src}")

    # ------------------------------------------------------------------
    # 2. Probe for an audio stream (talking-head takes must have speech)
    # ------------------------------------------------------------------
    try:
        probe_data = probe(src)
    except FfmpegError as exc:
        raise AudioError(str(exc)) from exc

    audio_stream = next(
        (s for s in probe_data.get("streams", []) if s.get("codec_type") == "audio"),
        None,
    )
    if audio_stream is None:
        raise AudioError(
            f"No audio stream found in {src.name!r}. "
            "Framopia Studio requires a talking-head take with a speech track. "
            "Re-export the take with audio included."
        )

    # ------------------------------------------------------------------
    # 3. Extract audio via the shared ffmpeg client
    # ------------------------------------------------------------------
    try:
        extract_audio(src, dst)
    except FfmpegError as exc:
        raise AudioError(str(exc)) from exc

    # ------------------------------------------------------------------
    # 4. Sanity-check the output with the stdlib wave module
    # ------------------------------------------------------------------
    if not dst.exists() or dst.stat().st_size == 0:
        raise AudioError(
            "ffmpeg completed but audio.wav is missing or empty. "
            "The take may have a corrupt or unsupported audio codec."
        )

    try:
        with wave.open(str(dst)) as wf:
            actual_rate = wf.getframerate()
            actual_channels = wf.getnchannels()
    except wave.Error as exc:
        raise AudioError(f"audio.wav is not a valid WAV file: {exc}") from exc

    if actual_rate != _EXPECTED_SAMPLE_RATE:
        raise AudioError(
            f"audio.wav sample rate is {actual_rate} Hz; "
            f"expected {_EXPECTED_SAMPLE_RATE} Hz. ffmpeg output may be malformed."
        )
    if actual_channels != _EXPECTED_CHANNELS:
        raise AudioError(
            f"audio.wav has {actual_channels} channel(s); "
            f"expected {_EXPECTED_CHANNELS} (mono). ffmpeg output may be malformed."
        )

    # ------------------------------------------------------------------
    # 5. Log completion (no secrets; wave properties are safe to log)
    # ------------------------------------------------------------------
    out_bytes = dst.stat().st_size
    elapsed = time.monotonic() - t0
    ctx.logger.log_stage(
        "audio",
        elapsed,
        sample_rate=_EXPECTED_SAMPLE_RATE,
        channels=_EXPECTED_CHANNELS,
        out_bytes=out_bytes,
    )
