Status: PROBLEM — my own shadow measurement left the open library project dirty, so the audit and the build both refuse

# Block 9 session 10 — the rename verified, the plumbing built, and then I broke my own footing

**Spent $0.00. No API was called.** After Effects was driven over AppleScript
`DoScript` into the already-running instance; never launched, never quit, no
`aerender`, no `-r` process. **`templates/library.aep` on disk was never
written** — its sha256 is identical at both ends of this session.

Steps 1, 2, 3 and half of 5 are done and committed. **Steps 4, the rest of 5,
and 6 could not be completed**, and the reason is a mistake I made in the middle
of the session rather than anything wrong with his work.

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
| `library.aep` at start | `1d7553e894e10f82051131e8c1b37305fa8ad14a1d6843df4a40415d2bc4a5d8` |
| `library.aep` at end | **identical** |

## 2. The rename, verified with character codes

Every layer name is now exact. Read as codepoints, not as strings:

| comp | layer 1 (top) | layer 2 | sizes |
|---|---|---|---|
| `sub_pop` | `"TXT_MAIN"` len 8 — `84,88,84,95,77,65,73,78` | `"TXT_MAIN_SHADOW"` len 15 | 343 / 343 |
| `sub_pop_ar` | `"TXT_MAIN"` len 8 | `"TXT_MAIN_SHADOW"` len 15 | 367 / 367 |
| `kw_slam` | `"TXT_MAIN"` len 8 — **the trailing space is gone** | `"TXT_MAIN_SHADOW"` len 15 | 425 / 425 |
| `kw_slam_ar` | `"TXT_MAIN"` len 8 | `"TXT_MAIN_SHADOW"` len 15 | 455 / 455 |

- **`TXT_MAIN` is the light layer and is on top** in all four — `#F4F4F4` at
  index 1, `#820000` at index 2, both enabled.
- The shadow is offset by a Transform effect: Anchor `[1080, 550]` against
  Position `[1088, 565]`, so **+8 across and +15 down**, identical in all four.
- **Comp settings unchanged**: 2160 × 1100, 29.97 fps, 2.0020 s.
- **Type sizes unchanged on both layers**, as tabled above.
- **Every keyframe time, value and easing unchanged** across all six comps —
  compared property by property against session 9's audit, including
  `position`/`anchorPoint` at `valueAtSampleTime` and `sourceRect`.
- **The impact frame still derives to 4.06 frames on all six comps**, so no
  sound moves.

His pass and the re-stamped audit are committed — `d4bea3c`.

## 3. Filling both layers

- `panel/jsx/text-fit.jsx` gains `framopiaFittedText`, which returns the string
  the fit actually left on the layer: the two-line form for a card that wrapped,
  the single line otherwise. A shadow drawn from the other one would not line up
  with the word in front of it, and which it is is only knowable after the
  measurement.
- `panel/jsx/build-reel.jsx` fills each declared shadow with that string, and
  with the placeholder's font and size. **It passes no colour**, so
  `framopiaSetText` leaves the shadow's `#820000` exactly as he drew it.
- **A declared shadow that is not in the comp makes the build throw**, naming
  the comp and the layer.
- `templates/manifest.json` declares `shadowLayers: ["TXT_MAIN_SHADOW"]` on all
  four text templates. The field is **optional with a default**: a one-layer
  template has none and builds exactly as before.

**This is written and typechecked and has never been run.** See §8.

## 4. The new validation rule, and the proof it fails

Every text layer in a template comp must be a **placeholder**, a declared
**shadow**, or a declared **decorative** layer the build leaves alone. Anything
else is a manifest error.

Run against the three cases that matter:

```
--- A: an undeclared text layer (session 8 exactly) ---
   comp "sub_pop" has a text layer "TXT_MAIN 2" that the manifest does not account for.
   A text layer the build does not fill keeps whatever word the template was authored
   with. Declare it in placeholders, in shadowLayers, or in decorativeTextLayers if the
   build should leave it alone.

--- B: a declared shadow that is not in the comp ---
   comp "kw_slam" declares shadow layer "TXT_MAIN_SHADOW" but has no layer of that name
   (layers present: TXT_MAIN)

--- C: the real file, unmodified ---
   no problems
```

Case A is session 8's defect reproduced exactly and now caught. Case B says
"shadow layer" rather than "placeholder", because calling a shadow a
placeholder in an error message is how the next person misreads it. Six tests
pin all of it, including that a template with one text layer and no declaration
stays silent.

## 5. What I broke, and how

`SUBTITLE_BAND` needed the shadow's reach as a **measurement**, not a typed
number, so I wrote `tools/ae/measure-shadow.jsx` to ask After Effects for it.
It imported `templates/library.aep` and set a known word on both text layers so
the two rects would be comparable.

**Two things were wrong with that.**

The measurement itself was useless: it put each template comp into a probe comp
and asked the layer for its rect, and **a nested comp's `sourceRectAtTime` is
the comp's own rectangle**, not its ink. All four returned 2160 × 1100 with zero
difference between shadow on and shadow off.

And the project it imported into was **`library.aep` itself**, which was already
open in After Effects. So the open project now holds **12 comps instead of 6** —
the originals plus an imported copy of all of them — and my script set `glow`
and `شنو` on the imported duplicates' text layers.

**What is and is not damaged:**

- **The file on disk is untouched.** sha256 `1d7553e8…` at the start of the
  session and at the end, checked after every operation.
- **The original six comps in memory are intact** — they still hold
  `kan9olo`, `Booster`, `المنطقة`, `شد طبيعي`. The text I set landed on the
  imported copies.
- **The open project is dirty**, and if it were saved the file would gain six
  duplicate comps and a folder.

**Both guards then did their job.** `npm run audit:templates` refuses:
*"the open After Effects project has unsaved changes: …/templates/library.aep.
The audit will not close it."* And `build-reel.jsx` refuses the same project for
the same reason.

**I did not try to undo it.** Undo would not clear After Effects' modified flag
even if it restored the content, so it would not unblock anything; and closing
the project is explicitly not something this session may do. Scripting more
changes into his open project to repair my scripted changes is how this gets
worse rather than better. The disk file is safe and that is what matters.

## 6. What was not done

- **Step 4, the band.** Not done. The shadow's reach is derivable — the
  Transform offset is +8 / +15 and the Fast Box Blur **animates from 30 to 0
  over the entrance**, so at rest the shadow contributes only the offset — but I
  could not re-run the audit to get those figures into the artifact, and putting
  them into `SUBTITLE_BAND` from a number I had read on screen would be exactly
  the hand-typed constant the brief forbids. Cormorant's extents are independent
  of all this and are still open.
- **Zones and placements were not re-derived**, because nothing about the band
  moved.
- **The mode field for the shadow colour was not added.** `#820000` is knowable,
  but the brief requires it read from the audit, and the audit could not be
  re-run.
- **Step 6, the rebuild.** Blocked by the same dirty project. **So the whole of
  §3 is unverified**, which is the part of this report I would most want checked
  before it is trusted.

## 7. Deviations

- **The audit now records fill colour and effect offsets** (Step 5's first
  half), and it is committed **without ever having produced output**, because
  the audit cannot run. It is syntactically gated and the fields are additive,
  but nothing has seen it work. It is flagged here rather than left to be
  discovered.

## 8. Failures and open problems

- **§3 has never been run.** Filling the shadow layer is the central change of
  this session and no build has exercised it. It typechecks and the
  ExtendScript parses; that is all.
- **The audit change has never produced output**, as above.
- **The open `library.aep` project is dirty with six duplicate comps in it.**
  The disk file is intact. Nothing was lost.
- **`tools/ae/measure-shadow.jsx` is committed and does not work** — it measures
  the comp's bounds rather than its ink. It is committed because the next
  session needs to see the approach that failed rather than repeat it; a
  rendered extent is not obtainable from `sourceRectAtTime`, and the project
  never renders.
- **`SUBTITLE_BAND` still knows only Inter and Almarai**, and still nothing
  about the shadow. Unchanged from session 9.
- **The blur is part of the entrance, not a permanent softening** — 30 at t=0,
  0 at 0.4004 s, on both layers equally. Worth knowing before anyone budgets
  band space for it.
- No cache entry, plan, reference, ledger line or template content changed.

## 9. Repo state

- Branch **`main`**, four commits ahead of `a8a6267`, nothing force-pushed.
- HEAD: **`9e291be feat: record fill colour and effect offsets in the audit`**.
- Working tree clean apart from this report.
- **`npm run check`: PASS**, measured from this session's final run:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 36 | **527** |
| `framopia-service` | 89 | **1128** |
| `framopia-benchmarks` | 16 | **166** |
| `framopia-panel` | 6 | **159 passed, 2 skipped (161)** |
| `tools/cv` pytest | — | **149 passed in 7.84 s** |

Tail of that run:

```
> @framopia/core@0.1.0 validate:modes
mode k2-syndicalia v9: ok (fonts set)
templates: 6 entries, ok
extendscript: 12 .jsx file(s) ok
validate-templates: 6 template(s) ok, audited against library.aep
validate:panel: panel/CSXS/manifest.xml ok

> framopia-benchmarks@0.1.0 verify-refs
  ok    ground-truth   v1.0.8-conformant
  ok    test-1         v1.0.8-conformant
  ok    test-2         v1.0.8-conformant
  ok    test-3         v1.0.8-conformant
references: PASS
149 passed in 7.84s
models: birefnet-general ok
models: selfie-multiclass-256x256 ok
check: PASS
```

**A green check is not a claim that §3 works.** Nothing in the suite builds a
comp.

## 10. Suggested next step

`templates/library.aep` is open in After Effects with unsaved changes that are
mine, not his — closing it without saving is all that is needed, and the file on
disk is already correct.

After that a session can finish this in one pass, and it is mostly verification
rather than new work: re-run the audit so the new colour and offset fields exist
in the artifact, rebuild `vitasilk` and read it back to confirm both layers of
every card carry the real word and no layer anywhere still says `kan9olo`,
`Booster`, `المنطقة` or `شد طبيعي`. Then the band, with the shadow's +8 / +15
taken from the audit and Cormorant's extents added to `FONT_METRICS`, followed
by `npm run zones -- --all --write-plan` and `npm run place -- --all`; and the
one client field for the shadow colour, read from the audit. The measurement
script this session left behind should be replaced rather than fixed — the
shadow's reach is the Transform offset plus a blur that is zero at rest, and
both are readable from the audit now, so nothing needs to be measured by
rendering.
