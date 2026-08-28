Status: OK

# Block 8 session 27 — the hits removed, the late whoosh found

**Spent $0.00; no API was called.** `.local/costs.jsonl` byte-identical at both
ends: **108 lines, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.**
**After Effects was not contacted in any way** — no build, no audit, no
AppleScript. At session start: **one After Effects instance** (pid 79146, the
same one running since 2026-08-27) and **0 `aerender`**. Both unchanged at the
end. `templates/library.aep` was not opened or modified.

## Done

### Goal 1 — the hits are removed

**No SFX event is bound to a keyword.** `kw_slam` and `kw_slam_ar` declare
`sfx: []`, and `hit_01` and `hit_02` are bound to nothing.

**The machinery that existed only for them is gone, not left behind a flag:**
`core/src/sfx-variation.ts` and its tests are deleted (the hit spacing rule and
the hit variation rule), `deriveSfxDetail` collapses back to a single pass, and
the keyword picker no longer shows a binding **or** explains an absent one —
`KeywordSfxView`, `sfxDroppedSinceS`, `sfxLine` and the preview player are all
removed. There is no absence to explain where there was never a binding.

**The files and their measurements stay** in `assets/sfx/sfx.json`, untouched: a
test now asserts both hits are still declared, so a later block finds the peak
offsets, anchors and derived gains rather than having to re-measure.

**Events across the corpus, per reel:**

| reel | before | after Goal 1 | after Goal 3 | what went |
|---|---:|---:|---:|---|
| ground-truth | 0 | 0 | 0 | — |
| test-1 | 6 | 4 | **3** | 2 hits, then `img001`'s whoosh |
| test-2 | 2 | 0 | **0** | 2 hits; it has keywords and no image slots |
| test-3 | 0 | 0 | 0 | — |
| vitasilk | 7 | 5 | **4** | 2 hits, then `img001`'s whoosh |
| **corpus** | **15** | **9** | **7** | **6 hits, 2 unreachable whooshes** |

**One consequence I did not want to leave wrong.** `dialogueAttenuationDb`
exists to keep the loudest sound under the mix ceiling, and it was computing
against the hits' +6 dB offset while nothing binds a hit — turning the whole
reel down 0.73 dB further than anything in it needed, and making the function's
own comment false. `loudestBoundOffsetDb` reads the offsets the manifest
actually binds. `vitasilk` goes **3.80 → 3.07 dB** of attenuation and the whoosh
gain **−13.97 → −13.24 dB**; the balance is unchanged, the whoosh still sitting
3 dB above the dialogue as heard.

Recorded in `docs/TEMPLATE_LIBRARY_GUIDE.md` with the date and the reason.

### Goal 2 — why the whoosh is late

Full evidence in `benchmarks/RESULTS-block8-whoosh-late.md`. Read-only; nothing
was adjusted to find it.

**(a) The clamp — TRUE, and it is the cause.**

**7 of 9 whooshes land exactly on the impact frame. 2 are 14 frames — 0.467 s —
late.** Both are `img001`, the first image in the reel, on `test-1` and
`vitasilk`; on `vitasilk` that is the first sound in the whole build.

`whoosh_01`'s anchor is **0.6913 s** into the file and the impact is 0.1354 s
after the element, so the layer has to start **0.5558 s (16.66 frames) before**
the image. `img001` sits at **0.0990 s**. There is not that much reel in front
of it, the in-point clamped to zero, and the peak arrived half a second behind
the picture.

**(b) The wrong impact frame — REFUTED.** Computed separately for each image
comp from its own keyframes, on the property carrying the visual arrival:
`img_slide_left`'s Transform/Position **4.059 f**, `img_float`'s
Transform/Opacity and Transform/Scale **4.059 f** — identical to `kw_slam`'s
Position. Every entrance keyframe pair in the library runs `t=0` to `t=0.4004`
on one shared easing preset, so an image's arrival really is at the same frame
as a word's. Nothing to fix, and `IMPACT_THRESHOLD` at 0.90 is not what is
wrong.

**(c) The layer starting before the picture — measured, and the opposite of the
hypothesis.** The builder sets `startTime`, `inPoint` and `outPoint` to the
slot's own start, sets Position and Scale, and stops: no fade, no opacity ramp
of its own, and **no time stretch on an image** (only short subtitle cards are
stretched), so the comp's frame 0 is the layer's in-point. Inside the comp the
opacity ramp is heavily front-loaded:

| opacity reached | at |
|---:|---:|
| 10% | 0.18 f (6 ms) |
| 50% | 1.17 f (39 ms) |
| 80% | 2.81 f (94 ms) |
| **90%** | **4.06 f (135 ms)** |

**The picture is visible almost immediately**, not some frames later. The
measurement does point somewhere, though: the sound's peak is aimed at the 90%
crossing, **135 ms after the picture first appears**. **Not acted on** — that is
a frame or two rather than the beat the user described, and `IMPACT_THRESHOLD`
is settled; changing an image's anchor would be revisiting it through the back
door. It is stated as the place to look next if the whooshes still read late.

### Goal 3 — the first image in a reel

**Neither option offered was fully available, and the measurement is what says
so.** Binding a faster whoosh does not work: on an image at 0.0990 s,
`whoosh_02` would still be **9.70 frames late** against `whoosh_01`'s 13.69.
There is nothing in the index to substitute.

**So the sound is dropped rather than played late**, which is the option I
recommend and implemented. *A sound that is audibly wrong is worse than no
sound* — the user's own ruling behind removing the hits, applied here.

`deriveSfxDetail` returns `unplaceable` naming the element, the file and how
late the sound would have been, and `npm run migrate:sfx-placement` prints a
`NO SOUND` line per refusal rather than absorbing it. **Nothing in the corpus
clamps any more**: every surviving event lands its anchor on the impact frame.

**The guarantee is narrowed honestly, not dropped.** Every image still gets a
sound wherever one can reach it; `SilentImageSlotError` is unchanged for the
case it was built for — a template that binds nothing — and an image refused for
want of room is a reported decision. A test asserts the corpus satisfies one or
the other for every slot.

**The alternative I did not take, and why.** After Effects allows a layer to
start before the composition, so the whoosh could keep its lead-in and simply
begin part-way through, with the peak landing on time and the first image
keeping its sound. That is very likely the better fix. **Verifying it means
driving After Effects, which this session may not do** — and if AE silently
clamped a negative `startTime` back to zero, the build would reintroduce exactly
this defect inaudibly, which is worse than not trying. It is the first thing to
attempt when a session is allowed to build.

## Deviations

None. Every hard stop held: After Effects was not contacted, no billable call
was made, no plan was regenerated, `align.ts` and `correction.ts` were not
touched, and `IMPACT_THRESHOLD` stayed at 0.90.

**One change beyond the letter of the goals**, reported rather than slipped in:
`loudestBoundOffsetDb`, under Goal 1. Unbinding the hits left the mix
attenuation computed against a sound nothing plays; leaving it would have kept
the whole reel 0.73 dB quieter than it needs to be and left a documented claim
false.

**Ten tests asserting retired behaviour were rewritten or replaced in the same
change**, per guidelines §3: the manifest binding table, the corpus spacing and
variation rules, three keyword-view sound assertions, three placement
assertions, the clamp test, and the panel's keyword-picker browser test. The two
`sfx-variation` test files were deleted with the module they tested.

## Failures & open problems

- **The first image of a reel is now silent**, on `test-1` and `vitasilk`. That
  is a deliberate trade, not a fix, and the negative-`startTime` route above is
  how it gets its sound back.
- **`test-2` has no sound at all.** It has three keywords and no image slots, so
  removing the hits left it silent. Nothing is wrong with it.
- **The 135 ms in (c) is unresolved by choice.** If the whooshes still read late
  after this, that table is the next move — and it is a decision about what an
  image's arrival means, not a constant to nudge.
- **Nothing in this session has been heard.** Every figure is measured; none is
  judged by ear.
- **`plan.clientMode` is null on all five plans**, so `npm run build:reel` needs
  `--mode` or the card frame keeps the template's own colour. Carried from
  session 25, unchanged.

## Repo state

Branch `main`, HEAD **`b2882e8`** at the time of writing; this report's own
commit follows.

    b2882e8 docs: record session 27 in the operating memory
    5f4cd1b chore: drop imports the keyword view no longer uses
    79667dc fix: drop a sound that cannot reach its impact rather than play it late
    427a2ce docs: measure why the whoosh is late
    624697a feat: unbind the hits from keywords

`npm run service:build` and `npm run panel:build` both ran — the service serves
`keyword-view.ts` and the panel's `Keywords.tsx` and `types.ts` changed.

`npm run check` **passes, exit 0**, read from the exit status:

| workspace | tests |
|---|---:|
| `@framopia/core` | 443 |
| `framopia-service` | 934 |
| `framopia-benchmarks` | 166 |
| `framopia-panel` | 132 passed, 2 skipped |
| **TypeScript total** | **1675** |
| pytest (sidecar) | **166** |

Session 26 closed at 1681 TS and 166 pytest; the 6 fewer are the deleted
`sfx-variation` suite, less the tests added for the refusal rule.

## Suggested next step

**Build `vitasilk` and listen.** After Effects must be open with **no unsaved
changes** — the build refuses otherwise, and that refusal is the last line of
defence rather than a workflow.

    npm run build:reel -- \
      --plan "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/my files/test videos/vitasilk.editplan.json" \
      --mode k2-syndicalia

`--mode` is needed because no plan records its client; without it the card frame
keeps the template's own colour.

Judge two things:

1. **Do the whooshes land on the image?** There are four now, on `img002` to
   `img005`, and each one's peak sits exactly on the frame the picture arrives.
   The first image is deliberately silent — it starts 0.099 s into the reel and
   no sound in the library has a short enough lead-in to reach it. If these four
   still feel behind the picture, the answer is the 135 ms in Goal 2(c) and the
   next change is what an image's arrival means, not the threshold.
2. **The keywords are silent, by your ruling.** Nothing fires with an emphasised
   word anywhere in the reel, and the picker no longer mentions sound at all.
   `hit_01` and `hit_02` are still in the library, measured, bound to nothing.
