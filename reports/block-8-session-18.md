Status: OK

Block 8 part 2, session 18. **$0.00 spent, no API was called, the pipeline was
not run, After Effects was not driven.** Three defects from the user's first
real run are fixed, and step 2 — the transcript editor — is built.

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| `git status` at start | **no modified or staged files, and none untracked** |
| HEAD at start | `b775144` |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances at start | **1** |
| `aerender` processes at start | **0** |

`align.ts`, `correction.ts`, `templates/library.aep` and both hand-made
reference files are untouched. The corpus stays pinned at guide v1.0.7.

## Done

### Goal 1 — the divergence was in the panel, and the pin was looking elsewhere

**What the six tests were actually asserting.** All six compared two *service*
values in isolation: that `dryRun` and `runPipeline` return the same stage
**ids**, in the same **order**, with the same **labels**; that the `billable`
flag agrees with which stages carry an estimate; that a `vitasilk` run asks for
nothing; and — the two source-reading ones — that neither module spells a label
out for itself and that the runner never imports the ledger writer.

**None of them looked at what a stage will *do*.** That question was answered in
the panel, by `stageWord`, which inferred a verdict from `provenance` and
`estimateUsd`:

```
if provenance === 'exact'      -> 'cached'
if provenance === 'compatible' -> 'cached, older guide'
...otherwise                   -> 'to run'
```

`vitasilk`'s analysis resolves `provenance: 'none'` — its keyword entry sits at
an older analysis prompt version — and session 17 correctly set `estimateUsd` to
null because a run skips a stage the plan already has. The panel had no way to
tell those two apart from "a stage that will run for free", so it printed **"to
run"** while the run beneath printed **"skipped — already on the plan"**. The
service's own note said the right thing and the panel showed it only in a
`title` tooltip.

**The fix is to say it rather than infer it.** `DryRunStage` gains `action`:
`skip`, `reuse` or `run`, computed where `skipped` is already computed. The
panel renders that.

**The pin is widened to the rendered strings**, in `render.browser.test.ts`
against the built bundle, with `vitasilk`'s exact stage set as the fixture:

- one test asserts the words "to run" never appear when the plan already carries
  every stage;
- one reads both `ul.facts` lists out of the DOM after starting a run and
  asserts, per stage label, that the cost block and the run agree on whether it
  is skipped.

Writing the second one immediately caught my own stub contradicting itself — the
job fixture said "done, $0.1835" for a stage the dry fixture said was skipped —
which is the kind of disagreement the test exists to find.

### Goal 2 — red out of the focus ring

`select:focus, button:focus` set `border-color: var(--accent)`. A new `--focus`
token (`#e8eaed`) replaces it. **The ring stays** — removing it would take
keyboard use with it — and only its colour changes.

A browser test focuses **every** `select`, `button`, `input`, link and
`[tabindex]` in turn and asserts none paints `rgb(237, 28, 36)` on any border,
outline, text or background, with `button.run` the single exemption. A second
test asserts the ring is still visible, so the first cannot be satisfied by
deleting it.

**Verified against the old style**: reverting the one line makes it fail, and
restoring it makes it pass.

### Goal 3 — the rail does unlock, and now it is proven

Session 17's claim held; nothing had exercised it because the user's run skipped
every stage. A browser test now serves `/steps` with Keywords **locked**, runs a
job that finishes, then serves `/steps` with Keywords **available** — as a real
run's effect on the plan would — and asserts the rail goes
`[false, false, true, true, true]` → `[false, false, false, true, true]` with no
manual reload. It passes. No defect to fix.

### Goal 4 — the transcript editor

`service/src/transcript-view.ts` derives everything; `panel/src/Transcript.tsx`
renders it and posts edits back. Routes: `GET /transcript?reel=`,
`POST /transcript/word`, `POST /transcript/card`.

**Rendering.** Words in reading order with their card, interval and the draft
token they took their timing from. **Direction is set per token** — a word's own
`script` decides its `dir` — and a test asserts the list and the row carry no
`dir` at all, because a container direction would reorder the Latin words around
an Arabic one. Interpolated words are marked; `w0036` `26` on `vitasilk` is one,
and the test names it. Removed words are struck through with their reason and
restorable.

**Confidence banding, as asked:** `conf-high` ≥ 0.9, `conf-mid` ≥ 0.7,
`conf-low` below that, `conf-none` for an interpolated word the aligner never
measured — shown as an underline, and **no band uses red**, asserted by reading
computed styles.

**Editing.** Click a word to edit it; `−`/`+` adjust its card's display window by
0.05 s. Every edit sets `edited`, which is what `PlanMergeBlockedError` refuses
to discard on a re-run. Word ids and order never change (tested), and a word
cannot be emptied — the service refuses and says to mark it removed instead, so
the card can still be built. **Card edits never touch word timings**, which is
tested by comparing every word's interval across the edit.

**What an edit costs, said before he types.** One line in the pane: editing a
word's text changes the transcript hash, so the keyword and image-slot caches
miss and a later run bills for them again — **about $0.18 for keywords plus
about $0.06 for slots on a reel this length**, and on a reel with image slots
the changed slot ideas would strand the generated images too. Timing edits and
restores do not move the hash. A test pins both halves of that sentence.

**The three open questions, with their instances.**

| question | count | how it is derived |
|---|---:|---|
| Words too long for their card | **7** | proxy — see below |
| Cards whose hold is clipped | **23** | the plan's timings against the template manifest, the builder's own rule |
| Arabic terms split across cards | **13** | consecutive Arabic-script words landing in more than one card |

The clipped and split figures **reproduce the recorded corpus numbers exactly**,
and tests assert those totals so a grouping or timing change fails here rather
than quietly restating itself.

**The overlong figure is a proxy and the marker says so.** The real measurement
is `sourceRectAtTime` in After Effects against `SUBTITLE_SAFE_WIDTH`; the panel
cannot run After Effects, so it counts characters at `OVERLONG_WORD_CHARS = 11`.
On this corpus the two agree exactly: the seven longest words are the seven
measured overlong (`polynucléotides`, `mésothérapie` ×3, `hyaluronique` ×2,
`matrddadich`), and the boundary sits between 11 characters and 10. A different
face or reel could separate them.

Each question carries its `basis` and asks a question — a test asserts every one
ends in a question mark. **No fix is proposed.**

## Deviations

- **`splitArabicRuns` first counted words, not runs**, giving 40 where the
  recorded figure is 13. Caught by the test asserting the corpus total, which is
  why that assertion is against the recorded number rather than against itself.
- **`editWord` originally looked its reel up in the catalogue by plan path**, so
  it failed on any plan the catalogue does not list — every scratch copy a test
  can make. Fixed with `transcriptViewForPlan`; a writer that only works on the
  shipped corpus is a writer that is never exercised.
- **`Transcript` was hardened against a malformed payload**, which no goal asked
  for. A pre-existing rail test began failing because the shared stub answered
  `/transcript` with the dry-run body and the pane threw — the same failure mode
  session 15 fixed for `/steps`, arriving from the service side.

## Failures & open problems

- **Nothing was lost or destroyed.** No cache entry, ledger line, reference,
  plan, template or image file was modified. The ledger is byte-identical, and a
  test asserts an edit appends nothing to it.
- **The editor has never been used on real content.** Every browser test drives
  a stubbed transcript; the derivation is tested against the real plans, but the
  two have not met. The first real render is the user's.
- **Group adjust is display timing only.** BLOCKS.md's "group adjust" could also
  mean merging or splitting cards, which this does not do — `MAX_WORDS_PER_CARD`
  is 1 and changing membership would need re-deriving supersession, templates
  and SFX. Only the display window is editable.
- **A script toggle is not implemented.** BLOCKS.md lists one; the editor
  renders each word by its stored `script` and offers no control to flip it.
  Editing the text is the only way to change how a word is written.
- **The overlong proxy is a character count**, and it will disagree with After
  Effects on a corpus where a short wide word exists. It is labelled, not
  hidden.
- **The three questions are asked and unanswered.** Nothing changes until the
  user rules.
- Carried forward: headless AE is not met; `vitasilk` is the only reel ever
  built; the runner has still never run for real; `redo` has no control in the
  panel; the CJK `五` is classified Latin; splits and merges need an aligner
  operation that does not exist.

## Repo state

- Branch **`main`**, worked on `main`. No force-push, no history rewritten.
- HEAD at the time of writing: **`3ed0543` `feat: add the transcript editor`**,
  preceded by `fix: keep the brand accent out of the focus ring` and `fix: say
  what a run will do with each stage`, on session 17's `b775144`. **This
  report's own commit follows it.** Goals 1, 2 and 4 are in separate commits.
- `git log` checked for AI attribution and co-author trailers: none.
- `npm run check`: **exit 0, `check: PASS`** — `@framopia/core` **364** (22
  files), `framopia-service` **851** (62 files), `framopia-benchmarks` **166**
  (16 files), `framopia-panel` **118** passed + 2 skipped (7 files), **1499 TS
  total** against session 17's 1461; pytest **141**, unchanged.
- The capability denylist passes against the built bundle, and a raw grep of
  `panel/dist` returns zero matches for every denylisted feature.
- New files: `service/src/transcript-view.ts` (+ test),
  `panel/src/Transcript.tsx`. Changed: `service/src/dry-run.ts`,
  `service/src/server.ts`, `panel/src/App.tsx`, `panel/src/service.ts`,
  `panel/src/types.ts`, `panel/src/panel.css`.
- Both `service/dist` and `panel/dist` rebuilt this session.
- Ledger `.local/costs.jsonl`: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at start
  and end. All-time spend unchanged at **$10.968590**.
- After Effects: **1 instance**, **0** `aerender`, not driven.

## Suggested next step

Have the user open step 2 on `vitasilk` and rule on the three questions, because
everything after this waits on him: the split-term ruling decides whether
grouping changes, the clipped-hold ruling decides whether timing does, and both
would move the cards the keyword and image steps are built against. While he
reads, the cheapest thing to build is the script toggle, which BLOCKS.md lists
and this session did not do — it changes one field, needs no new route, and is
the one transcript control still missing.

## What the user does next

**Restart the service, then the panel.** Both were rebuilt.

1. In a terminal: `kill 74645` (the service currently registered;
   `cat .local/service.json` names it if it has changed).
2. In After Effects: Window → Extensions → untick **Framopia Studio**, then open
   it again from the same menu. Let the panel start the service, not a terminal.

**Three fixes from what you saw.**

- The cost block said "to run" for a stage the run then skipped. It now says
  "skipped, already on the plan" — the same verdict in both places, and there is
  now a test that reads both lists off the screen and compares them, which is
  what the old tests were not doing.
- The mode picker no longer outlines itself in red when focused. The ring is
  still there, in white.
- I checked the claim that a finished run unlocks the next step. It does — your
  run skipped everything, so there was nothing to see.

**Step 2 is ready, and it is the first screen with your own words on it.** Pick
`vitasilk` and click **Transcript** in the rail. You will see each word with its
card, its timing, and the Arabic token it took that timing from — which is where
the alignment work of the last several sessions becomes visible. Arabic words
read right to left inside the line without flipping the French around them.

**Three things I need you to rule on**, shown as buttons with counts. Click one
to see only those words:

- **7 words too long for their card** — `polynucléotides`, `mésothérapie`,
  `hyaluronique`, `matrddadich`. They render wider than the safe width and are
  currently emitted whole and clipped.
- **23 cards whose hold is clipped** — spoken too briefly to hold for the
  template's floor, so the entrance is compressed and the hold cut.
- **13 Arabic terms split across cards** — the orthography guide says a term is
  never broken, and one word per card breaks these.

I have not proposed a fix for any of them. Look at the actual words and decide;
a later session implements whatever you rule.

**One warning before you edit.** Changing a word's *text* changes the transcript
fingerprint, so the keyword and image caches stop matching and a later run pays
for them again — roughly $0.24 on a reel this length, more if it has images.
Adjusting a card's timing or restoring a removed word costs nothing. The panel
says this on screen above the words.
