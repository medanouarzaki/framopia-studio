"""Composite a cut-out over a solid colour, so it has a ground of its own.

`img_float` has two layers: the picture, and a card behind it that shows as a
40 px border. For a whole picture that reads as a frame — the border sits
against the picture. For a cut-out the picture is transparent, so the card shows
through the whole square and **the frame and the fill become the same layer**;
the border cannot be seen because there is nothing else in the square.

Giving the cut-out its own ground puts the picture back in the middle: the
subject sits on the fill, the card shows around it, and the border reads exactly
as it does on a whole picture. Nothing about the template changes.
"""

from __future__ import annotations

import numpy as np
from PIL import Image


def flatten_cutout(cutout_path: str, rgb: tuple[int, int, int], out_path: str) -> dict:
    image = Image.open(cutout_path).convert("RGBA")
    ground = Image.new("RGBA", image.size, (int(rgb[0]), int(rgb[1]), int(rgb[2]), 255))
    flattened = Image.alpha_composite(ground, image).convert("RGB")
    flattened.save(out_path, "PNG")

    alpha = np.asarray(image)[..., 3]
    return {
        "cutoutPath": cutout_path,
        "outPath": out_path,
        "width": image.width,
        "height": image.height,
        "fillRgb": [int(rgb[0]), int(rgb[1]), int(rgb[2])],
        # How much of the result is the ground rather than the subject.
        "groundFraction": float((alpha <= 200).mean()),
    }
