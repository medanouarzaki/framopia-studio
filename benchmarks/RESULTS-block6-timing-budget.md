# Block 6 — subtitle timing budget sweep

What intro and outro budget the existing content can carry, measured before
any comp is animated. Free, local, read-only: no plan on disk was modified and
no API was called.

## The answer

**No swept budget makes every subtitle group buildable.** The fewest failures is 120 of 343 groups at intro+outro 0.13 s with minHold 0.10 s (floor 0.23 s). The groups that fail there:

- **ground truth** `g002` "les" — 0.160 s on screen, short by 0.070 s
- **ground truth** `g003` "cernes" — 0.211 s on screen, short by 0.019 s
- **ground truth** `g004` "pigmentés" — 0.010 s on screen, short by 0.220 s
- **ground truth** `g009` "dial" — 0.161 s on screen, short by 0.069 s
- **ground truth** `g010` "la" — 0.139 s on screen, short by 0.091 s
- **ground truth** `g012` "Alors" — 0.211 s on screen, short by 0.019 s
- **ground truth** `g013` "3ndi" — 0.010 s on screen, short by 0.220 s
- **ground truth** `g014` "lik" — 0.220 s on screen, short by 0.010 s
- **ground truth** `g015` "joj" — 0.199 s on screen, short by 0.031 s
- **ground truth** `g016` "dial" — 0.220 s on screen, short by 0.010 s
- **ground truth** `g019` "7el" — 0.200 s on screen, short by 0.030 s
- **ground truth** `g023` "li" — 0.159 s on screen, short by 0.071 s
- **ground truth** `g025` "les" — 0.141 s on screen, short by 0.089 s
- **ground truth** `g027` "li" — 0.141 s on screen, short by 0.089 s
- **ground truth** `g029` "mn" — 0.100 s on screen, short by 0.130 s
- **ground truth** `g031` "du" — 0.139 s on screen, short by 0.091 s
- **ground truth** `g034` "joj" — 0.159 s on screen, short by 0.071 s
- **ground truth** `g036` "l7essass" — 0.079 s on screen, short by 0.151 s
- **ground truth** `g037` "mabin" — 0.181 s on screen, short by 0.049 s
- **ground truth** `g041` "tal" — 0.160 s on screen, short by 0.070 s
- **ground truth** `g043` "yom" — 0.060 s on screen, short by 0.170 s
- **ground truth** `g052` "la" — 0.099 s on screen, short by 0.131 s
- **ground truth** `g054` "li" — 0.006 s on screen, short by 0.224 s
- **ground truth** `g055` "houa" — 0.006 s on screen, short by 0.224 s
- **ground truth** `g056` "wa7d" — 0.141 s on screen, short by 0.089 s
- **ground truth** `g057` "lcocktail" — 0.139 s on screen, short by 0.091 s
- **ground truth** `g061` "3lih" — 0.200 s on screen, short by 0.030 s
- **ground truth** `g063` "li" — 0.160 s on screen, short by 0.070 s
- **ground truth** `g065` "4" — 0.200 s on screen, short by 0.030 s
- **ground truth** `g067` "l7essass" — 0.100 s on screen, short by 0.130 s
- **ground truth** `g068` "mabin" — 0.160 s on screen, short by 0.070 s
- **ground truth** `g072` "yom" — 0.199 s on screen, short by 0.031 s
- **ground truth** `g075` "جد" — 0.159 s on screen, short by 0.071 s
- **test 1** `g002` "شد" — 0.200 s on screen, short by 0.030 s
- **test 1** `g009` "tb3i" — 0.030 s on screen, short by 0.200 s
- **test 1** `g010` "m3aya" — 0.030 s on screen, short by 0.200 s
- **test 1** `g011` "tal" — 0.030 s on screen, short by 0.200 s
- **test 1** `g017` "ghadi" — 0.199 s on screen, short by 0.031 s
- **test 1** `g019` "likom" — 0.200 s on screen, short by 0.030 s
- **test 1** `g020` "3la" — 0.180 s on screen, short by 0.050 s
- **test 1** `g024` "des" — 0.180 s on screen, short by 0.050 s
- **test 1** `g026` "li" — 0.141 s on screen, short by 0.089 s
- **test 1** `g032` "f" — 0.040 s on screen, short by 0.190 s
- **test 1** `g034` "dialna" — 0.080 s on screen, short by 0.150 s
- **test 1** `g039` "fa" — 0.140 s on screen, short by 0.090 s
- **test 1** `g040` "kat7taji" — 0.180 s on screen, short by 0.050 s
- **test 1** `g042` "7essa" — 0.120 s on screen, short by 0.110 s
- **test 1** `g048` "kidom" — 0.100 s on screen, short by 0.130 s
- **test 1** `g049` "mabin" — 0.201 s on screen, short by 0.029 s
- **test 1** `g051` "tal" — 0.100 s on screen, short by 0.130 s
- **test 1** `g057` "hia" — 0.160 s on screen, short by 0.070 s
- **test 1** `g059` "3an" — 0.200 s on screen, short by 0.030 s
- **test 1** `g063` "lik" — 0.219 s on screen, short by 0.011 s
- **test 1** `g064` "mn" — 0.201 s on screen, short by 0.029 s
- **test 2** `g003` "nhdr" — 0.219 s on screen, short by 0.011 s
- **test 2** `g005` "3la" — 0.161 s on screen, short by 0.069 s
- **test 2** `g007` "mn" — 0.180 s on screen, short by 0.050 s
- **test 2** `g008` "a7sen" — 0.220 s on screen, short by 0.010 s
- **test 2** `g009` "les" — 0.141 s on screen, short by 0.089 s
- **test 2** `g011` "li" — 0.119 s on screen, short by 0.111 s
- **test 2** `g012` "kanbghi" — 0.220 s on screen, short by 0.010 s
- **test 2** `g015` "f" — 0.060 s on screen, short by 0.170 s
- **test 2** `g017` "li" — 0.160 s on screen, short by 0.070 s
- **test 2** `g019` "le" — 0.159 s on screen, short by 0.071 s
- **test 2** `g021` "fa" — 0.020 s on screen, short by 0.210 s
- **test 2** `g024` "3an" — 0.180 s on screen, short by 0.050 s
- **test 2** `g039` "kat7taji" — 0.161 s on screen, short by 0.069 s
- **test 2** `g040` "mabin" — 0.159 s on screen, short by 0.071 s
- **test 2** `g041` "7essa" — 0.040 s on screen, short by 0.190 s
- **test 2** `g043` "2" — 0.160 s on screen, short by 0.070 s
- **test 2** `g044` "dial" — 0.181 s on screen, short by 0.049 s
- **test 2** `g048` "w7essa" — 0.160 s on screen, short by 0.070 s
- **test 2** `g049` "chher" — 0.180 s on screen, short by 0.050 s
- **test 2** `g052` "kidom" — 0.099 s on screen, short by 0.131 s
- **test 2** `g053` "mabin" — 0.221 s on screen, short by 0.009 s
- **test 2** `g055` "tal" — 0.141 s on screen, short by 0.089 s
- **test 2** `g059` "diri" — 0.201 s on screen, short by 0.029 s
- **test 2** `g062` "le" — 0.180 s on screen, short by 0.050 s
- **test 2** `g064` "le" — 0.140 s on screen, short by 0.090 s
- **test 2** `g066` "les" — 0.201 s on screen, short by 0.029 s
- **test 3** `g002` "ghadi" — 0.200 s on screen, short by 0.030 s
- **test 3** `g006` "la" — 0.139 s on screen, short by 0.091 s
- **test 3** `g008` "dial" — 0.220 s on screen, short by 0.010 s
- **test 3** `g017` "fa" — 0.030 s on screen, short by 0.200 s
- **test 3** `g020` "li" — 0.120 s on screen, short by 0.110 s
- **test 3** `g021` "fiha" — 0.220 s on screen, short by 0.010 s
- **test 3** `g024` "non" — 0.140 s on screen, short by 0.090 s
- **test 3** `g029` "lnnas" — 0.139 s on screen, short by 0.091 s
- **test 3** `g030` "li" — 0.121 s on screen, short by 0.109 s
- **test 3** `g031` "3ndhom" — 0.219 s on screen, short by 0.011 s
- **test 3** `g032` "les" — 0.161 s on screen, short by 0.069 s
- **test 3** `g035` "wli" — 0.220 s on screen, short by 0.010 s
- **test 3** `g036` "3ndhom" — 0.200 s on screen, short by 0.030 s
- **test 3** `g037` "les" — 0.160 s on screen, short by 0.070 s
- **test 3** `g039` "pigmentés" — 0.020 s on screen, short by 0.210 s
- **test 3** `g047` "4" — 0.121 s on screen, short by 0.109 s
- **test 3** `g049` "l7essass" — 0.100 s on screen, short by 0.130 s
- **test 3** `g050` "mabin" — 0.179 s on screen, short by 0.051 s
- **vitasilk** `g001` "5" — 0.000 s on screen, short by 0.230 s
- **vitasilk** `g011` "un" — 0.201 s on screen, short by 0.029 s
- **vitasilk** `g014` "ghayrdd" — 0.040 s on screen, short by 0.190 s
- **vitasilk** `g021` "le" — 0.161 s on screen, short by 0.069 s
- **vitasilk** `g024` "mn" — 0.120 s on screen, short by 0.110 s
- **vitasilk** `g025` "la" — 0.141 s on screen, short by 0.089 s
- **vitasilk** `g029` "mn" — 0.040 s on screen, short by 0.190 s
- **vitasilk** `g030` "ghir" — 0.140 s on screen, short by 0.090 s
- **vitasilk** `g031` "anno" — 0.200 s on screen, short by 0.030 s
- **vitasilk** `g033` "nourrit" — 0.040 s on screen, short by 0.190 s
- **vitasilk** `g036` "fih" — 0.140 s on screen, short by 0.090 s
- **vitasilk** `g039` "et" — 0.141 s on screen, short by 0.089 s
- **vitasilk** `g041` "des" — 0.220 s on screen, short by 0.010 s
- **vitasilk** `g043` "et" — 0.120 s on screen, short by 0.110 s
- **vitasilk** `g044` "c'est" — 0.140 s on screen, short by 0.090 s
- **vitasilk** `g045` "la" — 0.160 s on screen, short by 0.070 s
- **vitasilk** `g051` "chno" — 0.030 s on screen, short by 0.200 s
- **vitasilk** `g052` "katsnay" — 0.179 s on screen, short by 0.051 s
- **vitasilk** `g054` "thllay" — 0.160 s on screen, short by 0.070 s
- **vitasilk** `g060` "ila" — 0.219 s on screen, short by 0.011 s
- **vitasilk** `g063` "la" — 0.140 s on screen, short by 0.090 s
- **vitasilk** `g068` "le" — 0.179 s on screen, short by 0.051 s

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
| 0.13 s (4f) | 223/343 (65%) | 190/343 (55%) | 136/343 (40%) | 117/343 (34%) | 89/343 (26%) |
| 0.20 s (6f) | 172/343 (50%) | 130/343 (38%) | 107/343 (31%) | 82/343 (24%) | 65/343 (19%) |
| 0.27 s (8f) | 119/343 (35%) | 102/343 (30%) | 70/343 (20%) | 58/343 (17%) | 46/343 (13%) |
| 0.33 s (10f) | 89/343 (26%) | 70/343 (20%) | 55/343 (16%) | 44/343 (13%) | 28/343 (8%) |
| 0.40 s (12f) | 65/343 (19%) | 49/343 (14%) | 41/343 (12%) | 22/343 (6%) | 15/343 (4%) |

## ground truth

| intro+outro | minHold | floor | subtitle groups | merges |
|---|---|---|---|---|
| 0.13 | 0.10 | 0.23 | 43/76 (57%) | 0 |
| 0.13 | 0.15 | 0.28 | 36/76 (47%) | 0 |
| 0.13 | 0.20 | 0.33 | 26/76 (34%) | 0 |
| 0.13 | 0.25 | 0.38 | 22/76 (29%) | 0 |
| 0.13 | 0.30 | 0.43 | 19/76 (25%) | 0 |
| 0.20 | 0.10 | 0.30 | 32/76 (42%) | 0 |
| 0.20 | 0.15 | 0.35 | 24/76 (32%) | 0 |
| 0.20 | 0.20 | 0.40 | 21/76 (28%) | 0 |
| 0.20 | 0.25 | 0.45 | 16/76 (21%) | 0 |
| 0.20 | 0.30 | 0.50 | 13/76 (17%) | 0 |
| 0.27 | 0.10 | 0.37 | 23/76 (30%) | 0 |
| 0.27 | 0.15 | 0.42 | 21/76 (28%) | 0 |
| 0.27 | 0.20 | 0.47 | 14/76 (18%) | 0 |
| 0.27 | 0.25 | 0.52 | 13/76 (17%) | 0 |
| 0.27 | 0.30 | 0.57 | 11/76 (14%) | 0 |
| 0.33 | 0.10 | 0.43 | 19/76 (25%) | 0 |
| 0.33 | 0.15 | 0.48 | 14/76 (18%) | 0 |
| 0.33 | 0.20 | 0.53 | 12/76 (16%) | 0 |
| 0.33 | 0.25 | 0.58 | 10/76 (13%) | 0 |
| 0.33 | 0.30 | 0.63 | 6/76 (8%) | 0 |
| 0.40 | 0.10 | 0.50 | 13/76 (17%) | 0 |
| 0.40 | 0.15 | 0.55 | 11/76 (14%) | 0 |
| 0.40 | 0.20 | 0.60 | 9/76 (12%) | 0 |
| 0.40 | 0.25 | 0.65 | 5/76 (7%) | 0 |
| 0.40 | 0.30 | 0.70 | 3/76 (4%) | 0 |

Raw group speech duration, s: min 0.000 · p10 0.059 · median 0.200 · max 0.859 (n=76)

Silence after each group, s: min 0.006 · p10 0.019 · median 0.040 · max 0.460 (n=76)

Shortest group: `g004` "pigmentés" at 0.000 s, with 0.010 s of silence after it.

## test 1

| intro+outro | minHold | floor | subtitle groups | merges | keywords | image slots |
|---|---|---|---|---|---|---|
| 0.13 | 0.10 | 0.23 | 46/67 (69%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.13 | 0.15 | 0.28 | 39/67 (58%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.13 | 0.20 | 0.33 | 28/67 (42%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.13 | 0.25 | 0.38 | 24/67 (36%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.13 | 0.30 | 0.43 | 16/67 (24%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.20 | 0.10 | 0.30 | 38/67 (57%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.20 | 0.15 | 0.35 | 28/67 (42%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.20 | 0.20 | 0.40 | 20/67 (30%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.20 | 0.25 | 0.45 | 14/67 (21%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.20 | 0.30 | 0.50 | 10/67 (15%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.27 | 0.10 | 0.37 | 24/67 (36%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.27 | 0.15 | 0.42 | 18/67 (27%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.27 | 0.20 | 0.47 | 11/67 (16%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.27 | 0.25 | 0.52 | 9/67 (13%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.27 | 0.30 | 0.57 | 7/67 (10%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.33 | 0.10 | 0.43 | 16/67 (24%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.33 | 0.15 | 0.48 | 11/67 (16%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.33 | 0.20 | 0.53 | 8/67 (12%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.33 | 0.25 | 0.58 | 6/67 (9%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.33 | 0.30 | 0.63 | 3/67 (4%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.40 | 0.10 | 0.50 | 10/67 (15%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.40 | 0.15 | 0.55 | 7/67 (10%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.40 | 0.20 | 0.60 | 6/67 (9%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.40 | 0.25 | 0.65 | 3/67 (4%) | 0 | 1/2 (50%) | 4/4 (100%) |
| 0.40 | 0.30 | 0.70 | 2/67 (3%) | 0 | 1/2 (50%) | 4/4 (100%) |

Raw group speech duration, s: min 0.000 · p10 0.061 · median 0.261 · max 0.639 (n=67)

Silence after each group, s: min 0.000 · p10 0.020 · median 0.040 · max 0.620 (n=67)

Shortest group: `g009` "tb3i" at 0.000 s, with 0.030 s of silence after it.

## test 2

| intro+outro | minHold | floor | subtitle groups | merges | keywords |
|---|---|---|---|---|---|
| 0.13 | 0.10 | 0.23 | 43/69 (62%) | 0 | 3/3 (100%) |
| 0.13 | 0.15 | 0.28 | 35/69 (51%) | 0 | 3/3 (100%) |
| 0.13 | 0.20 | 0.33 | 25/69 (36%) | 0 | 3/3 (100%) |
| 0.13 | 0.25 | 0.38 | 21/69 (30%) | 0 | 3/3 (100%) |
| 0.13 | 0.30 | 0.43 | 15/69 (22%) | 0 | 3/3 (100%) |
| 0.20 | 0.10 | 0.30 | 29/69 (42%) | 0 | 3/3 (100%) |
| 0.20 | 0.15 | 0.35 | 22/69 (32%) | 0 | 3/3 (100%) |
| 0.20 | 0.20 | 0.40 | 19/69 (28%) | 0 | 3/3 (100%) |
| 0.20 | 0.25 | 0.45 | 14/69 (20%) | 0 | 3/3 (100%) |
| 0.20 | 0.30 | 0.50 | 11/69 (16%) | 0 | 3/3 (100%) |
| 0.27 | 0.10 | 0.37 | 22/69 (32%) | 0 | 3/3 (100%) |
| 0.27 | 0.15 | 0.42 | 17/69 (25%) | 0 | 3/3 (100%) |
| 0.27 | 0.20 | 0.47 | 12/69 (17%) | 0 | 3/3 (100%) |
| 0.27 | 0.25 | 0.52 | 8/69 (12%) | 0 | 3/3 (100%) |
| 0.27 | 0.30 | 0.57 | 7/69 (10%) | 0 | 2/3 (67%) |
| 0.33 | 0.10 | 0.43 | 15/69 (22%) | 0 | 3/3 (100%) |
| 0.33 | 0.15 | 0.48 | 12/69 (17%) | 0 | 3/3 (100%) |
| 0.33 | 0.20 | 0.53 | 8/69 (12%) | 0 | 2/3 (67%) |
| 0.33 | 0.25 | 0.58 | 7/69 (10%) | 0 | 1/3 (33%) |
| 0.33 | 0.30 | 0.63 | 3/69 (4%) | 0 | 1/3 (33%) |
| 0.40 | 0.10 | 0.50 | 11/69 (16%) | 0 | 3/3 (100%) |
| 0.40 | 0.15 | 0.55 | 7/69 (10%) | 0 | 2/3 (67%) |
| 0.40 | 0.20 | 0.60 | 7/69 (10%) | 0 | 1/3 (33%) |
| 0.40 | 0.25 | 0.65 | 2/69 (3%) | 0 | 1/3 (33%) |
| 0.40 | 0.30 | 0.70 | 2/69 (3%) | 0 | 0/3 (0%) |

Raw group speech duration, s: min 0.000 · p10 0.081 · median 0.239 · max 0.640 (n=69)

Silence after each group, s: min 0.001 · p10 0.020 · median 0.041 · max 1.200 (n=69)

Shortest group: `g021` "fa" at 0.000 s, with 0.020 s of silence after it.

## test 3

| intro+outro | minHold | floor | subtitle groups | merges |
|---|---|---|---|---|
| 0.13 | 0.10 | 0.23 | 40/58 (69%) | 0 |
| 0.13 | 0.15 | 0.28 | 34/58 (59%) | 0 |
| 0.13 | 0.20 | 0.33 | 25/58 (43%) | 0 |
| 0.13 | 0.25 | 0.38 | 23/58 (40%) | 0 |
| 0.13 | 0.30 | 0.43 | 20/58 (34%) | 0 |
| 0.20 | 0.10 | 0.30 | 32/58 (55%) | 0 |
| 0.20 | 0.15 | 0.35 | 25/58 (43%) | 0 |
| 0.20 | 0.20 | 0.40 | 23/58 (40%) | 0 |
| 0.20 | 0.25 | 0.45 | 19/58 (33%) | 0 |
| 0.20 | 0.30 | 0.50 | 16/58 (28%) | 0 |
| 0.27 | 0.10 | 0.37 | 23/58 (40%) | 0 |
| 0.27 | 0.15 | 0.42 | 23/58 (40%) | 0 |
| 0.27 | 0.20 | 0.47 | 17/58 (29%) | 0 |
| 0.27 | 0.25 | 0.52 | 14/58 (24%) | 0 |
| 0.27 | 0.30 | 0.57 | 10/58 (17%) | 0 |
| 0.33 | 0.10 | 0.43 | 20/58 (34%) | 0 |
| 0.33 | 0.15 | 0.48 | 17/58 (29%) | 0 |
| 0.33 | 0.20 | 0.53 | 13/58 (22%) | 0 |
| 0.33 | 0.25 | 0.58 | 10/58 (17%) | 0 |
| 0.33 | 0.30 | 0.63 | 7/58 (12%) | 0 |
| 0.40 | 0.10 | 0.50 | 16/58 (28%) | 0 |
| 0.40 | 0.15 | 0.55 | 11/58 (19%) | 0 |
| 0.40 | 0.20 | 0.60 | 9/58 (16%) | 0 |
| 0.40 | 0.25 | 0.65 | 5/58 (9%) | 0 |
| 0.40 | 0.30 | 0.70 | 3/58 (5%) | 0 |

Raw group speech duration, s: min 0.000 · p10 0.100 · median 0.240 · max 0.660 (n=58)

Silence after each group, s: min 0.000 · p10 0.019 · median 0.059 · max 0.760 (n=58)

Shortest group: `g017` "fa" at 0.000 s, with 0.030 s of silence after it.

## vitasilk

| intro+outro | minHold | floor | subtitle groups | merges | keywords | image slots |
|---|---|---|---|---|---|---|
| 0.13 | 0.10 | 0.23 | 51/73 (70%) | 0 | 3/3 (100%) | 5/5 (100%) |
| 0.13 | 0.15 | 0.28 | 46/73 (63%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.13 | 0.20 | 0.33 | 32/73 (44%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.13 | 0.25 | 0.38 | 27/73 (37%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.13 | 0.30 | 0.43 | 19/73 (26%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.20 | 0.10 | 0.30 | 41/73 (56%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.20 | 0.15 | 0.35 | 31/73 (42%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.20 | 0.20 | 0.40 | 24/73 (33%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.20 | 0.25 | 0.45 | 19/73 (26%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.20 | 0.30 | 0.50 | 15/73 (21%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.27 | 0.10 | 0.37 | 27/73 (37%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.27 | 0.15 | 0.42 | 23/73 (32%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.27 | 0.20 | 0.47 | 16/73 (22%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.27 | 0.25 | 0.52 | 14/73 (19%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.27 | 0.30 | 0.57 | 11/73 (15%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.33 | 0.10 | 0.43 | 19/73 (26%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.33 | 0.15 | 0.48 | 16/73 (22%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.33 | 0.20 | 0.53 | 14/73 (19%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.33 | 0.25 | 0.58 | 11/73 (15%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.33 | 0.30 | 0.63 | 9/73 (12%) | 0 | 0/3 (0%) | 5/5 (100%) |
| 0.40 | 0.10 | 0.50 | 15/73 (21%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.40 | 0.15 | 0.55 | 13/73 (18%) | 0 | 2/3 (67%) | 5/5 (100%) |
| 0.40 | 0.20 | 0.60 | 10/73 (14%) | 0 | 1/3 (33%) | 5/5 (100%) |
| 0.40 | 0.25 | 0.65 | 7/73 (10%) | 0 | 0/3 (0%) | 5/5 (100%) |
| 0.40 | 0.30 | 0.70 | 5/73 (7%) | 0 | 0/3 (0%) | 5/5 (100%) |

Raw group speech duration, s: min 0.000 · p10 0.080 · median 0.259 · max 1.260 (n=73)

Silence after each group, s: min 0.000 · p10 0.020 · median 0.060 · max 0.381 (n=73)

Shortest group: `g001` "5" at 0.000 s, with 0.000 s of silence after it.

## Pooled

Raw group speech duration, s: min 0.000 · p10 0.080 · median 0.240 · max 1.260 (n=343)

Silence after each group, s: min 0.000 · p10 0.020 · median 0.041 · max 1.200 (n=343)

