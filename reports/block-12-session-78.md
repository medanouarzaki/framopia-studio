Status: OK

# Block 12, session 78 — where a declared folder goes, and the crash dialogs

Two premises in the brief turned out to be wrong, and both corrections are the
finding. The video folder is **not** lost in code that exists today. The Python
sidecar is **not** being killed by this tool — nothing on that path sends it a
signal at all.

## 1. Every step a declared folder passes through, and where it was lost

| step | what it does with the value |
|---|---|
| `pickFolder` (`panel/src/file-dialog.ts:132`) | CEP's own chooser. Cancel is `null`, and every call site leaves what he had alone. |
| `ClientCard.tsx:435` | `set({ videoFolder: chosen })` — only on a non-null choice. |
| `ClientCard.tsx:364` | `setClientDetails(connection, { client, details: draft })` — the whole draft. |
| `panel/src/service.ts:525` | `POST /clients/details`. A non-2xx **throws**, and the card shows the message. |
| `service/src/server.ts:410` | Parses, requires `client` and `details`, calls `setDetails`. |
| `service/src/clients/create.ts` `setDetails` | `if (given('videoFolder')) setOrClear(next, 'videoFolder', textOrNull(...))`. |
| `writeMode` | Validates the whole file, then writes. |

**Run for real, through the real writer, on a scratch client:** the folder lands
on disk and reads back through `loadMode`. The new-client screen sends it too
(`NewClient.tsx:144`, inside the `permanent` branch, and the folder field is only
rendered for a permanent client — so nothing is collected there that is dropped).

**So it is not lost anywhere in the code that exists today, and I could not
reproduce the loss.** Saying which of the panel or the service dropped it would
be a guess: the state that would have decided it — `panel/dist` and
`service/dist` as they stood on 2026-09-09, and `.local/service.json` at the
moment he pressed save — was overwritten by session 77's own rebuilds before
this session began. That is stated rather than covered over.

What this session did find is the one place the product **can** take something a
person typed and lose it in silence, and a leaked process that put older code
within reach. Both are below.

## 2. Could a stale panel explain it? Partly — and it would not have been silent

`panel/dist` is not tracked; it is built on this machine. `videoFolder` reached
`ClientCard`/`service.ts` in `48309e2` (2026-09-05) and `NewClient` in `dd28f5e`
(2026-08-29), so a bundle built before 2026-09-05 has no folder field on the
client card at all — he would have had nothing to press.

But the staleness message he saw is **not** about the bundle versus the source.
`core/src/build-stamp.ts` compares the panel's stamp against the **running
service's**. And there the measurement found something real:

**Two services were listening, and only one was in the lock file.**

| pid | port | started | in `.local/service.json`? |
|---|---|---|---|
| 77155 | 55581 | 2026-09-09 18:45:39 | yes |
| 62058 | 61620 | **2026-09-03 23:07:41** | **no** |

Pid 62058 has been running for six days, from `service/dist/service.js` as it
stood on 2026-09-03 — **two days before `/clients/details` existed**. Probed with
a client name that does not exist, so nothing could be written, the live service
answers `400 there is no client called no-such-client-probe`; the orphan answers
`401`, because it still holds its own 2026-09-03 token, which is why its routes
could not be probed further.

**This does not explain a silent loss, though.** That route did not exist on
2026-09-03, so the request would have been a 404, and `setClientDetails` throws
on any non-2xx — the card shows the message and stays open. A stale service
fails loudly.

The orphan is left running. Killing a six-day-old process on his machine was not
needed to establish any of the above, and is not this session's to decide.

## 3. What a field the service does not recognise does now

**Before**, measured on a scratch client through the real writer:

```
--- a field the service does not recognise ---
ACCEPTED IN SILENCE. notAField on disk: undefined
videoFolder now: "/x"
```

`setDetails` touches only the fields it knows, by asking `hasOwnProperty` for
each. A field it does not know was never asked about — read out of the request,
dropped, answered `200`, and the panel closed its editor because as far as it
could tell the save had worked.

**After:**

```
refused: a client has nothing called notAField, so that change was not saved.
A client has: name, about, videoFolder, logoPath, language, subtitleBaselineY,
videoShape, watermarkByDefault, fonts.
videoFolder after the refusal: undefined
```

The refusal is **atomic** — the good field in the same request did not half-land,
because the check runs before anything is read or written. And the round trip it
was blocking:

```
--- videoFolder on its own ---
on disk: "/Volumes/T7 Shield/Somewhere/Their Footage"
read back through loadMode: "/Volumes/T7 Shield/Somewhere/Their Footage"
```

Refused at the write path only. `parseMode`/`validateMode` are untouched, so
nothing already on disk becomes unreadable — the schema-fragility rule.

## 4. How the sidecar is stopped, before and after

**It was never being killed.** There is no `kill`, `SIGTERM` or `SIGKILL` on the
sidecar path; the only match in `service/src/images/sidecar.ts` is line 95, a
string that *reports* a signal. `runSidecar` spawns it, writes JSON to stdin, and
waits for `close`. So the brief's remedy — ask, wait, then force — has nothing to
attach to, and no timeout was invented for a signal nobody sends.

The 117 Python crash reports in `~/Library/Logs/DiagnosticReports` were
classified rather than counted, by how many images the crashed process had
loaded:

| population | count | what it is |
|---|---|---|
| 7–54 images | **107** | the sidecar tests' own fixtures |
| 258–261 images | **10** | the real sidecar |

**107 of the 117 dialogs were tests passing.** `sidecar.test.ts` wrote two
throwaway Python programs that call `os.abort()` to prove the service names how a
sidecar died. Every suite run produced three crash reports and three dialogs.
They now `os.kill(os.getpid(), SIGKILL)` — still a death by signal, which is the
whole of what those tests assert, and macOS writes no report for a killed
process because it did not fault.

The other 10 are the real sidecar, on 2026-09-03, 05 and 07. Their faulting
thread is **not** the main thread: `recursive_mutex::lock()` throwing
`system_error` → `__cxa_throw` → `std::__terminate` → `abort`. That is the
onnxruntime teardown `sidecar.ts` already documents, during interpreter exit,
after the answer is flushed. `cli.py` now flushes both streams and leaves through
`os._exit`, which runs no atexit handler, no garbage collection and no C++ static
destructor — the code that was aborting.

### Crash reports, before and after

| what ran | reports before | after | rose by |
|---|---|---|---|
| `sidecar.test.ts`, fixtures calling `os.abort()` | 108 | 111 | **+3** |
| same suite, `os._exit` in `cli.py`, fixtures unchanged | 111 | 114 | +3 |
| same again | 114 | 117 | +3 |
| same suite, fixtures on `SIGKILL` | 117 | 117 | **+0** |
| again | 117 | 117 | **+0** |
| again | 117 | 117 | **+0** |

**An honest limit.** The +3 rows measure the fixtures, not the product — I did
not realise that until I read what the crashing processes actually were, and the
middle two rows are that mistake on the record. **The 10 real-sidecar crashes I
could not reproduce at all**: six real `remove_bg` runs and three
`segment_person` runs on the old code produced none, and there have been none
since 2026-09-07. So the `os._exit` change is **not proved by measurement**. It
is correct by construction against the signature above — it skips the code that
aborts — and that is all this session can claim for it. What *is* proved by
measurement is the 107, which is where his dialogs were mostly coming from.

## 5. No sidecar is orphaned

`pgrep -f framopia_cv.cli`, which counts the real thing rather than a guess:

| after | sidecars alive |
|---|---|
| three real `remove_bg` runs, normal stop | **0** |
| the suite, which kills one mid-work | **0** |
| its parent exiting while it works | 1, for ~4 s, then **0** |

The third is worth stating exactly: a sidecar **does** outlive a parent that dies
mid-task — Node does not take its children with it — but it finishes the task it
was given and exits on its own. It was measured to zero by polling, not assumed.
Nothing is left behind permanently.

The leaked **service** in part 2 is a different matter and is not fixed here.

## 6. Every new assertion, red then green

Seven in `service/src/clients/edit.test.ts`. Red is with
`onlyFieldsAClientHas(details);` commented out, restored from a saved byte copy,
never with git:

```
 × a change naming something a client does not have > is refused, and names the field and what a client does have
   → expected [Function] to throw an error
 × a change naming something a client does not have > saves nothing else in the same change
   → expected [Function] to throw an error
 × a change naming something a client does not have > names every stranger, not just the first
   → expected [Function] to throw an error
   Tests  3 failed | 19 passed (22)
```

Green with the guard restored: `Tests  22 passed (22)`.

The seven, by name — `is refused, and names the field and what a client does
have`; `saves nothing else in the same change`; `names every stranger, not just
the first`; `lets every field a client does have through`; `lands in the file and
is read back`; `is cleared by sending null, and blank counts as cleared`; `does
not move the client’s version`.

The last four are green before and after the guard: they assert the round trip
session 77 could not find on either real client, so a future session inherits a
fact rather than this session's inability to reproduce the loss.

## 7. Gates, and part 0 at both ends

| gate | result |
|---|---|
| `npm run golden` | **PASS** — 4 of 4, **17,174 fields**, ledger 165 lines `786497a5f371d179` |
| `npm run check` | **exit 0**, run alone after committing |
| panel suite ×5 | exit **0, 0, 0, 0, 0** — 282 passed + 2 skipped, five times |

Suite counts, and the arithmetic by name:

| package | session 77 | now | difference |
|---|---|---|---|
| core | 823 passed / 0 skipped / 823 | 823 / 0 / 823 | — |
| service | 1428 / 0 / 1428 | **1435** / 0 / 1435 | **+7**, the seven named above |
| benchmarks | 173 / 0 / 173 | 173 / 0 / 173 | — |
| panel | 282 / 2 / 284 | 282 / 2 / 284 | — |
| tools/cv (pytest) | — | 149 passed | ran green after the `cli.py` change |

**Two exit-1 results, both mine, both explained.** The first `npm run check`
exited 1 and one of the first five panel runs exited 1 with all 282 tests
passing. I had started the gate in the background and then run the panel suite
five times against it; the gate rebuilds `panel/dist`, which the browser tests
read while running. Run alone, the gate exits 0 and the panel suite exits 0 five
times in a row. Nothing was retried until it went green — the contention was
found first and then removed.

### Part 0, at both ends

| measurement | start | end |
|---|---|---|
| ledger | 165 lines, `786497a5f371d179` | 165 lines, `786497a5f371d179` |
| `templates/library.aep` | `4b0cf05a8f5d4775` | `4b0cf05a8f5d4775` |
| `modes/dr-loubna-kfafi.json` | `f60749f5629b2ced`, Sep 4 00:05:37 | `f60749f5629b2ced`, Sep 4 00:05:37 |
| `modes/k2-syndicalia.json` | `c600905c5e36ecbc`, Aug 31 19:33:57 | `c600905c5e36ecbc`, Aug 31 19:33:57 |
| `assets/client-pictures/` | empty | empty |
| extensions folder | one symlink, Aug 27 19:06:47 | one symlink, Aug 27 19:06:47 |
| After Effects | 1 instance, 0 `aerender` | 1 instance, 0 `aerender` |
| working tree | clean | clean |
| `origin/main..main` | 0 | 0 |

`.local/` at both ends, unchanged: audio 27 · bench-audio 5 · build 71 · cache
159 · cv 2234 · deleted-clients 0 · doctor 1 · evidence 3 · ground-truth 10 ·
plans 66 · quarantine-session51 363 · quarantine-session53 139 ·
quarantine-session54 1 · quarantine-session69 3 · quarantine-session71 0 ·
transcripts 1.

**Neither real client file was written to at any point.** Every write in this
session went to a scratch client under `FRAMOPIA_MODES_DIR` in the scratch
directory; `modes/` holds the same two files it held at the start.

The first `aerender` count I took said 2. Looking at what it counted, both lines
were my own `grep` command's shell. The real count is 0, and the After Effects
count is 1 process, the rest being helpers and `crashpad_handler`.

## 8. Ledger lines added

**None.** 165 lines at the start, 165 at the end, `786497a5f371d179` at every
check — before the work, at both `npm run golden` runs, and at the end. Expected
spend $0.00, actual $0.00: no paid API call, no picture generated, no video
transcribed.

## What is open

- **A six-day-old orphaned service (pid 62058, port 61620)** is still listening,
  from code that predates `/clients/details`. Nothing stops a second service
  starting beside the one in the lock file, and nothing reaps it.
- **The folder Mohamed set was not recovered, and the cause is not established.**
  Nothing in current code loses it. If he sets one now and it does not appear on
  the card, the service will say why instead of answering 200.
- **The real sidecar's abort is unproven-fixed**, for want of a reproducer. Ten
  crashes on 2026-09-03, 05 and 07; none since.
- The comment in `sidecar.ts` blaming onnxruntime's static destruction is
  correct for the 10 real crashes — this session first attributed them to
  `absl.logging`'s `os.abort()`, which is what the *fixtures* look like, and the
  crash reports corrected it.
