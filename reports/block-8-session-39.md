Status: OK

Session 39. HEAD at the start `9ad4b49`, at the time of writing `47ba042`; this
report's own commit follows. Ledger **108 lines**, sha
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at both ends.
**$0.00 — no API call, no pipeline run, no reel re-planned, and After Effects was
not contacted.** One After Effects instance, zero `aerender`, no stray `-r` at
session start; unchanged at the end. Working tree clean at start. **Nothing was
deleted, moved or overwritten**: no cache entry, reference, plan, mask or image
was touched, and no plan file has been written since 03:03 this morning.

## Done

### Goal 1 — the exposure, then a backup command

**The test was applied rather than taken.** It is not "expensive" — it is **"no
amount of money reproduces this file"**. Almost everything here rebuilds from
the repository: masks are bit-identical across runs, extracted audio is ffmpeg,
every report regenerates from disk. Measured on this machine today:

| | files | size | in git | recovery |
|---|---:|---:|---|---|
| transcription cache entries | 22 | **8.1 MB** | no | **cannot** — ~$0.17/reel returns *different* words |
| keyword and slot analysis entries | 11 | 42 KB | no | **cannot identically** — ~$0.18/reel, three identical calls have given three answers |
| **hand-written ground truth** | 8 | 30 KB | **no** | **cannot** — a person transcribed four reels by ear |
| hand-made alignment references | 3 | 15 KB | **yes** | **cannot** — a human's verdicts |
| the cost ledger | 1 | 16 KB | no | **cannot** — a record of money actually spent |
| Edit Plans and their backups | 10 | 487 KB | no | **cannot as they stand** — they carry chosen candidates, promoted and removed keywords, edited words |
| generated images and cutouts | 39 | 44.6 MB | no | ~$1.55/reel, and different pictures |
| machine-local config (API keys) | 1 | 187 B | no | new keys can be issued |
| source video | 5 | **11.9 GB** | no | **cannot by this project at all** |

**Two findings beyond the brief's list.**

**`.local/ground-truth/` is the one nobody had named.** Four reels transcribed by
ear, the WER baseline for the entire project — and `.local/` is gitignored, so
this disk was the only copy and nothing anywhere said so. It is the same kind of
thing as the alignment references, and the references are the only irreplaceable
item that was already safe.

**The Edit Plans qualify too**, for a reason distinct from cost: they carry
decisions a person made, and re-deriving discards them.

Deliberately **not** in the set, and the tests say why: `.local/cv/` (598 MB of
frames and masks, bit-identical across runs and free), `.local/audio`,
`.local/bench-audio`, `.local/build/` and every `.aep`.

**`npm run backup`.** With no destination it prints the survey above and copies
nothing. `npm run backup -- --to <dir>` copies into `<dir>/framopia-studio/`,
preserving repo-relative paths; `--with-video` adds the footage. The default
destination is `backupDir` in `.local/config.json`, machine-local like every
other per-machine setting.

- **Every file is re-read from the destination and hashed after writing**, and a
  mismatch fails the whole run. A copy that silently truncated is worse than no
  copy, because it is a backup you would trust.
- **It never deletes anything.** A file already there whose hash matches is left
  alone, which makes a re-run a no-op.
- **A missing destination directory is an error and is never created** — a typo
  would otherwise make one and report a successful backup into it.

**Exercised into a temporary directory** (which copies, and deletes nothing):
95 files, 53.3 MB, verified, in **1.5 s**; the second run copied 0 and found all
95 identical. **The real backup was not run** — where it goes is the user's
choice, and a destination typed by me is a destination nobody checked.

### Goal 2 — a missing input refuses

**The full list of inputs whose absence produced a plausible-looking wrong
output**, found by walking the builder rather than by taking the two already
known:

| input | without it, the build | verdict |
|---|---|---|
| **face masks** | places every image against the frame — **2030 px on a 2160 px frame, across the speaker** — and `placementIsSafe` calls it safe | silent |
| **the CV sidecar venv** | same, plus the card frame colour is chosen from nothing | silent |
| **`.local/build/watermark.json`** | places no watermark at all, though the plan asks for one | one stdout line; the comp looks like one that never had a mark |
| **`dialogueLufs`/`dialoguePeakDbfs`** | does not bring the voice down, so every sound sums past 0 dBFS and clips | one stdout line; the mix is wrong |
| **a client mode** (none on the plan, none passed) | keeps the template's own frame colour, which measures 1.03:1 against the pictures | one stdout line; the frames disappear |
| **a `templateId` the manifest defines** | `introFor`/`minHoldFor` default to **0**, so the short-card rule compresses against nothing | fully silent — this one was not previously known |

`service/src/build/requirements.ts` is the one declaration, read by
`build-reel-cli.ts` before anything is placed and by `steps.ts` so the panel
shows the same sentence and disables Build. Each names itself, what the build
would otherwise do, and the command that produces it — and every one is
**conditional on what the comp actually contains**: a subtitles-only reel needs
no masks, a reel with no sounds needs no loudness, a plan that refuses the mark
needs no watermark measurement. A check that always fires is as wrong as one
that never can.

**`placementIsSafe` takes a required `Rect` now.** It was nullable and answered
`clearsFace: true` when null, which is exactly guidelines §3's "a check that
cannot fail is not a check". The two callers that could pass null no longer
compile without handling it, so it cannot be written that way again.

**No reel in the corpus refuses**, and that is worth saying plainly: all five
have every input they need, so the refusals rest on synthetic cases **plus one
real-absence test** — a plan copied to a stem nothing has ever sampled resolves
to a mask directory that genuinely is not there, and `readBuildDisk` reports it
missing. Ten unit tests and three browser tests.

**The corpus is unaffected, asserted rather than assumed.** All five reels still
report Build available with the same issue counts (8 / 5 / 3 / 2 / 0 missing),
`npm run place:images` still gives **`vitasilk` five pictures at 837 px and
`test-1` four at 917**, identical to session 38, and no plan file was written.

**The panel** shows what is missing as a card with each item's consequence and
its command, and disables Build. A service older than the check sends no
`missing` field, and **the panel does not read that as a clean bill of health** —
it says nothing about readiness rather than claiming the reel is ready.

## Deviations

**None.** Both goals landed in separate commits as asked, plus this report.

One thing worth noting rather than deviating: **core's test count rose from 463
to 466 without core being touched.** `core/src/messages.test.ts` runs `it.each`
over every `npm run …` that appears in a user-facing message, and this session
added three commands nobody had told a user to type before. The guard checked
them and they are all real scripts.

## Failures & open problems

**None from this session.** `npm run check` passes.

Unchanged and still open:

- **Frame analysis is still reported, not driven.** The runner names the three
  commands rather than running them; what changed is that a build no longer
  proceeds without their output. Block 8's DoD — video-in to built comp from the
  panel alone — is still not met, for that reason.
- **`dialogueLufs` still reaches a plan only through `npm run
  migrate:sfx-placement`.** It should be measured where the transcript is
  written.
- **The image prompt** — fidelity, darkness, literalness. Block 9.
- **`IMPACT_THRESHOLD`**; the 17 SFX events remain 8 frames late.

## Repo state

HEAD `47ba042`, working tree clean. Three commits this session:

- `59fad09 feat: back up what cannot be regenerated`
- `47ba042 feat: refuse a build whose measurements are missing`
- (this report's commit follows)

`npm run check` **passes**, counts measured per workspace rather than read off
one list: core **466**, service **1039**, benchmarks **166**, panel **167 passed
/ 2 skipped** — **1838 TypeScript tests** — plus **149 pytest**, the mode
validator, the panel manifest parse, the template validator and both model
checksums. The Chromium 99 capability denylist passes against the built
`panel/dist`.

Nothing was staged with `git add -A`. `templates/library.aep`, `align.ts`,
`correction.ts` and every hand-made reference file are untouched. `git log`
carries no AI attribution.

## Suggested next step

**Run the backup tonight.** Plug in whatever disk you want it on and run:

```
npm run backup -- --to /Volumes/<your disk>
```

It copies **53.3 MB** and takes about **two seconds**. To see what it will take
before choosing a disk, run `npm run backup` with no arguments — it prints the
list and copies nothing.

What it protects: the transcription cache entries, which are the only copy of
the transcript both hand-made references describe and which no amount of money
brings back; **the four ground-truth transcripts you wrote by ear, which are on
this disk and nowhere else**; the ledger; the Edit Plans with your choices on
them; and the generated images. It also copies `.local/config.json`, which holds
your API keys — **put the backup somewhere you would keep keys.**

Add `--with-video` if you want the 11.9 GB of footage in the same place; leave it
off if you already have it elsewhere. Set `backupDir` in `.local/config.json` and
you can then just run `npm run backup`.

To pick the work back up, reload as usual:

```
pkill -f "service/dist/service.js"
```

then close and reopen the panel in After Effects so it starts a fresh service.
Nothing about how the corpus builds has changed — `vitasilk` is still five
pictures at 837 px — but a reel that has never been through `npm run frames` and
`npm run segment` will now refuse at step 5 and name the commands, instead of
building a picture across your face.
