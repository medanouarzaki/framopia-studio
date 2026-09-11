Status: OK

# Block 12, session 89 — one bad idea must not kill the run

## 1. What `sora-2`'s analysis really returned

**Twelve ideas. Eleven were fine. One was refused, and the run died.**

The response is cached at `imageslots-72cb1d150904b245`, and running the mode's
own checker over all twelve gives exactly one refusal:

```
REFUSED 7. "Assortment of vitamin pills" — marker: "assortment"

12 ideas, 1 refused, 11 good
```

Every idea it returned, in order:

| # | idea | on |
|---|---|---|
| 1 | Regenera device | تقدري أول حاجة ديري لو Regenera |
| 2 | Mesotherapy syringe | تقدري ديري la mésothérapie |
| 3 | Polynucleotides vial | تقدري ديري les polynucléotides |
| 4 | Hair filler syringe | وتقدري ديري le hair filler |
| 5 | Falling autumn leaves | فصل الخريف قرب |
| 6 | Hair falling out | الشعر ديالنا تيبدا يطيح فهاد الفترة |
| **7** | **Assortment of vitamin pills** | لي هي واحد الكوكتيل د الفيتامينات |
| 8 | Microscopic view of stem cells | تقنية الخلايا الجذعية |
| 9 | A hand showing four fingers | أربعة د الحصص |
| 10 | A calendar highlighting fifteen days | مابين حصة وحصة 15 يوم |
| 11 | A puzzled woman | شنو تقدري ديري لو |
| 12 | A calendar showing one month | مابين حصة وحصة شهر |

**What was lost.** Not the ideas — the response is cached and all twelve were on
disk the whole time. What was lost was the reel: `plan.images.slots` held **0
slots**, `images`, `zones` and `build` all stayed `pending`, and the $0.14786 of
transcription he had just paid for led nowhere. Worse than a one-off: because the
response is cached and the refusal is deterministic, **every re-run would have
failed identically and for free** — the reel was permanently stuck, and no amount
of pressing Run would have moved it.

**What `sora-2` is:** 23.32 s, 2160×3840, Dr Loubna Kfafi, **74 words, 74
cards**, 12 ideas, 0 pictures.

## 2. The transcript was still free

`transcription-b9430534fe93814c` is on disk and the plan records
`cacheProvenance: "exact"`. The run below re-used it and **added no
transcription line to the ledger** — 0 of the 13 lines added this session are a
`transcribe-*` stage. Nothing he had paid for was bought again.

## 3. The retry

**`planSlots` no longer throws.** A refused idea is dropped and named as a
refusal like every other — `more-than-one-subject` — so a caller that cannot ask
the model again still gets a reel with one picture fewer. The rule itself is
unchanged: that idea does not become a picture.

**A caller that can, asks again.** `reaskSlotIdea` sends one focused prompt for
one moment: what she says there, the idea that was refused, and the word that
broke it. It is not the slot prompt with a smaller count — that would re-choose
the moment, and the moment was not what was wrong. **The idea is never rewritten
in code.** Session 84 refused to do that and was right.

**Two attempts in total — the first and one retry.** The bound is about money,
not about how well a second nudge works, which is unmeasured: a run's price is
quoted before it starts from `imageSlotCountFor`, every retry is a call that was
not in that quote, and one retry per refused idea is a worst case that can be
stated in advance. It holds for a video the tool has never seen because it is a
statement about the quote, not about the content.

**When the retries run out, that slot gets no picture and the run continues.**
That, not the retry, is what makes a run safe; the retry is a best effort on top.

**What it cost, measured on the real reel: $0.012768** — one line, about 7% of
what the original analysis cost. The price quoted before the run was **$2.1708**
and the run came in at **$1.859008**, so the quote still held.

Answers are written to `reasked-ideas.json` **beside** the cached response, never
into it: the paid-for original stays exactly as the model gave it, and a re-run
is free.

**Reported where he can see it.** The run prints:

```
slots: "Assortment of vitamin pills" names more than one thing ("assortment") — asking again for this moment
slots: it came back as "A multivitamin capsule"
```

and, if the retry fails, `slots: "…" still names more than one thing, so that
moment gets no picture`.

## 4. Every other place one bad answer stops the run

| where | what it refuses | verdict |
|---|---|---|
| `slot-select.ts` `MultiSubjectIdeaError` | one idea names a group | **fixed** — the same defect |
| `images/generate.ts` + `gemini-client.ts` | one candidate the image model fails to return | **the same defect, left** — see below |
| `slots.ts:168,177` / `keywords.ts:215,224` | the whole response is unparseable or has no array | **left, correctly** — there is nothing to continue with |
| `slots.ts:252,257` / `keywords.ts:312,321` | the call itself failed | **left, correctly** — already retried once for a transient failure |
| `sfx.ts` `SilentImageSlotError` | a slot with a template and no sound | **left** — a template-binding defect, not a model answer |
| `assign.ts` `NoTemplateVariantError` | no template of a kind for this mode | **left** — a mode or library defect, not a model answer |
| `regroup.ts` ×3 | oversized, mixed-script or lossy subtitle groups | **left, correctly** — documented as unreachable by construction, guarding this tool's own code |
| `images/estimate.ts` | the run would cost more than the ceiling | **left, correctly** — refusing to spend is the point |

**The image one is the same defect and I left it deliberately.** There is no
`catch` around the per-candidate loop in `generate.ts`, so an `ImageGenerationError`
on one picture aborts the whole stage even though the other pictures are fine and
the reel could build with one slot unfilled. I left it for two reasons: proving it
needs a paid run, and session 87 showed what two behavioural changes in one paid
run cost — the second change made the first uninterpretable and lost money. It is
listed as open.

## 5. The run of `sora-2`

Quoted at **$2.1708** against a $3.00 ceiling; actual **$1.859008**.

| stage | outcome | cost |
|---|---|---|
| transcription | **skipped, cached** | **$0** |
| analysis | done from cache, **plus one re-ask** | $0.012768 |
| images | 12 candidates for 6 slots | $1.846240 |
| zones | done | $0 |
| build | done | $0 |

**Seven pictures**, one from her own store:

| slot | starts | lives | source | idea |
|---|---|---|---|---|
| img001 | 0.06 | 1.00 s | generated | Falling autumn leaves |
| img002 | 1.06 | 1.62 s | generated | Hair falling out |
| img003 | 2.68 | 1.00 s | generated | A puzzled woman |
| img004 | 3.68 | 2.02 s | **her pic012** | Regenera device |
| img005 | 5.70 | 2.76 s | generated | Microscopic view of stem cells |
| img006 | 8.46 | 1.56 s | generated | Mesotherapy syringe |
| **img007** | **10.02** | **13.30 s** | generated | **A multivitamin capsule** — the re-asked one |

**74 cards, 32 carrying a picture.** Seven sound events, one per picture.

**Five ideas were dropped, all for the budget**, which is 6 paid pictures for
23.3 s: *A hand showing four fingers*, *A calendar highlighting fifteen days*,
*Polynucleotides vial*, *A calendar showing one month*, *Hair filler syringe*.

## 6. What I think of it, before he opens it

**It builds, and the thing this session fixed works — but I would not call this
reel finished, and the reason is not the retry.**

The re-ask did exactly what it should: *"Assortment of vitamin pills"* came back
as *"A multivitamin capsule"*, one thing, written by the model, for one and a
quarter cents. That slot is now the seventh picture rather than the end of the
run.

**What I would question is the second half of the reel.** Measured:

- all **seven** pictures fall in the first half (0–11.7 s);
- the second half (11.7–23.3 s) has **none**;
- the last picture starts at 10.02 s and holds for **13.30 s — 57% of the reel on
  one motionless capsule.**

The cause is not the retry and not the pacing floor. The budget is six paid
pictures, and selection spends it **front to back in time order**, so the first
six candidates in the reel take everything and the five good ideas for the second
half — two calendars, a hand, a vial, a syringe — are all refused as
`budget-spent`. A reel longer than its budget does not thin out evenly; it goes
dark in its second half.

That is worth his ruling and I have not touched it: the density is his, and
changing how the budget is spread is a bigger decision than one session should
take on the back of a paid run. **He should watch the last thirteen seconds
first.**

## 7. The `.aep`

```
open "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/build/sora-2-f6c580b5-full.aep"
```

9,559,755 bytes, written 2026-09-11 02:22:05.

## 8. The stranger test catching it

Added to session 88's stranger: **a model answer containing one unusable idea
must not stop the run.** The answer there is a recording, so the bad idea is put
in deliberately — the only way a gate can rehearse a model having a bad day.

Red with today's behaviour restored:

```
 × what the stranger’s ideas become > is not stopped by one idea that names more than one thing
   → 1 slot idea(s) depict more than one subject: slot 1 ("Assortment of vitamin pills") — assortment. The mode asks for one subject, centred and unobstructed.
 × an idea that names more than one thing > does not stop the other ideas becoming pictures
   → 1 slot idea(s) depict more than one subject: slot 2 ("Assortment of vitamin pills") — assortment. The mode asks for one subject, centred and unobstructed.
 × an idea that names more than one thing > names the idea and the word that broke it
   → 1 slot idea(s) depict more than one subject: slot 1 ("Assortment of vitamin pills") — assortment. The mode asks for one subject, centred and unobstructed.
 × an idea that names more than one thing > reports it as a refusal like every other, not as a silence
   → 1 slot idea(s) depict more than one subject: slot 1 ("Assortment of vitamin pills") — assortment. The mode asks for one subject, centred and unobstructed.
 × an idea that names more than one thing > returns a usable result even when every idea is refused
   → 2 slot idea(s) depict more than one subject: slot 1 ("Assortment of pills") — assortment; slot 2 ("A selection of things") — selection of. The mode asks for one subject, centred and unobstructed.
```

Restored from a saved byte copy: `Tests 50 passed (50)`.

**Two things the test found about itself**, both of which would have made it a
false green:

- Its first version **stayed green with the defect restored**, because the slot
  cache keys on the reel and the mode but not on the answer — so the spoiled case
  was served the earlier good case's ideas and asserted nothing. It bypasses the
  cache now.
- Once it did reach the refusal, the retry **called Gemini for real** and hung for
  five seconds against a live endpoint. The re-ask is injectable now, the same way
  the analysis already was. **The ledger did not move**: the call never completed,
  and `appendCost` fires only on a returned response.

## 9. Gates, and part 0 at both ends

| gate | result |
|---|---|
| `npm run golden` | **PASS** — 4 of 4, **17,174 fields**, unmoved |
| `npm run check` | **exit 0**, run alone, after committing |
| panel suite ×5 | exit **0, 0, 0, 0, 0** — 285 passed + 2 skipped |

| package | session 88 | now | difference |
|---|---|---|---|
| core | 847 / 0 / 847 | 847 / 0 / 847 | — |
| service | 1503 / 0 / 1503 | **1509** / 0 / 1509 | **+6** |
| benchmarks | 173 / 0 / 173 | 173 / 0 / 173 | — |
| panel | 285 / 2 / 287 | 285 / 2 / 287 | — |
| tools/cv (pytest) | 149 | 149 | — |

The six: five in `slot-select.test.ts` — `does not stop the other ideas becoming
pictures`; `names the idea and the word that broke it`; `reports it as a refusal
like every other, not as a silence`; `returns a usable result even when every
idea is refused`; `says nothing was rejected when every idea is one thing` — and
one in `a-stranger.test.ts`, `is not stopped by one idea that names more than one
thing`.

**The first gate run failed on `the image job against the real sidecar`, timing
out at 240,000 ms.** Alone it passes in **76 s**. That is the third session
running — 84, 86 and now 89 — that this one test has timed out under the parallel
load and passed alone; it is contention, it is not counted as a failure, and it is
now frequent enough to be worth a session of its own.

### Part 0, at both ends

| measurement | start | end |
|---|---|---|
| ledger | 201 records, `2393299aaa8231ab`, $23.227831 | **214 records, `3f0b39b80a08c001`, $25.086839** |
| `templates/library.aep` | `4b0cf05a8f5d4775c03e…` | `4b0cf05a8f5d4775c03e…` |
| `modes/dr-loubna-kfafi.json` | `97ece86d34ae284c`, Sep 11 01:19:45 | unchanged |
| `modes/k2-syndicalia.json` | `572e99bf890ceefb`, Sep 9 21:58:19 | unchanged |
| `assets/client-pictures/` | 15 files, 27,390,712 bytes | unchanged |
| services | pid 21020, is the handshake pid | identical, untouched |
| After Effects | 1 instance, 0 `aerender` | 1 instance, 0 `aerender` |
| extensions folder | one symlink, Aug 27 19:06:47 | unchanged |
| working tree | clean | clean |

`.local/` grew where the work landed: build 77→79, cache 216→241, cv 2348→2592,
plans 85→98. Everything else unchanged. Neither client file was written to;
`templates/library.aep` did not move; no service Mohamed started was stopped;
After Effects was neither launched nor quit.

## 10. Every ledger line added

**13 lines, $1.859008**, against an expected $2.00 and a ceiling of $3.00. Ledger
201 → 214 records, `2393299aaa8231ab` → `3f0b39b80a08c001`; total $23.227831 →
$25.086839, and the difference is $1.859008 exactly.

```
{"stage":"analysis-slots","model":"gemini-3.1-pro-preview","unit":"run","usd":0.012767999999999998,"client":"dr-loubna-kfafi","video":"32fce06379eded84aa8583758cc37075ff8469a95e8950e250c805f0650d6ead","purpose":"client-work","timestamp":"2026-09-11T01:10:05.859Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.155356,...,"timestamp":"2026-09-11T01:10:27.438Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.154876,...,"timestamp":"2026-09-11T01:10:51.515Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.149232,...,"timestamp":"2026-09-11T01:11:11.874Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.153072,...,"timestamp":"2026-09-11T01:11:32.299Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.15415,...,"timestamp":"2026-09-11T01:11:53.775Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.15367,...,"timestamp":"2026-09-11T01:12:14.937Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.150318,...,"timestamp":"2026-09-11T01:12:35.889Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.15271800000000002,...,"timestamp":"2026-09-11T01:12:54.923Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.15331000000000003,...,"timestamp":"2026-09-11T01:13:14.365Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.15631,...,"timestamp":"2026-09-11T01:13:36.411Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.159314,...,"timestamp":"2026-09-11T01:13:56.648Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.15391400000000002,...,"timestamp":"2026-09-11T01:14:18.366Z"}
```

Every line's `client`, `video` and `purpose` are identical and elided for width;
the full lines are in `.local/costs.jsonl`.

**Proof the transcript was not re-bought: 0 of the 13 lines is a `transcribe-*`
stage.** The run reports `transcription: skipped $0.000000` and the plan still
carries the same `cacheEntryId`, `transcription-b9430534fe93814c`. The slot
analysis was also a cache hit at $0; the only analysis charge is the one re-ask.

## What is open

- **`sora-2`'s second half has no pictures**, because the budget is spent front to
  back. 57% of the reel is one motionless picture. His ruling; §6 has the
  measurements.
- **One failed image generation still aborts the whole image stage** — the same
  defect as this session's, left deliberately and named in §4.
- **`job.integration.test.ts` has now timed out under gate load in three
  sessions** and passes alone every time. Worth fixing rather than re-running.
- A stage that threw is still marked `done` (session 84); the too-deep folder
  warning knows only footage already made into a reel (80); a machine that cannot
  bind loopback starts unguarded (79); the sidecar's abort is unproven-fixed (78).
