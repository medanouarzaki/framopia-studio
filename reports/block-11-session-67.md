Status: OK

# Block 11 session 67 — the panel names the one command

**Expected spend $0.00. No paid call of any kind, no picture generated, no video
transcribed. The ledger is unmoved at 165 lines and the same sha256 at both
ends. Golden did not move: 17,174 fields, 4 of 4. `npm run check` passed whole.**

**Writing the exemption down found that the message was outside the rule
already.** `PANEL_IS_BEHIND` lives in `core/`, and `leave-the-panel.test.ts` only
ever scanned `panel/src`. Nothing was wrong with the sentence, but the rule was
not protecting it — and an exemption for a case the rule cannot see is not an
exemption. §2.

---

## 1. The panel suite's numbers, unambiguously

| | passed | skipped | total |
|---|---|---|---|
| before session 66 | 242 | 2 | **244** |
| after session 66 | 253 | 2 | **255** |
| after this session | 254 | 2 | **256** |

Session 66's report was arithmetically right and ambiguously labelled: its table
row read `242 (+2 skipped) → 253 (+2 skipped), +11`, which is passed-to-passed,
while its prose read `244 + 11 = 255`, which is total-to-total. Both give +11
because the 2 skipped never moved, but the same figure was quoted against two
bases without saying which. **Session 66 added 11 tests; this session adds 1.**

### A red at the start, before anything was touched

The panel suite exited **1** at the preamble:

```
 FAIL  src/render.browser.test.ts > the build-stamp check > says nothing when the service is the build this bundle was made from
     → expected 'ffmpegffmpeg version 8.0.1ffprobeffpr…' to contain 'same build as this panel'
```

Measured rather than guessed at:

```
source stamp now: be60eb2203+aa11cc17b22bbc39
service dist    : e1d0302883+aa11cc17b22bbc39
```

**The same source hash, a different commit.** Committing session 66's report
moved the commit half while nothing about the code changed, so
`describeBuildStamps` returned its *same code … at different commits* wording
rather than *same build as this panel*. `npm run panel:build` cleared it.

**This is the suite working, not flaking, and nothing was changed.** Its own
comment says the match case reads the stamp "the same function the bundle was
stamped with a moment ago by the test script" — it expects a freshly built
bundle, and it correctly reported one that was not. That is precisely the
condition this session is about, arriving unprompted.

## 2. The exemption, as written down

Recorded in two places: the rule's own file, and beside the sentence it exempts.

In `panel/src/leave-the-panel.test.ts`:

> **The second exemption, and it is one sentence rather than one file.**
>
> **Mohamed ruled on 2026-09-07** that when the panel is running older code than
> the rest of the tool it may name the one command that fixes it, and **nowhere
> else**. Block 11 session 66 put the question to him: the panel cannot repair
> this case itself, because **the stale artefact is the running code** — the
> bundle has to be built on disk and then loaded, and the thing that would do the
> loading is the bundle. […]
>
> **It is withdrawn the moment the self-reload route is proved to work.** […]
>
> **An allow-list of one string, not a hole.** The sentence is imported, never
> retyped, and only its exact text is permitted to carry a command.

### The gap it exposed

`PANEL_IS_BEHIND` is defined in `core/src/build-stamp.ts`, because the panel and
the service both read the comparison. `leave-the-panel.test.ts` scanned
`panel/src` and nothing else. **So the message was never subject to the rule at
all.** Session 66's wording happened to contain nothing forbidden, so no harm
was done — but the rule would not have refused a command in it, and an exemption
granted to something already out of reach is a fiction. The scan now includes
that file.

**Widening it immediately caught something real:** `REBUILD_COMMAND =
'npm run service -- --force'`. That is a command the panel **runs** on the
user's behalf and never renders — the module's own note says "the panel no
longer prints it". It is removed before matching under a separate name,
`NOT_SHOWN_TO_ANYONE`, rather than folded into the message exemption, so
*allow-list of one case* stays literally true.

### The rule still bites

**A second message elsewhere naming a command:**

```
 FAIL  src/leave-the-panel.test.ts > no message sends the user out of the panel > names no application to quit, restart or reopen, and no command to type
AssertionError: expected [ 'Readiness.tsx: "terminal"' ] to deeply equal []

+ Array [
+   "Readiness.tsx: \"terminal\"",
+ ]
```

**A near-copy of the exempt sentence, in another file:**

```
 FAIL  src/leave-the-panel.test.ts > no message sends the user out of the panel > names no application to quit, restart or reopen, and no command to type
AssertionError: expected [ 'Readiness.tsx: "npm run"', …(1) ] to deeply equal []

+ Array [
+   "Readiness.tsx: \"npm run\"",
+   "Readiness.tsx: \"terminal\"",
+ ]
```

Both restored byte-identical from saved copies, green re-verified.

**One mutation did not fire, and it should be said plainly.** Editing the exempt
sentence — one word changed in `build-stamp.ts` — kept it exempt, because the
allow-list imports the constant rather than retyping it. That is the right
behaviour: the exemption is for *that message*, whatever its wording. It means
"drift" is caught when the drifted text appears somewhere else, which is what the
second mutation shows, and not when the sentence itself is reworded. Recorded
rather than presented as a proof it is not.

### A silent failure I introduced and caught

The sentence is written across string concatenations, so the joined constant
matched nothing in the raw source and `withoutAllowed` quietly exempted
**nothing**. The suite was green and the allow-list was doing no work — a rule
that looks enforced and is not, which is the same shape as the vacuous tests
session 57 removed. Adjacent literals are now joined before matching, and the
reason is in the code.

## 3. The sentence

> **This panel is showing older code than the rest of the tool, so what you see
> here may not match what it does. Nothing you have made is affected. To put it
> right, run `npm run panel:build` in a terminal, then close this panel and open
> it again from Window → Extensions.**

What is wrong, then what to do, in that order. No error code, no stamp, no
jargon: it never says *bundle*, *build stamp* or *stale*, because the partner is
not Mohamed and has no reason to know those words.

**The reopening step is part of it deliberately.** Building the bundle does not
load it — the running panel keeps the old one until it is opened again — so a
command on its own would leave the reader exactly where session 66's wording
did. A test asserts all three parts are present and that the fault is named
before the remedy.

**Proved against a genuinely stale bundle**, the same standard as session 66: the
current stamp comes from the real `scripts/build-stamp.mjs`, not a hand-set flag,
and is compared against a stamp that is genuinely not it. Six tests in
`stale-bundle.test.ts` cover it, including one asserting the exempt sentence is
the one `App.tsx` actually renders — an exempt constant nothing reads would be an
exemption for nothing.

## 4. Nothing else changed

Checked rather than assumed. The whole diff:

```
 core/src/build-stamp.ts             |  51 ++++++++--
 panel/src/leave-the-panel.test.ts   |  88 ++++++++++++++++--
 panel/src/stale-bundle.test.ts      |  40 ++++++--
```

Two of the three are test files. In `build-stamp.ts` the only user-visible string
that changed is `PANEL_IS_BEHIND`; everything else added there is the comment
recording the ruling and §5. **No panel component was touched** — `App.tsx` is
unchanged, and `Readiness.tsx` was mutated twice and restored byte-identical both
times. No other message in the panel gained a command, and
`leave-the-panel.test.ts` would now fail if one had.

## 5. The route that would end the exemption

Written as prose beside the message in `core/src/build-stamp.ts`.

**Where it would sit.** The service is an ordinary Node process with the
repository in front of it, so it could run the panel's own build itself. The
panel already asks it to rebuild the *service* through `host.rebuildService`, and
this would sit beside that as the same shape of request rather than as a new
mechanism.

**What would have to be proved, in order.** That the service can run the panel
build without disturbing the panel that asked for it. That a reload picks up the
new bundle rather than a cached one, CEP having a cache of its own. And that the
reloaded panel still has `cep_node` and its handshake — a panel that reloads into
a broken state is worse than a sentence.

**What could go wrong.** The reload happening while the bundle is half-written;
CEP serving the old file anyway; or the reload dropping the extension entirely,
leaving only a restart of After Effects — the very thing this rule exists to
avoid, arrived at by trying to avoid it.

**None of it is measurable without driving After Effects**, so it waits for the
partner's first real run. No code was written for it.

## 6. Gates, arithmetic and fingerprints

**`npm run check`: PASS**, exit 0, run with nothing else touching the tree. **No
workspace was built while a gate was in flight.** **`npm run golden`: PASS** —
4415 + 4280 + 3709 + 4770 = **17,174**, field for field, reference unchanged.

```
check: counted with 5/5 corpus Edit Plans and 5/5 reels (11.93 GB) on this disk — the suite sizes depend on both, so this signature belongs to this machine, not to the commit
```

| suite | passed | skipped | total | session 66 |
|---|---|---|---|---|
| core | 796 | 0 | **796** | 796 — unchanged |
| service | 1397 | 1 | **1398** | 1397 passed — unchanged |
| benchmarks | 173 | 0 | **173** | 173 — unchanged |
| panel | **254** | 2 | **256** | 253 passed, 255 total |

**+1 in panel**, and it is the only test added anywhere:

1. `a panel bundle left behind by a pull > is the sentence the panel puts on screen`

One test was **rewritten rather than left asserting retired behaviour**: `says so
in plain words, naming nothing to quit, reopen or type` asserted the message
contained no `npm run`, which Mohamed's ruling retires. It is now `says what is
wrong, then the one command, then how to load it`. A rewrite is not an addition,
so 255 + 1 = 256 closes exactly.

**Five panel runs, each with its exit status:**

| run | result | exit |
|---|---|---|
| 1 | 254 passed, 2 skipped (256) | 0 |
| 2 | 254 passed, 2 skipped (256) | 0 |
| 3 | 254 passed, 2 skipped (256) | 0 |
| 4 | 254 passed, 2 skipped (256) | 0 |
| 5 | 254 passed, 2 skipped (256) | 0 |

**Part 0, as found at both ends:**

| | at start | at end |
|---|---|---|
| After Effects instances | 1 | 1 |
| `aerender` processes | 0 | 0 |
| ledger lines | **165** | **165** |
| ledger sha256 | `786497a5f371d179…` | `786497a5f371d179…` |
| `templates/library.aep` | `4b0cf05a8f5d4775…` | `4b0cf05a8f5d4775…` |
| `modes/.gitkeep` | `e3b0c44298fc1c14…` | same |
| `modes/dr-loubna-kfafi.json` | `f60749f5629b2ced…` | same |
| `modes/k2-syndicalia.json` | `c600905c5e36ecbc…` | same |
| `assets/client-pictures/` | 0 files | 0 files |

**The extensions folder, byte-identical**, timestamps included:

```
lrwxr-xr-x@ 1 mohamedanouarzaki  staff  55 Aug 27 19:06 com.framopia.studio -> /Volumes/T7 Shield/INSEA/Projects/framopia-studio/panel
```

**Every directory in `.local/`, unchanged at both ends:** `audio` 27 ·
`bench-audio` 5 · `build` 70 · `cache` 159 · `cv` 1759 · `deleted-clients` 0 ·
`doctor` 1 · `evidence` 3 · `ground-truth` 10 · `plans` 49 ·
`quarantine-session51` 363 · `quarantine-session53` 139 ·
`quarantine-session54` 1 · `transcripts` 1.

After Effects was driven only by `npm run golden`, through `DoScript` into the
already-running instance. It was never launched and never quit. No `.aep` was
written and Mohamed's own project was never saved.

`handoffs/block-10-opening-prompt.md` → `handoffs/block-10.md` is Mohamed's own
uncommitted rename, left exactly as it was.

## 7. Money

**No ledger lines added.** 165 lines at both ends, byte-identical by sha256.
Nothing here could bill: a sentence, a test's scan widened, and a comment
recording a ruling.
