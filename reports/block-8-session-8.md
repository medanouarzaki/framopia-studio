Status: OK

Block 8, session 8. **$0.00 spent, no API called, After Effects not driven.**
The panel can now reach a healthy service with reels and modes listed, and that
is proven inside `npm run check` rather than by asking anyone to look.

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| `main` / `origin/main` at start | `699078e` / `699078e` |
| tree at start | clean |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances at start / end | **1 / 1**, left open and untouched |
| `aerender` processes at start / end | **0 / 0** |

## Done

### Goal 1 — every site that resolves the repository root

**Six sites. Only one runs inside CEP, and it was fed an empty string.**

| # | file : line | method | what it returns inside CEP |
|---|---|---|---|
| 1 | `panel/src/host.ts:234` (was) | `CSInterface.getSystemPath('extension')`, else `''` | **`''`** — always, see below |
| 2 | `panel/src/host.ts:74` (was) | `path.resolve(fs.realpathSync(extensionPath), '..')` | **`/`** — `realpathSync('')` is the process cwd, and a Finder-launched AE has cwd `/` |
| 3 | `core/src/paths.ts:7` | `path.resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')` | not reached in CEP; correct in the service and under vitest |
| 4 | `service/src/server.ts:16` | `import.meta.url`, for `service/package.json` only | not a repo root; correct |
| 5 | `panel/scripts/build.mjs:15` | `import.meta.url` | build time only, never in CEP |
| 6 | `panel/scripts/install.mjs:19` | `import.meta.url` | install time only, never in CEP |

**Sites 1 and 2 disagree with site 3.** Sites 4–6 are legitimately different
things: a package directory and two build-time paths that never run inside
After Effects.

**The finding is not two disagreeing copies of the resolver.** Session 7's
symlink fix at site 2 was correct — it was handed an empty string. The chain,
each link measured rather than inferred:

1. `panel/index.html` loads only `panel.css` and `panel.js`. **No CEP library.**
   `__adobe_cep__` appears **0 times** in the built `panel.js`, and
   `CSInterface` appears only as a `globalThis` lookup for a global nothing
   defines.
2. So `csInterface === undefined` on every load, and the ternary yielded `''`.
3. `realpathSync('')` returns the **process cwd** — measured: in this repo it
   returns the repo, which is exactly why no test ever caught it. A
   Finder-launched application has cwd `/`.
4. `path.resolve('/', '..')` is `/`, and `path.join('/', 'service', 'dist',
   'service.js')` is `/service/dist/service.js` — **verified by running it**,
   and it is the string on the user's screen character for character.

**A consequence the user should know:** the same empty root means the **pickers
and the logo were never fixed inside After Effects either**. Session 7 proved
them only in a headless browser where the test itself defined
`window.CSInterface` — a global CEP does not supply. That claim rested on a
stub, and this session is why.

### Goal 2 — one home for the root

`core/src/repo-root.ts`, used by the panel **and** by core's own `REPO_ROOT`.
The old bare `path.resolve(dirname, '..', '..')` in `paths.ts` is gone; the
panel's `repoRoot` is gone. Neither is left beside the new one.

- **It follows symlinks.** CEP always loads the extension through
  `~/Library/Application Support/Adobe/CEP/extensions/com.framopia.studio`;
  `realpathSync` first, then walk up.
- **It walks up rather than taking a fixed number of `..`**, because one caller
  knows the extension directory and another knows `dist` inside it, and
  hardcoding the depth in each is how they drift.
- **It verifies.** A candidate is believed only when it holds a `package.json`
  naming `framopia-studio` **and** the `service/`, `modes/` and `core/`
  directories. Between them those rule out `/`, a parent directory, and the CEP
  extensions folder — the three wrong answers this has actually produced. A
  different checkout of a different project is rejected by name.
- **It never returns an empty string.** Failure is a `RepoRootError` naming
  every candidate and what each returned:
  `__adobe_cep__.getSystemPath: (nothing) -> the source produced nothing`, and
  so on.

**The panel offers three candidates**, first that verifies wins:

1. `__adobe_cep__.getSystemPath('extension')` — the native API, no library
   needed
2. `CSInterface.getSystemPath('extension')` — if a library ever is loaded
3. **`window.location`** — the page is at
   `.../com.framopia.studio/dist/index.html`, so it names the extension
   directly with no CEP API at all. **This has always been available and was
   never used.**

Each is `file://`-stripped and `decodeURI`'d, because the repo lives under
`T7 Shield` and the space is not hypothetical.

**14 tests**, including the symlink case, walking up from `panel/dist`,
rejecting a different project by package name, rejecting a directory above the
repo, and — the one that matters — that three empty candidates throw and name
all three rather than returning `''`.

### Goal 3 — why Retry did nothing

**It was not unwired, not swallowed, and not short-circuited. It ran, and its
output was byte-identical.**

`onRetry` called `check()`, which called `connect(host)`. But `host` came from
`detectHost()`, called **once at module load** in `index.tsx` and passed in as
a fixed prop — with `repo` already fixed at `/`. So every press:

- re-ran the same failing build check against `/service/dist/service.js`,
- produced the same error string,
- and React re-rendered identical text.

There was no timestamp, no counter, nothing that changed. **And no press could
ever have recovered from a wrong root**, because the root was not re-resolved —
which is why building the service made no difference.

Now `App` takes `detect: () => HostEnvironment` and holds the result in state.
Retry re-runs **the whole chain**: re-resolve the root, re-resolve Node,
re-check the build, re-attempt the spawn, re-poll health. Every attempt renders
`first check at HH:MM:SS` then `attempt 2 at …`, with a `data-attempt` counter.

**Pinned by tests**: two consecutive identical failures render two distinct
states with `data-attempt` 0 then 1; a third renders `attempt 3`; a retry after
the root becomes resolvable reaches `Ready`; and `spawnService` is called twice
for two presses, proving the whole chain re-runs rather than only health.

### Goal 4 — the stale message

The build check now reads the path from the **verified** root and re-evaluates
on every attempt, so it cannot outlive the condition. The wording is unchanged
because it was a good message — it was simply never true.

### Goal 5 — proven end to end

`service/src/spawn.integration.test.ts` runs the panel's route outside CEP,
against the real filesystem and a real process:

1. resolve the repository the way the panel does — asserts it equals `REPO_ROOT`
2. resolve a Node binary — asserts the resolved path exists
3. find the built entry under the resolved root
4. **spawn it with that bare Node binary**, detached, and poll `/health` until
   it answers

It asserts `ok: true` and that `repoRoot` in the payload is the real root.
**693 ms**, inside `npm run check`. It publishes to its own lock file via
`FRAMOPIA_SERVICE_JSON`, so it neither disturbs nor accidentally finds a
service the developer is running.

**What remains unproven, precisely:** the CEP half — `cep_node` supplying `fs`
and `child_process`, and `__adobe_cep__` or `location` supplying the candidate
paths. Those globals exist only inside After Effects. What is proven is that
given them, everything downstream works.

The headless render check gained three cases: **spawn failure**, asserting the
message names a path under the real root and does **not** name one starting at
the root of the disk; **spawn success**, reaching `Ready`; and a **second
Retry** rendering a distinguishable state.

### Goal 6 — the sweep

Every message naming a path, command or file, and whether it is verified when
shown:

| site | names | verified at display? |
|---|---|---|
| `host.ts` "the service is not built: `<entry>`" | the entry path | **yes** — `existsSync(entry)` immediately before, against the verified root |
| `service.ts` "could not be started using `<node>`" | the Node binary | **yes** — `resolveNodePath` checked `existsSync` |
| `service.ts` start-timeout, naming the binary and source | the Node binary | **yes** — same resolution |
| `dry-run.ts` "`<videoPath>` is not on this machine" | the video | **yes** — `present` is `existsSync` |
| `dry-run.ts` "`<planPath>` did not parse" | the plan | **yes** — it was just read and failed |
| `dry-run.ts` "no reel labelled X in benchmarks/footage.json" | the catalogue | **yes** — it was just read |
| `health.ts` ffmpeg / ffprobe / venv details | tool versions | **yes** — each is the output or error of a real probe |
| `health.ts` "run tools/cv/setup.sh" | a script | **now pinned by test** that the file exists |
| `node-path.ts` help naming `.local/config.json` | a file to **create** | not a claim that it exists |
| `index.tsx` "the panel bundle is **probably** out of date" | a guess | hedged, and honestly so |
| `run-gate.ts` "the pipeline runner is not built yet" | the product | true |

**Two things fixed.** The node-missing help was **retyped** in the panel beside
the copy in core — a shared string with two homes. It is imported now, and a
test asserts the panel does not contain the wording. And
`core/src/messages.test.ts` pins that **every `npm run …` a user-facing message
tells someone to type is a real script** — 29 assertions, generated from the
sources.

### Can the panel reach a healthy service?

**Yes, and here is how it was proven.** Not by looking at After Effects:

- the real spawn chain reaches `ok: true` against a real process, in the gate;
- the built panel, driven by a real browser engine, goes from spawn failure to
  `Ready` and lists what the service returns;
- the root resolves to the repository from the CEP symlink path, asserted
  against the real filesystem;
- and the failure modes — no root, no Node, not built, timeout — each render a
  distinct, verified message.

**The one thing still taken on faith** is that CEP supplies `cep_node` and one
of the three candidate sources. `window.location` is guaranteed by the browser
rather than by CEP, which is why it is in the list.

### Goal 7 — CLAUDE.md and the gate

CLAUDE.md carries the single resolver and its verification, the CEP symlink
behaviour, why `CSInterface` is never defined here, the service build
requirement and how the panel re-checks it, and a session section.

`npm run check` — **exit 0, `check: PASS`**.

| workspace | tests | against session 7 |
|---|---:|---|
| `@framopia/core` | 315 (16 files) | 272 |
| `framopia-service` | 757 (55 files) | 753 |
| `framopia-benchmarks` | 166 (16 files) | 166 |
| `framopia-panel` | 46 + 1 skipped (2 files) | 39 + 1 |
| **TS total** | **1284** | **1230** |
| pytest (sidecar) | **141** | 141 unchanged |

## Deviations

- **`core/src/paths.ts` now throws if the repository cannot be verified.** It
  was a silent derivation. A wrong root is worse than no root, and everything
  downstream reads paths off it — but this is a behaviour change in a module
  every workspace imports, so it is named here rather than buried.
- **`FRAMOPIA_SERVICE_JSON` was added to the service.** Nothing in production
  sets it; it exists so the integration test can drive the real entry point
  without taking the lock a developer's own service holds.
- **`App` takes `detect` instead of `env`.** Required by Goal 3 — a value
  computed once cannot be re-resolved — and it changed every test's render
  helper.

## Failures & open problems

- **Nothing was lost or corrupted.** No plan, cache entry, ledger line or
  template was written. The ledger is byte-identical at both ends.
- **The panel has still not been observed working inside After Effects.**
  Everything is proven in a real browser engine and a real process, with the
  CEP globals stubbed. The bridge itself is the one link untested, and it is
  untestable outside AE.
- **Session 7's claim that the pickers and logo were fixed was wrong in AE**,
  for the reason found this session. They should work now; nobody has seen them.
- **`window.location` is the candidate most likely to carry the panel**, and it
  is third in the list. If CEP's native API answers, it wins — neither has been
  exercised in AE.
- **A stale service may be running** from session 7 holding
  `.local/service.json`. The panel will find it and report healthy, which is
  correct, but it is not a service this session's code started.
- **The dry run's estimates remain order-of-magnitude figures**, labelled
  "about $x".
- Carried forward: the aligner defect is untouched and experiment 2 is
  unadopted pending the user's pass over 16 moved rows; headless AE is not met;
  `vitasilk` is the only reel ever built; 28 cards have a clipped hold; the CJK
  `五` is classified Latin.

## Repo state

- Branch **`main`**, worked on `main`. No force-push, no history rewritten.
- HEAD at the time of writing: **`69c6246` `fix: write the node help once, and
  pin the commands messages name`**, preceded by `test: prove the panel's route
  to a healthy service`, `fix: make retry re-run detection and show that it
  did`, and `fix: resolve the repository root once, and verify it`, on session
  7's `699078e`. **This report's own commit (`docs: record block 8 session 8`)
  follows it** and is not reflected in that subject line.
- `git log` checked for AI attribution and co-author trailers: none.
- `npm run check`: **exit 0, `check: PASS`** — 1284 TS tests across four
  workspaces, 141 pytest.
- Ledger `.local/costs.jsonl`: **108 lines**, sha256 `50ec3f57…` at start and
  end. All-time spend unchanged at **$10.968590**.
- After Effects: **1 instance** at start and end, **0** `aerender`. Left open,
  never driven.

## Suggested next step

Have the user reload the panel and say what he sees, because the CEP bridge is
the single link this session could not test and every other claim now rests on
a proof that stops at its edge. If it comes up healthy with both pickers
filled, the panel is done for this block and the work returns to the aligner:
sixteen moved rows are waiting on the re-review sheet, and experiment 2 cannot
be adopted until he has been over them. If it does not come up, the panel will
now say which of the three root candidates it tried and what each returned,
which is the information this session spent itself acquiring by hand.

## What the user does next

**Rebuild both halves.** Paste this into the terminal:

```
cd "/Volumes/T7 Shield/INSEA/Projects/framopia-studio" && npm run service:build && npm run panel:build
```

**After Effects does not need restarting.** Nothing in the extension manifest
changed — only the code inside the panel.

**But closing and reopening the panel from the menu is not enough.** CEP keeps
the page cached, so you can reopen a panel and still be looking at the old
build. The reliable way to force a fresh load:

1. Make sure the panel is open.
2. In Chrome, go to `http://localhost:8099` — that is the panel's own debugger,
   which is already switched on.
3. Click the entry for Framopia Studio, then press **Cmd-R** in that window.

That reloads the panel with the new code. If you would rather not use Chrome,
quitting and reopening After Effects always works.

What should be different: **the service starts.** The panel was looking for the
project in the wrong place — it was working out where the code lives by asking
After Effects a question that only works when an extra Adobe library is loaded,
and this panel never loaded one. So it got nothing back, and "nothing" quietly
became the root of your hard disk. That is why it told you to build a file at
`/service/dist/service.js` — a path that could never have existed — and why
building the service changed nothing.

**Retry also works properly now.** It was not broken exactly: it re-ran the
check every time you pressed it, but it re-ran it against the same wrong
location and produced word-for-word the same message, so there was no way to
tell it had done anything. It now re-does the whole thing from scratch, and each
attempt is numbered and timestamped, so you can always see it responded.

If it still cannot start the service, the message will now list the three ways
it tried to find the project and what each one returned. Send me that text.
