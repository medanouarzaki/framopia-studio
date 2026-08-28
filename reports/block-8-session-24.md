Status: PROBLEM — the impact frame is measured at 5.25 frames and the user says 4. The convention is validated and `IMPACT_THRESHOLD` is what disagrees, so nothing was migrated and the 17 SFX events remain 8 frames late. `vitasilk` was not built: the build drives his running After Effects, which this session is forbidden to do.

Block 8 part 2, session 24. **$0.00 spent, no API was called, the pipeline was
not run, After Effects was not driven, no plan was modified.**

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| `git status` at start | **only `templates/library.audit.json`**, from the user's audit run — committed on its own as `dc92b5b`, named as his run |
| HEAD at start | `51fc0a7` |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances | **1** at start and end; not driven |
| `aerender` processes | **0** at start and end |
| stray `-r` processes | **none** |

`templates/library.aep` is unchanged at sha `dac234ce…`, which is what the fresh
audit records. No template keyframe was written. `align.ts`, `correction.ts` and
both hand-made reference files are untouched. **No Edit Plan changed.**

## Done

### Goal 1 — the crossing is computed, and it fails its check

**The refreshed audit carries the easing.** Every key now records
`inInterpolation`, `outInterpolation`, `inEase` and `outEase` beside its time
and value, so the stop condition did not fire.

**The convention, and why it matches After Effects.** Between two keys spanning
`d` seconds with delta `Δ`, the timing is a cubic bezier in (time, value) space.
`influence` is the fraction of `d` a handle spans horizontally; `speed` is the
value rate at the key, so the handle's vertical extent is
`speed × (influence/100 × d)`:

    P0 = (0, 0)
    P1 = (i_out·d,        s_out · i_out·d)
    P2 = (d − i_in·d,  Δ − s_in  · i_in·d)
    P3 = (d, Δ)

That is how the graph editor parameterises a handle, and it **checks out
arithmetically on these templates**: every property's out-handle has
`speed × influence × d` equal to the whole delta — Position's
891.964 × 0.14 × 0.4004 = 50.0, Opacity's 1783.929 × 0.056056 = 100.0, Scale's
267.589 × 0.056056 = 15.0, Blur's −535.179 × 0.056056 = −30.0. A handle drawn to
the top of the graph is exactly what that means.

**Results, per comp:**

| comp | property | 95% crossing | last key (settle) | linear |
|---|---|---:|---:|---:|
| `sub_pop` | Position, Opacity | **5.25 f** | 12.00 f | 11.40 f |
| `sub_pop_ar` | Position, Opacity | **5.25 f** | 12.00 f | 11.40 f |
| `kw_slam` | Position, Opacity | **5.25 f** | 12.00 f | 11.40 f |
| `kw_slam_ar` | Position, Opacity | **5.25 f** | 12.00 f | 11.40 f |
| `img_slide_left` | Position, Opacity | **5.25 f** | 12.00 f | 11.40 f |
| `img_float` | Scale, Opacity | **5.25 f** | 12.00 f | 11.40 f |

**The check against the user's eye does not pass.** He says `kw_slam`'s word
lands at **frame 4**; the curve says **5.25** — 1.25 frames, 42 ms, later.
**Nothing was shipped and nothing was migrated.**

**What I would question, and it is not the convention.** Three things say the
bezier is being read correctly: six comps and every entrance property agree
*exactly*, which is what one shared easing preset should produce; the figure is
nowhere near linear's 11.40 or the settle's 12.00, so the easing is doing real
work; and the threshold-to-frame mapping is smooth and monotonic.

**`IMPACT_THRESHOLD` is what disagrees.** It was recorded CHOSEN, NOT MEASURED
at 0.95, and the user's frame 4 corresponds to **0.8966**:

| threshold | crossing |
|---:|---:|
| 0.85 | 3.33 f |
| **0.8966** | **4.00 f** — his eye |
| 0.90 | 4.06 f |
| 0.92 | 4.45 f |
| **0.95** | **5.25 f** — as chosen |
| 0.98 | 6.67 f |

In round terms he is describing **90%**, not 95%. That is a judgement about when
a motion reads as arrived, and it belongs to the person who drew the curve.

**Two units traps, both found because numbers disagreed rather than by
inspection.**

- **A spatial property reports one ease for all three dimensions** — AE eases
  along the path, so its value axis is the magnitude — while a **non-spatial
  multi-dimensional property reports one ease per dimension**. Comparing a 3-D
  magnitude against dimension zero's speed put `img_float`'s Scale at **7.27
  frames** where everything else gave 5.25. Fixed, and pinned by a test.
- **A null ease is not linear.** AE refusing to answer is not a zero, and the
  code returns null with a reason rather than a plausible number. No comp is
  blocked by one today.

A test states the disagreement explicitly — that 5.25 is more than a frame from
4, and that 0.8966 reproduces 4 — so the figure cannot quietly become the
record.

### Goal 2 — not run

Conditioned on Goal 1 passing its check, which it did not. **No plan was
touched.** The 17 SFX events stand where session 22 left them, on the settle
frame, **8 frames late**. Migrating onto 5.25 would have moved them to 3 frames
late on a number the user's eye contradicts.

### Goal 3 — not run, and the reason is the brief's own constraint

`npm run build:reel` drives the **already-running** After Effects over
AppleScript `DoScript` (`service/src/build/drive.ts`). There is no other path:
`-r` is unusable on this machine and a resident `-r` process has been seen
quitting the application out from under a later session. His instance is open
with the panel loaded, and the brief forbids driving it.

Session 23's guard means a build would now **refuse** rather than discard his
work if the project were dirty — but refusing is not building, and driving his
instance at all is what is forbidden. **The command is his to run**, below.

**What the build would contain**, read from the plan rather than built:
73 words in 73 cards, 3 keywords, 5 image slots, **3 hits and 5 whooshes**, and
**no watermark** — `plan.watermark` is null on this reel, which is worth knowing
before he looks for one.

## Deviations

- **Goal 1 produced a working derivation that is not in force.** The module,
  its tests and the documentation are committed; nothing reads it. That is
  deliberate: the brief says do not ship a figure that disagrees with the user,
  and leaving it uncommitted would have thrown away a measurement that is
  correct apart from one constant.
- **`impactFrameOf` is untouched and still returns the settle**, so
  `deriveSfxEvents` still places on 12 frames. Switching it over is one line and
  waits on the threshold ruling.

## Failures & open problems

- **Nothing was lost or destroyed.** No plan, cache entry, ledger line,
  reference, template, audit or audio file was modified. The ledger is
  byte-identical.
- **The 17 SFX events are still 8 frames late.** Three sessions have now worked
  on this and none has moved them onto the right frame.
- **Nothing in this project has ever been heard.** The build is one command and
  it is not mine to run.
- **`IMPACT_THRESHOLD` is unresolved**, and it is the only thing between the
  measurement and a correct placement.
- **The 95% figure may be right and the eye approximate.** 1.25 frames is 42 ms;
  a person judging "the word has landed" from a playhead may reasonably call 90%
  arrival. I have not assumed either way, and the threshold ruling should be
  made against the built comp rather than against a still.
- **The crossing derivation has never run against a template that is not one of
  these six**, which all share a single easing preset. A client template in
  Block 9 with different easing is the first real test of the convention.
- Carried forward: subtitle rulings 1 and 3 are Block 9; headless AE is not met;
  the pipeline runner has never run for real; `redo` has no control in the
  panel.

## Repo state

- Branch **`main`**, worked on `main`. No force-push, no history rewritten.
- HEAD at the time of writing: **`768cba5` `feat: compute the impact frame from
  the interpolated curve`**, preceded by `chore: re-audit templates with
  keyframe easing` (the user's run), on session 23's `51fc0a7`. **This report's
  own commit follows it.** Everything was staged by path; `git add -A` was not
  used.
- `git log` checked for AI attribution and co-author trailers: none.
- `npm run check`: **exit 0, `check: PASS`**, read before committing —
  `@framopia/core` **409** (27 files), `framopia-service` **911** (65 files),
  `framopia-benchmarks` **166** (16 files), `framopia-panel` **131** passed + 2
  skipped (7 files), **1617 TS total** against session 23's 1608; pytest
  **141**, unchanged.
- **Neither `service:build` nor `panel:build` was run**, and neither needed to
  be: the session touched `core/`, `docs/` and `templates/library.audit.json`
  only. `service/dist` and `panel/dist` are session 22's, and nothing this
  session could have changed either bundle.
- New: `core/src/impact-crossing.ts` (+ test).
- Ledger `.local/costs.jsonl`: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at start
  and end. All-time spend unchanged at **$10.968590**.
- After Effects: **1 instance** at start and end, **0** `aerender`, not driven.

## Suggested next step

Build `vitasilk` as it stands and listen before ruling on the threshold. Every
sound is 8 frames late today, which on a slam is roughly a fifth of a second —
audible, and the point is that judging 95% against 90% from a numbers table is
guessing where judging it against a comp is not. Then set `IMPACT_THRESHOLD`,
point `deriveSfxEvents` at `impactCrossingOf` instead of `impactFrameOf`, re-run
`npm run migrate:sfx-placement -- --apply`, and rebuild. If the threshold lands
at 0.90 the events move to frame 4; at 0.95 they move to 5.25. Either is within
a frame and a half of the other, and both are two seconds better than where this
started.

## What the user does next

**Your audit gave me everything I needed, and the curve is now computed.** The
easing is a steep out-handle at 14% influence and a long ease-in at 66% — the
motion is over almost immediately and then settles, exactly as you described.

**The number is 5.25 frames, and you said 4.** I did not ship it.

Here is why I think the method is right and only one constant is wrong. All six
templates and every animated property come out at exactly 5.25, which is what
one shared easing preset should do. If I ignored the easing the answer would be
11.4, and the old wrong answer was 12 — so the curve is doing real work. What
sets 5.25 rather than 4 is a threshold I chose without measuring: **95% of the
way there**. Your frame 4 corresponds to **89.7%** — in round terms, 90%.

**So the question is yours, and it is one number:** when does a motion read as
*arrived* — at 90% or at 95%? On these templates that is the difference between
frame 4 and frame 5.25, about a twentieth of a second.

**I would not answer it from a table, and I would rather you did not either.**

**Build the reel and listen first.** I could not do it — building drives the
After Effects you have open, and I am not allowed to touch it. You run:

```
npm run build:reel -- --plan "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/my files/test videos/vitasilk.editplan.json"
```

Free, local, no API call, and it will refuse rather than close anything unsaved.
It writes into `.local/build/` and opens nothing by itself — you open the `.aep`
it names.

**What to judge when you play it.** Every sound is currently **8 frames late**,
about a fifth of a second, so:

- **the slams will land after the word, not on it** — that is the known error,
  and what you are listening for is how wrong a fifth of a second sounds, which
  tells us whether 90% or 95% is the right target;
- **do the subtitles finish their animation before they leave?** 23 cards have a
  clipped hold by design, and this is the first build since the alignment work
  retimed 67 words and moved 78 cards;
- **are the whooshes sitting right against the hits?** Their levels are derived
  now rather than typed, so they should be comparable for the first time.

There is **no watermark** on this reel's plan, so do not go looking for one.

Tell me the threshold and I will put the sound on the word.
