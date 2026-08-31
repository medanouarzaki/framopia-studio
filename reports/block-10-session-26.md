Status: OK — the panel starts the service itself and repairs a build mismatch on its own; both gates green

**What changed, in short.** Opening the panel is now enough. If the background
service is not running, the panel starts it; if it has never been prepared on this
machine, the panel prepares it; and if it is running from different code than the
panel — the thing the old banner told you to fix in a terminal — the panel puts
that right by itself and tells you afterwards. **No message in the panel names a
command to type any more.** Nothing else about the product changed.

**Spent $0.00; no API was called.** Ledger **118 lines, sha `3f657131…`,
byte-identical at both ends**. `templates/library.aep` untouched at `d2bbb6b7…`,
552,745 bytes, never opened. The six hand-made references byte-identical. After
Effects pid 79146, 0 `aerender`, fonts 1198 → 1198.

## Done

### How it started today, before anything changed

**The panel already started the service, and that part was sound.** `connect()` in
`panel/src/service.ts` reads `.local/service.json`, signals the pid, and calls
`host.spawnService()` when nothing is there. `spawnService` in `host.ts` runs the
**Node binary directly** at a resolved absolute path — never `npm`, never through a
shell, because After Effects launches from the Finder with a `PATH` of roughly
`/usr/bin:/bin`. It waits for the child to fail, exit, or survive rather than
reporting success the moment `spawn()` returns.

**It never starts a second one**, three ways: an answering handshake is reused; a
pid that is alive but silent is *reported* rather than spawned around, because a
second service would make it worse; and when two panels open together, both spawn,
the loser's service exits on the live lock and the panel that lost then reaches
the winner instead of showing a failure. A service started from a terminal is
simply found and used.

**What CEP allows, measured rather than assumed.** `panel/CSXS/manifest.xml`
declares `--enable-nodejs` and `--mixed-context`, which is what puts `cep_node` on
the page's own window; the panel calls `cep_node.require('child_process')` for
this and has since Block 8. `CSInterface` is never loaded in this extension.
There is no CEP mechanism that starts a process *for* you — the panel does it
itself, and always has.

**`panel/scripts/install.mjs`** sets `PlayerDebugMode` and symlinks the extension
folder. Starting the service does not belong there: it runs once, at install, and
the service has to start every time the panel opens.

**The mismatch banner.** It compares `__PANEL_BUILD_STAMP__`, baked into the
bundle at build time, against `buildStamp` on `/health`, which the service reads
**once at startup** from `service/dist/build-stamp.json`. Only the content-hash
half decides, so a new commit alone never trips it. They drift because
`npm run check` rebuilds the panel bundle — through the panel workspace's own test
script — and **never touches `service/dist`**.

### The panel prepares a service that was never compiled

A fresh checkout used to reach a message reading *"the service is not built …
Run `npm run service:build` in the repository"*. **The panel compiles it now.**
npm's own CLI is a JavaScript file beside the Node binary, so a resolved Node runs
it with no shell and no `PATH` — measured at **2.8 s** on this machine. It tries
once; a second failure is reported as itself, naming what was missing and why
preparing it did not work, with no command in the sentence.

### The mismatch repairs itself

**The detection is untouched** — it is right every time, and only the remedy was
wrong.

`repairFor` in `core/src/build-stamp.ts` decides which of two different problems
is wearing the banner:

- **`restart`** — the compiled service on disk already matches the panel and the
  running process is simply older. Starting it again is enough.
- **`rebuild`** — the compiled service does not match either, so restarting would
  read the same stale file and report the same mismatch. **This is the ordinary
  case after `npm run check`.**
- **`unknown`** — a stamp is missing. Nothing is repaired on a guess.

`repairService` then **stops before it starts**. `--force` takes the lock without
stopping the old process, so two services run and stopping the loser deletes the
winner's handshake — a defect this project has already paid for once. Stopping
first means there is only ever one. SIGTERM rather than SIGKILL, so the service
clears its own handshake on the way out.

**Bounded to one repair per panel session** (`MAX_REPAIR_ATTEMPTS = 1`). A panel
that restarts a service in a loop is worse than a banner. After the bound the
mismatch is reported and left alone.

**What a restart cannot fix**: a mismatch where the compiled service is itself
behind. That is why the rebuild branch exists, and it is handled rather than
described. What is left is a rebuild that genuinely fails — a compile error in the
service — and the panel says so in a sentence naming the failure, with no command.
That is the one case where a developer is needed, and it means the code is broken
rather than the machine.

**On screen**, in order: *"The background service was out of date. Restarting it
now."* → while it works, *"Bringing it up to date now — this takes a few
seconds."* → afterwards, *"The background service was out of date. It has been
prepared again and restarted."* Past tense, because by then there is nothing to do.

### Proven against a live service, not only in tests

The machine was already in the failing condition when the session began.

| | |
|---|---|
| running service | `f6225b1554+9d80ac264557cc0b` |
| compiled service on disk | `76b9c06b0a+c73f2c53b364d200` |
| panel bundle, rebuilt | `76b9c06b0a+484c1864d2be8992` |

**The rebuild branch, observed:** `repairFor` chose `rebuild`, the rebuild ran, and
`service/dist` came out at **`76b9c06b0a+484c1864d2be8992`** — byte-identical to
the panel bundle. The old service was stopped and its handshake was gone.

**The restart branch, observed unbroken:**

```
BEFORE   pid 53739  stamp 76b9c06b0a+484c1864d2be8992
ACTION   restart  ok = true
ON SCREEN The background service was out of date. It has been restarted.
AFTER    pid 54157  stamp 76b9c06b0a+484c1864d2be8992
OLD PROCESS ALIVE = false
MATCHES PANEL = true
```

Both runs drove the real `repairService` against the real running service, with a
host built from ordinary Node calls in place of CEP's.

**And it was seen in a real browser.** The build-stamp browser test loads the built
bundle with a deliberately wrong stamp; the panel detects the mismatch and starts
repairing on its own, so what renders is the repair rather than an instruction. The
test now asserts that, and asserts the screen contains no `npm run` and no
mention of a terminal.

**Six unit tests** on the repair: the order is rebuild → stop → start, a matching
`dist` does not trigger a rebuild, an uncomparable pair changes nothing, a failed
rebuild is reported in words, and the bound is one.

### Orphans

The service is spawned `detached` and `unref`'d, so **it keeps running when After
Effects quits** — which is what makes reopening the panel instant. A stale one is
not a problem: the next start reads the handshake, signals the pid, and either
reuses a live service or reclaims the lock from a dead one. `processAlive` reads
`EPERM` as alive, so a pid owned by someone else is never treated as free.

### What still needs a terminal

Written into `docs/SECOND_MACHINE.md` in plain words and into `CLAUDE.md`.
Nothing on this list was built.

**Making a video needs no terminal at all.** Setting up a client, choosing a video,
running the pipeline, editing words and keywords, choosing pictures, the watermark,
and building are all controls on screen. The watermark and loudness measurements
are taken by the pipeline as it runs.

What remains: **installing the machine once** (Node, ffmpeg, fonts, `npm install`,
`tools/cv/setup.sh`, `npm run panel:install`); **adding a client's own
photographs**, which is the next session and the last gap in ordinary use;
`npm run doctor`; `npm run backup`; and `npm run audit:templates` after someone
edits the templates. Everything else in `package.json` is a developer's tool.

## Deviations

**A live service was stopped and restarted several times** while proving the
repair, and the machine ends with a service running from current code. That is the
feature working rather than a side effect, and no plan, cache entry or reference
was touched by it.

## Failures & open problems

**Nothing failed**, and `npm run check` passed on its first run — the panel's
intermittent image-picker tests did not fire this session.

**Unproven, by name:**

- **The repair has not been seen inside After Effects.** Every run above used a
  host built from ordinary Node calls, and the browser test uses a stub. What is
  unexercised is CEP's `cep_node.require('child_process')` doing the stop and the
  rebuild — the spawn on that path is long established, the other two are new.
- **The rebuild has only ever succeeded here.** A genuinely broken compile
  producing that message has not been watched.
- **Two panels racing during a repair** is reasoned about, not measured: each
  repairs at most once, and the second finds the first's service by handshake.

**Still open, untouched:** client photographs; `ground-truth` unbuildable pending
about $2.17 of pictures; the framing and literal-versus-atmospheric prompt changes
never seen in a picture; the three false-premise tests session 20 found;
`build-reel.jsx`'s guard not recognising another checkout's output.

## Repo state

| | |
|---|---|
| branch | `main` |
| HEAD | `docs: say what still needs a terminal` |
| `npm run check` | **exit 0, `check: PASS`** — core 747 passed (747), service 1202 passed (1202), benchmarks 173 passed (173), panel 197 passed / 2 skipped (199), pytest 149 |
| `npm run golden` | **PASS — 4 of 4 matched, field for field**, 17,174 fields |
| ledger | 118 lines, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` |
| `templates/library.aep` | `d2bbb6b727f819078b5e8dec08a59722b018dc6c0d1d77c123476f8241c84d9c`, 552,745 bytes |
| credit remaining | about **$6.64**, unchanged |

## Suggested next step

Client photographs — the last thing in ordinary use that the panel cannot do. The
service route and the picture editor both exist; what is missing is a control on
the client screen.

## What to do to test this yourself

Four steps, no terminal:

1. **Quit After Effects.** Wait a few seconds.
2. From the Activity Monitor, or simply after a restart of the Mac, make sure no
   Framopia service is running — a restart guarantees it.
3. **Open After Effects, then Window → Extensions → Framopia Studio.**
4. Watch the readiness line. It should go from starting to **Ready** on its own,
   with nothing typed anywhere.

To see the repair: leave the panel open, have someone run `npm run check` once
(that is the thing that rebuilds the bundle), then close the panel and open it
again. It should say the background service was out of date and that it has been
put right — and then be Ready.
