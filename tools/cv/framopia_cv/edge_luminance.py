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


def relative_luminance(rgb: np.ndarray) -> np.ndarray:
    """WCAG 2.1 relative luminance from 8-bit sRGB."""
    c = np.asarray(rgb, dtype=float) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]


def edge_luminance(image_path: str) -> dict:
    image = Image.open(image_path).convert("RGB")
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
    return {
        "imagePath": image_path,
        "width": int(width),
        "height": int(height),
        "bandPx": int(band),
        "meanLuminance": float(luminance.mean()),
        "p90Luminance": float(np.percentile(luminance, 90)),
    }
