"""Tests for the music selection + beat-detection pipeline stage (T-109).

Selection-logic and runner-integration tests inject a fake beat detector
(fast, deterministic). One dedicated test exercises REAL librosa beat
tracking against a tiny synthesized click-track fixture, generated in-test
with numpy — no binary audio is committed.
"""

from __future__ import annotations

import asyncio
import functools
import json
import wave
from pathlib import Path

import numpy as np
import pytest

from app.clients.beats import BeatDetectionError, detect_beats
from app.jobs.manager import JobManager, Stage
from app.models.job import JobState
from app.models.music_library import MusicLibraryEntry
from app.pipeline.music import (
    DEFAULT_MUSIC_GAIN_DB,
    MusicSelectionError,
    _select_track,
    run_music,
)

# ---------------------------------------------------------------------------
# Synthesis helpers (no binary media committed)
# ---------------------------------------------------------------------------


def _write_wav(path: Path, samples: np.ndarray, sr: int) -> None:
    pcm = np.clip(samples, -1.0, 1.0)
    pcm16 = (pcm * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm16.tobytes())


def _make_silent_wav(path: Path, duration_s: float = 2.0, sr: int = 22050) -> None:
    """A trivially short/silent track — used as a 'library asset exists' filler."""
    _write_wav(path, np.zeros(int(duration_s * sr), dtype=np.float32), sr)


def _make_click_track_wav(
    path: Path, bpm: float = 120.0, duration_s: float = 6.0, sr: int = 22050
) -> None:
    """Synthesize a percussive click track at a fixed BPM for real beat detection."""
    interval_s = 60.0 / bpm
    n_samples = int(duration_s * sr)
    audio = np.zeros(n_samples, dtype=np.float32)
    click_len = int(0.03 * sr)
    rng = np.random.default_rng(42)
    envelope = np.hanning(click_len)
    t = 0.0
    while t < duration_s:
        start = int(t * sr)
        end = min(start + click_len, n_samples)
        n = end - start
        click = envelope[:n] * rng.uniform(-1.0, 1.0, n)
        audio[start:end] += click
        t += interval_s
    _write_wav(path, audio, sr)


# ---------------------------------------------------------------------------
# Library fixtures (built in-test, no committed JSON needed)
# ---------------------------------------------------------------------------


def _entry(**overrides) -> dict:
    base = {
        "file": "track.wav",
        "type": "music",
        "mood": ["cozy"],
        "energy": 2,
        "bpm": 90,
        "has_vocals": False,
        "duration": 60.0,
    }
    base.update(overrides)
    return base


def _write_library(music_dir: Path, tracks: list[dict], sfx: list[dict] | None = None) -> Path:
    library_path = music_dir / "library.json"
    library_path.write_text(
        json.dumps({"tracks": tracks, "sfx": sfx or []}, indent=2), encoding="utf-8"
    )
    for entry in tracks + (sfx or []):
        _make_silent_wav(music_dir / entry["file"], duration_s=1.0)
    return library_path


def _fake_detector(beats: list[float]):
    def detector(audio_path: Path) -> list[float]:
        return beats

    return detector


# ---------------------------------------------------------------------------
# Selection logic
# ---------------------------------------------------------------------------


def test_select_prefers_instrumental_over_equal_vocal_track() -> None:
    instrumental = MusicLibraryEntry.model_validate(
        _entry(file="a.wav", has_vocals=False, mood=["cozy"], energy=2)
    )
    vocal = MusicLibraryEntry.model_validate(
        _entry(file="b.wav", has_vocals=True, mood=["cozy"], energy=2)
    )
    chosen = _select_track([vocal, instrumental], brief="a cozy morning routine", reel_duration=10.0)
    assert chosen.file == "a.wav"


def test_select_rejects_track_shorter_than_reel() -> None:
    short = MusicLibraryEntry.model_validate(_entry(file="short.wav", duration=5.0))
    long_enough = MusicLibraryEntry.model_validate(_entry(file="long.wav", duration=60.0))
    chosen = _select_track([short, long_enough], brief="cozy vibes", reel_duration=30.0)
    assert chosen.file == "long.wav"


def test_select_raises_when_all_tracks_too_short() -> None:
    short = MusicLibraryEntry.model_validate(_entry(file="short.wav", duration=5.0))
    with pytest.raises(MusicSelectionError, match="No eligible"):
        _select_track([short], brief="cozy vibes", reel_duration=30.0)


def test_select_scores_mood_and_energy_match() -> None:
    energetic = MusicLibraryEntry.model_validate(
        _entry(file="hype.wav", mood=["energetic"], energy=5, has_vocals=False)
    )
    cozy = MusicLibraryEntry.model_validate(
        _entry(file="cozy.wav", mood=["cozy"], energy=2, has_vocals=False)
    )
    chosen = _select_track(
        [cozy, energetic], brief="an energetic, hype product launch", reel_duration=10.0
    )
    assert chosen.file == "hype.wav"


def test_select_ignores_sfx_entries() -> None:
    sfx = MusicLibraryEntry.model_validate(_entry(file="whoosh.wav", type="sfx", duration=1.0))
    music = MusicLibraryEntry.model_validate(_entry(file="track.wav", duration=60.0))
    chosen = _select_track([sfx, music], brief="cozy", reel_duration=10.0)
    assert chosen.file == "track.wav"


# ---------------------------------------------------------------------------
# Real librosa beat detection
# ---------------------------------------------------------------------------


def test_detect_beats_real_librosa_ascending_nonempty(tmp_path: Path) -> None:
    track = tmp_path / "click.wav"
    _make_click_track_wav(track, bpm=120.0, duration_s=6.0)
    beats = detect_beats(track)
    assert isinstance(beats, list)
    assert len(beats) > 0
    assert all(isinstance(b, float) for b in beats)
    assert all(beats[i] < beats[i + 1] for i in range(len(beats) - 1))


def test_detect_beats_missing_file_raises(tmp_path: Path) -> None:
    with pytest.raises(BeatDetectionError):
        detect_beats(tmp_path / "does_not_exist.wav")


# ---------------------------------------------------------------------------
# Stage-level errors (fail loud)
# ---------------------------------------------------------------------------


def _setup_job(tmp_path: Path, *, duration: float | None = None, brief: str = "cozy vibes"):
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", brief)
    if duration is not None:
        mgr._jobs[job.job_id].duration = duration
    return mgr, job


def _make_music_stage(music_dir: Path, detector) -> Stage:
    return Stage(
        name="music",
        run=functools.partial(
            run_music,
            _beat_detector=detector,
            _library_path=music_dir / "library.json",
        ),
    )


def test_missing_library_raises_error_state(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path, duration=10.0)
    music_dir = tmp_path / "music_missing"
    stage = _make_music_stage(music_dir, _fake_detector([0.1, 0.2]))

    asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state == JobState.ERROR
    assert "not found" in status.message.lower() or "library" in status.message.lower()


def test_empty_library_raises_error_state(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path, duration=10.0)
    music_dir = tmp_path / "music_empty"
    music_dir.mkdir()
    _write_library(music_dir, tracks=[])
    stage = _make_music_stage(music_dir, _fake_detector([0.1, 0.2]))

    asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state == JobState.ERROR
    assert "eligible" in status.message.lower() or "library" in status.message.lower()


def test_all_tracks_too_short_raises_error_state(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path, duration=90.0)
    music_dir = tmp_path / "music_short"
    music_dir.mkdir()
    _write_library(music_dir, tracks=[_entry(file="short.wav", duration=5.0)])
    stage = _make_music_stage(music_dir, _fake_detector([0.1, 0.2]))

    asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state == JobState.ERROR


# ---------------------------------------------------------------------------
# Through the T-101 runner (fake detector injected — fast)
# ---------------------------------------------------------------------------


def test_runs_through_runner_and_writes_artifacts(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path, duration=10.0, brief="a cozy calm morning routine")
    music_dir = tmp_path / "music"
    music_dir.mkdir()
    _write_library(
        music_dir,
        tracks=[
            _entry(file="cozy.wav", mood=["cozy", "calm"], energy=2, has_vocals=False, duration=60.0),
            _entry(file="hype.wav", mood=["energetic"], energy=5, has_vocals=True, duration=60.0),
        ],
    )
    fake_beats = [0.5, 1.0, 1.5, 2.0]
    stage = _make_music_stage(music_dir, _fake_detector(fake_beats))

    asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state == JobState.READY_FOR_AE
    assert status.progress_pct == 100.0

    job_dir = tmp_path / "jobs" / job.job_id

    beats_path = job_dir / "beats.json"
    assert beats_path.exists()
    beats = json.loads(beats_path.read_text(encoding="utf-8"))
    assert beats == fake_beats

    music_path = job_dir / "music.json"
    assert music_path.exists()
    record = json.loads(music_path.read_text(encoding="utf-8"))
    assert record["music"]["asset"] == "assets/audio/cozy.wav"
    assert record["music"]["gain_db"] == DEFAULT_MUSIC_GAIN_DB
    assert record["sfx"] == []

    copied_audio = job_dir / "assets" / "audio" / "cozy.wav"
    assert copied_audio.exists()


def test_uses_fallback_duration_when_job_duration_unset(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path, duration=None, brief="cozy vibes")
    assert job.duration is None
    music_dir = tmp_path / "music"
    music_dir.mkdir()
    # Only long enough for the 30s fallback, not for e.g. a 90s reel.
    _write_library(music_dir, tracks=[_entry(file="cozy.wav", duration=45.0)])
    stage = _make_music_stage(music_dir, _fake_detector([0.1, 0.2]))

    asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state == JobState.READY_FOR_AE
    job_dir = tmp_path / "jobs" / job.job_id
    assert (job_dir / "music.json").exists()

    log_lines = (job_dir / "log.txt").read_text(encoding="utf-8").strip().splitlines()
    music_log = [
        json.loads(line)
        for line in log_lines
        if json.loads(line).get("stage") == "music" and "duration_fallback_used" in json.loads(line)
    ]
    assert music_log
    assert music_log[-1]["duration_fallback_used"] is True


def test_beat_detector_error_wrapped_as_music_selection_error(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path, duration=10.0)
    music_dir = tmp_path / "music"
    music_dir.mkdir()
    _write_library(music_dir, tracks=[_entry(file="cozy.wav", duration=60.0)])

    def failing_detector(audio_path: Path) -> list[float]:
        raise BeatDetectionError("synthetic failure")

    stage = _make_music_stage(music_dir, failing_detector)
    asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state == JobState.ERROR
    assert "beat detection" in status.message.lower()
