# Block 6 — subtitle timing budget sweep

What intro and outro budget the existing content can carry, measured before
any comp is animated. Free, local, read-only: no plan on disk was modified and
no API was called.

## The answer

**No swept budget makes every subtitle group buildable.** The fewest failures is 6 of 182 groups at intro+outro 0.13 s with minHold 0.10 s (floor 0.23 s). The groups that fail there:

- **ground truth** `g002` "cernes pigmentés" — 0.221 s on screen, short by 0.009 s
- **ground truth** `g028` "houa wa7d" — 0.147 s on screen, short by 0.083 s
- **test 1** `g002` "شد" — 0.200 s on screen, short by 0.030 s
- **test 1** `g007` "tb3i m3aya" — 0.060 s on screen, short by 0.170 s
- **test 1** `g036` "mn" — 0.201 s on screen, short by 0.029 s
- **vitasilk** `g017` "mn" — 0.040 s on screen, short by 0.190 s

The stub manifest currently declares `sub_pop` at intro 0.13 + hold 0.07 + outro
0.13, a floor of 0.33 s. Every figure below is measured from the word timings in
the plans; the grid itself and the 29.97 fps frame equivalences are assumptions.

## Two things that decide how to read this

**The merge rescue barely fires.** Across 5 reels and 25 grid cells each, the display-timing pass merged 20 groups in total, in 20 of 125 reel-cells, and 0 at the loosest budget. It merges only when the pair totals two words or fewer, and grouping has already paired words wherever it could, so adjacent single-word groups are rare. Extension into silence is the rescue that does the work.

**Silence is the scarce resource, not the budget.** Pooled median gap after a group is 0.059 s and the tenth percentile is 0.020 s, so a card can rarely be held more than a few hundredths of a second past its words. What a group can reach is close to what it was spoken in.

Groups whose words are under 0.05 s — alignment artifacts `findShortWords` already reports, not display problems: test 1 1, vitasilk 1. These fail at every budget in the grid and no intro or outro choice rescues them.

## Pooled subtitle groups, every reel

The denominator moves between cells because the display-timing pass merges a
group with its neighbour when extension alone cannot reach the floor, and a
merge removes a card. It refuses to merge a group a keyword supersedes.

| intro+outro | minHold 0.10 | minHold 0.15 | minHold 0.20 | minHold 0.25 | minHold 0.30 |
|---|---|---|---|---|---|
| 0.13 s (4f) | 176/182 (97%) | 170/182 (93%) | 157/182 (86%) | 147/181 (81%) | 134/181 (74%) |
| 0.20 s (6f) | 167/182 (92%) | 152/182 (84%) | 142/181 (78%) | 130/181 (72%) | 120/181 (66%) |
| 0.27 s (8f) | 147/181 (81%) | 140/181 (77%) | 122/181 (67%) | 114/181 (63%) | 100/181 (55%) |
| 0.33 s (10f) | 134/181 (74%) | 122/181 (67%) | 112/181 (62%) | 100/181 (55%) | 85/181 (47%) |
| 0.40 s (12f) | 120/181 (66%) | 104/181 (57%) | 96/181 (53%) | 78/181 (43%) | 63/181 (35%) |

## ground truth

| intro+outro | minHold | floor | subtitle groups | merges |
|---|---|---|---|---|
| 0.13 | 0.10 | 0.23 | 36/38 (95%) | 0 |
| 0.13 | 0.15 | 0.28 | 34/38 (89%) | 0 |
| 0.13 | 0.20 | 0.33 | 32/38 (84%) | 0 |
| 0.13 | 0.25 | 0.38 | 32/38 (84%) | 0 |
| 0.13 | 0.30 | 0.43 | 27/38 (71%) | 0 |
| 0.20 | 0.10 | 0.30 | 34/38 (89%) | 0 |
| 0.20 | 0.15 | 0.35 | 32/38 (84%) | 0 |
| 0.20 | 0.20 | 0.40 | 30/38 (79%) | 0 |
| 0.20 | 0.25 | 0.45 | 27/38 (71%) | 0 |
| 0.20 | 0.30 | 0.50 | 25/38 (66%) | 0 |
| 0.27 | 0.10 | 0.37 | 32/38 (84%) | 0 |
| 0.27 | 0.15 | 0.42 | 29/38 (76%) | 0 |
| 0.27 | 0.20 | 0.47 | 26/38 (68%) | 0 |
| 0.27 | 0.25 | 0.52 | 22/38 (58%) | 0 |
| 0.27 | 0.30 | 0.57 | 20/38 (53%) | 0 |
| 0.33 | 0.10 | 0.43 | 27/38 (71%) | 0 |
| 0.33 | 0.15 | 0.48 | 26/38 (68%) | 0 |
| 0.33 | 0.20 | 0.53 | 22/38 (58%) | 0 |
| 0.33 | 0.25 | 0.58 | 20/38 (53%) | 0 |
| 0.33 | 0.30 | 0.63 | 19/38 (50%) | 0 |
| 0.40 | 0.10 | 0.50 | 25/38 (66%) | 0 |
| 0.40 | 0.15 | 0.55 | 21/38 (55%) | 0 |
| 0.40 | 0.20 | 0.60 | 19/38 (50%) | 0 |
| 0.40 | 0.25 | 0.65 | 18/38 (47%) | 0 |
| 0.40 | 0.30 | 0.70 | 13/38 (34%) | 0 |

Raw group speech duration, s: min 0.087 · p10 0.221 · median 0.520 · max 1.060 (n=38)

Silence after each group, s: min 0.006 · p10 0.019 · median 0.039 · max 0.460 (n=38)

Shortest group: `g028` "houa wa7d" at 0.087 s, with 0.060 s of silence after it.

## test 1

| intro+outro | minHold | floor | subtitle groups | merges | keywords | image slots |
|---|---|---|---|---|---|---|
| 0.13 | 0.10 | 0.23 | 35/38 (92%) | 0 | 2/3 (67%) | 4/4 (100%) |
| 0.13 | 0.15 | 0.28 | 34/38 (89%) | 0 | 2/3 (67%) | 4/4 (100%) |
| 0.13 | 0.20 | 0.33 | 31/38 (82%) | 0 | 2/3 (67%) | 4/4 (100%) |
| 0.13 | 0.25 | 0.38 | 29/37 (78%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.13 | 0.30 | 0.43 | 26/37 (70%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.20 | 0.10 | 0.30 | 34/38 (89%) | 0 | 2/3 (67%) | 4/4 (100%) |
| 0.20 | 0.15 | 0.35 | 31/38 (82%) | 0 | 2/3 (67%) | 4/4 (100%) |
| 0.20 | 0.20 | 0.40 | 27/37 (73%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.20 | 0.25 | 0.45 | 25/37 (68%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.20 | 0.30 | 0.50 | 25/37 (68%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.27 | 0.10 | 0.37 | 29/37 (78%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.27 | 0.15 | 0.42 | 27/37 (73%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.27 | 0.20 | 0.47 | 25/37 (68%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.27 | 0.25 | 0.52 | 24/37 (65%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.27 | 0.30 | 0.57 | 21/37 (57%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.33 | 0.10 | 0.43 | 26/37 (70%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.33 | 0.15 | 0.48 | 25/37 (68%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.33 | 0.20 | 0.53 | 24/37 (65%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.33 | 0.25 | 0.58 | 21/37 (57%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.33 | 0.30 | 0.63 | 16/37 (43%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.40 | 0.10 | 0.50 | 25/37 (68%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.40 | 0.15 | 0.55 | 23/37 (62%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.40 | 0.20 | 0.60 | 21/37 (57%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.40 | 0.25 | 0.65 | 13/37 (35%) | 1 | 2/3 (67%) | 4/4 (100%) |
| 0.40 | 0.30 | 0.70 | 13/37 (35%) | 1 | 2/3 (67%) | 4/4 (100%) |

Raw group speech duration, s: min 0.030 · p10 0.180 · median 0.500 · max 1.020 (n=38)

Silence after each group, s: min 0.000 · p10 0.020 · median 0.040 · max 0.620 (n=38)

Shortest group: `g007` "tb3i m3aya" at 0.030 s, with 0.030 s of silence after it.

## test 2

| intro+outro | minHold | floor | subtitle groups | merges |
|---|---|---|---|---|
| 0.13 | 0.10 | 0.23 | 35/35 (100%) | 0 |
| 0.13 | 0.15 | 0.28 | 35/35 (100%) | 0 |
| 0.13 | 0.20 | 0.33 | 32/35 (91%) | 0 |
| 0.13 | 0.25 | 0.38 | 29/35 (83%) | 0 |
| 0.13 | 0.30 | 0.43 | 27/35 (77%) | 0 |
| 0.20 | 0.10 | 0.30 | 34/35 (97%) | 0 |
| 0.20 | 0.15 | 0.35 | 30/35 (86%) | 0 |
| 0.20 | 0.20 | 0.40 | 28/35 (80%) | 0 |
| 0.20 | 0.25 | 0.45 | 25/35 (71%) | 0 |
| 0.20 | 0.30 | 0.50 | 22/35 (63%) | 0 |
| 0.27 | 0.10 | 0.37 | 29/35 (83%) | 0 |
| 0.27 | 0.15 | 0.42 | 27/35 (77%) | 0 |
| 0.27 | 0.20 | 0.47 | 22/35 (63%) | 0 |
| 0.27 | 0.25 | 0.52 | 21/35 (60%) | 0 |
| 0.27 | 0.30 | 0.57 | 18/35 (51%) | 0 |
| 0.33 | 0.10 | 0.43 | 27/35 (77%) | 0 |
| 0.33 | 0.15 | 0.48 | 22/35 (63%) | 0 |
| 0.33 | 0.20 | 0.53 | 21/35 (60%) | 0 |
| 0.33 | 0.25 | 0.58 | 18/35 (51%) | 0 |
| 0.33 | 0.30 | 0.63 | 13/35 (37%) | 0 |
| 0.40 | 0.10 | 0.50 | 22/35 (63%) | 0 |
| 0.40 | 0.15 | 0.55 | 19/35 (54%) | 0 |
| 0.40 | 0.20 | 0.60 | 16/35 (46%) | 0 |
| 0.40 | 0.25 | 0.65 | 12/35 (34%) | 0 |
| 0.40 | 0.30 | 0.70 | 8/35 (23%) | 0 |

Raw group speech duration, s: min 0.261 · p10 0.299 · median 0.520 · max 1.099 (n=35)

Silence after each group, s: min 0.020 · p10 0.020 · median 0.060 · max 1.200 (n=35)

Shortest group: `g011` "fa houa" at 0.261 s, with 0.020 s of silence after it.

## test 3

| intro+outro | minHold | floor | subtitle groups | merges |
|---|---|---|---|---|
| 0.13 | 0.10 | 0.23 | 30/30 (100%) | 0 |
| 0.13 | 0.15 | 0.28 | 29/30 (97%) | 0 |
| 0.13 | 0.20 | 0.33 | 28/30 (93%) | 0 |
| 0.13 | 0.25 | 0.38 | 25/30 (83%) | 0 |
| 0.13 | 0.30 | 0.43 | 24/30 (80%) | 0 |
| 0.20 | 0.10 | 0.30 | 29/30 (97%) | 0 |
| 0.20 | 0.15 | 0.35 | 26/30 (87%) | 0 |
| 0.20 | 0.20 | 0.40 | 25/30 (83%) | 0 |
| 0.20 | 0.25 | 0.45 | 23/30 (77%) | 0 |
| 0.20 | 0.30 | 0.50 | 20/30 (67%) | 0 |
| 0.27 | 0.10 | 0.37 | 25/30 (83%) | 0 |
| 0.27 | 0.15 | 0.42 | 25/30 (83%) | 0 |
| 0.27 | 0.20 | 0.47 | 21/30 (70%) | 0 |
| 0.27 | 0.25 | 0.52 | 20/30 (67%) | 0 |
| 0.27 | 0.30 | 0.57 | 18/30 (60%) | 0 |
| 0.33 | 0.10 | 0.43 | 24/30 (80%) | 0 |
| 0.33 | 0.15 | 0.48 | 21/30 (70%) | 0 |
| 0.33 | 0.20 | 0.53 | 19/30 (63%) | 0 |
| 0.33 | 0.25 | 0.58 | 18/30 (60%) | 0 |
| 0.33 | 0.30 | 0.63 | 17/30 (57%) | 0 |
| 0.40 | 0.10 | 0.50 | 20/30 (67%) | 0 |
| 0.40 | 0.15 | 0.55 | 18/30 (60%) | 0 |
| 0.40 | 0.20 | 0.60 | 18/30 (60%) | 0 |
| 0.40 | 0.25 | 0.65 | 16/30 (53%) | 0 |
| 0.40 | 0.30 | 0.70 | 13/30 (43%) | 0 |

Raw group speech duration, s: min 0.231 · p10 0.300 · median 0.581 · max 1.199 (n=30)

Silence after each group, s: min 0.000 · p10 0.019 · median 0.059 · max 0.760 (n=30)

Shortest group: `g009` "Eyes fa" at 0.231 s, with 0.030 s of silence after it.

## vitasilk

| intro+outro | minHold | floor | subtitle groups | merges | keywords | image slots |
|---|---|---|---|---|---|---|
| 0.13 | 0.10 | 0.23 | 40/41 (98%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.13 | 0.15 | 0.28 | 38/41 (93%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.13 | 0.20 | 0.33 | 34/41 (83%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.13 | 0.25 | 0.38 | 32/41 (78%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.13 | 0.30 | 0.43 | 30/41 (73%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.20 | 0.10 | 0.30 | 36/41 (88%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.20 | 0.15 | 0.35 | 33/41 (80%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.20 | 0.20 | 0.40 | 32/41 (78%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.20 | 0.25 | 0.45 | 30/41 (73%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.20 | 0.30 | 0.50 | 28/41 (68%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.27 | 0.10 | 0.37 | 32/41 (78%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.27 | 0.15 | 0.42 | 32/41 (78%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.27 | 0.20 | 0.47 | 28/41 (68%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.27 | 0.25 | 0.52 | 27/41 (66%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.27 | 0.30 | 0.57 | 23/41 (56%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.33 | 0.10 | 0.43 | 30/41 (73%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.33 | 0.15 | 0.48 | 28/41 (68%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.33 | 0.20 | 0.53 | 26/41 (63%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.33 | 0.25 | 0.58 | 23/41 (56%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.33 | 0.30 | 0.63 | 20/41 (49%) | 0 | 0/3 (0%) | 5/5 (100%) |
| 0.40 | 0.10 | 0.50 | 28/41 (68%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.40 | 0.15 | 0.55 | 23/41 (56%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.40 | 0.20 | 0.60 | 22/41 (54%) | 0 | 1/3 (33%) | 5/5 (100%) |
| 0.40 | 0.25 | 0.65 | 19/41 (46%) | 0 | 0/3 (0%) | 5/5 (100%) |
| 0.40 | 0.30 | 0.70 | 16/41 (39%) | 0 | 0/3 (0%) | 5/5 (100%) |

Raw group speech duration, s: min 0.000 · p10 0.220 · median 0.521 · max 1.260 (n=41)

Silence after each group, s: min 0.019 · p10 0.030 · median 0.079 · max 0.381 (n=41)

Shortest group: `g017` "mn" at 0.000 s, with 0.040 s of silence after it.

## Pooled

Raw group speech duration, s: min 0.000 · p10 0.241 · median 0.520 · max 1.260 (n=182)

Silence after each group, s: min 0.000 · p10 0.020 · median 0.059 · max 1.200 (n=182)

