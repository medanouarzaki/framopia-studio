Status: OK

# Block 9 session 14 — the block is closed

**Spent $0.00. No API was called and `appendCost` did not fire.** After Effects
was driven only through `DoScript` into the already-running instance.

**One thing to know up front: the open project is left dirty.** It is
`.local/build/vitasilk-full.aep`, the build's own last output, and it was clean
when the session began. Measuring the keyword widths (§4) adds a temporary comp
and removes it again; After Effects marks a project modified as soon as anything
is added and **that flag is read-only from a script**, so it cannot be put back.
The temporary comp is gone — 97 items before and after, 0 probe comps left — and
nothing is at risk: that file is a build output and rebuilding it is free.

## 1. Backup

`npm run backup` ran first, before anything else, and **succeeded**. Google Drive
is running; it did not refuse.

```
Total to copy: 104.5 MB
Copying into .../GoogleDrive-…/My Drive/framopia-studio
41 copied (70.4 MB), 77 already there and identical, 0 failed verification.
Took 0.3s, about 205.8 MB a second.

Not copied, because this is a cloud folder and this file holds a key:
  .local/config.json — a credential-shaped value in a field named like a credential

Every file was re-read from the destination and matched by sha256.
Every copied file has its bytes on this machine as well as in Drive, checked file by file.
```

Source video is excluded by default (11.9 GB, `--with-video` adds it).

## 2. Stop conditions

| | start | end |
|---|---|---|
| mount | `pwd` and `git rev-parse --show-toplevel` agree | agree |
| ledger | **116 lines**, `e5e0a6e9d6735188065fdbcb33bb9211cf1fc95a5cbc23b192ad246299c132cb` | **byte-identical** |
| `appendCost` | — | **never fired**; 116 lines at both ends |
| cache census | 44 entries | **identical**, `diff` empty |
| cutout files | 19 files, `31a5baa205382f1b54f8c56e…` | **identical**, `diff` empty |
| After Effects | 1 instance, **pid 79146** | 1 instance, **pid 79146** |
| `aerender` | 0 | 0 |
| `templates/library.aep` | `1d7553e894e10f82051131e8…` | **identical** |

`.local/ground-truth/` was not touched and no hand-made reference was
regenerated.

## 3. The build's output path

**The defect was in the ExtendScript, and both layers above it were already
correct.** `build-reel.jsx` saved the project with `app.project.save(new
File(o.savePath))` and then built a result object that **did not contain
`savePath`**. So `readSavePath(stdout)` — which is itself unit-tested and works —
found nothing, `BuildProgress.savePath` was `null`, and the panel's
`Saved to {detail.savePath}` sentence rendered empty. It had been empty for as
long as it had existed, and nothing noticed because the sentence simply
disappeared rather than showing a wrong value.

*My session 13 report said the job reported `outputPath: (none)`. That was my
probe reading the wrong field name — `outputPath` belongs to the build
**preview**, not the job — but the underlying fault was real and is the one fixed
here.*

**The path is read back, not echoed.** The jsx now takes
`app.project.file ? app.project.file.fsName : o.savePath` immediately after
saving: `app.project.file` is the only thing that knows where After Effects
actually wrote, and guidelines §3 requires that whatever asserts a property is
emitted by the thing that verifies it. It falls back to the requested path rather
than reporting nothing.

**The panel treats it as the deliverable, because it is.** Nothing here renders,
so a saved `.aep` is how a reel leaves the system:

```
Built in 1.3s.
Your composition is here
/repo/.local/build/vitasilk-full.aep
It is open in After Effects now, and nothing was rendered.
```

The path is its own element, monospaced, selectable and allowed to break
anywhere — these paths contain spaces and are longer than the panel. If the build
ever finishes without saying where it saved, the panel says that plainly instead
of showing nothing.

**A second correction found while doing it:** the panel said *"the project was not
opened"*. It is. `build-reel.jsx` starts a new project, builds into it and saves,
so After Effects holds the built file when the build finishes — as it does right
now. The sentence was wrong and now says so.

**No reveal-in-Finder control was added.** CEP runs Chromium 99.0.4844.84 and
whether it can reveal a file has never been proven on this host, so nothing
claims it; a browser test asserts the button is absent.

Pinned by `core/src/build-save-path.test.ts` (3 tests), which reads the jsx source
the way the audit's refusals are pinned — the behaviour lives inside After Effects
and no test here can run it. The browser test now asserts the rendered path
element rather than the old sentence.

## 4. The handoff

**`handoffs/block-9.md`** — 389 lines, following `docs/HANDOFF_PROTOCOL.md` §4.

It carries: status against BLOCKS.md itemised (**two DoD items not met** — the
vocabulary-to-keyterm wiring, and the second-machine sharing doc); what each of
the 13 sessions built; **ten decisions with their reasons**, six the user's and
four the conversation's; the amendments applied to docs; **the six defect shapes
this block cost a session to**, each with what it looked like while it was
happening and the note that every one reported success or passed a check while it
was wrong; what is applied and unobserved; what was never reached; the budget; and
the risks a second machine will meet.

**One figure in the brief was wrong and I corrected it by measuring.** The brief
said three keywords in the corpus overflow one line. **It is two.** Measured in
After Effects through `tools/ae/measure-widths.jsx`, every keyword at the face and
size `textStyleFor` would give it, against `SUBTITLE_SAFE_WIDTH` 1940:

| keyword | face | width | |
|---|---|---:|---|
| `test-1` k002 `محفزات الكولاجين` | Almarai-Bold 455 | **3471.2 px** | **overflows, wrapped** |
| `test-2` k002 `ترطيب عميق` | Almarai-Bold 455 | **2449.7 px** | **overflows, wrapped** |
| `test-2` k003 `شد خفيف` | Almarai-Bold 455 | 1921.0 px | fits, by **19 px** |
| `vitasilk` k001 `filler glow` | Cormorant 494.742 | 1816.0 px | fits |
| `vitasilk` k002 `Vita Silk` | Cormorant 494.742 | 1547.4 px | fits |
| `test-1` k001, `test-2` k001, `vitasilk` k003 | | 673–1405 px | fit |

Both overflowing keywords are two-word Arabic spans, and a third sits 19 px under
the bound, so a slightly longer Arabic term joins them. PROJECT_SPEC §3's ruling
3 says an overlong word **shrinks**; these **wrap**, so the corpus contradicts the
ruling today. `filler glow` fits at the ruled 1.1641 and wrapped at the retired
1.3479, which is consistent with session 11's observation.

`OVERLONG_WORD_CHARS = 11` is recorded as a character-count proxy for a width only
After Effects can measure, and that a third face made it worse.

## 5. The Block 10 opening prompt

**`handoffs/block-10-opening-prompt.md`** — 180 lines, self-contained, in the
shape of the brief that opened Block 9.

It states what a golden run must prove; **what must be identical between the two
machines and what may legitimately differ** (paths, timestamps, tool versions, the
float32 frame-rate storage two comps in this project already disagree on, and
generated image bytes, which is why the golden reel must be one that cache-hits);
that **the partner's machine has never run this software** and nothing may be
assumed present; the carry-over that gates the block; the budget with the explicit
warning that $6.82 does not stretch to both a full second reel and a generous
golden run; the standing rules; and the reporting convention.

**The two unfinished subtitle rulings are stated as Block 10 work**, in their own
section with the measured evidence above, not as afterthoughts.

## 6. The ARCHITECTURE correction

§6 said a cache key includes the mode version. **It does not, and the code stopped
keying on it twice** — Block 4 session 4 for analysis, after a v3 bump invalidated
four entries for an edit the model never saw; Block 7 session 1 for images, after
a v6 bump added two template ids no image call reads and stranded 14 generated
images worth $2.06.

§6 now lists what each stage actually keys on, read from the code:

- **transcription** — prompt version, Gemini model, guide version, Scribe model,
  keyterms. The mode is not an input at all.
- **keywords and image slots** — prompt version, model, mode **id**, a **content
  hash of the fields that call reads**, transcript hash, candidate count.
- **images** — the composed prompt, the negative prompt, model, resolution, aspect
  ratio, candidate index, mode **id**.

And the rule: **key on what the call sends, never on a number that moves for
unrelated reasons.** K2 went v10 → v12 during Block 9 and no cached entry moved.

## 7. Deviations

- **The keyword widths were measured in After Effects**, which the brief did not
  ask for. The brief asserted a number; measuring it was the only way to put it in
  a handoff honestly, and it turned out to be wrong. The cost is the dirty project
  described at the top.
- **The `savePath` field already existed** on `BuildProgress` and in the panel.
  The fix is three lines of ExtendScript plus the panel presenting it as a
  deliverable rather than a clause — less code than the brief anticipated, because
  the fault was one layer lower than it appeared.
- **No reveal-in-Finder**, per the brief's own condition: it cannot be proven on
  the host, so it is not claimed.

## 8. Failures and open problems

- **The open project is dirty**, as described at the top. Unavoidable given the
  measurement, harmless given the file, and stated rather than hidden.
- **The build's save path has never been observed end to end since the fix.**
  The jsx change is pinned by reading the source and the panel is pinned in a real
  browser, but **no build has been run since**, so the path travelling from After
  Effects through the CLI's JSON to the panel is proven by construction rather
  than by observation. Running one would have replaced the project the width
  measurement had already dirtied, and the value of doing so was lower than the
  value of leaving the machine as found. **The first build of Block 10 confirms
  it or does not.**
- **Two of Block 9's DoD items are not met** — the vocabulary-to-keyterm wiring is
  implemented and unexercised because `vocabulary` is deliberately empty, and the
  second-machine sharing doc does not exist. Both are recorded in the handoff, and
  the second is Block 10's first deliverable.
- **Two prompt changes remain applied and unobserved.** Recorded in the handoff
  and in the opening prompt.
- **Nothing was lost.** No cache entry, cutout, plan, reference, ledger line or
  template content changed.

## 9. Repo state

- Branch **`main`**, twenty-three commits ahead of `49e97a5`, nothing force-pushed.
- HEAD: **`b37712e docs: record block 9's end state`**.
- Working tree clean apart from this report.
- **`npm run check`: PASS**, measured from this session's final run:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 39 | **547** |
| `framopia-service` | 90 | **1146** |
| `framopia-benchmarks` | 16 | **166** |
| `framopia-panel` | 6 | **159 passed, 2 skipped (161)** |
| `tools/cv` pytest | — | **149 passed in 8.02 s** |

```
mode k2-syndicalia v12: ok (fonts set)
templates: 6 entries, ok
extendscript: 12 .jsx file(s) ok
validate-templates: 6 template(s) ok, audited against library.aep
validate:panel: panel/CSXS/manifest.xml ok

  ok    ground-truth   v1.0.8-conformant
  ok    test-1         v1.0.8-conformant
  ok    test-2         v1.0.8-conformant
  ok    test-3         v1.0.8-conformant
references: PASS
149 passed in 8.02s
models: birefnet-general ok
models: selfie-multiclass-256x256 ok
check: PASS
```

## 10. Suggested next step

`/Volumes/T7 Shield/INSEA/Projects/framopia-studio/handoffs/block-10-opening-prompt.md`

That file opens the last block. Block 10 is the golden runs on both machines, and
it is the first time any of this runs on a computer it was not written on.

Two things in it need his judgement before work starts, and only his: **when there
is physical access to his partner's machine**, and **where the remaining $6.82
goes** — a fresh reel is $2.35, the two unanalysed reels together are $4.70, and
the golden runs draw on the same pot. Everything else in the block can be decided
from the repo.

After Effects still holds `vitasilk-full.aep` with an unsaved change that a script
cannot clear; closing it without saving loses nothing, since rebuilding it is free.
