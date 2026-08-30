Status: OK

# Block 10 session 6 — eighteen cents for six ideas

**Spent $0.176484**, against a $0.18 projection and a $0.30 ceiling. Two ledger
lines. **Ledger 116 → 118 lines**, sha256 `e5e0a6e9…c132cb` →
**`3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c`**.

The image stage was **not** run and no image cache entry exists.
`templates/library.aep` unchanged. **All seven hand-made references unchanged.**
The other four Edit Plans unchanged. `app.fonts.allFonts` **1198 → 1198**.

**The build of `ground-truth` now refuses**, correctly, because it has six
planned pictures and no pictures. That is the expected consequence of buying
only the first half and it is set out in §3.

## 1. Done

### Preconditions (all ten pass)

| | measured at start |
|---|---|
| repo | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`, name `framopia-studio` |
| After Effects | **1** instance · `aerender` **0** |
| ledger | 116 lines, `e5e0a6e9d673…c132cb` |
| `templates/library.aep` | `1d7553e894e1…2dc4a5d8` |
| git | `main`, clean, HEAD `bcb6561` *docs: report block 10 session 5* |
| open project | `.local/build/test_3-full.aep` — inside `.local/build/`, clean |
| references | seven files, sha256 recorded, all identical at end |
| **`ground-truth`'s client** | **`clientMode` k2-syndicalia v12 and `clientSnapshot` v12 both present** |
| fonts | 1198 |

No API key was printed, logged or written anywhere.

### The spend, and how it was bounded

**The control is `only: ['analysis']`** on `runPipeline` — the runner's own
declared way to run one stage, which skips the rest with the reason *not part of
this run*. `PIPELINE_STAGES` puts keyword selection **and** slot planning inside
`analysis`; `images` is generation alone. So the authorised half is exactly one
stage and no workaround was needed.

| | |
|---|---|
| projection before the call | **$0.1800** (the dry run's analysis stage) |
| ceiling passed to the runner | **$0.30** (`ceilingUsd`, a running check against the ledger, baselined at run start) |
| **actual** | **$0.176484** |
| stages that ran | `analysis` only — transcription, images and zones all `skipped: not part of this run` |

**The two ledger lines, verbatim:**

```
{"stage":"analysis-keywords","model":"gemini-3.1-pro-preview","unit":"run","usd":0.111662,"timestamp":"2026-08-30T19:30:17.031Z"}
{"stage":"analysis-slots","model":"gemini-3.1-pro-preview","unit":"run","usd":0.064822,"timestamp":"2026-08-30T19:30:51.543Z"}
```

$0.111662 + $0.064822 = **$0.176484**. Run once; it did not fail and was not
retried. Wall clock 100 s.

**One limitation of the ceiling, stated because it is real.**
`assertWithinCeiling` runs *before* each request and compares ledger spend
against the baseline, so it aborts a run rather than truncating one — but it
cannot bound a **single** call. Between the keywords call and the slots call it
re-checked and found $0.111662, under $0.30, so the second proceeded. Had the
first billed $0.29 and the second $0.20, the total would have been $0.49 with no
refusal. The projection is what actually bounded this, not the ceiling.

## 2. The six ideas — the point of the session

`ground-truth` is a dermatologist explaining two treatments for pigmented dark
circles. Transcript, for judging what each window names:

> `3ndk les cernes pigmentés tb3i m3aya tal lkher dial la vidéo Alors 3ndi lik
> joj dial l7loul awal 7el houa الإبرة الحريرية li hia les polynucléotides li
> jaya mn l'ADN du saumon kat7taji joj dial l7essass mabin 7essa w7essa 15 tal
> 20 yom wl'effet dialha kidom lmoddat sana l7el ttani houa la mésothérapie li
> houa wa7d lcocktail dial lvitaminat wzayd 3lih الكافيين li kadiri 4 dial
> l7essass mabin 7essa w7essa 15 yom wki3tiw نتائج جد فعالة`

Every prompt shares the same four invariant style fragments and the same
negative prompt; both are quoted once at the end rather than six times.

---

### img001 — 0.359–1.279 s

**Words spoken:** `les cernes pigmentés`
**Idea:** `A face showing dark circles under the eyes.`
**Draw:** three-quarter turn · **close** · rim light

> `A face showing dark circles under the eyes.` *+ the four style fragments +*
> `seen at a three-quarter turn. close, the subject filling most of the height.
> rim light separating the subject from the ground.`

**The words name a concrete, depictable condition. The idea is literal and
matches.** It names it as she named it. **One subject** — a face.

---

### img002 — 3.659–4.219 s

**Words spoken:** `joj dial l7loul` — "two solutions"
**Idea:** `Two open doors side by side presenting a choice.`
**Draw:** straight on at eye level · **medium** · hard directional light

> `Two open doors side by side presenting a choice.` *+ style +* `seen straight
> on at eye level. medium, the subject from the waist. hard directional light
> with defined shadow.`

**The words name no depictable thing — a count of options. The idea is
atmospheric and matches**, which is the new rule working exactly as written.

**But it does not name one subject.** "Two open doors side by side" is two
objects. PROJECT_SPEC §5 requires a slot idea to depict one subject and
`checkSlotIdea` enforces it at plan time — it did not fire, and its marker list
is documented as enumerated and incomplete by construction. **Flagged.**

---

### img003 — 7.859–8.719 s

**Words spoken:** `l'ADN du saumon` — "salmon DNA"
**Idea:** `A swimming salmon fish.`
**Draw:** slightly below, looking up · **macro** · rim light

> `A swimming salmon fish.` *+ style +* `seen from slightly below, looking up.
> macro, a single detail standing for the whole. rim light separating the
> subject from the ground.`

**The words name a concrete thing and the idea is literal.** She said "salmon
DNA"; the idea depicts the salmon, which is the depictable half — DNA is not
recognisable at a glance and the rule's test is what a viewer recognises
fastest. **One subject.** Reasonable rather than exact.

---

### img004 — 11.039–12.460 s

**Words spoken:** `15 tal 20 yom` — "15 to 20 days"
**Idea:** `A calendar page with a block of days marked off.`
**Draw:** slightly above, looking down · **medium** · hard directional light

> `A calendar page with a block of days marked off.` *+ style +* `seen from
> slightly above, looking down. medium, the subject from the waist. hard
> directional light with defined shadow.`

**"A number of things" is on the rule's concrete list, and the idea is
literal.** **One subject** — a calendar page. The strongest of the six.

---

### img005 — 15.380–16.100 s

**Words spoken:** `la mésothérapie`
**Idea:** `A cosmetic microneedling tool.`
**Draw:** slightly below, looking up · **macro** · rim light

> `A cosmetic microneedling tool.` *+ style +* `seen from slightly below,
> looking up. macro, a single detail standing for the whole. rim light
> separating the subject from the ground.`

**The words name a concrete procedure and the idea took the literal case — but
it depicts the wrong procedure.** Mesotherapy is the injection of a vitamin
cocktail, which the transcript says outright two clauses later
(`wa7d lcocktail dial lvitaminat wzayd 3lih الكافيين`). **Microneedling is a
different treatment with a different instrument.** The rule says the idea should
name it as she named it, and this named something else. **One subject**, and the
only outright fidelity miss of the six.

---

### img006 — 19.379–20.180 s

**Words spoken:** `4 dial l7essass` — "4 sessions"
**Idea:** `Four medical appointment reminder cards.`
**Draw:** slightly above, looking down · **close** · hard directional light

> `Four medical appointment reminder cards.` *+ style +* `seen from slightly
> above, looking down. close, the subject filling most of the height. hard
> directional light with defined shadow.`

**A count, so concrete by the rule, and the idea is literal.** **But like img002
it names plural objects** — four cards is four subjects. Same concern, same
un-fired guard.

---

**The invariant half, identical on all six:**

> `a single clear idea, readable at a glance. one subject, centred and
> unobstructed. the brighter end of the palette leads: #C9A96E and #F8F6F2 carry
> the subject, with #820000 for depth and #1A0000 kept to the ground behind it.
> lit so the subject reads immediately at a glance, bright and clearly separated
> from its ground, not sunk into it.`

**The negative prompt, identical on all six:**

> `no extraneous objects, no background clutter, no incidental detail, nothing
> in frame that is not carrying the idea, no busy or competing composition, no
> watermark, no logo`

### The reading, summarised

| slot | words are | idea is | agrees | one subject |
|---|---|---|---|---|
| img001 | concrete | literal | **yes** | yes |
| img002 | abstract | atmospheric | **yes** | **no — two doors** |
| img003 | concrete | literal | yes (depicts the depictable half) | yes |
| img004 | concrete (a count) | literal | **yes** | yes |
| img005 | concrete | literal | **yes, but the wrong thing** | yes |
| img006 | concrete (a count) | literal | **yes** | **no — four cards** |

**The literal-versus-atmospheric rule works.** Five windows name something
concrete and got literal ideas; the one that names an abstraction got the only
atmospheric idea, and it is the one place a metaphor belongs. That is the change
being exercised for the first time in three blocks, and it did what it says.

**Two things are wrong and neither is that rule.** `img005` depicts
microneedling for mesotherapy — a factual substitution, and the sort of thing
`docs/DECISION-image-config.md` already records as the open fidelity defect
nothing measures. And **two of six ideas name plural objects**, which the
one-subject rule forbids and `checkSlotIdea` did not catch.

**One coverage note.** `الإبرة الحريرية` — the treatment she names first and
which became keyword `k001` — **got no image slot**, while the second treatment
did. Not wrong, but the reel's headline procedure is unillustrated.

### The keywords

Three, where `ground-truth` had none.

| id | text | at | script | kind | score | template |
|---|---|---|---|---|---|---|
| k003 | `cernes pigmentés` | 0.519–1.279 s | latin | **promise** | 0.90 | `kw_slam` |
| k001 | `الإبرة الحريرية` | 5.059–5.879 s | **arabic** | label | 0.95 | `kw_slam_ar` |
| k002 | `mésothérapie` | 15.479–16.100 s | latin | label | 0.95 | `kw_slam` |

Reasons, verbatim: *"Defines the core problem being targeted, implying the
visual result of eradicating them"*; *"Names the primary silken needle treatment
procedure being marketed"*; *"Identifies the second aesthetic procedure offered
as a solution"*. Two labels and one promise, which is the mix the selector
forces.

### Against session 5's preview

**The framing draws match exactly.** Session 5 predicted close, medium, macro,
medium, macro, close from the plan id alone, before any money moved:

| slot | predicted | actual |
|---|---|---|
| img001 | close | **close** |
| img002 | medium | **medium** |
| img003 | macro | **macro** |
| img004 | medium | **medium** |
| img005 | macro | **macro** |
| img006 | close | **close** |

Six of six. The determinism claim holds, **no slot drew `wide`**, and the
framing half of the two prompt changes is now confirmed on real output rather
than on arithmetic.

**The slot count is six**, which is what the $2.17 estimate assumed. The picture
half will therefore be 6 × 2 = **12 candidates**, budgeted at most **$2.1708**.

## 3. What the run changed

`ground-truth.editplan.json`: **`d218529e…` → `0712e412…`**

**Nine top-level keys moved:** `clientSnapshot`, `costs`, `images`, `keywords`,
`meta`, `pipeline`, `sfx`, `subtitles`, `transcript`.

| key | before → after |
|---|---|
| `keywords.items` | 0 → **3** |
| `images.slots` | 0 → **6** |
| `sfx.events` | 0 → **6** (one whoosh per slot) |
| `subtitles.groups` | 76 → 76, but **superseded 0 → 5**, so rendered cards **76 → 71** |
| `pipeline.analysis` | pending → done, `keywords-prompt-v4-k2-syndicalia-v12`, $0.111662, not cached |
| `pipeline.images` | pending → done, `slots-prompt-v2-k2-syndicalia-v12`, $0.064822, not cached |
| `costs.spentUsd` | absent → **0.176484** |
| `meta` | `updatedAt` only |
| `clientSnapshot` | **`capturedAt` only** — re-pinned at the same v12, every other field identical |

### `plan.transcript` moved, and session 5's claim needs a correction

**Session 5 reported that the analysis stage does not write `plan.transcript`.
It writes one field of it.** `plan.transcript.terms` went from `null` to three
term spans, at `service/src/analysis/job.ts:162`. Session 5's audit grepped for
whole-object assignments (`plan.transcript = `) and found none, which was true
and not sufficient.

**What matters is unharmed, and that is measured rather than assumed:**

| | |
|---|---|
| `transcript.words` | **byte-identical** |
| `transcript.contentHash` | `30c99cf5fada1608` → `30c99cf5fada1608`, **unchanged** |
| `transcript.terms` | `null` → `[الإبرة الحريرية, الكافيين, نتائج جد فعالة]` |

The terms are ORTHOGRAPHY_GUIDE §6 spans from the v4 keyword prompt, and they
are **still unread by grouping** — Block 6's ruling stands.

### Everything else, verified

| | |
|---|---|
| `zones`, `watermark`, `build`, `clientMode` | **identical** |
| the seven hand-made references | **all identical** |
| `test 1`, `test 2`, `test 3`, `vitasilk` plans | **all identical** |
| `templates/library.aep` | **identical** |

**Cache: 44 → 46 entries, 55,355,647 → 55,363,681 bytes, 77 → 79 files.** Two
entries created, both under `ground-truth`'s video hash and both the ones the
dry run named in advance:

```
CREATED analysis:   analysis-0cc4e6259b47ba9a
CREATED imageslots: imageslots-3b04d5928ea1f138
```

**No image entry, and none evicted.** The image stage did not run.

### The rebuild — it refuses, and that is correct

**The build could not be run and no census was taken.** It refuses:

```
UnplaceableElementsError: 6 element(s) have no placement;
refusing to build a comp with gaps:
  image img001: no Block 5 placement
  … img002 … img003 … img004 … img005 … img006
```

Measured cause: every new slot has `position: null`, `scale: null` and **0
candidates**. Two separate things are missing, and running the free placement
solver would only move the refusal to the second — `candidateFileFor` returns
null with no candidates, giving `no candidate file on disk`. **So `ground-truth`
is unbuildable until its pictures are bought.** `assertAllPlaced` (Block 7
session 10) is doing what it was written for: a comp with gaps is worse than no
comp.

This is a real consequence of splitting the spend and it was not anticipated in
the brief. It costs nothing to reverse — the picture half restores it — and no
other reel is affected.

**What could be measured without a build was measured**, in After Effects,
through the same `buildReel` resolution the builder uses. **All three new
keywords exceed `SUBTITLE_SAFE_WIDTH` 1940 at their authored size:**

| keyword | face | size | one line | outcome | lines |
|---|---|---:|---:|---|---|
| k003 `cernes pigmentés` | CormorantGaramondItalic-SemiBoldItalic | 494.742 | **2916.59** | **breaks**, full size | 1063.29 / 1764.50 |
| k001 `الإبرة الحريرية` | Almarai-Bold | 455 | **2515.24** | **breaks**, full size | 937.30 / 1437.80 |
| k002 `mésothérapie` | CormorantGaramondItalic-SemiBoldItalic | 494.742 | **2275.16** | **shrinks** — one word, no break point | ×0.8527 |

`fontReadBack` matched the requested face on all three, and the fill is gold
`#C9A96E` on all three, which is the emphasis role. **Three of three new
keywords are overlong** — a higher rate than the corpus's 9 in 338 — and session
4's break-before-shrink ruling handles all three without a clipped card. These
are the first keywords ever planned under mode v12.

**Tests that asserted `ground-truth` being empty**, rewritten in commit
`664469d`, all thirteen named:

| test | file | change |
|---|---|---|
| `says the analysis has not run, and names the stage` | `keyword-view.test.ts` | fixture `['ground-truth','test-3']` → `['test-3']` |
| `names where the choice came from…` | `keyword-view.test.ts` | `ground-truth` → `test-3` |
| `says nothing at all when there are keywords` | `keyword-view.test.ts` | **extended** to pin `ground-truth`'s three keywords |
| `derives the figure from the reel rather than a flat constant` | `steps.test.ts` | fixture → `test-3`, duration 23.256567 → 21.187833 |
| `prices the image slots a run would plan…` | `steps.test.ts` | same |
| `opens for a reel with cards but no keywords, images or sfx` | `steps.test.ts` | → `test-3` |
| `says what the comp would and would not contain` | `steps.test.ts` | → `test-3`, **76 → 58** subtitle cards |
| `says the client came from the plan, not the picker` | `steps.test.ts` | → `test-3` |
| `skips transcription and asks for analysis` | `pipeline.test.ts` | → `test-3` |
| `does not ask for images when the plan has no slots` | `pipeline.test.ts` | → `test-3` |
| `refuses a billable stage that would cross it…` | `pipeline.test.ts` | → `test-3` |
| `reports a refusal as a stage failure…` | `pipeline.test.ts` | → `test-3` |
| `stops the run and surfaces the cause verbatim` | `pipeline.test.ts` | → `test-3` |
| `asks for nothing a subtitles-only reel does not use` | `requirements.test.ts` | → `test 3` |
| `refuses a reel that carries the mark…` | `requirements.test.ts` | → `test 3` |
| `does not ask for a watermark measurement…` | `requirements.test.ts` | → `test 3` |
| `leaves the whooshes as the only sound in the corpus` | `sfx-guarantee.test.ts` | corpus total **9 → 15** |

**`test-3` is the corpus's un-analysed reel now**, and every fixture that meant
"a reel with nothing planned" says so.

## 4. Deviations

1. **`ground-truth` was not rebuilt or censused.** §3 asks for it; the build
   refuses for the measured reason above, and forcing it would have meant either
   running the unauthorised image stage or weakening `assertAllPlaced`. The
   keyword measurement was done instead, in After Effects, which answers the one
   part of §3's last bullet that does not need a comp.
2. **`npm run place` was not run.** It is free and would fill `position`/`scale`,
   but it would not make the build succeed — the candidates are still absent —
   so it would have written to the plan for no gain.
3. **`ceilingUsd: 0.30` was passed to the runner** rather than a manual gate.
   That is the runner's own mechanism; its per-call limitation is stated in §1.

## 5. Failures & open problems

**Nothing was destroyed or lost.** Two cache entries created, none evicted; one
plan changed, by nine keys, all of them the analysis stage's own output.

1. **`img005` depicts the wrong procedure** — microneedling for mesotherapy.
   This is the fidelity defect `docs/DECISION-image-config.md` already records
   as unmeasured, now with a fresh instance. **It costs $0.18 to re-plan, not
   $2.35**, since the ideas are the analysis half.
2. **Two of six ideas name plural objects** — "Two open doors", "Four … cards" —
   against PROJECT_SPEC §5's one-subject rule. `checkSlotIdea` did not fire; its
   marker list is enumerated and known incomplete. Whether these actually produce
   two-subject pictures is unknown until they are generated.
3. **`ground-truth` is unbuildable** until the picture half is bought. Named
   above with its measured cause.
4. **Session 5's "the analysis stage does not touch `plan.transcript`" was not
   exact.** Corrected here with the write site. Words and `contentHash` are
   untouched, so nothing derived from word text moved.
5. **The ceiling cannot bound a single call.** Stated in §1; the projection is
   what bounded this run.
6. **`promptModeVersion` is null on all six new slots.** It is set by
   `recompose`, not by `planSlots`, so it records *recomposition* rather than the
   version a prompt was first composed at. `test-1` reads 11 and `vitasilk` 5
   because both were recomposed; these six were not. The field's name suggests
   otherwise and a later session reading it as "the mode version this prompt was
   built at" would be wrong.
7. **`buildSlotPrompt` still ignores its `version` argument** (session 5's
   finding, deliberately not fixed this session). So if these ideas are judged
   bad, **the result cannot be A/B'd against prompt version 1** — v1 and v2
   produce byte-identical text.
8. **Untested:** the panel, CEP `evalScript`, the service's HTTP layer, the
   second machine. Every `DoScript` returned `0` first time.

## 6. Repo state

- Branch **`main`**. Commits this session: `664469d` *test: ground-truth is
  analysed; move the empty fixture to test-3*, then the reports.
- **`npm run check`: exit 0, `check: PASS`**, counts read out of the run's own
  output:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 41 | 605 |
| `framopia-service` | 90 | 1159 |
| `framopia-benchmarks` | 16 | 166 |
| `framopia-panel` | 6 | 159 passed, 2 skipped (161) |
| pytest (sidecar) | — | 149 |

  Gates: `mode k2-syndicalia v12: ok (fonts set)` · `templates: 6 entries, ok` ·
  `extendscript: 13 .jsx file(s) ok` · `validate-templates: 6 template(s) ok` ·
  `validate:panel: ok` · `references: PASS` · both model pins ok.
- **Ledger: 118 lines, sha256
  `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c`.** This is
  the value future sessions assert against.
- All-time ledger spend is now **$12.365734**; **about $6.64 of credit remains**.
- `templates/library.aep` `1d7553e894…2dc4a5d8`, unchanged. Seven references
  unchanged. Four other plans unchanged. `app.fonts.allFonts` 1198 → 1198.

## 7. Suggested next step

The eighteen cents bought what it was meant to: the framing change is confirmed
on real output, the literal-versus-atmospheric rule demonstrably works, and two
concrete faults are visible in text for a fiftieth of what the pictures cost —
which is the whole argument for splitting the spend. Before the $2.17 is
committed, the conversation should rule on those two: `img005` describes
microneedling where she said mesotherapy, and `img002` and `img006` name plural
objects against the one-subject rule. Re-planning the ideas costs **$0.18**, so
correcting them before generating is cheap and correcting them after is not —
but a re-plan is not reproducible and would discard these six, so it is a
decision rather than an obvious move. Whichever way it goes, `ground-truth`
stays unbuildable until its pictures exist, and the two free items already
waiting are the panel's missing client control and `buildSlotPrompt`'s ignored
`version` argument, the second of which should be fixed before any second
attempt at the ideas so that attempt can be compared with the first.
