Status: OK

Block 8, session 9. **$0.00 spent, no API called, After Effects not driven.**
The fonts gate is off Run, the panel goes two-column when there is room, the
cold spawn is timed and the cases around it are covered, and every stub in the
panel's tests is audited.

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| `main` / `origin/main` at start | `37c1248` / `37c1248` |
| tree at start | clean |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances at start / end | **1 / 1**, left open and untouched |
| `aerender` processes at start / end | **0 / 0** |
| companion service | pid **57858** running at start and end. **Not killed.** Every spawn test used its own lock file through `FRAMOPIA_SERVICE_JSON`, so none of them touched it. |

## Done

### Goal 1 — the fonts gate, and what Build actually did

Removed from `runGate`; the reason is now a note in the Build section.

**What Build does today with `tbd` fonts: it never asks.** `requireFonts` is the
only thing in the codebase that rejects a `tbd` mode, and it is **called nowhere
outside `core`** — not by the builder, not by the ExtendScript driver, not by
any CLI. Block 7 built `vitasilk` end to end on `k2-syndicalia` with
`fonts.status: "tbd"`, and it rendered in **Inter Semi-Bold and Almarai Bold**
because that is what the four hand-built template comps carry, and because
PROJECT_SPEC §5 makes subtitle position and base style **global, not per-mode**.

So the fallback was real, correct, and entirely incidental — nobody decided it,
and nothing stated it. `core/src/build-fonts.ts` now does:

```
K2 Syndicalia has no fonts of its own yet, so the build will use the global
subtitle pair: Inter Semi-Bold for Latin and Almarai Bold for Arabic at 1.07x.
PROJECT_SPEC §5 reserves the client's own fonts for Block 9; everything before
the build runs normally.
```

The mode catalogue now carries the mode's own font names when it has them, so
the panel names the real faces rather than inferring them from a boolean.

**Pinned:** a `tbd` mode reaches Run with the reason *"The pipeline runner is
not built yet."* and no mention of fonts; the Build section names both fallback
faces; a mode with its own fonts produces no warning; and a mode claiming `set`
while naming nothing still falls back rather than being trusted. The old test
asserting the retired behaviour was rewritten, not left.

### Goal 2 — two columns, at a measured breakpoint

A **container query on `.app`**, not a media query: a docked CEP panel's window
is the size of the screen while its panel is a column wide, so a viewport query
would lay out for the wrong thing.

**The breakpoint is 830 px of the panel's own width.** The rule that set it: *a
column must never be narrower than the single column already is when docked.*
Measured on the built panel with the real health payload:

| panel width | columns | Service card | value column | worst wrap | overflow |
|---:|---:|---:|---:|---|---:|
| 420 (docked) | 1 | 380 | **242** | 3 lines | 0 |
| 700 | 1 | 660 | 457 | 1 line | 0 |
| 800 | 2 | 369 | 231 | 3 lines | 0 |
| 820 | 2 | 379 | 241 | 3 lines | 0 |
| **830** | **2** | **384** | **246** | **2 lines** | **0** |
| 1200 | 2 | 569 | 431 | 2 lines | 0 |

820 gives 241 px — narrower than docked. 830 gives 246 px **and** the worst wrap
(the resolved Node path and the ffmpeg banners, the widest content at 464 px)
drops from three lines to two. Below 830 a second column would make the panel
worse rather than wider.

**Nothing overflows at any width**, verified by walking every element and
comparing `scrollWidth` to `clientWidth`. That check found a real fault: the
Node-mismatch warning I added in Goal 4 overflowed by 52 px at 420 px and by
13 px at 900, because `.reason` had no wrap rule and the text is an absolute
path. Fixed for `.reason`, `.status .detail` and the fonts note.

Layout: Service in the left column spanning both rows, Video above Client mode
on the right, Build spanning both beneath. Four headless assertions: one column
at 420, one column at 829, two at 830, two at 1200 with the relative positions
asserted and zero overflow throughout.

**The user reviews this docked and floating before it is kept.**

### Goal 3 — the cold spawn, timed

Run against a lock file nothing had ever written, with the same resolver, the
same Node resolution, the same arguments and the same health poll the panel
uses:

```
repo : /Volumes/T7 Shield/INSEA/Projects/framopia-studio
node : /Users/mohamedanouarzaki/.nvm/versions/node/v24.14.1/bin/node (nvm)
handshake written after 52 ms
healthy after 157 ms   ok=true
```

**52 ms to the handshake, 157 ms to healthy.** In the committed test, which
polls at a coarser interval, it reports ~200–500 ms. Either way it is well below
what a user notices.

The four cases underneath, each a **real process on a real lock file**:

| case | behaviour | how |
|---|---|---|
| a service is already listening | reused, not duplicated | `connect` reads the handshake, checks the pid is alive, and asks `/health` before spawning anything — a test asserts `spawnService` is never called |
| a stale lock names a dead pid | reclaimed | spawned over a lock naming pid 999999; the fresh handshake carries a different pid and token |
| two panels open at once | one service | the second `startServer` refuses the live lock and exits saying `already running`; the lock still names the first, still answering |
| a service dies while the panel is open | noticed | it stops answering, and the panel's heartbeat reports `service-lost` |

**Two real gaps were found and closed.** A second panel's spawn *fails* by
design — the service exits on the live lock — and `connect` reported that as a
spawn failure while a perfectly good service was listening; it now re-checks and
reuses. And the panel checked health once and never again, so a service that
died left **`Ready` on screen indefinitely**; a 5 s heartbeat now flips it to
`service-lost` with the real error.

**What cannot be exercised outside CEP:** the bridge itself — `cep_node`
supplying `fs` and `child_process`, and `__adobe_cep__`/`location` supplying the
candidate paths. The spawn *arguments and sequencing* are exercised; the
*delivery of the Node APIs* is not.

### Goal 4 — the panel's Node against the service's

`/health` now reports `process.execPath` **and** `process.version` — the
interpreter the service is really running under, not the one a resolver would
pick. The panel compares it against the binary it resolved and shows a warning
naming both:

> The service is running on /opt/homebrew/bin/node (v22.1.0), but this panel
> would start /Users/…/nvm/versions/node/v24.14.1/bin/node. They are different
> interpreters, so a service the panel starts may not behave like the one
> running now.

**A warning, not a gate**: a service on a different Node is still a working
service, and refusing it would be worse than saying so. This is live today — the
running service was started at a terminal where `PATH` is the user's shell
rather than After Effects'.

Three tests: it warns naming both when they differ, says nothing when they
agree, and does not disable Run either way.

### Goal 5 — the stub audit

Every stub, fake and mock in the panel's tests:

| stub | stands in for | shape correct? | evidence |
|---|---|---|---|
| `window.cep_node` `{ global, require }` | CEP's Node bridge | **yes** | the panel reads `cep_node.require('fs')` and works inside After Effects — session 8's fix is running |
| `require('fs')` → `existsSync`, `readFileSync`, `readdirSync`, `realpathSync` | Node's `fs` | **yes** | all four are Node's own; CEP's `require` is Node's |
| `require('path')` → `join` | Node's `path` | **now yes** | it previously also offered a two-argument `resolve`; **the panel calls only `join`**, so the extra method suggested the stub modelled more than it does. Removed. |
| `require('os').homedir` | Node's `os` | **yes** | Node's own |
| `require('child_process').spawn` → `{ unref, on, stderr }` | a `ChildProcess` | **now yes** | `stderr` was `null`; the panel spawns with stdio piping stderr, so the real object has a **stream**. Corrected to `{ on }`, which exercises the capture path the code has. |
| `window.process.kill` | Node's `process` in mixed context | **yes**, but always returns true | `--mixed-context` puts Node's `process` on the page; the always-true return is a simplification, so `processAlive`'s false branch is covered by its own unit tests instead |
| `window.CSInterface` | the CEP wrapper library | **it does not exist in this extension** | and that is now the point: it is stubbed in **one** test, to prove the `CSInterface` *candidate* works. **No test requires it for the panel to function** — the browser check never defines it, which is the evidence that `window.location` carries the panel on its own. This is the exact stub that made session 7's claim false. |
| `window.fetch` | the service over HTTP | **yes** | routed by URL, so `/health`, `/reels`, `/modes` and `/dry-run` each answer their own shape; a single-response mock previously let a picker test pass for the wrong reason |
| `hostThatAnswers` (a fake `PanelHost`) | the host bridge | shape is the panel's own interface | it cannot be wrong about CEP, but it **can** be wrong about behaviour — `spawnService` resolves instantly where the real one waits 400 ms. Named, not fixed: the real timing is exercised by the integration test. |
| `setClockForTests` | `Date.now` and `setTimeout` | injected, not a host stub | lets a 12 s timeout be tested in microseconds |

**Cannot be verified without running inside After Effects:** that CEP injects
`cep_node` at all, that `--mixed-context` puts `process` on the page, and that
`__adobe_cep__.getSystemPath` returns what its documentation says. The first is
established by the panel working; the other two are not, which is why
`window.location` is in the candidate list — the browser guarantees it and CEP
does not have to.

The rule is in `docs/CLAUDE_CODE_GUIDELINES.md` §3 with the incident: **a stub
asserts a claim about the real environment, and that claim needs evidence.**

### Goal 6 — the re-review sheet is current

`benchmarks/results/latest-align-review/vitasilk.rereview.html`, 28,389 bytes.
**Not stale, not regenerated.** Verified:

- **17 rows** — the rows experiment 2 moved
- all five verdict buttons present: `correct`, `wrong`, **`misheard`**,
  `two-tokens`, `no-token`
- `schemaVersion` **2**
- `alignerHash` **`e9e63aebb60d`**, which is **exactly** the current build's
  hash — nothing in `align.ts`, `normalize.ts` or `align-review.ts` changed this
  session, so the sheet still judges the aligner it was made for

It renders under the headless check the same way the main sheet does: the
re-review DOM tests cover its columns, its five buttons, its counters, its
separate `localStorage` key and its download.

**What the user is being asked to decide:** experiment 2 — transliteration-aware
substitution cost — moved 16 of 18 rows he had marked **wrong**, with **zero
regressions** among the 54 he marked correct. The 16 are candidates, not
repairs: a pairing that changed from wrong to differently-wrong scores as an
improvement, and only he can tell. Some are plainly right (`mn`→`من`,
`ghir`→`غير`, `chno`→`شنو`); others moved the residual error onto French
pronouns against Arabic verbs, which is a many-to-one shape no substitution cost
can express. **The variant is not adopted.**

### Goal 7 — CLAUDE.md and the gate

CLAUDE.md carries the fonts gate at Build with what Build did before, the
container query and the 830 px measurement, the cold-spawn timing and the
reuse/stale-lock/heartbeat rules, the Node-match check, and the stub rule.

`npm run check` — **exit 0, `check: PASS`**.

| workspace | tests | against session 8 |
|---|---:|---|
| `@framopia/core` | 319 (17 files) | 315 |
| `framopia-service` | 761 (55 files) | 757 |
| `framopia-benchmarks` | 166 (16 files) | 166 |
| `framopia-panel` | 59 + 1 skipped (2 files) | 46 + 1 |
| **TS total** | **1305** | **1284** |
| pytest (sidecar) | **141** | 141 unchanged |

## Deviations

- **The mode catalogue gained the mode's font names.** Not asked for, but the
  panel had only a boolean and could not name the faces a build would use
  without inferring them — and my own guard in `buildFonts` correctly refused a
  mode that claims `set` while naming nothing, which surfaced the gap.
- **A 5 s heartbeat was added.** Goal 3 asks that a dead service be noticed;
  nothing polled, so noticing required one. The interval is chosen, not
  measured.
- **`path.resolve` was removed from the test stubs** rather than corrected. The
  panel calls only `path.join`, and a stub offering a method the code never
  calls implies it models something.

## Failures & open problems

- **Nothing was lost or corrupted.** No plan, cache entry, ledger line or
  template was written. The user's service was not killed and every spawn test
  used its own lock file.
- **The two-column layout has not been seen by the user.** It is asserted at
  four widths in a real browser engine; whether it *reads* well docked and
  floating is his call and the reason it is not final.
- **The CEP bridge remains the one untested link**, as it has since the panel
  began. Everything above it is now covered.
- **`hostThatAnswers` resolves `spawnService` instantly** where the real one
  waits 400 ms for an error or an early exit. The real timing is covered by the
  integration test, but the panel's own handling of a slow spawn is not.
- **The heartbeat only checks `/health` reachability**, not whether the service
  is still the same one — a service restarted on a new port under the same lock
  would be noticed only if the old port stopped answering.
- **Experiment 2 is still unadopted**, waiting on the user's pass over 17 rows.
- Carried forward: headless AE is not met, `vitasilk` is the only reel ever
  built, 28 cards have a clipped hold, the CJK `五` is classified Latin, and the
  many-to-one operation is sized at one occurrence and deferred.

## Repo state

- Branch **`main`**, worked on `main`. No force-push, no history rewritten.
- HEAD at the time of writing: **`53e2353` `docs: record that a stub is a claim
  needing evidence`**, preceded by `test: cover the cold start and the cases
  around it`, `fix: reuse a service that appeared while our own spawn lost`,
  `feat: lay the panel out in two columns when there is room`, and `fix: move
  the fonts gate from run to build`, on session 8's `37c1248`. **This report's
  own commit (`docs: record block 8 session 9`) follows it** and is not
  reflected in that subject line.
- `git log` checked for AI attribution and co-author trailers: none.
- `npm run check`: **exit 0, `check: PASS`** — 1305 TS tests across four
  workspaces, 141 pytest.
- Ledger `.local/costs.jsonl`: **108 lines**, sha256 `50ec3f57…` at start and
  end. All-time spend unchanged at **$10.968590**.
- After Effects: **1 instance** at start and end, **0** `aerender`. Left open,
  never driven. Companion service pid 57858 left running.

## Suggested next step

Look at the two-column layout docked and floating and say whether it stays —
it is the one thing here that only an eye can settle, and everything else in the
panel is now covered by the gate. Then the aligner: seventeen rows are waiting
on the re-review sheet, and experiment 2 cannot be adopted until they have been
judged. If it holds, the rows still wrong are all one shape — French pronouns
against two Arabic verbs — which is the many-to-one operation sized at one
occurrence in session 6 and deferred; the transliteration result is what makes
it worth reopening, because it would then be the only thing left.

## What the user does next

**Rebuild both halves:**

```
cd "/Volumes/T7 Shield/INSEA/Projects/framopia-studio" && npm run service:build && npm run panel:build
```

**After Effects does not need restarting** — nothing in the extension manifest
changed.

**But reopening the panel from the menu is not enough.** CEP serves a cached
page. The reliable way:

1. Leave the panel open.
2. In Chrome, go to `http://localhost:8099`.
3. Click the Framopia Studio entry, then press **Cmd-R** in that window.

If you would rather not use Chrome, quitting and reopening After Effects always
works.

**What is different:**

- **Run is no longer blocked by fonts.** It was refusing because K2 has no fonts
  of its own yet — but those are for Block 9, and the subtitles use the same two
  faces for every client anyway. The Build section now tells you which fonts it
  will use (Inter Semi-Bold and Almarai Bold) instead of stopping you.
- **Two columns when the panel is wide enough.** Below about 830 pixels it stays
  in one column, because two would each be narrower than the single column is
  when the panel is docked, and the file paths would wrap into an unreadable
  stack. **Please look at it both docked and floating and tell me if it stays** —
  that is the one thing I cannot judge for you.
- **The panel notices if the service goes away** instead of showing Ready
  forever, and it warns if the service is running on a different Node than the
  one it would start — which is the case right now, because you started it from
  a terminal.

**The aligner is waiting on you.** The re-review sheet is at
`benchmarks/results/latest-align-review/vitasilk.rereview.html`. Open it with:

```
open "/Volumes/T7 Shield/INSEA/Projects/framopia-studio/benchmarks/results/latest-align-review/vitasilk.rereview.html"
```

It holds only the seventeen rows the experiment moved, with the old pairing
beside the new one. Sixteen of the eighteen you marked **wrong** changed, and
none of the fifty-four you marked **correct** did. The question on each row is
the same as before: does this word really come from that piece of audio? Until
you answer, the change stays unadopted — a pairing that went from wrong to a
different kind of wrong counts as an improvement in the tally, and only you can
see the difference.
