"""Debug renders of a segmentation pass.

A mask is judged by eye before it is judged by a metric, and a number in a
report cannot show a mask that has eaten an ear. These are the only artefacts
of the sidecar that contain footage, which is why they are written under
benchmarks/results/ and never committed.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Magenta reads against skin, hair and the dark backgrounds this footage uses;
# green does not separate from a lit background as reliably.
TINT = (255, 0, 128)
TINT_OPACITY = 0.4

CONTACT_COLUMNS = 8
CONTACT_CELL_WIDTH = 180
LABEL_HEIGHT = 18


def _font():
    try:
        return ImageFont.load_default(size=13)
    except TypeError:  # Pillow older than the size argument
        return ImageFont.load_default()


def tinted(frame_path: str, mask_path: str) -> Image.Image:
    """The frame with its person mask laid over it at TINT_OPACITY."""
    with Image.open(frame_path) as handle:
        frame = np.asarray(handle.convert("RGB"), dtype=np.float64)
    with Image.open(mask_path) as handle:
        mask = np.asarray(handle.convert("L"), dtype=np.float64) / 255.0

    if mask.shape != frame.shape[:2]:
        raise ValueError(
            f"mask {mask.shape} does not match frame {frame.shape[:2]}: {mask_path}"
        )

    alpha = (mask * TINT_OPACITY)[:, :, None]
    blended = frame * (1.0 - alpha) + np.array(TINT, dtype=np.float64) * alpha
    return Image.fromarray(np.round(blended).astype(np.uint8), mode="RGB")


def contact_sheet(frames: list[dict], out_path: str) -> str:
    """Every sampled frame of a reel, tinted, in a labelled grid."""
    if not frames:
        raise ValueError("cannot build a contact sheet from no frames")

    first = tinted(frames[0]["framePath"], frames[0]["binaryMaskPath"])
    scale = CONTACT_CELL_WIDTH / first.width
    cell_height = round(first.height * scale)
    columns = min(CONTACT_COLUMNS, len(frames))
    rows = -(-len(frames) // columns)

    sheet = Image.new(
        "RGB",
        (columns * CONTACT_CELL_WIDTH, rows * (cell_height + LABEL_HEIGHT)),
        (16, 16, 16),
    )
    draw = ImageDraw.Draw(sheet)
    font = _font()

    for position, frame in enumerate(frames):
        cell = tinted(frame["framePath"], frame["binaryMaskPath"]).resize(
            (CONTACT_CELL_WIDTH, cell_height), Image.LANCZOS
        )
        x = (position % columns) * CONTACT_CELL_WIDTH
        y = (position // columns) * (cell_height + LABEL_HEIGHT)
        sheet.paste(cell, (x, y))
        draw.text(
            (x + 4, y + cell_height + 2),
            f"{frame['index']}  {frame['timeS']:.3f}s",
            fill=(235, 235, 235),
            font=font,
        )

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, "PNG")
    return out_path


def evenly_spaced(count: int, wanted: int) -> list[int]:
    """`wanted` indices spread across `count` items, first and last included."""
    if count <= wanted:
        return list(range(count))
    return [round(i * (count - 1) / (wanted - 1)) for i in range(wanted)]


def close_ups(frames: list[dict], out_dir: str, prefix: str, wanted: int = 6) -> list[str]:
    """Full-working-resolution overlays, for looking at an edge rather than a shape."""
    directory = Path(out_dir)
    directory.mkdir(parents=True, exist_ok=True)
    written = []
    for position in evenly_spaced(len(frames), wanted):
        frame = frames[position]
        out_path = directory / f"{prefix}-frame-{frame['index']}.png"
        tinted(frame["framePath"], frame["binaryMaskPath"]).save(out_path, "PNG")
        written.append(str(out_path))
    return written
