Status: PROBLEM — spent $2.558004 against a $2.50 ceiling, because a change I made re-bought four pictures that already existed

# Block 12, session 87 — both halves of the pair get a picture

The pacing is solved and the reel now carries nine pictures instead of six. **I
went $0.058004 over the ceiling doing it**, and the overspend was not the pacing
work: it was a second change I made in the same run that made the model re-write
its spans, which broke the protection session 86 built for pictures already paid
for. Four were bought twice. That change is reverted and the defect it exposed is
fixed, but the money is gone and that is this session's headline.

## 1. The eleven cards and what each picture's life would be

| what she names | word occupies | if a picture started there it would live |
|---|---|---|
| شد | 0.52–0.74 | 0.84 s |
| Sculptra | 1.36–1.84 | 0.82 s |
| Planiti | 2.18–2.58 | 0.94 s |
| إشراقة | 3.12–3.56 | 0.94 s |
| Pluryal | 4.06–4.44 | 0.86 s |
| ترطيب | 4.92–5.40 | 0.90 s |
| Profhilo | 5.82–6.30 | 0.96 s |
| تحديد | 6.78–7.26 | 1.06 s |
| Radiesse | 7.84–8.40 | 1.06 s |
| volume | 8.90–9.30 | 0.82 s |
| filler | 9.72–10.06 | 0.52 s |

**Shortest 0.52 s, longest 1.06 s, mean 0.88 s.** The shortest is 16 frames at
30 fps, and it is the last picture running out the tail of the reel. **Eleven
pictures in 10.2 seconds is not a flicker** — it is a cut roughly once a second.

## 2. What the floor was measuring, and every rule that bound

`MIN_SLOT_GAP_S = 0.5` compared **`slot.start - previous.end`** — the end of one
*word span* to the start of the next. Its stated purpose was about what the eye
sees: *"two images butting up against each other read as one long dissolve."*

**Those are different quantities.** A picture starts on its word and holds until
the next arrives, so what a viewer experiences is the distance between two
*starts*. `img006` proved it from the other side: session 86 added it outside
selection, its span gap is **0.00 s**, and it was on screen for **1.56 s**.

The rules that actually bound, measured:

| rule | effect on `sora-1` |
|---|---|
| the word-span gap | refused every pair — spans 0.00–0.24 s apart |
| the window grid | `durationS / placeable` = 1.28 s cells, one slot each; put ترطيب and Profhilo in the same cell while others stood empty |
| no-overlap | never bound here; no two spans overlap |
| the budget | 3 paid pictures, unchanged |
| a minimum life | **did not exist** |

## 3. What I changed, and session 30's ruling

**A picture still starts on the word that names what it shows. Nothing drifts.**
Session 30's ruling is untouched — I did not move a single picture off its word,
and no start time is offset by any amount.

What changed is what the floor measures: **a picture may not leave before its own
entrance animation has finished playing**, measured between two starts. That is
what the old comment was reaching for, said precisely.

**The number is measured, not chosen.** Both image templates Mohamed authored
animate `IMG_MAIN`'s opacity over **0.400 s**, read from `templates/library.audit.json`.
It holds for any video on any machine and moves if he re-authors the templates.
Every picture in the rebuild lives 0.52 s or longer, comfortably clear of it.

**The window grid is gone**, replaced by that floor. A uniform grid over unevenly
spaced speech refuses legitimate placements; the floor refuses exactly what the
grid existed to refuse — a second picture crammed against the first — without
also refusing one a second later. `shortfall` and `uncoveredS` still report what
was not covered, and a candidate arriving after the reel is full is now **named**
rather than silently dropped, which it previously was.

**Golden did not move**: 17,174 fields, 4 of 4. The corpus reels are built from
existing plans and none was re-planned.

### The change I reverted, and what it cost

I also changed the model to be asked for twice what a reel *could place* rather
than twice its budget, so it would propose ideas for شد and volume. It returned
**22 ideas for a 27-word transcript**, began proposing pictures for *"إيلا
بغيتي"* — "if you want", pure sentence structure — and **re-spanned two products
it had previously described one way**, returning `["w0011"]` where it had
returned `["w0010","w0011"]`.

`alreadyBought` matched by an identical word-id list, so those no longer matched.
**Pluryal and filler were dropped from the reel and their four bought pictures
were bought again.** Pluryal — the picture Mohamed approved in session 84 — was
not in the reel at all.

Reverted. And the defect it exposed is fixed: **a bought span is matched by the
words it holds**, in selection and when candidates are carried across, so the same
moment described differently is still the same moment.

## 4. The rebuild

| | session 86 | now |
|---|---|---|
| pictures | 6 | **9** |
| from her store | 4 | 4 |
| generated | 2 | 5 |
| named things with a picture | 6 of 11 | **9 of 11** |

| card | picture | source | starts | lives |
|---|---|---|---|---|
| شد | **none** | — | — | — |
| Sculptra | pic014 | her store | 0.98 | 1.20 s |
| Planiti | pic008 | her store | 2.18 | 0.52 s |
| إشراقة | generated | bought this session | 2.70 | 1.04 s |
| Pluryal | generated | **re-bought this session** | 3.74 | 0.78 s |
| ترطيب | generated | bought this session | 4.52 | 0.96 s |
| Profhilo | pic010 | her store | 5.48 | 0.88 s |
| تحديد | generated | bought this session | 6.36 | 0.96 s |
| Radiesse | pic011 | her store | 7.32 | 2.02 s |
| volume | **none** | — | — | — |
| filler | generated | **re-bought this session** | 9.34 | 0.90 s |

**شد and volume have no picture**: with the candidate change reverted the model
is asked for 8 ideas and proposed the other nine things. They were never refused
by a rule — nobody had an idea for them. Getting them needs more ideas *without*
the collapse in quality that asking for 22 produced, and that is a session's work,
not a line.

## 5. The four products

| product | picture |
|---|---|
| **Sculptra** | her `pic014` |
| **Planiti** | her `pic008` |
| **Pluryal** | generated — present, but its pictures are new ones, not the ones he approved |
| **Profhilo** | her `pic010` |

No product lost its picture. **Pluryal's is not the picture he approved**, and
that is a real loss even though a picture is there.

## 6. What I think of it

**It reads as nine ideas, not a flicker** — with one reservation I would rather
state now than have him find.

The lives are 0.52 to 2.02 seconds, a mean of 1.04. A picture roughly every
second, each fully arrived before the next, is a normal rhythm for a listing reel
and it matches the speech: she names a thing, it appears, she names the next.
The two long holds — Radiesse at 2.02 s and Sculptra at 1.20 s — sit where she
pauses, so the rhythm follows her rather than a grid.

**The reservation is Planiti at 0.52 s.** It is the shortest by a margin, it is
0.13 s above the floor, and it sits immediately after Sculptra in the same breath
— *"khaskek Sculptra wela Planiti"*. Two product boxes in just over half a second
may read as one flick rather than two products. It is the one cut I would expect
him to question, and if he does, the honest fix is to let Sculptra hold and drop
Planiti rather than to shorten the floor further.

I have looked at the numbers and not at the video. He should judge the Planiti
cut.

## 7. The `.aep`

```
open "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/build/sora-1-8bcbfc38-full.aep"
```

4,637,555 bytes, written 2026-09-11 00:39:52.

## 8. Every new assertion, red then green

**Six added or rewritten in `service/src/analysis/slot-select.test.ts`.**

Rewritten, because they asserted the rule this session replaced: `spreads slots
across the reel, one per window` → `keeps every picture that lives long enough,
wherever it falls`; `rejects a slot closer than the minimum gap` → `refuses a
picture that would replace one before its entrance has played`; `reports a
shortfall rather than padding a window twice` → `reports a shortfall when fewer
candidates arrive than were asked for`.

Added: `keeps a picture that lives exactly as long as its entrance`; `takes the
minimum life from the caller`; and three for the bought-span match — `is still
free when the new span is shorter than the bought one`, `is still free when the
new span is longer than the bought one`, `does not make an unrelated span free`.

Red with the floor put back to the word-span gap:

```
 × keeps a picture that lives exactly as long as its entrance
   → expected [ { wordIds: [ 'a' ], …(7) } ] to have a length of 2 but got 1
 × takes the minimum life from the caller
   → expected [ { wordIds: [ 'a' ], …(7) } ] to have a length of 2 but got 1
   Tests  2 failed | 32 passed (34)
```

Red with a bought span matched exactly again — the defect that cost the money:

```
 × is still free when the new span is shorter than the bought one
   → expected [ { wordIds: [ 'w1' ], …(7) } ] to have a length of 2 but got 1
 × is still free when the new span is longer than the bought one
   → expected [ { wordIds: [ 'w0', 'w1' ], …(7) } ] to have a length of 2 but got 1
   Tests  2 failed | 32 passed (34)
```

Both restored from a saved byte copy: `Tests  34 passed (34)`.

**Two fixtures of my own were wrong and I fixed the fixtures, not the rule.** One
had spans that overlapped, so it failed with `overlaps-a-selected-slot` rather
than the floor; two from session 86 placed words exactly 0.4 s apart, which the
new floor allows, so they no longer tested a competition at all and were moved
to 0.2 s.

## 9. Gates, and part 0 at both ends

| gate | result |
|---|---|
| `npm run golden` | **PASS** — 4 of 4, **17,174 fields**, unmoved |
| `npm run check` | **exit 0**, run alone, after committing |
| panel suite ×5 | exit **0, 0, 0, 0, 0** — 285 passed + 2 skipped |

| package | session 86 | now | difference |
|---|---|---|---|
| core | 847 / 0 / 847 | 847 / 0 / 847 | — |
| service | 1488 / 0 / 1488 | **1493** / 0 / 1493 | **+5** (3 added for the bought-span match, 2 for the life floor; 3 rewritten in place) |
| benchmarks | 173 / 0 / 173 | 173 / 0 / 173 | — |
| panel | 285 / 2 / 287 | 285 / 2 / 287 | — |
| tools/cv (pytest) | 149 | 149 | — |

### Part 0, at both ends

| measurement | start | end |
|---|---|---|
| ledger | 180 records, `de5c21fa38d9d4e6` | **197 records, `772c955cab1a14b6`** |
| `templates/library.aep` | `4b0cf05a8f5d4775c03e…` | `4b0cf05a8f5d4775c03e…` |
| `modes/dr-loubna-kfafi.json` | `bbda3d30daa1ae3e`, Sep 9 23:22:51 | unchanged |
| `modes/k2-syndicalia.json` | `572e99bf890ceefb`, Sep 9 21:58:19 | unchanged |
| `assets/client-pictures/` | 14 files, 25,499,397 bytes | unchanged |
| services | pid 32736, is the handshake pid | identical, untouched |
| After Effects | 1 instance, 0 `aerender` | 1 instance, 0 `aerender` |
| extensions folder | one symlink, Aug 27 19:06:47 | unchanged |
| working tree | clean | clean |

`.local/cache` 180 → 212 and `.local/plans` 73 → 84, where the new pictures and
the plan backups landed. Neither client file was written to;
`templates/library.aep` did not move; no service Mohamed started was stopped;
After Effects was neither launched nor quit.

## 10. Every ledger line added, and the overspend

**17 lines, $2.558004, against a $2.50 ceiling — over by $0.058004.** Ledger
180 → 197 records, `de5c21fa38d9d4e6` → `772c955cab1a14b6`; total $20.251068 →
$22.809072, and the difference is $2.558004 exactly.

```
{"stage":"analysis-slots","model":"gemini-3.1-pro-preview","unit":"run","usd":0.10370800000000001,"client":"dr-loubna-kfafi","video":"725db503fc521e738889c57babf2befbc348cf956476a16dc57afbae479e3402","purpose":"client-work","timestamp":"2026-09-10T23:25:18.904Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.151518,...,"timestamp":"2026-09-10T23:25:39.767Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.155718,...,"timestamp":"2026-09-10T23:26:01.737Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.151874,...,"timestamp":"2026-09-10T23:26:22.750Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.153194,...,"timestamp":"2026-09-10T23:26:43.778Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.15140199999999998,...,"timestamp":"2026-09-10T23:27:03.393Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.153082,...,"timestamp":"2026-09-10T23:27:25.059Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.15415600000000002,...,"timestamp":"2026-09-10T23:31:07.014Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.15583600000000003,...,"timestamp":"2026-09-10T23:31:26.518Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.158128,...,"timestamp":"2026-09-10T23:31:48.270Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.156328,...,"timestamp":"2026-09-10T23:32:08.498Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.154518,...,"timestamp":"2026-09-10T23:32:27.794Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.148518,...,"timestamp":"2026-09-10T23:32:48.224Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.15355999999999997,...,"timestamp":"2026-09-10T23:33:11.170Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.14863999999999997,...,"timestamp":"2026-09-10T23:33:30.321Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.154752,...,"timestamp":"2026-09-10T23:33:51.480Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.153072,...,"timestamp":"2026-09-10T23:34:12.518Z"}
```

Every line's `client`, `video` and `purpose` fields are identical and elided above
for width; the full lines are in `.local/costs.jsonl`.

**Nothing already bought was preserved, which is the failure.** The brief required
Pluryal's and filler's candidates to be byte-identical afterwards. They are not:
**0 of the 4 previously bought candidate images are reused**, and all four were
generated again. The four re-buys account for about $0.61 of the $2.56.

**The ceiling was breached and I stopped.** After measuring $2.558004 I ran no
further paid work: the build, the gates, the five panel runs and every
verification since are free. I did not attempt a third re-plan to recover
Pluryal's original picture, because that would have cost more money to undo a
mistake that had already cost money.

## What is open

- **Pluryal's approved picture is gone** and a different generated one is in its
  place. Recovering it means re-planning with the fixed word-level match; the two
  original images are still in the cache and would be re-used at no cost, but
  that is a decision to take deliberately rather than at the end of an overspent
  session.
- **شد and volume still have no picture.** Asking for more ideas is how, and
  asking for 22 made the model propose pictures for "if you want". The number
  needs to grow with something better than the reel's capacity.
- **Planiti holds for 0.52 s** immediately after Sculptra, and may read as one
  flick rather than two products. §6 says what I would do about it.
- A stage that threw is still marked `done` (session 84); the too-deep folder
  warning knows only footage already made into a reel (80); a machine that cannot
  bind loopback starts unguarded (79); the sidecar's abort is unproven-fixed (78).
