"""Head-mask bounding boxes per sampled frame, as normalized frame fractions.

Standalone rather than a sidecar task: it reads masks already on disk and runs
no model, so it needs none of the sidecar's protocol. JSON on stdout, nothing
else, following the same rule as the sidecar itself.

Used by `npm run image-size` to answer how large an image could be without
touching the speaker's head.
"""
import glob
import json
import os
import sys

import numpy as np
from PIL import Image

# The head mask is a confidence map; 0.25 is HEAD_THRESHOLD from zones.py,
# where it was chosen so hair edges and jaw boundaries stay inside the head.
HEAD_THRESHOLD = 0.25


def main() -> None:
    masks_dir = sys.argv[1]
    # "head" (hair + face) or "face" (face skin alone). Block 7 session 8 made
    # the two selectable; the caller says which it wants.
    kind = sys.argv[2] if len(sys.argv) > 2 else "head"
    out = []
    for path in sorted(glob.glob(os.path.join(masks_dir, f"frame-*-{kind}.png"))):
        stem = os.path.basename(path)
        index = stem.split("-")[1]
        arr = np.array(Image.open(path).convert("L"))
        height, width = arr.shape
        ys, xs = np.nonzero(arr >= int(HEAD_THRESHOLD * 255))
        if len(xs) == 0:
            out.append({"index": index, "box": None})
            continue
        out.append(
            {
                "index": index,
                "box": [
                    float(xs.min()) / width,
                    float(ys.min()) / height,
                    float(xs.max() + 1) / width,
                    float(ys.max() + 1) / height,
                ],
            }
        )
    json.dump({"ok": True, "threshold": HEAD_THRESHOLD, "frames": out}, sys.stdout)


if __name__ == "__main__":
    main()
