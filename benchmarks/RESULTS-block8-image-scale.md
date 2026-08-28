# imageScale 1.4: the corner cannot hold it

Measured 2026-08-28, `npm run top-left [-- --mode k2-syndicalia]`. Free, local,
read-only.

## Per slot

`imageScale` is a multiple of the largest square that clears the speaker's face
in the top-left corner. K2 asks for **1.4**.

| reel | slot | as built | asked for | placed | clamped |
|---|---|---:|---:|---:|---|
| test-1 | img001 | 787 px | 1102 | 787 | yes |
| test-1 | img002 | 759 px | 1062 | 759 | yes |
| test-1 | img003 | 778 px | 1090 | 778 | yes |
| test-1 | img004 | 763 px | 1069 | 763 | yes |
| vitasilk | img001 | 749 px | 1048 | 749 | yes |
| vitasilk | img002 | 801 px | 1122 | 801 | yes |
| vitasilk | img003 | 765 px | 1071 | 765 | yes |
| vitasilk | img004 | 818 px | 1145 | 818 | yes |
| vitasilk | img005 | 794 px | 1112 | 794 | yes |

**Nine of nine clamped. Nothing grew, and nothing overlaps the face or leaves
the frame.** The other three reels have no image slots planned.

## Why

The top-left rule already takes **the largest square that clears the face**.
There is no slack above it to spend: `imageScale` above 1.0 is bounded by the
same face and frame constraints that shaped the square, and the request is
refused rather than granted over the speaker.

The two constants that could be spent are `TOP_LEFT_MARGIN` (0.03 of frame
width, **65 px**) and `HEAD_CLEARANCE` (0.04, **86 px**) — **151 px between
them**, against the **~300 px** a 40% increase asks for on a 750–820 px square.
**Spending both to zero does not reach 1.4**, and spending `HEAD_CLEARANCE` puts
the picture against the face mask itself.

## What is left

Making the images bigger is a placement ruling, not a constant:

- **Move them off the corner.** The corner is bounded by the face because the
  face is beside it. A slot placed where the speaker is not would be bounded by
  the frame alone, where the same rule yields far more.
- **Let an image overlap the speaker's body.** Block 5 built torso zones for
  exactly this and Block 6 retired them when the measured subtitle band left
  71–295 px where 324 was needed. The band is derived from the anchor; moving
  the anchor is the edit that reopens it.
- **Accept the corner's size.** The frame colour derived this session is the
  other half of "the images are hard to see", and it costs nothing in size.

**Nothing here was decided.** The mode value is in place and honoured wherever
the geometry allows it, so a client asking for *less* is served today and a
client asking for more is told what stopped it.
