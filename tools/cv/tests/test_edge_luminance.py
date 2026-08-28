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


def test_it_measures_the_subject_of_a_cutout(tmp_path):
    """A cut-out's surround is transparent, so what has to be judged is the
    subject — and by its lit part, not its median: a bottle with deep shadow and
    a bright highlight reads by the highlight."""
    pixels = np.zeros((200, 200, 4), dtype=np.uint8)
    # A subject that is 60% dark and 40% bright, so the 75th percentile falls
    # inside the bright part and the median inside the dark part.
    pixels[50:150, 50:150] = [10, 10, 10, 255]
    pixels[50:150, 110:150] = [240, 240, 240, 255]
    path = tmp_path / "cutout.png"
    Image.fromarray(pixels, mode="RGBA").save(path)

    result = edge_luminance(str(path))
    assert result["transparentFraction"] > 0.7
    assert result["subjectPixels"] == 100 * 100
    # The ring is transparent, so measuring it says nothing about the picture.
    assert result["meanLuminance"] == 0.0
    # The median follows the dark three-quarters; the lit figure does not.
    assert result["subjectMedianLuminance"] < 0.01
    assert result["subjectLitLuminance"] > 0.5


def test_a_whole_picture_has_no_subject_to_report(tmp_path):
    path = tmp_path / "whole.png"
    Image.fromarray(np.full((100, 100, 3), 40, dtype=np.uint8)).save(path)
    result = edge_luminance(str(path))
    assert result["transparentFraction"] == 0.0
    # Every pixel is opaque, so the subject is the whole picture.
    assert result["subjectPixels"] == 100 * 100
