"""Debug renders of a segmentation pass.

A mask is judged by eye before it is judged by a metric, and a number in a
report cannot show a mask that has eaten an ear. These are the only artefacts
of the sidecar that contain footage, which is why they are written under
benchmarks/results/ and never committed.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Magenta reads against skin, hair and the dark backgrounds this footage uses;
# green does not separate from a lit background as reliably.
TINT = (255, 0, 128)
TINT_OPACITY = 0.4

CONTACT_COLUMNS = 8
CONTACT_CELL_WIDTH = 180
LABEL_HEIGHT = 18

# One colour per zone kind, all distinct from the mask tint so an outline is
# never mistaken for the mask underneath it.
ZONE_COLOURS = {"top": (255, 220, 0), "left": (0, 220, 255), "right": (255, 140, 0)}

# Kept and dropped components in the component render. Red is the one a reader
# has to check: it is what the floor removes from the person footprint.
KEPT_COLOUR = (0, 230, 120)
DROPPED_COLOUR = (255, 60, 60)


def _font():
    try:
        return ImageFont.load_default(size=13)
    except TypeError:  # Pillow older than the size argument
        return ImageFont.load_default()


def tinted(frame_path: str, mask_path: str) -> Image.Image:
    """The frame with its person mask laid over it at TINT_OPACITY."""
    with Image.open(frame_path) as handle:
        frame = np.asarray(handle.convert("RGB"), dtype=np.float64)
    with Image.open(mask_path) as handle:
        mask = np.asarray(handle.convert("L"), dtype=np.float64) / 255.0

    if mask.shape != frame.shape[:2]:
        raise ValueError(
            f"mask {mask.shape} does not match frame {frame.shape[:2]}: {mask_path}"
        )

    alpha = (mask * TINT_OPACITY)[:, :, None]
    blended = frame * (1.0 - alpha) + np.array(TINT, dtype=np.float64) * alpha
    return Image.fromarray(np.round(blended).astype(np.uint8), mode="RGB")


def draw_zones(image: Image.Image, zones: list[dict], width: int = 2) -> Image.Image:
    """Outline and label each zone rectangle on a frame-sized image."""
    draw = ImageDraw.Draw(image)
    font = _font()
    for zone in zones:
        rect = zone["rect"]
        x0 = rect["x"] * image.width
        y0 = rect["y"] * image.height
        x1 = x0 + rect["w"] * image.width
        y1 = y0 + rect["h"] * image.height
        colour = ZONE_COLOURS.get(zone["kind"], (255, 255, 255))
        draw.rectangle([x0, y0, x1 - 1, y1 - 1], outline=colour, width=width)
        draw.text((x0 + 3, y0 + 2), zone["kind"], fill=colour, font=font)
    return image


def contact_sheet(frames: list[dict], out_path: str) -> str:
    """Every sampled frame of a reel, tinted, in a labelled grid.

    A frame may carry a `zones` list, in which case each rectangle is drawn on
    the cell before it is scaled down, so the outline scales with the frame
    rather than becoming a hairline.
    """
    if not frames:
        raise ValueError("cannot build a contact sheet from no frames")

    first = tinted(frames[0]["framePath"], frames[0]["binaryMaskPath"])
    scale = CONTACT_CELL_WIDTH / first.width
    cell_height = round(first.height * scale)
    columns = min(CONTACT_COLUMNS, len(frames))
    rows = -(-len(frames) // columns)

    sheet = Image.new(
        "RGB",
        (columns * CONTACT_CELL_WIDTH, rows * (cell_height + LABEL_HEIGHT)),
        (16, 16, 16),
    )
    draw = ImageDraw.Draw(sheet)
    font = _font()

    for position, frame in enumerate(frames):
        composed = tinted(frame["framePath"], frame["binaryMaskPath"])
        if frame.get("zones"):
            draw_zones(composed, frame["zones"], width=4)
        cell = composed.resize((CONTACT_CELL_WIDTH, cell_height), Image.LANCZOS)
        x = (position % columns) * CONTACT_CELL_WIDTH
        y = (position // columns) * (cell_height + LABEL_HEIGHT)
        sheet.paste(cell, (x, y))
        draw.text(
            (x + 4, y + cell_height + 2),
            f"{frame['index']}  {frame['timeS']:.3f}s",
            fill=(235, 235, 235),
            font=font,
        )

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, "PNG")
    return out_path


def evenly_spaced(count: int, wanted: int) -> list[int]:
    """`wanted` indices spread across `count` items, first and last included."""
    if count <= wanted:
        return list(range(count))
    return [round(i * (count - 1) / (wanted - 1)) for i in range(wanted)]


def close_ups(frames: list[dict], out_dir: str, prefix: str, wanted: int = 6) -> list[str]:
    """Full-working-resolution overlays, for looking at an edge rather than a shape."""
    directory = Path(out_dir)
    directory.mkdir(parents=True, exist_ok=True)
    written = []
    for position in evenly_spaced(len(frames), wanted):
        frame = frames[position]
        out_path = directory / f"{prefix}-frame-{frame['index']}.png"
        composed = tinted(frame["framePath"], frame["binaryMaskPath"])
        if frame.get("zones"):
            draw_zones(composed, frame["zones"])
        composed.save(out_path, "PNG")
        written.append(str(out_path))
    return written


TIMELINE_WIDTH = 1200
TIMELINE_ROW_HEIGHT = 46
TIMELINE_LEFT = 70


def timeline(zones: list[dict], duration_s: float, out_path: str) -> str:
    """A strip per zone kind showing when each zone is valid, on a seconds axis."""
    kinds = ("top", "left", "right")
    height = TIMELINE_ROW_HEIGHT * len(kinds) + 34
    image = Image.new("RGB", (TIMELINE_WIDTH, height), (18, 18, 18))
    draw = ImageDraw.Draw(image)
    font = _font()
    span = TIMELINE_WIDTH - TIMELINE_LEFT - 20
    scale = span / duration_s if duration_s > 0 else 0.0

    for row, kind in enumerate(kinds):
        y = row * TIMELINE_ROW_HEIGHT + 6
        draw.text((8, y + 12), kind, fill=(220, 220, 220), font=font)
        draw.rectangle(
            [TIMELINE_LEFT, y, TIMELINE_LEFT + span, y + TIMELINE_ROW_HEIGHT - 14],
            fill=(38, 38, 38),
        )
        for zone in zones:
            if zone["kind"] != kind:
                continue
            for start, end in zone["valid"]:
                x0 = TIMELINE_LEFT + start * scale
                x1 = TIMELINE_LEFT + end * scale
                draw.rectangle(
                    [x0, y, max(x1, x0 + 1), y + TIMELINE_ROW_HEIGHT - 14],
                    fill=ZONE_COLOURS[kind],
                )

    axis_y = TIMELINE_ROW_HEIGHT * len(kinds) + 8
    draw.line([TIMELINE_LEFT, axis_y, TIMELINE_LEFT + span, axis_y], fill=(120, 120, 120))
    step = 5 if duration_s > 12 else 1
    second = 0
    while second <= duration_s:
        x = TIMELINE_LEFT + second * scale
        draw.line([x, axis_y, x, axis_y + 5], fill=(120, 120, 120))
        draw.text((x - 6, axis_y + 8), f"{second}s", fill=(190, 190, 190), font=font)
        second += step

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    image.save(out_path, "PNG")
    return out_path


def component_render(entry: dict, out_path: str) -> str:
    """One frame with every mask component outlined, kept against dropped.

    This is the check on the component floor. The histogram says how many
    components a floor removes; only the picture says whether any of them was
    a hand.
    """
    composed = tinted(entry["framePath"], entry["maskPath"])
    draw = ImageDraw.Draw(composed)
    font = _font()
    for component in entry["components"]:
        box = component["box"]
        colour = DROPPED_COLOUR if component["dropped"] else KEPT_COLOUR
        draw.rectangle(
            [box["x0"] - 2, box["y0"] - 2, box["x1"] + 2, box["y1"] + 2],
            outline=colour,
            width=2,
        )
        label = f"{component['areaFrameFraction']:.6f}"
        draw.text((box["x0"], max(0, box["y0"] - 15)), label, fill=colour, font=font)
    draw.text((6, 6), entry["caption"], fill=(240, 240, 240), font=font)
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    composed.save(out_path, "PNG")
    return out_path
