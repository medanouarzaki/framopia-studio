"""The segment_person task: its arithmetic, its contract and its failures.

The bounding box is the part a placement solver will trust without being able
to check it, so it is tested against masks whose geometry is known by
construction rather than against the model's output, which nothing here can
independently verify.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from framopia_cv.segment_person import MODEL_PATH, person_stats

CV_DIR = Path(__file__).resolve().parent.parent


def run_sidecar(request: dict) -> tuple[int, dict, str]:
    completed = subprocess.run(
        [sys.executable, "-m", "framopia_cv.cli"],
        input=json.dumps(request),
        capture_output=True,
        text=True,
        cwd=CV_DIR,
    )
    return completed.returncode, json.loads(completed.stdout), completed.stderr


class TestPersonStats:
    def test_normalizes_the_box_against_the_mask(self):
        # A 100x200 mask with the subject occupying columns 10..29 and rows
        # 40..139: x 0.10, y 0.20, width 0.20, height 0.50.
        mask = np.zeros((200, 100), dtype=bool)
        mask[40:140, 10:30] = True
        ratio, bbox = person_stats(mask)
        assert bbox == pytest.approx(
            {"x": 0.10, "y": 0.20, "width": 0.20, "height": 0.50}
        )
        assert ratio == pytest.approx(2000 / 20000)

    def test_a_single_pixel_spans_one_pixel_not_zero(self):
        mask = np.zeros((10, 10), dtype=bool)
        mask[5, 5] = True
        _, bbox = person_stats(mask)
        assert bbox == pytest.approx({"x": 0.5, "y": 0.5, "width": 0.1, "height": 0.1})

    def test_a_full_frame_subject_is_the_whole_box(self):
        _, bbox = person_stats(np.ones((8, 4), dtype=bool))
        assert bbox == pytest.approx({"x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0})

    # A frame with nobody in it has to come back well formed. An empty box
    # would have to claim a position, and a zero-size box at the origin reads
    # as a subject in the top-left corner.
    def test_no_person_is_ratio_zero_and_no_box(self):
        ratio, bbox = person_stats(np.zeros((32, 16), dtype=bool))
        assert ratio == 0.0
        assert bbox is None

    def test_the_box_covers_every_component(self):
        mask = np.zeros((100, 100), dtype=bool)
        mask[10:20, 10:20] = True
        mask[80:90, 80:90] = True
        _, bbox = person_stats(mask)
        assert bbox == pytest.approx({"x": 0.10, "y": 0.10, "width": 0.80, "height": 0.80})


@pytest.mark.skipif(not MODEL_PATH.is_file(), reason="segmenter model not downloaded")
class TestContract:
    @pytest.fixture
    def frame(self, tmp_path: Path) -> Path:
        path = tmp_path / "frame-0000.png"
        rng = np.random.default_rng(0)
        Image.fromarray(rng.integers(0, 255, (96, 54, 3), dtype=np.uint8)).save(path)
        return path

    def test_returns_a_mask_pair_and_stats_per_frame(self, frame: Path, tmp_path: Path):
        code, payload, _ = run_sidecar(
            {
                "task": "segment_person",
                "framePaths": [str(frame)],
                "outDir": str(tmp_path / "masks"),
            }
        )
        assert code == 0
        assert payload["ok"] is True
        assert payload["task"] == "segment_person"
        assert payload["threshold"] == 0.5

        (result,) = payload["frames"]
        assert Path(result["confidenceMaskPath"]).is_file()
        assert Path(result["binaryMaskPath"]).is_file()
        assert result["width"] == 54 and result["height"] == 96
        assert 0.0 <= result["personPixelRatio"] <= 1.0
        assert result["bbox"] is None or set(result["bbox"]) == {"x", "y", "width", "height"}

    # The confidence mask is written so that a later threshold change does not
    # mean re-running the model, which is only true if it keeps the values the
    # binary mask threw away.
    def test_the_confidence_mask_is_not_already_binary(self, frame: Path, tmp_path: Path):
        _, payload, _ = run_sidecar(
            {
                "task": "segment_person",
                "framePaths": [str(frame)],
                "outDir": str(tmp_path / "masks"),
            }
        )
        confidence = np.asarray(Image.open(payload["frames"][0]["confidenceMaskPath"]))
        binary = np.asarray(Image.open(payload["frames"][0]["binaryMaskPath"]))
        assert set(np.unique(binary)) <= {0, 255}
        assert len(np.unique(confidence)) > 2

    def test_stdout_carries_the_result_and_nothing_else(self, frame: Path, tmp_path: Path):
        # MediaPipe and XNNPACK both announce themselves at load. If either
        # reached stdout the caller would parse a banner instead of a result.
        code, payload, stderr = run_sidecar(
            {
                "task": "segment_person",
                "framePaths": [str(frame)],
                "outDir": str(tmp_path / "masks"),
            }
        )
        assert code == 0 and payload["ok"] is True
        assert stderr != ""


class TestFailures:
    def test_a_missing_frame_is_a_named_failure_not_a_skip(self, tmp_path: Path):
        # Dropping the frame and carrying on would leave the response shorter
        # than the request and silently misalign every index after it.
        code, payload, _ = run_sidecar(
            {
                "task": "segment_person",
                "framePaths": [str(tmp_path / "absent.png")],
                "outDir": str(tmp_path / "masks"),
            }
        )
        assert code == 1
        assert payload["ok"] is False
        assert "absent.png" in payload["error"]

    def test_an_empty_frame_list_is_refused(self, tmp_path: Path):
        code, payload, _ = run_sidecar(
            {"task": "segment_person", "framePaths": [], "outDir": str(tmp_path)}
        )
        assert code == 1 and payload["ok"] is False

    def test_a_missing_model_is_a_failure_not_a_substitution(self, tmp_path: Path):
        frame = tmp_path / "f.png"
        Image.fromarray(np.zeros((16, 16, 3), dtype=np.uint8)).save(frame)
        code, payload, _ = run_sidecar_with_model(
            tmp_path / "no-such-model.tflite", frame, tmp_path
        )
        assert code == 1 and payload["ok"] is False
        assert "no-such-model.tflite" in payload["error"]

    def test_a_corrupt_model_is_a_failure(self, tmp_path: Path):
        corrupt = tmp_path / "corrupt.tflite"
        corrupt.write_bytes(b"not a flatbuffer")
        frame = tmp_path / "f.png"
        Image.fromarray(np.zeros((16, 16, 3), dtype=np.uint8)).save(frame)
        code, payload, _ = run_sidecar_with_model(corrupt, frame, tmp_path)
        assert code == 1 and payload["ok"] is False


def run_sidecar_with_model(model: Path, frame: Path, tmp_path: Path) -> tuple[int, dict, str]:
    """The sidecar with its model path redirected, run as a real subprocess.

    The path is a module constant read at load, so the redirect has to happen
    inside the child rather than through monkeypatching this process.
    """
    script = (
        "import json,sys,pathlib;"
        "import framopia_cv.segment_person as sp;"
        f"sp.MODEL_PATH = pathlib.Path({str(model)!r});"
        "from framopia_cv.cli import main;"
        "sys.exit(main())"
    )
    completed = subprocess.run(
        [sys.executable, "-c", script],
        input=json.dumps(
            {
                "task": "segment_person",
                "framePaths": [str(frame)],
                "outDir": str(tmp_path / "masks"),
            }
        ),
        capture_output=True,
        text=True,
        cwd=CV_DIR,
    )
    return completed.returncode, json.loads(completed.stdout), completed.stderr


class TestModelPin:
    """The sha256 check has to reject as well as accept.

    A pin nobody has watched fail is a pin nobody knows works, which is the
    whole reason Block 10 wants a golden run on a second machine.
    """

    def _run(self, directory: Path) -> subprocess.CompletedProcess:
        return subprocess.run(
            [str(CV_DIR / "verify-models.sh")],
            capture_output=True,
            text=True,
            env={"FRAMOPIA_MODELS_DIR": str(directory), "HOME": str(directory), "PATH": "/usr/bin:/bin"},
        )

    def _fixture(self, directory: Path, contents: bytes, digest: str) -> None:
        (directory / "models").mkdir(parents=True, exist_ok=True)
        (directory / "models" / "pinned.bin").write_bytes(contents)
        (directory / "models.json").write_text(
            json.dumps(
                {"models": {"pinned": {"file": "models/pinned.bin", "sha256": digest}}}
            )
        )

    GOOD = b"weights"

    def test_accepts_a_matching_file(self, tmp_path: Path):
        digest = hashlib.sha256(self.GOOD).hexdigest()
        self._fixture(tmp_path, self.GOOD, digest)
        result = self._run(tmp_path)
        assert result.returncode == 0
        assert "pinned ok" in result.stdout

    def test_rejects_a_tampered_file(self, tmp_path: Path):
        digest = hashlib.sha256(self.GOOD).hexdigest()
        self._fixture(tmp_path, self.GOOD + b"!", digest)
        result = self._run(tmp_path)
        assert result.returncode == 1
        assert "MISMATCH" in result.stderr

    def test_reports_a_missing_file_as_not_downloaded_not_a_mismatch(self, tmp_path: Path):
        self._fixture(tmp_path, self.GOOD, "0" * 64)
        (tmp_path / "models" / "pinned.bin").unlink()
        result = self._run(tmp_path)
        assert result.returncode == 2
        assert "NOT DOWNLOADED" in result.stdout


class TestHeadMask:
    """Head extraction from the six category planes, and the no-overwrite rule."""

    def planes(self, head_rows=(10, 30), body_rows=(30, 80)) -> list[np.ndarray]:
        """A constructed six-category softmax: background, hair, body, face, clothes, other."""
        planes = [np.zeros((100, 50), dtype=np.float64) for _ in range(6)]
        planes[0][:, :] = 1.0
        planes[1][head_rows[0] : head_rows[0] + 10, 15:35] = 1.0  # hair
        planes[3][head_rows[0] + 10 : head_rows[1], 15:35] = 1.0  # face skin
        planes[4][body_rows[0] : body_rows[1], 10:40] = 1.0  # clothes
        for index in (1, 3, 4):
            planes[0][planes[index] > 0] = 0.0
        return planes

    def test_head_is_hair_plus_face_skin_and_nothing_else(self):
        from framopia_cv.segment_person import head_confidence

        head = head_confidence(self.planes())
        assert head[15, 20] == pytest.approx(1.0)  # hair
        assert head[25, 20] == pytest.approx(1.0)  # face
        assert head[50, 20] == pytest.approx(0.0)  # clothes are not head
        assert head[5, 20] == pytest.approx(0.0)  # background

    def test_head_bottom_is_the_last_row_holding_a_head_pixel(self):
        from framopia_cv.segment_person import head_confidence, head_stats

        ratio, bottom = head_stats(head_confidence(self.planes()) > 0.5)
        assert ratio == pytest.approx((20 * 20) / (100 * 50))
        # Head occupies rows 10..29 of 100, so it ends at 30/100.
        assert bottom == pytest.approx(0.30)

    def test_a_frame_with_no_head_reports_no_bottom_edge(self):
        from framopia_cv.segment_person import head_stats

        ratio, bottom = head_stats(np.zeros((20, 20), dtype=bool))
        assert ratio == 0.0
        assert bottom is None

    # Every mask on disk has already been measured and reasoned about, and
    # re-encoding one to prove it is unchanged is the one action that could
    # change it. An existing mask is verified, never rewritten.
    def test_an_existing_mask_is_verified_and_never_rewritten(self, tmp_path: Path):
        from framopia_cv.segment_person import _write_or_verify

        path = tmp_path / "m.png"
        values = np.arange(256, dtype=np.uint8).reshape(16, 16)
        assert _write_or_verify(path, values) is True
        before = path.read_bytes()

        assert _write_or_verify(path, values) is True
        assert path.read_bytes() == before

        different = values.copy()
        different[0, 0] = (int(different[0, 0]) + 1) % 256
        assert _write_or_verify(path, different) is False
        assert path.read_bytes() == before
