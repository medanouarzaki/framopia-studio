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


def person_confidence(frame_path: str) -> np.ndarray:
    """Per-pixel probability that the pixel belongs to a person, as float 0-1."""
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

    person = np.zeros(masks[0].numpy_view().shape[:2], dtype=np.float64)
    for index, mask in enumerate(masks):
        if index == BACKGROUND_CATEGORY:
            continue
        person += np.asarray(mask.numpy_view(), dtype=np.float64).reshape(person.shape)
    return np.clip(person, 0.0, 1.0)


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


def segment_frame(frame_path: str, out_dir: str, threshold: float = DEFAULT_THRESHOLD) -> dict:
    confidence = person_confidence(frame_path)
    binary = confidence > threshold
    ratio, bbox = person_stats(binary)

    stem = Path(frame_path).stem
    directory = Path(out_dir)
    directory.mkdir(parents=True, exist_ok=True)
    confidence_path = directory / f"{stem}-confidence.png"
    binary_path = directory / f"{stem}-binary.png"

    Image.fromarray(np.round(confidence * 255).astype(np.uint8), mode="L").save(
        confidence_path, "PNG"
    )
    Image.fromarray((binary * 255).astype(np.uint8), mode="L").save(binary_path, "PNG")

    height, width = binary.shape
    return {
        "framePath": frame_path,
        "confidenceMaskPath": str(confidence_path),
        "binaryMaskPath": str(binary_path),
        "width": width,
        "height": height,
        "personPixelRatio": ratio,
        "bbox": bbox,
    }


def segment_frames(
    frame_paths: list[str], out_dir: str, threshold: float = DEFAULT_THRESHOLD
) -> list[dict]:
    return [segment_frame(path, out_dir, threshold) for path in frame_paths]
