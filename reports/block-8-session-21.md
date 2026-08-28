Status: PROBLEM — the template impact frame cannot be measured without re-running the audit, and the audit closes the user's open After Effects project without saving. The SFX peaks are measured and the defect is confirmed and worse than expected; the placement rule is built and **not in force**.

Block 8 part 2, session 21. **$0.00 spent, no API was called, the pipeline was
not run, After Effects was not driven.**

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| `git status` at start | **no modified or staged files, and none untracked** |
| HEAD at start | `018b7a2` |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances at start | **1** |
| `aerender` processes at start | **0** |

`templates/library.aep` is untouched and no template keyframe was read into a
write. `align.ts`, `correction.ts` and both hand-made reference files are
untouched. The corpus stays pinned at guide v1.0.7.

## Done

### Goal 1 — every SFX file measured

`npm run sfx:measure` — free, local, ffmpeg and ffprobe through session 16's
resolver, never a bare name on `PATH`. It writes what it finds **into the
manifest**; no number here was typed by hand.

| id | codec | container | rate | duration | peak offset | peak | head delay | first audible | shape |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| `hit_01` | mp3 | mp3 | 48000 | 5.856 s / 175.5 f | **2.0525 s / 61.51 f** | −0.72 dBFS | 0.000000 s | 0.0478 s | middle |
| `hit_02` | pcm_s24le | wav | 96000 | 6.000 s / 179.8 f | 0.5433 s / 16.28 f | −0.03 dBFS | 0.000000 s | 0.5007 s | head |
| `whoosh_01` | pcm_s16le | wav | 96000 | 1.951 s / 58.5 f | 0.6913 s / 20.72 f | −1.23 dBFS | 0.000000 s | 0.3493 s | middle |
| `whoosh_02` | mp3 | mp3 | 44100 | 1.202 s / 36.0 f | 0.5581 s / 16.73 f | −8.39 dBFS | 0.000000 s | 0.1275 s | middle |

**The user's reasoning was right and the size of it is worse than the
hypothesis.** `hit_01` is bound to **every keyword on every reel**, and its
loudest point is **61.5 frames into the file**. The rule put the file's *start*
at the card's start plus 0.13 s (3.9 frames), so the hit's impact has been
landing about **2.05 s after the card it belongs to** — against a corpus whose
median card is 0.30 s, that is not "late", it is unrelated to the card.

**The mp3 padding hypothesis is not what is wrong.** Container delay measures
**0.000000 s** on both mp3s, so the head padding is either absent or already
compensated by the demuxer. Head delay and the sound's own quiet opening are
recorded as **separate fields** for exactly that reason — adding them would put
an error back rather than remove one. `hit_01` is audible from 47.8 ms and peaks
at 2.05 s: a long file whose loudest point is in its middle, not a padded one.

**Peak level is not the same question as peak position**, and both are recorded.
`whoosh_02` peaks at −8.39 dBFS where the others are near full scale, so it is
7 dB quieter before its −24 dB gain is applied.

**Shape**, for the whooshes: `whoosh_01` and `whoosh_02` both peak in the
**middle**, not at the tail, so neither is an arrival sweep that anchors at its
end. `hit_02` is the only file whose energy sits in its head.

**No container mismatch.** My first check compared codec to extension and
reported two false alarms; 24-bit PCM inside a `.wav` is a wav. Corrected to
compare the demuxed container, and every file is what its name claims.
Session 20's note that `hit_01` is an mp3 is confirmed and is what the manifest
already declared.

### Goal 2 — the impact frame could not be measured

`impactFrameOf` in `core/src/impact-frame.ts` derives it from the template's own
keyframes: the last key among Position, Scale and Opacity, which is where the
entrance settles. Pure, unit-tested, and it reads keys — **it never writes
one**.

**It returns null for all six comps, with a reason.**
`templates/library.audit.json` records keyframe **counts without times**, and a
count cannot answer where an entrance resolves. `audit.jsx` now emits every
key's `time` and `value`, with `AuditKeyframe` optional-with-default so an audit
taken before this session parses and reads as "not recorded" rather than as a
comp with no keyframes.

**The audit was not re-run, and this is the stop condition.**
`tools/validate-templates/audit.jsx:122` calls
`app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES)` — it closes whatever the
user has open, **without saving**. His instance is open, the session brief says
not to touch it, and there is no other path: nothing in this repo parses the
binary `.aep`. Estimating the impact frame from `introS` would be writing a
plausible number, which the hard stop forbids.

**What is needed:** `npm run audit:templates`, run when After Effects has
nothing unsaved in it. That regenerates `library.audit.json` with keyframe times
and `impactFrameOf` answers for all six comps immediately — the derivation and
its tests are already in place.

### Goal 3 — the rule is built, and it is not in force

`placeSfx` in `core/src/sfx-placement.ts`: **the file's measured peak lands on
the template's measured impact frame**, in-point derived from those two, never
authored.

- **Snapped to 29.97, ties rounding down — earlier.** A sound a fraction early
  reads as part of the impact; a fraction late reads as a separate event,
  because the eye has moved on. Half a frame is 16.7 ms, so the direction only
  decides the tie and it is spent on being early.
- **A peak later than the impact needs a negative in-point**, which a comp
  cannot have. The layer clamps to the comp's start and `clamped` /
  `clampedByS` report how late the peak then lands. With `hit_01` this is not a
  corner case: any keyword in the first ~2 s of a reel will clamp.
- Whooshes stay on images, hits on keywords, subtitles silent; gains unchanged
  at −20 and −24 dB.
- `deriveSfxEvents` remains the single generator.

**What the 0.13 s offset becomes: unknown, and it stays in force.** Answering it
needs the impact frame. What is now known is the other half: the offset was
being applied to the file's *start*, and `hit_01`'s impact is 61.5 frames after
that, so the error is at least 2.05 s regardless of what the impact frame turns
out to be — the offset was never the dominant term.

**The corpus was not re-derived, and no event moved.** 17 SFX events exist
across the five plans (ground-truth 0, test-1 6, test-2 3, test-3 0, vitasilk
8); all 17 are unchanged, because wiring the new rule in without an impact frame
would mean inventing one. **0 events moved, and that is a stop, not a result.**

Recorded in `docs/TEMPLATE_LIBRARY_GUIDE.md` and `docs/TEMPLATE_BUILD_SPEC.md`
in the watermark measurement's form, including a section stating plainly what is
still unmeasured.

### Goal 4 — a removed keyword stays removed

`keywords.removedWordIds`, **schema addition, optional with a default** —
absent means nothing has been removed by hand, which every existing plan is true
of. Validated only when present, and each id must name a real word so a stale
marker cannot outlive its word and suppress a different one.

Four things honour it:

- **`removeKeyword`** records the keyword's word ids.
- **`humanFlaggedItems`** reports each as `removed by a human`, so
  `PlanMergeBlockedError` refuses the clear the way it refuses to discard a
  promotion.
- **`clearBlocks`** carries the marker through a clear that discards the items:
  the items are the machine's, the removals are the human's.
- **The analysis stage filters a removed word out of its proposals** and logs
  that it did — without that, the block is protected and the next analysis run
  proposes the same keyword again.

**Promoting the word again clears the marker**, because that is the user
changing their mind rather than the marker outliving its decision. Seven tests,
including the case that was losing work: remove, change the transcript, merge,
and the marker survives the clear.

### Goal 5 — handed back

**`npm run service:build` and `npm run panel:build` both ran.** The capability
denylist passes against the built bundle and a raw grep of `panel/dist` returns
zero matches for every denylisted feature.

**The panel's SFX preview now plays from the peak**, seeking to 0.2 s before it
rather than starting at zero — `hit_01` was two seconds of run-up before the
sound being judged. The measured peak is also shown in the binding line, so the
fact that a file's impact is not at its start is visible on screen.

**Can he hear the difference yet? Only in the preview.** The build's placement
is unchanged, because the rule is not in force. The preview change is audible
immediately; the placement change is not audible anywhere until the audit is
re-run and the rule is wired in.

## Deviations

- **The stop condition fired on Goal 2's measurement**, so Goal 3 is a
  mechanism rather than a change in behaviour. I completed Goals 1, 4 and 5
  rather than stopping the session outright: Goal 1 is fully measurable and is
  the deliverable the brief calls the point of the session, and Goal 4 is
  independent of the audit. If the intent was to stop at Goal 2, this is the
  deviation to reverse.
- **The documentation for Goals 1–3 landed in Goal 4's commit.** The *code* is
  in separate commits as required (`1d185e8` and `950032a`), but the two
  template docs, `CLAUDE.md` and the peak-aware preview rode along with the
  removal marker because they touch the same files. This is the second session
  running with an untidy split and it is mine to do better.
- **My first container check reported two false mismatches** — comparing codec
  to extension, so `pcm_s24le` in a `.wav` looked wrong. Corrected before the
  table was written.

## Failures & open problems

- **Nothing was lost or destroyed.** No cache entry, ledger line, reference,
  plan, template, audit or image file was modified. `assets/sfx/sfx.json` gained
  measurements; no audio file was touched. The ledger is byte-identical.
- **Every hit in every built comp is currently misplaced by about 2.05 s**, and
  this session did not fix it — it measured it. `vitasilk`'s built comp, the
  only one that exists, has three hits in that state.
- **The impact frame is unmeasured** and the audit that would measure it
  destroys unsaved work in the open project. That is the blocker.
- **Peak may not be the right anchor for `hit_01`.** The brief specifies peak,
  and peak is what is measured — but a percussive hit is normally anchored on
  its **onset**, and this file is audible from 47.8 ms while peaking at 2.05 s.
  Aligning its peak means starting the layer 2 s before the card. That is a
  question about whether `hit_01` is the right file for the job, and it is the
  user's.
- **`whoosh_02` peaks 7 dB below the others** before its gain is applied, so the
  two whooshes are not level-matched. Measured, not acted on.
- **`PREVIEW_LEAD_S = 0.2` is chosen, not measured.**
- **The preview's peak seek is unverified on CEP** — it works in Playwright's
  Chromium; only the user's machine confirms CEP's.
- Carried forward: rulings 1 and 3 are Block 9; headless AE is not met; the
  runner has never run for real; `redo` has no control in the panel.

## Repo state

- Branch **`main`**, worked on `main`. No force-push, no history rewritten.
- HEAD at the time of writing: **`950032a` `feat: keep a removed keyword
  removed`**, preceded by `feat: measure every sfx peak and derive placement
  from it`, on session 20's `018b7a2`. **This report's own commit follows it.**
- `git log` checked for AI attribution and co-author trailers: none.
- `npm run check`: **exit 0, `check: PASS`**, read before committing —
  `@framopia/core` **381** (25 files), `framopia-service` **898** (63 files),
  `framopia-benchmarks` **166** (16 files), `framopia-panel` **131** passed + 2
  skipped (7 files), **1576 TS total** against session 20's 1553; pytest
  **141**, unchanged.
- New: `tools/measure-sfx/cli.ts`, `core/src/sfx-placement.ts` (+ test),
  `core/src/impact-frame.ts`, `core/src/sfx-measure.test.ts`. New command
  `npm run sfx:measure`. Changed: `assets/sfx/sfx.json` (measurements),
  `tools/validate-templates/audit.jsx`, `core/src/templates.ts`,
  `service/src/keyword-view.ts`, `service/src/editplan/{types,validate,merge}.ts`,
  `service/src/analysis/job.ts`, `panel/src/{Keywords.tsx,types.ts}`, both
  template docs, `CLAUDE.md`.
- Both `service/dist` and `panel/dist` rebuilt this session.
- Ledger `.local/costs.jsonl`: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at start
  and end. All-time spend unchanged at **$10.968590**.
- After Effects: **1 instance**, **0** `aerender`, not driven.

## Suggested next step

Re-run the audit when After Effects has nothing unsaved in it — `npm run
audit:templates` — and the impact frame answers for all six comps immediately;
the derivation and its tests are already in place. Then wire `placeSfx` into
`deriveSfxEvents`, re-derive the five plans and report the movement in frames,
which is the half of this session that could not be done. Before that, settle
whether `hit_01` is the right file at all: aligning a peak 2 s into a 5.9 s file
means every hit's layer starts 2 s before its card and clamps for anything in
the reel's first two seconds. A shorter hit whose transient is near its head
would make the rule ordinary instead of extreme.

## What the user does next

**Restart the service, then the panel.** Both were rebuilt.

1. In a terminal: `kill 53415` (the service currently registered;
   `cat .local/service.json` names it if it has changed).
2. In After Effects: Window → Extensions → untick **Framopia Studio**, then open
   it again from the same menu. Let the panel start the service, not a terminal.

**You were right, and it is worse than you thought.** I measured all four sound
files. `hit_01` — the one every keyword uses — has its loudest point **2.05
seconds into the file**. The system was starting that file 0.13 s after the
card, so the actual impact has been landing **about two seconds after the word
it belongs to**, on every reel. Your cards average a third of a second, so the
hit was not late; it was somewhere else entirely.

**It was not the mp3 padding.** That was a good hypothesis and the measurement
says no: the padding measures zero. The file simply has two seconds of sound
before its loudest moment.

**I could not finish the fix, and I want to be direct about why.** Putting the
sound's peak on the animation's impact needs to know when each template's
animation lands. Reading that means re-running the template audit — and the
audit **closes whatever you have open in After Effects without saving it**. You
have AE open, so I stopped rather than risk your work or invent a number.

**When After Effects has nothing unsaved in it, run:** `npm run audit:templates`
Then the next session can finish it. Everything else is ready and waiting on
that one measurement.

**One question that is yours, not mine.** Aligning `hit_01`'s peak means its
audio layer has to start two seconds *before* the word — and for any keyword in
the first two seconds of a reel, that is impossible, so the hit will land late
no matter what. A percussive hit is normally anchored on its first attack, not
its loudest point. It may be that `hit_01` is simply the wrong file for this
job: a shorter hit that starts with its impact would make all of this ordinary.
`hit_02` is one — its energy is in its head, and its peak is half a second in
rather than two.

**Two small things you can see now.** The keyword picker shows each sound's
measured peak, and the **Play** button now starts just before the impact instead
of playing two seconds of run-up. And deleting a keyword is finally safe: it
stays deleted through a transcript change and a re-run, which it did not before.
