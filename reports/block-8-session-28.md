Status: PROBLEM — the user's After Effects has unsaved changes, so the probe could not run and Goal 1 is unanswered

# Block 8 session 28 — the probe is built, the question is still open

**Spent $0.00; no API was called.** `.local/costs.jsonl` byte-identical at both
ends: **108 lines, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.**

**After Effects, before and after: 1 instance (pid 79146, running since
2026-08-27 21:00, unrestarted), 0 `aerender`.** No stray `-r` process — the
only `-r` matches on this machine are this session's own shell invocations.
`templates/library.aep` was not opened or modified.

## What stopped it

    After Effects refused at new-project: the open After Effects project has
    unsaved changes: /Volumes/T7 Shield/INSEA/Projects/framopia-studio/
    .local/build/vitasilk-full.aep. This will not close it. Save or close it
    yourself, then run it again.

That is a hard stop in this session's brief and it fired on the first send.
**Nothing was changed in your project**: the refusal happens before anything is
closed or created, `.local/build/vitasilk-full.aep` is untouched at its Aug 28
19:33 timestamp, no probe project was written, and the instance is the same one
you have had open since Thursday.

**What you need to do is one thing:** in After Effects, save
`vitasilk-full.aep` (Cmd-S) or close it. Then:

    npm run probe:audio-start

It takes a few seconds and answers the question outright.

## Done

### Goal 1 — the probe exists; the answer does not

`npm run probe:audio-start` is built and wired, and the run above is the only
thing between it and the answer. It is deliberately minimal — one throwaway
comp, one audio layer per case, no reel — and it **decides nothing**: it asks
After Effects and prints what After Effects says.

Four cases, chosen so a wrong reading is visible as a wrong reading:

| case | `startTime` asked | in-point asked | what it settles |
|---|---:|---|---|
| `control_positive` | +1.0000 | — | that the read-back path works at all |
| `needed_negative` | **−0.4671** | — | the real question |
| `negative_inpoint_zero` | −0.4671 | 0 | whether a layer may begin before the comp while the portion that plays starts at zero |
| `deep_negative` | −1.5000 | — | whether any clamp is at zero or at some other bound |

Per case it reads back `startTime`, `inPoint`, `outPoint`, where the file's own
time zero lands, where the measured peak therefore lands, and `hasAudio` /
`audioActive` / `Audio Levels`. It then prints **HONOURED** or **CLAMPED** in
those words, with the number AE reported beside the number it was asked for.

**The −0.4671 s is derived, not typed.** It comes from `vitasilk`'s own plan
(`img001` starts 0.0990 s), the template audit (`img_float`'s impact 0.1354 s
after the element) and `whoosh_01`'s measured anchor (0.6913 s into the file),
put through **`placeSfx` itself** with the composition start below zero — one
implementation of the placement rule rather than a second copy of its
arithmetic. It reproduces session 27's figure exactly: **14.00 frames**. A test
pins that the unclamped ideal is the negative of what the clamped placement
reports as its shortfall.

The probe carries the same refusal every script that opens a project carries,
and it **names the project it closes** when the project is clean, rather than
closing yours silently.

### Goals 2, 3 and 4 — not started, deliberately

The brief is explicit: *"Goal 1 cannot establish what After Effects actually
does with a negative `startTime`. Report and stop; do not ship a placement whose
behaviour you have not observed."*

So no placement changed, no plan was re-derived, and `vitasilk` was not built.
**The four whooshes that land correctly are untouched, the hits stay unbound,
`IMPACT_THRESHOLD` stays 0.90, and the first image stays silent** until the
answer is in.

I did not reach for the alternatives, and they are worth naming so they are not
tried later by mistake. **Adobe's documentation is not evidence about this
host** — guidelines §3 is explicit that a claim about the environment needs an
observation from inside it, and this exact class of mistake has cost this
project two sessions already. **A second After Effects instance is worse**: the
drive layer refuses to send when more than one is running, because an Apple
event then goes to a non-deterministic recipient, and a resident second instance
has previously quit the application under a later session.

## Deviations

None. Every hard stop held. The one that fired — unsaved changes — is reported
rather than worked around, and no project was closed that this session did not
open.

## Failures & open problems

- **Goal 1 is unanswered.** Everything else in the session depended on it.
- **The first image of a reel is still silent** on `test-1` and `vitasilk`, as
  session 27 left it.
- **If AE clamps, that is the end of this thread.** The probe is written to say
  so in those words, and the honest outcome would be that the first image stays
  silent and the refusal path in `deriveSfxDetail` stays as it is.
- **If AE honours it**, Goal 2 is a small change: `placeSfx` stops clamping at
  the composition start, `unplaceable` narrows to the case where even a negative
  start cannot reach — and if that case cannot arise, the refusal path is
  retired rather than left guarding nothing.
- **One thing the probe cannot settle**: whether the audio is *heard* correctly
  from a negative start. It reads what AE stores, which is the mechanism; only a
  render or a playback proves the sound. Your ear on the built reel is the last
  step either way.

## Repo state

Branch `main`, HEAD **`86f5f11`** at the time of writing; this report's own
commit follows.

    86f5f11 feat: add a probe for a layer starting before the composition

Neither `npm run service:build` nor `npm run panel:build` was needed for a
handback — nothing the service serves or the panel renders changed — but the
service was compiled during typechecking and the probe runs from source through
`tsx`.

`npm run check` **passes, exit 0**, read from the exit status:

| workspace | tests |
|---|---:|
| `@framopia/core` | 444 |
| `framopia-service` | 934 |
| `framopia-benchmarks` | 166 |
| `framopia-panel` | 132 passed, 2 skipped |
| **TypeScript total** | **1676** |
| pytest (sidecar) | **166** |

Session 27 closed at 1675 TS and 166 pytest; the one added is the unclamped-ideal
test above.

## Suggested next step

**Save or close `vitasilk-full.aep`, then run the probe.**

    npm run probe:audio-start

Read the last two lines. They say **HONOURED** or **CLAMPED**, with the number
After Effects reported beside the one it was asked for.

- **HONOURED**: the first image's whoosh is recoverable. The next session drops
  the clamp from `placeSfx`, re-derives the five plans, reports how much of the
  file is cut off before the peak (`whoosh_01` is inaudible for its first
  0.3493 s and peaks at 0.6913 s, so a 0.4671 s cut costs nothing audible, but
  that is arithmetic and the build is what confirms it), and builds `vitasilk`
  for you to hear.
- **CLAMPED**: the thread closes. The first image stays silent, the refusal path
  stays, and the reason is recorded rather than retried.

Either way the build command afterwards is:

    npm run build:reel -- \
      --plan "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/my files/test videos/vitasilk.editplan.json" \
      --mode k2-syndicalia
