"""A cut-out needs a ground of its own, or the card behind it shows through the
whole square and the border cannot be seen."""

import numpy as np
from PIL import Image

from framopia_cv.flatten_cutout import flatten_cutout


def _cutout(tmp_path):
    pixels = np.zeros((100, 100, 4), dtype=np.uint8)
    pixels[40:60, 40:60] = [255, 255, 255, 255]
    path = tmp_path / "cut.png"
    Image.fromarray(pixels, mode="RGBA").save(path)
    return path


def test_it_fills_the_transparent_ground(tmp_path):
    out = tmp_path / "flat.png"
    result = flatten_cutout(str(_cutout(tmp_path)), (26, 0, 0), str(out))

    flattened = Image.open(out)
    assert flattened.mode == "RGB"
    assert flattened.size == (100, 100)
    # The corner was transparent and is now the ground.
    assert flattened.getpixel((5, 5)) == (26, 0, 0)
    # The subject is untouched.
    assert flattened.getpixel((50, 50)) == (255, 255, 255)
    assert result["groundFraction"] > 0.9
    assert result["fillRgb"] == [26, 0, 0]


def test_it_leaves_the_cutout_alone(tmp_path):
    source = _cutout(tmp_path)
    before = source.read_bytes()
    flatten_cutout(str(source), (248, 246, 242), str(tmp_path / "flat.png"))
    assert source.read_bytes() == before


def test_an_opaque_picture_comes_through_unchanged(tmp_path):
    path = tmp_path / "whole.png"
    Image.fromarray(np.full((50, 50, 3), 90, dtype=np.uint8)).save(path)
    out = tmp_path / "flat.png"
    result = flatten_cutout(str(path), (26, 0, 0), str(out))
    assert result["groundFraction"] == 0.0
    assert Image.open(out).getpixel((5, 5)) == (90, 90, 90)
