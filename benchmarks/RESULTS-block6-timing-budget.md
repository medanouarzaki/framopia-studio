# Block 6 — subtitle timing budget sweep

What intro and outro budget the existing content can carry, measured before
any comp is animated. Free, local, read-only: no plan on disk was modified and
no API was called.

## The answer

**No swept budget makes every subtitle group buildable.** The fewest failures is 21 of 343 groups at intro+outro 0.40 s with minHold 0.15 s (floor 0.55 s). The groups that fail there:

- **ground truth** `g004` "pigmentés" — 0.010 s on screen, short by 0.081 s
- **ground truth** `g013` "3ndi" — 0.010 s on screen, short by 0.082 s
- **ground truth** `g036` "l7essass" — 0.079 s on screen, short by 0.013 s
- **ground truth** `g043` "yom" — 0.060 s on screen, short by 0.032 s
- **ground truth** `g054` "li" — 0.006 s on screen, short by 0.085 s
- **ground truth** `g055` "houa" — 0.006 s on screen, short by 0.085 s
- **test 1** `g009` "tb3i" — 0.030 s on screen, short by 0.062 s
- **test 1** `g010` "m3aya" — 0.030 s on screen, short by 0.062 s
- **test 1** `g011` "tal" — 0.030 s on screen, short by 0.062 s
- **test 1** `g032` "f" — 0.040 s on screen, short by 0.052 s
- **test 1** `g034` "dialna" — 0.080 s on screen, short by 0.012 s
- **test 2** `g015` "f" — 0.060 s on screen, short by 0.032 s
- **test 2** `g021` "fa" — 0.020 s on screen, short by 0.072 s
- **test 2** `g041` "7essa" — 0.040 s on screen, short by 0.052 s
- **test 3** `g017` "fa" — 0.030 s on screen, short by 0.062 s
- **test 3** `g039` "pigmentés" — 0.020 s on screen, short by 0.072 s
- **vitasilk** `g001` "5" — 0.000 s on screen, short by 0.092 s
- **vitasilk** `g014` "ghayrdd" — 0.040 s on screen, short by 0.052 s
- **vitasilk** `g029` "mn" — 0.040 s on screen, short by 0.052 s
- **vitasilk** `g033` "nourrit" — 0.040 s on screen, short by 0.052 s
- **vitasilk** `g051` "chno" — 0.030 s on screen, short by 0.061 s

The stub manifest currently declares `sub_pop` at intro 0.13 + hold 0.07 + outro
0.13, a floor of 0.33 s. Every figure below is measured from the word timings in
the plans; the grid itself and the 29.97 fps frame equivalences are assumptions.

## Two things that decide how to read this

**The merge rescue barely fires.** Across 5 reels and 25 grid cells each, the display-timing pass merged 0 groups in total, in 0 of 125 reel-cells, and 0 at the loosest budget. It merges only when the pair totals two words or fewer, and grouping has already paired words wherever it could, so adjacent single-word groups are rare. Extension into silence is the rescue that does the work.

**Silence is the scarce resource, not the budget.** Pooled median gap after a group is 0.041 s and the tenth percentile is 0.020 s, so a card can rarely be held more than a few hundredths of a second past its words. What a group can reach is close to what it was spoken in.

Groups whose words are under 0.05 s — alignment artifacts `findShortWords` already reports, not display problems: ground truth 6, test 1 6, test 2 4, test 3 2, vitasilk 5. These fail at every budget in the grid and no intro or outro choice rescues them.

## Pooled subtitle groups, every reel

The denominator moves between cells because the display-timing pass merges a
group with its neighbour when extension alone cannot reach the floor, and a
merge removes a card. It refuses to merge a group a keyword supersedes.

| intro+outro | minHold 0.10 | minHold 0.15 | minHold 0.20 | minHold 0.25 | minHold 0.30 |
|---|---|---|---|---|---|
| 0.13 s (4f) | 315/343 (92%) | 288/343 (84%) | 267/343 (78%) | 255/343 (74%) | 224/343 (65%) |
| 0.20 s (6f) | 315/343 (92%) | 315/343 (92%) | 308/343 (90%) | 288/343 (84%) | 267/343 (78%) |
| 0.27 s (8f) | 322/343 (94%) | 315/343 (92%) | 315/343 (92%) | 308/343 (90%) | 296/343 (86%) |
| 0.33 s (10f) | 322/343 (94%) | 322/343 (94%) | 315/343 (92%) | 315/343 (92%) | 308/343 (90%) |
| 0.40 s (12f) | 322/343 (94%) | 322/343 (94%) | 315/343 (92%) | 315/343 (92%) | 315/343 (92%) |

## ground truth

| intro+outro | minHold | floor | subtitle groups | merges |
|---|---|---|---|---|
| 0.13 | 0.10 | 0.12 | 67/76 (88%) | 0 |
| 0.13 | 0.15 | 0.14 | 61/76 (80%) | 0 |
| 0.13 | 0.20 | 0.17 | 53/76 (70%) | 0 |
| 0.13 | 0.25 | 0.20 | 52/76 (68%) | 0 |
| 0.13 | 0.30 | 0.22 | 43/76 (57%) | 0 |
| 0.20 | 0.10 | 0.10 | 67/76 (88%) | 0 |
| 0.20 | 0.15 | 0.12 | 67/76 (88%) | 0 |
| 0.20 | 0.20 | 0.13 | 67/76 (88%) | 0 |
| 0.20 | 0.25 | 0.15 | 61/76 (80%) | 0 |
| 0.20 | 0.30 | 0.17 | 53/76 (70%) | 0 |
| 0.27 | 0.10 | 0.09 | 70/76 (92%) | 0 |
| 0.27 | 0.15 | 0.10 | 67/76 (88%) | 0 |
| 0.27 | 0.20 | 0.12 | 67/76 (88%) | 0 |
| 0.27 | 0.25 | 0.13 | 67/76 (88%) | 0 |
| 0.27 | 0.30 | 0.14 | 64/76 (84%) | 0 |
| 0.33 | 0.10 | 0.09 | 70/76 (92%) | 0 |
| 0.33 | 0.15 | 0.10 | 70/76 (92%) | 0 |
| 0.33 | 0.20 | 0.11 | 67/76 (88%) | 0 |
| 0.33 | 0.25 | 0.12 | 67/76 (88%) | 0 |
| 0.33 | 0.30 | 0.13 | 67/76 (88%) | 0 |
| 0.40 | 0.10 | 0.08 | 70/76 (92%) | 0 |
| 0.40 | 0.15 | 0.09 | 70/76 (92%) | 0 |
| 0.40 | 0.20 | 0.10 | 67/76 (88%) | 0 |
| 0.40 | 0.25 | 0.11 | 67/76 (88%) | 0 |
| 0.40 | 0.30 | 0.12 | 67/76 (88%) | 0 |

Raw group speech duration, s: min 0.000 · p10 0.059 · median 0.200 · max 0.859 (n=76)

Silence after each group, s: min 0.006 · p10 0.019 · median 0.040 · max 0.460 (n=76)

Shortest group: `g004` "pigmentés" at 0.000 s, with 0.010 s of silence after it.

## test 1

| intro+outro | minHold | floor | subtitle groups | merges | keywords | image slots |
|---|---|---|---|---|---|---|
| 0.13 | 0.10 | 0.12 | 60/67 (90%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.13 | 0.15 | 0.14 | 57/67 (85%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.13 | 0.20 | 0.17 | 56/67 (84%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.13 | 0.25 | 0.20 | 53/67 (79%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.13 | 0.30 | 0.22 | 46/67 (69%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.20 | 0.10 | 0.10 | 60/67 (90%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.20 | 0.15 | 0.12 | 60/67 (90%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.20 | 0.20 | 0.13 | 59/67 (88%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.20 | 0.25 | 0.15 | 57/67 (85%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.20 | 0.30 | 0.17 | 56/67 (84%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.27 | 0.10 | 0.09 | 62/67 (93%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.27 | 0.15 | 0.10 | 60/67 (90%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.27 | 0.20 | 0.12 | 60/67 (90%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.27 | 0.25 | 0.13 | 59/67 (88%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.27 | 0.30 | 0.14 | 58/67 (87%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.33 | 0.10 | 0.09 | 62/67 (93%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.33 | 0.15 | 0.10 | 62/67 (93%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.33 | 0.20 | 0.11 | 60/67 (90%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.33 | 0.25 | 0.12 | 60/67 (90%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.33 | 0.30 | 0.13 | 59/67 (88%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.40 | 0.10 | 0.08 | 62/67 (93%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.40 | 0.15 | 0.09 | 62/67 (93%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.40 | 0.20 | 0.10 | 60/67 (90%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.40 | 0.25 | 0.11 | 60/67 (90%) | 0 | 2/2 (100%) | 4/4 (100%) |
| 0.40 | 0.30 | 0.12 | 60/67 (90%) | 0 | 2/2 (100%) | 4/4 (100%) |

Raw group speech duration, s: min 0.000 · p10 0.061 · median 0.261 · max 0.639 (n=67)

Silence after each group, s: min 0.000 · p10 0.020 · median 0.040 · max 0.620 (n=67)

Shortest group: `g009` "tb3i" at 0.000 s, with 0.030 s of silence after it.

## test 2

| intro+outro | minHold | floor | subtitle groups | merges | keywords |
|---|---|---|---|---|---|
| 0.13 | 0.10 | 0.12 | 65/69 (94%) | 0 | 3/3 (100%) |
| 0.13 | 0.15 | 0.14 | 61/69 (88%) | 0 | 3/3 (100%) |
| 0.13 | 0.20 | 0.17 | 54/69 (78%) | 0 | 3/3 (100%) |
| 0.13 | 0.25 | 0.20 | 49/69 (71%) | 0 | 3/3 (100%) |
| 0.13 | 0.30 | 0.22 | 44/69 (64%) | 0 | 3/3 (100%) |
| 0.20 | 0.10 | 0.10 | 65/69 (94%) | 0 | 3/3 (100%) |
| 0.20 | 0.15 | 0.12 | 65/69 (94%) | 0 | 3/3 (100%) |
| 0.20 | 0.20 | 0.13 | 64/69 (93%) | 0 | 3/3 (100%) |
| 0.20 | 0.25 | 0.15 | 61/69 (88%) | 0 | 3/3 (100%) |
| 0.20 | 0.30 | 0.17 | 54/69 (78%) | 0 | 3/3 (100%) |
| 0.27 | 0.10 | 0.09 | 66/69 (96%) | 0 | 3/3 (100%) |
| 0.27 | 0.15 | 0.10 | 65/69 (94%) | 0 | 3/3 (100%) |
| 0.27 | 0.20 | 0.12 | 65/69 (94%) | 0 | 3/3 (100%) |
| 0.27 | 0.25 | 0.13 | 64/69 (93%) | 0 | 3/3 (100%) |
| 0.27 | 0.30 | 0.14 | 63/69 (91%) | 0 | 3/3 (100%) |
| 0.33 | 0.10 | 0.09 | 66/69 (96%) | 0 | 3/3 (100%) |
| 0.33 | 0.15 | 0.10 | 66/69 (96%) | 0 | 3/3 (100%) |
| 0.33 | 0.20 | 0.11 | 65/69 (94%) | 0 | 3/3 (100%) |
| 0.33 | 0.25 | 0.12 | 65/69 (94%) | 0 | 3/3 (100%) |
| 0.33 | 0.30 | 0.13 | 64/69 (93%) | 0 | 3/3 (100%) |
| 0.40 | 0.10 | 0.08 | 66/69 (96%) | 0 | 3/3 (100%) |
| 0.40 | 0.15 | 0.09 | 66/69 (96%) | 0 | 3/3 (100%) |
| 0.40 | 0.20 | 0.10 | 65/69 (94%) | 0 | 3/3 (100%) |
| 0.40 | 0.25 | 0.11 | 65/69 (94%) | 0 | 3/3 (100%) |
| 0.40 | 0.30 | 0.12 | 65/69 (94%) | 0 | 3/3 (100%) |

Raw group speech duration, s: min 0.000 · p10 0.081 · median 0.239 · max 0.640 (n=69)

Silence after each group, s: min 0.001 · p10 0.020 · median 0.041 · max 1.200 (n=69)

Shortest group: `g021` "fa" at 0.000 s, with 0.020 s of silence after it.

## test 3

| intro+outro | minHold | floor | subtitle groups | merges |
|---|---|---|---|---|
| 0.13 | 0.10 | 0.12 | 55/58 (95%) | 0 |
| 0.13 | 0.15 | 0.14 | 49/58 (84%) | 0 |
| 0.13 | 0.20 | 0.17 | 47/58 (81%) | 0 |
| 0.13 | 0.25 | 0.20 | 46/58 (79%) | 0 |
| 0.13 | 0.30 | 0.22 | 40/58 (69%) | 0 |
| 0.20 | 0.10 | 0.10 | 55/58 (95%) | 0 |
| 0.20 | 0.15 | 0.12 | 55/58 (95%) | 0 |
| 0.20 | 0.20 | 0.13 | 52/58 (90%) | 0 |
| 0.20 | 0.25 | 0.15 | 49/58 (84%) | 0 |
| 0.20 | 0.30 | 0.17 | 47/58 (81%) | 0 |
| 0.27 | 0.10 | 0.09 | 56/58 (97%) | 0 |
| 0.27 | 0.15 | 0.10 | 55/58 (95%) | 0 |
| 0.27 | 0.20 | 0.12 | 55/58 (95%) | 0 |
| 0.27 | 0.25 | 0.13 | 52/58 (90%) | 0 |
| 0.27 | 0.30 | 0.14 | 49/58 (84%) | 0 |
| 0.33 | 0.10 | 0.09 | 56/58 (97%) | 0 |
| 0.33 | 0.15 | 0.10 | 56/58 (97%) | 0 |
| 0.33 | 0.20 | 0.11 | 55/58 (95%) | 0 |
| 0.33 | 0.25 | 0.12 | 55/58 (95%) | 0 |
| 0.33 | 0.30 | 0.13 | 52/58 (90%) | 0 |
| 0.40 | 0.10 | 0.08 | 56/58 (97%) | 0 |
| 0.40 | 0.15 | 0.09 | 56/58 (97%) | 0 |
| 0.40 | 0.20 | 0.10 | 55/58 (95%) | 0 |
| 0.40 | 0.25 | 0.11 | 55/58 (95%) | 0 |
| 0.40 | 0.30 | 0.12 | 55/58 (95%) | 0 |

Raw group speech duration, s: min 0.000 · p10 0.100 · median 0.240 · max 0.660 (n=58)

Silence after each group, s: min 0.000 · p10 0.019 · median 0.059 · max 0.760 (n=58)

Shortest group: `g017` "fa" at 0.000 s, with 0.030 s of silence after it.

## vitasilk

| intro+outro | minHold | floor | subtitle groups | merges | keywords | image slots |
|---|---|---|---|---|---|---|
| 0.13 | 0.10 | 0.12 | 68/73 (93%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.13 | 0.15 | 0.14 | 60/73 (82%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.13 | 0.20 | 0.17 | 57/73 (78%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.13 | 0.25 | 0.20 | 55/73 (75%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.13 | 0.30 | 0.22 | 51/73 (70%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.20 | 0.10 | 0.10 | 68/73 (93%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.20 | 0.15 | 0.12 | 68/73 (93%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.20 | 0.20 | 0.13 | 66/73 (90%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.20 | 0.25 | 0.15 | 60/73 (82%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.20 | 0.30 | 0.17 | 57/73 (78%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.27 | 0.10 | 0.09 | 68/73 (93%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.27 | 0.15 | 0.10 | 68/73 (93%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.27 | 0.20 | 0.12 | 68/73 (93%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.27 | 0.25 | 0.13 | 66/73 (90%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.27 | 0.30 | 0.14 | 62/73 (85%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.33 | 0.10 | 0.09 | 68/73 (93%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.33 | 0.15 | 0.10 | 68/73 (93%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.33 | 0.20 | 0.11 | 68/73 (93%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.33 | 0.25 | 0.12 | 68/73 (93%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.33 | 0.30 | 0.13 | 66/73 (90%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.40 | 0.10 | 0.08 | 68/73 (93%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.40 | 0.15 | 0.09 | 68/73 (93%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.40 | 0.20 | 0.10 | 68/73 (93%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.40 | 0.25 | 0.11 | 68/73 (93%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.40 | 0.30 | 0.12 | 68/73 (93%) | 0 | 3/3 (100%) | 5/5 (100%) |

Raw group speech duration, s: min 0.000 · p10 0.080 · median 0.259 · max 1.260 (n=73)

Silence after each group, s: min 0.000 · p10 0.020 · median 0.060 · max 0.381 (n=73)

Shortest group: `g001` "5" at 0.000 s, with 0.000 s of silence after it.

## Pooled

Raw group speech duration, s: min 0.000 · p10 0.080 · median 0.240 · max 1.260 (n=343)

Silence after each group, s: min 0.000 · p10 0.020 · median 0.041 · max 1.200 (n=343)

