# Card duration: the gap the fix would take from is already spent

Measured 2026-08-28 over all five plans, from stored display timing. Read-only;
no plan was modified and no rule was changed.

## The distribution

343 cards, one word each.

| | s | frames at 29.97 |
|---|---:|---:|
| min | 0.010 | 0.3 |
| p10 | 0.139 | 4.2 |
| **median** | **0.300** | **9.0** |
| p90 | 0.601 | 18.0 |
| max | 1.260 | 37.8 |

| below | cards | of which reach it from the gap after their own word |
|---|---:|---:|
| 0.20 s | 89 | **0** |
| 0.25 s | 131 | **0** |
| 0.30 s | 165 | **0** |
| 0.40 s | 236 | **0** |
| 0.50 s | 276 | **0** |

## Why the zero column is zero

**There is no gap after a card. Block 7 session 9 already took all of it.**
`applyDisplayTiming` holds every card until the next word begins, bounded by
`MAX_SUBTITLE_HOLD_S` 1.2 s — a rule adopted to remove 17.25 s of blank screen.

- **336 of 343 cards already stay up past their own word.**
- The corpus has **22.039 s of silence after a word**, on 332 cards, and **all
  of it is already on screen.**
- What is left unclaimed across five reels is **one card and 0.080 s**.
- Only **3 cards** reach the 1.2 s cap, so raising it frees nothing either.

**A minimum on-screen duration that takes time from the gap after the word is
therefore already in force, and implementing it again would change one card.**
Writing it would look like a fix and do nothing, so it was not written.

## What is actually short

The card is short because the *next word* arrives, not because the card stops
early. At one word per card the cards inherit the speaking rate directly: a
median 0.300 s is 9 frames, and the declared entrance is 0.13 s of it.

The only remaining sources of time are both rulings, not fixes:

1. **Take time from the next card** — the card stays up while the next word is
   already being spoken. Both cards sit at the same screen position, so they
   would stack: `npm run retiming` measures 337 of 338 consecutive pairs
   overlapping under that reading. This is the reading the user rejected at two
   words per card, for the same reason.
2. **Put more than one word on a card again.** `MAX_WORDS_PER_CARD` is 1
   (Block 7 session 6). Pairing adjacent words back up, measured on the stored
   windows:

   | | one word | paired |
   |---|---:|---:|
   | cards | 343 | **173** |
   | median duration | 0.300 s | **0.640 s** |
   | p10 | 0.139 s | **0.380 s** |
   | under 0.40 s | 236 | **22** |

   It more than doubles the median and takes the under-0.40 s count from 236 to
   22, without a card ever appearing before its word — the pair's window starts
   at the first word. What it costs is what one word per card bought: a word is
   on screen before it is spoken, pooled median 0.410 s at the time it was
   measured.

**Nothing here is decided.** Both options reverse an earlier ruling of the
user's, and the evidence is put to him rather than acted on.
