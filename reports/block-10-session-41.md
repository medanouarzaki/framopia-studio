# Block 10 session 41 — the model was asked which word its picture is about

**Status: OK.**

## What it cost

**$0.086570.** One call, on `sora`, against a projection of $0.096 and a ceiling
of $0.35. The ledger went from 144 lines to 145 and the added line is:

```
{"stage":"analysis-slots","model":"gemini-3.1-pro-preview","unit":"run","usd":0.08657000000000001,"timestamp":"2026-09-01T15:49:51.767Z"}
```

Nothing else billed. Of about **$2.80** of credit, roughly **$2.71 remains**.
No picture was regenerated; `sora`'s eleven are the same eleven.

## Could the model name the word, and how often was it right?

**Yes, and it is good at it.** Asked for 22 candidates, it named a word on
**21** and returned null on exactly one — and that one is the right one to
decline: *"A balance scale holding a medical syringe on one side and an apple on
the other"*, over *"I combine aesthetic medicine and nutrition"*. That idea
depicts a balance of two things and no single word names it. Session 40 had
already flagged that slot by hand as the one with no naming word. The model
found the same thing on its own.

Judged one by one against the eight it gave `sora`:

| slot | the words | the word it picked | right? |
|---|---|---|---|
| img001 | السلام عليكم أنا **الدكتورة** لبنى كفافي | `الدكتورة` +0.860 s | **yes** — the doctor |
| img002 | ومؤسسة ديال مركز **cabinet** docteur… | `cabinet` +1.340 s | **late** — see below |
| img003 | بديت من **الصفر** | `الصفر` +0.500 s | yes — the zero it started from |
| img005 | ونخلق **فضاء** لي كيحمل الرؤية ديالي | `فضاء` +0.420 s | **yes** — the space |
| img006 | ماشي غير تغيير **الملامح** | `الملامح` +0.701 s | **yes** — the features |
| img007 | الحفاظ على صحة **البشرة** | `البشرة` +0.801 s | **yes** — the skin |
| img009 | كيبدا من **الداخل** ديالنا | `الداخل` +0.500 s | **yes** — from within |
| img010 | اليوما أنا **فخورة** | `فخورة` +0.721 s | **yes** — proud |
| img008 | كنجمع بين الطب التجميلي والتغذية | *null* | **yes** — correctly declined |

**Where it got it wrong: `img002`.** The idea is a clinic reception, the span is
*"and an establishment, a centre, cabinet docteur Lobna Kfafi"*, and it pointed
at `cabinet` — 1.34 s into a 2.82 s span. Two earlier words already name the
thing: `مؤسسة` (establishment) at 4.34 s and `مركز` (centre) at 5.34 s. It is
not a wrong word, it is the **latest** of three right ones, and it costs the
picture 1.34 s of its sentence. This is the one to watch on the next reel.

Seven of the eight agree with the table session 40 read by hand. The eighth,
`img003`, session 40 called a metaphor with no naming word; the model pointed at
`الصفر`, the zero, which is defensible and does no harm.

## What `sora`'s first picture now lands on

**`الدكتورة` — "the doctor" — at 0.959 s**, read back out of the built comp. It
used to appear at 0.099 s, on `السلام` — "hello". **It moved 0.86 s, and it now
arrives on the word he asked for.**

There is more to it than the field. Asked which word its picture is about, the
model also **stopped putting the greeting in the span at all**: where v2 returned
`السلام عليكم أنا الدكتورة لبنى كفافي`, v3 returned `أنا الدكتورة لبنى كفافي` —
*"I am Dr Lobna Kfafi"*, naming `الدكتورة`. The question changed the answer
either side of it.

## Done

### A — the schema and the prompt

**Slot prompt v3**, one question added in the prompt's own idiom:

> Also give the one word_id in that span that the picture is about — the word
> naming the thing the image shows, so the picture can appear as it is said
> rather than at the start of the sentence. It must be one of the word_ids you
> gave for that slot. When the idea carries the mood or the outcome of the whole
> sentence and no single word names it, give null.

and one key in the response shape. **`null` is the answer for a metaphor**, and
the planner keeps such a slot exactly as it was — the picture arrives with its
sentence, which is what every plan did before v3.

**`nameWordId` is optional with a default**, per the standing schema rule. Absent
means the span's start. The six existing plans stayed valid with no migration and
**`npm run golden` did not move on their account** — see the gates.

**A word that is not in the slot is refused three times**: dropped at the
parser, dropped again in `planSlots`, and failed by the plan validator. A picture
may start later inside its own span and nowhere else.

### The cache, and who re-bills — the sentence that mattered most

`promptVersion` **is** part of the slot cache fingerprint, so v3 invalidates
every reel's slot entry. That is correct — a v2 answer has no `nameWordId` and
must not be served for a v3 prompt — and it was measured before anything was
spent:

| reel | slot cache today | re-bills on v3? |
|---|---|---|
| sora | 1 entry, v2 | **no** — 11 generated candidates, the re-plan is refused before any call |
| test-1 | 2 entries, **v1** | **no** — 4 candidates, refused |
| vitasilk | 2 entries, **v1** | **no** — 5 candidates, refused |
| ground-truth | 1 entry, v2 | **yes, ~$0.065** — 6 slots, no candidates, nothing refuses it |
| test-2 | **none** | already bills on any run; the bump takes nothing |
| test-3 | **none** | already bills on any run; the bump takes nothing |

**One reel of six**, at about $0.065, and it is the one that already cannot
build. `slotsReplacementFlags` is what protects the other three: it throws before
`loadMode` and before the call. `test-1` and `vitasilk` were already missing
their cache at v2 — their entries are v1 — so the bump costs them nothing they
had not already lost.

### B — the one authorised call, and why `sora` was safe

**Re-planning `sora` would have stranded its eleven pictures.**
`planImageSlotsForPlan --force` replaces `plan.images.slots` wholesale, and the
call is not reproducible: this run's 22 candidates include spans and ideas that
are not the ones the $3.37 of pictures were generated for. So **`sora` was not
re-planned.**

Instead `npm run adopt:name-words` runs the same call and takes **one field**,
onto slots that are otherwise untouched — no idea, prompt, candidate, choice or
span moved. That is why `sora` could be the reel after all: it is the one he
reported the defect on and the hardest linguistic case, ten of its eleven slots
being pure Arabic script, and nothing about asking is destructive.

A slot gets a word only when the model returned **its span unchanged**, or
**exactly one span wholly inside it**. Two contained candidates are two different
pictures of two different moments and there is no honest way to choose, so it
takes none. The containment branch fired **once on `sora`**, on `img001`, which
is the whole of his complaint.

**Three slots got nothing and still arrive with their sentences**: `img008`,
where the model correctly declined, and `img004` and `img011`, whose spans this
run did not return.

### C — where the picture goes

`picture-life.ts` now owns **both** ends of a picture and is the single
declaration three callers read: the builder for the layer's in and out points,
`build-reel-cli` for the face mask that sizes it, and `analysis/sfx` for the
whoosh. Read back out of After Effects on the rebuilt reel:

| slot | span starts | picture in | out | gap to next | stretch | px | whoosh lands after | arrives on |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| img001 | 0.099 | **0.959** | 5.679 | 0.000 | 100 | 1037 | 0.133 | الدكتورة |
| img002 | 4.339 | **5.679** | 8.939 | 0.000 | 100 | 669 | 0.151 | cabinet |
| img003 | 8.439 | **8.939** | 11.099 | 0.000 | 100 | **893** | 0.127 | الصفر |
| img004 | 11.099 | 11.099 | 15.380 | 0.000 | 100 | 881 | 0.136 | *span start* |
| img005 | 14.960 | **15.380** | 19.680 | 0.000 | 100 | 849 | 0.126 | فضاء |
| img006 | 18.979 | **19.680** | 22.840 | 0.000 | 100 | 1061 | 0.130 | الملامح |
| img007 | 22.039 | **22.840** | 25.500 | 0.000 | 100 | 1061 | 0.140 | البشرة |
| img008 | 25.500 | 25.500 | 30.439 | 0.000 | 100 | 1073 | 0.150 | *span start* |
| img009 | 29.939 | **30.439** | 33.640 | 0.000 | 100 | 1061 | 0.149 | الداخل |
| img010 | 32.979 | **33.640** | 37.340 | 0.000 | 100 | 1049 | 0.151 | فخورة |
| img011 | 37.340 | 37.340 | 38.579 | — | 100 | 1049 | 0.121 | *span start* |

**The hand-over survived**: the largest gap anywhere is `0.00e+0`, exact, because
a picture now hands over to the next one's *arrival* rather than to its sentence.
Nothing is stretched.

**The whoosh followed the picture.** Its anchor lands **0.121 to 0.151 s after
each picture appears** — inside the 0.4004 s entrance, on all eleven. Had the
sound stayed on the span, `img001`'s would have fired 0.86 s before anything was
on screen.

**A picture never arrives so late that its entrance cannot finish**, clamped to
`end − entrance` where the entrance is the template's own authored opacity ramp
read from the audit. It is clamped against the **words'** end rather than the
next picture, so one slot decides it alone and the builder, the sizing and the
sound cannot disagree. No slot on `sora` needed the clamp; the throwaway videos
exercise it deliberately.

**Two pictures got bigger** as a side effect, and it is the sizing rule working
as designed rather than a change to it: a picture on screen for less time is
sized over less of the speaker's movement. `img003` went **669 → 893 px** because
arriving 0.5 s later skips the moment she leans furthest forward, and `img006`
1057 → 1061. `img009` went 1065 → 1061 and `img004` 893 → 881 the other way, for
the same reason in reverse. Every one is still asserted clear of her.

### D — what stops this happening on the next reel

**No value is fitted to a reel.** There is no greeting list and no per-language
case; the only numbers are the template's own entrance, read from the audit, and
the word the model itself named.

- **`picture-life.test.ts`, 17 cases**: the naming word at the start of a span,
  in the middle, at the very end, absent entirely, before the span, after it, and
  on a one-word span shorter than the entrance; plus the hand-over to a late
  arrival, and no gap when every picture is named.
- **`reel-shape.test.ts`, 4 new cases** on the geometry: a picture that arrives
  later is sized over less movement and is drawn larger, is still clear for every
  frame it is up, and **would be over the speaker if it were sized from later
  than it arrives** — the bound the ruling could have broken.
- **`new-video.test.ts` drives three videos of different shapes** and asserts,
  on each, that a named word inside the span moves the picture to it, that a word
  the transcript never had never reaches the plan, that a word belonging to
  another slot never reaches it either, and that an unnamed picture still arrives
  with its sentence. Each shape declares **how many named and how many unnamed
  pictures must be checked**, so a shape that quietly stopped exercising a branch
  fails rather than passes.

**How the assertions were proved to fire.** `pictureStartOf` was mutated to
ignore the named word and the suite re-run: **five cases in `picture-life.test.ts`
and both of the videos that have named pictures went red**, on the in-point
assertion. The third video stayed green, correctly — it declares zero named
pictures. The mutation was reverted and the file confirmed clean.

**One of the three videos was found reusing another's answer.** Shapes two and
three were both 10-second cuts of the same source, so they had identical video
bytes, and the slot cache keys on the word **text** and not on the timings — so
the third shape was silently being served the second's cached candidates,
`nameWordId` included. The new assertion caught it by naming which word reached
the plan. The third video now has its own length and its own words.

**Where the rule breaks**, said before he finds it:

1. **A span the model no longer returns gets nothing.** Two of `sora`'s eleven.
   Adoption matches on the span, and the model is free to choose different ones.
2. **The model can pick the latest of several right words** — `img002`'s
   `cabinet`, 1.34 s in, where `مؤسسة` names the same thing at 0.00.
3. **A one-word span shorter than the entrance cannot move at all**, and is left
   where it is rather than pulled outside itself.
4. **Only `sora` has been through v3.** Every corpus reel still starts each
   picture at the first word of its span, and moving them costs one call each.
5. **The version labels the cache entry; it does not select a prompt.**
   `buildSlotPrompt` takes a version and never branches on it, so asking for v1
   returns today's text — while the keyword prompt beside it does branch. Found
   this session, recorded in `docs/DECISION-image-config.md`, not changed.

### E — the gates

**`npm run golden`: PASS, 4 of 4, 17,174 fields, every one identical.** Nothing
was re-recorded, and nothing needed to be: the corpus plans carry no
`nameWordId`, so `pictureStartOf` returns the span's start for them and not one
field moved. `test-1` 4415, `test-2` 4280, `test-3` 3709, `vitasilk` 4770, all
matched field for field against the reference recorded at session 40.

**`npm run check`: PASS, exit 0**, on its only run this session. Per workspace,
from its own output:

| workspace | files | tests |
|---|---|---|
| core | 51 passed (51) | **757 passed** |
| service | 97 passed (97) | **1256 passed** |
| benchmarks | 17 passed (17) | **173 passed** |
| panel | 11 passed (11) | **213 passed**, 2 skipped, **0 failed** |

And the gates after them: modes ok, templates 6 entries ok, ExtendScript 15 files
ok, CLAUDE.md 9,877 of 20,000, `validate-templates` 6 templates ok against the
audited `library.aep`, panel manifest ok, references PASS, both sidecar models
ok, `check: PASS`.

**The panel's image-picker tests are still unfixed.** They passed here, as they
did at session 40 and failed at 38 and 39, unchanged throughout. One pass is not
a fix.

**`sora.mov`, its eleven candidates and every cache entry are untouched.** The
cache gained **one entry** — the v3 slot answer, which is what the $0.0866 bought
— going from 71 entries / 128 files / 106 MB to **72 / 129 / 106 MB**. No
existing entry was modified or removed.

## Deviations

**The call billed and then the command crashed.** `planSlotsCached` makes the
call, writes the cache entry, and *then* runs `planSlots` over the whole fresh
candidate set — which threw `MultiSubjectIdeaError` on one of the model's 22
ideas, *"A vibrant assortment of fresh fruits and vegetables"*. So the first run
exited non-zero after spending $0.086570. **Nothing was lost**: the entry was
already on disk, and every run since has been a cache hit costing $0.00. The
command now reads the manifest directly and only uses `planSlotsCached` to
create it, because whether some other candidate's idea is plannable is not its
question. This was not a blind retry — the money had already bought the answer.

**It is worth naming as a defect in its own right**: a reel re-planned normally
would bill, write its entry, and then die on a single multi-subject idea, and the
caller would see a failure for a call that succeeded and was paid for.

**`sora`'s comp was rebuilt** and the plan written twice — once by
`adopt:name-words --apply`, once by the build recording itself. He has it open;
it has changed, and that is the point of the session.

## Failures & open problems

1. **`img002` arrives 1.34 s into its span**, later than it needs to. The model
   picked the last of three words that name a clinic.
2. **Two of `sora`'s eleven pictures did not get a word** because this run
   returned different spans for them, and still arrive with their sentences.
3. **The corpus reels have not been through v3.** Only `sora` has.
4. **`planSlotsCached` can bill, write, and then throw** on the candidate set.
5. **The slot prompt's version does not select a prompt**, only a cache key.
6. **The panel's image-picker tests remain flaky and unfixed.**
7. `test-1` still holds one picture motionless for 6.8 s, and the opening bar is
   still unbuilt — both for the reasons sessions 38 and 40 measured.

## Repo state

Branch `main`. **Ledger 144 lines / `d886596…` → 145 lines /
`d4fe2de37f5eb0c8…`**, one line added, $0.086570 spent, the line quoted in full
at the top. `templates/library.aep` `4b0cf05a8f5d4775…` at both ends, never
opened for writing. `benchmarks/references/golden/census.json`
`2fb67fe6c4cb239c…` at both ends — unchanged and not re-recorded.

The hand-made references, byte-identical at both ends:

| file | sha256 |
|---|---|
| `benchmarks/references/align/vitasilk.json` | `f32e12dcfad55899…` |
| `benchmarks/references/align/vitasilk.rereview.json` | `10a2e5c2971ed27f…` |
| `.local/ground-truth/ground-truth.txt` / `.json` | `1fbbe2190d734db8…` / `64eebfd7374f93d2…` |
| `.local/ground-truth/test-1.txt` / `.json` | `b59a6270c3f704bc…` / `1394f8e863b72aa9…` |
| `.local/ground-truth/test-2.txt` / `.json` | `9ceea1c47ee94a8a…` / `183ba7b05392afaf…` |
| `.local/ground-truth/test-3.txt` / `.json` | `b5413c215ff32fec…` / `5ad64557cd2cd0fa…` |

`.local/plans/sora-995f2d27.editplan.json` moved from `84f749f75dc714d9…` to
`95f85c5a88f0b5f1…`, by the adoption and the rebuild. The five corpus plans were rewritten by golden's own
builds recording themselves, as they are every run, and carry no `nameWordId`.

Cache **72 entries / 129 files / 106 MB** — one more than at the start, the v3
slot answer. `sora.mov` `344265a032513979…` at both ends. One After Effects
instance throughout, and **no `AeDriveError` this session** — every build and
census answered first time. Free space 232 GB → **198 GB**, which is golden's
four rebuilt `.aep` files and the three throwaway videos' frames.
**No project of the user's own was saved.**

`.local/build/sora-continuous-dissolve.aep` **is still there**, untouched, as
instructed.

## Suggested next step

Watch `img002` on the next reel. If the model keeps choosing the last of several
words that name the same thing, the fix is one more clause in the same question —
*the earliest word that names it* — and it costs one call to validate. Everything
else here is free to run on another reel: `npm run adopt:name-words` is $0.09
once per reel and $0.00 thereafter.

---

**The one file, and the one moment**

`.local/build/sora-995f2d27-full.aep` — look at **0.0 to 1.0 seconds**. She says
*"السلام عليكم"* with nothing in the corner, and the doctor arrives on
*"الدكتورة"* at 0.959 s, as she names herself. That is the thing he asked for,
and the whoosh arrives with it.
