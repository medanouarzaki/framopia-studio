Status: OK

# Block 9 session 3 — the banner was measuring the wrong thing

**Spent $0.00. No API was called.** No transcription, correction, analysis or
image generation ran. **After Effects was not contacted**: no `osascript`, no
`DoScript`, no `aerender`, nothing launched and nothing quit. The companion
service was stopped and started, which is a different process and is recorded
below.

## 1. Stop conditions

| | |
|---|---|
| mount | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`, `git rev-parse --show-toplevel` agrees |
| ledger at start | **108 lines**, `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, same sha256 — byte-identical |
| cache at start | **36 entries** — 11 transcription, 7 analysis, 4 imageslots, 14 images |
| cache at end | **36 entries, census identical** (sha256 of each entry's file list) |
| After Effects | **1 instance, pid 79146, started Thu Aug 27 21:00:05** — the same process at both ends, untouched |
| `aerender` | **0 / 0** |

**Services stopped and started**, in order:

1. Stopped **pid 99668** (started Sat 18:52), the service the panel had been
   talking to. It had lost its lock to a `--force` takeover and was orphaned.
2. Started **pid 18290** via `npm run service -- --force` — the first working
   run of the new remedy.
3. Stopped **pid 18290** to rebuild against this session's final source.
4. Started **pid 23255**, port **59846**, which is what is running now. Its
   `/health` reports `buildStamp 522d1be444+42476f5c16799dff`, equal to the
   panel bundle's.

## 2. Part A — the diagnosis

### 2.1 The code that produced the banner

`stalenessOf` in `panel/src/staleness.ts`, as it stood:

```ts
const SLACK_MS = 60_000;

export function stalenessOf(
  builtAt: string | null,
  serviceStartedAt: string | undefined,
): Staleness {
  if (builtAt === null || serviceStartedAt === undefined) {
    return { stale: false, detail: null };
  }
  const built = Date.parse(builtAt);
  const started = Date.parse(serviceStartedAt);
  if (Number.isNaN(built) || Number.isNaN(started)) return { stale: false, detail: null };
  if (built <= started + SLACK_MS) return { stale: false, detail: null };
  return {
    stale: true,
    detail:
      'This panel was rebuilt after the companion service started, so the service is running ' +
      'older code. Quit After Effects and open it again, or run npm run service:build and ' +
      'reopen the panel.',
  };
}
```

`builtAt` is `__PANEL_BUILT_AT__`, `new Date().toISOString()` at the moment
`panel/scripts/build.mjs` ran. `serviceStartedAt` is `health.process.startedAt`.

**What it actually measures: which of two events happened first in wall-clock
time — the panel's build, and the service process's start.** What its message
claims is that the service is running older *code*. Those are different
questions, and the second does not follow from the first: a service started at
nine and never touched is running the same code as a bundle built at ten from
an unchanged tree, and this called it stale.

### 2.2 What `/health` returned

From the service that was running when the session began (pid 99668, port
58039), queried directly:

```json
{"ok":true,"serviceVersion":"0.1.0","appVersion":"0.1.0","promptVersion":4,
 "ffmpeg":{"present":true,"detail":"ffmpeg version 8.0.1 …","path":"/opt/homebrew/bin/ffmpeg","source":"homebrew"},
 "ffprobe":{"present":true,"detail":"ffprobe version 8.0.1 …","path":"/opt/homebrew/bin/ffprobe","source":"homebrew"},
 "process":{"pid":99668,"startedAt":"2026-08-29T17:52:06.137Z"},
 "sidecar":{"venv":{"present":true,"detail":"Python 3.11.14"},"pythonPath":"…/tools/cv/.venv/bin/python"},
 "templates":{"valid":true,"issues":[],"count":6},
 "repoRoot":"/Volumes/T7 Shield/INSEA/Projects/framopia-studio",
 "node":{"path":"…/v24.14.1/bin/node","source":"process.execPath","version":"v24.14.1"}}
```

`ok: true`, every tool present, six templates valid. **There was no `buildStamp`
field** — that is this session's addition.

### 2.3 Every companion-service process, and the lock file

At the start of the session, **exactly one**:

| pid | started | command |
|---|---|---|
| 99668 | Sat Aug 29 18:52:05 | `…/v24.14.1/bin/node …/service/dist/service.js` |

`.local/service.json` held `{ port: 58039, token: …, pid: 99668, startedAt:
"2026-08-29T17:52:06.141Z" }`, and **pid 99668 was alive**, so the lock was
valid and no duplicate had been spawned. The lock did its job.

**The machine contradicts three things the session brief reports him as having
done.** After Effects pid 79146 has been up since **Thu Aug 27 21:00:05** — it
was not quit and reopened. The service was still pid **99668** from 18:52, the
same pid the handshake named — it was not killed. What *did* happen at **20:15**
is that the Framopia panel was closed and reopened: its `CEPHtmlEngine` (pid
52851) started then. So the banner did not clear because **nothing it measures
changed**; and it could not have cleared, because restarting the service later
than the bundle's build time is the only thing that would have satisfied the old
rule, and neither restart happened.

### 2.4 Modification times and provenance

| artifact | mtime | records the commit it was built from |
|---|---|---|
| `panel/dist/panel.js` | Sat 20:33 | **no** — only `__PANEL_BUILT_AT__`, a timestamp |
| `panel/dist/index.html`, `panel.css` | Sat 20:33 | no |
| `service/dist/service.js` | Sat 20:15 | **no** — nothing at all |

Neither side recorded a commit, a hash, or anything else about *what* was built.
That absence is the reason a clock was being used in the first place.

### 2.5 Was the service in fact running older code?

**Yes — but the check could not have known it, and was right by accident.**

Compared by artifact rather than by clock: `GET /steps` on the running service
returned `build.client: null`. `client` is the field session 2 added to the
build preview, and the bundle on disk reads it. So the process really was
running pre-session-2 code — it started at 18:52, `service/dist` was last built
at 20:15, and session 2's source edits landed after that.

**The banner still had no way to know that.** It compared 20:33 against 18:52
and would have printed the same accusation had the service been rebuilt and
restarted at 20:34 with identical code — and, as recorded in
`handoffs/block-8.md` §9, would have stayed silent about a genuinely behind
service that happened to restart afterwards. It was not a false alarm on this
occasion; it was an unreliable instrument that happened to agree with the truth.

## 3. Done

### 3.1 The stamp

- **`scripts/build-stamp.mjs`** — `<short commit>+<content hash>`. The commit is
  for a human to read; the content hash decides. It covers every source file
  that is compiled or evaluated — `core/src`, `service/src`, `panel/src`,
  `panel/jsx`, `panel/index.html`, `panel/CSXS/manifest.xml` — **excluding
  tests**, which are in neither artifact and would churn the stamp every
  session. **213 files** today.
- **One stamp for the whole build, not one per side**, so the two can be
  compared directly: a change in `core` reaches both, and a change in `service`
  changes the contract the panel is written against.
- `panel/scripts/build.mjs` defines `__PANEL_BUILD_STAMP__`.
  `scripts/write-build-stamp.mjs` runs after `tsc` and writes
  `service/dist/build-stamp.json`.
- **`/health` gains `buildStamp`, optional with a default**, read **once at
  module load**. Re-reading per request would report a rebuild the running
  process has not loaded, which is the same failure in a new place.

### 3.2 The rule

`compareBuildStamps` in **`core/src/build-stamp.ts`**, read by both sides — the
panel through the **`@framopia/core/build-stamp` subpath**, because the barrel
reaches `node:fs` through the config loader and esbuild cannot resolve that for
a browser target. Three verdicts:

| verdict | when | what the panel does |
|---|---|---|
| `match` | stamps equal | nothing on the main screen; details say *"same build as this panel (…)"* |
| `different` | stamps differ | names it, with a remedy |
| `unknown` | either side cannot say | **no accusation**; details say *"this service does not say which build it is, so the two cannot be compared"* |

Silence and ignorance no longer look alike: the details pane distinguishes them
even when the main screen stays quiet.

**`__PANEL_BUILT_AT__`, `stalenessOf`'s clock comparison and `SLACK_MS` are
deleted**, with the four tests that asserted them.

### 3.3 Three remedies that did not work, each found by running it

This is the part of the session with the most in it.

1. **`npm run service` exits 1 while a service is running.** `service.ts`
   refuses a live lock. The old banner told the user to do exactly that, in the
   only situation where the banner appears. Verified: it printed
   `a service is already running as pid 99668 … pass --force to take it over`.
2. **`npm run service -- --force` did not forward `--force`.** The root script
   ended `npm run service --workspace framopia-service`, so npm attached the
   caller's arguments to the **inner npm invocation** rather than to node, and
   the service refused its own takeover with the same message. The root script
   ends with `--` now, and the second attempt printed
   `node dist/service.js --force` and started.
3. **`--force` takes the lock but does not stop the old process**, so two
   services then run — and stopping the old one **deleted the live one's
   handshake**, because `clearHandshake` removed the file unconditionally. A
   healthy service was left running with nothing on disk pointing at it, which
   is a panel that spawns a third. `clearHandshake` takes an optional pid and
   leaves a handshake naming another process alone; `service.ts` passes its own.

`REBUILD_COMMAND` is declared once beside the rule, so the sentence on screen
and the sentence in the tests cannot drift.

### 3.4 Proven

- `npm run check` **passes**, including the Chromium 99 denylist against the
  built `panel/dist`.
- **Three browser tests** in `panel/src/render.browser.test.ts` drive the real
  bundle through all three verdicts. The `match` case takes its stamp from
  `scripts/build-stamp.mjs` — the same function that stamped the bundle a moment
  earlier — so it asserts the stamp is genuinely compiled into `panel/dist`,
  not merely that two strings compare.
- **Live, from outside the browser**: the running service (pid 23255, port
  59846) reports `buildStamp 522d1be444+42476f5c16799dff`, the bundle carries
  the same string, and `describeBuildStamps` returns *"same build as this panel
  (522d1be444+42476f5c16799dff)"*.

**What is not proven** is the panel rendering it inside After Effects. CEP runs
Chromium 99.0.4844.84 and Playwright's engine is roughly three years newer, so a
green headless assertion is not a claim about his host. The bundle uses no API
it did not already use.

### 3.5 The script for After Effects

**`tools/ae/measure-fonts.jsx`**, ES3 only, `json2.jsx` loaded from
`panel/jsx/`. Writes
**`.local/build/font-measurements.json`**.

It adds one temporary composition to the project already open, measures, and
removes it. **It never saves.** It cannot leave the project unmodified: After
Effects sets the modified flag as soon as anything is added and that flag is
read-only from a script, so the project will show as modified with the comp
gone — the alert says so and says not to save. Everything is wrapped so a
failure writes `{ ok: false, stage, message }` rather than a dialog per step.

What it answers:

1. **The names After Effects accepts.** For each of the three faces it lists
   what `app.fonts.allFonts` reports for that family (family, style, PostScript
   name), then writes each candidate to `TextDocument.font`, reads it back, and
   records whether it round-tripped. Candidates, in order: the PostScript name
   of the matching style, the repo's own string, `Family-StyleNoSpaces`,
   `Family Style`. A host without `app.fonts` is reported as such, not assumed.
2. **What an unresolvable name becomes.** It writes
   `Framopia No Such Face ZZQX` and records what the layer has afterwards,
   together with what it had before the attempt. If AE substitutes silently, the
   builder has to check before it places a card, and this is that evidence.
3. **The measured sizes.** `sourceRectAtTime` at an explicit time — never
   `prop.value`, which cost Block 7 session 3 fifty pixels of baseline — at both
   **343** and **425**, for cap height (`H`), an x-height proxy (`x`), and
   advance width on a short and a long real string per script.

**No number is written into the code this session.** `EMPHASIS_SIZE_RATIO`
stays 1.0 and `ARABIC_SIZE_RATIO` stays 1.07; the next session applies the
measurement with the user looking at a build.

## 4. Inventory

### 4.1 Is a client's vocabulary wired into transcription as keyterms?

**The plumbing exists end to end. The wiring from a client to it does not.**

`keyterms` reaches Scribe as a form field (`scribe.ts:58`) and the correction
prompt as a keyterms block (`correction.ts:88`), through `transcribeHybrid` →
`transcribeVideo`. Three callers supply it, and **none of them reads a mode**:

| caller | where its keyterms come from |
|---|---|
| `transcribe-cli.ts:47` | a `--keyterms <path>` **file** the user passes |
| `pipeline.ts:365` | **nothing** — `impl.transcribe({ videoPath, cacheRoot, log })` |
| `job.ts:214` (the `transcribe` job type) | `params.keyterms` from the HTTP caller |

The pipeline is the only path the panel uses, so from the panel **a client's
vocabulary never reaches transcription**. There is a structural reason:
transcription runs before a client is chosen — `plan.clientMode` is null until
the analysis stage — so at that point in the run there is no mode to read.

**And the dangerous case does not exist**, which is the thing worth saying
loudly in the other direction: **`keyterms` *is* in the transcription cache
key.** `fingerprintOf` hashes `inputs.keyterms`, sorted, alongside the prompt
version, the model pins and the guide version, and `resolveTranscriptionEntry`
passes them too. So a transcript cached without keyterms cannot be served as
though it had them — the fingerprint differs and it misses.

That cuts the other way as a cost: **the day `k2-syndicalia`'s vocabulary is
wired in, every transcription entry for every reel misses**, because the
keyterms component of the key moves from `[]` to a real list. That is the whole
corpus re-transcribed, and the mode's own note already flags those terms as
load-bearing here. PROJECT_SPEC §5 says the wiring should exist; it does not.

### 4.2 Where a build would set a text layer's fill colour

**Nowhere today.** `framopiaSetText` in `panel/jsx/text-fit.jsx` is the only
thing that touches a text layer's `TextDocument`, and its doc comment is the
rule: *"Sets a point-text layer's string without touching any other style."* It
assigns `doc.text` and nothing else. Colour and face live in the template comps
in `templates/library.aep`, which the user authored by hand. The one colour the
build does set is a **Fill effect on an image card's `CARD` layer**
(`panel/jsx/build-reel.jsx`, the `e.cardColor` branch) — a frame around a
picture, not type. `fillColor` and `applyFill` appear nowhere in the repository.

Setting font and colour on the placeholder, as the conversation has ruled, would
touch four places:

| | what changes |
|---|---|
| `service/src/build/reel-plan.ts` | `ReelElement` carries the face and the colour for that element — ordinary or emphasis, resolved from the reel's `clientSnapshot` |
| `service/src/build/build-reel-cli.ts` | fills them in from `resolveClientIdentity` and `resolveTextColours`, converting hex to AE's 0–1 triple with the existing `parseHexColour` |
| `panel/jsx/text-fit.jsx` | `framopiaSetText` sets `doc.font`, `doc.fillColor` and `doc.applyFill` alongside `doc.text`, in the same `setValue` |
| `panel/jsx/build-reel.jsx` | passes them, and reads back what AE took |

**Not implemented this session.** It depends on the script above answering which
name form AE accepts, and on knowing whether an unresolvable name substitutes
silently — without that, a build could set a face that never took and report
success.

## 5. Deviations

- **The root `service` script was changed**, which the brief did not ask for. It
  had to be: the remedy the panel now prints is `npm run service -- --force`,
  and that command did not work until the script forwarded its arguments. A
  message that names a command which fails is the defect this session is about.
- **`clearHandshake` and `service.ts` were changed** for the same reason —
  following the new remedy left a healthy service unreachable. Found by running
  it, not by reading.
- **The `--force` takeover does not stop the old process**, and this session did
  not change that. I stopped the orphan by hand and recorded it. Making
  `--force` stop the process it takes over is a real decision about killing
  something the user may be watching, and it belongs to the conversation.

## 6. Failures and open problems

- **Nothing here is proven inside After Effects.** The panel's rendering of the
  three verdicts is proven in Playwright's Chromium, which is newer than CEP's.
- **`tools/ae/measure-fonts.jsx` has never been executed.** It is ES3-scanned
  and reviewed, and no more than that: this session may not drive After Effects.
  If it fails he gets a structured message naming the stage, which is the most I
  can offer without running it.
- **It cannot leave his project unmodified.** The comp is removed but the
  modified flag is read-only from a script. He must not save.
- **A service too old to send a stamp reads as `unknown` forever.** That is the
  correct answer and it is also a state he can sit in without noticing, because
  the main screen stays quiet. The details pane is the only place it appears.
- **The stamp does not cover everything that can change behaviour**:
  `templates/library.aep`, `modes/*.json`, `assets/`, the SFX index and
  `package.json` are all excluded. Two builds can match and still disagree about
  what a build contains. It answers "same code", which is what was being
  measured wrongly, and no more.
- **The old service's `/steps` was queried with the wrong header first**
  (`Authorization: Bearer`), which returned a 401 that briefly looked like a
  fault. The header is `x-service-token`. Nothing was concluded from the 401.
- Nothing was lost. No cache entry, plan, reference or ledger line changed. The
  two service processes stopped were a stale one and one I had started.

## 7. Repo state

- Branch **`main`**, five commits ahead of `522d1be`, nothing force-pushed.
- HEAD: **`5fdcee7 docs: record the build stamp and the three wrong remedies`**.
- Working tree clean apart from this report.
- **`npm run check`: PASS**, measured from this session's final run:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 34 | **499** |
| `framopia-service` | 87 | **1113** |
| `framopia-benchmarks` | 16 | **166** |
| `framopia-panel` | 6 | **159 passed, 2 skipped (161)** |
| `tools/cv` pytest | — | **149 passed in 7.53 s** |

Tail of that run:

```
> @framopia/core@0.1.0 validate:modes
mode k2-syndicalia v8: ok (fonts set)
templates: 6 entries, ok
validate-templates: 6 template(s) ok, audited against library.aep
validate:panel: panel/CSXS/manifest.xml ok

> framopia-benchmarks@0.1.0 verify-refs
  ok    ground-truth   v1.0.8-conformant
  ok    test-1         v1.0.8-conformant
  ok    test-2         v1.0.8-conformant
  ok    test-3         v1.0.8-conformant
references: PASS
149 passed in 7.53s
models: birefnet-general ok
models: selfie-multiclass-256x256 ok
check: PASS
```

## 8. What you do now

**The banner should already be gone.** A service is running with the new code
(pid 23255, port 59846) and the panel bundle on disk was built from the same
source, so they match. All you need to do is:

1. In After Effects, close the Framopia panel and open it again:
   **Window → Extensions → Framopia Studio**. You do not need to quit After
   Effects — the panel reloads its own code when you reopen it.
2. It should say **Ready**, with no banner. Press **Details** and the last line
   will read *"same build as this panel (522d1be444+42476f5c16799dff)"*. That
   line is the proof; if it ever says the two were built from different code, it
   is now telling you something real.

**If you rebuild anything later** and the panel says the two disagree, the
command is:

```
npm run service -- --force
```

then close and reopen the panel. That command now works — it did not before, in
two separate ways, and both are fixed.

### Then the font script, once

1. In After Effects: **File → Scripts → Run Script File…**
2. Choose
   **`/Volumes/T7 Shield/INSEA/Projects/framopia-studio/tools/ae/measure-fonts.jsx`**
3. It takes a second or two. You will see one message box saying it is done and
   naming the file it wrote. There is nothing to click through.
4. **Do not save the project afterwards.** It adds a temporary composition
   called `framopia_font_probe` and removes it again, but After Effects still
   marks the project as modified. Undo once if you like, or just close without
   saving.
5. The result lands at
   **`/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/build/font-measurements.json`**.

If it fails, the same file will hold the reason and the message box will name
the step it failed at — send me either.

## 9. Suggested next step

The font measurement is the input to everything left in Block 9's type work, and
the next session should read it and act on all three answers at once: set
`EMPHASIS_SIZE_RATIO` and re-check `ARABIC_SIZE_RATIO` from the measured cap
heights and advance widths, record the name form After Effects accepts beside
the family-and-style strings in `modes/k2-syndicalia.json`, and — only if the
unresolvable-name result says a bad name substitutes silently — add the check
that has to run before a build places a card. With those in hand, setting font
and colour on the placeholder text layer (§4.2) becomes a small, four-file
change the user can rule on by looking at one built reel, and that is the last
thing standing between K2's recorded identity and a comp that actually shows it.
