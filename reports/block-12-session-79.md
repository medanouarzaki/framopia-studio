Status: OK

# Block 12, session 79 — one service, and a folder that lands

## 1. What the orphan was, before it was stopped

`/health` needs no token, and it carries the build stamp, which carries the
commit. So the six-day-old service could be identified exactly without ever
holding its token.

| | orphan | the one in the lock file |
|---|---|---|
| pid | 62058 | 77155 |
| port | 61620 | 55581 |
| started | 2026-09-03 23:07:41 | 2026-09-09 18:45:39 |
| build stamp | `33fbd60929+0ef5a792127227c2` | `a3fb29556c+7e013b5f6a983148` |
| commit | **`33fbd60`, 2026-09-03** | `a3fb295`, session 77 |

**What could not be established, and was not guessed at:** everything behind the
token wall. Auth runs before routing, so `/clients/details`, `/modes`, `/videos`
and a path that has never existed all answer `401` identically on both services.
Nothing about its routes, its state, or what it had been asked leaks from the
outside. Its token was written on 2026-09-03 and overwritten on disk long ago.

**How a second service comes to exist**, traced through the code:
`inspectLock` reads a file and reports whether a pid is alive; `startServer`
refuses on that, *unless* `--force`, which binds a fresh random port and writes a
new handshake **without ever signalling the incumbent**. `startServer`'s own
comment predicted the result — *"the panel would talk to whichever wrote last
while the other went on holding a port."* The panel's repair does stop a service
first, but only `previousPid`, the one the handshake named; nothing has ever
enumerated what is actually running.

**Which specific event orphaned 62058 cannot be established.** Nothing records
service starts, and the `clearHandshake` pid guard that would explain it was
already in place at the orphan's own commit (added `aaf5ab8`, 2026-08-29). The
mechanism is established; the occasion is not, and no story was constructed for
it.

**Then it was stopped.** `kill -TERM 62058`, gone in about 2 seconds, confirmed
by `kill -0`. The lock file still named 77155 afterwards, unchanged — the pid
guard in `clearHandshake` behaving as designed.

## 2. Could it have swallowed a save silently? Refuted

At commit `33fbd60`, `service/src/server.ts` contains **no `/clients/details`
route** — `git grep -c` on that commit's file returns 0 — and its fallthrough is
`sendJson(res, 404, { error: 'not found' })` at line 701. On the panel side,
`setClientDetails` does `if (!res.ok) throw new Error(body.error ?? …)`, and the
client card renders that message and stays open.

So had the panel been talking to the orphan, Mohamed would have seen **"not
found"** on the card. It could not have taken a save and lost it in silence.
Session 78's argument was right, and this is it confirmed from the orphan's own
source rather than from reasoning about dates.

**The folder's disappearance therefore remains unexplained.** Two candidates are
now eliminated — current code carries it correctly (session 78), and the orphan
would have refused loudly.

## 3. One service, or a clear refusal

**The mechanism is a port, held for the process's lifetime**, not the handshake.
A file is data: it can be stale, it can name a recycled pid, and it can be
deleted while a service is live. A listening socket is the one claim no file
operation can forge or free, and the kernel releases it however the process dies.

The data port stays random, as ARCHITECTURE §1.3 says; this is a separate socket
carrying no traffic, which exists to be held. `--force` no longer passes it: it
was meant to take a lock from a service that had gone, and taking the place from
one that is answering is exactly what left two running.

Proved, each case run for real:

| case | result |
|---|---|
| a second service beside a live one | `refused: a service is already running as pid 70187 on port 57921` |
| the same, with `--force` | `refused: a service is already running as pid 70187 on port 57921` |
| the handshake names a dead pid, nothing running | `STARTED on 57920 — a stale name did not block a legitimate start` |
| the handshake deleted with a service live | `refused: a service is already running as pid …, and the handshake naming it is gone` |

The third is why the guard is not simply "refuse if anything is there": a
leftover must not block a legitimate start, and it does not, because a dead
process released the port.

### Reds, with the guard removed

```
 × a second service beside a live one > is refused even with force, because the place is held
   → promise resolved "{ server: Server{ …(31), …(9) }, …(2) }" instead of rejecting
 × a second service beside a live one > is refused when the handshake has been deleted under it, and says it cannot name it
   → promise resolved "{ server: Server{ …(31), …(9) }, …(2) }" instead of rejecting
 × who is standing in the only place > names the live service, even with no handshake on disk
   → expected null to deeply equal { pid: 75624, port: 58365 }
   Tests  3 failed | 7 passed (10)
```

Restored from a saved byte copy, never with git: `Tests  11 passed (11)`.

The first case stays green without the guard, correctly: `inspectLock` already
catches the ordinary one, and it is the friendlier answer because it can name the
pid and port. The guard is what holds when the file cannot.

**Never unreachable.** A guard that refused a start while the handshake was gone
would trade two services for none — nothing to reach, nothing startable. So the
place answers who is standing in it, and the refusal names them:
`a service is already running as pid 75624 on port 58365, and the handshake
naming it is gone`. The panel already stops a service by pid and starts a fresh
one; this is where the pid comes from. Measured with the handshake deleted under
a live service: `who holds the only place: {"pid":70630,"port":57949}` — matching
the live service.

**One correction the gate forced.** The first guarded gate run failed with 20
red in `server.test.ts`: the guard was refusing the suite's own servers, which
all default to the same port. A service publishing its handshake somewhere else
is a test or a diagnostic run, not the machine's service, so it no longer claims
the place; a test that means to exercise the guard names a port. That is the rule
`FRAMOPIA_SERVICE_JSON` already documented.

## 4. What now notices an extra service

The guard stops a *new* one. It says nothing about the ones already running —
the orphan held no guard port and never would have. So the **process table** is
asked, not the port: `pgrep -f service/dist/service.js`, excluding this pid.
Reported in `/health` as `otherService`, read on every heartbeat so it stays
true while the panel is open.

What he sees, quoted:

> A second background service is running as well as this one. Yours is fine —
> but the other one may be older, and it can answer with settings this panel
> never sent it.

> Nothing has been stopped. It was started at some point and left running, and
> it is yours to keep or to end.

with a button reading **Stop the other one**. No command is named and he is asked
to leave nothing; `leave-the-panel.test.ts` reads this file and passes.

**Proved against a real second service**, spawned through the entry point the
panel spawns, in its own process:

```
a real second service: pid 75170, port 58314
this service: pid 75161, port 58315
otherService in /health: {"pid":75170,"startedAt":"Wed Sep  9 20:48:22 2026"}
names the real second service: true
--- he presses "Stop the other one" ---
reply: {"stopped":75170}
the other service is still running: false
a service it was NOT asked about is untouched: []
otherService in /health after: null
```

**A mistake worth recording, because it cost something.** The route first
stopped *every* other service at once. Proving it, my scratch service counted
Mohamed's real one as "another" and stopped it: `stoppedAll: [73168, 77155]`.
His service was not running for the rest of the session. Nothing was lost — the
service holds no state, it clears its own handshake on the way out, and the
panel spawns a fresh one when it finds none, which is the designed recovery and
needs no terminal. The route now takes the pid he was shown and stops that one
only, and a pid that is not a Framopia service is refused rather than signalled.
The broad version is gone.

## 5. The folder, set and read back on a scratch client

Through `POST /clients/details`, the route the panel calls, against a running
service:

```
scratch client: scratch-folder-session-79
videoFolder before: undefined

--- through POST /clients/details, the route the panel calls ---
HTTP 200
on disk now: "/Volumes/T7 Shield/Framopia/Clients/Dr Loubna Kfafi"
what the panel reads back: "/Volumes/T7 Shield/Framopia/Clients/Dr Loubna Kfafi"

--- the file itself ---
{
  "id": "scratch-folder-session-79",
  "name": "Scratch Folder Session 79",
  "version": 1,
  "videoFolder": "/Volumes/T7 Shield/Framopia/Clients/Dr Loubna Kfafi"
}
```

The version does not move: a folder is not in the pinned snapshot, so correcting
it cannot restyle a reel already built.

## 6. The one step Mohamed takes

Neither of his own client files was touched by this session, and both are
byte-identical at both ends. Setting them is his to do, and it is one step per
client:

**On the client card, open the editing controls, press the chooser beside
*Their video folder*, pick the client's own folder, and press save.**

For Dr Loubna Kfafi, the folder to pick is the one that contains **both** of her
videos — the client folder itself, not either of the two sub-trees her footage
sits in (`Framopia Studio Inputs/Footages/` and `September Content/Exports/Work
in Progress/`). A folder chosen below the client root leaves her other video
unowned, which session 77 measured and nothing warns about.

**If it works**, the path appears in the field on the card straight away, and it
stays there when the card is closed and opened again — the card reads it back
from the client's file, so seeing it there means it is on disk.

**If it does not**, he will see a sentence rather than silence. Since session 78
a field the service does not recognise is refused with its name in the message,
and the card stays open showing it — for example
`a client has nothing called videoDirectory, so that change was not saved.
A client has: name, about, videoFolder, logoPath, language, subtitleBaselineY,
videoShape, watermarkByDefault, fonts.` Measured as HTTP 400 through the real
route. What can no longer happen is the card closing as though it saved while
nothing changed.

## 7. Gates, and part 0 at both ends

| gate | result |
|---|---|
| `npm run golden` | **PASS** — 4 of 4, **17,174 fields**, ledger 165 lines `786497a5f371d179` |
| `npm run check` | **exit 0**, run alone, after committing |
| panel suite ×5 | exit **0, 0, 0, 0, 0** — 285 passed + 2 skipped, five times |

| package | session 78 | now | difference |
|---|---|---|---|
| core | 823 / 0 / 823 | 823 / 0 / 823 | — |
| service | 1435 / 0 / 1435 | **1446** / 0 / 1446 | **+11** |
| benchmarks | 173 / 0 / 173 | 173 / 0 / 173 | — |
| panel | 282 / 2 / 284 | **285** / 2 / 287 | **+3** |
| tools/cv (pytest) | 149 | 149 | — |

The eleven in `service/src/only-one-service.test.ts`: `is refused, and names the
one already running`; `is refused even with force, because the place is held`;
`is refused when the handshake has been deleted under it, and says it cannot name
it`; `does not block a legitimate start when it names a dead process`; `does not
block a start when there is no file at all`; `names the live service, even with
no handshake on disk`; `answers null when nobody is standing there`; `answers
null when the port is held by something that says nothing`; `never counts this
process as another one`; `excludes whichever pid it is told is itself`; `is named
in the refusal by pid and port`.

The three in `panel/src/other-service.browser.test.ts`: `says one is running,
visibly, without naming a command`; `stops nothing until the offer is pressed`;
`says nothing at all when there is only one service`.

**Three gate runs, three real failures, all found rather than retried.** The
first: four lint errors of mine, including an import left behind when detection
moved from the port to the process table — which also showed that
`whoHoldsTheOnlyPlace` was not wired into the product at all, so it now supplies
the pid in the no-handshake refusal. The second: the guard refusing the test
suite's own servers, fixed by the publishing rule in §3. The third: exit 0.

### Part 0, at both ends

| measurement | start | end |
|---|---|---|
| ledger | 165 lines, `786497a5f371d179` | 165 lines, `786497a5f371d179` |
| `templates/library.aep` | `4b0cf05a8f5d4775` | `4b0cf05a8f5d4775` |
| `modes/dr-loubna-kfafi.json` | `f60749f5629b2ced`, Sep 4 00:05:37 | `f60749f5629b2ced`, Sep 4 00:05:37 |
| `modes/k2-syndicalia.json` | `c600905c5e36ecbc`, Aug 31 19:33:57 | `c600905c5e36ecbc`, Aug 31 19:33:57 |
| services listening | **two**: 62058 (Sep 3, port 61620, not in the lock file) and 77155 (Sep 9, port 55581, in it) | **none**; handshake absent |
| `assets/client-pictures/` | empty | empty |
| extensions folder | one symlink, Aug 27 19:06:47 | one symlink, Aug 27 19:06:47 |
| After Effects | 1 instance, 0 `aerender` | 1 instance, 0 `aerender` |
| working tree | clean | clean |
| `origin/main..main` | 0 | 0 |

`.local/` unchanged at both ends: audio 27 · bench-audio 5 · build 71 · cache 159
· cv 2234 · deleted-clients 0 · doctor 1 · evidence 3 · ground-truth 10 · plans
66 · quarantine-session51 363 · quarantine-session53 139 · quarantine-session54 1
· quarantine-session69 3 · quarantine-session71 0 · transcripts 1.

`modes/` holds the same two files it held at the start; every write went to a
scratch client under `FRAMOPIA_MODES_DIR` in the scratch directory.

**No service is running at the end**, and there is no handshake. That is the
state the panel spawns a fresh service from, so nothing is stuck and no terminal
is needed. It is listed rather than tidied away because it is a real difference
from the start of the session, and it is the consequence of the mistake in §4.

## 8. Ledger lines added

**None.** 165 lines at the start, 165 at the end, `786497a5f371d179` at every
check — before the work, at both `npm run golden` runs, and at the end. Expected
spend $0.00, actual $0.00.

## What is open

- **The folder Mohamed set is still unexplained.** Two candidates eliminated;
  nothing in current code or in the orphan's code loses it silently.
- **A folder declared below the client root still leaves sibling footage
  unowned**, and nothing warns him. Carried from session 77.
- **A machine that cannot bind loopback starts unguarded**, deliberately — an
  unreachable service is worse than two — and nothing yet says on screen that
  the guard was not taken.
- The real sidecar's abort remains unproven-fixed, from session 78.
