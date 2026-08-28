# The watermark inset

Measured 2026-08-29. Read-only; **no default was changed.** The mark sits
exactly where it sat, and the two axes are now settable independently so the
user can rule on the number.

## What it is today

The mark is **216 × 242 px** on a 2160 × 3840 frame, at 11.2266% of the
1924 × 2154 artwork.

| | fraction | pixels |
|---|---|---:|
| from the side edge | 0.030000 of frame **width** | **64.8** |
| from the top or bottom edge | 0.053333 of frame **height** | **204.8** |

**They are unequal because one constant was used for both axes.**
`WATERMARK_MARGIN` was 0.03 of frame width, and the vertical placement
multiplied it by the frame's aspect ratio (3840/2160 = 1.7778) instead of
dividing — so the same "0.03" became 205 px vertically and 65 px horizontally.
Equal insets need the vertical fraction to be **0.03 ÷ 1.7778 = 0.016875** of
height, not 0.03 × 1.7778.

## What it could be

`WATERMARK_MARGIN_X` is a fraction of frame width, `WATERMARK_MARGIN_Y` a
fraction of frame height. For an inset that is equal on both axes:

| inset | `WATERMARK_MARGIN_X` | `WATERMARK_MARGIN_Y` | pixels each side |
|---|---:|---:|---:|
| today, horizontally | 0.030000 | *(0.053333)* | 65 / **205** |
| tight | 0.030000 | 0.016875 | **65** |
| a little more air | 0.040000 | 0.022500 | **86** |
| noticeably inset | 0.050000 | 0.028125 | **108** |
| generous | 0.060000 | 0.033750 | **130** |
| very generous | 0.080000 | 0.045000 | **173** |

The user says the mark sits too close to the edge. Since the vertical inset is
already 205 px and the horizontal is 65, **the complaint is about the
horizontal one** — the mark is nearly four times closer to the side than to the
top. Any row above sets both to the same number; **0.05 (108 px) is the one I
would try first**, close to splitting the difference between today's two values
while staying clear of a 216 px mark reading as centred.

## Nothing changed

`WATERMARK_MARGIN_Y` is defined as `0.03 × FRAME_ASPECT`, which is precisely
what the single constant produced, and a test asserts both pixel figures. The
corner-selection logic, the width fraction, the duration and the gain are all
untouched.
