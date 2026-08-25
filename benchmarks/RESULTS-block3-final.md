# The complete pipeline on five reels, after the v1.0.7 changes

> **Superseded WER figures (Block 4 session 1).** The `ground-truth` reel's
> reference was corrected again: five standalone conjunction and article
> tokens were fused per guide §2, taking it from 81 reference words to 76.
> Every ground-truth WER number below is scored against the old text. The
> re-scored figures and the token list are in
> `RESULTS-block4-refcorrection.md`. The findings here are unaffected; only
> the WER column moved.

Block 3 session 6, the run the block is signed off from. All five reels
re-transcribed under orthography guide **v1.0.7** and correction prompt
**version 4**, then vitasilk and test-1 taken through the full analysis stage
with keyword prompt **version 3**.

Mode `k2-syndicalia` v2, `gemini-3.1-pro-preview`, stub template manifest.

## The conjunction rule took

The gate on this run was whether stating the rule in the prompt changed
anything. It did, completely.

| reel | attached | standalone |
|---|---|---|
| ground-truth | 6 | **0** |
| test-1 | 3 | **0** |
| test-2 | 6 | **0** |
| test-3 | 5 | **0** |
| vitasilk | 2 | **0** |
| **total** | **22** | **0** |

Attached forms produced: `w7essa`, `wl'effet`, `wa7d`, `wzayd`, `wki3tiw`,
`whia`, `wki3tewna`, `wmabin`, `wlkerch`, `wbddbt`, `wli`, `wkay3ti`,
`wl9iti`, `wla`, and in Arabic script `ونضارة` and `ومادة`. Every previous
Block 3 transcript wrote a standalone `w`; none does now.

`dial la vidéo` came out correctly in test-1, exactly as the user's listening
pass settled it.

## WER against the v1.0.7 references

| reel | production, session 1 | production, now | run C hybrid | gap |
|---|---|---|---|---|
| ground-truth | 19.8% | 22.2% | 16.0% | **+6.2** |
| test-1 | 31.3% | **14.7%** | 20.6% | **−5.9** |
| test-2 | 34.3% | **22.9%** | 28.6% | **−5.7** |
| test-3 | 20.0% | **16.7%** | 18.3% | **−1.6** |

**The session-1 gap does not survive on three of the four reels — it
inverted.** test-1, test-2 and test-3 now score *better* than run C, by 5.9,
5.7 and 1.6 points. test-1 halved, from 31.3% to 14.7%.

fr/en WER is **0.0% on test-1 and test-2** and 6.3% on test-3.

### The one reel that got worse, and why

ground-truth went from +3.8 to +6.2 against run C. It is **a reference defect,
not a transcript defect**. Its own reference writes the conjunction standalone
in places while writing it attached in others:

```
line 31  Mabin 7essa w 7essa                       → v1.0.7 wants  w7essa
line 33  W l'effet dialha kidom lmodat sana        → v1.0.7 wants  Wl'effet
line 35  Li houa wa7d l cocktail dial lvitaminat   → §2 wants      lcocktail
line 36  Wzayd 3lih l caféine                      → §2 wants      lcaféine
line 38  Mabin 7essa w 7essa 15 yom                → v1.0.7 wants  w7essa
```

Roughly half of ground-truth's eighteen scored errors are the transcript
attaching correctly against a reference that does not. test-3 has one more of
these (`réticulé w مادة الكافيين` on line 18); test-1 and test-2 have none,
which is why they improved cleanly.

**These were not corrected.** Goal 1's rule was to fold in what the listening
pass settled and not to guess at anything else, and this defect class was
found by measurement afterwards rather than by the listening pass. The tokens
are named above so a single pass can fix them; nothing about them is
ambiguous, only unauthorised.

## Keywords — the label and the promise

Keyword prompt version 3 makes the two co-primary and the selector forces at
least one of each. Every keyword selected in Block 3 before this session was a
name.

### vitasilk — 25.7 s, $0.0490

| id | kind | text | words | score | template | supersedes | reason (verbatim) |
|---|---|---|---|---|---|---|---|
| k001 | **label** | `filler glow` | 2 | 0.95 | kw_slam | g013 | names the specific product being promoted |
| k002 | **label** | `Vita Silk` | 2 | 0.95 | kw_slam | g016 | identifies the brand manufacturing the product |
| k003 | **promise** | `7rir` | 1 | 0.90 | kw_slam | g010 | promises a silky texture for the hair |

### test-1 — 22.0 s, $0.1233 (the third of three runs, the one on disk)

| id | kind | text | words | score | template | supersedes | reason (verbatim) |
|---|---|---|---|---|---|---|---|
| k001 | **promise** | `شد` | 1 | 0.95 | kw_slam | g002 | states the primary structural benefit of lifting |
| k002 | **label** | `محفزات الكولاجين` | 2 | 0.95 | kw_slam | g013 | names the exact category of the aesthetic product |
| k003 | **promise** | `jawdat البشرة` | 2 | 0.95 | kw_slam | g037 | specifies the skin attribute that will be upgraded |

No resolution failures, no diversity skips, nothing narrowed, no text
mismatches, and **no kind shortfall** on either reel.

## Three test-1 runs, cache bypassed

| run | cost | k001 | k002 | k003 | mix |
|---|---|---|---|---|---|
| 1 | $0.1285 | `محفزات الكولاجين` label | `شد` promise | `jawdat البشرة` promise | 1 label, 2 promise |
| 2 | $0.0976 | `محفزات الكولاجين` label | `شد طبيعي` promise | `jawdat البشرة` promise | 1 label, 2 promise |
| 3 | $0.1233 | `شد` promise | `محفزات الكولاجين` label | `jawdat البشرة` promise | 1 label, 2 promise |

Appearing in **all three**: `محفزات الكولاجين` (label) and `jawdat البشرة`
(promise) — same word ids, same spans.

Appearing in **two of three**: `شد` (promise), in runs 1 and 3.

Appearing in **one**: `شد طبيعي` (promise), in run 2 — the same moment as
`شد`, one word longer.

**The label/promise mix held in all three runs**, 1 label and 2 promises each
time, and no run reported a kind shortfall. Scores moved (0.92–0.99 on the
same word) and reasons were reworded every time. Reported flat.

## Image slots

### vitasilk — 5 slots, $0.0517

| id | window | template | idea (verbatim) |
|---|---|---|---|
| img001 | 0.10–1.60 s | img_float | A clock face showing exactly five minutes |
| img002 | 6.26–8.86 s | img_slide_left | A cosmetic bottle of hair serum on a presentation podium |
| img003 | 11.48–13.96 s | img_float | Vitamin capsules and scientific molecular structures blending into a thick hair cream |
| img004 | 16.91–18.74 s | img_slide_left | A woman looking at a mirror touching her hair with a thoughtful expression |
| img005 | 20.00–22.04 s | img_float | A salon shelf displaying premium hair care products |

### test-1 — 4 slots, $0.0815

| id | window | template | idea (verbatim) |
|---|---|---|---|
| img001 | 0.10–1.38 s | img_float | A woman gently touching her firm lifted jawline. |
| img002 | 4.60–6.76 s | img_slide_left | A female doctor in a medical coat holding a small vial. |
| img003 | 10.94–12.54 s | img_float | A woman's cheek showing a subtle skin tightening and smoothing effect. |
| img004 | 19.72–21.94 s | img_slide_left | Flawless deeply hydrated facial skin with a healthy texture. |

**Every image slot passes the duration check on both reels** — 0 of 5 and 0 of
4 too short, against 3 of 5 and 1 of 4 in session 5.

### Composed prompts, punctuation verified clean

**vitasilk img001** (composition low-in-frame, lighting hard directional, crop
macro):

```
A clock face showing exactly five minutes. a single clear idea, readable at a
glance. one subject, centred and unobstructed. dominant colour palette of
#1A0000, #820000 and #C9A96E. lit against #1A0000, with #F8F6F2 reserved for
highlights. subject low in frame with headroom above. hard directional light
with defined shadow. macro, a single detail standing for the whole.
```

**vitasilk img002** (off-centre, flat frontal, wide):

```
A cosmetic bottle of hair serum on a presentation podium. a single clear idea,
readable at a glance. one subject, centred and unobstructed. dominant colour
palette of #1A0000, #820000 and #C9A96E. lit against #1A0000, with #F8F6F2
reserved for highlights. subject off-centre with open space to one side. flat
frontal light, no modelling. wide, the whole subject with air around it.
```

**test-1 img001** (centred symmetrical, hard directional, wide):

```
A woman gently touching her firm lifted jawline. a single clear idea, readable
at a glance. one subject, centred and unobstructed. dominant colour palette of
#1A0000, #820000 and #C9A96E. lit against #1A0000, with #F8F6F2 reserved for
highlights. subject centred, symmetrical. hard directional light with defined
shadow. wide, the whole subject with air around it.
```

**test-1 img002** (off-centre, flat frontal, macro):

```
A female doctor in a medical coat holding a small vial. a single clear idea,
readable at a glance. one subject, centred and unobstructed. dominant colour
palette of #1A0000, #820000 and #C9A96E. lit against #1A0000, with #F8F6F2
reserved for highlights. subject off-centre with open space to one side. flat
frontal light, no modelling. macro, a single detail standing for the whole.
```

All four checked programmatically for doubled punctuation and doubled
whitespace: **clean**. Session 5's `...five minutes.. a single clear idea` is
gone.

## SFX events

vitasilk, 8 events; test-1, 7. Generated from the assigned templates and the
manifest bindings, recomputed every run.

```
vitasilk                                   test-1
sfx001 img001 whoosh_01 @0.15s  -12dB      sfx001 img001 whoosh_01 @0.15s  -12dB
sfx002 k003   hit_01    @5.52s   -6dB      sfx002 k001   hit_01    @0.50s   -6dB
sfx003 img002 whoosh_01 @6.26s   -9dB      sfx003 img002 whoosh_01 @4.60s   -9dB
sfx004 k001   hit_01    @7.08s   -6dB      sfx004 k002   hit_01    @5.84s   -6dB
sfx005 k002   hit_01    @8.34s   -6dB      sfx005 img003 whoosh_01 @10.99s -12dB
sfx006 img003 whoosh_01 @11.53s -12dB      sfx006 img004 whoosh_01 @19.72s  -9dB
sfx007 img004 whoosh_01 @16.91s  -9dB      sfx007 k003   hit_01    @20.94s  -6dB
sfx008 img005 whoosh_01 @20.05s -12dB
```

No subtitle group produces one — §10's rule, and 41 groups would have meant 41
sounds.

## Buildability

| | session 5 | after 4a (guide timings) | after 4b (display timing) |
|---|---|---|---|
| vitasilk total | 31 | 17 | **10** |
| vitasilk subtitle groups | 26 of 42 | 12 | **7 of 41** |
| test-1 total | 25 | 12 | **8** |
| test-1 subtitle groups | 23 of 39 | 10 | **7 of 38** |

Setting `sub_pop` to TEMPLATE_LIBRARY_GUIDE §5's own budget — 4 frames per end
at 30 fps, a 0.33 s floor instead of 0.60 s — removed 14 and 13 failures on
its own. Display timing removed most of the rest: 12 of vitasilk's 41 groups
and 10 of test-1's 38 now hold their card past the last word to reach the
floor, and test-1 merged one pair of groups.

Word timings were not touched. `start`/`end` remain exactly what the words
say; `displayStart`/`displayEnd` are the card.

**What still fails, and why it cannot be fixed automatically:**

- 7 subtitle groups per reel. Each is blocked either because merging would
  make a 3-word group, or because the group is superseded by a keyword and
  merging it would break the one-span-one-group alignment the emphasis layer
  rests on.
- 3 keywords on vitasilk and 1 on test-1, against `kw_slam`'s 0.65 s. A
  1-word keyword on a word spoken in 0.26 s cannot reach it, and a keyword has
  no display window — it replaces a subtitle group and inherits that group's
  timing question.
- **0 image slots on either reel.**

### Words too short to be real timings

vitasilk 5, test-1 6. Reported, never repaired — an alignment question that
belongs to Block 2.

```
vitasilk  w0000 "5" 0.000s (interpolated)   w0013 "ghayrdd" 0.020s (scribe)
          w0028 "mn" 0.000s (interpolated)  w0032 "nourrit" 0.021s (scribe)
          w0050 "chno" 0.000s (interpolated)
test-1    w0008 "tb3i" 0.000s (interpolated)   w0009 "m3aya" 0.000s (interpolated)
          w0010 "tal" 0.000s (interpolated)    w0031 "f" 0.040s (scribe)
          w0033 "dialna" 0.021s (scribe)       w0047 "kidom" 0.040s (scribe)
```

Seven of the eleven are interpolated, which points at alignment rather than at
Scribe.

## Template assignment

With one variant per type in the real mode, both reels came out all `sub_pop`
and all `kw_slam`; image slots alternate the two variants the mode allows.
Session 4's coprime rotation was replaced with a seeded shuffle carrying a
no-adjacent-repeat constraint, so a multi-variant mode no longer emits a
visible A,B,C cycle. Determinism is unchanged and the multi-variant path stays
covered by the fixture tests.

## Cache hit

Both stages re-run on vitasilk: **$0.0000** each, no new ledger line (84 lines
before, 84 after), and ten differing leaves, every one bookkeeping —
`meta.updatedAt`, both stages' `costUsd`/`cached`/`completedAt`,
`costs.totalUsd`, and `costs.byStage.analysis` and `.images`.

## Spend

| | |
|---|---|
| billable calls | 16 |
| session spend | $1.369310 |
| ledger all-time before | $6.186752 (68 entries) |
| ledger all-time after | $7.556062 (84 entries) |

The gate held: test-1's re-transcription came in at $0.2090 against a $0.30
stop, and cumulative spend peaked at $1.3693 against a $1.40 stop.

Re-transcription is the expensive half — five reels at $0.1244 to $0.2090 came
to $0.8378 of the total, because a guide bump and a prompt bump both invalidate
the cache by design.
