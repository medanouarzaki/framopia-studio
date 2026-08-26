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
ZONE_COLOURS = {
    "top": (255, 220, 0),
    "left": (0, 220, 255),
    "right": (255, 140, 0),
    # Distinct from the white subtitle band it is drawn alongside.
    "torso": (80, 255, 80),
}

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


def short_edge_render(
    frame_path: str,
    mask_path: str,
    zones: list[dict],
    source_width: int,
    source_height: int,
    min_short_edge: float,
    out_path: str,
) -> str:
    """Each zone with its short edge dimensioned and labelled in source pixels.

    The constant is a judgement about whether an image placed in a rectangle
    reads as a design element, and that is not a question a table answers. The
    dimension line is drawn on the short edge specifically, because the images
    are square and the short edge is the only side that bounds what fits.
    """
    composed = tinted(frame_path, mask_path)
    draw = ImageDraw.Draw(composed)
    font = _font()

    for zone in zones:
        rect = zone["rect"]
        x0 = rect["x"] * composed.width
        y0 = rect["y"] * composed.height
        x1 = x0 + rect["w"] * composed.width
        y1 = y0 + rect["h"] * composed.height
        colour = ZONE_COLOURS.get(zone["kind"], (255, 255, 255))
        draw.rectangle([x0, y0, x1 - 1, y1 - 1], outline=colour, width=2)

        px_w = rect["w"] * source_width
        px_h = rect["h"] * source_height
        horizontal = px_w <= px_h
        short_px = min(px_w, px_h)

        # The dimension line sits on the short edge, mid-rectangle, with end
        # caps so it reads as a measurement rather than another rectangle.
        if horizontal:
            y = (y0 + y1) / 2
            draw.line([x0, y, x1, y], fill=colour, width=3)
            draw.line([x0, y - 8, x0, y + 8], fill=colour, width=3)
            draw.line([x1, y - 8, x1, y + 8], fill=colour, width=3)
            label_at = (x0 + 4, y + 10)
        else:
            x = (x0 + x1) / 2
            draw.line([x, y0, x, y1], fill=colour, width=3)
            draw.line([x - 8, y0, x + 8, y0], fill=colour, width=3)
            draw.line([x - 8, y1, x + 8, y1], fill=colour, width=3)
            label_at = (x + 10, (y0 + y1) / 2)

        aspect = source_height / source_width
        passes = min(rect["w"], rect["h"] * aspect) >= min_short_edge
        label = f"{zone['kind']} {short_px:.0f}px {'pass' if passes else 'FAIL'}"
        # A label anchored inside a zone near the frame edge runs off it; pull
        # it back so the number stays readable.
        text_width = draw.textlength(label, font=font)
        x = min(label_at[0], composed.width - text_width - 4)
        draw.text((max(2, x), label_at[1]), label, fill=colour, font=font)

    floor_px = min_short_edge * source_width
    draw.text(
        (6, 6),
        f"short edge floor {min_short_edge} of frame width = {floor_px:.0f}px "
        f"(source {source_width}x{source_height})",
        fill=(240, 240, 240),
        font=font,
    )
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    composed.save(out_path, "PNG")
    return out_path


# Distinct from ZONE_COLOURS so a placed image never reads as its zone.
PLACEMENT_COLOURS = [
    (255, 90, 90),
    (90, 255, 160),
    (120, 170, 255),
    (255, 210, 80),
    (220, 120, 255),
    (120, 240, 240),
]
SUBTITLE_BAND_COLOUR = (255, 255, 255)


def _draw_band(draw: ImageDraw.ImageDraw, band: dict, width: int, height: int, font) -> None:
    """The subtitle band, hatched rather than filled so the frame stays visible."""
    y0 = band["y"] * height
    y1 = (band["y"] + band["h"]) * height
    draw.rectangle([0, y0, width - 1, y1], outline=SUBTITLE_BAND_COLOUR, width=2)
    for x in range(0, width, 28):
        draw.line([x, y0, x + 14, y1], fill=(255, 255, 255), width=1)
    draw.text((6, y0 + 4), "subtitle band (provisional)", fill=SUBTITLE_BAND_COLOUR, font=font)


def _fill_rect(draw: ImageDraw.ImageDraw, rect: dict, width: int, height: int, colour, label, font):
    x0, y0 = rect["x"] * width, rect["y"] * height
    x1, y1 = x0 + rect["w"] * width, y0 + rect["h"] * height
    # A translucent fill would need a second layer; a dense hatch reads the
    # same way and keeps the frame underneath legible.
    for offset in range(0, int(x1 - x0) + int(y1 - y0), 12):
        draw.line([x0 + offset, y0, x0, y0 + offset], fill=colour, width=1)
    draw.rectangle([x0, y0, x1 - 1, y1 - 1], outline=colour, width=3)
    draw.text((x0 + 5, y0 + 5), label, fill=colour, font=font)


def placement_render(entry: dict, out_path: str) -> str:
    """One slot: its frame, its zone, the subtitle band and the placed square."""
    composed = tinted(entry["framePath"], entry["maskPath"])
    draw = ImageDraw.Draw(composed)
    font = _font()

    _draw_band(draw, entry["subtitleBand"], composed.width, composed.height, font)
    draw_zones(composed, [{"kind": entry["zoneKind"], "rect": entry["zoneRect"]}], width=2)
    _fill_rect(
        draw,
        entry["rect"],
        composed.width,
        composed.height,
        PLACEMENT_COLOURS[0],
        entry["label"],
        font,
    )
    draw.text((6, 6), entry["caption"], fill=(240, 240, 240), font=font)
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    composed.save(out_path, "PNG")
    return out_path


def placement_overview(entry: dict, out_path: str) -> str:
    """Every placed rect for a reel on one frame, so clustering is visible."""
    composed = tinted(entry["framePath"], entry["maskPath"])
    draw = ImageDraw.Draw(composed)
    font = _font()

    _draw_band(draw, entry["subtitleBand"], composed.width, composed.height, font)
    for index, placement in enumerate(entry["placements"]):
        colour = PLACEMENT_COLOURS[index % len(PLACEMENT_COLOURS)]
        _fill_rect(
            draw,
            placement["rect"],
            composed.width,
            composed.height,
            colour,
            placement["label"],
            font,
        )
    draw.text((6, 6), entry["caption"], fill=(240, 240, 240), font=font)
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    composed.save(out_path, "PNG")
    return out_path


# The head is tinted separately from the body so under-coverage is visible: an
# image over a chin is a defect, an image placed lower is a missed chance.
HEAD_TINT = (255, 230, 0)


def head_tinted(frame_path: str, body_mask: str, head_mask: str) -> Image.Image:
    """The frame with the body in TINT and the head region in HEAD_TINT."""
    composed = tinted(frame_path, body_mask)
    frame = np.asarray(composed, dtype=np.float64)
    with Image.open(head_mask) as handle:
        head = np.asarray(handle.convert("L"), dtype=np.float64) / 255.0
    alpha = ((head > 0.5) * 0.55)[:, :, None]
    blended = frame * (1.0 - alpha) + np.array(HEAD_TINT, dtype=np.float64) * alpha
    return Image.fromarray(np.round(blended).astype(np.uint8), mode="RGB")


def head_contact_sheet(frames: list[dict], out_path: str) -> str:
    """Every sampled frame with the head region picked out."""
    if not frames:
        raise ValueError("cannot build a contact sheet from no frames")

    first = head_tinted(frames[0]["framePath"], frames[0]["binaryMaskPath"], frames[0]["headMaskPath"])
    scale = CONTACT_CELL_WIDTH / first.width
    cell_height = round(first.height * scale)
    columns = min(CONTACT_COLUMNS, len(frames))
    rows = -(-len(frames) // columns)

    sheet = Image.new("RGB", (columns * CONTACT_CELL_WIDTH, rows * (cell_height + LABEL_HEIGHT)), (16, 16, 16))
    draw = ImageDraw.Draw(sheet)
    font = _font()
    for position, frame in enumerate(frames):
        cell = head_tinted(
            frame["framePath"], frame["binaryMaskPath"], frame["headMaskPath"]
        ).resize((CONTACT_CELL_WIDTH, cell_height), Image.LANCZOS)
        x = (position % columns) * CONTACT_CELL_WIDTH
        y = (position // columns) * (cell_height + LABEL_HEIGHT)
        sheet.paste(cell, (x, y))
        draw.text(
            (x + 4, y + cell_height + 2),
            f"{frame['index']}  {frame['headRatio']:.3f}  y{frame['headBottomY']:.2f}",
            fill=(235, 235, 235),
            font=font,
        )
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, "PNG")
    return out_path


BOTTOM_EXCLUSION_COLOUR = (150, 150, 150)


def torso_render(entry: dict) -> Image.Image:
    """One frame with the head tinted, the torso zone outlined, and both bounds drawn."""
    composed = head_tinted(entry["framePath"], entry["binaryMaskPath"], entry["headMaskPath"])
    draw = ImageDraw.Draw(composed)
    font = _font()

    _draw_band(draw, entry["subtitleBand"], composed.width, composed.height, font)
    y = entry["bottomExclusionY"] * composed.height
    draw.line([0, y, composed.width, y], fill=BOTTOM_EXCLUSION_COLOUR, width=2)
    draw.text((6, y + 3), "bottom exclusion", fill=BOTTOM_EXCLUSION_COLOUR, font=font)

    for zone in entry.get("zones", []):
        draw_zones(composed, [zone], width=3)
    return composed


def torso_contact_sheet(frames: list[dict], out_path: str) -> str:
    if not frames:
        raise ValueError("cannot build a contact sheet from no frames")
    first = torso_render(frames[0])
    scale = CONTACT_CELL_WIDTH / first.width
    cell_height = round(first.height * scale)
    columns = min(CONTACT_COLUMNS, len(frames))
    rows = -(-len(frames) // columns)

    sheet = Image.new("RGB", (columns * CONTACT_CELL_WIDTH, rows * (cell_height + LABEL_HEIGHT)), (16, 16, 16))
    draw = ImageDraw.Draw(sheet)
    font = _font()
    for position, frame in enumerate(frames):
        cell = torso_render(frame).resize((CONTACT_CELL_WIDTH, cell_height), Image.LANCZOS)
        x = (position % columns) * CONTACT_CELL_WIDTH
        y = (position // columns) * (cell_height + LABEL_HEIGHT)
        sheet.paste(cell, (x, y))
        draw.text((x + 4, y + cell_height + 2), frame["label"], fill=(235, 235, 235), font=font)
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, "PNG")
    return out_path
