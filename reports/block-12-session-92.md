Status: PROBLEM — the store is built and proved, but I spent $0.091194 re-planning a reel whose analysis predates slot prompt v4, which CLAUDE.md warns about and I did not read first.

# Block 12, session 92 — a picture bought once is a picture that client owns

## 1. Every generated picture on disk, and how much of her four reels overlaps

**112 generated pictures, $17.076365.** Read from the manifest beside each one,
which records the client but not the video — the video is the cache directory it
sits in.

| video | reel | pictures | billed | client |
|---|---|---|---|---|
| `725db503…` | `sora-1` | 22 | $3.3903 | dr-loubna-kfafi |
| `32fce063…` | `sora-2` | 20 | $3.0587 | dr-loubna-kfafi |
| `7a2abf01…` | `sora-3` | 14 | $2.1268 | dr-loubna-kfafi |
| `619b8eae…` | `sora-6a` | 12 | $1.8469 | dr-loubna-kfafi |
| `344265a0…` | `sora` | 22 | $3.3690 | k2-syndicalia |
| `99dfe0e5…` | `vitasilk` | 14 | $2.0641 | k2-syndicalia |
| `365967c9…` | `test 1` | 8 | $1.2207 | k2-syndicalia |

**Her four reels hold 68 pictures and $10.4227 of the total.**

### How many of her ideas name the same thing: none

I went through all 27 of her slots. **No two of her four reels name the same
thing exactly, and the saving had this existed is $0.00.** Three product words
appear in more than one reel and not one of them is a duplicate purchase:

| word | the two ideas | are they the same thing? |
|---|---|---|
| filler | `A syringe of dermal filler` (`sora-1`) · `Hair filler syringe` (`sora-2`) | **No.** Different products for different treatments. |
| mesotherapy | `Mesotherapy syringe` (`sora-2`) · `A close-up of a mesotherapy micro-needle device touching skin.` (`sora-3`) | **No.** A syringe and a micro-needle device. |
| regenera | `Regenera device` (`sora-2`) · `The Regenera Activa clinical device used for hair restoration` (`sora-6a`) | **Yes** — and `sora-2` answered it from **her own photograph** `pic012`, free. |

The one real repeat is a machine she owns a photograph of. `sora-6a` bought a
picture of it anyway, and `sora-1` bought Pluryal although she owns `pic015` —
**both are explained and neither is a defect**: `sora-6a` was planned
2026-09-03, before her client record existed (09-04) and before her photographs
(09-09); `sora-1` was planned 2026-09-10, a day before the Pluryal picture was
added. The tool was right each time; the photographs arrived afterwards.

**So Mohamed's premise is not yet true of his own work, and I am saying so
rather than reporting a saving that is not there.** His ruling still holds and
the mechanism is worth having — see section 7 for why the next reel is a
different matter from the last four.

### Where a picture lives, and whether two videos could ever share one

`.local/cache/<video sha256>/images-<fingerprint>/`, with `image.jpg` and a
manifest. The fingerprint is the **prompt**, negative prompt, model, resolution,
aspect ratio, candidate index and client id.

**No. Two videos naming the same thing can never produce the same key today.**
The prompt ends with a variation — camera angle, framing, lighting — drawn by
`drawVariation(mode, planId, slotIndex)`, and `planId` is a fresh UUID per plan.
Identical idea, identical client, identical everything else: different plan,
different draw, different prompt, different key, guaranteed miss. **That is the
mechanism by which every repeat is bought again**, and it is why the store had
to be keyed on something else rather than left to the content cache.

A picture carries, in its manifest: the composed prompt (the idea is its first
sentence), the negative prompt, model, resolution, candidate index, **client
id**, mode version, cost, timestamp and pixel size. It does **not** carry the
idea as a field, the word it names, or the video — the video is the directory.

## 2. What "the same thing" means

**The idea text is identical once case, surrounding whitespace and a trailing
full stop are set aside. Nothing looser.**

**Why this holds for a client the tool has never seen.** The idea is the model's
own sentence describing what the picture shows, and it is the exact string the
prompt is composed from — everything after it is the client's style and the
drawn variation. Two identical ideas therefore produce two prompts differing only
in how the same subject is photographed. They depict the same thing **by
construction of the pipeline**, in any language, for any client. That is a
property of how a prompt is built, not an observation about anyone's products.

**Why nothing looser, with his own reels as the evidence.** `A syringe of dermal
filler` and `Hair filler syringe` share *filler* and are different products. A
rule matching on shared words puts a hair-filler syringe where a dermal-filler
syringe belongs. **Paying twice is a worse deal; showing the wrong product is a
worse reel**, and only one of the two is recoverable.

**What it misses, and I am not hiding it:** `Regenera device` and `The Regenera
Activa clinical device used for hair restoration` are the same machine and this
will not join them. It is narrow on purpose and I could not justify anything
wider.

## 3. The client store, and the proof it cannot cross clients

`readClientLibrary({ clientId, planPaths })` reads every Edit Plan on the
machine, keeps only those whose **own record** says they belong to that client —
`clientSnapshot.id`, the pinned copy the reel was actually built against, else
`clientMode.id` — and indexes their bought slots by normalised idea.

**The guarantee is structural, not a filter applied late.** The store is *read
for one client*. A caller asking as K2 is never handed her entries at all, so
there is no row to read the wrong one out of, and `planSlots` receives a set
already narrowed to one client.

A plan belonging to nobody is nobody's store. A reel never reuses from itself. A
slot answered from her own photographs is not in the store — it carries no
candidates and was already free.

**Proved separately, as asked.** Mutation: the client filter removed.

```
   × a client’s store of what has been bought for them > never hands one client a picture bought for another
     → expected 1 to be +0 // Object.is equality
   × a client’s store of what has been bought for them > a plan belonging to nobody is nobody’s store
     → expected 1 to be +0 // Object.is equality
```

Mutation: matching loosened to the longest word, which is what joins the two
fillers.

```
   × what counts as the same thing > does not join two ideas that merely share a word
     → expected 'syringe' not to be 'syringe' // Object.is equality
```

Mutation: a reused picture made to spend the budget.

```
   × an idea this client has already paid for > does not spend the budget, so the reel buys its full count as well
     → expected 2 to be greater than 2
   × an idea this client has already paid for > is placed as well as the pictures the budget buys, not instead of one
     → expected [ { wordIds: [ 'w0' ], …(1) } ] to have a length of 3 but got 2
```

Mutation: a candidate he passed over reused.

```
   × putting a client’s earlier picture into a new reel > brings across the candidate he chose, when he chose one
     → expected [ { id: 'img001-c1', …(4) }, …(1) ] to have a length of 1 but got 2
```

All restored; 63 green.

**What it does to the count.** A reused picture is counted with her own
photographs, not against the budget — the brief's instruction and session 86's
reasoning, that the budget limits what is *bought*. So a reel reusing two
pictures still buys its full allowance and ends with **two more pictures than the
cap**. That is the same tension I raised at the end of session 90 over
already-bought spans, where I ruled the other way and put the question to him. It
is still open and I have not resolved it a second time by myself.

## 4. What stops a picture being reused where it does not fit

Three things do, and one thing does not.

- **The subject cannot be wrong**, because the ideas are character-identical.
- **A candidate he passed over never travels.** When he chose one of two, only
  that one comes across; reusing the one he rejected would be worse than buying.
- **Placement is re-solved from this reel's own masks**, so size and corner adapt
  to where she stands in the new video, and the cutout, gate and text reading are
  dropped and re-measured here rather than carried.

**What nothing stops: the variation.** The picture was drawn with a camera angle,
framing and lighting chosen for another reel, and it arrives with those. If a
reel wants the same subject shot differently, nothing notices — it gets the
earlier photograph of it. **That is the risk the ruling accepts**, and it is the
price of not paying twice. It is visible rather than silent: section 5.

## 5. What the panel says, quoted

Per picture, above the gate's own words, because it changes how they should be
read:

> **Already made for sora-1-8bcbfc38, and used again here — this one costs nothing.**

> **One of your own pictures.**

A picture made for this video says **nothing at all** — there is no line, not an
empty one. His own store outranks a reused one when a slot somehow has both.

Proved on the screen, not only in the string: a browser test loads the picker
with both origins set and reads them off the rendered page, asserts no `p.origin`
exists when no picture has an origin, and asserts neither sentence matches
`/npm run|terminal|quit|restart|reopen/i`. Session 91 found eleven messages that
sent him out of the panel; this is not a twelfth.

Mutation — the line removed from `Images.tsx`:

```
   × where the panel says a picture came from > names the earlier reel a reused picture was bought for
     → expected 'img001on screen 0.1s to 1.6sA single …' to contain 'Already made for sora-1-8bcbfc38, and…'
   × where the panel says a picture came from > sends him nowhere and names no command
     → page.waitForSelector: Timeout 5000ms exceeded.
```

## 6. The re-plan

**The precondition in the brief is false: none of her four reels overlaps an
earlier one**, so there is no re-plan of his real work that shows a picture being
reused. Section 1 is the measurement.

I re-planned **a copy** of `sora-6a` — his only reel not in the approved three —
to see what a re-plan does now. **It cost $0.091194, which it should not have**,
and section 10 records the line. The cause is not the store: `sora-6a`'s stored
analysis is under slot prompt **v3** and the active version is **v4**, so the
fingerprint missed and the model was called. CLAUDE.md says this in as many
words — *"only `sora` has been through slot prompt v3 … moving them means one
billable call each"* — and I ran it without reading that first.

| | reused | bought | from |
|---|---|---|---|
| copy of `sora-6a`, re-planned | **0** | 7 slots, 4 carried | — |

**Nothing of his was damaged and nothing of his was written to.** `sora-1`,
`sora-2` and `sora-3` are the reels he has approved and I did not re-plan any of
them; `sora-6a` is already built, so I worked on a copy in scratch and left the
real plan untouched. All four plan files are byte-identical to how the session
found them.

The copy is still worth what it cost, because of what v4 returns:

| v3 — his built reel | v4 — the same words today |
|---|---|
| A medical vial labeled Botox next to a cosmetic syringe | **A vial of Botox** |
| A yearly planner with two appointment dates prominently circled | **A box of Sculptra** → her `pic014` |
| A close-up of a woman's face with intensely hydrated, glowing, flawless skin | **The number two** |
| The Regenera Activa clinical device used for hair restoration | **A syringe of Radiesse** → her `pic011` |
| | **A vial of Skinbooster** |
| | **A molecular model of polynucleotides** |
| | **A Regenera device** → her `pic012` |

Two things fall out of that. **Her own photographs now answer 3 of 7 slots where
they answered none** — the free mechanism that already existed works far better
under v4. And the ideas are **short and canonical**: `A vial of Botox`, `A box of
Sculptra`, `A Regenera device` are exactly the strings that recur verbatim
between reels, where v3's sentences never could. The store I built is worth
having because of v4, not because of the four reels behind us.

## 7. What his next video costs now, against before

Measured from the ledger, not from a plan: **56 images attributed to a video for
$8.5758 — $0.1531 each, $0.3063 a slot** at two candidates a slot.

| reel length | slots bought | all new | each exact repeat saves |
|---|---|---|---|
| 10.2 s | 3 | $0.92 | $0.3063 |
| 13.5 s | 4 | $1.23 | $0.3063 |
| 23.3 s | 6 | $1.84 | $0.3063 |
| 27.7 s | 7 | $2.14 | $0.3063 |
| 40.5 s | 11 | $3.37 | $0.3063 |

**Before, a repeat cost $0.3063 every time. Now it costs nothing, ever again.**
She already owns 22 ideas outright. What a given reel saves depends on how much
it repeats, and on his four existing reels the answer would have been nothing —
so the honest figure for the next video is *between $0 and its full price*, and
the first reel that says "Botox" twice will be the first to show it.

## 8. The stranger test

Two tests, on a client that has never existed, in a plans directory that holds
only what the test put there. Each starts from a reel that owns nothing —
without that the cross-client half passed for the wrong reason, the previous test
having left a reused picture that a re-plan carries across by word.

**Red, with no store at all (today's behaviour):**

```
   × what the stranger’s ideas become > a second reel for the stranger’s client > does not buy a second picture of the thing the client already owns
     → expected [] to deeply equal [ 'the result she wants' ]
```

**Red, with the store shared across clients:**

```
   × what the stranger’s ideas become > a second reel for the stranger’s client > does buy it for a different client, whose picture it is not
     → expected [ { id: 'img001', …(14) } ] to deeply equal []
```

Restored, 16 of 16 green.

## 9. Gates

`npm run check`, **run alone, after committing: exit 0.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | 1548 | 0 | 1548 |
| benchmarks | 173 | 0 | 173 |
| panel | 288 | 2 | 290 |
| pytest (CV sidecar) | 149 | 0 | 149 |

Measured, not carried. Session 91 measured service 1521 and panel 285 (+2).

**Arithmetic by name. 30 tests added, 0 removed** — service 1521 → 1548 is +27,
panel 285 → 288 is +3.

| file | added |
|---|---|
| `client-library.test.ts` | 16 — the whole file: what counts as the same thing (4), the store (5), putting a picture into a new reel (7) |
| `slot-select.test.ts` | 4 — an idea this client has already paid for |
| `image-view.test.ts` | 5 — where a picture came from |
| `a-stranger.test.ts` | 2 — a second reel for the stranger's client |
| `render.browser.test.ts` | 3 — where the panel says a picture came from |

`npm run golden`: **PASS, 4 of 4 reels matched, field for field.** 4415 + 4280 +
3709 + 4770 = **17,174**. **Reuse did not move it**, and it could not have: the
golden reels are built from stored plans without re-planning, and separately no
two corpus reels of one client name the same thing. The only idea shared inside a
client anywhere on this disk is `a calm open horizon`, between two `.local`
fixture plans, neither of which golden builds.

**Panel suite, five times: exit 0, 0, 0, 0, 0.**

### Part 0, at both ends

| measurement | at start | at end |
|---|---|---|
| ledger records | 241 | **242** |
| ledger sha256 | `a394ea27…96a4a1a6` | **`533ad6b2…33a00522`** |
| `templates/library.aep` | `4b0cf05a…eca6c22aba` | unchanged |
| `modes/dr-loubna-kfafi.json` | `97ece86d…`, 2026-09-11T01:19:45 | unchanged |
| `modes/k2-syndicalia.json` | `572e99bf…`, 2026-09-09T21:58:19 | unchanged |
| `.local/` directories | 16 | 16 |
| `assets/client-pictures/` | 15 files, 26M | 15 files, 26M |
| CEP extensions | `com.framopia.studio` | `com.framopia.studio` |
| listening services | 1 (pid 40282, two sockets) | same, **never stopped** |
| After Effects | 1 (pid 39825) | 1 (pid 39825), never launched or quit |
| `aerender` | 0 | 0 |
| `origin/main..main` | 0 | 0 after push |

His four plan files are byte-identical at both ends: `sora-1` `5adc55a3…`,
`sora-2` `9d220a58…`, `sora-3` `1d6142fc…`, `sora-6a` `0b9d4fd1…`.

**The ledger moved, and that is the session's `PROBLEM`.**

## 10. Every ledger line added

One, against an expected none:

```
{"stage":"analysis-slots","model":"gemini-3.1-pro-preview","unit":"run","usd":0.091194,"client":"dr-loubna-kfafi","video":"619b8eaecae46b0da6f3c8cc9f9b08636a348a1d2ecef40bcdaa7e8cac2c4b67","purpose":"client-work","timestamp":"2026-09-12T16:42:23.539Z"}
```

$0.091194, inside the $1.00 ceiling and outside the $0.00 expectation. It bought
the v4 slot analysis of `sora-6a`, which is now cached and free to ask for again.
The mistake was mine and avoidable: the prompt-version miss is written down in
`CLAUDE.md` and I ran the re-plan without checking.

## What is open

- **Whether a reused picture should be extra or count against the cap.** Built as
  extra, on the brief's instruction and session 86's reasoning. It is the same
  question I put to him in session 90 about already-bought spans, where I ruled
  the other way, and it is still his.
- **A reused picture keeps the variation drawn for the other reel** (section 4).
  Nothing detects a reel that wanted the same subject shot differently.
- **`Regenera device` and `The Regenera Activa clinical device…` will not join.**
  The rule is narrow on purpose; a wider one needs his ruling, not my invention.
- **Re-planning any reel older than slot prompt v4 costs a billable call**, and
  `sora-1`, `sora-3` and `sora-6a` would each pick up her photographs if
  re-planned. That is a real saving behind a real cost, and his to weigh.
- Everything carried from session 91 that this session did not touch.
