Status: OK

Block 8, session 7. **$0.00 spent, no API called, After Effects not driven.**
The manifest fault is committed and can no longer recur; the spawn works and no
longer lies; both pickers and the logo are fixed by one root cause; the dry run
exists; and the aligner tie is broken with **zero regressions**.

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| `main` / `origin/main` at start | `6059e8d` / `6059e8d` |
| tree at start | only `panel/CSXS/manifest.xml` modified — the user's hand edit, as expected |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances at start / end | **1 / 1**, left open and untouched |
| `aerender` processes at start / end | **0 / 0** |

## Done

### Goal 1 — the manifest comment

**A double hyphen cannot appear inside an XML comment**, and session 6's
comment above `<CEFCommandLine>` named `--enable-nodejs` and `--mixed-context`.
libxml2 rejects the whole file; After Effects dropped the extension and it
vanished from the Extensions menu.

The user's edit removed **only** the comment — verified by diff — and all four
`<Parameter>` lines survived intact:

```
--enable-nodejs   --allow-file-access   --allow-file-access-from-files   --mixed-context
```

Committed as `fix: drop the manifest comment that broke the XML`.

**It cannot recur.** `npm run validate:panel` parses the manifest and is in
`npm run check`. Two stages, with different scopes rather than two copies of
one rule:

1. **The double-hyphen rule in JavaScript**, because that is the specific
   footgun and it must be caught on any machine.
2. **Full well-formedness through `xmllint`** — libxml2, the same parser family
   CEP uses, so what it rejects is what After Effects rejects. Confirmed
   against a fixture: it reports `Double hyphen within comment`, the same
   wording CEP's log carried. When xmllint is absent the check says so and runs
   the first stage only; it never passes quietly.

Ten tests, including the exact shape that broke it, a double hyphen mid-comment
rather than at its end, multiple offending comments in one file, and — the one
that keeps the check honest — that `--enable-nodejs` inside a `<Parameter>`
element is **not** flagged, since that is the very content the check exists to
protect.

The rule is in `docs/CLAUDE_CODE_GUIDELINES.md` §1 beside the comment guidance:
**a comment must not break the file it documents.**

### Goal 2 — the spawn, three faults deep

**A — it spawned `npm`.** `panel/src/host.ts` ran
`child.spawn('npm', ['run', 'start', '--prefix', 'service'])`. After Effects
launches from the Finder and inherits no shell profile, so `PATH` inside the
panel is roughly `/usr/bin:/bin` — `npm` is not there, and nvm's Node is not
either. Hence `spawn npm ENOENT`.

It spawns the Node binary directly now, with an absolute path and no shell.

**The path is resolved, never hardcoded.** `resolveNodePath` in
`core/src/node-path.ts`, in this order:

1. `nodePath` in `.local/config.json`, if present and on disk
2. `process.execPath` **when it really is node** — inside CEP it is After
   Effects, and spawning that would open a second copy of the application
3. the newest `~/.nvm/versions/node/*/bin/node`, compared **numerically**
   (string order puts `v9` above `v24`, so an upgrade would silently downgrade
   the interpreter)
4. `/opt/homebrew/bin/node`
5. `/usr/local/bin/node`

**On this machine, from a CEP-like environment, it resolves through source
`nvm` to `/Users/mohamedanouarzaki/.nvm/versions/node/v24.14.1/bin/node`** —
measured, by running the resolver with After Effects' own executable as
`execPath`. Run from a terminal under Node the same resolver returns the same
binary through source `process.execPath`, which is correct for that context.

**Nothing resolving is a panel state**, not a throw and not a silence: it names
what is missing and how to fix it, including the `.local/config.json` escape
hatch. `GET /health` now carries the resolved path and its source, so the user
can see which Node is running his pipeline.

**B — there was no service entry point.** The root script list contained
nothing that starts the service, and `npm run start --prefix service` needed
npm anyway. Added:

- `npm run service` — builds core and the service, then starts it. **Runnable
  from a terminal**, which is what diagnosing a panel that cannot reach the
  service needs. Verified live: `framopia-service listening on 127.0.0.1:65112`,
  and `/health` answered `ok: true`.
- `npm run service:build` — builds without starting.
- `service/src/service.ts` → `service/dist/service.js`, the stable path the
  panel spawns, so a refactor of `server.ts` does not move the panel's target.

**C — it claimed a success it never verified.** It reported *"no service was
running; one has been started. Retry in a moment."* the instant `spawn()`
returned — while ENOENT had not yet arrived, because it arrives on the `error`
event afterwards.

Now: `spawnService` resolves only once the process has **failed, exited, or
survived** long enough to be believed, and returns what happened. `connect`
then **polls `/health`** until it answers or a bounded 12 s timeout expires, and
reports a timeout as `service-start-timeout` naming the binary it used and the
last error seen. A spawn failure surfaces its real cause — exit code, stderr
tail, resolved path.

**Other places asserting an unverified outcome, found and fixed:**

| site | assertion | now |
|---|---|---|
| `service.ts` `connect` | "one has been started" after a spawn that had failed | polls `/health`; reports failure, timeout or healthy |
| `host.ts` `spawnService` | returned `void`, so no caller could know | returns a result; waits for error/exit/survival |
| `host.ts` `repoRoot` (session 4) | a comment asserting "CEP resolves the symlink, which is what makes this work" — never verified, and false | follows the symlink and says why |
| `App.tsx` service card | rendered `health.node.path` unconditionally, which would blank the panel against an older service | optional, renders "not reported" |
| `service.ts` `fetchReels`/`fetchModes` | returned `undefined` for a malformed payload, crashing the render one line later | rejects a payload without the array |

**Pinned by tests:** a spawn failure surfacing `spawn /n/node ENOENT` and *not*
"Retry in a moment"; an immediate exit reported with its code and stderr; a
health-poll timeout reported as a timeout, driven by an injected clock so it
costs no wall time; a successful start reported only once health answers; no
Node resolving at all; and eleven tests over the resolution order, including
numeric version comparison and the After-Effects-as-`execPath` case.

### Goal 3 — the pickers and the logo: one root cause

**`getSystemPath('extension')` returns the symlink CEP was given, not its
target.** `repoRoot` resolved `..` from it:

```
resolve('~/Library/…/CEP/extensions/com.framopia.studio', '..')
  = ~/Library/Application Support/Adobe/CEP/extensions
realpath first, then resolve
  = /Volumes/T7 Shield/INSEA/Projects/framopia-studio
```

There is no `benchmarks/footage.json`, no `modes/` and no `assets/brand/` in
the extensions folder, so **all three symptoms are one fault**: "No reels found
on this machine", "No modes in modes/", and a red square where the logo should
be. `realpathSync` first, and all three are answered.

**Both lists now come from the service**, per the goal, through the helpers
that already own the rules:

- reels through `service/src/frames/footage.ts`'s `loadReels` — **the existing
  helper**, so no second rule for where footage lives;
- modes through core's `parseMode`, the same parser `npm run validate:modes`
  uses, so a mode the validator rejects cannot silently appear in a picker.

**No second copy of either rule now exists**: the panel's own disk readers were
deleted, and it fetches `GET /reels` and `GET /modes`. Verified live — five
reels with their spend (`vitasilk` $1.550444, `test-2` $0.412818) and
`K2 Syndicalia v6`.

**A latent bug found on the way:** the panel tested `fonts.status === 'resolved'`
and the enum is `'tbd' | 'set'`. A properly-fonted mode would still have been
blocked at Block 9 with a message about missing fonts. Corrected to `'set'`.

**The logo** failed for the same path reason — not a CEP `file://` restriction
and not a placeholder. `--allow-file-access-from-files` was already declared.
With the repo root fixed it loads. **The headless check now asserts the real
image decodes**: `complete === true`, `naturalWidth === 962`,
`naturalHeight === 1077`, and a non-zero bounding box — not merely that an
element exists, which is what let a broken image pass for a session.

### Goal 4 — the dry run

`GET /dry-run?reel=&mode=` validates the selection and reports what a run
**would** do: the reel, the mode, which stages the plan records as done, and
what the rest would cost. **It runs nothing and bills nothing** — every figure
comes off the plan and the pricing constants.

**The stage keys are the plan's own**, read from a real plan rather than
guessed: `transcription`, `analysis`, `images`, `zones`. My first attempt used
`keywords`/`imageSlots`, which the plan does not record, and reported cached
stages as pending — a plausible answer that was wrong.

Live on both reels with a plan, every stage is `done`, so the dry run reads
**nothing to pay** and says a run would read from disk. The panel renders it
above the Run control, with the $2.00 soft alarm applied to the estimate.

Verified by driving the built panel in the headless check with a stubbed host.
**After Effects was not touched.**

### Goal 5 — experiment 2: transliteration-aware substitution

**The mapping.** ORTHOGRAPHY_GUIDE §2's table, verbatim: `ع`→`3`, `ح`→`7`,
`ق`→`9`, `خ`→`kh`, `ش`→`ch`, `غ`→`gh`, `ط ص ض ظ`→`t s d d`, `ء`→omitted or `'`,
`ه`→`h`, `و`→`w`/`ou`, `ي`→`y`/`i`. §2 documents only the *conventions* — it
says nothing about `ب` or `م` because nobody needs telling — so the plain
correspondences (`ا`→`a`, `ب`→`b`, `ت`→`t`, `ج`→`j`, `ة`→`a`/`t`/∅, and the
rest) are written out separately and **marked as the extension they are**. If
§2 and that table ever disagree, §2 wins.

**Characters the table does not cover are kept as themselves**, so a digit or a
stray Latin letter inside an Arabic token can still match its counterpart
rather than being silently deleted. Harakat and tatweel are dropped — they
carry no Arabizi letter.

**Letters with two accepted forms are tried both ways** and the best taken:
`غير` is `ghyr` by the first form and `ghir` by the alternative for `ي`, and
choosing one would penalise the other. One alternative at a time, not the full
product, which is exponential and buys nothing.

**The cost is normalised by length**, dividing the character edit distance by
the longer side. Without it a ten-letter pair differing in two characters would
score worse than a two-letter pair differing in one, and the aligner would
systematically prefer pairing short words. A perfect transliteration floors at
**0.2** rather than 0, because a real match is evidence and a transliteration is
a guess that happens to be good.

Measured: `من`/`mn` **0.000**, `شنو`/`chno` **0.000**, `دقيقة`/`d9i9a` **0.000**,
`غير`/`ghir` **0.000**, `من`/`ghir` **1.000**. That is the signal the flat model
had none of.

**Against the committed reference on `vitasilk`:**

| bucket | count |
|---|---:|
| wrong, now pairs differently (**candidate repairs**) | **16 of 18** |
| **correct or misheard, now pairs differently (regressions)** | **0** |
| two tokens, still inexpressible | 1 |
| wrong, unmoved | 2 |
| correct, held | 54 |

**The regression count is zero.** Every one of the 54 pairings the user
confirmed is untouched.

**16 is a candidate figure, not an improvement** — a pairing that changed from
wrong to differently-wrong scores as a repair here, and only the user can tell
the difference. Reading the moved rows, both kinds are present:

- plainly right: `mn`→`من`, `ghir`→`غير`, `anno`→`أنه`, `chno`→`شنو`,
  `katsnay`→`كتسني`, `bach`→`باش`, `thllay`→`تهلي`, `5`→`خمس`, `d9ay9`→`دقائق.`
- the residual error moved rather than removed: `il`→`ينغى,`,
  `nourrit`→`يهدئ.`, `hydrate`→`ستة`. Those are French words against two Arabic
  verbs — a **many-to-one** shape no substitution cost can express, and exactly
  the case session 6 sized and deferred.

The two rows that did not move are `a`→`أي` and `lalla`→`هذا`.

The re-review sheet for the moved rows is at
`benchmarks/results/latest-align-review/vitasilk.rereview.html`.

**Movement on the other four reels**, no reference so no claim about
correctness: ground-truth **15**, test-1 **16**, test-2 **14**, test-3 **4**,
`vitasilk` 17 — **66 corpus-wide**. **Insert counts are unchanged on every
reel**, which is what a change that touches only substitution should do.

**The default model is unchanged**, verified: pairings for all five reels are
byte-identical under `DEFAULT_ALIGN_COSTS`, and every production path takes it.
`--cost-model transliteration` selects the variant. **It is not adopted.**

One implementation note worth recording: fractional costs mean the backtrace
can no longer compare accumulated distances with `===`, so it compares within
1e-9. The default model's integers are unaffected, which the byte-identical
check confirms.

### Goal 6 — CLAUDE.md and the gate

CLAUDE.md carries the Node resolution order and that the panel spawns Node
directly, `npm run service` and `npm run validate:panel`, the XML comment rule,
where reels and modes come from, and a session section.

`npm run check` — **exit 0, `check: PASS`**.

| workspace | tests | against session 6 |
|---|---:|---|
| `@framopia/core` | 272 (14 files) | 235 |
| `framopia-service` | 753 (54 files) | 753 |
| `framopia-benchmarks` | 166 (16 files) | 166 |
| `framopia-panel` | 39 + 1 skipped (2 files) | 33 + 1 |
| **TS total** | **1230** | **1187** |
| pytest (sidecar) | **141** | 141 unchanged |

## Deviations

- **`xmllint` is a system dependency, not an npm one.** It is libxml2, so it
  rejects what After Effects rejects, which a lenient JS parser would not; it
  ships with macOS, the only platform CEP runs on. It degrades to the
  double-hyphen rule with a printed notice if absent.
- **The health payload gained `repoRoot` and `node`.** Neither was asked for.
  `repoRoot` lets the panel stop deriving the same fact twice, and `node`
  answers "which interpreter is running my pipeline", which the goal asks be
  visible.
- **The panel's own reel and mode readers were deleted rather than fixed.** The
  goal requires both lists to come from the service, and leaving the disk
  readers would have left a second copy of each rule in the bundle.
- **The dry run's stage estimates are order-of-magnitude figures** from the
  recorded actuals in CLAUDE.md, not a model of the pricing table. They are
  labelled "about $x" and the exact cost is whatever `usageMetadata` says after
  the fact.

## Failures & open problems

- **Nothing was lost or corrupted.** No plan, cache entry, ledger line or
  template was written. The ledger is byte-identical at both ends.
- **A service is running.** `node service/dist/service.js` was started to
  exercise the endpoints and left running, holding `.local/service.json`. That
  is deliberate — the panel will find it — but it is a process this session
  started and did not stop.
- **The panel has not been reopened inside After Effects since these fixes.**
  Everything is proved in a real browser engine with a stubbed `cep_node`; the
  real bridge, the real `CSInterface`, the real spawn and the real symlink
  resolution are still unexercised in AE.
- **`createHost`, `loadReels`… the CEP-only code paths remain stub-tested.**
  In particular `realpathSync` is asserted against a stub that returns its
  argument; the fix is verified by computing the path in Node, not by CEP
  doing it.
- **Experiment 2 is not adopted and must not be**, until the user has been over
  the 16 moved rows. The re-review sheet exists for exactly that.
- **The many-to-one gap is now the visible blocker.** With the tie broken, the
  rows that remain wrong are French pronouns against Arabic verbs — a shape no
  substitution cost can express.
- **`vitasilk.json` predates `misheard` and `alignerHash`**, so its drift check
  is still the weaker `headSha` notice.
- **`--cost-model expensive-insert` is kept as a measured negative result** and
  is used by nothing.
- Carried forward: headless AE is not met, `vitasilk` is the only reel ever
  built, 28 cards have a clipped hold, all 13 multi-word Arabic §6 terms split
  across cards, the CJK `五` is classified Latin, and `runSidecar` still lives
  in `service/`.

## Repo state

- Branch **`main`**, worked on `main`. No force-push, no history rewritten.
- HEAD at the time of writing: **`207b082` `feat: add a transliteration-aware
  cost model`**, preceded by `fix: follow the extension symlink, and verify the
  service started`, `feat: serve the reel and mode catalogues and a dry run`,
  `feat: spawn a resolved node, not npm`, `feat: parse the CEP manifest in the
  regression gate` and `fix: drop the manifest comment that broke the XML`, on
  session 6's `6059e8d`. **This report's own commit (`docs: record block 8
  session 7`) follows it** and is not reflected in that subject line.
- `git log` checked for AI attribution and co-author trailers: none.
- `npm run check`: **exit 0, `check: PASS`** — 1230 TS tests across four
  workspaces, 141 pytest.
- Ledger `.local/costs.jsonl`: **108 lines**, sha256 `50ec3f57…` at start and
  end. All-time spend unchanged at **$10.968590**.
- After Effects: **1 instance** at start and end, **0** `aerender`. Left open,
  never driven.

## Suggested next step

Reopen the panel and confirm it reaches healthy with both pickers filled — that
is the one claim in this report resting on a stub rather than on After Effects,
and everything after it depends on the bridge really working. Then put the 16
moved rows in front of the user on the re-review sheet, because experiment 2 is
the first change to move anything and its repair count is a candidate figure
until he says otherwise. If it holds up, the remaining wrong rows are all the
same shape — French pronouns against Arabic verbs — and that is the many-to-one
operation session 6 sized at one occurrence and deferred; the transliteration
result is what makes it worth revisiting, because it is now the only thing left.

## What the user does next

**Rebuild the panel and reopen it. After Effects does not need restarting this
time** — nothing in the manifest changed, only the code inside the panel.

```
cd "/Volumes/T7 Shield/INSEA/Projects/framopia-studio" && npm run panel:build && npm run service:build
```

Then in After Effects: close the Framopia Studio panel and open it again from
*Window → Extensions → Framopia Studio*.

What should be different, all four things you saw:

- **The service starts.** It was trying to run a command that does not exist
  inside After Effects — the panel starts from the Finder and cannot see the
  tools your terminal can. It now finds your Node directly and shows you which
  one it used.
- **It stops claiming things it has not checked.** Before, it said a service had
  been started when starting it had already failed. Now it waits, checks, and
  if it fails it tells you exactly what went wrong.
- **The reel and mode lists fill in.** They were being looked for in the wrong
  folder — the panel was working out where the project lives by following the
  shortcut in the extensions folder, but not following it all the way. Same
  reason the logo was a red square; your logo appears now.
- **A new panel above the Run button** shows what a run would do before you
  spend anything: which stages are already saved and roughly what the rest would
  cost. For your reels everything is already cached, so it says there is nothing
  to pay.

If the service does not start, run `npm run service` in a terminal and leave it
open — that starts the same thing by hand and prints any error in full.

One thing to note: a service is running on your machine right now, started
during this session so the panel has something to talk to. It stops when you
restart the Mac, or you can leave it.
