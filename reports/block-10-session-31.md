Status: OK

# Block 10 session 31 — read the words before paying for the pictures

**Spent $0.00. No API was called and nothing was run — on `sora.mov` or on
anything else.** Ledger **118 lines, `3f657131…`, byte-identical at both ends**.
`templates/library.aep` `d2bbb6b7…`. The six hand-made references
byte-identical. Cache unchanged at 46 entries / 80 files / 54,256 KB.
**`sora.mov` is byte-identical — `344265a0…` at both ends — and nothing was
written beside it.** After Effects one instance, 0 `aerender`. Free space
**276 GiB**.

**`npm run check` PASS; `npm run golden` PASS, 4 of 4 reels, 17,174 fields.**

---

## What he can now do

**Under Run pipeline there is a second control: *Just the words — about
$0.35*.** It runs the transcript, the keywords and the picture ideas and stops.
When it finishes, the same place reads *Make the pictures — about $3.98*, and
pressing it does not pay for the words again. On his own reel `sora.mov` that
turns a single $4.33 decision into a $0.35 one he can look at and a $3.98 one he
can take afterwards.

**And the transcript screen opens on something a person can read** — the words
in the order they were spoken, broken into lines where he paused, with the time
each line starts. It was a list of one word a row with an id and a confidence
band beside it, which is what editing needs and is not reading; a 41-second reel
is roughly 340 of those rows. The editor is still there, behind an **Edit**
toggle.

That matters this week and not in general: session 29 reversed the orthography
rules so Arabic is written in Arabic letters, **no transcript has ever been
produced under them**, and the four hand-written references are in the old Latin
style and cannot score one. His eye is the only judge there is, and until now
looking cost $4.33.

---

## Done

### 1. What the run already knew how to do

**The stages, in order**, from `pipeline-stages.ts` — the one declaration the
runner and the dry run both read:

| stage | on screen | bills |
|---|---|---|
| `transcription` | Transcribe and correct | yes |
| `analysis` | Keywords and image slots | yes |
| `images` | Generate images | yes |
| `zones` | Looking at the video | no |

**The runner already had the control.** `runPipeline` takes `only` (run these,
skip the rest with the reason *not part of this run*) and `redo` (run this again
even though the plan records it done), and `POST /jobs {type:"pipeline"}` has
always forwarded both — `service/src/pipeline.ts:549-556`. Session 6 used
`only: ['analysis']` and session 8 used `only: ['images'], redo: ['images']`.

**The panel exposed none of it.** `startPipeline` sent `{ reel, mode }` and
nothing else, and Run pipeline was the only control. So the whole of this
session's service-side work was passing two fields that already existed.

**The known trap is real, it is still open, and it is directly in the way.**
`service/src/analysis/job.ts:425` — the **slot** stage writes
`plan.pipeline.images.status = 'done'` when it plans the slots, so a plan can
hold slots, zero candidates and a done image stage at once. That is exactly what
a words-only run leaves behind. Two consequences, both measured:

- **`only: ['images']` alone would skip**, so the *Make the pictures* button
  sends `redo: ['images']` too. It is deliberate and said in the code and in the
  test, not worked around silently. Every candidate already on disk comes back
  from the cache, so redoing the stage re-bills nothing that exists.
- **The cost screen was already wrong because of it.** `ground-truth` — which
  has had exactly a words run since session 6 — read **`$0.00` total** while
  owing $2.17 of pictures, its own note saying *"0 of 12 candidate images are
  cached; a run would generate 12, budgeted at most $2.17"* and *"Already on the
  plan, so a run skips it"* **in one sentence**.

**What he sees after each stage.** The Words, Emphasis and Pictures screens are
reached from *Change something first* on the main screen, and their availability
comes from the plan. Measured on `ground-truth`, the reel that is in the
words-done state: `transcript`, `keywords` and `images` are all **open**. So the
screens were reachable; the transcript one was a list of rows.

### 2. The control

**`WORDS_STAGE_IDS` in `pipeline-stages.ts`** is the one declaration of what
"the words" means — `transcription` and `analysis`. The picture **ideas** are in
it because they are text and cost about a fiftieth of the pictures, and Block 3
session 6 proved that split at that price: eighteen cents showed two faults that
would otherwise have cost $2.35 to find. **`zones` is deliberately out** — free,
but half a minute a reel, and nothing about the words needs it.

**The figures come from the service, not the panel.** `DryRunPlan` gains
`wordsUsd`, `picturesUsd` and `wordsStages`, all computed from the same stage
list, so the panel asks for exactly the stages the service named rather than
holding its own copy. All three are **optional with a default** on the panel
side: a service older than this panel sends none of them and the second control
is simply not rendered, because a guessed figure is a claim about money.

**The dry run's reading of the image stage is corrected**, and this is the one
change that touches the trap. A stage that has produced no candidate has not
been done, whatever `pipeline.images` records. **The double-write itself is
untouched** — that is a change to what the slot stage *writes*, and it is
reported here rather than made.

| reel | images stage before | after |
|---|---|---|
| `ground-truth` (words done, no pictures) | skip, **$0.00** | **run, $2.17** |
| `test-3` (nothing analysed) | run, $2.17 | unchanged |
| `vitasilk` (fully illustrated) | skip, $0.00 | unchanged |

Pinned by a test that **fails against the old reading** — proven by deleting the
override, which turns the image stage back to `skip` and the test red.

**The split, measured on real reels:**

| reel | words | pictures | total |
|---|---:|---:|---:|
| `sora` (41 s, nothing done) | **$0.35** | **$3.98** | $4.33 |
| `test-3` | $0.18 | $2.17 | $2.35 |
| `ground-truth` | $0.00 | $2.17 | $2.17 |
| `vitasilk` | $0.00 | $0.00 | $0.00 |

**Continuing does not re-bill the words, and it was measured rather than
argued.** After a words run the plan records transcription and analysis `done`,
so the runner skips both — and `only: ['images']` never reaches them in any
case. `ground-truth` is the proof: its dry run reads `wordsUsd $0.00`,
transcription `skip`, analysis `skip`. The transcription cache key covers the
prompt version, the Gemini model, **the orthography guide version**, the Scribe
model and the keyterms; session 29 measured that all five corpus reels answer
`compatible` under guide v2.0.0 and reuse their entry without billing, and that
is still what they answer.

**It works for a browsed video and a corpus reel alike** — driven on both:
`sora`, opened through Browse and outside the repository, and `ground-truth`
from the corpus catalogue.

### 3. Reading the words

**`core/src/read-lines.ts`** groups the words into lines and says which way each
runs. It is in core rather than the panel so it is unit-tested, and imported
through the `@framopia/core/read-lines` subpath the way `palette-meaning` and
`saved-output` already are.

**`READ_LINE_GAP_S = 0.2` is measured, not chosen.** Across the 343 words of the
five corpus reels the gap between consecutive words is 0.059 s at the median,
0.181 s at the 95th percentile, and the largest anywhere is 0.381 s. At 0.20 s
the corpus breaks 15 times and reads at about **17 words a line**; at 0.30 s it
breaks 3 times and runs to 43 words a line, which is a wall again.

**The line carries a direction and each word carries its own.** The editor's
rule — direction per token, never on a container — is right for a row that is one
word beside its id and its buttons, where a container direction would reorder
the columns; a browser test still pins that the editor's list and rows carry no
`dir`. **A line of prose is a different thing**: a wholly Arabic line rendered
left to right puts the last word first, and **no transcript in this project has
ever been wholly Arabic**. So a line whose words are mostly Arabic runs
right-to-left, each word keeps its own direction inside it, and the timecode is
pinned left because it is a label rather than part of the sentence. The
distinction is stated in the code at both places.

**Removed words are left out** — a filler the build will not draw is not part of
what he is reading.

**The keywords are already a screen** — Emphasis, reached the same way, showing
each keyword with its time, its script, its size and why it was chosen. It is
unchanged and it was checked working on `ground-truth`.

### 4. Seen working, against the real service

Not a fixture: the built panel bundle driven against a real service, with only
CEP's bridge stubbed and the job POST intercepted so **nothing started**.

**`sora.mov`, his own reel:**

- Cost: `Transcribe and correct — will run, about $0.17`, `Keywords and image
  slots — about $0.18`, `Generate images — about $3.98`, total **about $4.33**.
- Second control: **“Just the words — about $0.35”**, with *"The subtitles, the
  words to emphasise and the ideas for the pictures. Read them, then make the
  pictures — about $3.98 — without paying for the words again."*
- Pressing it posts `{ only: ['transcription','analysis'] }` and **no `redo`**.
- 0 uncaught page errors.

**`ground-truth`, the reel already in the words-done state:**

- Cost now reads **$2.17** where it read $0.00 before this session.
- Second control: **“Make the pictures — about $2.17”**, posting
  `{ only: ['images'], redo: ['images'] }`.
- Words screen: **4 lines** with times — `0:00 3ndk les cernes pigmentés tb3i
  m3aya tal lkher dial la vidéo Alors…`, `0:11 tal 20`, `0:12 yom wl'effet`,
  `0:12 dialha kidom lmoddat sana…`. All `ltr`, correctly: that reel is old
  Arabizi.
- Emphasis screen: its 3 keywords with their times and reasons.
- 0 uncaught page errors.

### 5. The ceiling, reported and not decided

`PIPELINE_CEILING_USD` is **$4.00** and `sora.mov` budgets at **$4.33**, so a
full run stops before the pictures. **Running the words alone is $0.35 —
$3.65 under the ceiling**, with room to spare by a factor of eleven.

Why the reel is dense: `IMAGE_SLOTS_PER_30S` is 8, so a 40.5-second reel plans
**11 slots** where the 21–26 second corpus reels plan 6. At 2 candidates a slot
and a budgeted $0.1809 an image:

| slots | images | pictures | words + pictures | spacing | per 30 s | against the $4.00 ceiling |
|---:|---:|---:|---:|---:|---:|---|
| **11** (today) | 22 | **$3.98** | **$4.33** | 3.7 s | 8.1 | **over** |
| 8 | 16 | $2.89 | $3.24 | 5.1 s | 5.9 | under |
| 6 | 12 | $2.17 | $2.52 | 6.8 s | 4.4 | under |
| 5 | 10 | $1.81 | $2.16 | 8.1 s | 3.7 | under |
| 4 | 8 | $1.45 | $1.80 | 10.1 s | 3.0 | under |

**Nothing was decided and no constant was changed.** He has only ever seen 6
pictures on a 22-second reel — one every 3.6 seconds — and whether 3.7 seconds
apart is right on a 41-second reel is his eye, not a number to raise quietly.
The two levers are the ceiling and the density, and they are different
questions: one is how much he is willing to spend on a reel, the other is how
the reel should look.

---

## Deviations

**The dry run's reading of the image stage was corrected**, which is adjacent to
the double-write the brief says not to fix. The write is untouched. Without the
correction the second control would have offered *Make the pictures — about
$0.00* on every reel that had had a words run, which is a wrong number about
money on the screen this session exists to build. It is reported at the code, in
a test, and above.

**The read-view CSS landed in the first of the two feature commits.** Both
commits touch `panel.css` and the styles were written before the first was made;
the code split between them is correct.

**Four browser tests that open the transcript editor now click Edit first.**
They are unchanged in what they assert — the editor behaves exactly as it did —
and only the screen's default view moved.

**No corpus plan, cache entry, mode file, template, generated image, hand-made
reference or ruled constant was touched**, and `PIPELINE_CEILING_USD` and
`IMAGE_SLOTS_PER_30S` are as they were.

## Failures & open problems

**Unproven, by name:**

- **Nothing has been transcribed under the new orthography**, so the thing this
  session was built to enable has not happened. Everything here is proven up to
  the first billable call and no further.
- **No wholly Arabic transcript has ever been rendered on this screen.** The
  right-to-left line was exercised against a fixture with two Arabic words out
  of three, and on real data (`ground-truth`) every line came out `ltr` because
  the corpus is old Arabizi. The first Arabic-first run is where the read view
  is actually judged.
- **The read view has not been seen inside After Effects.** It was driven in
  Playwright's Chromium with the host's file and cross-origin allowances; CEP
  itself was not used. Its font is whatever the panel inherits — no Arabic face
  is chosen for it, and macOS falls back to a system one.
- **`Make the pictures` has never actually generated a picture.** The POST was
  intercepted in every drive. That `redo: ['images']` reaches the runner is
  proven; that the runner then generates is reasoned from session 8's finding.
- **The line-break threshold is measured on the corpus and not on his speech.**
  A reel with real pauses in it will break differently, and 0.2 s may read badly
  there.

**Open, and untouched as the brief required:** the `pipeline.images` double-write
(Block 10 session 8); `preflight.ts` not checking a client picture's file; the
client photographs missing from the backup set; `.local/plans/` not being in the
backup set; the three false-premise tests; `build-reel.jsx`'s guard.

**The panel's image-picker tests flaked once**, failing 5 at once in the first
full `npm run check` and passing on a targeted re-run and on the second full
check. That is the flake sessions 24 and 25 recorded as failing when run alone
too; the cause is still unknown.

## Repo state

| | |
|---|---|
| branch | `main`, clean |
| HEAD | `d13d105` *feat: read the transcript as words, not as rows* (this report follows) |
| ledger | **118 lines**, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` — identical at both ends |
| `templates/library.aep` | `d2bbb6b727f819078b5e8dec08a59722b018dc6c0d1d77c123476f8241c84d9c` |
| cache | **46 entries / 80 files / 54,256 KB** at both ends |
| `.local/plans/` | **empty** at both ends — nothing was run |
| **`sora.mov`** | **`344265a032513979f101133e68622adf95f001844def480cbeaf3bd9b297bd85`, identical at both ends**; its folder holds the two files it held before |
| After Effects | one instance, 0 `aerender`; nothing saved |
| free space | **276 GiB** |
| credit remaining | **about $6.64**, unchanged |

**Hand-made references, sha256, identical at both ends:**

```
1fbbe2190d734db8a2d37581acc6368b37a98e99ec107d9df1fbaff35d22f22a  .local/ground-truth/ground-truth.txt
b59a6270c3f704bcbec1c139e9014e41b8896c477d75bdba13cd53305095ddd0  .local/ground-truth/test-1.txt
9ceea1c47ee94a8ca42f9f5d6f5e73db7be4558a6762a52c828b59232b36de12  .local/ground-truth/test-2.txt
b5413c215ff32fec27fd321d7de8b824eee840c8aa3e6cc26733c1520696dbf6  .local/ground-truth/test-3.txt
f32e12dcfad558994388866198fe9138c703c55eddb43a9951960359359c60b2  benchmarks/references/align/vitasilk.json
10a2e5c2971ed27f950459933d8559264918bd9507b28822c4af07144db830ee  benchmarks/references/align/vitasilk.rereview.json
```

**Corpus Edit Plans, sha256.** `ground truth` unchanged; the other four moved for
one reason only — `npm run golden` builds all four and each build writes a fresh
`builtAt`.

```
start                                                             end
0712e412…  ground truth   →  0712e412…  (unchanged)
2e2a7ae7…  test 1         →  fd051c79…  (golden's builtAt)
159e0db5…  test 2         →  0f43cc9a…  (golden's builtAt)
be8e3f40…  test 3         →  3135d4a7…  (golden's builtAt)
0cfce227…  vitasilk       →  ef69a2ea…  (golden's builtAt)
```

**`npm run check`: PASS** (exit 0), read from the run's own output:

| workspace / gate | before | after |
|---|---:|---:|
| core | 751 | **757** |
| service | 1211 | **1215** |
| benchmarks | 173 | 173 |
| panel | 207 + 2 skipped | **212 + 2 skipped** |
| pytest | 149 | 149 |
| claude-md | `8,790 of 20,000 characters` | unchanged |
| modes / templates / ExtendScript / panel manifest | unchanged | unchanged |
| references | `6 hand-made reference file(s)` · `PASS` | unchanged |
| attribution | `PASS` | `778 tracked text file(s), 747 commit message(s)` · `PASS` |

Core **+6**: `read-lines.test.ts`. Service **+4**: the two cost figures, the
stage set, and the corrected image reading. Panel **+5**: one for the read view
and four for the second control, including that it offers nothing against a
service that does not split the cost.

**`npm run golden`: PASS** — 4 of 4 reels matched, field for field: test-1 4415,
test-2 4280, test-3 3709, vitasilk 4770, **17,174 fields**. The reference was
**not re-recorded**.

## Suggested next step

**Press *Just the words* on `sora.mov` and read what comes back.** It is the
first speech this tool will have transcribed under the Arabic-first rules and
the first real client video it has ever been given, and $0.35 is the cheapest
question in this project. The two things to look for are the two most likely to
be wrong: whether Darija comes back as Darija in Arabic letters or is quietly
rewritten into Modern Standard Arabic, and what happens where an Arabic
proclitic meets a French word — `و l'effet`, `ديال les cernes`.

If the words are right, the picture density is the next decision and the table
in §5 is what it needs. If they are wrong, they are wrong for $0.35 rather than
$4.33, which is the whole point of this session.

---

## What to do, and what it costs

1. **Window → Extensions → Framopia Studio.**
2. Choose the client, then **Browse…** and pick `sora.mov`.
3. Under the red Run pipeline button, press **“Just the words — about $0.35”**.
4. When it finishes, open **Words** under *Change something first*. It opens on
   **Read**: the transcript in order, in lines, with the time each line starts.
   **Emphasis** beside it shows the words it chose to emphasise.

**It will cost about $0.35** — about $0.17 for the transcription and about $0.18
for the keywords and the picture ideas, both priced high on purpose. The
pictures are not touched and are not charged for.

**Afterwards**, the same place reads **“Make the pictures — about $3.98”**. That
one is over the $4.00 run ceiling on this reel, so §5's table is the decision to
take before pressing it.

## Commits

| | |
|---|---|
| `3de4c00` | `feat: run the words without paying for the pictures` |
| `d13d105` | `feat: read the transcript as words, not as rows` |
| this one | these reports |
