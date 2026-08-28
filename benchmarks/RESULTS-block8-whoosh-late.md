# Why the whoosh is late

Measured 2026-08-29, read-only. No plan was written by this measurement and
After Effects was not contacted; every figure comes from the plans, the audit
and `assets/sfx/sfx.json` on disk.

The user rebuilt `vitasilk` and heard the whooshes arrive after the image —
"clearly separate", a beat behind rather than a frame or two. Three candidates
were put to the evidence.

## (a) The clamp — TRUE, and it is the cause

Every whoosh in the corpus, with its element's start, its derived in-point, and
how late its anchor lands:

| reel | slot | template | element start | in-point | anchor at | late by | frames |
|---|---|---|---:|---:|---:|---:|---:|
| test-1 | img001 | img_float | 0.0990 | 0.0000 | 0.6913 | **0.4671** | **14.00** |
| test-1 | img002 | img_slide_left | 4.5990 | 4.0374 | 4.7286 | 0 | 0 |
| test-1 | img003 | img_float | 10.9390 | 10.3770 | 11.0683 | 0 | 0 |
| test-1 | img004 | img_slide_left | 19.7190 | 19.1525 | 19.8437 | 0 | 0 |
| vitasilk | img001 | img_float | 0.0990 | 0.0000 | 0.6913 | **0.4671** | **14.00** |
| vitasilk | img002 | img_slide_left | 6.2590 | 5.7057 | 6.3970 | 0 | 0 |
| vitasilk | img003 | img_float | 11.6190 | 11.0777 | 11.7690 | 0 | 0 |
| vitasilk | img004 | img_slide_left | 16.9400 | 16.3830 | 17.0743 | 0 | 0 |
| vitasilk | img005 | img_float | 20.0000 | 19.4528 | 20.1440 | 0 | 0 |

**7 of 9 whooshes are on time. 2 are late, by 14 frames — 0.467 s.** Both are
`img001`, the first image in the reel, and on `vitasilk` that is the first sound
in the whole build.

`whoosh_01`'s anchor is **0.6913 s** into the file and the impact is 0.1354 s
after the element, so the layer has to start **0.5558 s (16.66 frames) before**
the image. `img001` sits at 0.0990 s. There is not that much reel in front of
it, the in-point clamps to zero, and the peak arrives 14 frames behind the
picture. **Half a second is "clearly separate".**

**Neither file in the index can fit it**, which is what makes this a binding
question rather than a tuning one:

| file | anchor | needs before the element | on an image at 0.099 s |
|---|---:|---:|---|
| `whoosh_01` | 0.6913 s | 0.5558 s (16.66 f) | **13.69 f late** |
| `whoosh_02` | 0.5581 s | 0.4227 s (12.67 f) | **9.70 f late** |

## (b) The wrong impact frame — REFUTED

The crossing was computed separately for each image comp, from its own
keyframes, on the property that carries the visual arrival:

| comp | property | crossing | linear | last key |
|---|---|---:|---:|---:|
| `img_slide_left` | Transform/Position | **4.059 f** | 10.80 | 12.00 |
| `img_slide_left` | Transform/Opacity | **4.059 f** | 10.80 | 12.00 |
| `img_float` | Transform/Opacity (IMG_MAIN) | **4.059 f** | 10.80 | 12.00 |
| `img_float` | Transform/Scale (CARD) | **4.059 f** | 10.80 | 12.00 |
| `img_float` | Transform/Opacity (CARD) | **4.059 f** | 10.80 | 12.00 |
| `kw_slam` | Transform/Position | 4.059 f | 10.80 | 12.00 |

**An image's arrival is at the same frame as a word's, and not by assumption.**
Every entrance keyframe pair in the library runs `t=0` to `t=0.4004` with the
same easing, so a slide's Position and a float's Opacity and Scale all cross at
4.059 frames. There is nothing here to fix, and `IMPACT_THRESHOLD` at 0.90 is
not what is wrong.

## (c) The layer starts before the image is visible — MEASURED, and the opposite

**The builder adds nothing between the layer's in-point and the picture.** It
sets `startTime`, `inPoint` and `outPoint` all to the slot's own start, sets
Position and Scale, and stops. No fade, no opacity ramp of its own, and **no
time stretch on an image** — only short subtitle cards are stretched, so the
entrance runs at 100% and the crossing applies unchanged. The comp's frame 0 is
the layer's in-point.

Inside the comp, opacity is keyframed 0 → 100 over those 12 frames with a
heavily front-loaded ease. What that means in practice, computed from the curve:

| opacity reached | at |
|---:|---:|
| 5% | 0.09 f (3 ms) |
| 10% | 0.18 f (6 ms) |
| 25% | 0.48 f (16 ms) |
| 50% | 1.17 f (39 ms) |
| 80% | 2.81 f (94 ms) |
| **90%** | **4.06 f (135 ms)** |

**The picture is not invisible for some frames after the layer begins — it is
visible almost immediately** and half-present by frame 1.2. So the hypothesis is
refuted in its stated form, but the measurement points the other way: the
sound's peak is aimed at the 90% crossing, which is **4.06 frames (135 ms) after
the picture first appears** and about 1.2 frames after it is essentially there.

**Not acted on.** 135 ms is at the edge of where two events begin to separate,
and it is "a frame or two" rather than the beat the user described; the beat is
(a)'s 14 frames. `IMPACT_THRESHOLD` is settled at 0.90 and is not being
revisited through the back door for images. **If the whooshes still read late
once (a) is fixed, this table is where to look next** — and the change would be
to anchor an image's sound to an earlier point on its own opacity curve, not to
move the threshold that governs the words.

## The verdict

**(a).** Two whooshes, both the first image of their reel, are 14 frames late
because `whoosh_01`'s 0.69 s lead-in does not fit in front of an image that
starts at 0.099 s. The other seven land exactly on the impact frame.
