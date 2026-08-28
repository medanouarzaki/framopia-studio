# Image size, reopened as a placement question

Measured 2026-08-29, read-only. Nothing was implemented and no constant was
changed. All figures are source pixels on a 2160 × 3840 frame, from each slot's
own face mask over the frames it is on screen.

## What 140% needs, and what each region offers

`imageScale` is 1.4 on `k2-syndicalia`. "Above", "left" and "right" are the
largest square that fits in that band while clearing the face by
`HEAD_CLEARANCE` (86 px), staying `TOP_LEFT_MARGIN` (65 px) inside the frame,
and — for the side bands — staying above the subtitle band at 1980 px. A square
entirely above the face may use the **full frame width**.

| reel | slot | placed today | 140% wants | face box (l,t,r,b) | above | left | right | **best** |
|---|---|---:|---:|---|---:|---:|---:|---:|
| vitasilk | img001 | 749 | 1076 | 920,1088,1540,2024 | **937** | 769 | 469 | **937** |
| vitasilk | img002 | 801 | 1172 | 988,916,1804,1896 | 765 | **837** | 205 | **837** |
| vitasilk | img003 | 765 | 1138 | 964,1056,1648,2020 | **905** | 813 | 361 | **905** |
| vitasilk | img004 | 818 | 1155 | 976,1076,1756,2028 | **925** | 825 | 253 | **925** |
| vitasilk | img005 | 794 | 1166 | 984,1064,1752,2020 | **913** | 833 | 257 | **913** |
| test-1 | img001 | 787 | 1132 | 960,1088,1252,1560 | **937** | 809 | 757 | **937** |
| test-1 | img002 | 759 | 1104 | 940,1076,1228,1524 | **925** | 789 | 781 | **925** |
| test-1 | img003 | 778 | 1104 | 940,1076,1264,1536 | **925** | 789 | 745 | **925** |
| test-1 | img004 | 763 | 1110 | 944,1068,1244,1536 | **917** | 793 | 765 | **917** |

**140% does not fit anywhere on any slot.** The best face-clearing region on the
whole frame is 765–937 px against 1076–1172 px asked for — short by 140 to
335 px on every one of the nine.

**But the corner is leaving real size on the table.** The band above the face
holds 905–937 px on eight of the nine slots, against the 749–818 px the
top-left corner places. Moving off the corner is worth:

| | gain |
|---|---:|
| `vitasilk` img001 | **1.25×** |
| `vitasilk` img003 | 1.18× |
| `vitasilk` img005 | 1.15× |
| `vitasilk` img004 | 1.13× |
| `vitasilk` img002 | 1.04× |
| `test-1` img002 | **1.22×** |
| `test-1` img001, img003, img004 | 1.19–1.20× |
| **mean** | **≈1.17×** |

So the corner rule costs about **17%**, and the remaining ~20% is not the
corner's doing — it is where the speaker's face sits.

**`img002` on `vitasilk` is the binding case and explains the shape of the
problem.** Its face box is 816 px wide and its top is at 916 px, the highest of
any slot, so it has the least room above and a 205 px strip to its right. Any
rule that must satisfy every slot is capped near 837 px there.

## Do the existing zones already hold it?

**No.** The largest square any stored zone can hold:

| reel | zones | largest zone squares |
|---|---:|---|
| vitasilk | 20 | `z_left_1` 816, `z_left_3` 816, `z_top_3` 816, `z_left_2` 800, `z_top_5` 767 |
| test-1 | 18 | `z_top_2` 959, `z_top_1` 943, `z_top_3` 943, `z_right_2` 656 |

`vitasilk`'s best zone is **816 px**, below even what the above-face band offers
(905–937) and far below the 1076–1172 asked for. The zones are derived from the
**person** mask, not the face, so they are bounded by shoulders and arms as well
as the head — which is why they are smaller than a face-only band.

## What a different placement rule would cost

**It would reopen exactly one measured decision: the corner itself** (Block 7
session 9), which was ruled before anyone had seen a build. The evidence behind
it — that the top-left corner clears the face by 834–995 px on all five reels —
stays true; what it did not consider is that anchoring at the corner wastes the
width available above the face.

**It does not touch the subject-bounding-box scaling.** That rule (Block 8
session 25) sizes the picture *inside* its 1200 px comp; placement decides where
the comp layer sits and how big it is in the master. The two are orthogonal and
a placement change leaves the scaling ruling exactly as it stands.

**It carries over unchanged:** the one-sided jitter (it can only shrink, so it
cannot push onto the face), `fitInsideFrame`, and the rule that an image never
overlaps the subtitle band.

## What I recommend

**Place above the face rather than in the corner**, taking the largest square
that fits between the top margin and the face, anywhere across the frame's
width. It is worth **≈1.17×** — 905–937 px on eight of nine slots — it reopens
only the corner ruling, and it needs no new measurement: the face masks it
depends on are already on disk and are what the corner rule reads today.

It will not reach 1.4. Getting there needs one of three things, all of which are
the user's to rule on and none of which I would do unasked:

1. **Let an image bleed off the frame edge.** A square anchored above the face
   and allowed past the top or left edge reaches any size; what it costs is that
   the picture is cropped, which is an ordinary design choice rather than a
   defect. This is the only route to 1.4 that keeps the face clear.
2. **Spend the clearance and the margin.** `HEAD_CLEARANCE` (86 px) and
   `TOP_LEFT_MARGIN` (65 px) together are 151 px, which takes `img001` to about
   1088 px — just past its 1076 — and leaves `img002` at 916 against 1172. It
   fixes one slot in nine and puts pictures against the face mask.
3. **Accept less than 140%.** `imageScale` already clamps rather than
   overlapping anything, so setting it to 1.15 would be honoured almost
   everywhere instead of clamped everywhere.

**Nothing here is implemented.** The user rules once he can see it.
