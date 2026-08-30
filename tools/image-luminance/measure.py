"""Whole-frame relative luminance of generated images.

`docs/DECISION-image-config.md` records that the pictures are too dark to read
at a glance, and quantifies it as the share of the frame below a luminance of
0.05. That figure is what a prompt change has to move, so it needs a tool
rather than a one-off script: the before and the after have to be measured the
same way, and the after is measured in a later session than the before.

Luminance is `relative_luminance` from the CV sidecar — WCAG 2.1, the same
definition `edge_luminance` uses to choose a card frame colour. It is imported
rather than copied so the two cannot drift.

**The whole frame, not a ring.** `edge_luminance` measures the outermost 2% to
decide what a frame contrasts with; this measures every pixel, because the
complaint is about the picture as a whole.

Run it with the sidecar's own interpreter, which is where numpy and Pillow
live:

    tools/cv/.venv/bin/python tools/image-luminance/measure.py <image> [<image> ...]

Every cache entry names its file `image.jpg`, so a bare basename identifies
none of them. An argument may be given as `label=path` to carry the slot and
candidate id into the table instead.

Not part of `npm run check`: it needs the venv and a set of generated images,
neither of which a clean checkout has.
"""

from __future__ import annotations

import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "cv"))
from framopia_cv.edge_luminance import relative_luminance  # noqa: E402

"""The threshold the defect was quantified at. Below this a pixel reads as unlit."""
DARK_BELOW = 0.05


def measure(argument: str) -> dict:
    label, _, path = argument.rpartition("=")
    image_path = path if label else argument
    with Image.open(image_path) as original:
        rgb = np.asarray(original.convert("RGB"))
    luminance = relative_luminance(rgb)
    return {
        "path": image_path,
        "name": label or os.path.basename(image_path),
        "width": int(rgb.shape[1]),
        "height": int(rgb.shape[0]),
        "mean": float(luminance.mean()),
        "median": float(np.median(luminance)),
        "p90": float(np.percentile(luminance, 90)),
        "belowDark": float((luminance < DARK_BELOW).mean()),
    }


def main(argv: list[str]) -> int:
    args = argv[1:]
    out_json = None
    if "--json" in args:
        i = args.index("--json")
        out_json = args[i + 1]
        args = args[:i] + args[i + 2:]
    paths = args
    if not paths:
        print("usage: measure.py [--json <out>] <image> [<image> ...]", file=sys.stderr)
        return 1
    rows = [measure(p) for p in paths]
    width = max(len(r["name"]) for r in rows)
    print(f"{'image'.ljust(width)}  {'mean':>7}  {'median':>7}  {'p90':>7}  {'<0.05':>7}")
    for r in rows:
        print(
            f"{r['name'].ljust(width)}  {r['mean']:7.4f}  {r['median']:7.4f}  "
            f"{r['p90']:7.4f}  {r['belowDark'] * 100:6.1f}%"
        )
    means = [r["mean"] for r in rows]
    dark = [r["belowDark"] for r in rows]
    print(
        f"\n{len(rows)} images: mean luminance {sum(means) / len(means):.4f}, "
        f"mean share below {DARK_BELOW} {sum(dark) / len(dark) * 100:.1f}%"
    )
    if out_json:
        with open(out_json, "w", encoding="utf-8") as handle:
            json.dump(rows, handle, indent=1)
        print(f"\nwritten: {out_json}")
    else:
        print("\n" + json.dumps(rows, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
