"""Bounding box of the actual content inside a generated image or its cutout.

Standalone rather than a sidecar task: it reads files already on disk and runs
no model, so it needs none of the sidecar's protocol. JSON on stdin (a list of
paths), JSON on stdout, nothing else.

Two definitions, because the two kinds of file carry content differently:

  * **cutout** — non-zero alpha. The matte is what the quality gate already
    accepted as the subject, so nothing new is being decided here.
  * **original** — colour far enough from the mode's background `#1A0000`.
    The mode's own style fragment says the subject is "lit against #1A0000",
    so the ground is a known colour rather than a guess. The threshold is on
    the largest per-channel difference and is reported alongside the box, with
    a second value measured too, because a single threshold on a deliberately
    dark image is exactly the kind of number that should not go unqualified.
"""
import json
import sys

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

BACKGROUND = np.array([0x1A, 0x00, 0x00], dtype=np.int16)
THRESHOLDS = (16, 24, 40)


def box(mask: np.ndarray) -> dict | None:
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return None
    return {
        "x": int(xs.min()),
        "y": int(ys.min()),
        "w": int(xs.max() - xs.min() + 1),
        "h": int(ys.max() - ys.min() + 1),
        "pixels": int(mask.sum()),
    }


def main() -> None:
    request = json.load(sys.stdin)
    out = []
    for item in request["images"]:
        path, kind = item["path"], item["kind"]
        image = Image.open(path)
        if kind == "cutout":
            arr = np.array(image.convert("RGBA"))
            height, width = arr.shape[:2]
            boxes = {"alpha": box(arr[:, :, 3] > 0)}
        else:
            arr = np.array(image.convert("RGB")).astype(np.int16)
            height, width = arr.shape[:2]
            distance = np.abs(arr - BACKGROUND).max(axis=2)
            boxes = {f"t{t}": box(distance > t) for t in THRESHOLDS}
        out.append(
            {
                "path": path,
                "kind": kind,
                "width": int(width),
                "height": int(height),
                "boxes": boxes,
            }
        )
    json.dump({"ok": True, "thresholds": list(THRESHOLDS), "images": out}, sys.stdout)


if __name__ == "__main__":
    main()
