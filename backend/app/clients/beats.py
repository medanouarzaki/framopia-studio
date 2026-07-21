"""Beat-detection client — librosa wrapper (spec §13.3, Stage 9).

Public interface
----------------
``detect_beats(audio_path) -> list[float]`` runs librosa beat tracking and
returns a strictly ascending, non-empty list of beat timestamps in seconds.

Heavy import (``librosa``) is guarded INSIDE the function body so importing
this module never requires librosa to be installed at import time. The
music-selection stage (app.pipeline.music) accepts an injectable detector
callable so its runner-integration test can inject a fake and stay fast; a
dedicated test in test_music.py exercises this real implementation against a
tiny synthesized click-track fixture.
"""

from __future__ import annotations

from pathlib import Path


class BeatDetectionError(RuntimeError):
    """Raised when beat detection fails.

    The message is human-readable and safe to surface to the operator.
    """


def detect_beats(audio_path: Path) -> list[float]:
    """Run librosa beat tracking on *audio_path* and return beat timestamps (seconds).

    Returns a strictly ascending, non-empty list of floats. Consecutive beats
    that round to the same timestamp are collapsed to keep the list strictly
    ascending.

    Raises:
        BeatDetectionError: librosa is not installed, the file cannot be
            loaded, or no beats are detected.
    """
    try:
        import librosa  # noqa: PLC0415
    except ImportError as exc:
        raise BeatDetectionError(
            "librosa is not installed. Install: pip install librosa"
        ) from exc

    try:
        y, sr = librosa.load(str(audio_path), sr=None, mono=True)
        _tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    except Exception as exc:
        raise BeatDetectionError(
            f"Beat detection failed for {audio_path.name!r}: {exc}"
        ) from exc

    beats: list[float] = []
    for t in sorted(float(t) for t in beat_times):
        if not beats or t > beats[-1]:
            beats.append(t)

    if not beats:
        raise BeatDetectionError(
            f"No beats detected in {audio_path.name!r}. Track may be silent, too short, "
            "or lack a clear rhythmic pattern."
        )
    return beats
