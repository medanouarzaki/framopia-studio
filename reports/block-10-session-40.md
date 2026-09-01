# Block 10 session 40 — the cut is the rule, and where the brand colours go

**Status: PROBLEM — two of the three things are done and proved, but the second
ruling cannot be built honestly from what is on disk: nothing in the pipeline
knows which word in a sentence names the thing a picture shows, and the one
thing that could is a change to the analysis prompt, which is billable and his
to make.**

## What `sora`'s first picture now lands on

**Still "السلام" — hello.** It has not moved, and this session did not move it.

He asked for it to appear where she says *"أنا الدكتورة"* — "I am the doctor" —
which is `w0003` at **0.96 s**, not `w0000` at **0.10 s**. That is 0.86 s and
three words later. The reason it did not move is not that the change is hard to
make; it is that **nothing on disk can tell which of the six words is the one
that names a doctor.** The model returns a span of word ids and one English
sentence — *"A female doctor in a white coat smiling"* — and no reason, no
per-word tag, and no pointer. The words are Arabic. Matching the English idea
against them was measured: **it fires on 1 of the 26 slots in this whole
project**, and not on this one. The full measurement, and the one-field change
that would fix it, are in *Done → B* below.

## Do the brand colours reach the pictures?

**Yes, for a new client — proved, not read. And no, for a reel that already
exists.** The four colours are substituted into one sentence of the client's own
style prompt and that sentence goes to the image model with all four hex values
in it, each with a different job. A scratch client with four greens nothing else
here uses was created, a slot planned for it, and the composed prompt printed in
full: its greens are there and K2's reds and golds are not. **But the prompt is
composed once, when a reel's slots are planned, and frozen onto that reel's
plan; picture generation sends that stored string verbatim and never looks at
the palette again.** So editing a client's colours changes the *next* reel and
not one already planned — and to move an existing reel you would have to run
`npm run recompose` in a terminal, which no panel control calls, and then
regenerate the pictures, which costs money. On top of that, **the panel can only
set the colours when a client is created**: `POST /clients` is the only route
that writes a palette and there is no route that edits one.

## The longest a picture now stays, per reel

| reel | pictures | longest on screen | of that, motionless | outlives its own words by |
|---|---:|---:|---:|---:|
| **sora** | 11 | 4.44 s (`img008`) | **2.44 s** | 2.52 s |
| **test-1** | 4 | **8.78 s (`img003`)** | **6.78 s** | **7.18 s** |
| **vitasilk** | 5 | 6.16 s (`img001`) | **4.16 s** | 4.66 s |
| ground-truth | 6 | 4.34 s (`img004`) | 2.34 s | 2.92 s |

**Nothing is worse than `test-1`, and `test-1` is bad enough to look like a
fault.** He has seen `sora`, where the worst picture sits still for 2.44 s and
reads as a picture that stays. `test-1` is a different thing: one picture holds
for 8.78 s on a 22-second reel — **more than a third of it** — of which 6.78 s
is a single motionless frame, and it is still there seven seconds after the
sentence it illustrates ended. `vitasilk`'s 4.16 s is on the edge. The cause is
not the rule: `sora` has eleven pictures over 40.5 s and gaps of 1.3–3.3 s,
`test-1` has four over 22 s and gaps of 3.2–7.2 s. **The hold is exactly the gap
the planner left**, so the honest fix is more pictures on a sparse reel, not a
cap on the hold — a cap would be a number taken from these four reels.

## Done

### A — the cut is the rule

`--images-continuous` is gone, the dissolve is gone, and both comparison files
were deleted (one was rewritten afterwards by After Effects — see
*Deviations*). A picture's out point is the next picture's in point; the last
picture in a reel ends with its own words, because there is no next picture to
wait for.

**The handover is no longer something a caller can forget.** It was an optional
argument to `buildReel`; it is now computed inside it from `pictureLives`, the
same pure function the sizing path reads. A build cannot be made without it.

**Session 39's face fix is kept and is what makes the rule safe.** The face box
is unioned over the picture's whole life, not its words, so a picture held past
its sentence is sized for where the speaker is *while it is still up*. What that
costs, per slot:

| reel | mean size, words → life | slots that pay | the one that pays most |
|---|---|---:|---|
| **sora** | 992 → **951 px** | 6 of 11 | `img002` **1045 → 669** |
| test-1 | 926 → 920 px | 3 of 4 | `img001` 937 → 925 |
| vitasilk | 903 → 885 px | 2 of 5 | `img001` 937 → 885 |
| ground-truth | 968 → 961 px | 4 of 6 | `img003` 973 → 957 |

Every other slot pays 4 to 52 px. `sora`'s `img002` is the whole cost of the
rule in one place: it is sized 1045 px for its own words, and in the 1.28 s it
now stays on afterwards she leans forward, so 669 px is all the corner holds.
Without this it would be **376 px across her face**.

**Read back out of After Effects**, from the rebuilt comp rather than from the
code:

| slot | in | out | its words end | gap to next | stretch | px |
|---|---:|---:|---:|---:|---:|---:|
| img001 | 0.099 | 4.339 | 2.180 | **0.000** | 100 | 1037 |
| img002 | 4.339 | 8.439 | 7.159 | **0.000** | 100 | 669 |
| img003 | 8.439 | 11.099 | 9.380 | **0.000** | 100 | 669 |
| img004 | 11.099 | 14.960 | 11.960 | **0.000** | 100 | 881 |
| img005 | 14.960 | 18.979 | 17.039 | **0.000** | 100 | 849 |
| img006 | 18.979 | 22.039 | 20.180 | **0.000** | 100 | 1057 |
| img007 | 22.039 | 25.500 | 23.260 | **0.000** | 100 | 1061 |
| img008 | 25.500 | 29.939 | 27.420 | **0.000** | 100 | 1073 |
| img009 | 29.939 | 32.979 | 31.340 | **0.000** | 100 | 1065 |
| img010 | 32.979 | 37.340 | 34.040 | **0.000** | 100 | 1049 |
| img011 | 37.340 | 38.579 | 38.579 | — | 100 | 1049 |

The largest gap anywhere in the comp is **0.00e+0** — exact, not rounded — and
every image layer reads `stretch = 100`, so nothing is slowed to fill the time.

**The retired assertions are gone rather than left standing.** Session 37's "the
out point is the words' own end" asserted the opposite of the rule in force and
was rewritten to assert what now has to be true — that no picture is *shorter*
than its own words. Session 39's dissolve cases are deleted. `placementsA` and
`placementsC` now say the same thing about a picture, as they did before the
handover existed, and a test pins that.

### B — a picture starting where its meaning starts, and why it is not built

**The measurement first.** For every slot on every reel with pictures: the words
it was given, the idea, and — read by hand — which word in that span actually
names the thing the idea shows.

| reel | slot | words | idea | names it at | starts late by |
|---|---|---|---|---|---:|
| sora | img001 | السلام عليكم أنا **الدكتورة** لبنى كفافي | a female doctor | `w0003` 0.96 | **0.86 s** |
| | img002 | **ومؤسسة** ديال مركز cabinet docteur… | a clinic reception | `w0011` 4.34 | 0 |
| | img003 | بديت من الصفر | a seedling in barren soil | — *(a metaphor)* | — |
| | img004 | وبفضل **الطموح** | a mountain peak | `w0028` 11.52 | 0.42 s |
| | img005 | ونخلق **فضاء** لي كيحمل الرؤية ديالي | a welcoming room | `w0036` 15.38 | 0.42 s |
| | img006 | ماشي غير تغيير **الملامح** | a mask being removed | `w0048` 19.68 | 0.70 s |
| | img007 | الحفاظ على صحة **البشرة** | water on skin | `w0056` 22.84 | 0.80 s |
| | img008 | كنجمع بين **الطب التجميلي والتغذية** | a scale, syringe and vegetables | `w0064` 26.12 | 0.62 s |
| | img009 | كيبدا من **الداخل** ديالنا | light from within | `w0074` 30.44 | 0.50 s |
| | img010 | اليوما أنا **فخورة** | a proud woman | `w0081` 33.70 | 0.72 s |
| | img011 | **فابتسامة** وثقة جديدة | a glowing smile | `w0090` 37.34 | 0 |
| test-1 | img001 | bghiti **شد** طبيعي للوجه | a lifted jawline | `w0001` 0.40 | 0.30 s |
| | img002 | lyoma ghadi nhdr likom 3la **محفزات الكولاجين** | a doctor with a vial | `w0020` 5.74 | 1.14 s |
| | img003 | wki3tewna **شد** خفيف للبشرة | a tightened cheek | `w0035` 11.48 | 0.54 s |
| | img004 | katji kat7ssn lik mn jawdat **البشرة** dialk | hydrated skin | `w0065` 21.30 | 1.58 s |
| vitasilk | img001 | **5 d9ay9** eyyh a lalla | a clock at five minutes | `w0000` 0.10 | 0 |
| | img002 | jbt likom le **filler glow** mn la marque Vita Silk | a serum bottle | `w0021` 6.98 | 0.72 s |
| | img003 | fih 26 **vitamines** et aussi des enzymes | vitamin capsules | `w0037` 12.08 | 0.46 s |
| | img004 | chno katsnay bach thllay f **ch3rk** | a woman touching her hair | `w0055` 18.46 | 1.52 s |
| | img005 | ila l9iti 3ndhom **la marque Vita Silk** | a salon shelf | `w0062` 21.08 | 1.08 s |
| gt | img001 | les **cernes** pigmentés | dark circles | `w0002` 0.52 | 0.16 s |
| | img002 | **joj** dial l7loul | two doors, a choice | `w0014` 3.66 | 0 |
| | img003 | l'ADN du **saumon** | a salmon | `w0031` 8.44 | 0.58 s |
| | img004 | **15** tal 20 yom | a calendar block | `w0039` 11.04 | 0 |
| | img005 | la **mésothérapie** | a microneedling tool | `w0052` 15.48 | 0.10 s |
| | img006 | **4** dial l7essass | four appointment cards | `w0064` 19.38 | 0 |

**So it is not `sora`'s first picture. It is most pictures on every reel.** Six
of the twenty-six already start on the naming word; **nineteen start between
0.10 s and 1.58 s early**, with a median around 0.6 s; and one — `sora`'s
`img003`, the seedling for *"I started from zero"* — has **no naming word at
all**, because the idea is a metaphor for the sentence rather than a picture of
anything in it. That last case is not an accident: the slot prompt deliberately
asks for both kinds, *"when the words name no such thing — a question, a
feeling, a promise, a result — the picture should carry the mood or the outcome
instead"*, so a reel will always contain pictures for which "the word that names
what it shows" does not exist.

**And it cannot be derived from what is on disk.** Four signals were checked,
and each was measured rather than guessed at:

1. **Matching the idea's words against the span's words.** The idea is English;
   the words are Darija in Arabic script, Darija in Latin Arabizi, French and
   English. A case-folded, accent-stripped, four-character prefix match over
   every slot **fires on 1 of 26** — `vitamines` against `Vitamin` on
   `vitasilk`'s `img003`. On `sora` it fires **0 of 11**, because ten of its
   eleven slots contain no Latin-script word at all.
2. **A per-word tag.** There is none. A plan's word carries `id`, `start`,
   `end`, `text`, `sourceText`, `lang`, `script`, `confidence`, `removed` and
   `edited` — nothing that says a word names a thing.
3. **The keyword stage**, which does pick out content-bearing words. It is far
   too sparse: keywords run at about half the density of image slots, so **8 of
   26 slots contain one**, and `sora`'s `img001` — the one he complained about —
   contains none.
4. **`transcript.terms`.** These are ORTHOGRAPHY_GUIDE §6 term boundaries for
   subtitle grouping. Every word is inside one; it is a segmentation, not a
   marker of meaning.

A fifth option — a list of greetings and filler words to skip past — would work
on `sora` and is exactly what the standing rule forbids: it is a value fitted to
one reel's language, and it would do nothing for the nineteen slots above that
start late for reasons that have nothing to do with a greeting.

**What would fix it, stated so it can be authorised rather than guessed at.**
The model already knows which word names the thing — it chose the span and wrote
the idea in the same breath. It is simply never asked. The change is one field:
the slot response becomes `{wordIds, idea, nameWordId}`, `nameWordId` being one
of the ids it already returned, and the prompt gains a sentence asking for it.
It is **optional with a default** per the standing schema rule — absent means
the span's own start, which is today's behaviour, so every existing plan keeps
working and nothing needs migrating. The builder change is then two lines. It
costs one model call per reel to validate, it is billable, and changing that
prompt is his ruling, so this session stopped here as instructed.

**One thing worth knowing before he rules**, because it bounds the change: a
picture must still be able to play its 0.4004 s entrance. Four of the
twenty-six spans would leave less than that after the naming word — `test-1`'s
`img004` leaves 0.64 s, `vitasilk`'s `img004` 0.28 s, and two others are close —
so the rule needs a floor, and the honest floor is the template's own authored
entrance read from the audit, which is a number the template owns rather than
one chosen against a reel.

### C — the colours, traced

**The path, end to end.**

| step | where | what happens |
|---|---|---|
| he types four hex values | `panel/src/NewClient.tsx:78` | only when a client is **created** |
| the panel posts them | `POST /clients` → `service/src/server.ts:169` | the only route that writes a palette; **there is no route that edits one** |
| written to disk | `service/src/clients/create.ts:130` | `modes/<id>.json`, `palette: {background, primary, accent, light}` |
| substituted | `core/src/mode.ts:880` `renderStylePrompt` | `{{palette.role}}` → the hex value, inside the client's own style fragments |
| composed | `service/src/analysis/slot-select.ts:149` `composePrompt` | idea + style fragments + variation axes, joined |
| **frozen** | `service/src/analysis/job.ts:371` | the composed string is written onto the plan as `slot.prompt` |
| sent | `service/src/images/generate.ts:247` | **`slot.prompt`, verbatim** — the palette is never read again |

**The sentence they appear in**, from the scratch client, verbatim:

> the brighter end of the palette leads: **#7FD4A2** and **#EAFBEF** carry the
> subject, with **#1E7A3C** for depth and **#0B2E13** kept to the ground behind
> it

and the same slot for K2, for comparison:

> the brighter end of the palette leads: **#C9A96E** and **#F8F6F2** carry the
> subject, with **#820000** for depth and **#1A0000** kept to the ground behind
> it

The scratch client's four greens appear and none of K2's four appear. It was
created in `modes/`, loaded through the real `loadMode`, planned through the
real `planSlots`, printed, and deleted. **No model call, no network, $0.00.**

**All four colours have a job**, which is the thing worth checking after
`imageScale: 1.4` turned out to be inert: `accent` and `light` carry the
subject, `primary` is depth, `background` is the ground. None is decorative and
none is unused. Whether the model *obeys* each of the four is a different
question and one that costs a picture to answer, so it is not claimed here.

**But the panel's own captions under-describe two of them.** They are what he
reads while choosing:

| role | what the panel says | what the picture prompt does with it |
|---|---|---|
| `light` | *your ordinary subtitle words, and usually the frame round a picture* | **also carries the subject of every generated picture** |
| `accent` | *the words you emphasise* | **also carries the subject of every generated picture** |
| `primary` | the shadow behind every word, **and depth in the generated pictures** | matches |
| `background` | behind a cut-out picture, **and the ground the generated pictures are lit against** | matches |

Two captions mention the generated pictures and two do not, while all four
colours are in the prompt. Nothing was changed — this is an answer, not a fix.

**What else in a client's identity does not reach the pictures**, and might
reasonably be expected to:

- **The fonts and the text colours** — the built comp only. A generated picture
  carries no type, by design: the negative prompt forbids text outright.
- **The logo** — shown on the client's card in the panel and nowhere else. It
  reaches no build and no prompt.
- **The watermark** — one fixed asset in `assets/`, the same for every client.
  It is not part of a client's identity at all.
- **The client's own photographs** — offered in the panel's picker as an
  alternative to a generated picture. They do not influence what is generated.
- **The vocabulary** — reaches the keyword prompt and the cut-out's text check,
  never the image prompt. That is deliberate and documented: keying slots on it
  would re-run every reel when Block 9 fills it in.
- **`about`** — the panel's own catalogue only.

### D — what stops this happening on the next reel

**No number is fitted to a reel.** The handover is the next picture's start; the
size is the corner over the picture's own life; the last picture ends with its
own words. Nothing here would differ if `sora` had never existed.

- **`picture-life.test.ts`, eight cases** over synthetic shapes: two pictures far
  apart, back to back, one picture only, a picture at the very end of a reel, a
  span that would be shortened, shuffled input, an empty reel. Arithmetic only —
  no disk, no model, no socket.
- **`reel-shape.test.ts`** holds the geometry half: a picture sized over its
  words and held past them **is asserted to be over the speaker**, the same
  picture sized over its whole life is asserted clear, and a three-slot moving
  reel comes out at 690/870/1180 px with every one clear.
- **`new-video.test.ts` drives three videos of different shapes** — one picture,
  pictures far apart, pictures running into each other — and asserts on each
  that no picture leaves before the next arrives, that the last ends with its
  own words, that a picture held past the template holds its last frame, that
  nothing is stretched, and that A and C agree.

**How the assertions were verified to actually fire**, rather than assumed:
`pictureLives` was mutated back to the retired rule and the suite re-run. **Both
multi-picture videos failed on exactly the handover assertion**; the
single-picture video passed, which is correct — a reel with one picture has no
handover, and its other four assertions still fire there. The mutation was then
reverted and the file confirmed clean. Each shape also declares the minimum
number of pictures it must reach the builder with, which is what caught two of
these three passing vacuously last session.

**Where each rule breaks:**

1. **The handover on a sparse reel.** `test-1`: 6.78 s of motionless picture.
   Measured, stated, and not capped, because any cap would be a fitted number.
2. **A picture outlives its sentence** by up to 7.18 s. It is still illustrating
   words that finished long ago.
3. **Every picture is a little smaller** — the price of keeping a held picture
   off the speaker, and not optional.
4. **The first 0.099 s of a reel has no picture**, and nothing here changes it.
5. **The start-on-meaning rule is not implemented at all**, so every picture
   still begins where its sentence begins.

### E — the gates

**`npm run golden`: 27 fields differed, and every one was an image layer's
`outPoint`, `position` or `scale`.**

| reel | layers | what moved |
|---|---|---|
| test-1 | `img001`, `img002`, `img003` | out point, and scale 78.07 → 77.07 / 77.07 → 76.40 / 76.40 → 76.73 |
| vitasilk | `img001`, `img002`, `img003`, `img004` | out point on all four; scale on `img001` 78.07 → 73.73 and `img002` 69.73 → 66.40 |

**Nothing else moved.** No text, no font, no count, no card geometry, no
watermark, and no layer that is not an image. `test-2` and `test-3`, which have
no image slots, matched **field for field, 4280 and 3709**. The three layers on
`test-1` and four on `vitasilk` are exactly the ones the measurement predicts;
the slots whose size did not change show only an out point, and the last picture
in each reel is absent from the diff entirely because neither its out point nor
its size moves. The reference was then re-recorded (`2fb67fe6c4cb239c`) and a
verify run passed **4 of 4, 17,174 fields, field for field**.

**`sora` was rebuilt** at `.local/build/sora-995f2d27-full.aep` — 112 layers,
eleven pictures at 669–1073 px, every out point equal to the next picture's in
point to the exact frame, `stretch = 100` throughout.

**`npm run check`: PASS, exit 0.** Per workspace, from its own output:

| workspace | files | tests |
|---|---|---|
| core | 51 passed (51) | **756 passed** |
| service | 97 passed (97) | **1243 passed** |
| benchmarks | 17 passed (17) | **173 passed** |
| panel | 11 passed (11) | **213 passed**, 2 skipped, **0 failed** |

And the gates after the tests, which `check.sh` only reaches when they pass:
modes ok, templates 6 entries ok, ExtendScript 15 files ok, CLAUDE.md 9,935 of
20,000, `validate-templates` 6 templates ok against the audited `library.aep`,
panel manifest ok, references PASS, both sidecar models ok, `check: PASS`.

**It was run twice and failed the first time**, on lint rather than on a test:
removing the dissolve left an unused `pictureLives` import in
`new-video.test.ts`. `check.sh` stops at the first failing step, so **the tests
did not run at all in that pass** — the panel's flaky image-picker tests
therefore have exactly one result this session, and it is the green one above.
Sessions 38 and 39 saw them fail four times and once, unchanged, so a single
pass is not evidence they are fixed.

**`sora.mov`, its eleven candidates and every cache entry are untouched** —
cache 71 entries / 128 files / 106 MB at both ends, `sora.mov` `344265a0…` at
both ends, ledger **144 lines / `d886596…`, $0.00 spent.**

## Deviations

**Ruling 2 was measured and not built**, under §2.3's own instruction to say so
and stop rather than invent a signal. The measurement, the four things checked,
and the one-field change that would fix it are in *Done → B*.

**A scratch client was written into `modes/` and deleted.** The colour proof had
to go through the real `loadMode`, which reads `modes/<id>.json` and requires the
id to equal the filename stem, so a file briefly existed at
`modes/zz-scratch-colour-probe.json`. It was never committed and `modes/` holds
only `k2-syndicalia.json` again.

**One of the two deleted comparison files came back, and it was left alone.**
`sora-continuous-cut.aep` and `sora-continuous-dissolve.aep` were both deleted
as instructed, and a listing straight afterwards confirmed neither existed.
`sora-continuous-dissolve.aep` was then **written again at 15:57 by After
Effects**, not by anything this session ran — its auto-save fired at 15:52 under
`.local/build/Adobe After Effects Auto-Save/`, so the project was open in the
application while the file was missing underneath it. After Effects currently
has `vitasilk-full.aep` open, which is golden's last build, so the dissolve is
not open now. **It was not deleted a second time.** Something outside this
session produced it, it is in gitignored `.local/`, and removing a file an
application has just written without knowing who asked for it is not a call to
make silently. The cut file did not come back.

**`pictureLives` was deliberately broken for one test run** to prove the new
assertions fail when the rule does, then restored from a copy taken before the
edit. The working tree was confirmed to carry no trace of it.

## Failures & open problems

1. **The start-on-meaning ruling is not implemented.** Every picture still
   begins at the first word of its span, including `sora`'s first.
2. **`test-1` holds one picture motionless for 6.78 s**, which looks like a
   fault rather than a choice. The cause is that the reel has four pictures where
   its length would take six; the answer is probably more pictures, not a cap.
3. **A colour edit cannot reach an existing reel from the panel**, and cannot be
   made from the panel at all once a client exists.
4. **The panel's captions for `light` and `accent` do not mention that both
   colours carry the subject of every generated picture**, while the captions
   for the other two do mention their picture role.
5. **The picture path is still exercised by two golden reels of four.**
   `test-2` and `test-3` have no image slots, which is why all 27 differing
   fields came from the other two, and `sora` is not in golden at all.
6. The opening bar remains unbuilt, for session 38's measured reason.

## Repo state

Branch `main`. Ledger **144 lines / `d88659660ca3fa37…`** at both ends, $0.00
spent. `templates/library.aep` `4b0cf05a8f5d4775…` at both ends, never opened
for writing. One After Effects instance throughout, and **no
`AeDriveError` occurred this session** — every build and census answered first
time. No project of the user's own was saved.

`benchmarks/references/golden/census.json` moved from `470a44b4c235a175…` to
**`2fb67fe6c4cb239c…`**, deliberately, for the 27 image-timing and image-size
fields listed above.

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
moved from `fcc7dfd8f1ac595f…` to `84f749f75dc714d9…`, which is the rebuild
recording itself on the plan and nothing else. The five corpus plans are
byte-identical. Free space went from 255 GB to **232 GB**, which is golden's
four rebuilt `.aep` files. `modes/` holds only `k2-syndicalia.json`.

## Suggested next step

Authorise the one extra field on the slot response — `nameWordId`, optional with
a default — and the sentence in the prompt that asks for it. It is the only
honest way to start a picture where its meaning starts, it fixes nineteen
pictures across four reels rather than one, and it costs a single model call per
reel to validate.

---

**The one file, and the one moment**

`.local/build/sora-995f2d27-full.aep` — look at **0.0 to 4.3 seconds**. The
doctor picture now appears on "hello" and stays for 4.24 s, all the way to the
next picture. That is both rulings in one shot: the handover working as he asked,
and the picture still starting one sentence too early.
