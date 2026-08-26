"""Person segmentation for frame analysis, ARCHITECTURE §5.5.

MediaPipe's selfie multiclass segmenter. The model returns one confidence
mask per category and the person is the union of every non-background one,
which is what a placement solver needs: hair, clothes and a held accessory
occlude a zone exactly as skin does.

Two masks are written per frame. The binary mask at the threshold is what the
next stage reads; the raw confidence mask is kept because a threshold is a
decision that will be revisited, and re-running segmentation to try 0.4 would
mean re-reading every frame of every reel.

No dilation and no smoothing. A safety margin around a subject is a separate,
measured change; applying one here would mean the mask that gets judged is
not the mask the model produced.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image

MODEL_NAME = "selfie_multiclass_256x256"
MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / f"{MODEL_NAME}.tflite"

# Category 0 is background; 1..5 are hair, body skin, face skin, clothes and
# accessories. The model is a softmax over the six, so summing 1..5 is the
# same number as 1 - background, and is written the way the rule reads.
BACKGROUND_CATEGORY = 0

# Hair and face skin. Long hair counts as head, which over-excludes the region
# below it — the safe direction, because an image over a chin is a defect while
# an image placed a little lower is only a missed opportunity.
HEAD_CATEGORIES = (1, 3)

DEFAULT_THRESHOLD = 0.5


class ModelUnavailableError(RuntimeError):
    """The segmenter weights are missing or will not load."""


@lru_cache(maxsize=1)
def _segmenter():
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision

    if not MODEL_PATH.is_file():
        raise ModelUnavailableError(
            f"segmenter model not found at {MODEL_PATH}; run tools/cv/setup.sh"
        )
    try:
        options = vision.ImageSegmenterOptions(
            base_options=mp_python.BaseOptions(model_asset_path=str(MODEL_PATH)),
            running_mode=vision.RunningMode.IMAGE,
            output_category_mask=False,
            output_confidence_masks=True,
        )
        return vision.ImageSegmenter.create_from_options(options)
    except Exception as error:  # noqa: BLE001 - any load failure is the same answer
        raise ModelUnavailableError(f"could not load {MODEL_PATH}: {error}") from error


def category_confidences(frame_path: str) -> list[np.ndarray]:
    """One float 0-1 confidence plane per category, in the model's own order."""
    import mediapipe as mp

    if not Path(frame_path).is_file():
        raise FileNotFoundError(f"frame not found: {frame_path}")

    image = mp.Image.create_from_file(frame_path)
    result = _segmenter().segment(image)
    masks = result.confidence_masks
    if len(masks) < 2:
        raise ModelUnavailableError(
            f"segmenter returned {len(masks)} confidence masks; expected one per category"
        )
    shape = masks[0].numpy_view().shape[:2]
    return [np.asarray(m.numpy_view(), dtype=np.float64).reshape(shape) for m in masks]


def _sum_categories(planes: list[np.ndarray], categories) -> np.ndarray:
    total = np.zeros(planes[0].shape, dtype=np.float64)
    for index in categories:
        if index < len(planes):
            total += planes[index]
    return np.clip(total, 0.0, 1.0)


def person_confidence(frame_path: str) -> np.ndarray:
    """Per-pixel probability that the pixel belongs to a person, as float 0-1."""
    planes = category_confidences(frame_path)
    others = [i for i in range(len(planes)) if i != BACKGROUND_CATEGORY]
    return _sum_categories(planes, others)


def head_confidence(planes: list[np.ndarray]) -> np.ndarray:
    """Hair plus face skin, the region no image may ever be placed over."""
    return _sum_categories(planes, HEAD_CATEGORIES)


def person_stats(binary: np.ndarray) -> tuple[float, dict | None]:
    """Coverage and bounding box of a boolean person mask.

    The box is normalized to 0-1 against the mask's own dimensions so that
    nothing downstream depends on the 540x960 working size; the same numbers
    describe the box in the source frame. A frame with no person gets ratio 0
    and no box, because an empty box would have to claim a position.
    """
    rows, cols = binary.shape
    ratio = float(binary.mean())
    if not binary.any():
        return 0.0, None

    ys = np.flatnonzero(binary.any(axis=1))
    xs = np.flatnonzero(binary.any(axis=0))
    top, bottom = int(ys[0]), int(ys[-1])
    left, right = int(xs[0]), int(xs[-1])
    return ratio, {
        "x": left / cols,
        "y": top / rows,
        # The extremes are inclusive pixel indices, so the box spans one more
        # pixel than their difference.
        "width": (right - left + 1) / cols,
        "height": (bottom - top + 1) / rows,
    }


def head_stats(head_binary: np.ndarray) -> tuple[float, float | None]:
    """Coverage and the normalized y below which no head pixel appears.

    That bottom edge is the upper bound of any future torso zone: nothing may
    be placed above it. None when the frame holds no head at all, which is not
    the same as a head ending at the top of the frame.
    """
    rows, _ = head_binary.shape
    if not head_binary.any():
        return 0.0, None
    ys = np.flatnonzero(head_binary.any(axis=1))
    return float(head_binary.mean()), (int(ys[-1]) + 1) / rows


def _write_or_verify(path: Path, values: np.ndarray) -> bool:
    """Write a mask, or verify an existing one without touching it.

    An existing mask is never rewritten. Every mask on disk has already been
    measured and reasoned about, and re-encoding one to prove it is unchanged
    would be the one action that could change it. The comparison is on decoded
    pixels rather than file bytes, because the question is whether the model
    still produces the same mask, not whether PIL still compresses the same way.
    """
    if path.is_file():
        with Image.open(path) as handle:
            return bool(np.array_equal(np.asarray(handle.convert("L")), values))
    Image.fromarray(values, mode="L").save(path, "PNG")
    return True


def segment_frame(
    frame_path: str,
    out_dir: str,
    threshold: float = DEFAULT_THRESHOLD,
    write_head: bool = True,
) -> dict:
    planes = category_confidences(frame_path)
    others = [i for i in range(len(planes)) if i != BACKGROUND_CATEGORY]
    confidence = _sum_categories(planes, others)
    binary = confidence > threshold
    ratio, bbox = person_stats(binary)

    stem = Path(frame_path).stem
    directory = Path(out_dir)
    directory.mkdir(parents=True, exist_ok=True)
    confidence_path = directory / f"{stem}-confidence.png"
    binary_path = directory / f"{stem}-binary.png"

    confidence_unchanged = _write_or_verify(
        confidence_path, np.round(confidence * 255).astype(np.uint8)
    )
    binary_unchanged = _write_or_verify(binary_path, (binary * 255).astype(np.uint8))

    height, width = binary.shape
    result = {
        "framePath": frame_path,
        "confidenceMaskPath": str(confidence_path),
        "binaryMaskPath": str(binary_path),
        "width": width,
        "height": height,
        "personPixelRatio": ratio,
        "bbox": bbox,
        "confidenceUnchanged": confidence_unchanged,
        "binaryUnchanged": binary_unchanged,
    }

    if write_head:
        head = head_confidence(planes)
        head_binary = head > threshold
        head_path = directory / f"{stem}-head.png"
        _write_or_verify(head_path, np.round(head * 255).astype(np.uint8))
        head_ratio, head_bottom = head_stats(head_binary)
        result["headMaskPath"] = str(head_path)
        result["headPixelRatio"] = head_ratio
        result["headBottomY"] = head_bottom

    return result


def segment_frames(
    frame_paths: list[str],
    out_dir: str,
    threshold: float = DEFAULT_THRESHOLD,
    write_head: bool = True,
) -> list[dict]:
    return [segment_frame(path, out_dir, threshold, write_head) for path in frame_paths]
