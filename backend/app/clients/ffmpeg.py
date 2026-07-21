"""Shared subprocess wrapper for ffmpeg and ffprobe (spec §7 / §14.3).

Pipeline stages that invoke ffmpeg tools import from here. Each function raises
FfmpegError (a RuntimeError subclass) with a human-readable message on any
failure mode so callers never see raw stack traces.

Note (D-020, consolidated at T-113): the ingest stage (T-102) previously kept a
private ``_run_ffprobe()`` because test_ingest.py mocked
``app.pipeline.ingest.subprocess.run`` directly. It now imports ``probe()``
from here; the T-102 test mocks were updated to patch
``app.clients.ffmpeg.subprocess.run`` instead. images.py's client-asset
dimension probe (D-043) still has its own private ffprobe invocation — see
that module's docstring for why it isn't consolidated here.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


class FfmpegError(RuntimeError):
    """Raised when an ffmpeg or ffprobe subprocess call fails.

    The message is human-readable and safe to surface to the operator.
    """


# ---------------------------------------------------------------------------
# ffprobe
# ---------------------------------------------------------------------------


def probe(path: Path) -> dict:
    """Run ffprobe on *path* and return parsed JSON.

    Returns a dict with 'streams' (list) and 'format' (dict) keys.
    Raises FfmpegError on all failure modes (not found, timeout, bad exit,
    invalid JSON).
    """
    try:
        proc = subprocess.run(
            [
                "ffprobe",
                "-v", "quiet",
                "-print_format", "json",
                "-show_streams",
                "-show_format",
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except FileNotFoundError:
        raise FfmpegError(
            "ffprobe not found. Install ffmpeg (brew install ffmpeg)."
        ) from None
    except subprocess.TimeoutExpired as exc:
        raise FfmpegError(
            f"ffprobe timed out probing {path.name!r} (30 s limit)."
        ) from exc

    if proc.returncode != 0:
        stderr = proc.stderr.strip() or "(no stderr)"
        raise FfmpegError(
            f"ffprobe exited {proc.returncode} for {path.name!r}: {stderr}"
        )

    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise FfmpegError(
            f"ffprobe produced invalid JSON for {path.name!r}: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# ffmpeg audio extraction
# ---------------------------------------------------------------------------


def extract_audio(src: Path, dst: Path) -> None:
    """Extract mono 16 kHz PCM-s16le audio from *src* and write WAV to *dst*.

    Flags used:
        -vn          strip all video streams
        -ac 1        downmix to mono
        -ar 16000    resample to 16 kHz
        -c:a pcm_s16le  raw PCM signed-16-bit little-endian (no container overhead)
        -y           overwrite output without prompting

    Raises FfmpegError on all failure modes (not found, timeout, non-zero exit).
    The caller is responsible for verifying the output via the wave module.
    """
    try:
        proc = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i", str(src),
                "-vn",
                "-ac", "1",
                "-ar", "16000",
                "-c:a", "pcm_s16le",
                str(dst),
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
    except FileNotFoundError:
        raise FfmpegError(
            "ffmpeg not found. Install ffmpeg (brew install ffmpeg)."
        ) from None
    except subprocess.TimeoutExpired as exc:
        raise FfmpegError(
            f"ffmpeg timed out extracting audio from {src.name!r} (120 s limit)."
        ) from exc

    if proc.returncode != 0:
        stderr = proc.stderr.strip() or "(no stderr)"
        raise FfmpegError(
            f"ffmpeg exited {proc.returncode} extracting audio from {src.name!r}: {stderr}"
        )
