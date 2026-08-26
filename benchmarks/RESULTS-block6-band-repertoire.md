# Block 6 — the subtitle band measured from the real character repertoire

**No. The honest band does not recover the torso capability.**

Measuring the band from the glyphs the orthography can actually produce,
rather than from the fonts' OS/2 maximum-ink figures, shrinks it by **15.46 px
out of 1032.86 — 1.50%**. The top moves down by **3.64 px**. Every torso zone
in the corpus stays unusable, on every reading of the repertoire, including one
that is too aggressive to defend. The band was never the reason torso zones
died; the anchor position is.

Session 4, no API calls. Measured against the five Edit Plans and the four
`.local/ground-truth/*.txt` references.

## 1. The repertoire

81 distinct characters across nine sources (five plans, four references).

**Latin, 52 characters:**

```
' 0 1 2 3 4 5 6 7 8 9 ?
A B D E F K L M N P R S T V W
a b c d e f g h i j k l m n o p q r s t u v w y z
```

**Arabic, 26 characters:**

```
؟ إ ئ ا ب ة ت ج ح خ د ر ز ش ض ط ع ف ق ك ل م ن ه و ي
```

**Accented, 2:** `è` (U+00E8, vitasilk) and `é` (U+00E9, ground-truth, test-1,
test-2).

**Arabic diacritics: none.** Not one character in U+064B–U+0652 or U+0670
appears anywhere in the corpus — zero fatha, damma, kasra, sukun, shadda or
tanwin. This is what ORTHOGRAPHY_GUIDE §1 predicts, which permits full
vocalization only for religious quotations, and the corpus contains none.

**Nothing unexpected.** The apostrophe is U+0027 straight throughout — the
curly U+2019 that Block 3 session 2 removed has not come back. One space
character, U+0020; no non-breaking space. No Arabic presentation forms
(U+FB50–U+FEFF) in the source text: the plans store base codepoints and leave
positional shaping to the renderer, which is correct.

**Caveat, stated once and applying to everything below: this is five reels of
one client in one domain, two speakers.** The Arabic set is missing eleven
letters that plainly can occur — `س ث ذ ص ظ غ أ آ ؤ ى ء` — which is precisely
why §2 does not measure the band from the corpus alone.

## 2. Real ink extents

Measured with fontTools from glyph outlines — `glyf` bounding boxes through a
pen, so composites resolve — not from OS/2 table values.

```
~/Library/Fonts/Inter-VariableFont_opsz,wght.ttf   (instantiated at wght=600)
~/Library/Fonts/Almarai-Bold.ttf
```

**Only default-on layout features are followed** when expanding characters to
glyphs: `ccmp locl rlig liga clig calt kern mark mkmk init medi fina isol curs
rvrn rclt`. Stylistic sets, `salt`, `zero`, `titl` and the `cvNN` alternates
are excluded, because After Effects does not enable them and a glyph reachable
only through one is not a glyph this pipeline can render. Including them put
Inter's extremes on `zero.slash.circled` (2144 / −654), which nothing will ever
draw.

### The margin

The corpus repertoire alone is not what the band is built on. The measured set
is widened to everything the orthography permits:

- every unvocalized Arabic letter U+0621–U+064A, in all four positional forms,
  reached through the joining features above
- Arabic punctuation `؟ ، ؛`
- printable ASCII U+0020–U+007E
- the accented French set §5 allows: `à â ä ç é è ê ë î ï ô ö ù û ü ÿ` and
  capitals, `œ Œ « » ’`

**The margin is the widening itself, and it is not a round number added on
top.** Stated as a figure: for the binding face it is **+300 font units of
ascent, 800 → 1100, a 37.5% increase** over what the corpus alone reaches. No
further pad was added, because a pad on top of a set that already covers every
permitted glyph would be a number with no evidence behind it.

### Per font and size

| font | size px | tallest glyph | ascent px | deepest glyph | descent px |
|---|---|---|---|---|---|
| Inter Semi-Bold | 343 | `bar` (1970) | 329.90 | `bar` (−480) | 80.39 |
| Inter Semi-Bold | 425 | `bar` (1970) | 408.81 | `bar` (−480) | 99.61 |
| Almarai Bold | 367.01 | `uniFDF2` (1100) | 403.71 | `uniFEF2` (−427) | 156.71 |
| **Almarai Bold** | **454.75** | **`uniFDF2` (1100)** | **500.23** | **`uniFEF2` (−427)** | **194.18** |

`uniFDF2` is ﷲ, the Allah ligature, which `rlig` produces from the sequence
لله. **The corpus contains no such sequence** — checked directly, `لله` and
`الله` both absent — but §6(b) explicitly permits religious formulas, so it is
in the measured set. `uniFEF2` is ﻲ, final-form yeh, which the corpus uses
constantly.

`bar` is the ASCII pipe. It is the tallest and deepest Latin glyph and is
almost certainly never rendered, but it costs nothing to carry: Almarai binds
the band in both directions regardless.

### Against session 3's usWin figures

| face | metric | session 3 (usWin) | measured | delta |
|---|---|---|---|---|
| Almarai Bold | ascent units | 1108 | **1100** | −8 |
| Almarai Bold | descent units | 453 | **427** | −26 |
| Inter Semi-Bold | ascent units | 2269 | 1970 | −299 |
| Inter Semi-Bold | descent units | 660 | 480 | −180 |

**Inter shrinks a great deal and it changes nothing**, because Almarai is the
taller face at every size and sets the band alone. Almarai's usWin figures are
within 8 and 26 units of its real glyph extremes, so there was almost nothing
to recover.

### Vocalization cannot exceed the envelope

The one way a religious quotation could break this is a stacked diacritic
reaching above an unvocalized letter. It cannot, and this was resolved from the
font rather than assumed:

- the harakat glyphs' own outlines top out at **747** (U+0670) and bottom at
  **−312** (U+064D)
- Almarai's GPOS has 25 `MarkBasePos` subtables; the highest base anchor is
  **407** and the highest mark anchor **390**
- so an attached mark's ink top is bounded by 407 + (747 − 390) = **764**

764 against an unvocalized maximum of 1100. **A fully vocalized religious quote
stays inside the band as measured.**

## 3. The candidate band

Same arithmetic as session 3: worst case is two lines at the keyword size in
the taller face, `top = anchor − ascent`, `bottom = anchor + lineSpacing +
descent`, anchor y 2480.4 on a 3840 frame.

```
top    = 2480.4 − 500.2250        = 1980.1750 px
bottom = 2480.4 + 323 + 194.1782  = 2997.5783 px
```

| | session 3 (usWin) | candidate (repertoire) | difference |
|---|---|---|---|
| top px | 1976.5370 | **1980.1750** | **3.64 px lower** |
| bottom px | 3009.4017 | **2997.5783** | **11.82 px higher** |
| height px | 1032.8647 | **1017.4033** | **15.46 px shorter (1.50%)** |
| y | 0.5147231771 | **0.5156705729** | |
| h | 0.2689751953 | **0.2649487630** | |

### Torso recovery — the question this session exists to answer

Torso zones are bounded below by the band top, so only the 3.64 px matters.
Block 5 session 6's torso rects, re-bounded and run through card clearance,
`FILL_FRACTION` 0.88 and `SCALE_JITTER`, against `MIN_PLACED_SHORT_EDGE` of
324 px:

| reel | old rect height | session 3 band | candidate band | usable? |
|---|---|---|---|---|
| ground-truth | 898 px | 168.5 | **171.5** | no |
| test-1 | 886 px | 158.8 | **161.7** | no |
| test-2 | 674 px | −12.8 | **−9.9** | no |
| test-3 | 482 px | gone | **gone** | no |

**Not one reel recovers a usable torso zone.** The candidate buys between 2.9
and 3.0 px of placed square where 162 to 324 px are missing.

Two more aggressive readings were computed and both also fail, which is what
makes the answer robust rather than a matter of where the margin was drawn:

| reading | Almarai ascent | band top | best reel | usable? |
|---|---|---|---|---|
| candidate (permitted repertoire) | 1100 | 1980.18 | 171.5 | no |
| drop the Allah ligature | 997 | 2027.01 | 209.4 | no |
| corpus only, no ligature | 800 | 2116.60 | 281.9 | no |

The last row would require asserting that the orthography can never produce a
religious formula, which contradicts §6(b), and it *still* fails on all four
reels.

### Why the band was never the cause

For test-1's torso zone to hold the minimum square it needs **486.6 px** of
height, so the band top would have to sit at or below **2180.6 px**. With the
anchor at 2480.4 that implies a maximum ascent of **299.8 px**, which at the
keyword size is **659 Almarai units**. The font's real maximum is 1100.

**There is no honest measurement of this font at this size that reaches it.**
The torso strip was closed by where the subtitle baseline sits, not by how
generously its extent was estimated. Recovering it requires changing the anchor,
the keyword size, `MIN_PLACED_SHORT_EDGE`, or the rule that images never overlap
the band — all product decisions, none of them a measurement.

## 4. What was landed

The candidate is smaller, so it replaced the constant. It is a 1.50% change
that alters no placement and recovers no capability; it is landed because it is
better founded, not because it does anything.
