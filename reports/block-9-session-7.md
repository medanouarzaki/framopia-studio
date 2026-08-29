Status: OK

# Block 9 session 7 — the emphasis size is ruled, and the template pass is written

**Spent $0.00. No API was called.** After Effects was driven over AppleScript
`DoScript` into the already-running instance; it was never launched, never quit,
no `aerender`, no `-r` process, and `templates/library.aep` was never opened for
writing.

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
| `templates/library.aep` at start | `dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa` |
| `templates/library.aep` at end | **identical** |

## 2. The ruled ratio, and what was retired for it

**`EMPHASIS_SIZE_RATIO` is 1.1641, from cap height.** Recorded as a ruling with
its reason: two builds of `vitasilk` from one plan, differing in that number and
nothing else, and the smaller was chosen. **Where a measurement and the user's
eye disagree, his eye decides** — the same principle that settled
`IMPACT_THRESHOLD`, where the measured crossing was 5.25 frames and he said the
word lands at 4.

**What was retired.** `EMPHASIS_SIZE_RATIO`'s comment argued at length for
x-height: the corpus is lowercase, advance width corroborated it within 0.617%,
and cap height sat 16.5% from both. That reasoning was sound and it lost to a
person looking at the screen, which is what the two builds existed for. The
comment now says so rather than being quietly deleted — 1.3479 was never more
than the best guess available until he looked.

**`chooseRatio` still refuses cap height on the numbers alone, and still
should.** The gate exists to stop an underived number reaching the code; it was
never a vote. So the ruled path is named rather than smuggled:
`RULED_EMPHASIS_QUANTITY = 'capHeight'` in `core/src/typography.ts`, and nothing
else has a way past the gate.

**Tests.** `build-fonts.test.ts`'s "reports the measured emphasis ratio" is now
"reports the ruled emphasis ratio" at 1.1641. `font-ratios.test.ts`'s
"refuses cap height, which no other measure supports" is now **"still refuses
cap height on the numbers alone, which a ruling overrides"** — the assertion is
unchanged because the behaviour is unchanged; what changed is that the test says
why that is correct rather than implying cap height is wrong. The constant is
pinned against a derivation from the **ruled** quantity, so a re-measurement that
moved cap height fails here rather than leaving a stale number. `text-style.test.ts`'s
override case now uses 1.3479, because an override that equals the default
proves nothing.

**`ARABIC_SIZE_RATIO` is untouched at 1.07.**

## 3. The rebuilt file

**`/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/build/vitasilk-full.aep`**

Built at the ruled value and read back out of the file rather than assumed:

```
g001__sub_pop   '5'            Inter-SemiBold                          343.000   #F8F6F2
k001__kw_slam   'filler glow'  CormorantGaramondItalic-SemiBoldItalic  494.742   #C9A96E
k002__kw_slam   'Vita Silk'    CormorantGaramondItalic-SemiBoldItalic  494.742   #C9A96E
k003__kw_slam   '7rir'         CormorantGaramondItalic-SemiBoldItalic  494.742   #C9A96E
```

That matches `vitasilk-emphasis-cap-height-1.1641.aep`, the file he approved, in
every field — including `filler glow` staying on one line, which is where the
two builds visibly differed. 76 elements, 0 skipped, 1.5 s.

## 4. The template pass

**`docs/TEMPLATE_STYLE_PASS.md`.** Everything in it was read out of the audit of
`templates/library.aep` and out of `templates/manifest.json`.

**Four comps, one layer each, all called `TXT_MAIN`:** `sub_pop` (Inter-SemiBold
343), `sub_pop_ar` (Almarai-Bold 367), `kw_slam` (Inter-SemiBold 425),
`kw_slam_ar` (Almarai-Bold 455). The two image comps carry no type and are not
part of the pass.

**What must not change**, each because something reads it: the four comp names
and `TXT_MAIN` (the build looks them up by name and stops rather than guessing);
the comp settings, 2160 × 1100 at 29.97 fps for 2.0020 s; **the type size**,
because the build reads it out of the comp and multiplies it for the emphasis
face; **every keyframe's time, value and easing**, because the impact frame the
sounds are placed against is derived from that easing and all six comps
currently land at 4.06 frames; and where the text layer sits, because the build
positions the whole comp from it.

### Does the layout derivation have to be re-run? Half of it, and not by an existing command

**Measured in After Effects, on `Inter-SemiBold` at 343:**

| stroke width | measured width | change |
|---:|---:|---:|
| none | 773.592 | — |
| 6 | 785.592 | **+12** |
| 12 | 797.592 | **+24** |
| 20 | 813.592 | **+40** |

**A stroke of *w* makes a word 2*w* wider and 2*w* taller** — *w* outside the
letters on every side. **A drop shadow changed `sourceRectAtTime` by nothing**
at 20 distance and 30 softness. `extents=false` and `extents=true` agree exactly
for point text, so that flag is not the difference.

- **Line breaking looks after itself.** `framopiaFitText` asks After Effects for
  the width at build time, so it sees the stroke and wraps a card one word
  earlier. Nothing to do.
- **`SUBTITLE_BAND` does not, and no existing command fixes it.** It comes from
  `FONT_METRICS`, read from the **font files** with fontTools — and a stroke is
  not in a font file, so re-running the same derivation would read the same
  numbers. After his pass the band is short by the stroke width above and below.
  The constant needs a term for it; then `npm run zones -- --all --write-plan`
  and `npm run place -- --all` re-derive what depends on it. The audit also has
  to be re-run, because it is stamped with the `.aep`'s sha256 and
  `validate:templates` refuses a stale one.

**The colours belong to the client**, recorded in the doc as the conversation
decided: the shadow and the contour live in the templates, their colours come
from the client file alongside the palette and the three faces, or every future
client inherits K2's look. **Two mode fields would carry them and neither was
added this session.**

**The AEP was not touched**, and its sha256 is identical at both ends.

## 5. The panel tests — session 6 was wrong, and this is a real defect

Three runs on an idle machine, as asked:

| run | result |
|---|---|
| 1 | **5 failed**, 154 passed, 2 skipped |
| 2 | **4 failed**, 155 passed, 2 skipped |
| 3 | 159 passed, 2 skipped |

**It fails on an idle machine, so it is not load-sensitive and I should not have
called it that.** Session 6 saw it fail under build load, saw it pass twice when
the machine was quiet, and concluded from two passes. That was the wrong
inference from the right observation.

**The cause.** `Images.tsx` removes the picture from the DOM when the browser
cannot load it — `onError` sets `unreadable` and the "could not display it"
sentence replaces the `<img>`. Every fixture pointed at `/v/img001-c1.jpg`,
which is nowhere, so the error was always going to fire and the assertions were
racing it. Whether they won depended on nothing the test controlled.

**The fix**: the fixtures point at real cutouts under `my files/test videos/`,
so the load succeeds and the ready branch is what is under test. That also makes
"encodes the spaces in a real path" a real case — those paths genuinely have
spaces in them — instead of a synthetic string it never rendered.

**Five consecutive clean runs afterwards**, 159 passed and 2 skipped each time,
plus the suite inside `npm run check`.

## 6. Deviations

- **The build-stamp comparison was fixed before this session's work started.**
  A stamp is `<commit>+<content hash>` and I had it comparing the whole string,
  so committing a report — which changes no code — made the panel and the
  service disagree. That is the false alarm the stamp replaced. It now compares
  the hash, and says "same code … at different commits" when only the commit
  moved. It is a fix to session 3's mechanism, and it was in the working tree
  when this brief arrived rather than being new work chosen here.
- **The panel test fix goes beyond "report it".** The brief said a failure on an
  idle machine is a real defect to report; the cause turned out to be one line
  of fixture data and leaving it would have meant the next session inheriting a
  suite that fails two runs in three.

## 7. Failures and open problems

- **`SUBTITLE_BAND` still does not know about the emphasis face**, and after the
  template pass it will not know about the stroke either. Both are the same
  gap: the band is derived from two font files, and neither Cormorant nor a
  drawn stroke is in them.
- **The audit does not record a stroke.** It records font, size, justification
  and tracking for a text layer. Nothing will notice the stroke's width unless
  the audit is taught to read it, which is what the band would need to widen
  itself rather than being told a number by hand.
- **`OVERLONG_WORD_CHARS = 11` is a character-count proxy for a rendered width**
  and a third face already made it worse; a stroke will make it worse again.
- **The two mode fields for the shadow and contour colours do not exist.** Until
  they do, whatever colours he picks in the templates render for every client.
- **`DoScript` behaved throughout** — a dozen calls across the measurement, the
  build and the verification, all first time. Session 5's several-minute refusal
  is still unexplained and remains a Block 10 risk.
- **`measure-fonts.jsx` was not run this session**, so no new phantom font name
  was added; the ones from sessions 5 and 6 remain in After Effects' font list
  until it restarts.
- No cache entry, plan, reference, ledger line or template was changed.

## 8. Repo state

- Branch **`main`**, four commits ahead of `e1f0d0a`, nothing force-pushed.
- HEAD: **`3a0525b docs: write the template style pass, and the ruled ratio`**.
- Working tree clean apart from this report.
- **`npm run check`: PASS**, measured from this session's final run:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 36 | **521** |
| `framopia-service` | 89 | **1128** |
| `framopia-benchmarks` | 16 | **166** |
| `framopia-panel` | 6 | **159 passed, 2 skipped (161)** |
| `tools/cv` pytest | — | **149 passed in 11.41 s** |

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
149 passed in 11.41s
models: birefnet-general ok
models: selfie-multiclass-256x256 ok
check: PASS
```

## 9. Suggested next step

The template pass is the only thing left that needs his hands: he draws the
stroke and the shadow on `TXT_MAIN` in the four text comps, working from
`docs/TEMPLATE_STYLE_PASS.md`. Everything after that is a session's work and
should be one sitting, because the pieces depend on each other — re-run the
audit so the record matches the file, teach it to read the stroke width, widen
`SUBTITLE_BAND` by it and by the emphasis face's extents (the two open gaps are
the same gap), then re-derive the zones and the image placements and rebuild
`vitasilk` so he can see the result. The two client fields for the shadow and
contour colours belong in that same sitting, since the templates will be
carrying provisional colours until they exist.
