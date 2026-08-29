# Template style pass — a drop shadow and a contour on the subtitles

You asked for the subtitle type to read better against the footage: a drop
shadow, and a contour around the letters, adjustable. Both belong in the six
templates you built by hand, because **the system never edits a template's
animation** — it duplicates a comp and fills in the placeholder.

This is written so the pass is one sitting rather than three. Everything below
was read out of `templates/library.aep` through its audit and out of
`templates/manifest.json`; nothing here is from memory.

## 1. What you touch

**Four comps, one layer each. The layer is called `TXT_MAIN` in all four.**

| comp | the layer | what it sets today |
|---|---|---|
| `sub_pop` | `TXT_MAIN` | Inter-SemiBold, 343 |
| `sub_pop_ar` | `TXT_MAIN` | Almarai-Bold, 367 |
| `kw_slam` | `TXT_MAIN` | Inter-SemiBold, 425 |
| `kw_slam_ar` | `TXT_MAIN` | Almarai-Bold, 455 |

**The two image comps are not part of this pass.** `img_float` has `IMG_MAIN`
and `CARD`; `img_slide_left` has `IMG_MAIN`. They carry no type.

**The stroke goes on the Character panel**, as Stroke with a width, not as a
layer effect — that is what the build measures, and §3 explains why that
matters. The drop shadow goes on as a layer effect.

## 2. What must not change, and what happens if it does

Each of these is something the build reads. It is not a matter of taste.

**Names.** The four comp names above, and the layer name `TXT_MAIN`. The build
looks a comp up by its name from the manifest and then looks for a layer called
`TXT_MAIN` inside it. **Rename either and the build stops, saying it cannot find
it** — it will not guess.

**Comp settings.** 2160 × 1100, 29.97 fps, 2.0020 s long. The checker requires
29.97 exactly and rejects 30. The duration has to stay at least as long as the
entrance plus the hold.

**The type size.** 343, 367, 425 and 455. The build reads the size out of the
comp and multiplies it for the emphasis face, so changing it here changes how
big an emphasized word comes out. The face and the colour are set by the build
now and it does not matter what they are in the comp — but the **size** does.

**Every keyframe: its time, its value and its easing.** All four comps animate
Position, Opacity and Fast Box Blur over two keyframes. The system reads that
easing to work out the exact frame a word lands on, and places every sound
against it — all six comps currently land at 4.06 frames. **Move a keyframe or
change its easing and every whoosh in every reel moves with it.** If you want to
change the animation, that is a separate sitting and worth saying out loud,
because sounds have to be re-derived afterwards.

**Where the text layer sits.** The build reads `TXT_MAIN`'s position and works
out where to put the whole comp so the baseline lands in the right place on
screen. Moving the text layer inside the comp moves every subtitle in every
reel.

**Safe to change, and the point of the pass:** the stroke, the drop shadow, and
anything else that is purely how the letters are drawn.

## 3. Does a stroke change the layout? Yes — half of it

Measured in After Effects on 2026-08-30, on `Inter-SemiBold` at 343:

| stroke width | measured width | change |
|---:|---:|---:|
| none | 773.592 | — |
| 6 | 785.592 | +12 |
| 12 | 797.592 | +24 |
| 20 | 813.592 | +40 |

**A stroke of *w* makes a word 2*w* wider and 2*w* taller** — it sits *w* outside
the letters on every side. **A drop shadow changed the measured size by nothing
at all**, at 20 distance and 30 softness.

Two consequences, and they pull in opposite directions.

**The line-breaking looks after itself.** The build asks After Effects how wide
each card is at build time and breaks it in two if it is wider than the safe
width. It will see the stroke, so a stroke simply means some cards wrap one word
earlier. Nothing to do.

**The subtitle band does not look after itself, and this is the one thing that
needs a second pass.** The band is the strip of the frame the system keeps clear
for type — it is what stops a picture being placed on top of a word. It is
worked out from the *font files* with a font tool, not from After Effects, so
**it cannot see a stroke you drew**: a 20 px stroke puts 20 px of ink above and
below what the band knows about.

So after the pass: the stroke width has to be written down, the band widened by
it, and the zones and image placements re-derived. **There is no existing command
that does this** — the band is computed from the two font files and a stroke is
not in a font file, so it needs a term added for it. `npm run zones -- --all
--write-plan` and `npm run place -- --all` are what re-derive everything
downstream once the band moves. A session does all of that; it is named here so
the work is visible rather than discovered later.

**The other thing that has to happen afterwards is the audit.** The system keeps
a record of what is inside `library.aep`, stamped with a checksum of the file.
The moment you save your changes that record is stale and the checker says so
rather than trusting it. Re-running the audit is one command and a session does
it.

## 4. Order of work

1. Open `templates/library.aep`.
2. `sub_pop` → `TXT_MAIN`: add the stroke on the Character panel and the drop
   shadow as an effect. Get it looking right against a real frame.
3. Copy the same two onto `sub_pop_ar`, `kw_slam` and `kw_slam_ar`. **Arabic
   letters join, so a stroke that looks right on Latin can close up the counters
   in Almarai** — look at `sub_pop_ar` on its own before deciding the width.
4. Change nothing else. Do not rename anything, do not move the text layer, do
   not touch a keyframe.
5. Save.
6. Tell me the stroke width you settled on, or leave it in the file — a session
   re-runs the audit, reads it back, widens the band and re-derives the zones
   and the image placements.

## 5. The colours belong to the client, not to the template

**Decision taken by the conversation.** The shadow and the contour live in the
templates, because that is where the drawing lives. **Their colours do not** —
if they are baked into the comps then every future client inherits K2's black
shadow and K2's gold edge, which is exactly the problem the per-client type
solved. The type is already set by the build from the client's own palette.

So: put in whatever colours look right while you work. A later session adds two
fields to the client file, alongside the four colours and three faces it already
carries — one saying which palette colour the contour takes, one for the shadow
— and the build sets them the same way it sets the type. **Those fields do not
exist yet and this session did not add them.** Until they do, whatever you
choose is what renders for everyone.

The four colours a client already has are the ground `#1A0000`, the text
`#F8F6F2`, the highlight `#C9A96E` and the red `#820000`.
