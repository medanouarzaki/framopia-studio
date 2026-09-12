Status: OK

# Block 12, session 91 — a reel must never stall needing a step nobody can run

## 1. Why the face-mask step did not run

**Nothing failed. Nothing was skipped by a decision. The stage had no caller.**

"Looking at the video" is the `zones` stage: it samples frames, segments the
speaker, and writes the zones a picture may sit in. `runPipeline` reaches it only
if the run asked for it — `if (!asked('zones')) return { skipped: true, reason:
'not part of this run' }`.

Two controls can ask. Until session 54 there was one button, *Run pipeline*,
which asked for every stage. Session 54 replaced it with the two jobs Mohamed
names, and their stage lists were:

- **Make the subtitles** → `WORDS_STAGE_IDS` = `['transcription', 'analysis']`
- **Make the pictures** → `['images']`, hard-coded in `App.tsx`

`zones` is in neither. **From session 54 it had no caller at all**, and the
comment in `pipeline-stages.ts` saying it is "deliberately out" of the words was
the only place the decision was written down — for the words, correctly, and
nobody carried the question to the pictures.

Nothing noticed for five weeks because **every reel since was run whole by a
session driving `runPipeline` directly**: session 84 ran `sora-1` through four
attempts including `zones`, session 89 ran `sora-2`, and their reports show
`zones | done | $0` in the stage table. `sora-3` is the first reel made
**entirely through the panel's own two buttons**, and it is the first to stall.

| reel | `pipeline.zones.status` | zones on plan | build |
|---|---|---|---|
| `sora-1` | done | 8 | built |
| `sora-2` | done | 30 | built |
| `sora` | done | 28 | built |
| **`sora-3`** | **pending** | **0** | **none** |

`.local/cv/` had no directory for `sora-3`'s hash (`7a2abf01895d`) at all — the
stage had produced nothing, not produced something wrong.

### Session 84's open defect is not what happened here

That defect is *a stage that threw is still marked `done`*. `sora-3`'s `zones`
stage is **`pending`**, with `completedAt: null` and `error: null`. It never ran,
so it never threw, so nothing mismarked it. The three stages that did run are
`done` with real costs and timestamps. **This is a different fault**, and it is
worse in one way: a throw at least leaves a trace.

### What the panel showed, and whether he could have known

It showed `Looking at the video — skipped, not part of this run`, which is the
literal truth and reads as reassurance. The stage list also carried *"Looking at
the video is done on this machine and costs nothing"*, which says it is free and
does not say it is not going to happen.

**No, he could not have known it mattered.** Nothing distinguished that line from
the two above it, which say `skipped` because the work was already done. The
refusal arrived after the money.

## 2. What stops a paid reel reaching that state again

`PICTURES_STAGE_IDS = ['images', 'zones']`, named once in the service, sent to
the panel as `picturesStages`, and asked for by the button. **A run that buys
pictures now ends with a reel that can be built.** It rides with the pictures
rather than the words for the reason it was left out of the words: it is free but
takes about half a minute, and nothing about reading a transcript needs it.

`redo` stays `['images']`. Redoing the look at the video would re-measure every
frame for nothing.

The failure half was already right and is now asserted: the stage runner marks a
throwing stage `failed`, records the cause, and rethrows, so the run stops rather
than reporting `done`.

**Proved by mutation** — `PICTURES_STAGE_IDS` put back to `['images']`:

```
   × the stages the pictures button asks for > includes the look at the video, so a paid reel ends buildable
     → expected [ 'images' ] to include 'zones'
```

and deleting the whole leftover pass is not the only thing that bites — with the
stage restored to failing:

```
   ✓ stops the run and names the cause when the look at the video fails
   ✓ does not report that stage as done when it failed
```

Restored, 30 of 30 green.

## 3. The terminal message

**Where it lived:** `service/src/build/requirements.ts`, the `face-masks`
requirement. It was not a sixth message; there were **eleven** once the scan
could see them, across six files.

It also named a control that **had not existed since session 54**: *"press Run
pipeline for this video"*. Both halves of the sentence were unusable — a button
that was gone, then a terminal.

**Why the rule did not catch it — two reasons, both fixed:**

1. `panelSources()` read `panel/src` and one file of `core`. The sentence was in
   the service. Every build requirement and every stage error is rendered
   verbatim by the panel, so being written in the service does not make it less
   of a thing on his screen.
2. **The one test that did read `requirements.ts` protected the sentence.** It
   asserted that a `command:` naming `npm run` must *also* match `press Run
   pipeline|from a terminal|migrate:templates-sfx`. It was written to put the
   in-panel action first, and what it did was make *"from a terminal"* a way to
   pass. The only file the rule looked at was the only file where the forbidden
   words were blessed.

**The scan now covers the whole product**: every non-`*-cli.ts`, non-test file
under `service/src`, as well as `panel/src` and `core/src/build-stamp.ts`. A
`*-cli.ts` is a terminal program and its `usage:` line may say what to type. It
reads **string literals only** — reading raw source made `const terminal =` in
`pipeline.ts` an offender, and a rule that cries wolf on an identifier collects
exemptions until it means nothing.

Eleven messages reworded. Two commands stay, named as what they are: **`tools/cv/setup.sh`**
installs Python, its packages and a segmentation model, and **`npm run
service:build`** compiles the service's own code, which is missing when that
sentence fires. Neither is work a button is wired to today — the same shape as
`host.ts`. Both are listed as open below rather than treated as settled: the
service can run `setup.sh`, and a running service can rebuild itself.

**Proved biting** — the old sentence put back:

```
   × no message sends the user out of the panel > names no application to quit, restart or reopen, and no command to type
     → expected [ …(2) ] to deeply equal []
+   "service/src/build/requirements.ts: \"npm run\"",
+   "service/src/build/requirements.ts: \"terminal\"",
   × no message sends the user out of the panel > tells every build requirement what to press, not what to type
     → expected '\'node:fs\'\n\'node:path\'\n\'@framop…' not to match /npm run|terminal/i
```

Restored, both green.

## 4. "8 cards are too short to hold"

**It is not a problem, and the count was wrong twice over.**

I measure **7**, not 8, on the plan as it stands. All 7 are subtitle groups:
13, 30, 40, 68, 70, 72 and 84. Each is a card whose window is shorter than its
template's entrance plus minimum hold — group 13 is 0.03 s against the 0.12 s
`sub_pop_ar` needs, the largest shortfall 0.10 s and the smallest 0.02 s.

**The build already handles them.** A card too short for the standard entrance
gets a faster one — Block 7 session 9's ruling that **dropping a word is worse
than animating it faster** — by layer time stretch, which leaves the template
untouched. The build of `sora-3` says so in its own output: `short-card
entrances: 34 shortened, 7 on the two-frame floor`. **Seven on the floor is
exactly these seven.** Every word is on screen and all 90 cards are built.

The panel also called *every* buildability issue "too short to hold", including
`no templateId assigned`, which is not about length at all.

Now the service says what they are, because only it knows whether they are all
about length:

> 7 cards are shorter than their animation, so it plays faster on those. Every
> word is still shown and the composition is built — nothing here needs fixing.

**Does it recur on long reels? It recurs, but not with length.**

| reel | length | groups | issues | rate |
|---|---|---|---|---|
| `sora-1` | 10.2 s | 27 | 0 | 0% |
| `sora-6a` | 13.5 s | 27 | 2 | 7.4% |
| `sora-2` | 23.3 s | 74 | 6 | 8.1% |
| `sora-3` | 27.7 s | 90 | 7 | 7.8% |
| `sora` | **40.5 s** | 93 | **1** | **1.1%** |

The longest reel has one. It tracks **how she speaks** — the short words are
single Arabic letters, `ف` and `د`, two of them with a duration of exactly zero
— not how long she speaks for. And `sora-2` had six of these, was built, and he
watched it and liked it.

## 5. The build of `sora-3`

Run through the panel's own route: the same `runPipeline` call the pictures
button makes, `only: ['images','zones'], redo: ['images']`. **Mohamed's own
service (pid 40282) was left running and untouched** — it predates these changes,
so driving the code in process is the only way to exercise them.

| stage | outcome | cost |
|---|---|---|
| transcription | skipped — not part of this run | $0 |
| analysis | skipped — not part of this run | $0 |
| images | done — **cached**, 14 of 14 candidates on disk | **$0.0000** |
| zones | done — 57 frames sampled and segmented, 27 zones | **$0.0000** |
| build | done in 2.8 s | $0 |

Quoted at `$0.0000` before it ran, on every stage, and `spentUsd $0.000000`
after. **Nothing billed.**

**What was made:** 84 subtitle cards, 4 emphasised keywords, 7 images, 7 sfx
events — 88 cards laid out, 85 on one line at full size, 2 broken onto two, 1
shrunk to x0.8527, widest line 1940.00 px against a 1940 px limit. Fonts Inter
Semi-Bold and Almarai Bold.

**Which client's colours: Dr Loubna Kfafi's own** — `#123448` primary, `#E8873A`
accent, `#FFF4E8` light, `#1C1210` background. Not K2's red. The build says
`client: using Dr Loubna Kfafi as it was saved for this video`.

**Every picture came from the model.** None was answered from her own store —
`sora-3` names nothing that matches a label on her 15 photographs.

| starts | holds | picture |
|---|---|---|
| 0.42 s | 6.96 s | A bright shining sun in a clear summer sky |
| 7.38 s | 1.36 s | A close-up of a mesotherapy micro-needle |
| 8.74 s | 6.48 s | A glowing vial of cosmetic vitamin serum |
| 15.22 s | 3.52 s | A person undergoing a facial chemical peel |
| 18.74 s | 3.02 s | The number 20 on a calendar page |
| 21.76 s | 2.26 s | A glowing, golden piece of natural amber |
| 24.02 s | 3.64 s | A radiant, bright face showing an even tone |

The reel opens with 0.42 s of no picture and the **longest stretch with no new
picture is 6.96 s, 25% of a 27.66 s reel** — the first picture's own hold.

### Every picture is clear of her face

This is the first reel where it was genuinely at risk, and the check is the
build's own words, not mine:

```
every picture is as large as its own corner allows: 985 to 1013px
img001: 985px in the top-left corner, bounded by the space above the speaker
… img007: 1013px in the top-left corner, bounded by the space above the speaker
```

All seven are **bounded by the space above the speaker** — measured from the
masks, across every frame of each picture's life — and land between 985 px and
1013 px on a 2160 px frame. The refusal's own warning was a **2030 px** picture
across her; the largest here is **half that**. Each is smaller than the 1.4x it
asked for, which the corner cannot hold, and the build says so rather than
silently shrinking.

## 6. What I think of it, before he looks

The reel is sound and I would not hold it back, but two things are worth his eye.

**The opening picture holds 6.96 s** — a quarter of the reel on one sun — and
the third holds 6.48 s. That is the same shape he objected to on `sora-2` last
session, arriving from a different direction: the spread put one picture in each
stretch, and where a stretch's strongest candidate sits at its far end the two
winners end up far apart. It is well short of `sora-2`'s original 13.30 s, and
the reel never goes dark after 0.42 s, but a 27-second reel with seven pictures
should not rest that long on its first.

**Only 4 of 7 pictures arrive at the word they are about** — the build says so.
The other three are placed at their span rather than their naming word. On
`sora-2` that was the whole of session 89's work.

And `A bright shining sun in a clear summer sky` for الصيف والشمس is
literal-minded. It is what the prompt asks for and it is not wrong; whether it is
what he wants at the top of a hair-loss reel is his call, not mine.

## 7. The `.aep`

```
open "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/build/sora-3-e3b602f8-full.aep"
```

## 8. The stranger test catching it

Added to `a-stranger.test.ts`, which spends nothing. The stranger cannot run the
real look at the video — it is a flat colour with no face in it and the sidecar
would have nothing to segment — so it asserts the two halves that need no
sidecar: that the buttons between them ask for **every stage a build depends
on**, and that a stage which fails is **named**.

**Red, with today's behaviour restored:**

```
   × what the stranger has after a run > has had every stage asked for by the two buttons between them
     → expected [ 'zones' ] to deeply equal []
```

It names the missing stage. Restored: 14 of 14 green.

## 9. Gates

`npm run check`, **run alone, after committing: exit 0.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | 1521 | 0 | 1521 |
| benchmarks | 173 | 0 | 173 |
| panel | 285 | 2 | 287 |
| pytest (CV sidecar) | 149 | 0 | 149 |

Measured this session, not carried. Session 90 measured core 847 and service
1509+; core is **846** now and service **1521**.

**Arithmetic by name.** Seven tests added, one removed — a rename:

| file | test |
|---|---|
| `pipeline.test.ts` | includes the look at the video, so a paid reel ends buildable |
| `pipeline.test.ts` | is what the dry run hands the panel, not a copy the panel keeps |
| `pipeline.test.ts` | stops the run and names the cause when the look at the video fails |
| `pipeline.test.ts` | does not report that stage as done when it failed |
| `a-stranger.test.ts` | has had every stage asked for by the two buttons between them |
| `a-stranger.test.ts` | is told which stage failed when one does, rather than reaching the end |
| `leave-the-panel.test.ts` | tells every build requirement what to press, not what to type |

The last replaces `puts the in-panel action first in every build requirement that
has one`, which is the test that blessed the terminal sentence. Service +6:
1515 → 1521. Panel unchanged at 287, the rename being one-for-one.

`npm run golden`: **PASS, 4 of 4 reels matched, field for field.** 4415 + 4280 +
3709 + 4770 = **17,174** fields. Nothing to reconcile.

**The gate failed twice before it passed**, both times on a test asserting
behaviour this session retired, both rewritten rather than worked around:
`money.test.ts` read `basis` as two values where there are three, and
`render.browser.test.ts` asserted the pictures button posts `only: ['images']`.
Four more were rewritten before that — two pinning the terminal sentences, one
pinning `npm run zones`, and one heuristic in `pictures.test.ts` that called
`frames/sample.ts` a photograph copier because the file now contains the word
"pictures" eighteen lines from a `copyFileSync`. That last was a weak rule
finding a false positive, and it is tightened rather than exempted.

**Panel suite, five times: exit 0, 0, 0, 0, 0.**

### Part 0, at both ends

| measurement | at start | at end |
|---|---|---|
| ledger records | 241 | **241** |
| ledger sha256 | `a394ea27…96a4a1a6` | **`a394ea27…96a4a1a6`** |
| `templates/library.aep` | `4b0cf05a…eca6c22aba` | **unchanged** |
| `modes/dr-loubna-kfafi.json` | `97ece86d…4b9663fc`, 2026-09-11T01:19:45 | unchanged |
| `modes/k2-syndicalia.json` | `572e99bf…452669f`, 2026-09-09T21:58:19 | unchanged |
| `.local/` directories | 16 | 16 |
| `assets/client-pictures/` | 15 files, 26M | 15 files, 26M |
| CEP extensions | `com.framopia.studio` | `com.framopia.studio` |
| listening services | 1 (pid 40282, two sockets) | same, **never stopped** |
| After Effects instances | 1 (pid 39825) | 1 (pid 39825), never launched or quit |
| `aerender` processes | 0 | 0 |
| `origin/main..main` after fetch | 0 | 0 after push |

The opening AE count needs a correction: `ps aux | grep -c` returned 11 and
`aerender` 2, both artefacts of matching helper processes and full command lines.
Counted properly there is **one** After Effects and **no** `aerender`, and that
is what the table says.

Working tree was clean at the start — the `handoffs/block-10.md` rename the brief
expected is already committed.

## 10. Every ledger line added

**None.** 241 records at both ends, sha256 `a394ea273c65c7022b92c40b2cc7f9c765c0d1276f2f050552018a0296a4a1a6`
unchanged. `sora-3`'s $2.564802 was spent before this session began and is
confirmed to the cent by the money view.

## What is open

- **Two commands still name a terminal**, as things no panel can do today:
  `tools/cv/setup.sh` and `npm run service:build`. Both are achievable — the
  service can run the installer, and a running service can rebuild itself — and
  both are exemptions only until someone does that work.
- **`known-templates` has no in-panel route.** Its message now says what is
  wrong rather than what to type, but a plan made before a template existed
  still needs a migration nobody can press.
- **`npm run analyse` defaults to the wrong client** (session 90) — unchanged.
- **The opening picture of `sora-3` holds 6.96 s**, and only 4 of 7 pictures
  arrive at the word they name (section 6).
- Everything carried from session 90 that this session did not touch.
