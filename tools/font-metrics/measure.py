"""Ink extents of a face, in font units, from the font file's own outlines.

`FONT_METRICS` in `core/src/typography.ts` is what `SUBTITLE_BAND` is derived
from, and until now it held two faces whose numbers were measured by hand in
Block 6 session 4 and never committed as a repeatable derivation. Block 9
session 11 needed a third face and could not add one without either typing a
number or rebuilding the measurement.

**This reproduces the two committed faces before it is trusted on a third.**
Run with no arguments and it measures Inter, Almarai and Cormorant and says
whether the first two still come out at the values the code carries. A tool that
cannot reproduce a known answer has no business producing an unknown one.

Real glyph bounding boxes through a pen, not OS/2 table values: `usWinAscent`
describes the tallest glyph anywhere in the font, including ones this project
will never set. Composites resolve because the pen walks them.

fontTools lives in `tools/cv/.venv` and is not in its `requirements.txt` — it is
an incidental of the CV stack. That is recorded rather than relied on: this tool
is run by hand when a face is added, not by `npm run check`.
"""

import json
import sys
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

FONTS = Path.home() / "Library" / "Fonts"

# PROJECT_SPEC §5's accented French plus printable ASCII. The Arabic repertoire
# is the one Block 6 session 4 settled: every unvocalized letter in all four
# positional forms is reached through the font's own glyph set rather than by
# listing codepoints, because a positional form has no codepoint of its own.
LATIN = [chr(c) for c in range(0x20, 0x7F)] + list("àâçéèêëîïôùûüÿœæÀÂÇÉÈÊËÎÏÔÙÛÜŸŒÆ")


def ink_extent(font: TTFont, characters=None):
    """Max ink above and below the baseline, in font units.

    With no character list, every glyph in the font is measured — which is what
    an Arabic face needs, because its positional forms are glyphs without
    codepoints of their own.
    """
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    if characters is None:
        names = list(glyph_set.keys())
    else:
        names = [cmap[ord(ch)] for ch in characters if ord(ch) in cmap]

    top = None
    bottom = None
    for name in names:
        pen = BoundsPen(glyph_set)
        try:
            glyph_set[name].draw(pen)
        except Exception:
            continue
        if pen.bounds is None:
            continue
        _, y_min, _, y_max = pen.bounds
        top = y_max if top is None else max(top, y_max)
        bottom = y_min if bottom is None else min(bottom, y_min)

    if top is None or bottom is None:
        raise SystemExit("no glyph in this font produced a bounding box")
    return {
        "unitsPerEm": font["head"].unitsPerEm,
        "ascent": round(top),
        "descent": round(-bottom),
    }


def load(path: Path, axes=None) -> TTFont:
    font = TTFont(path)
    if axes and "fvar" in font:
        font = instantiateVariableFont(font, axes, inplace=False, updateFontNames=False)
    return font


def main() -> int:
    faces = {
        # Semi Bold is an instance of Inter's variable weight axis.
        "latin": {
            "file": FONTS / "Inter-VariableFont_opsz,wght.ttf",
            "axes": {"wght": 600},
            "characters": LATIN,
            "committed": {"unitsPerEm": 2048, "ascent": 1970, "descent": 480},
        },
        "arabic": {
            "file": FONTS / "Almarai-Bold.ttf",
            "axes": None,
            "characters": None,
            "committed": {"unitsPerEm": 1000, "ascent": 1100, "descent": 427},
        },
        # CormorantGaramondItalic-SemiBoldItalic is an instance of the italic
        # family's weight axis, not of the upright one.
        "emphasis": {
            "file": FONTS / "CormorantGaramond-Italic-VariableFont_wght.ttf",
            "axes": {"wght": 600},
            "characters": LATIN,
            "committed": None,
        },
    }

    out = {}
    ok = True
    for role, spec in faces.items():
        path = spec["file"]
        if not path.is_file():
            print(f"{role}: {path} is not on this machine", file=sys.stderr)
            ok = False
            continue
        measured = ink_extent(load(path, spec["axes"]), spec["characters"])
        out[role] = {"file": path.name, **measured}
        committed = spec["committed"]
        if committed is None:
            print(f"{role:9s} {measured}  (no committed value to check against)")
            continue
        same = measured == committed
        if not same:
            ok = False
        print(f"{role:9s} {measured}  committed {committed}  {'MATCHES' if same else 'DIFFERS'}")

    print()
    print(json.dumps(out, indent=2))
    if not ok:
        print(
            "\nthis tool does not reproduce the committed values, so its figure for a "
            "new face cannot be trusted",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
