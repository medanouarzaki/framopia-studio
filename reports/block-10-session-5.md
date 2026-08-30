Status: OK

# Block 10 session 5 — a video with no client stops the build, and a free look at the next $2.35

**Spent $0.00; no API was called.** Ledger **116 lines, sha256 `e5e0a6e9…c132cb`,
byte-identical at both ends.** `templates/library.aep` `1d7553e894…2dc4a5d8` at
both ends. **Cache byte-identical — 44 entries, 55,355,647 bytes, 77 files; no
entry created.** All seven hand-made reference files unchanged.
`app.fonts.allFonts` **1198 → 1198**. One After Effects instance, zero
`aerender`; never launched, never quit, nothing saved.

Artifact: `reports/block-10-next-run-preview.json`.

## 1. Done

### Preconditions (all eight pass)

| | measured at start |
|---|---|
| repo | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`, name `framopia-studio` |
| After Effects | **1** instance · `aerender` **0** |
| ledger | 116 lines, `e5e0a6e9d673…c132cb` |
| `templates/library.aep` | `1d7553e894e1…2dc4a5d8` |
| git | `main`, clean, HEAD `0fe5c33` *docs: report block 10 session 4* |
| open project | `.local/build/ground_truth-full.aep` — inside `.local/build/`, clean |
| fonts | 1198 |

**References, recorded at start and identical at end.** The prompt asks for
"the four hand-made references"; there are two distinct sets and both were
recorded, because either reading is defensible:

| file | sha256 |
|---|---|
| `benchmarks/references/align/README.md` | `b77495a1…` |
| `benchmarks/references/align/vitasilk.json` | `f32e12dc…` |
| `benchmarks/references/align/vitasilk.rereview.json` | `10a2e5c2…` |
| `.local/ground-truth/ground-truth.txt` | `1fbbe219…` |
| `.local/ground-truth/test-1.txt` | `b59a6270…` |
| `.local/ground-truth/test-2.txt` | `9ceea1c4…` |
| `.local/ground-truth/test-3.txt` | `b5413c21…` |

### Deliverable A — a video with no client stops the build

Commit `44a4793` *feat: refuse to build a video with no client*.

The refusal is a **build requirement**, in `service/src/build/requirements.ts`
— the one declaration already read by the builder and by `steps.ts`, so the
panel cannot say one thing while the build does another:

```
id: 'client-identity'
needed:  true            (unconditional — every reel with cards has type to set)
present: clientSource !== 'none'
what:    a client for this video — no client mode and no saved client look is on its plan
command: choose the client for this video in the panel
consequence: every card keeps whatever type and colour the template happens to carry
             rather than the client's, which on this corpus is #F4F4F4 where it
             should be #F8F6F2
```

**The answer comes from `resolveClientIdentity` itself**, passed in as
`clientSource` rather than recomputed, so there is still exactly one
declaration of which look a build uses. Absent, the requirement reports as met
— a caller that never resolves an identity cannot be told it has the wrong one.

**It fires before anything is placed or saved.** `build-reel-cli.ts` resolved
the identity *after* `assertRequirementsMet`; the two are swapped, so the
identity is known when the check runs. Nothing between them depended on the
order.

**The dry run reports it too.** `DryRunPlan.buildBlockedBecause` is a sentence
or null, and the panel type carries it **optional-with-default** so a service
older than the field reads as "nothing blocking" rather than as empty.

**Eight new tests** in `requirements.test.ts`, covering the refusal, every
field of the message, all three non-`none` sources, a reel with no images and
no sounds (to pin that it is unconditional), the caller-did-not-ask case, and
the thrown error.

**Tests that asserted retired behaviour, rewritten in the same commits, by
name:**

| test | file | was | now |
|---|---|---|---|
| `asks for nothing a subtitles-only reel does not use` | `requirements.test.ts` | `needed` was exactly `['watermark-facts']` | `['client-identity','watermark-facts']`, and asserts face-masks and loudness are still absent |
| `does not ask for a watermark measurement when the reel refuses the mark` | `requirements.test.ts` | `needed` was `[]` | `['client-identity']` |
| `asks nothing extra of any of the five reels` | `requirements.test.ts` | never supplied a `clientSource`, so it would have passed whatever the corpus looked like | resolves the identity **for real** per reel |
| `gives a client to every plan whose analysis has run, and none to the rest` | `analysis/client-mode.test.ts` | expected `ground truth` and `test 3` to have no client | `gives every plan in the corpus a client` |
| `pinned every plan that names a client, and left the ones that do not` | `editplan/migrate-client-snapshot.test.ts` | expected two nulls | `pinned every plan, and no pin disagrees with the client it names` |
| `says when the client came from the picker rather than the plan` | `steps.test.ts` | expected `modeSource` to be `'the picker'` on `ground-truth` | `says the client came from the plan, not the picker` |

**The fallback is not weakened and no default client was added.**
`resolveClientIdentity`'s `live-mode` and `none` branches are untouched; what
changed is that `none` now stops a build.

### Deliverable B — the client attached to both reels

**There was no existing control, and that is the finding.** The only writers of
`plan.clientMode` were the **analysis stage** (`analysis/job.ts:234` and `:423`,
which bills) and `migrate-client-mode-cli.ts`, a one-shot that derives the
client from the analysis config label — a label neither of these two plans has,
because their analysis has never run. `POST /client-snapshot` re-pins an
existing client and refuses a plan with none. The panel picks a client for a
*run*; the plan learns about it only when the paid stage writes it.

So **a video whose analysis had never run could not be given a client without
spending**, and the refusal in Deliverable A would have told the user to do
something the product cannot do. The rule this repo already has — *a remedy
sentence is verified by running it, or it is a guess* — makes the route part of
the refusal rather than scope beyond it.

**`POST /client { planPath, modeId }`** in `service/src/server.ts`, mirroring
`POST /client-snapshot` exactly: same `withPlan` wrapper, same `loadMode`, same
`snapshotOfMode`, same `PlanEditError` → 400. It writes the pointer and the
copy in one write, because a reel is built against a copy rather than a pointer.
`setClient` in `panel/src/service.ts` is the panel side. **Five tests**: it
attaches and pins in one write, it changes nothing but `clientMode`,
`clientSnapshot` and `meta`, it refuses an unknown client **and writes
nothing**, it needs both arguments, and it is behind the token wall.

**Both reels attached through that route**, over a real service on a scratch
lock file. No plan was hand-edited.

| | before | after |
|---|---|---|
| `ground truth.editplan.json` | `71462855…` | `d218529e…` |
| `test 3.editplan.json` | `25503f96…` | `dbf28f9b…` |
| `test 1` / `test 2` / `vitasilk` | `1acf10bf…` / `94da6dd6…` / `c8501bca…` | **unchanged** |

**Exactly three top-level keys moved on each**: `clientMode` (null →
`k2-syndicalia` v12), `clientSnapshot` (absent → pinned), and `meta` — where
`updatedAt` is the only field that moved.

**The snapshot diff the brief requires as a stop condition.** The new v12
snapshot against each of the three existing v10 ones:

| against | fields differing |
|---|---|
| test-1 (v10) | `version` 10 → 12, `capturedAt` |
| test-2 (v10) | `version` 10 → 12, `capturedAt` |
| vitasilk (v10) | `version` 10 → 12, `capturedAt` |

**Nothing else differs.** `palette`, `fonts`, `textColours`, `imageScale`,
`name`, `id` and `snapshotVersion` are identical across all four — and both
differing fields are the two `snapshotsAgree` deliberately excludes, so all
five reels are current. The stop condition is not triggered. `test-3`'s
snapshot is identical to `ground-truth`'s but for `capturedAt`.

**Rebuilt and censused, and the colour moved:**

| reel | placeholder colour before | after |
|---|---|---|
| ground-truth | `#F4F4F4` ×76 | **`#F8F6F2` ×76** |
| test-3 | `#F4F4F4` ×58 | **`#F8F6F2` ×58** |

Shadows stay Rouge K2 `#820000` on every card, which is the design. Both
censuses are otherwise clean: 0 placeholder words surviving, 0 undeclared text
layers, 0 comps where placeholder and shadow differ in text or size, 76 and 58
compared against the plan with **0 mismatches**, no font outside K2. The
break/shrink outcome is unchanged — ground-truth 2 shrunk, test-3 3 shrunk.

**Nothing was committed for this deliverable**: Edit Plans are gitignored, so
the change lives on disk and in this report.

### Deliverable C — what $2.35 will buy, read-only

Nothing was composed into a plan, generated, recomposed or billed. Full values
in `reports/block-10-next-run-preview.json`.

#### 1. The framing axis at mode v12

| | value, exactly as it enters a prompt |
|---|---|
| [0] | `medium, the subject from the waist` |
| [1] | `close, the subject filling most of the height` |
| [2] | `macro, a single detail standing for the whole` |
| **retired** | **`wide, the whole subject with air around it`** |

The retired sentence is the one `test-1 img002` carries today and the one the
user objected to. It cannot be drawn any more: the axis does not contain it.

#### 2. A composed prompt for `ground-truth` at v12

Its plan id is `2b3957559a491ee90e17966f7de514e3` and the draw is deterministic
from that, so these are the exact sentences the next run will use. Slot 0 draws
`seen at a three-quarter turn` / `close, the subject filling most of the
height` / `rim light separating the subject from the ground`, giving:

> `<the idea the model will write for this moment>. a single clear idea,
> readable at a glance. one subject, centred and unobstructed. the brighter end
> of the palette leads: #C9A96E and #F8F6F2 carry the subject, with #820000 for
> depth and #1A0000 kept to the ground behind it. lit so the subject reads
> immediately at a glance, bright and clearly separated from its ground, not
> sunk into it. seen at a three-quarter turn. close, the subject filling most of
> the height. rim light separating the subject from the ground.`

Negative prompt: `no extraneous objects, no background clutter, no incidental
detail, nothing in frame that is not carrying the idea, no busy or competing
composition, no watermark, no logo`.

All six slots' draws, none of them `wide`:

| slot | framing | angle | lighting |
|---|---|---|---|
| 0 | close | three-quarter turn | rim light |
| 1 | medium | straight on | hard directional |
| 2 | macro | slightly below | rim light |
| 3 | medium | slightly above | hard directional |
| 4 | macro | slightly below | rim light |
| 5 | close | slightly above | hard directional |

**Only the idea is unknown.** Everything else the money buys is above.

#### 3. The literal-versus-atmospheric change — and a defect in how it is versioned

The paragraphs that will be sent, verbatim:

> When the words name something concrete and depictable — a brand, a product,
> a place, a country, an ingredient, a tool, a number of things — the picture
> should usually be that thing, and the idea should name it as she named it.
> A viewer should recognise it at a glance without working out what it stands
> for.
>
> When the words name no such thing — a question, a feeling, a promise, a
> result — the picture should carry the mood or the outcome instead, and the
> idea should describe that.
>
> Decide this for each slot on its own. Both kinds are right, and neither is
> the default. The test is what a viewer would recognise fastest in the two
> seconds the picture is on screen.
>
> Do not blend the two. A concrete thing beside an abstract one is two
> subjects, and a slot idea depicts one.

**The change is live and will be sent. But version 1 and version 2 produce
byte-identical prompts** — both 3399 characters, zero lines differing.
`buildSlotPrompt` (`service/src/analysis/slots.ts:52`) destructures
`const { words, mode, candidateCount, durationS } = options` and **never reads
`options.version`**; the prompt body has no branch on it, and the
literal-or-atmospheric paragraphs are unconditional.

So the version does two real things — it keys the slot cache fingerprint and it
stamps provenance on the plan — and one thing it does not: select a prompt. The
doc comment above the constant says *"Version 1 stays selectable because every
slot on disk was planned with it"*, and **that sentence is false**: asking for
version 1 returns the version 2 text. Reported, not changed — it is a live
constant and the next run depends on it.

#### 4. The measured dry run, with the client attached

| reel | transcription | analysis | images | zones | **total** |
|---|---|---|---|---|---:|
| **ground-truth** | skip (compatible) | **run, $0.1800** | **run, $2.1708** | skip | **$2.3508** |
| **test-3** | skip (compatible) | **run, $0.1800** | **run, $2.1708** | skip | **$2.3508** |
| test-1 | skip | skip | skip (8 of 8 cached) | skip | $0.0000 |
| test-2 | skip | skip | run, no estimate | skip | $0.0000 |
| vitasilk | skip | skip | skip (10 of 10 cached) | skip | $0.0000 |

**Attaching a client did not move the estimate.** $2.3508 before and after —
which is right: no cache key reads the client's version, and the images
estimate is a per-reel slot count.

**How much of that is derived and how much assumed**, since the brief asks:

- **`analysis` $0.18 is a fixed assumption**, `STAGE_ESTIMATES.analysis` at
  `dry-run.ts:139` — an order-of-magnitude figure from recorded actuals,
  deliberately pessimistic, not derived from this reel. The comment there says
  so. The recorded v4 actual is $0.1835 on `test-2`.
- **`images` $2.1708 is derived**: `imageSlotCountFor(23.257 s)` = **6** slots,
  × 2 candidates = **12**, × **$0.1809** each — the published pro-2K $0.134 ×
  `IMAGE_COST_MULTIPLIER` 1.35. **Its one assumption is that the planner
  returns at least six usable slots**; fewer means a lower actual, never a
  higher one.

**No reel reports `buildBlockedBecause` any more.** Before this session
`ground-truth` and `test-3` would have.

#### 5. What a fresh slot plan will and will not overwrite

Read off `service/src/analysis/job.ts`. The keyword stage and the slot stage
between them assign:

`subtitles.groups` · `keywords` · `sfx` · `images` · `clientMode` ·
`clientSnapshot` · `pipeline.analysis` · `pipeline.images` · `costs` (through
`recordStageSpend`) · `meta.updatedAt`.

**They do not assign `plan.transcript` at all**, and neither file contains any
reference to `.local/ground-truth/` or `benchmarks/references/`. So:

| | touched by a fresh slot plan |
|---|---|
| `plan.transcript` (words, timings, `contentHash`) | **no** |
| `plan.zones`, `plan.watermark`, `plan.build` | **no** |
| `.local/ground-truth/ground-truth.txt` — the hand-written WER reference | **no** |
| the three files under `benchmarks/references/align/` | **no** |

**Nothing hand-made is at risk, so there is no reason here not to spend.**
`subtitles.groups` is rewritten — regrouped around the new keywords and
re-timed — but it is derived from the transcript, not hand-made, and
`clientMode`/`clientSnapshot` will be rewritten to the same v12 values this
session just pinned.

## 2. Deviations

1. **A new route was added where the brief said not to invent a writer.** §3
   says to use the existing control; there is none, for the reason set out
   above. Deliverable A's refusal tells the user to choose the client in the
   panel, and this repo's rule is that a remedy sentence is verified by running
   it — so without the route the refusal would have been a lie. `POST /client`
   reuses `POST /client-snapshot`'s machinery exactly and adds no second way of
   doing anything. Flagged rather than quietly done.
2. **Both reels were rebuilt and censused**, which the brief asks for and which
   required driving After Effects — the only part of this session that did.
3. **The scratch plan in the new server tests strips the client** from a copy of
   `test 3`, because `test 3` now has one. Without that the tests would exercise
   a state the route does not exist for.
4. **The reference set was read both ways.** The brief says "the four hand-made
   references"; the align directory holds three files and `.local/ground-truth/`
   holds four `.txt` transcripts. All seven are recorded, unchanged.

## 3. Failures & open problems

**Nothing was destroyed or lost.** No cache entry created or evicted, no
generated image, template, mode file or ledger line touched. Two Edit Plans
changed, by exactly three top-level keys each, through the product's own route.

1. **`buildSlotPrompt` ignores its `version` argument.** `SlotPromptVersion` is
   a real cache key and a real provenance stamp, but it selects no text; v1 and
   v2 are byte-identical. The doc comment claiming v1 stays selectable is false.
   **This matters for the next session**: the change will be exercised, but if
   the pictures come back wrong there is no way to A/B it by flipping the
   constant. Not fixed — it is live and the next run depends on it.
2. **The refusal has never fired in a real build.** After this session's
   attachment no reel in the corpus can reach it, so it is proven by unit tests
   and by the corpus check failing before the fix, not by a build stopping.
   That is the same shape as every other requirement in that file.
3. **The panel has no control that calls `setClient` yet.** The route and the
   client function exist and are tested; nothing in `App.tsx` renders a button.
   So the refusal's sentence — *choose the client for this video in the panel* —
   is true of the product's API and **not yet true of its screen**. This is the
   one place this session's own remedy sentence outruns what it built, and it is
   named rather than left.
4. **`ground-truth` and `test-3` are now pinned at v12 while the other three are
   at v10.** `snapshotsAgree` reports all five as current and the looks are
   byte-identical, so nothing builds differently — but the corpus is no longer
   uniform in that field.
5. **The $0.18 analysis estimate is an assumption, not a measurement.** The
   $2.3508 headline is $2.1708 derived plus $0.18 assumed.
6. **Untested this session:** the panel, CEP `evalScript`, the service's HTTP
   layer as the panel uses it (the route was exercised over real HTTP by tests
   and by the attachment, but not from the panel), and the second machine.
   Every `DoScript` returned `0` first time, so the returns-`1` retry path was
   not entered.

## 4. Repo state

- Branch **`main`**. Commits this session: `44a4793` *feat: refuse to build a
  video with no client*, `a905a6e` *test: record what a fresh slot plan will
  send*, then the reports.
- **`npm run check`: exit 0, `check: PASS`**, counts read out of the run's own
  output:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 41 | 605 |
| `framopia-service` | 91 | **1159** |
| `framopia-benchmarks` | 16 | 166 |
| `framopia-panel` | 6 | 159 passed, 2 skipped (161) |
| pytest (sidecar) | — | 149 |

  Gates: `mode k2-syndicalia v12: ok (fonts set)` · `templates: 6 entries, ok` ·
  `extendscript: 13 .jsx file(s) ok` · `validate-templates: 6 template(s) ok` ·
  `validate:panel: ok` · `references: PASS` · both model pins ok.
- Close-out, start → end: ledger 116 lines / `e5e0a6e9…c132cb` → **identical** ·
  `templates/library.aep` → **identical** · cache 44 entries / 55,355,647 bytes
  / 77 files → **identical, nothing created** · all seven reference files →
  **identical** · `app.fonts.allFonts` **1198 → 1198** · Edit Plans: two changed
  as intended, three byte-identical.

## 5. Suggested next step

The defect that would have wasted the money is gone — `ground-truth` carries
K2 at v12, builds in the client's crème, and every sentence the next run will
send except the ideas themselves is now written down in
`reports/block-10-next-run-preview.json` for the conversation to read before
paying. So the next session is the spend: run the pipeline on `ground-truth` for
about **$2.35**, which plans six slots fresh, exercises both prompt changes for
the first time in three blocks, and leaves the block with a sixth built reel and
its golden candidate. Two things belong in that session's plan rather than after
it: the prompt-version defect above means a disappointing result **cannot** be
A/B'd against version 1, so the run should be judged on its own pictures and the
constant fixed before any second attempt; and the panel still has no control
that attaches a client, so the refusal added here points at a button that does
not exist yet — free to add, and worth doing before a second client ever exists.
