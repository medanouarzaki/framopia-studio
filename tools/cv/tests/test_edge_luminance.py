"""The card frame's colour is derived from this measurement."""

import numpy as np
from PIL import Image

from framopia_cv.edge_luminance import EDGE_RING_FRACTION, edge_luminance, relative_luminance


def test_relative_luminance_matches_the_srgb_definition():
    assert relative_luminance(np.array([0, 0, 0])) == 0.0
    assert relative_luminance(np.array([255, 255, 255])) == 1.0


def test_it_reads_the_ring_and_not_the_middle(tmp_path):
    """A dark border round a white centre must read as dark, or the frame
    colour would be chosen from a part of the picture the frame never touches."""
    pixels = np.full((200, 200, 3), 255, dtype=np.uint8)
    pixels[:8] = 0
    pixels[-8:] = 0
    pixels[:, :8] = 0
    pixels[:, -8:] = 0
    path = tmp_path / "bordered.png"
    Image.fromarray(pixels).save(path)

    result = edge_luminance(str(path))
    assert result["bandPx"] == round(EDGE_RING_FRACTION * 200)
    assert result["meanLuminance"] < 0.01


def test_it_reports_the_band_and_the_size(tmp_path):
    path = tmp_path / "flat.png"
    Image.fromarray(np.full((2048, 2048, 3), 255, dtype=np.uint8)).save(path)
    result = edge_luminance(str(path))
    assert (result["width"], result["height"], result["bandPx"]) == (2048, 2048, 41)
    assert result["meanLuminance"] == 1.0
