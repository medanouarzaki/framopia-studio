Status: OK

Block 8 part 2, session 20. **$0.00 spent, no API was called, the pipeline was
not run, After Effects was not driven.** The user's three subtitle rulings are
recorded and none implemented; step 3, the keyword picker, is built.

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| `git status` at start | **no modified or staged files, and none untracked** |
| HEAD at start | `f504c48` |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances at start | **1** |
| `aerender` processes at start | **0** |

`align.ts`, `correction.ts`, `templates/library.aep` and both hand-made
reference files are untouched. No template keyframe was edited. The corpus stays
pinned at guide v1.0.7.

## Done

### Goal 1 — the three rulings, recorded and unimplemented

Written into `docs/PROJECT_SPEC.md` §3 as **Subtitle rulings (2026-08-28)**, in
the same form as the other frozen decisions, and carried into `CLAUDE.md` as a
convention. **Nothing was built for any of them.**

1. **A multi-word §6 term occupies one card together.** `MAX_WORDS_PER_CARD` = 1
   stands for ordinary speech; a §6 term overrides it. 13 runs affected.
2. **A card stays tight to its word; the animation compresses.** This ratifies
   Block 7's short-card entrance stretching, already shipped. **The 23 clipped
   holds are now a recorded decision, not an open defect, and there is nothing
   to build.**
3. **An overlong word shrinks to fit** — never clipped, never wrapped. 7 words
   affected.

**`docs/DEFECT-alignment-script-mismatch.md` does not name these three and was
not edited.** Its "splits and merges" are the *aligner's* — one draft token
against two corrected words — which is a different problem from a §6 term
landing in two cards. Editing it would have conflated them.

**What ruling 1 costs.** The split-term detector flags **every** run of
consecutive Arabic-script words; §6 defines a term semantically, so some of the
13 are not terms. `Transcript.terms`, `service/src/analysis/terms.ts` and
`ACTIVE_ANALYSIS_PROMPT_VERSION` 4 all exist and are **unread by grouping**,
because Block 6 session 5 got three different term sets from three identical
calls and two of them broke `ترطيب عميق للبشرة`, which the guide names verbatim.
A trustworthy source is one of two things: **a hand-made reference of term
spans**, the same shape as the alignment references and the same cost in the
user's time; or **a prompt that returns them stably**, which n=3 says the
current one does not. Then grouping stops being "one word per card" and becomes
"one word per card, except a term", which changes supersession, template
assignment and SFX derivation with it. **Not attempted.**

**What ruling 3 costs.** Rendered width comes from **`sourceRectAtTime` inside
After Effects** — the panel's 11-character proxy is not a width. A per-word
scale touches `service/src/build/`, which would compute a scale per card from
the measured rect against `SUBTITLE_SAFE_WIDTH` (1940), and the template
contract, where `TXT_MAIN`'s scale becomes a per-instance value. **The system
never edits a template's keyframes**, so the scale is set on the instance, never
in the comp. It also depends on the K2 fonts Block 9 collects: a different face
changes every width, so measuring now would measure the wrong thing.
**Not attempted.**

Both are Block 9.

### Goal 2 — the keyword picker

`service/src/keyword-view.ts` derives; `panel/src/Keywords.tsx` renders and
posts back. Routes `GET /keywords?reel=`, `POST /keywords/add`,
`POST /keywords/remove`.

**Rendering.** Each keyword shows its word, card, interval, the analysis's
reason, its `kind` (`label`/`promise`), its template variant **by script** —
`kw_slam` for Latin, `kw_slam_ar` for Arabic, verified on `test-1` whose two
keywords are both Arabic — its size (425 against the subtitle's 343, both read
from `core/src/typography.ts`), and the hit bound to it: `hit_01` at +0.13 s,
−20 dB, with the file's existence on disk checked rather than assumed.

**Editing.**

- **Remove** drops the keyword and clears the card's `supersededBy`, so the card
  renders itself again with the subtitle template it already had.
- **Add** promotes any unclaimed, unremoved word: it takes the `kw_slam` variant
  for its script, supersedes its card, and gains a hit at the same 0.13 s
  offset. Its `reason` is left **empty** rather than invented — the analysis
  never said anything about it — and the panel shows "promoted by hand".
- **Both re-derive the whole `sfx` block** through `deriveSfxEvents` rather than
  patching an event. ARCHITECTURE §3 calls SFX generated and never
  hand-authored; a hit added by hand would drift the moment the manifest moved.

**What `mergeIntoExistingPlan` does with a touched keyword block**, as asked: a
transcript change clears `keywords`, `images` and `sfx` — but `humanFlaggedItems`
collects every keyword with `edited: true`, and the merge throws
`PlanMergeBlockedError` demanding `--force` rather than discarding them. A
promoted keyword is written `edited: true`, and a test asserts it appears in
`humanFlaggedItems`. **A removal has no such protection**: there is no item left
to flag, so a transcript change followed by a re-run restores a keyword the user
deleted. Named in Failures.

**The SFX preview plays.** The panel cannot play through After Effects, so it
uses the browser's own audio element pointed at the file on disk, at the gain the
build applies — −20 dB is `10 ** (-20/20)` = 0.1 volume. I probed it before
building the control: from a `file://` page in Chromium the audio loads,
`loadedmetadata` fires and duration reads **5.856 s** for `hit_01`, which is an
**mp3**, not a wav. It works because the manifest declares
`allow-file-access-from-files`. **That probe was Playwright's Chromium, not
CEP's** — a failure is reported on screen rather than swallowed, so if CEP
refuses it the control says so instead of doing nothing. Regardless of whether
it plays, the binding is always named in words.

**Type sizes** come from the service, not the panel: `subtitleFontSize` 343 and
`keywordFontSize` 425, asserted against `core/src/typography.ts`.

### Goal 3 — honest about its inputs

A reel with no keywords says **why**, and the two reasons are distinguished:
*"Keyword analysis has not run for this reel yet (stage is "pending")"* against
*"analysis has run for this reel and selected none"*. `ground-truth` and
`test-3` show the first. An empty list alone states neither.

Every view names its source: the analysis prompt version (4), the keyword mode
(`auto`), the pipeline stage status, and the analysis cache entry the plan
recorded. **On every reel today that entry is absent** — only a run writes it and
no run has — and the line says "no analysis cache entry recorded on the plan"
rather than leaving a blank.

### Tests

21 service tests against the real plans — the keywords each reel actually has,
the Arabic variant on `test-1`, the sizes, the SFX binding with its file
present, promotion and removal round-tripping, the `edited` flag reaching
`humanFlaggedItems`, and both edits leaving the ledger byte-identical. 8 browser
tests over the built bundle — the rendered row, per-keyword direction, the
hand-promoted marker, the source line, remove, promote, the empty reason, and
zero uncaught errors.

### Goal 4 — handed back

**`npm run service:build` and `npm run panel:build` both ran.**
`service/dist/service.js` and `panel/dist/panel.js` are current. The capability
denylist passes against the built bundle and a raw grep of `panel/dist` returns
zero matches for every denylisted feature.

## Deviations

- **The `CLAUDE.md` ruling section landed in the picker commit, not the rulings
  commit.** `docs/PROJECT_SPEC.md` §3 — the record the goal asked for — is in
  `a1a9c48` on its own; the convention text was swept in by the `git add -A`
  that followed. The two commits are still separate as required, but the split
  is not as clean as it should be.
- **`addKeyword` originally sorted the keyword block by start time**, which
  moved every existing item as a side effect of adding one. Caught by a
  round-trip test. It appends now, and the view sorts.
- **A pre-existing browser test used Keywords as its example of an unbuilt
  step.** It now points at Images, which still is. Retired behaviour, rewritten
  in the same change.

## Failures & open problems

- **Nothing was lost or destroyed.** No cache entry, ledger line, reference,
  plan, template or image file was modified. The ledger is byte-identical and a
  test asserts both keyword edits append nothing to it.
- **Removing a keyword is not protected from a re-run.** `edited: true` guards a
  promoted keyword because there is an item to flag; a deletion leaves nothing,
  so a transcript change clears the block and the analysis re-adds the keyword
  the user removed. The plan has no "removed by hand" marker and adding one is a
  schema change this session did not make.
- **The SFX preview is unverified on CEP.** It works in Playwright's Chromium
  from `file://`; only the user's machine confirms CEP's does. It fails visibly
  rather than silently.
- **The picker has never been used on real content.** The derivation is tested
  against the real plans and the control against a stub; the two meet on the
  user's machine.
- **`ground-truth` and `test-3` cannot be exercised here** — no keywords until
  their analysis runs, which bills. The empty state is what they show.
- **Per-keyword template variant is derived, not chosen.** BLOCKS.md lists a
  variant control; the script decides it and there is one variant per script, so
  there is nothing to choose between. If more `kw_` variants arrive, this needs
  a control.
- Carried forward: rulings 1 and 3 are Block 9 and unimplemented; headless AE is
  not met; `vitasilk` is the only reel ever built; the runner has never run for
  real; `redo` has no control in the panel; group adjust is display timing only.

## Repo state

- Branch **`main`**, worked on `main`. No force-push, no history rewritten.
- HEAD at the time of writing: **`0ea55bf` `feat: add the keyword picker`**,
  preceded by `docs: record the three subtitle rulings`, on session 19's
  `f504c48`. **This report's own commit follows it.** Goals 1 and 2 are in
  separate commits.
- `git log` checked for AI attribution and co-author trailers: none.
- `npm run check`: **exit 0, `check: PASS`**, read before committing —
  `@framopia/core` **364** (22 files), `framopia-service` **892** (63 files),
  `framopia-benchmarks` **166** (16 files), `framopia-panel` **131** passed + 2
  skipped (7 files), **1553 TS total** against session 19's 1524; pytest
  **141**, unchanged.
- New files: `service/src/keyword-view.ts` (+ test), `panel/src/Keywords.tsx`.
  Changed: `docs/PROJECT_SPEC.md`, `service/src/server.ts`, `panel/src/App.tsx`,
  `panel/src/service.ts`, `panel/src/types.ts`, `panel/src/panel.css`,
  `panel/src/render.browser.test.ts`.
- Both `service/dist` and `panel/dist` rebuilt this session.
- Ledger `.local/costs.jsonl`: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at start
  and end. All-time spend unchanged at **$10.968590**.
- After Effects: **1 instance**, **0** `aerender`, not driven.

## Suggested next step

Build step 4, the image candidate picker, on `vitasilk` — it is the only reel
with generated candidates on disk (10 across 5 slots, with cutouts, metrics and
gate verdicts), so it is the only one that can be built against real content
rather than a stub. It also carries the decision Block 4 deliberately left open:
`chosenCandidateId` is null on every slot because the editor picks, and the
picker is what finally closes it. Two things to carry in: the gate's yield was
2 of 10 and four of the failures are genuine halo, so the picker must show a
rejected candidate rather than hide it; and `presentation` currently decides
nothing, because Block 7 session 9 forced `img_float` on every slot.

## What the user does next

**Restart the service, then the panel.** Both were rebuilt.

1. In a terminal: `kill 15826` (the service currently registered;
   `cat .local/service.json` names it if it has changed).
2. In After Effects: Window → Extensions → untick **Framopia Studio**, then open
   it again from the same menu. Let the panel start the service, not a terminal.

**Your three rulings are written down** in `docs/PROJECT_SPEC.md` §3, dated, and
**none of them is built** — that is deliberate; they are Block 9.

One of them turned out to need no work at all: **"a card stays tight to its
word"** is what the builder already does. The 23 clipped holds you were looking
at are that behaviour, so they stop being an open defect and become a decision
you have made. The other two are real work: the term rule needs a reliable way
to know where a term starts and ends, which we do not have — the model gave
three different answers to the same question — and the shrink rule needs a width
that only After Effects can measure, using the client fonts that Block 9
collects.

**Step 3 is ready.** Pick a reel and click **Keywords**. You will see each
emphasised word with its card, why the analysis chose it, which template it
uses — `kw_slam` for Latin, `kw_slam_ar` for Arabic — and the sound bound to it.

- **Play** plays that sound at the volume the build uses. It works in a test
  browser; if CEP refuses it, the panel will say so rather than sit there.
- **Remove** takes a keyword off and the card goes back to a normal subtitle.
- **Emphasise another word** lets you promote any word. It becomes a keyword at
  the larger size with the same hit.

**One thing to know before you delete a keyword.** Adding one is protected — if
the transcript later changes, the pipeline will refuse to throw your choice away.
**Deleting one is not**, because there is nothing left to mark. If you delete a
keyword and the transcript later changes, the analysis will put it back. Worth
knowing before you rely on a deletion.

**`ground-truth` and `test-3` will show no keywords**, and the panel will say
why: their analysis has not run yet. That costs about $0.18 a reel and is your
call, from step 1.
