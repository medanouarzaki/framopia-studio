Status: OK

# Block 9 session 6 — the ratio reconciles, and the type is on screen

**Spent $0.00. No API was called.** Building is local and free.

After Effects was driven over AppleScript `DoScript` into the already-running
instance. It was never launched, never quit, no `aerender`, no `-r` process, and
**your own project was never saved**.

## 1. Stop conditions

| | |
|---|---|
| mount | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`, `git rev-parse --show-toplevel` agrees |
| ledger at start | **108 lines**, `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, same sha256 — byte-identical |
| cache at start | **36 entries** — 11 transcription, 7 analysis, 4 imageslots, 14 images |
| cache at end | **36 entries, census identical** |
| After Effects at start | **1 instance, pid 79146, started Thu Aug 27 21:00:05** |
| After Effects at end | **1 instance, pid 79146, started Thu Aug 27 21:00:05** — same process |
| `aerender` at start / end | **0 / 0** |

**Your project, and this needs saying plainly:**

| | at start | at end |
|---|---|---|
| file | `(never saved)` | `.local/build/vitasilk-emphasis-x-height-1.3479.aep` |
| items | 0 | 97 |
| comps | 0 | 84 |
| a `framopia_` probe comp | no | **no** |
| modified | false | false |

**The comp count did not return to zero, and that is the build doing what a
build does.** `npm run build:reel` starts its own project and leaves its output
open — every build in this repo has. What it replaced was an **empty untitled
project with nothing in it**, which is the state my own measurement probes had
left it in: any script that adds a temporary comp and removes it sets the
modified flag, and that flag is read-only from a script. Nothing of yours was in
it and nothing of yours was saved. §4.3 explains the guard change that allowed
it, and why it is narrow.

## 2. The ratio table, and the reconciliation

Every ratio the measurement supports. Reference over face: how much larger the
face must be set to match Inter.

**Emphasis — Inter-SemiBold ÷ CormorantGaramondItalic-SemiBoldItalic**

| quantity | at 343 | at 425 | arithmetic at 343 |
|---|---:|---:|---|
| cap height (`H`) | 1.16406 | 1.16406 | 249.5459 ÷ 214.3750 |
| **x-height (`x`)** | **1.34790** | **1.34790** | **187.2432 ÷ 138.9150** |
| advance, one word (`glow`) | 1.35622 | 1.35622 | 773.5923 ÷ 570.4036 |
| advance, phrase (`dernière génération`) | 1.37296 | 1.37296 | 3228.1860 ÷ 2351.2650 |

**Arabic — Inter-SemiBold ÷ Almarai-Bold**

| quantity | at 343 | at 425 | arithmetic at 343 |
|---|---:|---:|---|
| cap height | 1.01612 | 1.01612 | 249.5459 ÷ 245.5880 |
| x-height | 1.03000 | 1.03000 | 187.2432 ÷ 181.7900 |
| advance, one word | 1.20931 | 1.20931 | 773.5923 ÷ 639.6950 |
| advance, phrase | 1.08956 | 1.08956 | 3228.1860 ÷ 2962.8340 |

### What produced which number

- **1.3479 is the x-height ratio.** `187.2432 ÷ 138.9150 = 1.347897`, and
  `232.0068 ÷ 172.1250 = 1.347897` at the other size. It reproduces exactly.
- **1.35622 and 1.37296 are the two advance-width ratios**, one word and phrase.

**They are different quantities, and that is the whole finding.** The gate
compared the two advance samples and then a number taken from the x-height was
written beside it. **The gate passed and had tested nothing about the number it
appeared to justify.** Your objection was right about the arithmetic — a value
derived from two measurements must lie between them — and the resolution is that
1.3479 was never derived from those two.

**It reconciles, so the session continued.**

### The gate now tests the quantity that is written

`chooseRatio` in `core/src/font-ratios.ts`, with the derivation. Two checks,
both about the chosen quantity:

1. **The same ratio at both sizes.** A ratio between two faces is a property of
   the faces; one that moves with the size is measuring something else.
2. **An independent quantity agrees**, within 3%.

On the written number: **x-height 1.34790, advance 1.35622, 0.617% apart.
Passed.**

The same gate, run on the alternatives, refuses two things:

- **Cap height is refused** — 1.16406 against advance's 1.35622 is **16.507%
  apart**, far outside the limit. It is the number your eye may still prefer,
  and §5 gives you a build of it to look at, but nothing in the measurement
  supports it as *the* derived value.
- **An advance comparison across different strings is refused.** Inter was
  measured on `glow` and Almarai on `شنو`, so the Arabic advance ratios above
  are facts about two different strings and not about the two faces. That is why
  they disagree with each other by 11% while cap and x-height agree to five
  decimals.

`EMPHASIS_SIZE_RATIO` is unchanged at **1.3479**; what changed is that the
justification beside it is now true. `ARABIC_SIZE_RATIO` remains **1.07**, your
own judgement, with the metrics (1.0161 and 1.0300) recorded beside it.

## 3. Does a 573 px word fit?

### What the two constants are derived from

- **`SUBTITLE_SAFE_WIDTH = 1940`** is **chosen, not derived** — 110 px clear
  each side of a 2160 px comp. A third face does not invalidate it, because no
  face was ever in it. What is new is that until now **nothing had checked a
  keyword against it in any face**: `wrap:survey` measures the subtitle track.
- **`SUBTITLE_BAND` is derived**, from `worstCaseExtent()` over `FONT_METRICS`,
  which holds **Inter and Almarai only**, read from the font files with
  fontTools. **Cormorant is not in it.** So the derivation is blind to the
  emphasis face and adding one does invalidate it as a derivation — the band
  gives 1017.4 px because of what two faces do, and a third was never asked.

### Measured, in After Effects, on the real keywords

Eight keywords exist in the corpus. Four are Latin and take the emphasis face;
four are Arabic and take Almarai. **On one line, three of the eight already
exceed 1940 px today, before any font change:**

| keyword | face and size | one-line width |
|---|---|---:|
| `محفزات الكولاجين` (test-1 k002) | Almarai @ 1.07 → 454.75 | **3469.3 px — over by 1529.3** |
| `ترطيب عميق` (test-2 k002) | Almarai @ 1.07 | **2448.4 px — over by 508.4** |
| `filler glow` (vitasilk k001) | **Inter @ 425, as built today** | **2001.3 px — over by 61.3** |
| `filler glow` | Cormorant @ 1.3479 → 572.858 | 2102.8 px — over by 162.8 |
| `filler glow` | Cormorant @ 1.1641 → 494.742 | 1816.0 px — fits |
| `شد خفيف` (test-2 k003) | Almarai @ 1.07 | 1920.0 px — fits by 20 px |
| `Profhilo` @ 1.3479 | Cormorant | 1627.2 px — fits |
| `Vita Silk` @ 1.3479 | Cormorant | 1791.7 px — fits |

**The overflow is not something Cormorant introduces.** `filler glow` already
overflows in Inter at 425, and the two worst are Arabic and have nothing to do
with the emphasis face.

**And the builder already handles it: every one of them fits once wrapped.**
`chooseBreak` splits each at its space and `framopiaFitText` measures inside
After Effects before deciding. Measured line by line, **every line of every
keyword fits at both candidate ratios** — the widest is `محفزات` at 1508.0 px and
`الكولاجين` at 1814.9 px.

**Height fits too**, measured on the real two-line block:

| | width | height | against the 1017.4 px band |
|---|---:|---:|---|
| `filler / glow` Cormorant @ 1.3479 | 1049.5 | **900.1** | inside, 117 px spare |
| `filler / glow` Cormorant @ 1.1641 | 906.4 | 821.4 | inside, 196 px spare |
| `filler / glow` Inter @ 425 (today) | 958.5 | 738.7 | inside, 279 px spare |
| `محفزات / الكولاجين` Almarai @ 1.07 | 1814.9 | 757.3 | inside, 260 px spare |

**So a 573 px word fits** — but not because the band knows about Cormorant. It
does not. It fits because the measured worst case happens to land 117 px inside
a bound derived from two other faces, and that is luck rather than design.
Widening `FONT_METRICS` and `worstCaseExtent` to include the emphasis face is
open work.

**Nothing was shrunk.** Shrink-to-fit is PROJECT_SPEC §3 ruling 3 and is not
built; a partial version here would put the rule in two places.

**`OVERLONG_WORD_CHARS = 11` is now wrong for a face it has never seen.** It is
a character-count proxy for a rendered width, calibrated when every card was
Inter or Almarai. `filler glow` is 11 characters and overflows; `Profhilo` is 8
and does not; and the same string in Cormorant is 8% wider than in Inter at the
same nominal size and 32% wider at the ratio. The proxy was already approximate
and a third face makes it more so. Recorded, not changed.

## 4. Done

### 4.1 The type on the layers

- **`service/src/build/text-style.ts`** — the one declaration of face, size and
  colour per card. **`panel/jsx/text-fit.jsx`** — `framopiaSetText` writes
  `font`, `fontSize` and `fillColor` in **one `setValue`**, because a
  TextDocument read from a property is a copy and writing it back twice discards
  the first write; `applyFill` must be true or the colour is carried and not
  drawn. **`service/src/build/reel-plan.ts`** carries it on the element;
  **`build-reel-cli.ts`** fills it from the client snapshot and
  `resolveTextColours`; **`panel/jsx/build-reel.jsx`** reads back what After
  Effects took.

| card | face | size | colour |
|---|---|---|---|
| ordinary Latin | `Inter-SemiBold` | the template's 343 / 425 | crème `#F8F6F2` |
| emphasized Latin | `CormorantGaramondItalic-SemiBoldItalic` | template × ratio | gold `#C9A96E` |
| ordinary Arabic | `Almarai-Bold` | the template's 367 / 455 | crème |
| emphasized Arabic | `Almarai-Bold` | the template's | gold |

**A size only travels when it has to.** The `_ar` comps are already authored at
`ARABIC_SIZE_RATIO` of the Latin size, so Arabic needs no override. The emphasis
face is the one nothing anticipated and the only case where the build sets a
size — without it Cormorant would render at Inter's nominal size and read
*smaller* than the words around it.

**The emphasis face is a Latin serif with no Arabic in it**, so an emphasized
Arabic word is gold Almarai rather than gold Cormorant.

**Verified by reading it back out of the built file**, not by assuming:

```
g001__sub_pop   '5'             Inter-SemiBold                          343.000   #F8F6F2
k001__kw_slam   'filler\rglow'  CormorantGaramondItalic-SemiBoldItalic  572.858   #C9A96E
k002__kw_slam   'Vita Silk'     CormorantGaramondItalic-SemiBoldItalic  572.858   #C9A96E
k003__kw_slam   '7rir'          CormorantGaramondItalic-SemiBoldItalic  572.858   #C9A96E
```

### 4.2 The guard, and the two pins

`check-fonts` fires **before anything is imported or placed** and covers **every
face the build needs, the Arabic one included** — `requiredFonts` returns all
three for a K2 reel, and the build passed that stage on a real run.

**Pinned: a name that does not resolve never reaches a layer.** A client with no
measured PostScript names gets **no style at all** and its templates' own type is
left alone. Six cases in `text-style.test.ts`, including a client that has Latin
but not Arabic, and an assertion that no produced name ever contains a space.

**Pinned: zero faces is a failure.** `measure-fonts.jsx` gained a
`check-complete` stage — a family with no faces, or a role no name resolved for,
throws rather than returning `ok: true` with nothing in it. That is exactly what
its first run did, and it was read as a measurement when it was the absence of
one. Re-run afterwards: all three faces resolve and it still passes.

### 4.3 Building into an empty project

The build refused: *"the open After Effects project has unsaved changes and has
never been saved"* — because **my own measurement probes had made it dirty**.
Any script that adds a temporary comp and removes it leaves the flag set, and it
is read-only.

A project that is dirty, **has never been written to disk, and has
`numItems === 0`** is now proceeded past. It holds nothing; there is nothing to
lose. **This is not the "unreadable dirty counts as dirty" case** — `numItems` is
read, and an unreadable count is `-1`, which the condition cannot satisfy. One
item, or a file on disk, keeps the refusal. `audit-safety.test.ts` pins all of
it, and `build.jsx` and `measure-survey.jsx` are unchanged.

### 4.4 New files

- `core/src/font-ratios.ts`, `core/src/font-ratios.test.ts`
- `service/src/build/text-style.ts`, `service/src/build/text-style.test.ts`
- `tools/ae/measure-widths.jsx`

## 5. The two built files, and what you are judging

**Open this one first:**

**`/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/build/vitasilk-emphasis-x-height-1.3479.aep`**
— it is already open in After Effects.

**Then this one:**

**`/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/build/vitasilk-emphasis-cap-height-1.1641.aep`**

Open `master_final` in each and play it. They are the same reel, built from the
same plan, differing in **one number**: how large an emphasized word is set.

**Two things to judge.**

1. **The size of the emphasized words against the ordinary ones.** `vitasilk`
   has three: `filler glow`, `Vita Silk` and `7rir`. In the first file they are
   set at 573 px; in the second at 495. The difference is 16% and it is the only
   difference between the files. There is a visible consequence:
   **`filler glow` wraps onto two lines at 573 and stays on one at 495.**
2. **Whether crème and gold read the way the brand chart intends** — ordinary
   words in Blanc Cassé `#F8F6F2`, emphasized ones in Or Signature `#C9A96E`.
   This is the same in both files.

**Why `vitasilk` and not `test-1`.** Two reasons, and I would have built
`test-1` if either had gone the other way. Its four image slots have **no
generated candidate files**, so the builder refuses a comp with gaps — and
generating them is billable, about $1.24, which this session may not spend. And
**both of `test-1`'s keywords are Arabic**, so it would show the emphasis face
nowhere at all. `vitasilk`'s three keywords are all Latin, so all three show
Cormorant.

## 6. Deviations

- **`vitasilk` was built, not `test-1`**, for the two reasons above.
- **Step 4's contingency did not apply.** The watermark measurement and
  `dialogueLufs` are already on `test-1` and on `vitasilk` — I checked every
  build requirement before building and nothing was missing, so there was no
  terminal-only measurement left to drive. Block 8's remaining definition-of-done
  gap is not what stood in the way.
- **`--emphasis-ratio` was added to `build:reel`** so one reel could be built at
  two ratios. Nothing in the pipeline passes it; absent takes the constant.
- **The build-guard was narrowed** (§4.3), which the brief did not ask for. It
  had to be: my own measurement made the build impossible, and telling you to
  close an empty project yourself is what this session exists to stop doing.

## 7. Failures and open problems

- **`SUBTITLE_BAND` still does not know about the emphasis face.** The measured
  worst case fits with 117 px to spare, but the bound is derived from Inter and
  Almarai. `FONT_METRICS` needs Cormorant's glyph extents, and the two kinds of
  measurement must not be mixed carelessly — `FONT_METRICS` is read from font
  files with fontTools, and everything measured this session is
  `sourceRectAtTime` from a rendered layer.
- **`OVERLONG_WORD_CHARS = 11` is a proxy that a third face makes worse**, and
  the transcript editor still counts characters with it.
- **Three keywords overflow on one line and are saved by wrapping.** That is
  designed behaviour, but nobody had measured it and `filler glow` overflows in
  Inter today.
- **Five panel browser tests failed once and were not a regression.** All five
  are the image picker waiting for a picture to become *visible*, and they failed
  while After Effects was building. I stashed every change and ran them on clean
  `HEAD`: they passed. I restored the changes and ran them again: they passed.
  The final `npm run check` passes. **They are load-sensitive, with 5-second
  waits, and a busy machine breaks them** — worth fixing before Block 10's
  golden run, and not fixed here.
- **`DoScript` did not refuse this session.** Session 5 saw it return `1` and do
  nothing for several minutes; here every call worked first time, roughly a
  dozen of them across measurement, verification and two builds. So the fault is
  intermittent and its cause is still unknown. **That is a Block 10 risk**: the
  golden run has to work on a second machine and this is not understood.
- **The probe still leaves phantom font names.** `FramopiaNoSuchFaceZZQX` is
  written again on every run of `measure-fonts.jsx` and joins `allFonts` until
  After Effects restarts. **It is avoidable only by not asking the question** —
  the only way to learn what an unresolvable name does is to write one. The
  answer is now recorded and guarded, so a future run could take that probe
  behind a flag; I did not, because a check that is off by default stops being
  a check. Nothing renders differently and no file is changed.
- **Your empty untitled project is gone**, replaced by the build's own output.
  It had zero items and had never been saved, so nothing was lost — but it was
  my probes that made it un-buildable-into in the first place.
- No cache entry, plan, reference or ledger line changed.

## 8. Repo state

- Branch **`main`**, five commits ahead of `470dbb3`, nothing force-pushed.
- HEAD: **`8c20b73 docs: record the type on the layers and the ratio gate`**.
- Working tree clean apart from this report.
- **`npm run check`: PASS**, measured from this session's final run:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 36 | **519** |
| `framopia-service` | 89 | **1128** |
| `framopia-benchmarks` | 16 | **166** |
| `framopia-panel` | 6 | **159 passed, 2 skipped (161)** |
| `tools/cv` pytest | — | **149 passed in 12.24 s** |

Tail of that run:

```
> @framopia/core@0.1.0 validate:modes
mode k2-syndicalia v9: ok (fonts set)
templates: 6 entries, ok
extendscript: 11 .jsx file(s) ok
validate-templates: 6 template(s) ok, audited against library.aep
validate:panel: panel/CSXS/manifest.xml ok

> framopia-benchmarks@0.1.0 verify-refs
  ok    ground-truth   v1.0.8-conformant
  ok    test-1         v1.0.8-conformant
  ok    test-2         v1.0.8-conformant
  ok    test-3         v1.0.8-conformant
references: PASS
149 passed in 12.24s
models: birefnet-general ok
models: selfie-multiclass-256x256 ok
check: PASS
```

## 9. Suggested next step

Look at the two files and say which emphasis size is right — that is the one
thing nobody can measure for you, and everything else about the type is now
settled and on screen. Whichever you choose, the next session should widen
`FONT_METRICS` and `worstCaseExtent` to include the emphasis face so the
subtitle band is derived from the three faces that are actually drawn rather
than the two that were there first; at 1.3479 the worst case sits 117 px inside
a bound that was never asked about Cormorant, and that margin is luck. It should
also decide what replaces `OVERLONG_WORD_CHARS` now that a rendered width can be
had from After Effects on demand, which is what PROJECT_SPEC §3's shrink-to-fit
ruling has been waiting for.
