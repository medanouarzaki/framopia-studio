# Template Build Spec

What to have open beside After Effects while building the six comps of the
first template set. `TEMPLATE_LIBRARY_GUIDE.md` is the reference for how the
system uses templates and is not restated here; this records the numbers Block 6
settled and the constraints the pipeline will enforce.

Every constant below has one home in code. Where they disagree, the code is
right and this document is stale.

## 1. The six comps

| comp / template id | type | placeholder | presentation |
|---|---|---|---|
| `sub_pop` | subtitle | `TXT_MAIN` | — |
| `sub_pop_ar` | subtitle | `TXT_MAIN` | — |
| `kw_slam` | keyword | `TXT_MAIN` | — |
| `kw_slam_ar` | keyword | `TXT_MAIN` | — |
| `img_slide_left` | image | `IMG_MAIN` | `cutout` |
| `img_float` | image | `IMG_MAIN` | `card` |

Naming is `type_style`, lowercase with underscores, no spaces
(TEMPLATE_LIBRARY_GUIDE §3). **The comp name is the template id** and must
equal the `id` in `templates/manifest.json` exactly. Placeholder layer names
are all caps and exact: `TXT_MAIN` for text, `IMG_MAIN` for image. Decorative
layers may be named anything; only placeholders are touched.

`TXT_MAIN` must be a real editable text layer — not pre-composed, not converted
to shapes. `IMG_MAIN` is a placeholder still with its **anchor point centred**;
the system swaps the footage source and your transforms and keyframes survive.

## 2. Comp settings

Per TEMPLATE_LIBRARY_GUIDE §3:

- **29.97 fps** (30000/1001), square pixel, **transparent background**
- **Duration**: at least intro + 2 s hold + outro. Longer is fine — the system
  trims.
- **Size**: subtitle and keyword comps 2160 × 1100. Image comps 1200 × 1200.
- Nothing in the comp that is not part of the element. No reference footage, no
  visible guides.

**One thing to know about the frame rate.** This section said 30 fps until
Block 7, on the strength of a guide §3 that has since been amended. The source
reels are 30000/1001 — **29.97** — Block 5 measured it (frame sampling reads
real presentation timestamps and the grid diverges from the nominal one from
the second frame onward), the six built comps are authored at 29.97, and
`npm run validate:templates` requires 29.97 and rejects 30. A comp built at 30
against 29.97 footage would accumulate about one frame every 33 seconds; on a
25 s reel that is under a frame, which is why the mismatch went unnoticed.
**A comp on a matching timeline has still never been tested end to end**, and
Block 7 is where it would first show.

## 3. Type

All values from `core/src/typography.ts`, which is the single declaration.
PROJECT_SPEC §5 makes subtitle position and base style global, not per-client.

| | Latin | Arabic |
|---|---|---|
| font | **Inter Semi-Bold** | **Almarai Bold** |
| subtitle size | **343** | **367.01** (343 × 1.07) |
| keyword size | **425** | **454.75** (425 × 1.07) |

- **Line spacing 323**, both tracks, both scripts.
- **Anchor x 1080, y 2480.4** on the 2160 × 3840 output frame.
- **`y` is the text baseline**, not the top of the type. The layer's anchor
  point is **0,0** in the source comp, so glyphs extend upward from the anchor
  and descenders hang below it.
- **A second line renders below the first.** Both tracks may wrap to two lines
  and no further.

The 1.07 ratio is an optical match measured by eye, not derived from the font
metrics: Almarai runs smaller than Inter at the same nominal size.

If your comp is working at 90% layer scale, the equivalent readings are
381.1 / 472.1 / 359 — those are the same type. **Author at 100%**, which is
what the sizes above are and what the templates are expected to carry.

## 4. The animation budget

**intro + outro together must total ≤ 0.13 s — 4 frames at 29.97 fps — with
`minHoldS` 0.10 s.**

This is not a style preference. It is the loosest budget the corpus can carry,
and the measurement is `benchmarks/RESULTS-block6-timing-budget.md` and
`benchmarks/RESULTS-block6-script-grouping.md`.

**What it costs to go longer**, measured across all five reels at two-word
grouping, which is what the corpus held when the templates were specified:

| intro + outro | minHold | subtitle groups that could not carry the budget |
|---|---|---|
| **0.13 s (4 frames)** | 0.10 s | **7 of 190** |
| 0.20 s (6 frames) | 0.10 s | 16 of 188 |

**Two extra frames cost nine more groups.** Both rows are corpus figures.

**Two things have changed since and neither reopens the budget.** One word per
card (Block 7 session 6) took the corpus from 190 cards to **343**, of which
**120** are shorter than intro + minimum hold — per reel ground-truth 33,
test-1 21, test-2 26, test-3 18, vitasilk 22. And a card that cannot carry its
entrance is no longer without a card: Block 7 session 9 time-stretches the
instance so the entrance fits, floored at two frames, so **all 343 are built**.
What remains is **28 cards whose hold is clipped** — ground-truth 9, test-1 7,
test-2 4, test-3 3, vitasilk 5 — reported by `npm run validate-plan` and
`npm run timing-budget`, which both read `cardMinimumDurationS` from
`service/src/build/short-card.ts` rather than restating the arithmetic.

"Unbuildable" was the word this section used and it is the wrong one: those
cards are built, and their hold is truncated by the out point.

The corpus is not clean at any budget. Two of the original seven failures were
degenerate word timings rather than animation problems: vitasilk `mn` has
0.000 s of speech and test-1 `tb3i m3aya` had 0.030 s. **No intro or outro
choice rescues those**; they are a Block 2 alignment question.

The budget is tight because silence is scarce. Pooled across the corpus the
median gap after a subtitle group is **0.059 s** and the p10 is **0.020 s**, so
a card can rarely be held more than hundredths of a second past its own words.

## 5. Intro / hold / outro

Structure every comp as three phases (TEMPLATE_LIBRARY_GUIDE §5):

```
|── intro (fixed) ──|──────── hold (stretchable) ────────|── outro (fixed) ──|
0                 introS                             end − outroS          end
```

- **`introS`** — every entrance keyframe has finished by this time.
- **`outroS`** — every exit keyframe starts this long before the comp ends.
- **`minHoldS`** — the shortest hold that still reads. The solver refuses a
  placement that would compress below it rather than squeezing.

Between intro and outro: **nothing animated, or idle motion only** — a float, a
shimmer, something that looks correct cut at any point. The build stretches the
hold by splitting layer time, so a one-shot animation placed in the hold is cut
at an arbitrary frame.

## 6. Anchor and placement

Every template declares `anchor` in the manifest: `center`, `bottom-center` or
`top-center`. All six comps here use `center`.

**Subtitle and keyword templates place at the global subtitle anchor, and
keyword templates declare no offset from it.** This is load-bearing beyond the
template: Block 5's placement solver excludes a band around the subtitle anchor
so no generated image can overlap the text, and it assumes a keyword occupies
that same band. The assumption is recorded in code as
`KEYWORDS_ARE_INSIDE_SUBTITLE_BAND` in `service/src/placement/constants.ts`.

**If a keyword template needs to sit anywhere other than the subtitle anchor,
that constant becomes false and the exclusion band has to be recomputed.** Say
so before building it rather than after.

Image templates place inside a zone the solver picks; it sets position and a
uniform scale and nothing else.

## 7. Why the Arabic variants exist

**A subtitle card carries one script.** Grouping never puts a Latin word and an
Arabic-script word on the same card (Block 6 session 6), so every card is
wholly one or the other and can be rendered by a comp built for that script.

`sub_pop_ar` and `kw_slam_ar` are therefore the same animation as their Latin
counterparts, differing in:

- **font** — Almarai Bold at 1.07× the Latin size, per §3 above
- **paragraph direction — right to left**, set on `TXT_MAIN`

**Block 7's ExtendScript selects the comp by the group's `script` value.** It
does not switch fonts per character and does not inspect the string. Build the
two variants as a matched pair: same timing, same motion, same footprint, so
that a reel alternating between them reads as one design.

**A known limitation, accepted deliberately.** ORTHOGRAPHY_GUIDE §6c requires a
multi-word Arabic domain term to render whole, and grouping does not yet honour
that — eleven terms in the corpus currently split across two or three cards,
listed in `benchmarks/RESULTS-block6-script-grouping.md` §5. You will see this
on a built comp. It is a real violation and it is on the Block 7 list; it is not
a bug in the template.

## 8. SFX

**No SFX audio files exist.** `assets/sfx/sfx.json` declares ids only.

**Every manifest entry should carry `"sfx": []` for now.** The real bindings —
`sfxId`, `offsetS`, `gainDb` — land when the audio does. A manifest naming an
sfxId the index does not define throws `UnknownSfxError`, so an aspirational
binding fails the build rather than being ignored.

Subtitles declare no SFX at all, per TEMPLATE_LIBRARY_GUIDE §10: they are too
frequent, and 194 groups across five reels would be a hit per word.

## 9. Manifest entry

`templates/manifest.json`, schema in TEMPLATE_LIBRARY_GUIDE §8. One entry per
comp:

```jsonc
{
  "id": "sub_pop_ar",          // must equal the comp name exactly
  "file": "library.aep",
  "type": "subtitle",          // "subtitle" | "keyword" | "image"
  "placeholders": ["TXT_MAIN"],// exact layer names present in the comp
  "introS": 0.07,
  "outroS": 0.06,              // introS + outroS <= 0.13
  "minHoldS": 0.10,
  "anchor": "center",
  "imagePresentation": null,   // image templates: "cutout" | "card"
  "sfx": [],
  "notes": "arabic variant of sub_pop; almarai bold, rtl"
}
```

**The manifest currently carries stub timings that this spec supersedes.**
`sub_pop` is declared at `introS` 0.13 and `outroS` 0.13 — 0.26 s together,
twice the budget — with `minHoldS` 0.07. Those were plausible defaults written
before anything was measured. Replace them with the values from the comps you
actually build, and drop `"stub": true` only when every entry describes a real
comp: `assertRenderable` throws `StubTemplatesError` while that flag is set, so
nothing can build from placeholder timings.

`npm run validate:modes` checks the manifest and that every id a mode allows
exists in it with the right type. `modes/k2-syndicalia.json` currently allows
`sub_pop`, `kw_slam`, `img_slide_left` and `img_float`; **the two `_ar`
variants have to be added to its `allowedTemplates` before they can be
assigned.**

## 10. Before you call it done

- `npm run validate:modes` passes.
- Every comp name equals its manifest `id`.
- `introS + outroS ≤ 0.13` on both subtitle comps and both keyword comps.
- `TXT_MAIN` is a live text layer in all four text comps.
- `IMG_MAIN` has a centred anchor point in both image comps.
- The `_ar` comps are RTL and carry Almarai Bold.
- No entry names an sfxId, and `sfx` is `[]` everywhere.
- Nothing animates one-shot between `introS` and `end − outroS`.

## SFX placement — measured, 2026-08-28

**A sound's impact is not at its first sample, and nothing had ever measured
where it is.** SFX placement put the file's start at the card's start plus
0.13 s — an offset chosen in Block 5 and never measured — which assumes the
transient is at sample zero. `npm run sfx:measure` reads every file and writes
what it finds into `assets/sfx/sfx.json`; the numbers are emitted by the tool,
never typed in.

| id | codec | container | rate | duration | peak offset | peak | head delay | first audible | shape |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| `hit_01` | mp3 | mp3 | 48000 | 5.856 s / 175.5 f | **2.0525 s / 61.51 f** | −0.72 dBFS | 0.000000 s | 0.0478 s | middle |
| `hit_02` | pcm_s24le | wav | 96000 | 6.000 s / 179.8 f | 0.5433 s / 16.28 f | −0.03 dBFS | 0.000000 s | 0.5007 s | head |
| `whoosh_01` | pcm_s16le | wav | 96000 | 1.951 s / 58.5 f | 0.6913 s / 20.72 f | −1.23 dBFS | 0.000000 s | 0.3493 s | middle |
| `whoosh_02` | mp3 | mp3 | 44100 | 1.202 s / 36.0 f | 0.5581 s / 16.73 f | −8.39 dBFS | 0.000000 s | 0.1275 s | middle |

**`hit_01` is the file bound to every keyword, and its peak is 61.5 frames into
it.** Against a 0.13 s (3.9 frame) offset, every hit's impact has been landing
about **2.05 s after the card it belongs to** — on a corpus whose median card is
0.30 s long, that is not late, it is unrelated.

**The mp3 padding hypothesis is not what is wrong.** Container delay measures
**0.000000 s** on both mp3s, so the head padding the user reasoned about is
either absent or already compensated by the demuxer. Head delay and the sound's
own quiet opening are recorded separately for that reason: adding them would put
an error back rather than remove one. `hit_01` is audible from 47.8 ms and peaks
at 2.05 s — a long file whose loudest point is in its middle.

**Every file is the container its name claims.** 24-bit PCM inside a `.wav` is a
wav; the extension names the container, not the codec.

### The placement rule

`placeSfx` in `core/src/sfx-placement.ts`: **the file's measured peak lands on
the template's measured impact frame**, and the layer's in-point is derived from
those two — never authored.

- **Snapped to the frame grid at 29.97, ties rounding down** (earlier). A sound
  a fraction early reads as part of the impact; a fraction late reads as a
  separate event. Half a frame is 16.7 ms, so the direction only matters at the
  tie and it is spent on being early.
- **A peak later than the impact needs a negative in-point**, which a
  composition cannot have. The layer is clamped to the comp's start and
  `clamped` / `clampedByS` say how late the peak then lands. Reported, never
  absorbed: a hit late by a known amount is a decision, and one late invisibly
  is the defect this replaces.
- Whooshes stay bound to images, hits to keywords, subtitles silent. Gains stay
  −20 dB and −24 dB.

### What is still unmeasured

**The template's impact frame.** `impactFrameOf` derives it from the last
entrance keyframe among Position, Scale and Opacity — and the audit on disk
records keyframe **counts without times**, so it returns null with a reason for
all six comps. `audit.jsx` now emits every key's time and value; the audit has
**not been re-run**, because it closes the open After Effects project without
saving and the user's instance is open. **Until `npm run audit:templates` is
re-run, the placement rule has one measured input and one missing one, and the
0.13 s offset stays in force.**
