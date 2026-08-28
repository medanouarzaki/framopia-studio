Status: OK

Block 8 part 2, session 19. **$0.00 spent, no API was called, the pipeline was
not run, After Effects was not driven.** The three ruling counts are reconciled
and now name their scope, each instance carries its evidence, and the script
toggle is built.

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| `git status` at start | **no modified or staged files, and none untracked** |
| HEAD at start | `6d77c04` |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances at start | **1** |
| `aerender` processes at start | **0** |

`align.ts`, `correction.ts`, `templates/library.aep` and both hand-made
reference files are untouched. The corpus stays pinned at guide v1.0.7.

## Done

### Goal 1 — the counts reconciled

**Both figures were right. Neither said which it was.** The panel showed
**per-reel**; session 18's report and its tests asserted **corpus**.

Computed for all five reels rather than assumed:

| reel | overlong | clipped | split terms |
|---|---:|---:|---:|
| ground-truth | 2 | 8 | 2 |
| test-1 | 0 | 5 | 6 |
| test-2 | 1 | 3 | 1 |
| test-3 | 3 | 2 | 4 |
| **vitasilk** | **1** | **5** | **0** |
| **corpus** | **7** | **23** | **13** |

`vitasilk`'s 1, 5 and 0 are exactly what the screen showed. The hypothesis in
the brief holds for overlong — the recorded breakdown 2/0/1/3/1 = 7 matches
today's figure exactly.

**The clipped breakdown needs a correction the brief did not have.** The
recorded 9/7/4/3/5 sums to **28**, not 23. That is the **pre-migration**
breakdown: session 14's alignment migration took the corpus from 28 to 23, and
today's per-reel figures are 8/5/3/2/5. `vitasilk` is 5 under both, which is why
the screen and the old record agreed by accident rather than by construction.

**The zero is real, and the reason is not a broken detector.** All 73 of
`vitasilk`'s words are `script: latin` — the correction pass transliterates
Darija into Arabizi, so what gets built is Latin. There is no Arabic run on that
reel to be split. The Arabic is in `sourceText`, the raw Scribe draft: **39 of
its 73 words have an Arabic `sourceText` and none has an Arabic `text`.** The
detector is right, and `test-1` shows six split runs including
`تحفيز طبيعي للكولاجين`, which ORTHOGRAPHY_GUIDE §6 names verbatim.

**What each figure counts, on what scope, and where the tests' number comes
from:**

| question | counts | scope on screen | where 7/23/13 comes from |
|---|---|---|---|
| Words too long for their card | words whose text is ≥ 11 characters | this reel, corpus beside it | sum over every reel with a plan |
| Cards whose hold is clipped | cards `checkBuildability` reports short of the template floor | this reel, corpus beside it | same sum; 23 is post-migration, the recorded 28 is not |
| Arabic terms split across cards | maximal runs of consecutive Arabic-script words landing in more than one card | this reel, corpus beside it | same sum |

### Goal 2 — the counts name their scope

Every button now reads `<label> · N this reel · M corpus`, and `· proxy` where
the figure stands in for a measurement it cannot take — which is the overlong
count alone, a character count at `OVERLONG_WORD_CHARS = 11` standing in for
`sourceRectAtTime` in After Effects.

**The corpus figure is computed, not carried**: `corpusCounts()` walks every
reel with a plan, so it cannot drift from the per-reel figures beside it.

**Tests pin both scopes for all five reels** — one per reel asserting its exact
triple, one asserting the per-reel figures sum to the corpus ones, one asserting
every question reports both numbers, one asserting only the overlong count is
marked a proxy, and one asserting `vitasilk` has no Arabic word and therefore no
split term. The corpus totals session 18 pinned are kept.

### Goal 3 — the questions are answerable from the screen

Each instance carries the measurement that put it there:

- **Overlong** — the word, its card, its character count and the threshold, and
  what happens today: *"11 characters against a 11-character threshold, in card
  g071. Today it is emitted whole and clipped at the safe width."*
- **Clipped** — the Build pane's own sentence, reused rather than reworded:
  *"0.05s long but sub_pop needs 0.12s (intro 0.13 + hold 0.1 + outro 0) (short
  by 0.07s)"*.
- **Split term** — the term whole, then the cards it is broken into:
  `تحفيز طبيعي للكولاجين` → `g006:تحفيز` `g007:طبيعي` `g008:للكولاجين`.

A question with no instances on this reel says **"None on this reel."** rather
than showing an empty list. **No fix is proposed for any of them.**

### Goal 4 — the script toggle

A `la`/`ar` control per word, writing `script` to the plan and setting `edited`.

**Does flipping `script` change `hashTranscript`? No.** `hashTranscript` is
`[id, text]` over non-removed words; `transcriptContentHash` is
`[id, text, start, end, removed]`. **Neither covers `script`**, so the edit
misses no cache and clears no downstream block. A text edit changes both and
costs about $0.24 on a re-run. The pane says which is which, and two tests pin
that both hashes are unmoved by a flip.

**What it does change is the template variant, and that had to be handled.**
`assignTemplates` picks `sub_pop` or `sub_pop_ar` by script, and the variant
decides the font — Inter Semi-Bold for Latin, Almarai Bold at 1.07× for Arabic.
Flipping the word alone would leave the card on the Latin template and have the
builder draw Arabic in Inter, so `editWord` moves the card to the matching
variant in the same write. A template with no counterpart (`img_float`) is left
alone rather than given an invented id. The control's tooltip says both effects.

**It cannot correct the CJK token, and the reason is worth stating.**
`vitasilk` `w0005` displays **`5`**, which is correctly Latin; **`五` is its
`sourceText`** — the raw Scribe draft, cache data the panel never writes. The
toggle changes how a word is *written out*, not what the ASR heard. A test pins
that no displayed word on the reel contains a CJK character.

## Deviations

- **A flaky test was found and fixed**, which no goal asked for.
  `spawn.integration.test.ts` sampled a spawned process's stderr once and raced
  the refusal line as that process exited; it failed once inside the full check
  and passed four times alone. It now waits for the line. Reported rather than
  re-run until green.
- **I committed the script toggle before reading the check result**, and the
  check had failed on that flake. The fix is a separate commit on top; nothing
  broken was pushed.
- **`corpusCounts()` reads all five plans on every transcript request.** Five
  small JSON reads on a localhost call, and the alternative was caching a figure
  that could drift from the per-reel one beside it — which is the defect this
  session exists to fix.

## Failures & open problems

- **Nothing was lost or destroyed.** No cache entry, ledger line, reference,
  plan, template or image file was modified. The ledger is byte-identical.
- **The three questions are still unanswered.** Nothing changes until the user
  rules; this session made the evidence trustworthy, not the decision.
- **The split-term detector is wider than §6 means.** It flags every multi-word
  Arabic run, and the guide defines a term semantically. The plan carries no
  term ids — `Transcript.terms` exists and is unread, because the model gave
  three different answers across three identical calls in Block 6. Some of the
  13 may not be terms at all, and the basis line says so.
- **The overlong proxy is a character count.** It agrees with After Effects on
  this corpus and will not on one containing a short wide word. Labelled on the
  button, not hidden.
- **The script toggle has never been used on real content.** The derivation is
  tested against the real plans and the control against a stub; the two meet for
  the first time on the user's machine.
- **Group adjust is still display timing only** — merging or splitting cards
  would need supersession, templates and SFX re-derived, and is not built.
- Carried forward: headless AE is not met; `vitasilk` is the only reel ever
  built; the runner has still never run for real; `redo` has no control in the
  panel; splits and merges need an aligner operation that does not exist.

## Repo state

- Branch **`main`**, worked on `main`. No force-push, no history rewritten.
- HEAD at the time of writing: **`f4e36b5` `test: wait for the refusal line
  instead of sampling it once`**, preceded by `feat: add the script toggle` and
  `fix: name the scope of each ruling count and show its evidence`, on session
  18's `6d77c04`. **This report's own commit follows it.** Goals 1–3 and Goal 4
  are in separate commits.
- `git log` checked for AI attribution and co-author trailers: none.
- `npm run check`: **exit 0, `check: PASS`** — `@framopia/core` **364** (22
  files), `framopia-service` **871** (62 files), `framopia-benchmarks` **166**
  (16 files), `framopia-panel` **123** passed + 2 skipped (7 files), **1524 TS
  total** against session 18's 1499; pytest **141**, unchanged.
- The capability denylist passes against the built bundle, and a raw grep of
  `panel/dist` returns zero matches for every denylisted feature.
- Changed: `service/src/transcript-view.ts` (+ test), `service/src/server.ts`,
  `service/src/spawn.integration.test.ts`, `panel/src/Transcript.tsx`,
  `panel/src/service.ts`, `panel/src/types.ts`, `panel/src/panel.css`,
  `panel/src/render.browser.test.ts`.
- Both `service/dist` and `panel/dist` rebuilt this session.
- Ledger `.local/costs.jsonl`: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at start
  and end. All-time spend unchanged at **$10.968590**.
- After Effects: **1 instance**, **0** `aerender`, not driven.

## Suggested next step

Have him rule on the three questions, on `test-1` rather than `vitasilk` —
`vitasilk` has one overlong word, five clipped holds and no split terms at all,
while `test-1` has six split terms including the one the orthography guide names
by name. That is the reel where the split-term question is actually visible.
Everything downstream waits on those rulings: the split-term answer decides
whether grouping changes, and the clipped answer decides whether timing does,
and both move the cards the keyword and image steps are built against.

## What the user does next

**Restart the service, then the panel.** Both were rebuilt.

1. In a terminal: `kill 95786` (the service currently registered;
   `cat .local/service.json` names it if it has changed).
2. In After Effects: Window → Extensions → untick **Framopia Studio**, then open
   it again from the same menu. Let the panel start the service, not a terminal.

**About the 1, 5 and 0 you saw: those numbers were right.** They are for
`vitasilk` alone. The 7, 23 and 13 in my report were for all five reels
together, and nothing on screen or in the report said which was which — so you
were right not to rule on them. Every button now reads, for example, *"Cards
whose hold is clipped · 5 this reel · 23 corpus"*.

**The zero was also right, and here is why.** `vitasilk` has no Arabic words at
all. The transcription writes Darija in Arabizi — Latin letters — so all 73 of
its words are Latin. The Arabic you can see in the editor is the *source token*
column: what Scribe originally heard, kept for comparison, never built. So there
is no Arabic term on that reel to be split.

**To actually see the split-term problem, open `test-1`.** It has six, including
`تحفيز طبيعي للكولاجين`, which the orthography guide names as a single term and
which is currently broken across three cards. Click the question and you will
see the term whole, then each card it was broken into.

**One more correction.** I said 23 clipped holds and the older handoff says 28.
Both were true at different times — the alignment migration a few sessions ago
took it from 28 to 23. `vitasilk` is 5 either way.

**The script toggle is in.** Each word has a small **la** / **ar** button. It
changes how the word is written: its direction, and the font the build uses —
Inter Semi-Bold for Latin, Almarai Bold for Arabic. **It costs nothing on a
re-run**, unlike editing a word's text, which costs about $0.24. The panel says
so above the words.

**It will not fix the `五`.** That character is in the source-token column for
the word `5` — it is what Scribe heard, and the panel never rewrites that. The
word that gets built is `5`, and it is already correct.
