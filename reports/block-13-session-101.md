Status: OK

# Block 13, session 101 — finish the states, and fix the three that need the service

The state he meets daily is fixed, the three defects session 100 could not reach
are resolved — two fixed, one written up as a ruling — and **widening the rule
caught five hits in four files, not the one that was expected.**

Panel **353 passed**, service **1577 passed**, gate green, bundle rebuilt.
**`core/` is untouched**; three lines changed in `service/` and all three compose
a message.

## 1. A fully-run video

It showed four rows of *Already done — nothing to pay* and two buttons at
*nothing to pay*. Every word true, and together they read as the tool describing
its own idleness rather than his finished work.

At the top of **This video**, and only when there is genuinely nothing left:

> **Everything for this video is made. Go to Build to put the composition
> together.**

**It counts nothing.** Build already says what the composition contains, in one
place, and a fifth place that counts cards would be four too many — a test asserts
the sentence contains no digit and neither *card* nor *picture*.

**The buttons are untouched.** Re-running is legitimate; session 90's spreading
came out of a re-plan. They still say what they cost and they are still not red
when they cost nothing.

## 2. Every remaining state, with the three questions

**Rebuilt this session: the fully-run video, and the refused queued video.**

| state | knows what happened | knows the one next thing | proportionate |
|---|---|---|---|
| **a video fully run** | **now yes** — *Everything for this video is made* | **now yes** — Build | yes, one line |
| a run in progress | yes — *Doing this now*, and which stage | wait | yes |
| a step taking minutes | yes — the note says so | wait | yes |
| a stage failed | yes — session 95's `causeWords` | yes, one thing | one sentence |
| **a queued video refused** | **now yes** — *You have already chosen pictures for this one* | **now yes** — nothing was changed | one sentence |
| a queue running, from Choose or Build | yes — the step says `3/15` | nothing, or Stop | yes |
| came back mid-queue | **partly** — the step says `9/15`, nothing says *this kept going* | yes | yes |
| a composition rebuilt | yes — *replacing what is there* | press it | yes |
| after a build succeeds | yes — *Your composition is here*, the path, *nothing was rendered* | look at After Effects, said | yes |
| panel on older code | yes | yes — the one exempt command | yes |
| two services running | yes | yes, one button | yes — **still never seen by anyone** |
| a very long name | yes — session 99 shortened 44.1 chars to 9.6 | — | yes |
| many videos, a queue of one | yes | yes | yes |

**Still not designed, and named rather than claimed:**

- **Coming back mid-queue** says `9/15` but never *"this kept going while you were
  away"*. Partly answered by session 98's step news; not finished.
- **A one-off client** — *"Just this video…"* is an option with no explanation of
  what it does. Untouched.
- **The no-file-dialog notice** recites eleven file extensions at him. Untouched.
- **The stagger** — three fetches in three effects, session 95's measurement.
  Untouched.

**Panel suite after each group:**

| group | count |
|---|---|
| the rule widened to `core/`, five hits classified | 349 passed, 0 failed |
| the queued-video refusal (`service/`) | service 1 failed → **1577 passed, 0 failed** |
| a fully-run video says so | 351 passed, 0 failed |
| one name for one thing | 2 failed → **353 passed, 0 failed** |

**The count rose once and I stopped**: the two failures were assertions on the
names I had just unified — one on *background helper*, one on *5 images*. Both
rewritten (section 10), neither deleted.

## 3. The three defects

### The raw guard text on a refused queued video

**Old**, in `service/src/queue.ts`:

> Did not finish, and trying it again would fail the same way. Nothing you have
> already paid for is lost. **It said: re-generating would discard editor work on
> 8 slot(s): img002 (a candidate was chosen (img002-c2)); img003 (a candidate was
> chosen (img003-c2)); …**

**New:**

> Did not finish, and trying it again would fail the same way. Nothing you have
> already paid for is lost. **You have already chosen pictures for this one, and
> making it again would throw those away.**

Five other causes get their own sentence — the video gone, the ceiling, a missing
file, a rejected key — and one nobody has words for gets *"It stopped before
finishing."* rather than the raw text.

**The refusal is untouched**: same condition (`retryable`), same outcome
(`needsHim: true`), same stage error recorded. Three of session 94's tests —
*does not stop the queue*, *is reported as failed*, *is not tried again when
repeating it cannot help* — were run individually and pass unchanged.

### `NODE_NOT_FOUND_HELP` — a ruling, not a fix

It reaches his screen and says *"`which node` in a terminal prints the path — then
reopen the panel."*

**The panel cannot fix this today.** It runs inside After Effects and starts the
companion service by spawning Node; when `resolveNodePath` finds none there is no
service to ask and nothing to repair. It *could* offer a file chooser and write
the path into `.local/config.json` — that is a new control, a new write and a
validation step, which is building, not rewording.

**So: nothing was built, `core/` was not touched, and the message is exactly as it
was.** It is named in the rule as `A_RULING_MOHAMED_HAS_NOT_MADE`, with the case
written beside it, so the next person finds the question rather than the silence.

### Widening the rule — five hits, not one

`leave-the-panel.test.ts` now walks `core/src` on the same terms as `service/src`:
every `.ts` that is not a test and not a `*-cli.ts`.

| hit | verdict |
|---|---|
| `core/src/node-path.ts` — *terminal*, *reopen the panel* | **a ruling**, above |
| `core/src/templates.ts` — *"Re-run: npm run audit:templates (After Effects must be open)"* ×2 | **no panel can do it** — re-auditing drives a script over `library.aep`; same shape as `tools/cv/setup.sh` |
| `core/src/impact-frame.ts` — *"re-run npm run audit:templates"* | same |
| `core/src/references.ts` — `readBy: 'npm run bench:tag…'` ×2 | **not a message** — the field is declared, populated and **read by nothing**: no screen, no log, no error. The same judgement session 91 made about `REBUILD_COMMAND` |

**Proved biting**, with a command put into a file the rule had never read before:

```
   × no message sends the user out of the panel > names no application to quit, restart or reopen, and no command to type
     → expected [ 'core/src/mode.ts: "npm run"', …(1) ] to deeply equal []
+   "core/src/mode.ts: \"npm run\"",
+   "core/src/mode.ts: \"terminal\"",
```

Restored from a saved copy; `git status -- core` empty afterwards.

## 4. One name for one thing

| thing | old | new | why |
|---|---|---|---|
| the companion service | **the background helper** (4, session 100's) | **the companion service** | 7 readable strings already say it, including settled ones |
| a generated picture | **image / images** in Build (2) | **picture / pictures** | 28 readable strings say *picture*; session 95 settled the stage as *Drawing the pictures* |
| a video | **this reel** in the 404 sentence (1) | **this video** | 48 readable strings say *video*; *reel* is what the code calls it |

**Checked and found not to be conflicts:** *queue* vs *the list* — *"the list of
videos came back unreadable"* is a different list, not the queue's; *stage* vs
*step* — the switcher's steps and a run's stages are different things.

## 5. Each screen's height, both service states

| screen | answering (s100) | answering (now) | unreachable (s100) | unreachable (now) |
|---|---|---|---|---|
| 1. Choose | 625 px | **625 px** | 683 px | **683 px** |
| 2. Make | 676 px | **676 px** | 734 px | **734 px** |
| 3. Build | 516 px | **516 px** | 574 px | **574 px** |

**Identical in both states.** The finished-video line replaces nothing and appears
only on a fully-run video, which the stub is not; nothing else changed shape.

## 6. Every line changed outside `panel/`

**`core/`: none.** `git status -- core` is empty. The one message there is a ruling.

**`service/src/queue.ts`: three lines removed, all message composition.**

| removed | what it is |
|---|---|
| `const cause = item.error?.cause ?? 'something went wrong and it did not say what';` | a variable holding a message string |
| `` `Nothing was lost. Add it to a queue again when you are back online. It said: ${cause}` `` | the retryable branch's message |
| `` `Nothing you have already paid for is lost. It said: ${cause}`; `` | the other branch's message |

Twenty-two lines added, of which the body is `whyItStopped` — a pure function that
takes a string and returns a string. **No condition, no number, no route, no
price**: `retryable`, `needsHim: true` and `item.outcome` appear in the diff only
as unchanged context.

`service/src/queue.test.ts` is the only other file, and it is a test.

## 7. Colours, buttons, wording and the figures

**Nothing free is red and no failure is red.** The new sentences carry no colour of
their own; the finished-video line is `p.say`, the grey the panel already uses.

**No button does anything different.** Nothing was added to, removed from or
rewired in any control.

**`spend.ts` is untouched** — money is still to the cent and the money screen keeps
its precision. **The full cost screen was not opened.**

**Removed lines, per file, ignoring indentation** — every one a message or an
import:

| file | removed | what they were |
|---|---|---|
| `App.tsx` | 1 | an import line, extended |
| `words.ts` | 4 | the four *background helper* sentences |
| `Build.tsx` | 1 | *image/images* → *picture/pictures* |
| `service.ts` | 1 | *this reel* → *this video* |
| `queue.ts` | 3 | the raw-cause composition |

```
diff before.json after.json  →  FIGURES IDENTICAL to the session 95-100 baseline
```

## 8. The walkthrough

**A video already fully run.** On **2. Make**: *"Everything for this video is made.
Go to Build to put the composition together."* Under it, the two controls, still
saying *Make the subtitles again — nothing to pay* and *Make the pictures —
nothing to pay*, because re-running is his to choose. Below, the queue; below
that, the accounting.

**A stage that failed.** The stage rows show which one *Stopped here*; beneath
them one sentence — *"One of the picture ideas asked for two things in a single
picture, so it was left out. The rest were made. Run the pictures again and a
fresh idea is asked for."*

**A queue of fifteen while he is on Choose.** **2. Make** carries `3/15` in muted
grey. Nothing moves, nothing animates, nothing carries him anywhere.

**Coming back after closing the panel mid-queue.** The step says `9/15`, or
`15 ready` in green, or `1 failed` in amber. **Nothing yet says "this kept going
while you were away"** — section 9.

**A refused queued video, in the summary he comes back to.** *"Did not finish, and
trying it again would fail the same way. Nothing you have already paid for is
lost. You have already chosen pictures for this one, and making it again would
throw those away."*

**The moment a build succeeds.** *Your composition is here*, the path on its own
line, and *"It is open in After Effects now, and nothing was rendered."*

## 9. What I am least sure about

**Naming a step inside a sentence.** *"Go to Build"* is the first message that
points at another part of the panel. It is the one next thing and Build is two
inches away — but if the steps are ever renamed, this sentence goes stale silently,
and nothing would catch it.

**The template-audit exemptions.** I judged that re-auditing `library.aep` is
something no panel can do, so naming the command is the only true sentence. That
is a judgement about a developer artefact reaching a user's screen at all — the
better answer may be that these should never be shown to him in the first place,
which is a change to what `health.templates.issues` renders, not to its words.

**Three states remain undesigned** — coming back mid-queue, the one-off client, and
the file-extension list — and **the stagger is untouched**, four sessions after
session 95 measured its cause.

**What I would change next:** make coming back mid-queue say so, and decide whether
a developer's template-audit failure belongs on his screen at all.

## 10. Gates

`npm run check`, **run alone, after committing: exit 0, `check: PASS`.**

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | **1577** | 0 | 1577 |
| benchmarks | 173 | 0 | 173 |
| panel | **353** | 2 | 355 |
| pytest (CV sidecar) | 149 | 0 | 149 |

core, benchmarks and pytest identical to session 100; service **1575 → 1577**,
panel **349 → 353**.

**Arithmetic by name: 7 added, 1 renamed, 0 deleted.** `+6` panel and `+2` service
reconcile: `words.test.ts` +4, `queue.test.ts` +2 net (3 added, 1 renamed).

| file | added |
|---|---|
| `words.test.ts` | 4 — a video that has already been run |
| `queue.test.ts` | 3 — says why it stopped in his words; says plainly when his own choices stopped it; never puts the stage error in front of him |

**The rename, a rewrite of retired behaviour:**

| old | new |
|---|---|
| `quotes what the failure actually said` | `says why it stopped in his words, and never quotes the stage error` |

Two more assertions were updated where this session unified a name: *background
helper* → *companion service*, and *5 images* → *5 pictures*. Both still assert the
same behaviour and say why in their own comments.

`npm run golden`: **PASS, 4 of 4, field for field.** 4415 + 4280 + 3709 + 4770 =
**17,174**.

**Panel suite five times: exit 0, 0, 0, 0, 0**, all captured, 353 passed and 2
skipped each, no failure and no hook timeout.

**The panel was rebuilt.** `panel.js` 265,430 bytes; the extensions folder points
at this working copy.

### Part 0, at both ends

| measurement | at start | at end |
|---|---|---|
| ledger records | 294 | **294** |
| ledger sha256 | `77eaf6c9…6c1a84d0` | **`77eaf6c9…6c1a84d0`** |
| `templates/library.aep` | `4b0cf05a…eca6c22aba` | unchanged |
| `modes/dr-loubna-kfafi.json` | `f2fa926e…` | unchanged |
| `modes/k2-syndicalia.json` | `572e99bf…` | unchanged |
| `.local/` directories | 16 | 16 |
| `assets/client-pictures/` | 22 files, 36M | 22 files, 36M |
| CEP extensions | `com.framopia.studio` | `com.framopia.studio` |
| After Effects | 1 (pid 89430) | 1, never launched or quit |
| `aerender` | 0 | 0 |
| listening service | pid 20534 | pid 20534, never stopped |
| `origin/main..main` | 0 | 0 after push |

No orphan at the start. His photographs and his client-file edit are as found; no
commit named his paths.

## 11. Every ledger line added

**None.** 294 records, sha256
`77eaf6c9ca6b633ed2ecb12b887474f3c0f4563b284e8866eba9a0286c1a84d0` at both ends.

## What is open

- **`NODE_NOT_FOUND_HELP` is a ruling Mohamed has not made** (section 3).
- **Three states remain undesigned**: coming back mid-queue, the one-off client,
  the file-extension list.
- **The stagger** — three fetches, three re-renders — measured in session 95 and
  untouched since.
- **Whether a template-audit failure belongs on his screen at all** (section 9).
- **A sentence now names a step**, and nothing catches it going stale.
- Everything carried from session 100 that this session did not touch.
