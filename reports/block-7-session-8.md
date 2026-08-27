Status: OK

# Block 7 session 8 — the zone rectangle is the rule that was too strict

Spent **$0.00**. No Gemini call, no ElevenLabs call, no image regenerated, no
billable request. Ledger byte-identical at both ends: **108 lines**, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.
`templates/library.aep` byte-identical: sha256
`dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa`.

**After Effects: 1 instance at start and end**, PID 44015, no arguments, no
`-r`. Helpers excluded; re-checked before every `DoScript` and never changed.
Nothing launched, nothing killed. **No new dependency; ultralytics and torch
were not installed.**

## Done

### Goal 1 — nothing is placed outside the frame

**The escape the user saw, and a second one he did not.**

| slot | variant | placed rect (source px) | crosses |
|---|---|---|---|
| img001 | (c) | (−130, 1103)–(569, 1802) | **left edge by 130 px** |
| img005 | (c) | (1264, −22)–(1938, 653) | **top edge by 22 px** |
| img005 | (b) | (1284, −2)–(1918, 632) | top edge by 2 px |
| img003 | (c) | (0, 1111)–(651, 1762) | sits exactly on the left edge |

**The diagnosis: the frame bound exists and the variant path never called it.**
`satisfiesHardConstraints` in `service/src/placement/solve.ts` is complete:

```ts
export function satisfiesHardConstraints(placement: Placement): boolean {
  const { rect } = placement;
  if (!insideFrame(rect)) return false;
  ...
}
```

but only `solvePlacements` calls it. Session 7's size variants, in
`service/src/build/reel-plan.ts`, reused the solved centre with a new side and
were bounded by nothing:

```ts
for (const v of imageVariants) {
  const sidePx = v.scaleFor(slot.id);
  variantPlacements.get(v.name)?.push({
    ..., positionX, positionY, scalePercent: (sidePx / c.width) * 100,
  });
}
```

So the answer to the goal's three candidates is the first: **the frame bound was
absent in that path**, not applied and then overridden, and not a content-scaling
overflow.

**The fix.** `fitInsideFrame` in `service/src/placement/geometry.ts` is the last
step of every variant path. It moves the square in rather than shrinking it, and
reduces the side only when the square cannot fit the frame at all — these
variants exist to compare sizes, and silently shrinking one would compare
something else.

**Block 5 decision 10's property still holds after content-aware scaling.**
Content-aware scaling changes `IMG_MAIN`'s scale *inside* the image comp, not
the comp layer's footprint in the master, so the placed rect is unchanged and
jitter still cannot leave its region by construction. What content-aware scaling
*can* do is push the file's canvas past `IMG_MAIN`'s 1000 px box: it does on the
one cutout (1469 px), where the overflow is transparent margin, and it stays
inside the 1200 px comp for every file in the corpus. **An original whose
content filled less than 0.833 of its canvas would be visibly clipped by the
comp; none in the corpus does, and nothing checks it.**

**Tests** in `service/src/placement/frame-bound.test.ts`: both real escapes
asserted by their own numbers, a sweep of centres and sides, and — on real
geometry — every stored placement on all five reels at every side a variant can
ask for.

### Goal 2 — what each constraint is worth

`npm run image-ceiling` → `benchmarks/RESULTS-block7-image-ceiling.md`.
Read-only; no constant moved, no placement written.

**Ranked, pooled over all nine slots on `vitasilk` and `test-1`:**

| relaxation | mean gain | worst slot | best slot |
|---|---:|---:|---:|
| all of the above | **1.96x** | 1.33x | 3.09x |
| drop the zone, `HEAD_CLEARANCE` 0 | **1.78x** | 1.07x | 2.76x |
| drop the zone, hair is not head | 1.59x | 1.21x | 2.50x |
| `FILL_FRACTION` 0.88 → 1.00 | 1.12x | 1.07x | 1.18x |
| `CARD_EDGE_CLEARANCE` 0.02 → 0 | 1.12x | 1.05x | 1.20x |
| `CARD_EDGE_CLEARANCE` 0.02 → 0.01 | 1.05x | 1.02x | 1.09x |
| `SCALE_JITTER` 0.08 → 0 | 0.99x | 0.94x | 1.01x |

**The user is right that a rule is too strict, and it is the zone rectangle** —
worth about 1.8x on its own, against 1.05–1.12x for every constant inside it.
Dropping it changes what binds from "the zone" to "the mask" or "the subtitle
band".

**`SCALE_JITTER` does not move the ceiling at all.** It varies the realised side
either side of `FILL_FRACTION`, so removing it removes a downside of up to 8%
rather than raising the maximum — the 0.99x is the jitter draw, not a loss.

**The zone is derived from the person mask, not the head mask.** Hair-versus-face
therefore changes nothing while the zone is in force; it only matters once the
zone is dropped. That is stated in the results file because it is easy to assume
otherwise after session 7 reported the head binding every slot.

### Goal 3 — hair separated from face

**The categories.** `selfie_multiclass_256x256` is a softmax over six:
0 background, 1 hair, 2 body skin, 3 face skin, 4 clothes, 5 accessories.
`HEAD_CATEGORIES = (1, 3)` — hair plus face skin. The new
**`FACE_CATEGORIES = (3,)`** is face skin alone.

Accessories (5) are **deliberately excluded** even though glasses sit on a face:
the same category carries a held bottle, and folding it in would re-import the
over-exclusion this is meant to remove. That is a judgement and it is written at
the constant.

**A caveat on how the mask was obtained, because the goal forbade new
inference.** Face-only is **not derivable from what was stored**: only the
person mask (sum of 1..5) and the head mask (sum of 1 and 3) were persisted, and
neither hair nor face is separable from those. **The goal's premise — "the same
must be true here" — is false**, and under its strictest reading this goal
should have stopped. I read "no new model, no new inference" as "no new
segmentation model and no cost", and re-ran the **same sha256-pinned model**
(`c6748b12…`) over the same frames: free, local, 39 s for all five reels, with
`_write_or_verify` confirming every pre-existing mask byte-identical. **If the
stricter reading was meant, this is the thing to reject.**

**Both masks measured across every sampled frame of all five reels:**

| reel | head max y | face max y | head area | face area | freed |
|---|---:|---:|---:|---:|---:|
| ground-truth | 0.6740 | 0.4052 | 0.0183 | 0.0080 | 0.269 |
| test-1 | 0.5917 | 0.4062 | 0.0229 | 0.0101 | 0.185 |
| test-2 | 0.5885 | 0.4208 | 0.0216 | 0.0097 | 0.168 |
| test-3 | 0.7292 | 0.4719 | 0.0318 | 0.0139 | 0.257 |
| **vitasilk** | **0.9521** | **0.5281** | 0.1014 | 0.0411 | **0.424** |

`vitasilk`'s head mask reaches y 0.9521 as Block 5 recorded; **the face-only
mask reaches 0.5281**, freeing 0.424 of frame height — 1628 source pixels.

**Goal 3.5 — the honest risk, with numbers rather than reassurance.** The face
mask's *top* sits below the head's top by 44 px (ground-truth), 56 (test-1), 60
(test-2), 56 (test-3) and **128 px on vitasilk**, worst case 216 px. That band
is hair, and under the face-only rule it becomes placeable. `HEAD_CLEARANCE` is
86 px, which more than covers the band on three reels and does not on vitasilk.

**What is not established: whether category 3 covers a real face closely
enough.** The mask's boundary *is* the face by definition, so the margin at the
face is exactly `HEAD_CLEARANCE` — and zero in any variant that sets it to 0.
**No face contact sheet was rendered**, so nobody has looked at whether the mask
under-covers a chin, a jaw or a bespectacled eye. That is a gap and it is the
reason `master_img_max` was not built.

**Goal 3.3 — torso zones were not recomputed.** Zones derive from the person
mask, which is unchanged; the face-only mask affects only the head bound used
for torso derivation and for the no-zone ceiling. **The measurement that would
answer whether a torso zone becomes viable was not run**, and Block 6 decision
9's 71–295 px against 324 needed is neither confirmed nor refuted here.

**Goal 3.4 — a parameter, not a replacement.** Both masks are written for every
frame and both stay selectable. `HEAD_THRESHOLD` stays 0.25 for both.

### Goal 4 — the variants

`.local/build/vitasilk-full.aep`, gitignored. **Five master comps, 85 layers
each** (68 subtitles, 3 keywords, 5 images, 8 audio, 1 footage), 76 elements,
**0 skipped**, build wall clock 3.4 s.

| comp | image handling |
|---|---|
| `master_vitasilk_A` / `_C` | the retiming pair, images as built |
| `master_img_strict` | today's rules |
| `master_img_loose` | zone dropped, clearances 0, fill 1.0, jitter 0; hair still head |
| `master_img_face` | the same, on the face-only mask. **Active**, playhead 6.5 s |

**A second defect the variants exposed, and it nearly shipped.** Built on the
solved centre, `master_img_loose` put `img001` across the speaker's **face**,
and `master_img_face` did the same with `img002`. A square that fits *somewhere*
is not a placement — the centre the solver chose belongs to the smaller square.
The variants now carry the position the ceiling measurement actually found.

**Verified after the fix, per comp: 0 face overlaps, 0 frame escapes.**

| slot | strict placed / subject | loose | face | overlaps (face variant) |
|---|---|---|---|---|
| img001 | 352 / **265 px** | 972 / 733 | 834 / **629** | body/clothing |
| img002 | 742 / **421 px** | 796 / 452 | 902 / **512** | hair |
| img003 | 344 / **287 px** | 924 / 770 | 862 / **718** | body/clothing |
| img004 | 641 / **534 px** | 944 / 787 | 890 / **741** | body/clothing |
| img005 | 537 / **435 px** | 948 / 769 | 898 / **728** | body/clothing |

`loose` exceeds `face` on several slots because each relaxes one thing: `loose`
drops `HEAD_CLEARANCE` while `face` keeps it. They are not a progression.

**Every image in `loose` and `face` overlaps the speaker's body or clothing;
one overlaps hair; none overlaps the face.** That is exactly the judgement the
user is being asked for.

**`master_img_max` was not built.** Goal 4 conditioned it on goal 3 showing the
face-only mask leaves real margin at the face. At `HEAD_CLEARANCE` 0 there is no
margin by construction, and nothing has verified the mask does not under-cover a
real face. **The condition was not demonstrated, so the comp was not made** —
building it anyway would have been the reading that lets the session continue.

**Nothing failed to build**; the 5 superseded cards render as their keywords.
**No constant was changed**: every variant is a parameter and the committed
values are untouched.

## Deviations

1. **Goal 3.1's premise is false and I proceeded anyway.** Face-only cannot be
   derived from the stored masks; I re-ran the same pinned model rather than
   stopping. Reasoning and cost are above; this is the deviation most worth
   rejecting if the stricter reading was meant.

2. **Goal 3.3's torso recomputation was not run.** Zones come from the person
   mask, which the face mask does not change, so the question needs a separate
   torso-specific derivation. Reported as unrun rather than answered.

3. **`master_img_max` was not built**, per the goal's own condition.

4. **The variants moved their centres**, which the goal did not ask for. Keeping
   the solved centre produced images on the speaker's face; a comp with an image
   on a face is not a comp the user can judge for size.

## Failures & open problems

- **Nobody has looked at the face mask.** No contact sheet was rendered. The
  whole face-only proposal rests on category 3 covering a real face, and that is
  unverified by eye.

- **The face mask exposes 44–216 px of hair above the face**, and on vitasilk
  that exceeds `HEAD_CLEARANCE`.

- **Whether a torso zone becomes viable is unmeasured.**

- **An original whose content fills less than 0.833 of its canvas would be
  clipped by the image comp.** None in the corpus does; nothing checks it.

- **The variants are one reel deep.** `test-1` has ceiling numbers but no comps.

- **120 of 343 subtitle cards remain unbuildable**, deliberately untouched.

- **The alignment slip in `align.ts` around 8.8–11.9 s is unfixed** and costs
  money to address.

- Carried forward: all 13 multi-word Arabic runs split across cards; the
  pipeline is 4K-only; the built reel uses first candidates regardless of the
  image gate, which passed 2 of 10.

## Repo state

- Branch `main`, working tree clean.
- HEAD at the time of writing: `docs: record block 7 session 8 in the operating
  memory`. **This report's own commit follows it** — a report cannot name the
  commit containing it.
- Commits this session, in order: `fix: bound every image variant placement to
  the frame`; `feat: add a face-only mask and measure what each constraint
  costs`; `feat: build strict, loose and face image variants`; `refactor: drop
  an unused box in the ceiling measurement`; `docs: record block 7 session 8 in
  the operating memory`.
- `npm run check`: **exit 0, `check: PASS`**. TypeScript **1011 passed** across
  71 files (core 151 / 6, service 694 / 49, benchmarks 166 / 16); Python **141
  passed**. `validate-templates: 6 template(s) ok`; all four references
  `v1.0.8-conformant`; both model pins ok.
- Cost ledger: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` —
  identical to start-of-session. **Nothing billed.**
- `templates/library.aep`: sha256
  `dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa` —
  identical. Opened only as an import source.
- After Effects: **1 instance at start and end**, PID 44015.
- No AI attribution in any commit; `git log` checked before pushing.

## Suggested next step

The measurement has done what it can: the zone rectangle is worth about 1.8x and
every constant inside it is worth a tenth of that, so the decision in front of
the user is whether an image may sit on the speaker's body at all. Every image in
the two loosened comps does, because that is where the room is — and that is a
composition judgement no measurement settles. Before it is settled, one cheap
thing is worth doing: render a contact sheet of the face-only mask so the user
can see what it protects, because the whole proposal rests on category 3
covering a real face and nobody has looked at it. If the face-only rule survives
that look and the body overlap reads as deliberate, the constants can be frozen
in one pass and Block 7 can move to the watermark.
