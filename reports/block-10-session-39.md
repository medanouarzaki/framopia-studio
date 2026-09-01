# Block 10 session 39 — pictures that hand over, and why the model drew a doctor

**Status: PROBLEM — the continuous rule is built, proved and safe, but it is not
yet what every reel does: on `test-1` it leaves one picture motionless for 7.2
seconds, and that is a thing he has to look at rather than a thing to decide for
him.**

## The two numbers he asked for first

**The longest a picture now stays on screen is 4.84 seconds**, on `sora`, and
2.84 of those seconds are a still frame. That is his own reel and it is fine.

**On `test-1` the same rule puts one picture on screen for 9.18 seconds**, 7.18
of them motionless, **outliving the sentence it illustrates by 7.18 seconds** —
a third of a 22-second reel spent on one frozen picture of something the speaker
stopped talking about seven seconds ago. Nothing is wrong with the rule. `sora`
has eleven pictures over 40.5 s and its gaps are 1.3 to 3.3 s; `test-1` has four
over 22 s and its gaps are 3.2 to 7.2 s. **The rule turns a gap into a held
picture, so a reel with few pictures gets long ones.**

**Does any picture end up over the speaker? It would have — thirteen of them —
and none does.** This was the likeliest defect and it is real. A picture is
sized from the largest square the top-left corner can hold clear of the
speaker's face, measured over the frames the picture is on screen. Hold a
picture past its own words and it is on screen while the speaker keeps moving, and the
corner that held it when it appeared may be gone. Measured over all four reels
that have pictures:

| reel | slots | would land over the speaker | worst |
|---|---:|---:|---|
| sora | 11 | **6** | `img002`, **376 px** across her |
| test-1 | 4 | **3** | `img001`, 12 px |
| vitasilk | 5 | **2** | `img001`, 52 px |
| ground-truth | 6 | **2** | `img003`, 16 px |

`sora`'s `img002` is the one that matters. It is sized 1045 px over its own
words, and in the 1.28 s it now stays on afterwards she leans forward — the same
moment that makes `img003` the small picture. Held at 1045 px it sits across his
face.

**The fix is not a margin and not a number: the face is measured over the
picture's whole life instead of over its words.** That is one line of who-asks-
whom, and it makes the defect impossible rather than caught. It costs size, and
only where the speaker moves: `sora`'s mean goes from 992 px to 951, and `img002` from
1045 to **669**. Everywhere else it is 4 to 32 px.

## Why the model chose a doctor for a doctor

**It could not have known she was on screen. It was never shown the video.**

The model that picks the moments to illustrate is given exactly four things:
the transcript as one word per line with its start time, the length of the reel,
the client's name, and how many slots to return. No frame, no thumbnail, no
description of the footage, and no sentence anywhere in the prompt saying there
is a person in shot. The whole of it is in
`service/src/analysis/slots.ts:52`; the only mention of the speaker at all is
*"the idea should name it as she named it"*, which is about her words, not her
face. **Nothing in the prompt asks whether a picture would restate what the
viewer can already see**, which is the property session 38 identified as the one
separating the picture he rejected from the two he kept.

**And it did not write a reason.** The brief expected one; there is none. For
image slots the model answers with two fields and nothing else — the word ids
and a one-line idea — so there is no rationale on disk to read, for the doctor
picture or any other. Keywords carry a `reason`; slots never have.

What does exist is its **ordering**: it was asked for the 22 strongest slots,
best first. Here is what it returned, in its own order, with what each idea was
for and whether the reel used it.

| rank | words | used as | idea |
|---:|---|---|---|
| 1 | بمدينة مكناس | **—** | Bab Mansour gate in Meknes |
| 2 | بديت من الصفر | img003 | A single green seedling sprouting from barren soil |
| 3 | الحفاظ على صحة البشرة | img007 | Water splashing onto fresh healthy skin |
| 4 | ولكن خلال 3 سنوات | **—** | A desk calendar showing a three-year progression |
| 5 | كنجمع بين الطب التجميلي والتغذية | img008 | A scale balancing a dermal filler syringe and fresh vegetables |
| 6 | فابتسامة وثقة جديدة | img011 | A bright glowing smile on a confident face |
| 7 | العمل والتكوين المستمر | **—** | Medical textbooks and a stethoscope on a desk |
| 8 | قدرت نبني مشروعي | **—** | Building blocks forming a small medical clinic |
| 9 | ومؤسسة ديال مركز cabinet docteur Lobna Kfafi | img002 | A modern medical clinic reception area |
| **10** | **السلام عليكم أنا الدكتورة لبنى كفافي** | **img001** | **A female doctor in a white coat smiling** |
| 11 | وإنما إبراز الجمال الطبيعي | — | A fresh glowing face with natural skin texture and no makeup |
| 12 | بكل مريضة وثقات فيا | — | A doctor and a patient holding hands in trust |
| 13 | وبالنسبة ليا الطب التجميلي | — | Aesthetic dermatology equipment and laser machines |
| 14 | كيبدا من الداخل ديالنا | img009 | Glowing warm light radiating from within a person's chest |
| 15 | وتعزيز ثقة الإنسان فالنفس ديالو | — | A person standing tall with hands on hips in a confident posture |
| 16 | وبفضل الطموح | img004 | A person looking up at a glowing mountain peak |
| 17 | أخصائية في طب التجميل والتغذية | — | A stethoscope wrapped around a healthy salad bowl |
| 18 | ماشي غير تغيير الملامح | img006 | A theatrical mask being taken off to reveal a human face |
| 19 | ونخلق فضاء لي كيحمل الرؤية ديالي | img005 | A bright welcoming room with comfortable modern chairs |
| 20 | وكيبان من الخارج | — | A radiant woman glowing with light from the outside |
| 21 | اليوما أنا فخورة | img010 | A proud confident woman smiling with achievement |
| 22 | لأنني كنأمن بأن الجمال الحقيقي | — | A beautiful glowing aura shining around a woman |

So: **the doctor picture is the model's tenth choice of twenty-two, and the reel
took it anyway.** `planSlots` throws the ordering away — it sorts the candidates
by time and keeps the first one that fits each window, so what decides is when a
candidate falls, never how good the model thought it was.

**The model's own first choice was never used.** "Bab Mansour gate in Meknes"
sits at 7.26 s, one tenth of a second after `img002`'s words end, and the planner
requires half a second between pictures. It was thrown out for being 0.4 s too
close to its neighbour.

Two other things the table shows. **Eleven of the twenty-two ideas are doctors,
clinics, patients or medical equipment** — the reel is a doctor describing her
practice, so a model reading only her words has every reason to draw one. And
**the four candidates it ranked 11, 12, 13 and 15 were all dropped for the same
mechanical reason as rank 1**, not for being weak.

Nothing about the prompt or the selection was changed. That is his ruling to
make and it costs a model call to validate.

## Done

### A — the measurement, before anything was built

Every reel that has pictures, per slot: its window today, the gap to the next
picture, and how long it would be on screen. `sora`, the reel he watched:

| slot | window | length | gap to next | on screen | of that, still |
|---|---|---:|---:|---:|---:|
| img001 | 0.099–2.180 | 2.081 | 2.159 | 4.240 | 2.238 |
| img002 | 4.339–7.159 | 2.820 | 1.280 | 4.100 | 2.098 |
| img003 | 8.439–9.380 | 0.941 | 1.719 | 2.660 | 0.658 |
| img004 | 11.099–11.960 | 0.861 | 3.000 | 3.861 | 1.859 |
| img005 | 14.960–17.039 | 2.079 | 1.940 | 4.019 | 2.017 |
| img006 | 18.979–20.180 | 1.201 | 1.859 | 3.060 | 1.058 |
| img007 | 22.039–23.260 | 1.221 | 2.240 | 3.461 | 1.459 |
| img008 | 25.500–27.420 | 1.920 | 2.519 | **4.439** | **2.437** |
| img009 | 29.939–31.340 | 1.401 | 1.639 | 3.040 | 1.038 |
| img010 | 32.979–34.040 | 1.061 | 3.300 | 4.361 | 2.359 |
| img011 | 37.340–38.579 | 1.239 | — | 1.239 | 0 |

And the whole corpus, with the longest hold each reel would produce:

| reel | length | pictures | corner has a picture: now → after | longest on screen | of that, still |
|---|---:|---:|---|---:|---:|
| **sora** | 40.5 s | 11 | **41.5% → 94.9%** | 4.44 s (img008) | 2.44 s |
| **test-1** | 22.0 s | 4 | **33.0% → 99.3%** | **8.78 s (img003)** | **6.78 s** |
| **vitasilk** | 25.7 s | 5 | **40.0% → 85.4%** | 6.16 s (img001) | 4.16 s |
| ground-truth | 23.3 s | 6 | 22.7% → 85.2% | 4.34 s (img004) | 2.34 s |

Session 37 measured today's longest hold at 0.818 s and named the risk of a long
motionless picture as a bound nothing had approached. **This rule reaches it on
the second reel measured.**

**The ends.** The first picture on all three real reels starts at 0.099 s — the
first word — so there is nothing before it and three frames of empty corner at
the very top of the reel, which the ruling does not reach and which was left
alone. **The last picture ends with its own words**, not with the reel: the
ruling names the next picture as what a picture waits for, and where there is no
next picture there is nothing to wait for. Holding it to the end of the reel
would be a second ruling nobody has given, and it would be a long one — 1.96 s
on `sora`, 3.65 s on `vitasilk`.

**How it meets what already exists.** The whoosh leads each picture by 0.541 to
0.570 s (16.2 to 17.1 frames) and did not move; what changes is that it now
sounds while the previous picture is still on screen rather than into an empty
corner. Session 37's hold-the-last-frame rule is the same mechanism, extended:
the still part simply grows. Nothing is stretched — every image layer in both
built files reads `stretch = 100`, read back out of After Effects.

**The overlap, which is where the ruling turns out to argue against its own
plainest reading.** The image template fades in from opacity zero over 0.4004 s.
Hand a picture over on the frame the next one starts, and for those 0.4 s the
corner holds an outgoing picture that has left and an incoming one that has not
arrived — **the void comes back, in a new place, ten times on `sora`.** So both
handovers were built:

- **`cut`** — the picture ends the frame the next one appears. Faithful to
  *"stay until the next one appears"*, and it has the 0.4 s fade-from-nothing.
- **`dissolve`** — the picture stays underneath until the incoming one has
  finished fading up. The corner is never empty, which is *"there is no void
  between them, layer after layer"* read literally. The 0.4004 s is the
  template's own authored entrance, read out of the audit, not a number chosen
  here.

**The mechanism is session 37's**, unchanged: decided in the planner, carried on
the placement, applied by the ExtendScript as time remapping with two keyframes
so the entrance plays at its authored speed and the still part grows. No
template keyframe was touched.

### B — built, and read back out of After Effects

Two files, both `sora`, both from the same plan, the same pictures and the same
words:

| | path | what to look at |
|---|---|---|
| **cut** | `.local/build/sora-continuous-cut.aep` | each handover — the corner goes briefly empty as the next picture fades up |
| **dissolve** | `.local/build/sora-continuous-dissolve.aep` | the same handovers, with the old picture underneath so the corner never empties |

Read out of the comps rather than trusted from the code. **Every image layer's
out point equals the next picture's in point**, exactly, under `cut`:

| slot | in | out | its words end | next picture in | gap |
|---|---:|---:|---:|---:|---:|
| img001 | 0.099 | 4.339 | 2.180 | 4.339 | **0.000** |
| img002 | 4.339 | 8.439 | 7.159 | 8.439 | **0.000** |
| img003 | 8.439 | 11.099 | 9.380 | 11.099 | **0.000** |
| img004 | 11.099 | 14.960 | 11.960 | 14.960 | **0.000** |
| img005 | 14.960 | 18.979 | 17.039 | 18.979 | **0.000** |
| img006 | 18.979 | 22.039 | 20.180 | 22.039 | **0.000** |
| img007 | 22.039 | 25.500 | 23.260 | 25.500 | **0.000** |
| img008 | 25.500 | 29.939 | 27.420 | 29.939 | **0.000** |
| img009 | 29.939 | 32.979 | 31.340 | 32.979 | **0.000** |
| img010 | 32.979 | 37.340 | 34.040 | 37.340 | **0.000** |
| img011 | 37.340 | 38.579 | 38.579 | — | — |

Under `dissolve` every one of those out points is 0.4004 s later and **every
handover overlaps by exactly −0.400 s**, measured in the comp. The incoming
picture is the upper layer in all ten handovers, so it fades up *over* the
outgoing one rather than under it — checked by layer index, not assumed.

**Every picture in both files is clear of the speaker**, because the build
refuses and stops otherwise and both exited cleanly. Their sizes are the ones
the whole-life measurement gives — 669 to 1073 px, against 669 to 1085 on his
own reel — and the two that changed most are `img002` (1045 → 669) and `img005`
(881 → 849).

**His own reel is untouched by any of this.** `.local/build/sora-995f2d27-full.aep`
was rebuilt last on the plain rule and is back at 669–1085 px with each picture
ending on its own words, exactly as session 38 left it.

### C — the model's choice

Above, in full.

### D — what stops this happening on the next reel

**No number was fitted to a reel.** The dissolve's overlap is the template's own
authored entrance read from the audit; the handover is the next picture's start;
the picture's size is the corner over its own life. A template re-authored to a
slower fade moves the overlap with it, and nothing here would change if `sora`
had never existed.

`service/src/build/picture-life.ts` is **the one declaration of how long a
picture is on screen**, and it exists because two callers have to agree: the
thing that sizes a picture and the thing that sets its out point. Sizing over
the words while living to the handover is the defect measured above, and one
declaration is what makes it unavailable rather than caught.

- **`picture-life.test.ts`, ten cases** over synthetic reel shapes: two pictures
  far apart, pictures back to back, one picture only, a picture at the very end,
  a reel where a window would shorten a picture, an empty reel, and the same
  windows shuffled. Arithmetic only — nothing reads disk or opens a socket.
- **`reel-shape.test.ts`, five new cases** on the safety question, which is the
  one that matters: a picture sized over its words and held past them **is
  asserted to be over the speaker**, the same picture sized over its whole life
  is asserted clear, and a reel of three moving slots comes out at 690/870/1180
  px with every one clear.
- **`new-video.test.ts` now drives three videos**, not one, and asserts the
  continuous rule end to end on each: **no picture leaves before the next
  arrives** under both handovers, the last still ends with its own words, a
  picture held past the template holds its last frame, and nothing is stretched.

**How no request left the machine, by construction.** Each of the three videos
is a few seconds cut out of a corpus reel and re-encoded into a temporary
directory, so its hash has never existed. `transcribeVideo`,
`analyseKeywordsForPlan`, `planImageSlotsForPlan` and `generateImagesForPlan`
each take the thing that would make the network call as an argument, and every
one of them is handed a local substitute — no API key is read and no client is
constructed. The ledger is pointed at a temporary file, so even a fabricated
cost could not reach the real one. Each video's plan, frames, masks and cutouts
are removed afterwards from wherever the rules put them, and no real asset is
opened for writing.

**One of those three tests was passing for the wrong reason and was caught.**
The two new shapes were reaching the builder with **one** picture each, because
the pipeline's stubbed slot stage returns a hard-coded candidate list and the
per-shape one was only being written into the unread `rawText` beside it. A rule
about what happens between two pictures passes vacuously on a reel with one, so
each shape now declares how many pictures it must actually reach the builder
with, and that is asserted before anything else.

**Where the rule breaks**, said before he finds it:

1. **A reel with few pictures gets long ones.** `test-1` at 7.18 s of still
   frame is the measured case. There is no maximum, and there cannot be an
   honest one taken from these reels.
2. **A picture outlives the sentence it illustrates.** On `sora` by up to 3.3 s,
   on `test-1` by 7.18. A picture of a clinic reception is still on screen while
   she has moved on to something else.
3. **Every picture is a little smaller**, and one is much smaller. That is the
   price of the safety rule and it is not optional.
4. **`cut` moves the void rather than removing it** — 0.4 s of empty corner at
   every handover. `dissolve` does not, at the cost of two pictures visible at
   once for twelve frames.
5. **The first 0.099 s of a reel still has no picture**, and nothing here
   changes that.

### E — the gates

**`npm run golden`: PASS, 4 of 4, 17,174 fields, and every one identical.**
Nothing was re-recorded, because nothing needed to be: the reel rule did not
move, and this is the proof. `test-1` 4415, `test-2` 4280, `test-3` 3709,
`vitasilk` 4770, all matched field for field against the reference recorded
earlier the same day.

**`npm run check`: PASS — it exits 0, and everything is green.** Per workspace,
from its own output:

| workspace | files | tests |
|---|---|---|
| core | 51 passed (51) | **756 passed** |
| service | 97 passed (97) | **1245 passed** — up one file and 16 tests |
| benchmarks | 17 passed (17) | **173 passed** |
| panel | 11 passed (11) | **213 passed**, 2 skipped, **0 failed** |

And the gates after the test step, which `check.sh` only reaches when the tests
pass: modes ok, templates 6 entries ok, ExtendScript ok, references PASS,
`validate-templates` 6 templates ok against the audited `library.aep`,
`check: PASS`.

**The panel's image-picker tests are not fixed and nothing was done to them.**
They passed in this run and one of them failed in the run before it, in this
same session, with no change between the two. They are the tests session 35
measured as racing their own `onError`, and what this run shows is that the race
can go either way — not that it is closed. A green `check` here is one throw of
that coin.

**`sora.mov`, its eleven candidates and every cache entry are untouched.** Cache
71 entries / 128 files / 106 MB at both ends, `sora.mov` `344265a0…` at both
ends, ledger **144 lines / `d886596…`, $0.00 spent.**

## Deviations

**The continuous rule was not made the default, and §2 said to build it if the
measurement supported it.** The measurement did not: §2.2 names "a picture
outliving the words it illustrates by a long way" as a stop condition, and
`test-1` produces exactly that at 7.18 s. So the mechanism is built, proved and
sitting behind `--images-continuous`, the reel rule is byte for byte what it
was, and he judges the two files. This is the pattern session 37 used for the
size ruling, which he then decided by eye.

**`sora`'s comp was built three times** — `cut`, `dissolve`, and once more on the
plain rule so his own file and the plan are back where he left them. He had it
open; it has changed. The plan was also written each time, because a build
records itself on the plan.

**`new-video.test.ts` is much slower.** It drives the real cut-out sidecar three
times instead of once. Its first form used 14- and 12-second clips with three
slots each and **timed out at 300 s per test inside `npm run check`**, which is
a redder gate than the one it replaced; the two new shapes are now 10-second
clips with two slots and the file's bound is 900 s. It is still the slowest file
in the suite.

## Failures & open problems

1. **The continuous rule is not in force.** Two files exist for him to look at.
   Until he rules, a reel's pictures still end with their own words.
2. **`test-1`'s 7.18-second still frame has no answer** that is not a number
   chosen against a reel. The honest reading is that it is a statement about the
   planner — `test-1` has four pictures where the density rule would give six —
   and not about the handover.
3. **The picture path's golden coverage is still two reels of four.** `test-2`
   and `test-3` have no image slots, and `sora` is not in golden, so nothing in
   the gate would catch a regression on a reel shaped like `sora`.
4. **The panel's image-picker tests are still unfixed and are now visibly
   flaky.** Within this session the same unchanged file failed one test in one
   `check` run and passed every test in the next. Session 38 recorded four
   failing. The cause session 35 measured — a cut-out fixture naming a file that
   moved into a per-reel subdirectory, racing the panel's own `onError` — is
   untouched, and a passing `check` must not be read as it being closed.
5. The opening rule remains unbuilt, for session 38's measured reason.

## Repo state

Branch `main`. Ledger **144 lines / `d88659660ca3fa37…`** at both ends, $0.00
spent. `templates/library.aep` `4b0cf05a8f5d4775…` at both ends, never opened
for writing. `benchmarks/references/golden/census.json` `470a44b4c235a175…`
unchanged and never re-recorded.

The hand-made references, byte-identical at both ends:

| file | sha256 |
|---|---|
| `benchmarks/references/align/vitasilk.json` | `f32e12dcfad55899…` |
| `benchmarks/references/align/vitasilk.rereview.json` | `10a2e5c2971ed27f…` |
| `.local/ground-truth/ground-truth.txt` / `.json` | `1fbbe2190d734db8…` / `64eebfd7374f93d2…` |
| `.local/ground-truth/test-1.txt` / `.json` | `b59a6270c3f704bc…` / `1394f8e863b72aa9…` |
| `.local/ground-truth/test-2.txt` / `.json` | `9ceea1c47ee94a8a…` / `183ba7b05392afaf…` |
| `.local/ground-truth/test-3.txt` / `.json` | `b5413c215ff32fec…` / `5ad64557cd2cd0fa…` |

Cache **71 entries / 128 files / 106 MB** at both ends. `sora.mov`
`344265a032513979…` at both ends. `.local/plans/sora-995f2d27.editplan.json`
moved from `0fc05609a7768da2…` to `fcc7dfd8f1ac595f…`, which is the three builds
each recording themselves on it and nothing else. One After Effects instance
throughout. 258 GB free. **No project of the user's own was saved.**

## Suggested next step

He looks at the two files and says which handover he wants, or that he wants
neither. If he wants one, making it the rule is small — the mechanism, the
safety rule and the tests are all in place — and `test-1`'s long still is the
thing to decide about at the same time, because the answer to it is probably
more pictures rather than shorter ones.

---

**The one file, and the one moment**

`.local/build/sora-continuous-dissolve.aep` — look at **7.16 to 8.44 seconds**.
That is the picture of the clinic reception staying on after she has stopped
talking about the clinic, handing over to the seedling. It is the longest thing
this rule asks a viewer to sit with on his own reel, and it is the picture that
had to shrink from 1045 px to 669 to stay off her face while it waited.
