Status: OK

# Block 11 session 66 — the one unrehearsed step, made unable to hurt the wrong machine

**Expected spend $0.00. No paid call of any kind, no picture generated, no video
transcribed. The ledger is unmoved at 165 lines and the same sha256 at both
ends. Golden did not move: 17,174 fields, 4 of 4. `npm run check` passed whole.**

**One thing needs Mohamed's decision and is not decided here.** Telling him a
stale panel bundle needs rebuilding cannot be said in the panel without naming a
command or sending him out of it, and `leave-the-panel.test.ts` forbids both.
The panel now says what is true and stops. §3 states the conflict.

---

## 1. The extensions folder, at both ends

**As found at the start**, before anything was touched:

```
total 0
drwxr-xr-x@ 3 mohamedanouarzaki  staff  96 Aug 27 19:06 .
drwxr-xr-x@ 3 mohamedanouarzaki  staff  96 Aug 27 19:06 ..
lrwxr-xr-x@ 1 mohamedanouarzaki  staff  55 Aug 27 19:06 com.framopia.studio -> /Volumes/T7 Shield/INSEA/Projects/framopia-studio/panel
```

One entry, a symlink, pointing at this checkout's `panel/`.

**As found at the end**, after every test and every mutation:

```
total 0
drwxr-xr-x@ 3 mohamedanouarzaki  staff  96 Aug 27 19:06 .
drwxr-xr-x@ 3 mohamedanouarzaki  staff  96 Aug 27 19:06 ..
lrwxr-xr-x@ 1 mohamedanouarzaki  staff  55 Aug 27 19:06 com.framopia.studio -> /Volumes/T7 Shield/INSEA/Projects/framopia-studio/panel
```

`diff` of the two `ls -la` captures is empty, and so is the diff of the
name/kind/target listing. **The timestamps are unchanged**, which is the part
that shows nothing was rewritten and rewritten back.

It was re-measured three times: after the six tests, after the mutation that
briefly pointed the code at the real path, and at the end.

## 2. `panel:install` cannot take the panel from another checkout

**The defect.** The installer held this:

```js
} else if (stat.isSymbolicLink()) {
  rmSync(LINK);
  symlinkSync(PANEL, LINK);
  did.push(`${LINK} -> repointed to ${PANEL}`);
}
```

A link pointing anywhere else was removed and replaced without a word. There is
one extensions folder per Mac, so a second checkout — a partner with two clones,
or a rehearsal copy here — silently took the panel away from whatever was using
it. **That is why sessions 55, 56 and 65 all declined to run this step**, and how
the step most likely to go wrong stayed the one nobody had watched.

**What it does now**, before changing anything, every time:

```
install: the extensions folder is <folder>
install: it points at    <what is there now>
install: it would point at <this checkout's panel>
```

and, when those disagree:

```
install: REFUSED — this folder already points somewhere else.
install:   it points at    <the other checkout>
install:   you are asking for <this checkout>

install: After Effects can only load the panel from one of them, and
install: repointing takes the panel away from the other copy. If that is
install: what you want, run the same command again with --repoint on the
install: end. If it is not, nothing here has been changed.
```

Exit 1, and the link is left exactly as it was.

**The mechanism is a flag, not a prompt, and the reason is written in the code.**
This is run by copy-paste from `docs/SECOND_MACHINE.md`, sometimes with nothing
attached to answer a prompt, and **a prompt cannot be rehearsed or tested** —
which is precisely how this step reached session 66 unexercised. A flag is
written down, is the same every time, and appears in whatever the person pastes
back.

### The stand-in really is what the code reads

`FRAMOPIA_CEP_EXTENSIONS_DIR` points the installer at a temporary folder — the
same override pattern `tools/doctor/checks.ts` uses, for the same stated reason.
Setting it also leaves `PlayerDebugMode` alone, since a per-machine preference
only means anything for the real folder.

**Proved rather than asserted.** Making the override inert — so the script reads
the real path again — turns **5 of the 6 tests red**:

```
 FAIL  src/install.test.ts > installing the panel > really does read the folder it is given, and leaves the real one alone
Error: ENOENT: no such file or directory, lstat '/var/folders/…/framopia-cep-NaMWY8/com.framopia.studio'
 ❯ src/install.test.ts:79:12
     79|     expect(lstatSync(linkIn(into)).isSymbolicLink()).toBe(true);
```

If the fixture were being ignored, the link would have been made somewhere else
and these would have passed on an empty assertion. That is the vacuous shape
session 57 spent a session removing, and this is the measurement that rules it
out. The first test also records what the **real** folder held before and after
and requires them equal, so a run that escaped to the real path would fail here
rather than pass quietly.

**And the refusal itself:**

```
 FAIL  src/install.test.ts > installing the panel > refuses to take the panel from another checkout, and changes nothing
AssertionError: expected +0 to be 1 // Object.is equality
- 1
+ 0
 ❯ src/install.test.ts:104:20
```

Both restored byte-identical from saved copies, green re-verified before the next
mutation.

**A hazard I should name.** The second mutation pointed the code at the real
extensions folder. It happened to be safe — this checkout is the installed one,
so the script took its *already points at* branch and changed nothing, and the
`defaults` loop was still gated on the override being set. I verified the folder
byte-for-byte immediately afterwards. It was still a mutation that could have
written to Mohamed's machine, and the brief's instruction to read such a mutation
twice is the right one.

## 3. The stale-bundle message, and the conflict it runs into

**It is worse than a missing message.** Measured with the real functions:

```
panel bundle : abc123+oldsourcehash
service dist : def456+newsourcehash (compiled from current source)
service proc : def456+newsourcehash (running that compiled code)

what the panel shows  : "The background service was built from different code than this panel, so the two may not agree about what a video contains. Restarting it now."
what the repair does  : rebuild

after that repair, the service still reports def456+newsourcehash and the panel is still abc123+oldsourcehash
so the verdict is still: different
```

So after a `git pull` the panel **blames the service**, runs a repair that cannot
change the stamp baked into its own bundle, finds the mismatch still there, and
runs it again to the bound. That is what cost session 65 a run.

**The same mechanism, extended — no new field.** `whichIsBehind` uses the third
stamp the panel already reads for the repair, the compiled service on disk. If
the running service matches what is compiled, the service is running the newest
code there is and the panel is the odd one out:

| panel | service | dist | verdict |
|---|---|---|---|
| old | new | new | **panel** |
| new | old | new | service |
| old | new | *unknown* | service (the long-standing answer, not a guess) |
| same | same | same | unknown |

The panel now skips the repair when it is the stale half, and says:

> **This panel is showing older code than the rest of the tool, so what you see
> here may not match what it does. Nothing you have made is affected.**

Proved against a genuinely stale stamp — the current one computed by the real
`scripts/build-stamp.mjs`, not a hand-set flag. Making the rule ignore the third
stamp turns it red:

```
 FAIL  src/stale-bundle.test.ts > a panel bundle left behind by a pull > is named as the stale half, not the service
AssertionError: expected 'service' to be 'panel' // Object.is equality
```

### The conflict, which is Mohamed's to settle

**The message says what is true and stops, because the remedy cannot be said.**
Rebuilding the bundle and loading it needs one of:

- *"run `npm run panel:build`"* — `/\bnpm run\b/i`, forbidden
- *"reopen the panel"* — `/reopen\s+(?:the\s+panel|it)/i`, forbidden
- *"close the panel and open it again"* — forbidden
- *"restart the panel"* — forbidden

And the panel cannot repair itself here: **the stale artefact is the running
code**. This is the same shape as the one exemption the rule already grants —
`host.ts`, where a missing `cep_node` means "there is no service to repair and no
bundle to rebuild".

Two rules of Mohamed's meet: *no message sends the user out of the panel*, and
*a message tells the truth about what to do*. I have not chosen between them.
`leave-the-panel.test.ts` passes unchanged, 2 of 2.

**One route might dissolve it**, and it is unverified: the service could rebuild
the bundle and the panel could reload itself, so no one is sent anywhere. I did
not build it — it is a feature, not a message, and whether a CEP panel survives
reloading itself cannot be measured without driving After Effects.

## 4. Both carried items

### a. The example's keys are refused at load

**Before**, on a fresh clone: `loadConfig ACCEPTED the placeholder config —
elevenLabsApiKey=set, googleApiKey=set`. Non-empty strings, so every check
passed; the service started normally and the first paid call failed with whatever
the provider says to a bad key.

**Now:**

> The settings file at `<path>` still holds the example's own values for
> elevenLabsApiKey and googleApiKey. Those are examples of what a key looks like,
> not keys — nothing will work until they are replaced with your own. Open that
> file and put your keys in.

**Read out of `config.example.json` itself**, the way session 56 made the doctor
read them, rather than listed in `config.ts` where a second copy would drift. A
missing example makes the check silently pass, which is the right way round.

Compared as strings and never used. A test asserts `config.ts` contains no
`fetch(`, no `https://`, no `node:https`, no `axios`: **checking a key by
spending money to see whether it works is not a check this project makes.**

Removing the refusal:

```
 FAIL  src/config.test.ts > a settings file that still holds the example > is refused, naming the file and both fields
AssertionError: expected function to throw an error, but it didn't
 ❯ src/config.test.ts:101:36
```

### b. The doctor no longer writes into tracked files

It wrote `reports/doctor-<host>.json`, which git carries, so every run overwrote
the committed record of whichever machine ran last. It now writes
**`.local/doctor/doctor-<host>.json`** — gitignored, and already where everything
machine-local lives. Measured: `wrote .local/doctor/doctor-anouar-mbp.json`, and
`git status reports/` is clean after a run.

**The records committed before this change are untouched.**
`reports/doctor-anouar-mbp.json` is still there, and a test asserts it, because
deleting it would be deleting the evidence this rule exists to protect.

Pointing it back at `reports/`:

```
 FAIL  src/doctor.test.ts > where the doctor writes > is somewhere git does not carry
AssertionError: expected '…' not to match /outPath[\s\S]{0,200}'reports'/
```

## 5. The recovery section, and what could not be rehearsed

One section in `docs/SECOND_MACHINE.md`, two failures, each with a first thing to
check and a second thing to run:

- **The panel does not appear.** Run `panel:install` again — it is safe to repeat
  and says what it finds before changing anything. If it says `REFUSED`, another
  copy is installed and it names both; `--repoint` if this is the one wanted.
  Then quit After Effects and open it again, because it reads the folder only at
  launch. Still missing → `npm run doctor`, and what it says about *the panel*
  and *PlayerDebugMode*.
- **The panel says it is showing older code.** Normal right after `git pull`;
  `npm run panel:build`, then close and reopen the panel. If the line mentions
  the *service* instead, the panel is already fixing that itself.

**Run, and written from what happened:** first install into a stand-in; a second
run reporting *already points at*; the refusal against a link pointing elsewhere;
`--repoint`; `npm run panel:build` on a fresh clone; the *older code* rule against
a genuine stamp.

**Not run, and the document says so.** No install step has ever touched **a real
extensions folder, on any machine** — there is one per Mac and running it here
would have taken the panel from the copy Mohamed uses. So the first time it meets
a real one will be on the partner's Mac, which is what the new refusal is for.
Nobody has watched the panel appear in After Effects from a fresh install, or
watched the *older code* line on screen; only the rule behind it is tested.

## 6. Gates, arithmetic and fingerprints

**`npm run check`: PASS**, exit 0, run with nothing else touching the tree. **No
workspace was built while a gate was in flight.** **`npm run golden`: PASS** —
4415 + 4280 + 3709 + 4770 = **17,174**, field for field, reference unchanged.

```
check: counted with 5/5 corpus Edit Plans and 5/5 reels (11.93 GB) on this disk — the suite sizes depend on both, so this signature belongs to this machine, not to the commit
```

| suite | session 65 | measured now | difference |
|---|---|---|---|
| core | 790 | **796** | **+6** |
| service | 1397 (+1 skipped) | **1397** (+1 skipped) | — |
| benchmarks | 173 | **173** | — |
| panel | 242 (+2 skipped) | **253** (+2 skipped) | **+11** |

**+6 in core**, four in `config.test.ts` and two in `doctor.test.ts`:

1. `a settings file that still holds the example > is refused, naming the file and both fields`
2. `… > is refused when only one of them was replaced`
3. `… > accepts a key that looks nothing like either example`
4. `… > decides without using the key for anything`
5. `where the doctor writes > is somewhere git does not carry`
6. `where the doctor writes > leaves the records already committed alone`

**+11 in panel**, six in `install.test.ts` and five in `stale-bundle.test.ts`:

7. `installing the panel > really does read the folder it is given, and leaves the real one alone`
8. `… > says what the folder points at now and what it would point at`
9. `… > refuses to take the panel from another checkout, and changes nothing`
10. `… > repoints only when the person says so`
11. `… > is happy to run twice against the same checkout`
12. `… > will not delete a real directory it did not create`
13. `a panel bundle left behind by a pull > is named as the stale half, not the service`
14. `… > is not what the old rule concluded`
15. `… > still blames the service when the service really is behind`
16. `… > concludes nothing when the compiled service cannot be read`
17. `… > says so in plain words, naming nothing to quit, reopen or type`

Nothing removed or renamed. 790 + 6 = 796 and 244 + 11 = 255, exactly.

**Five panel runs, each with its exit status:**

| run | result | exit |
|---|---|---|
| 1 | 253 passed, 2 skipped (255) | 0 |
| 2 | 253 passed, 2 skipped (255) | 0 |
| 3 | 253 passed, 2 skipped (255) | 0 |
| 4 | 253 passed, 2 skipped (255) | 0 |
| 5 | 253 passed, 2 skipped (255) | 0 |

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
| extensions folder | one symlink, Aug 27 19:06 | **byte-identical** |

**Every directory in `.local/`, by name and file count.** At the start: `audio`
27 · `bench-audio` 5 · `build` 70 · `cache` 159 · `cv` 1759 · `deleted-clients` 0
· `evidence` 3 · `ground-truth` 10 · `plans` 49 · `quarantine-session51` 363 ·
`quarantine-session53` 139 · `quarantine-session54` 1 · `transcripts` 1.

**At the end, one addition: `doctor` 1** — `.local/doctor/doctor-anouar-mbp.json`,
which is where §4b moved the doctor's output. Everything else unchanged.

After Effects was driven only by `npm run golden`, through `DoScript` into the
already-running instance. It was never launched and never quit. No `.aep` was
written and Mohamed's own project was never saved.

`handoffs/block-10-opening-prompt.md` → `handoffs/block-10.md` is Mohamed's own
uncommitted rename, left exactly as it was.

## 7. Money

**No ledger lines added.** 165 lines at both ends, byte-identical by sha256.
Nothing here could bill: a symlink guard, a stamp comparison, a string
comparison, and a file written to a different folder.
