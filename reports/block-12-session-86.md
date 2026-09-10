Status: OK

# Block 12, session 86 — a thing without a label is still a thing

## 1. Every card that named something and got nothing

Eleven of `sora-1`'s 27 cards say something other than sentence structure
(إيلا، بغيتي، خاصك، ولا). After session 85, **six of the eleven carried no
picture**:

| card | says | why it got nothing |
|---|---|---|
| g003 | شد | **the model never proposed it.** It was asked for eight candidates and returned its eight strongest; this was the ninth thing named. |
| g010 | إشراقة | **proposed, dropped `too-close`.** |
| g015 | ترطيب | **proposed, dropped `too-close`.** |
| g020 | تحديد | **proposed, dropped `window-taken`.** |
| g025 | volume | **the model never proposed it.** |
| g027 | filler | **proposed, dropped** — the budget was already spent. |

The decisive measurement is the cached model response. **It proposed eight slots
and they cover almost everything she names** — five products *and* three of the
results:

```
['w0015','w0016'] name=w0016  خاصك Profhilo      A package of Profhilo skin booster
['w0020','w0021'] name=w0021  خاصك Radiesse      A package of Radiesse dermal filler
['w0003','w0004'] name=w0004  خاصك Sculptra      A vial of Sculptra aesthetic treatment
['w0025','w0026'] name=w0026  خاصك filler        A cosmetic syringe of dermal filler
['w0010','w0011'] name=w0011  خاصك Pluryal       A box of Pluryal facial filler
['w0017','w0018','w0019'] name=w0019  إيلا بغيتي تحديد   A profile of a woman showing a sharply contoured and defined jawline
['w0012','w0013','w0014'] name=w0014  إيلا بغيتي ترطيب   A close-up of a woman's face with highly moisturized and hydrated skin
['w0007','w0008','w0009'] name=w0009  إيلا بغيتي إشراقة  A woman smiling with a bright and radiant complexion
```

**Nothing needed to be asked differently.** Every idea is singular, every one has
a `nameWordId`, and the results are described as pictures a viewer would
recognise. Three of the eight survived selection.

## 2. What the cap was governing, and what it governs now

`IMAGE_SLOTS_PER_30S = 8` — Mohamed's ruling of 2026-08-29. For 10.2 s:
`(10.2 / 30) × 8 = 2.72` → **3**.

**Before this session it governed pictures.** Session 85 exempted a labelled
picture from it by adding slots *after* selection, but inside selection a
labelled match still consumed one of the three. In session 85's build, two of
the three went to Sculptra and Radiesse — both answered free from her own store —
so **the reel spent one of its three paid pictures and dropped five candidates.**
A picture that costs nothing was crowding out one that would have been bought,
which is the opposite of what the ruling is for.

**Now it governs money**, which is what it was made for: images cost about $0.17
each. A slot the client's own pictures answer does not spend from it — the same
principle session 85 established outside selection — and neither does a span this
reel has already paid for.

**`sora-1` may have 3 generated pictures**, unchanged. It has **2**: Pluryal and
filler. The third was refused for spacing, not for money.

**I did not change the number, and say plainly that I could not.** To fit the
five remaining cards the *spacing* floor would have to move, not the density —
see §6 — and both are pacing rulings that are Mohamed's.

## 3. Who decides what a picture is of, and what changed

**The model decides**, in the slot analysis, and it was already right. It reads
the transcript and returns spans with an idea and the word the picture is about;
`nameWordId` is session 30's ruling and is untouched, as is session 84's
one-subject rule.

**What changed is selection**, in `planSlots`, which is the only place the count,
the no-overlap rule and the spread rule are decided:

- A candidate the client's own store answers, or one this reel has already bought
  a picture for, **does not spend from the budget**.
- **What is already decided is placed first.** Selection walked the reel once in
  time order, so whichever candidate came first took the space and the next one
  within `MIN_SLOT_GAP_S` was dropped — a coin toss between two moments decided
  by which happens earlier. A label is the client saying what to show when this
  word is said, which outranks an idea a model proposed for the same seconds; and
  it costs nothing, so placing it first leaves the money for the moments they
  have not pre-decided. Neither clause mentions products or subject matter.
- **A bought picture is carried across a re-plan** by span. Keeping the span was
  only half of it: `planSlots` returns fresh slots with no candidates, so the
  span survived and the images paid for did not.

## 4. The rebuild

Priced against a $4.00 ceiling; **actual $0.304116**, and the analysis was free
on a cache hit.

| | session 85 | now |
|---|---|---|
| cards naming a thing | 11 | 11 |
| cards carrying a picture | 9 | **12** |
| pictures | 5 | **6** |
| from her own store | 4 | 4 |
| generated | 1 | **2** |

```
img001  0.98- 2.18  her pic014   خاصك Sculptra ولا Planiti
img006  2.18- 2.58  her pic008   Planiti
img002  3.74- 4.44  generated    خاصك Pluryal
img003  5.48- 6.30  her pic010   خاصك Profhilo
img004  7.32- 8.40  her pic011   خاصك Radiesse
img005  9.34-10.06  generated    خاصك filler
```

The two generated ones, in the words of the cards they sit on:

- **img002**, on *خاصك Pluryal* — *"A box of Pluryal injectable skin booster"*.
  **This is the picture Mohamed approved in session 84**, carried across
  untouched: the two candidate paths are byte-identical to before the re-plan.
  Not re-bought.
- **img005**, on *خاصك filler* — *"A syringe of dermal filler"*. New, and the
  reel's second paid picture.

## 5. The four products, each still present

| product | picture |
|---|---|
| **Sculptra** | her `pic014` |
| **Planiti** | her `pic008` |
| **Pluryal** | generated, the same one he approved |
| **Profhilo** | her `pic010` |

No regression.

## 6. What he will still find missing

**Five cards name a thing and still carry no picture.** Every one is refused for
the same reason, and it is arithmetic:

| card | says | nearest picture before | nearest picture after |
|---|---|---|---|
| g003 | شد | nothing before | **0.24 s** before img001 |
| g010 | إشراقة | 0.54 s after img006 | **0.18 s** before img002 |
| g015 | ترطيب | 0.48 s after img002 | **0.08 s** before img003 |
| g020 | تحديد | 0.48 s after img003 | **0.06 s** before img004 |
| g025 | volume | 0.50 s after img004 | **0.04 s** before img005 |

`MIN_SLOT_GAP_S = 0.5` is the floor between one picture ending and the next
beginning. Its own comment says it is *"chosen, not measured: two images butting
up against each other read as one long dissolve rather than two ideas."*

**Her sentences are pairs** — *if you want <this>, you need <this product>* — and
the two halves are **0.04 to 0.24 seconds apart**. So at any floor above about
0.04 s, only one half of a pair can carry a picture. To fit all five the floor
would have to fall to **0.04 s**, which is not a smaller gap but no gap at all:
one picture ending and the next starting inside a twenty-fifth of a second,
exactly what the constant exists to prevent.

**I have not changed it.** It is a pacing decision of the same family as the
density ruling, and it is Mohamed's. The build is not complete: six things she
names have a picture and five do not, and the five are the first half of each
pair plus `شد`, which the model did not propose at all.

## 7. The `.aep`

```
open "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/build/sora-1-8bcbfc38-full.aep"
```

4,344,111 bytes, written 2026-09-10 23:23:35.

## 8. Every new assertion, red then green

**Five added to `service/src/analysis/slot-select.test.ts`**: `spends the budget
only on the pictures it has to buy`; `never buys more pictures than the budget,
whatever arrives`; `places the client's own picture ahead of a paid idea
competing for the seconds`; `keeps a span this reel has already bought a picture
for`; `does not charge the budget for a span already bought`.

Red with free pictures spending the budget again:

```
 × spends the budget only on the pictures it has to buy
   → expected [] to have a length of 2 but got +0
 × does not charge the budget for a span already bought
   → expected 1 to be greater than 1
   Tests  2 failed | 27 passed (29)
```

Red with what is already decided no longer placed first:

```
 × places the client’s own picture ahead of a paid idea competing for the seconds
   → expected [ 'a' ] to deeply equal [ 'b' ]
 × keeps a span this reel has already bought a picture for
   → expected [ 'a' ] to deeply equal [ 'b' ]
   Tests  2 failed | 27 passed (29)
```

Both restored from a saved byte copy: `Tests  29 passed (29)`.

**One test I wrote and could not honestly keep.** I first asserted that a
candidate is refused with `budget-spent`, and it never fired: the windows are
sized over everything placeable, the free slots take their own windows, and a
paid candidate competing for one is refused as `window-taken` before the money is
consulted. Rather than contrive a shape to reach it, the assertion became the
property that branch exists for — *never buys more pictures than the budget,
whatever arrives* — and the code comment says the branch is belt to those braces.

## 9. Gates, and part 0 at both ends

| gate | result |
|---|---|
| `npm run golden` | **PASS** — 4 of 4, **17,174 fields**, unmoved |
| `npm run check` | **exit 0**, run alone, after committing |
| panel suite ×5 | exit **0, 0, 0, 0, 0** — 285 passed + 2 skipped |

| package | session 85 | now | difference |
|---|---|---|---|
| core | 847 / 0 / 847 | 847 / 0 / 847 | — |
| service | 1483 / 0 / 1483 | **1488** / 0 / 1488 | **+5**, the five named above |
| benchmarks | 173 / 0 / 173 | 173 / 0 / 173 | — |
| panel | 285 / 2 / 287 | 285 / 2 / 287 | — |
| tools/cv (pytest) | 149 | 149 | — |

Golden did not move: no corpus reel's client has a labelled picture, so no free
slot exists to change what their budgets buy.

**One gate run failed and it was not a defect.** `image-view.test.ts > clears the
choice and the override together` timed out at 5,000 ms in a suite that took
944 seconds. Alone it takes **461 ms** — a tenfold margin — and all 19 tests in
that file pass in 4.81 s. The same shape as session 84's sidecar timeout, and it
is not counted as a failure. A gate run before that was cut off mid-suite on a
passing test and was re-run rather than interpreted.

### Part 0, at both ends

| measurement | start | end |
|---|---|---|
| ledger | 178 lines, `72afc73f3506ca46` | **180 lines, `de5c21fa38d9d4e6`** |
| `templates/library.aep` | `4b0cf05a8f5d4775c03e…` | `4b0cf05a8f5d4775c03e…` |
| `modes/dr-loubna-kfafi.json` | `bbda3d30daa1ae3e`, Sep 9 23:22:51 | unchanged |
| `modes/k2-syndicalia.json` | `572e99bf890ceefb`, Sep 9 21:58:19 | unchanged |
| `assets/client-pictures/` | 14 files, 25,499,397 bytes | unchanged |
| services | pid 32736, is the handshake pid | identical, untouched |
| After Effects | 1 instance, 0 `aerender` | 1 instance, 0 `aerender` |
| extensions folder | one symlink, Aug 27 19:06:47 | unchanged |
| working tree | clean | clean |

`.local/cache` 176 → 180 and `.local/plans` 70 → 73, where the new pictures and
plan backups landed. Everything else unchanged. Neither client file was written
to; `templates/library.aep` did not move; no service Mohamed started was stopped;
After Effects was neither launched nor quit.

**The brief said the ledger stood at 179 lines.** It holds **178** records and
the file ends with a newline — but the total, $19.946952, matches the brief
exactly, so the content is precisely what session 85 left and only the count was
one high.

## 10. Every ledger line added, verbatim

```
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.152358,"client":"dr-loubna-kfafi","video":"725db503fc521e738889c57babf2befbc348cf956476a16dc57afbae479e3402","purpose":"client-work","timestamp":"2026-09-10T22:21:30.436Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.15175800000000003,"client":"dr-loubna-kfafi","video":"725db503fc521e738889c57babf2befbc348cf956476a16dc57afbae479e3402","purpose":"client-work","timestamp":"2026-09-10T22:21:49.387Z"}
```

**Two lines, $0.304116**, against an expected $3.00 and a ceiling of $4.00 — the
two candidates for the one new generated picture, `filler`. Ledger 178 → 180,
`72afc73f3506ca46` → `de5c21fa38d9d4e6`; total $19.946952 → $20.251068, and the
difference is $0.304116 exactly.

**Nothing was re-bought.** The transcript and the analysis were both cache hits
at $0, and Pluryal's two candidates were carried across rather than regenerated —
session 85's refusal to destroy them stands, and this session made it possible to
re-plan without needing to.

## What is open

- **Five cards still carry no picture**, listed in §6, and the reason is
  `MIN_SLOT_GAP_S = 0.5` against pair halves 0.04–0.24 s apart. Only Mohamed can
  rule on that floor.
- **`شد` and `volume` were never proposed by the model** — it returns its
  strongest `candidateCount` and these were beyond it. More candidates would cost
  nothing extra to plan, and that is worth a session.
- **`budget-spent` is nearly unreachable**, kept as belt to the window rule's
  braces, and stated as such rather than tested into existence.
- A stage that threw is still marked `done` (session 84); the too-deep folder
  warning knows only footage already made into a reel (80); a machine that cannot
  bind loopback starts unguarded (79); the sidecar's abort is unproven-fixed (78).
