Status: PROBLEM — templates/library.audit.json does not record TXT_MAIN's position, so the comp builder was not written

# Block 7 session 2 — sfx collected, beeps located, the builder blocked

Spent **$0.00**. No Gemini call, no ElevenLabs call, no billable request. The
cost ledger is byte-identical at both ends: **108 lines**, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.
`templates/library.aep` is byte-identical at both ends: sha256
`dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa`.

All six hard stop conditions were checked before any work. The T7 Shield was
mounted and the working directory confirmed; the ledger matched on line count
and hash; `main` and `origin/main` were both at `bd18832` with a clean tree;
**After Effects 26.0x67 was already running and executing `DoScript`**,
verified by a probe script that wrote its own output to a temp file.

**The session's headline goal — place one subtitle card and look at it — did
not happen.** A stop condition inside Goal 4 fired. Goals 1, 2 and 3 are
complete; Goal 4 is complete only as far as its measurement half; Goal 5 was
not attempted. Details under Failures.

## Done

### Goal 1 — the SFX files

**Every file found**, all four plus a `.DS_Store` that was ignored:

| file | bytes | codec | rate | ch | duration s | mean vol | max vol |
|---|---:|---|---:|---:|---:|---:|---:|
| `hit-2.mp3` | 234,240 | mp3 (320 kb/s) | 48000 | 2 | 5.856000 | −15.3 dB | −0.3 dB |
| `hit-2.wav` | 3,461,654 | pcm_s24le | 96000 | 2 | 6.000000 | −14.6 dB | 0.0 dB |
| `whoosh-1.wav` | 749,316 | pcm_s16le | 96000 | 2 | 1.951229 | −18.3 dB | 0.0 dB |
| `whoosh-2.mp3` | 38,452 | mp3 (256 kb/s) | 44100 | 2 | 1.201625 | −28.1 dB | −8.4 dB |

**Nothing was converted, normalised or re-encoded.** The mp3s stay mp3, at
their own sample rates. The set is mixed: 44.1/48/96 kHz, 16/24-bit, two
formats. Two of the four peak at exactly 0.0 dB, which is worth knowing before
any of them is placed at a gain.

**The "different sounds" claim was verified, not assumed.** Both `hit-2` files
were decoded to mono 32-bit float at 48 kHz and compared:

| measure | result |
|---|---|
| duration | mp3 5.8560 s, wav 6.0000 s |
| peak / rms | mp3 1.3022 / 0.238401, wav 1.4091 / 0.234410 |
| energy above 1% of peak | mp3 spans 1.06–5.10 s, wav spans 0.50–4.27 s |
| envelope peak | mp3 at 2.49 s, wav at 0.59 s |
| **best waveform NCC** (lag searched ±0.2 s) | **0.0537** |
| best envelope NCC (10 ms hops, lag searched ±1 s) | 0.4518 at −930 ms |
| spectral centroid at onset | mp3 555 Hz, wav 136 Hz |

The similarity measure is **normalised cross-correlation** (Pearson
correlation of the two signals, mean-removed, with a lag search). Identical
audio correlates at ~1.0; these correlate at **0.0537** on the waveform. The
0.4518 envelope figure is "both are broadly hit-shaped", reached only at a
930 ms lag, and is not evidence of identity. The user's claim holds and the
measurement did not contradict it, so `sfx.json` was written.

**The mapping. Nothing else in the repo records which original became which**,
so it is here and in `CLAUDE.md`. The rule is sorted-filename order; each file
keeps its original extension.

| source filename | repo filename | sha256 (source = copy, verified) |
|---|---|---|
| `hit-2.mp3` | `assets/sfx/hit_01.mp3` | `67bd3984567f11926e2e8157ca7e077839444a97e04d4d44e8636733479ebba0` |
| `hit-2.wav` | `assets/sfx/hit_02.wav` | `08b9483c35f3cc253354a574631e27a65e8221eda6a3e8e4583df5d9216e4294` |
| `whoosh-1.wav` | `assets/sfx/whoosh_01.wav` | `9ed0c7ecadf1d0b676ae8f6986adebe95ce78461a76e7dfa168216f7b232398a` |
| `whoosh-2.mp3` | `assets/sfx/whoosh_02.mp3` | `64c4ea6f62da8f7f7e05b0c47dd43276bdde692af755daec87c75fbebf64dbd2` |

All four copies' sha256 match their sources exactly. **The originals in
`~/Documents/sfx` were not moved, renamed, modified or deleted** — re-listed
after copying, all four present with their original 2024 timestamps and sizes.

`assets/sfx/sfx.json` is a real index: `stub: false`, four entries, gains
**−20 dB on the hits and −24 dB on the whooshes** as the user set them. That
they are starting values lives in the file's own structure as a `gainNote`
field, not a comment:

> `defaultGainDb` values are starting points chosen by the user before any comp
> existed, deliberately quiet so a sound never competes with speech. They are
> to be judged by ear on a built comp and are expected to move.

**`templates/manifest.json` was not touched.** All six entries keep `sfx: []`.
**No validator failed as a result**, and that is itself the answer to the
question the goal asked: `npm run validate:modes` and `npm run
validate:templates` both pass, because `validateTemplateManifest` only checks
that a *declared* `sfxId` exists in the index — a template declaring none is
never compared against it.

**Two on-disk tests did fail, correctly, and were updated.**
`core/src/templates.test.ts` pinned the SFX index as a stub with exactly
`['hit_01', 'whoosh_01']`. Both assertions were pinning the stub state, not a
property worth preserving; they now assert four ids and `stub: false`, and a
new test asserts that **every id names a file that is actually on disk** —
which nothing checked before.

**Goal 1.7 — does a real index change what `assertRenderable` guards? No.** It
throws only on `manifest.stub`, which has been `false` since Block 6 session 7,
so it has guarded nothing since then and still guards nothing.
`SfxIndex.stub` is validated as a boolean by `validateSfxIndex` and **read by
no code path at all** — a grep for its consumers finds none. Nothing has ever
checked that an sfx file exists before a build; the new test above checks it at
`npm run check` time, which is not the same as a build-time gate. **No guard
was implemented**, per instruction.

### Goal 2 — the watermark's beeps

`tools/measure-watermark/cli.ts` was extended (no second tool) and emits
everything into `benchmarks/RESULTS-block7-watermark.md` §3b.

Method: the audio decoded to mono 32-bit float at 48 kHz, an RMS envelope over
**1 ms hops** (2035 points across the clip), and bursts taken as runs above a
fraction of the envelope peak (0.92569) with runs closer than **30 ms** joined.

**Three bursts** at the reported threshold of 5% of peak:

| beep | start s | end s | peak s | start f | end f | peak rms |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0.033 | 0.133 | 0.085 | 0.99 | 3.99 | 0.92569 |
| 2 | 0.166 | 0.267 | 0.217 | 4.98 | 8.00 | 0.92246 |
| 3 | 0.300 | 0.400 | 0.352 | 8.99 | 11.99 | 0.92244 |

**Sensitivity — six thresholds, not three:**

| threshold | bursts |
|---:|---:|
| 1% | 1 |
| 2% | 1 |
| 5% | **3** |
| 10% | **3** |
| 20% | **3** |
| 30% | **3** |

**The count holds at 3 from 5% up.** It collapses to 1 at 1–2% because the
beeps ring down into each other: the envelope floor in the gaps never drops
below about 0.9% of peak (measured: 0.92% and 0.94%), and after 0.460 s the
envelope's maximum is 0.854% of peak. That is a property of the decay tails,
not a different number of beeps, and the results file says so.

**The 30 ms merge gap is measured, not chosen.** Each beep is a two-pulse tone:
at 20–30% threshold with a 5 ms gap the detector finds **six** bursts, whose
intra-beep pulses sit about 22 ms apart while the silence between beeps is
about 33 ms. 30 ms is the only value that separates beeps without splitting
one. Had the gap been picked at 5 or 10 ms the count would have read 6 or 10 at
some thresholds — the parameter is load-bearing and is documented at its
declaration.

**The derived figure:**

| | seconds | frames at 30000/1001 |
|---|---:|---:|
| last beep ends | 0.400 | 11.99 |
| + 1.000 s | **1.400** | **41.96** |
| the video is | 2.035367 | 61 |

**Inside the video's own length, with 0.635 s (19.04 frames) to spare.** The
overlay can run to its ruled end without the file being extended, frozen or
held. The feared conflict does not exist. The end time carries a spread —
0.368 to 0.400 s across the thresholds that agree on the count — and the
results file reports it as ±.

### Goal 3 — what the image cache key must contain

**Current inputs, verbatim**, from `service/src/images/fingerprint.ts`, hashed
as a fixed-order array: `prompt`, `negativePrompt`, `modelId`, `resolution`,
`aspectRatio`, `candidateIndex`, `modeId`.

**All five named fields are in the key. No defect.** Five new tests, one per
field, each built on the frozen production config (`gemini-3-pro-image`, 2K,
1:1) rather than the file's generic fixture, so a drift away from the frozen
values fails against the values that are actually billed:

- the model pin — `gemini-3-pro-image` → `gemini-3.1-flash-image`
- the image size — 2K → 1K
- the aspect ratio — 1:1 → 9:16
- the composed prompt
- the negative prompt

They are written as a separate `describe` rather than folded into the existing
omnibus "changes when any single input changes" test, because a silent drop of
one of these does not fail anything visible — it serves one slot's image for a
different request.

**Goal 3.3 — no cache-only mode exists, and nothing was run.** `images-cli.ts`
has `--probe`, but it is not a dry run: it calls `generateImagesForPlan` with
`limit: 1` and **generates that candidate, billing on a miss**. It covers one
candidate, so it cannot report the 10-hit/0-miss result the goal describes. The
"N already cached, M to generate" line is printed by `formatEstimate` *inside*
`generateImages`, after the ceiling check and before generation, so there is no
way to reach it without committing to a billable run. There is no `--dry-run`
and no cache-report tool. **Per instruction, nothing was run**; session 1's
verification by recomputation remains the only evidence that the 14 migrated
entries hit.

### Goal 4.1 — the chosen subtitle group

Selected from `my files/test videos/vitasilk.editplan.json` against all four
criteria:

| | |
|---|---|
| id | `g027` |
| wordIds | `w0045`, `w0046` |
| text | `dernière génération` |
| start / end | 14.439 s / 15.319 s |
| **displayStart / displayEnd** | **absent — see below** |
| script | `latin` (both words), lang `fr` |
| templateId | `sub_pop` |
| supersededBy | `null` |
| position in reel | group 27 of 41 — mid-reel |
| display duration | 0.880 s, against a 0.23 s floor |

29 of the 41 groups met all four criteria; `g027` was taken as a clear
mid-reel two-word Latin group that is not superseded by a keyword.

Retiming under guide §5 as written would have been `inPoint` = 14.439 − 0.13 =
**14.309 s**, `outPoint` = **15.319 s**. Not applied — see Failures.

### Goal 4.4 — what each retiming reading costs

`service/src/analysis/retiming.ts` (pure, 8 unit tests) and
`retiming-cli.ts`, wired to `npm run retiming`, writing
`benchmarks/RESULTS-block7-retiming.md`. Free, local, read-only; no plan was
modified.

**Reading A — `inPoint = displayStart − introS`** (guide §5 as written):

| reel | groups | pairs overlapping | min s | median s | max s |
|---|---:|---:|---:|---:|---:|
| ground-truth | 40 | 35/39 (90%) | 0.050 | 0.091 | 0.124 |
| test-1 | 44 | 39/43 (91%) | 0.009 | 0.090 | 0.130 |
| test-2 | 38 | 33/37 (89%) | 0.010 | 0.090 | 0.111 |
| test-3 | 31 | 23/30 (77%) | 0.031 | 0.090 | 0.130 |
| vitasilk | 41 | 32/40 (80%) | 0.010 | 0.069 | 0.111 |
| **all** | 194 | **162/189 (86%)** | 0.009 | — | 0.130 |

**Reading B — `inPoint = displayStart`**: **0/189 (0%)** on every reel.

The maximum overlap, 0.130 s, is exactly `introS` — the case where the previous
card is still fully held for the whole of the next card's intro.

**Changed nothing, recommend nothing.** Two qualifications the file states:
**no plan in the corpus stores display timing** — `displayStart` is absent on
all 194 groups across all five reels — so every figure is measured on speech
windows, and writing display timing extends `displayEnd` into silence, which
can only raise reading A's count. And 42 groups carry no `templateId`; they
used the subtitle fallback `introS` of 0.13 s, which is not a guess because all
four text templates declare the same value, and the report says which case
applies.

The pooled median is deliberately left blank: a median of per-reel medians is
not a median.

## Deviations

1. **The brief says `vitasilk.editplan.json` carries "subtitle groups with
   display timing". It does not.** `displayStart` is `null`/absent on 0 of 41
   groups — in fact on all 194 groups of all five reels. This matches what
   `CLAUDE.md` already records from Block 6 session 1 and contradicts the
   session brief. Consequence: the display window falls back to the speech
   window everywhere, which is what `displayWindow()` does, so `g027`'s
   retiming and every figure in Goal 4.4 are computed on speech timings.
   Reported rather than worked around; nothing was written to any plan.

2. **Goal 4.4 was implemented as a committed tool rather than a throwaway
   script.** The goal asked only for numbers in a results file. A results file
   whose generator is not committed cannot be regenerated or audited, and the
   repo's §3 rule is that anything asserting a verified property is emitted by
   the thing that verifies it. It follows the `timing-budget` precedent
   exactly, so it is not a new pattern.

3. **Goal 1's copy step forced two `core` test updates.** Not optional: the
   tests asserted the SFX index was a stub with two specific ids. They are now
   pinned to the real index, plus a new assertion that each id's file exists.

4. **One unpushed commit was amended.** `feat: measure what each retiming
   reading costs in overlaps` was committed before `tsc --noEmit` was run and
   failed strict index checking under `noUncheckedIndexedAccess`. It was fixed
   and amended rather than followed by a fixup, because it had not been pushed
   and a commit that does not typecheck is not a coherent unit. No pushed
   history was rewritten.

## Failures & open problems

### The blocker: the audit does not record layer positions

**Goal 4.3 step 9's stop condition fired, and this is why no comp was built.**

`templates/library.audit.json` records, for each comp, `name`, `frameRate`,
`width`, `height`, `duration`, and a `layers` array whose entries are
**`{ name, kind }` and nothing else**. `sub_pop`'s entry is:

```json
{ "name": "sub_pop", "frameRate": 29.9700012207031, "width": 2160,
  "height": 1100, "duration": 2.002002002002,
  "layers": [ { "name": "TXT_MAIN", "kind": "text" } ] }
```

There is no `position` and no `anchorPoint`. The cause is one line in
`tools/validate-templates/audit.jsx`:

```javascript
layers.push({ name: layer.name, kind: kind });
```

Without `TXT_MAIN`'s position inside the 2160×1100 comp there is no way to
compute where that comp layer must sit inside the 2160×3840 master for the text
baseline to land on `SUBTITLE_ANCHOR_BASELINE_Y` (1080, 2480.4). The
instruction forbade both workarounds — measuring by hand in the AEP, and
assuming the layer is centred — and a third workaround (extending the audit
myself and re-running it) is still a workaround, so the stop was honoured.

**What was therefore not done, and is not claimed:**

- `panel/jsx/build.jsx` **does not exist.** No ExtendScript was written.
- `service/src/build/` **does not exist.** `npm run build:comp` **does not
  exist.**
- **No After Effects work of any kind was performed.** AE was confirmed running
  and confirmed to execute `DoScript` by a read-only probe, and then left
  alone. No project was created, no item imported, nothing saved.
- **Goal 4.5's six observations are all still unobserved**: the master comp's
  fps as AE stores it, in/out points as AE reports them, layer position and
  resulting baseline, keyframe survival across comp duplication, whether the
  Source Text swap disturbs font/size/alignment, and whether the original
  `sub_pop` survives duplication untouched.
- **Goal 4.6's three error paths were not exercised.** The structured
  `{ok:false, stage, message}` contract is unproven because the code that would
  implement it was not written. No JSON is quoted in this report because none
  was produced.
- **Goal 5 was not attempted.** Whether a solid `IMG_MAIN` accepts a replaced
  source is still an open claim about AE's API that this pipeline has never
  demonstrated. It is predicated on "the same project" that Goal 4 was to
  create. It is independently answerable and needs roughly one script.
- **`.local/build/vitasilk-probe.aep` was not created.** `.gitignore` was
  confirmed to cover it (`git check-ignore` matches on `.local/`), but nothing
  was written there.
- **After Effects is NOT open at the end of this session, and the requirement
  to leave it open is unmet.** It was running and responsive throughout the
  work, and was still running at the final verification. It then quit on its
  own: a background process from a **previous** session — the `-r quit.jsx`
  experiment, still resident at PID 81857 when this session began — exited
  `rc=0` after this session's last check. Its script body is `app.quit()`, so
  that is what closed the application. Nothing of this session's was lost,
  because no AE work was done. AE was **not relaunched**: stop condition 4
  forbids launching it.

- **That exit is also a correction to a documented constraint.** The repo
  records, from Block 6 session 7, that launching with `-r` "does not work on
  this machine" because a script whose whole body is `app.quit()` "left AE
  running for 120 s". The 120 s was a **timeout, not proof that the script
  never runs** — the same invocation did eventually execute and exit cleanly,
  across a session boundary. What is *not* known is when it executed or what
  unblocked it, so the operational conclusion is unchanged: `-r` is unusable
  for driving a build, and `DoScript` into a running instance remains the
  mechanism. But the reason is "unusably slow / unpredictable", not "never
  executes", and a future session should not expect an `-r` process to stay
  inert — this one quit the application out from under a later session.

**Nothing was lost or destroyed.** No cache entry, no file, no ledger line, no
plan. `templates/library.aep` is byte-identical. The four SFX originals are
present and unmodified.

### Other open problems

- **The AppleScript driver is machine-specific**, and this was going to be
  noted from Goal 4.2 whether or not the builder was written.
  `tools/validate-templates/cli.ts` names `Adobe After Effects 2026` as a
  literal string in a `tell application` line. Any other AE version, or a
  differently-named install, silently fails to find the app. Block 10's DoD is
  a golden run green on two machines, and this is one of the things that will
  not survive the second machine unmodified. Launching with `-r` remains broken
  here: a stale `-r` process from a previous session was still resident when
  this one began.

- **No plan stores display timing**, as above. `applyDisplayTiming` exists and
  has never written to the corpus.

- **`assertRenderable` guards nothing**, and now there is a real SFX index with
  real audio behind it and still no build-time check that a bound sound exists.
  Unchanged by instruction.

- **The SFX set is heterogeneous**: 44.1/48/96 kHz, 16- and 24-bit, two
  formats, two files peaking at exactly 0.0 dB. Nothing has been decided about
  whether AE should be handed these directly.

- Carried forward untouched: whole-term grouping is unimplemented (11 §6 terms
  render split); the pipeline is 4K-only; `npm run validate-plan` reports 11
  duration failures where `npm run timing-budget` reports 7 (**trust the 7**);
  the image gate's yield on vitasilk was 2/10.

## Repo state

- Branch `main`, working tree clean.
- HEAD at the time of writing: `docs: record block 7 session 2 in the operating
  memory`. **This report's own commit follows it** — a report cannot name the
  commit that contains it.
- Commits this session, in order: `chore: add the four sfx source files`;
  `feat: make the sfx index real`; `feat: locate the watermark beeps and derive
  its display end`; `test: pin the frozen image config into the cache key`;
  `feat: measure what each retiming reading costs in overlaps`; `test: pin the
  sfx index as real, with its files on disk`; `docs: record block 7 session 2
  in the operating memory`.
- `npm run check`: **exit 0, `check: PASS`**. TypeScript **944 passed** across
  66 files (core 146 / 6, service 632 / 44, benchmarks 166 / 16); Python **141
  passed**. Modes, manifest and `validate-templates` ok; all four references
  `v1.0.8-conformant`; both model pins ok.
- Cost ledger: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — identical
  to the start-of-session values. **Nothing billed.**
- `templates/library.aep`: sha256
  `dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa` — identical
  to the start-of-session value. Never opened, never written.
- No AI attribution in any commit; `git log` checked before pushing.

## Suggested next step

Unblock the builder by making the audit emit what it already knows. One change
to `tools/validate-templates/audit.jsx` — push each layer's `Position` and
`Anchor Point` alongside `name` and `kind` — plus the matching widening of
`AuditLayer` in `core/src/templates.ts`, then `npm run audit:templates` to
regenerate `library.audit.json` against the unchanged AEP. That is the right
place for it: the §3 rule in `CLAUDE_CODE_GUIDELINES.md` says a property is
asserted by the thing that verifies it, and the audit is that thing, so
position becomes a checked fact rather than a number someone typed. With that
in hand, the whole of Goal 4 and Goal 5 are one session's work and need no new
decisions — the group is already chosen, the retiming arithmetic is already
computed, and the only judgement left is the user's eye on which retiming
reading looks right, which needs a card on screen to judge.

## What to look at in After Effects

**Nothing — and After Effects has closed itself, which was not meant to
happen.** There is no built project to look at, and the application is no
longer running.

It closed on its own. A leftover background process from an earlier session was
still sitting there when today started, holding a one-line instruction to quit
After Effects; it finally ran, after this session had already finished its
checks. Nothing of today's was lost, because nothing had been built in After
Effects yet. It was deliberately not restarted, since the session rules say not
to launch it.

The reason is small and fixable. To put a subtitle card in the right place on a
4K frame, the system has to know where the words sit inside the template comp.
The tool that reads the template file records each layer's *name* and *type*,
but not *where it is*. So the card could have been placed in roughly the right
area by guessing, and the instruction was not to guess — a subtitle two hundred
pixels off is worse than no subtitle, because it looks like it works.

So today produced measurements instead, and three of them are worth knowing:

**The watermark's timing works out.** Its three beeps land in the first
four-tenths of a second, and your rule — it leaves the screen one second after
the last beep — puts its exit at 1.4 seconds. The file itself is 2 seconds
long, so there is about two-thirds of a second to spare. Nothing needs to be
stretched or frozen. That was the thing that might have gone wrong, and it
didn't.

**Your four sound effects are in.** The two "hit" files really are different
sounds, not one sound saved twice — that was checked properly, and they are not
remotely alike. They have been renamed so they can never be confused again, and
the originals in your Documents folder are untouched.

**There is a real question waiting for your eye.** Subtitle cards all appear in
the same spot. If each card starts animating in slightly *before* its words are
spoken — which is what the template guide says to do — then on 86% of card
changes, the new card starts appearing while the old one is still up. Two cards
on top of each other, for up to a tenth of a second. The alternative is to
start each card exactly when its words are spoken, which never overlaps but
means the card is still fading in as you begin hearing the word. Neither is
obviously right, and no amount of arithmetic settles it. You will need to see
both on screen and say which reads better — which is the first thing worth
doing once a card can actually be placed.
