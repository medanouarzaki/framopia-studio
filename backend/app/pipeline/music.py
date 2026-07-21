"""Music & SFX selection + beat-detection stage — spec Stage 9 / §13.

Reads the committed ``music/library.json``, scores eligible MUSIC tracks
against the job brief's implied mood/energy, copies the winning track into
``ctx.paths.audio_dir`` (the reserved music/SFX dir, D-021), runs beat
detection on it, and writes two job-root artifacts:

    - job_dir/beats.json   — ascending, non-empty beat timestamps (D-036)
    - job_dir/music.json   — chosen-track record, AudioPlan shape (D-036)

Ordering note (spec Stage 7 ordering / PROGRESS.md T-109 entry):
music + beats are computed BEFORE final visual placement (T-110) so visuals
can snap to the beat grid. This stage must run before any visual-planning
stage in the pipeline's stage list.

## Injection seams for tests

``run_music`` accepts two optional keyword arguments:
    _beat_detector: Callable[[Path], list[float]] — defaults to
        app.clients.beats.detect_beats (real librosa). Tests inject a fast
        fake via functools.partial for runner-integration tests; a dedicated
        test exercises the real detector directly against a synthesized
        fixture (test_music.py), not through this stage.
    _library_path: Path — defaults to the repo's music/library.json. Tests
        inject a tmp_path fixture library + matching synthesized audio files.
"""

from __future__ import annotations

import json
import shutil
import time
from collections.abc import Callable
from pathlib import Path

from app.clients.beats import BeatDetectionError, detect_beats
from app.jobs.manager import JobContext
from app.models.edit_plan import AudioPlan, MusicCue
from app.models.music_library import MusicLibraryEntry

# Repo root: this file is at backend/app/pipeline/music.py
# parents[0]=pipeline, [1]=app, [2]=backend, [3]=repo root
_REPO_ROOT: Path = Path(__file__).resolve().parents[3]
_DEFAULT_LIBRARY_PATH: Path = _REPO_ROOT / "music" / "library.json"

# Brand Kit default music gain (spec §13.2, ~-14 dB so music sits under speech).
# TODO(T-201): source this from the Brand Kit config once the loader exists;
# this module-level constant is the sane default in the meantime (D-036).
DEFAULT_MUSIC_GAIN_DB = -14.0

# Fallback reel duration (seconds) used when ctx.job.duration is not yet set
# (e.g. this stage is exercised before the ingest stage's duration is known).
# Matches the spec's ~30s target reel length (D-A1). See D-036.
_FALLBACK_REEL_DURATION_S = 30.0

# Keyword → target energy (1-5) heuristic used to read the brief's implied
# energy level, since Job.brief is free text with no structured mood/energy
# field yet (D-036). Unmatched briefs fall back to a neutral energy of 3.
_ENERGY_KEYWORDS: dict[str, int] = {
    "calm": 1, "chill": 1, "mellow": 1,
    "cozy": 2, "relaxed": 2, "soft": 2,
    "neutral": 3, "warm": 3,
    "upbeat": 4, "playful": 4, "bright": 4,
    "energetic": 5, "hype": 5, "dramatic": 5, "intense": 5,
}


class MusicSelectionError(RuntimeError):
    """Raised when music selection or beat detection fails.

    The message is human-readable and safe to surface to the operator.
    """


def _load_library(library_path: Path) -> list[MusicLibraryEntry]:
    """Read and validate music/library.json into a flat list of entries."""
    if not library_path.exists() or not library_path.is_file():
        raise MusicSelectionError(
            f"Music library not found at {library_path}. "
            "Commit music/library.json with at least one eligible music track."
        )
    try:
        data = json.loads(library_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise MusicSelectionError(f"Could not read music library {library_path}: {exc}") from exc

    raw_entries = list(data.get("tracks", [])) + list(data.get("sfx", []))
    try:
        return [MusicLibraryEntry.model_validate(e) for e in raw_entries]
    except Exception as exc:
        raise MusicSelectionError(f"music/library.json entry failed validation: {exc}") from exc


def _target_energy(brief_lower: str) -> int:
    """Derive a target energy 1-5 from keywords in the brief; default 3 (neutral)."""
    for keyword, energy in _ENERGY_KEYWORDS.items():
        if keyword in brief_lower:
            return energy
    return 3


def _score(track: MusicLibraryEntry, brief_lower: str, target_energy: int) -> tuple[int, int, int]:
    """Deterministic score: mood match count, closeness to target energy, instrumental bonus.

    Sorting by this tuple (descending) prefers more mood matches, then closer
    energy, then instrumental tracks over otherwise-equal vocal ones.
    """
    mood_matches = sum(1 for m in track.mood if m.lower() in brief_lower)
    energy_delta = abs(track.energy - target_energy)
    instrumental_bonus = 0 if track.has_vocals else 1
    return (mood_matches, -energy_delta, instrumental_bonus)


def _select_track(
    entries: list[MusicLibraryEntry], brief: str, reel_duration: float
) -> MusicLibraryEntry:
    """Pick the best-matching MUSIC track (spec §13.2): instrumental preferred,
    duration >= reel_duration required, mood/energy scored."""
    music_tracks = [t for t in entries if t.type == "music"]
    eligible = [t for t in music_tracks if t.duration >= reel_duration]
    if not eligible:
        raise MusicSelectionError(
            f"No eligible music track: need duration >= {reel_duration:.1f}s "
            f"({len(music_tracks)} music tracks in library, none long enough)."
        )
    brief_lower = brief.lower()
    target_energy = _target_energy(brief_lower)
    eligible.sort(key=lambda t: _score(t, brief_lower, target_energy), reverse=True)
    return eligible[0]


async def run_music(
    ctx: JobContext,
    *,
    _beat_detector: Callable[[Path], list[float]] | None = None,
    _library_path: Path | None = None,
) -> None:
    """Music-selection + beat-detection stage entry point.

    Called by the T-101 stage runner via Stage(name="music", run=run_music).
    Raises MusicSelectionError on any failure so the runner sets job state to ERROR.

    Args:
        ctx:             Job context from the runner.
        _beat_detector:  Injectable beat-detector callable for tests. Leave
                         None in production (uses real librosa).
        _library_path:   Injectable library.json path for tests. Leave None
                         in production (uses the committed music/library.json).
    """
    t0 = time.monotonic()

    library_path = _library_path or _DEFAULT_LIBRARY_PATH
    entries = _load_library(library_path)

    reel_duration = ctx.job.duration
    duration_fallback_used = reel_duration is None
    if reel_duration is None:
        reel_duration = _FALLBACK_REEL_DURATION_S

    chosen = _select_track(entries, ctx.job.brief, reel_duration)

    src_audio = library_path.parent / chosen.file
    if not src_audio.exists() or not src_audio.is_file():
        raise MusicSelectionError(
            f"Selected track file not found on disk: {src_audio}. "
            "Add the licensed audio file under music/ (git-ignored per .gitignore)."
        )

    ctx.paths.audio_dir.mkdir(parents=True, exist_ok=True)
    dst_audio = ctx.paths.audio_dir / chosen.file
    shutil.copy2(src_audio, dst_audio)

    detector = _beat_detector or detect_beats
    try:
        beats = detector(dst_audio)
    except BeatDetectionError as exc:
        raise MusicSelectionError(f"Beat detection failed: {exc}") from exc

    if not beats or any(beats[i] >= beats[i + 1] for i in range(len(beats) - 1)):
        raise MusicSelectionError(
            "Beat detector returned an empty or non-ascending beat list."
        )

    beats_path = ctx.paths.job_dir / "beats.json"
    beats_path.write_text(json.dumps(list(beats), indent=2), encoding="utf-8")

    asset_ref = f"assets/audio/{chosen.file}"
    audio_plan = AudioPlan(
        music=MusicCue(asset=asset_ref, gain_db=DEFAULT_MUSIC_GAIN_DB, start=0.0),
        sfx=[],  # SFX cue scaffold — populated by a future session; empty is fine for v1.
    )
    music_path = ctx.paths.job_dir / "music.json"
    music_path.write_text(
        json.dumps(audio_plan.model_dump(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    elapsed = time.monotonic() - t0
    ctx.logger.log_stage(
        "music",
        elapsed,
        beats=len(beats),
        track=chosen.file,
        duration_fallback_used=duration_fallback_used,
    )
