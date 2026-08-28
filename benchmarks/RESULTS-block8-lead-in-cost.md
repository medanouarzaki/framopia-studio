# What a sound starting before the composition costs

Measured 2026-08-29. Free and local; the placement figures come from the
derivation, the audio levels from ffmpeg `astats` on the file itself.

Two of the corpus's nine whooshes now begin before frame zero, so part of the
file is outside the composition and is not heard. This is what that part
contains.

## Per event

| reel | element | in-point | cut before frame 0 | frames | of which audible | snap error |
|---|---|---:|---:|---:|---:|---:|
| test-1 | img001 | **−0.4671** | 0.4671 | 14.00 | **0.1178** | −0.31 f |
| test-1 | img002 | 4.0374 | 0 | 0 | 0 | −0.17 f |
| test-1 | img003 | 10.3770 | 0 | 0 | 0 | −0.18 f |
| test-1 | img004 | 19.1525 | 0 | 0 | 0 | −0.32 f |
| vitasilk | img001 | **−0.4671** | 0.4671 | 14.00 | **0.1178** | −0.31 f |
| vitasilk | img002 | 5.7057 | 0 | 0 | 0 | +0.08 f |
| vitasilk | img003 | 11.0777 | 0 | 0 | 0 | +0.44 f |
| vitasilk | img004 | 16.3830 | 0 | 0 | 0 | −0.03 f |
| vitasilk | img005 | 19.4528 | 0 | 0 | 0 | +0.26 f |

**Seven of nine lose nothing at all.** Only the first image of a reel starts
before the composition, and only on the two reels that have image slots.

## Is anything audible lost?

**Yes, 0.1178 s of it — and it is arithmetic, so here is the arithmetic.**

`whoosh_01` is 1.9512 s long, first audible at **0.3493 s**, peaking at
**0.6913 s**. The cut is 0.4671 s, which is **0.1178 s (3.53 frames) past the
point the file itself calls audible**. So this is not the clean case where the
whole lead-in is silence; the sound is already under way when the composition
starts.

**What is under way, measured at the cut point** — a 20 ms window at 0.4671 s
into `whoosh_01`:

| | at the cut (0.4671 s) | at its own peak (0.6913 s) |
|---|---:|---:|
| peak level | **−31.19 dBFS** | 0.00 dBFS |
| RMS level | **−37.17 dBFS** | −6.66 dBFS |

**The whoosh begins 31.2 dB below its own peak**, in the quiet part of the
swell. At `vitasilk`'s −13.24 dB layer gain that is about **−44 dBFS absolute**,
against a dialogue sitting near −18.2 LUFS as the build plays it — roughly
**26 dB under the voice** at that instant.

**Nothing that reads as a transient is lost.** A sound that started mid-attack
would click; this one starts about as far below the mix as a sound can be and
still be called audible. The 0.1178 s is real and is reported because it is
real, not because it can be heard.

## The 0.31 frames

The probe reported the peak landing at 0.2241 s against an impact at 0.2344 s.
**The derivation reproduces it exactly: −0.31 frames on both `img001` events.**

It is the frame grid, not a placement error. The ideal in-point is
0.2344 − 0.6913 = −0.4569 s, which is 13.69 frames — between two frames — and
`snapToFrame` rounds to 14 frames early, by design: *a sound that arrives a
fraction early reads as part of the impact; one that arrives a fraction late
reads as a separate event.*

**0.31 frames is 10.2 ms, and it is below what the grid can express.** Every
other event in the corpus carries the same kind of residue — +0.44, −0.32,
−0.18, +0.08 frames — because every one of them is snapped the same way. The
largest is under half a frame by construction. **Not worth correcting**, and
correcting it would mean placing a layer between frames, which the timeline does
not do.
