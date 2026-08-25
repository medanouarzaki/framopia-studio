"""Background removal, ARCHITECTURE §1.4 and §5.4.

rembg with BiRefNet-general. The alpha-matting post-pass is optional and off
by default: it is slow and it softens edges, and whether it helps on this
footage is a question for the corpus rather than an assumption.
"""

from __future__ import annotations

import io
from functools import lru_cache

import numpy as np
from PIL import Image

MODEL_NAME = "birefnet-general"


@lru_cache(maxsize=1)
def _session():
    from rembg import new_session

    return new_session(MODEL_NAME)


def remove_background(
    image_path: str,
    alpha_matting: bool = False,
    post_process_mask: bool = False,
) -> Image.Image:
    """Cut the background out.

    `post_process_mask` defaults **off**, and that is load-bearing. rembg's
    post-pass thresholds the matte to hard edges: it returns an alpha channel
    with literally zero partial values, which reads as a flawless cutout to
    three of the four §5.4 metrics because they measure the transition band
    that the post-pass has just destroyed. Measured on the Block 4 corpus,
    the same image scores edge_halo 0.0 with the post-pass and 0.0749 without
    it. A gate fed the post-passed matte is not gating.

    `alpha_matting` is a separate, slower refinement and stays off by default:
    whether it helps on this footage is a question for a corpus, not an
    assumption.
    """
    from rembg import remove

    with open(image_path, "rb") as handle:
        source = handle.read()

    output = remove(
        source,
        session=_session(),
        alpha_matting=alpha_matting,
        post_process_mask=post_process_mask,
    )
    return Image.open(io.BytesIO(output)).convert("RGBA")


def alpha_of(image: Image.Image) -> np.ndarray:
    return np.asarray(image.getchannel("A"), dtype=np.float64) / 255.0


def original_luminance(image_path: str) -> np.ndarray:
    """Rec. 709 luminance of the source image, for the halo comparison.

    Read from the file rather than from the cutout's own RGB: the remover may
    premultiply or otherwise touch colour where alpha is partial, which is
    exactly the region the halo metric looks at.
    """
    from .metrics import luminance_of

    with Image.open(image_path) as handle:
        return luminance_of(np.asarray(handle.convert("RGB"), dtype=np.float64))
