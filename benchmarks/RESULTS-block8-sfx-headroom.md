# The hits clipped because the reel has no headroom

Measured 2026-08-28 with ffmpeg `astats`, read-only. No plan was written by this
measurement; the levels it justifies were applied by
`npm run migrate:sfx-placement -- --apply`.

## The reels

`npm run loudness:measure`, unchanged from session 25:

| reel | integrated | LRA | **true peak** |
|---|---:|---:|---:|
| ground-truth | −13.9 LUFS | 1.9 LU | **0.1 dBFS** |
| test-1 | −14.0 LUFS | 2.1 LU | **0.1 dBFS** |
| vitasilk | −14.4 LUFS | 1.2 LU | **0.0 dBFS** |
| test-2 | −14.6 LUFS | 1.3 LU | **0.2 dBFS** |
| test-3 | −14.6 LUFS | 1.5 LU | **0.1 dBFS** |

**Every reel is delivered on the ceiling.** That is the whole diagnosis.

## What was clipping, per event

The dialogue's own peak measured over the window each sound occupies, and over a
tight ±150 ms window around the instant the sound's own peak lands, summed with
the sound at session 25's gain. The sum is worst-case coherent — in phase, so
the amplitudes add — which is the bound that matters for something squaring off.

| reel | event | sound | sfx peak | dialogue (tight) | **sum (tight)** | sum (whole window) |
|---|---|---|---:|---:|---:|---:|
| test-1 | sfx001 | whoosh_01 | −14.00 | −0.00 | **+1.58** | +1.58 |
| test-1 | sfx002 | hit_01 | −8.00 | −0.00 | **+2.91** | +2.91 |
| test-1 | sfx003 | hit_01 | −8.00 | −1.22 | **+2.05** | +2.91 |
| test-1 | sfx004 | whoosh_01 | −14.00 | −2.48 | −0.43 | +1.58 |
| test-1 | sfx005 | whoosh_01 | −14.00 | −3.92 | −1.56 | +1.41 |
| test-1 | sfx006 | whoosh_01 | −14.00 | −6.43 | −3.40 | +0.44 |
| test-2 | sfx001 | hit_01 | −8.60 | −1.95 | **+1.36** | +2.74 |
| test-2 | sfx002 | hit_01 | −8.60 | −5.29 | −0.77 | +2.74 |
| test-2 | sfx003 | hit_01 | −8.60 | −0.81 | **+2.16** | +2.74 |
| vitasilk | sfx001 | whoosh_01 | −14.40 | −1.59 | **+0.20** | +0.20 |
| vitasilk | sfx002 | hit_01 | −8.40 | −8.86 | −2.61 | +2.60 |
| vitasilk | sfx003 | hit_01 | −8.40 | −7.43 | −1.88 | +2.80 |
| vitasilk | sfx004 | whoosh_01 | −14.40 | −6.54 | −3.59 | +1.28 |
| vitasilk | sfx005 | hit_01 | −8.40 | −6.34 | −1.29 | +2.80 |
| vitasilk | sfx006 | whoosh_01 | −14.40 | −5.81 | −3.06 | +0.25 |
| vitasilk | sfx007 | whoosh_01 | −14.40 | −7.59 | −4.33 | +1.51 |
| vitasilk | sfx008 | whoosh_01 | −14.40 | −0.70 | **+0.93** | +0.93 |

**7 of 17 exceed 0 dBFS even on the tight window. All 17 exceed it somewhere in
the window the sound is playing.** By up to **+2.91 dB**.

## No sfx gain solves it

The dialogue reaches **−0.00 dBFS** inside almost every one of these windows. A
second signal at peak `s` sums to `20·log10(1 + 10^(s/20))`, which is **greater
than 0 dBFS for every finite `s`** — a hit at −40 dBFS still puts the sum
0.09 dB over. There is no gain, however small, that satisfies a ceiling at or
below full scale while the voice is already on it.

**So the constraint cannot be met by choosing an SFX level, and session 25's
approach could not have worked at any offset.** The room has to be made.

## The rule

`MIX_CEILING_DBFS = -1.0` — **CHOSEN, NOT MEASURED.** Below full scale so
inter-sample peaks and any later encode have somewhere to go, and only just,
because every decibel is a decibel the whole reel is quieter.

`dialogueAttenuationDb` is **derived, not chosen**. The dialogue's peak and the
sfx target both move with the attenuation, so the sum moves with it one for one,
and the smallest attenuation that works is exactly how far the un-attenuated sum
overshoots the ceiling:

    A = max(0, summedPeak(dialoguePeak, dialogueLufs + loudestOffset) − ceiling)

It is taken against the loudest kind bound to anything, so one figure covers the
reel and **the balance between voice and effect is untouched** — everything
comes down together.

| reel | attenuation | hit peaks | whoosh peaks |
|---|---:|---:|---:|
| ground-truth | −4.01 dB | −11.91 dBFS | −14.91 dBFS |
| test-1 | −3.98 dB | −11.98 dBFS | −14.98 dBFS |
| test-2 | −3.89 dB | −12.49 dBFS | −15.49 dBFS |
| test-3 | −3.82 dB | −12.42 dBFS | −15.42 dBFS |
| vitasilk | −3.80 dB | −12.20 dBFS | −15.20 dBFS |

## After

Re-measured against the attenuated dialogue, same windows, same method:

**0 of 17 events exceed the ceiling, on either window. The worst sum anywhere is
−1.00 dBFS**, which is the ceiling exactly — confirming the attenuation is the
minimum that works rather than a padded guess.

| reel | worst sum (whole window) |
|---|---:|
| test-1 | −1.07 dBFS |
| test-2 | −1.15 dBFS |
| vitasilk | −1.00 dBFS |

## Which constraint binds

`sfxLevel` reports `loudness-offset` or `headroom-ceiling` per event, so the two
rules cannot silently disagree. **With the mix attenuated the offset binds at
all 17 events** — the ceiling is a bound none of them reaches. An event
reporting `headroom-ceiling` would mean the voice is louder at that instant than
the reel-wide figures predicted, which is worth seeing rather than absorbing.

## The whooshes

**They were at the dialogue's own level and inaudible. They are +3 dB now.**
`SFX_TARGET_OFFSET_DB.whoosh` goes 0 → 3, **CHOSEN, NOT MEASURED**: a whoosh is
a bed under a moving image rather than an accent, so it belongs below the hit's
+6 and above the voice it has to be heard through.

In absolute terms `whoosh_01` moves −14.40 → −15.20 dBFS on `vitasilk`, which
looks quieter and is not: the voice moved 3.8 dB further, so **against the
dialogue the whoosh is 3 dB louder than it was**.

**There is room to go further, and this is what limits it.** At +3 the whooshes
sum to −1.7 to −3.0 dBFS, well inside the ceiling; the binding constraint on the
whole mix is the **hit at +6**, which is what sets the attenuation. Raising the
whoosh past +6 would make the whoosh set it instead and pull the whole reel
down further. So the file is not the problem and neither is the ceiling —
between +3 and +6 the only cost of going louder is the user's ear.
