Status: OK

# Block 8 session 29 — the first image has its sound back

**Spent $0.00; no API was called.** `.local/costs.jsonl` byte-identical at both
ends: **108 lines, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.**

**After Effects: 1 instance before and after (pid 79146), 0 `aerender` before
and after, no stray `-r` process.** `templates/library.aep` was not opened or
modified.

## Done

### Before anything: the session started blocked, and a measurement unblocked it

The first send refused: *"the open After Effects project has unsaved changes
**and has never been saved**"*. That is the hard stop — with the qualifier this
brief adds, that a project which was never written is not the same as unsaved
work.

**I established which it was before touching anything**, with a read-only query:
the open project held **two items, `audio_start_probe` and `whoosh_01.wav`** —
both created by my own probe when you ran it last session. No user work was at
risk.

**It was saved, never discarded**, to `.local/build/audio-start-probe.aep`: 2
items before, 2 after, clean afterwards. Discarding would have been the wrong
move even for a leftover, and saving cost nothing.

**The cause is a defect in the probe I shipped**, and it is fixed:
`audio-start-probe.jsx` created a project and never saved it, so the next tool
to run — including itself — refused on a project it could not tell from
someone's morning. It saves to its own `savePath` now.

### Goal 1 — After Effects honours a negative start, observed here

`npm run probe:audio-start`, run in this session rather than taken on report:

| case | asked | AE reports | in-point | out | peak lands |
|---|---:|---:|---:|---:|---:|
| control, positive | 1.0000 | 1.0000 | 1.0000 | 2.95 | 1.6913 |
| **the real case** | **−0.4671** | **−0.4671** | −0.4671 | 1.48 | **0.2241** |
| same, in-point pinned to 0 | −0.4671 | −0.4671 | **0.0000** | 1.48 | 0.2241 |
| deep negative | −1.5000 | −1.5000 | −1.5000 | 0.45 | −0.8087 |

**HONOURED**, exactly, including at −1.5 s. **`startTime` and `inPoint` move
independently** — the layer's own time zero sits before the composition while
the portion that plays begins at frame zero — and the builder now sets both,
stating the active range rather than inheriting it.

**So `placeSfx` no longer clamps.** The peak lands on the impact frame for every
sound whatever its lead-in, and `beforeCompS` reports how much of the file falls
outside the composition.

**The refusal path is retired, not left guarding nothing.** `unplaceable` is
gone from `deriveSfxDetail`, `SfxPlacement.clamped`/`clampedByS` are gone, and
`SfxEvent.clamped`/`clampedByS` are gone from the schema — no plan carried
either. `checkBuildability` also stopped calling a negative in-point an issue:
that rule was true while the placement clamped and false the moment it stopped,
and it is now pinned the other way by a test.

**`SilentImageSlotError` and the every-image-has-a-sound guarantee are
unchanged** for the case they were built for — a template that binds nothing —
and the guarantee is now unconditional, because no image can be unreachable.

**The corpus: 7 events → 9, and not one of the 7 moved.**

| reel | element | before | after | moved |
|---|---|---:|---:|---:|
| test-1 | img001 | — | **−0.467** | new |
| test-1 | img002 | 4.037 | 4.037 | +0.00 f |
| test-1 | img003 | 10.377 | 10.377 | +0.00 f |
| test-1 | img004 | 19.152 | 19.152 | +0.00 f |
| vitasilk | img001 | — | **−0.467** | new |
| vitasilk | img002 | 5.706 | 5.706 | +0.00 f |
| vitasilk | img003 | 11.078 | 11.078 | +0.00 f |
| vitasilk | img004 | 16.383 | 16.383 | +0.00 f |
| vitasilk | img005 | 19.453 | 19.453 | +0.00 f |

**Asserted, not eyeballed:** the four you ruled correct, and the three on
`test-1`, are compared against a snapshot taken before the migration and the
count of moved pre-existing events is **0**.

### Goal 2 — what the negative start costs

`benchmarks/RESULTS-block8-lead-in-cost.md`. **Seven of nine events lose
nothing**; only the first image of a reel starts before the composition.

**0.4671 s of `whoosh_01` falls before frame zero**, of which 0.3493 s is the
file's own inaudible head. **The remaining 0.1178 s — 3.53 frames — is past the
point the file itself calls audible**, so this is not the clean case where the
whole lead-in is silence, and saying otherwise would be arithmetic dressed as an
answer.

**So I measured what is actually there.** A 20 ms window at the cut point:

| | at the cut (0.4671 s) | at its own peak (0.6913 s) |
|---|---:|---:|
| peak | **−31.19 dBFS** | 0.00 dBFS |
| RMS | **−37.17 dBFS** | −6.66 dBFS |

The whoosh begins **31.2 dB below its own peak**, in the quiet part of the
swell; at the reel's −13.24 dB layer gain that is about −44 dBFS, roughly **26
dB under the dialogue** at that instant. **Nothing that reads as a transient is
lost.** A sound starting mid-attack would click; this one starts about as far
under the mix as a sound can be and still be called audible.

**The 0.31 frames reproduces exactly.** The derivation gives −0.31 frames on
both `img001` events, matching the probe's 0.2241 s against an impact at
0.2344 s. It is the frame grid: the ideal in-point is 13.69 frames and
`snapToFrame` rounds early by design. **10.2 ms, below what the grid can
express** — every other event carries the same kind of residue (−0.32 to +0.44
frames), because every one is snapped the same way. **Not worth correcting**;
correcting it would mean placing a layer between frames.

### Goal 3 — built, and the build is checked against the plan

`vitasilk` built with `--mode k2-syndicalia` in 1.7 s.

| element | plan | built `startTime` | `inPoint` |
|---|---:|---:|---:|
| **img001** | **−0.4671** | **−0.4671** | **0.0000** |
| img002 | 5.7057 | 5.7057 | 5.7057 |
| img003 | 11.0777 | 11.0777 | 11.0777 |
| img004 | 16.3830 | 16.3830 | 16.3830 |
| img005 | 19.4528 | 19.4528 | 19.4528 |

The build spec matches the plan on all five, and After Effects stored what it
was asked for on all five.

**That check is now permanent, not something I did once.** `npm run build:reel`
reads every audio layer's start back out of the built project, prints the worst
disagreement, and **fails the build** on a real one.

**Its tolerance is measured, and finding it was worth the trouble.** At 1e-6 s
the check reported four disagreements whose printed values were identical. The
cause: After Effects re-derives a layer's start onto its own grid using a
**float32** frame rate — 29.9700317382812, not the exact 30000/1001 — so a start
snapped with the rational lands a fraction off. The residue is at most
**5.8e-4 frames** and **grows with time**, exactly as a frame-rate difference
does. The tolerance is **0.01 frames**, which clears that by more than an order
of magnitude while still catching a real disagreement, which would be a whole
frame or more. Final run: **5 checked, 0 disagreeing, worst 5.8e-4 frames.**

## Deviations

**I saved a project I did not open**, having first established read-only that it
contained nothing but my own probe's two items. The hard stop forbids *closing*
a project I did not open and requires preserving the distinction between a
never-written project and unsaved work; saving discards nothing and was the most
conservative action that unblocked the session. Reported here rather than done
quietly.

**One change beyond the letter of the goals**, both reported: the probe now
saves its own project (the defect that blocked the session), and the builder
verifies its audio layers against the plan (Goal 3 asked me to check it once; a
property that is checked once is a property nobody checks).

**Seven tests asserting retired behaviour were rewritten in the change that
retired it**, per guidelines §3 — the clamp tests in `sfx-placement.test.ts`, the
unreachable-image tests in `sfx-guarantee.test.ts`, the refusal test in
`analysis/sfx-placement.test.ts`, and the buildability issue count in
`steps.test.ts`. A new `buildability.test.ts` pins the new rule in both
directions.

## Failures & open problems

- **Nothing in this session has been heard.** The placement is verified as far
  as After Effects' own numbers go; whether the first image's whoosh *sounds*
  right is your ear.
- **The 0.1178 s of audible material cut on `img001` is real**, even though it
  measures 31.2 dB down. If it clicks, the fix is a shorter-lead-in file, not a
  placement change.
- **`plan.clientMode` is null on all five plans**, so `npm run build:reel` needs
  `--mode`. Carried from session 25, unchanged.
- **`test-2` still has no sound at all** — keywords but no image slots, and the
  hits are unbound. Nothing is wrong with it.

## Repo state

Branch `main`, HEAD **`3a4c12b`** at the time of writing; this report's own
commit follows.

    3a4c12b docs: record session 29 in the operating memory
    995bd27 feat: verify the built audio layers against the plan
    9b1817a docs: measure what the lead-in outside the composition costs
    f761dfd feat: let a sound start before the composition

`npm run service:build` ran — the service's placement, derivation and
buildability all changed. `npm run panel:build` ran, though nothing the panel
renders changed.

`npm run check` **passes, exit 0**, read from the exit status:

| workspace | tests |
|---|---:|
| `@framopia/core` | 445 |
| `framopia-service` | 936 |
| `framopia-benchmarks` | 166 |
| `framopia-panel` | 132 passed, 2 skipped |
| **TypeScript total** | **1679** |
| pytest (sidecar) | **166** |

Session 28 closed at 1676 TS and 166 pytest.

## Suggested next step

**`vitasilk` is already built and open in After Effects** — it was built from
this session's plan, verified against it, and left there. You can listen without
running anything.

To rebuild it:

    npm run build:reel -- \
      --plan "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/my files/test videos/vitasilk.editplan.json" \
      --mode k2-syndicalia

It refuses if the open project has unsaved changes; save or close first.

**One thing to judge: does the first image now have a whoosh that lands with the
picture, and do the other four still?** The first one is the new sound — its
layer begins 0.467 s before the composition, so you hear it already under way
rather than from the start, and its peak should sit on the picture exactly as
the other four do. If the first one lands right and the other four are
unchanged, the sound is finished.
