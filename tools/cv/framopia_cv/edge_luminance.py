"""Mean relative luminance of an image's outermost ring.

The card frame the builder draws around a generated image is only a frame if it
can be told apart from the picture's own edge. That is a contrast question, and
contrast is defined on relative luminance, so the picture's edge has to be
measured before a frame colour can be chosen.

The ring is the outermost `EDGE_RING_FRACTION` of the longer side on all four
sides. **CHOSEN, NOT MEASURED**: it has to be narrow enough to describe the
boundary rather than the picture, and wide enough not to be decided by a single
row of compression artifacts. At 2048 px it is 41 px, against a frame that is
40 px of comp space.
"""

from __future__ import annotations

import numpy as np
from PIL import Image

EDGE_RING_FRACTION = 0.02

"""Above this alpha a pixel is the subject rather than its transparent surround."""
SUBJECT_ALPHA = 200

"""
Which part of the subject the frame has to differ from.

**CHOSEN, NOT MEASURED**, the 75th percentile. A subject is perceived by its lit
surfaces, and `vitasilk`'s `img002-c1` runs from 0.006 to 0.891 across its own
pixels — a bottle with both deep shadow and bright highlight. Judging by the
median picks a frame the lit half disappears into, which is what the user saw.
"""
SUBJECT_LIT_PERCENTILE = 75


def relative_luminance(rgb: np.ndarray) -> np.ndarray:
    """WCAG 2.1 relative luminance from 8-bit sRGB."""
    c = np.asarray(rgb, dtype=float) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]


def edge_luminance(image_path: str) -> dict:
    original = Image.open(image_path)
    rgba = np.asarray(original.convert("RGBA"))
    image = original.convert("RGB")
    pixels = np.asarray(image)
    height, width = pixels.shape[:2]
    band = max(1, round(EDGE_RING_FRACTION * max(height, width)))
    ring = np.concatenate(
        [
            pixels[:band].reshape(-1, 3),
            pixels[-band:].reshape(-1, 3),
            pixels[:, :band].reshape(-1, 3),
            pixels[:, -band:].reshape(-1, 3),
        ]
    )
    luminance = relative_luminance(ring)

    """
    A cut-out has no background of its own: the ring is transparent, so what
    shows behind the subject is whatever the frame is painted. Measuring the
    ring there reads transparency as black and answers a question nobody asked.
    What has to be judged instead is the subject, and a subject is read by its
    **lit** surfaces — so the figure is a high percentile rather than the mean,
    which a large shadow region would otherwise drag down.
    """
    alpha = rgba[..., 3]
    subject = rgba[alpha > SUBJECT_ALPHA][..., :3]
    subject_luminance = relative_luminance(subject) if subject.size else None

    return {
        "imagePath": image_path,
        "width": int(width),
        "height": int(height),
        "bandPx": int(band),
        "meanLuminance": float(luminance.mean()),
        "p90Luminance": float(np.percentile(luminance, 90)),
        "transparentFraction": float((alpha <= SUBJECT_ALPHA).mean()),
        "subjectPixels": int(subject.shape[0]),
        "subjectLitLuminance": (
            None if subject_luminance is None
            else float(np.percentile(subject_luminance, SUBJECT_LIT_PERCENTILE))
        ),
        "subjectMedianLuminance": (
            None if subject_luminance is None else float(np.median(subject_luminance))
        ),
    }
