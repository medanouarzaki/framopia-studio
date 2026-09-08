Status: OK

# Block 12 session 74 — a client cannot be saved without their own colours

**Expected spend $0.00. No paid call of any kind, no picture generated, no video
transcribed. The ledger is unmoved at 165 lines and the same sha256 at every
check — start, after both `npm run check` runs, after `npm run golden`, and at
the end.** Golden did not move: 17,174 fields, 4 of 4. `npm run check` passed
whole on the second run; **the first failed with 50 tests red and that is §7.**

---

## 1. The 37 skip conditions, and the five artefacts

**They are not 37 independent risks, and my session-73 report should have said
so.** Listed by file, line and condition, they collapse into ten distinct
conditions:

| condition | count | kind |
|---|---:|---|
| `!built` — `panel/dist` | 25 | silent-pass, **closed** by session 73's artefact check |
| `!ENTRY_BUILT` — `service/dist/service.js` | 2 | silent-pass, **closed** |
| `!existsSync(BUILD_CLI)` — `service/dist/build/build-reel-cli.js` | 1 | silent-pass, **closed** |
| `built` — the two inverse guards | 2 | correct: they exist to make an *absent* bundle loud |
| `!!launchFailure` — chromium | 2 | cannot run here |
| `!existsSync(SIDECAR_PYTHON)` — the CV venv | 1 | cannot run here, **and the gate announces it** |
| `!ready` — ffmpeg **and** the vitasilk reel **and** the venv | 1 | cannot run here, **not announced** |
| `FFMPEG === null` | 1 | cannot run here, **not announced** |
| `cloudOnly() === null` | 1 | cannot run here |
| unconditional `it.skip` — `no-colours` | 1 | **retired this session** |

**28 of the 37 are already closed**: they guard the three build artefacts, and
session 73's check now fails the gate before any of them is reached. Of the
remaining nine, **six could silently skip on a machine that is not this one** —
the two chromium ones, the sidecar, `!ready`, `FFMPEG` and `cloudOnly`. Only the
sidecar is announced today. **`!ready` and `FFMPEG` are the honest residue** and
are named here rather than left in a total.

**The five artefacts**, which session 72 counted as three because it was counting
directories:

| artefact | what executes it |
|---|---|
| `core/dist/index.js` | every workspace, through `@framopia/core` |
| `service/dist/service.js` | `spawn.integration.test.ts`, with a bare node binary |
| `service/dist/build/build-reel-cli.js` | `job.integration.test.ts` |
| `panel/dist/panel.js` | every browser test |
| `panel/dist/index.html` | the page those tests open |

## 2. Every route to saving a client

**There is now exactly one, and that is the change.** `createClient` was a
*second* writer: it called `writeFileSync` itself and repeated the validation.

| route | how it is covered |
|---|---|
| creating a client (`POST /clients`) | `buildClient` refuses before the client is constructed, then `writeMode` |
| a one-off video (same route) | the same two — see below |
| correcting details (`POST /clients/details`) | `writeMode` |
| setting the palette (`POST /clients/palette`) | `writeMode` |
| adding or removing a photograph | `writeMode` |
| labelling a picture | `writeMode` |
| importing anything that lands as a client file | `writeMode` — there is no other writer |

`service/src/clients/one-writer.test.ts` holds the file to it: `writeFileSync(modePath`
appears **exactly once**, the colours check precedes it in the same function, and
`palette: base.palette` is gone.

**A consequence the brief did not name, followed rather than worked around.** A
**one-off** — *"Just this video"* — goes through the same `createClient` and
writes a client file, so until now it inherited the template client's palette. A
video done once came out in K2 Syndicalia's colours. That is the mistake the
ruling forbids, not a lesser version of it, so a one-off is asked for its colours
too.

**Refused in two places, deliberately.** `buildClient` refuses at the earliest
point, so a colourless client is never even constructed; `writeMode` refuses
again, so an *edit* that blanks a colour is refused as well.

**Not in `validateMode`.** `parseMode` runs it on the way *in*, so requiring a
palette there would refuse to open a client or a plan snapshot written before
this rule — which the schema-fragility rule forbids. Nothing on disk became
unreadable.

## 3. The refusal, quoted

> No Colours Test has no colours of their own yet. A client needs all four before
> they can be saved, and background, primary, accent, light are still missing.
> Nothing is borrowed from another client: their colours are theirs.

It names what is missing, by role. It names no command and tells nobody to leave
the panel; **`leave-the-panel.test.ts` passes unchanged.**

## 4. How Mohamed sees the colours being asked for

**Before Save, not after it fails.** On the setup screen, under *Their colours*,
the four fields sit as they did — and the sentence beneath them now reads:

> All four are needed before this can be saved — the background behind a cut-out
> picture, your ordinary subtitle words still to set. **No colour is ever
> borrowed from another client.**

in the warning colour rather than the faint one, naming the roles in the same
words the fields use. **Save is disabled** while any is missing, and under it:

> Their four colours are needed first — the background behind a cut-out picture,
> your ordinary subtitle words still to set.

Once all four are set the sentence returns to what it always said: *"These four
style every word, the shadow behind it, the frame round a picture, and the
pictures themselves."*

The opening promise was true and is not any more, so it changed too: *"Everything
except the name **and their four colours** can be left blank"*, and for a
one-off, *"It is not added to your client list, **but it still needs its own four
colours**."*

## 5. Nothing can inherit another client's colour

**Proved separately from the refusal**, so removing either guard leaves the
defect visible.

`no-colours.test.ts > never lends K2 Syndicalia's colours to anyone, whatever the
route` builds a client through `buildClient` with colours of its own and asserts
that **none of K2's four hexes appears in the result**, and that the value K2's
background actually holds is not among them. It does not go through the route the
refusal guards, so it still fails if the refusal is removed but the inheritance
comes back by another path.

The source of the old inheritance is gone: `palette: base.palette` no longer
exists, and `one-writer.test.ts` asserts it cannot return.

## 6. `no-colours.test.ts`, unskipped

It was kept **skipped and failing** since session 55 as the record of an open
question. The question is answered, so it runs — **2 tests, 0 skipped.**

Proved by mutation, restoring the inheritance:

```
 FAIL  src/clients/no-colours.test.ts > a client saved with no colours of their own > is refused, and nothing of K2 Syndicalia reaches it
AssertionError: a client with no colours was saved: expected true to be false // Object.is equality
- false
+ true
 ❯ src/clients/no-colours.test.ts:68:58
```

Restored byte-identical, green re-verified. It asserts three things: the route
refuses, the message names what is missing and says nothing is borrowed, and
**no file is written** — a refusal that still leaves a file behind is not the
same claim.

## 7. The first gate failed, with 50 tests red

**Reported as the session's main event.** `npm run check` after the first commit:

```
      Tests  43 failed | 1383 passed (1426)     ← service
      Tests  7 failed | 263 passed | 2 skipped (272)  ← panel
NPM EXIT=1
```

**The cause is the rule working, and it measures how wide the defect was.**
**25 call sites across ten suites created scratch clients with no palette** and
were silently relying on the K2 inheritance — about a third of the client test
surface depended on borrowing another client's brand.

Handled as two different things, because they are:

- **21 sites were relying on it, not asserting it.** Each is given a palette
  deliberately unlike K2's.
- **Four were asserting the retired behaviour and are rewritten, not deleted**,
  per the standing rule:
  - `client-colours` — *"sends no palette at all when the codes were left alone"*
    → now *"will not let a client be saved with no colours at all"*, asserting
    Save is disabled and the sentence names what is missing.
  - `client-colours` — *"sends no palette when only some of the four were
    entered"* → the same shape for a partial palette.
  - a third was **added**: *"sends all four once they are set"*, so the positive
    case is not left unproved by the rewrite.
  - `render` asserted the on-screen sentence *"Left alone, this client is built
    in the standard one."*, which stopped being true.

The browser tests that save a client set the colours first, keyed on the boxes'
**own labels** rather than role names, so renaming a role cannot silently stop
one being filled.

## 8. Gates, arithmetic and fingerprints

**`npm run check`: PASS**, exit 0, run after committing. **`npm run golden`:
PASS** — 4415 + 4280 + 3709 + 4770 = **17,174**, field for field. **A client's
colours reach the built comp, and nothing moved**: both real clients already had
their four, so the corpus builds are identical.

```
check: 5 compiled artefacts present before the tests run
check: counted with 5/5 corpus Edit Plans and 5/5 reels (11.93 GB) on this disk …
check: 36 skip conditions across 12 test files …
```

| suite | passed | skipped | total | session 73 |
|---|---|---|---|---|
| core | **813** | 0 | **813** | 813 — unchanged |
| service | **1426** | **0** | **1426** | 1421 passed, **1 skipped** |
| benchmarks | **173** | 0 | **173** | 173 — unchanged |
| panel | **271** | 2 | **273** | 270 passed, 272 total |

**The service skip went 1 → 0, by name:** `no-colours.test.ts > does not come out
in K2 Syndicalia's four` was the one unconditional `it.skip` in the repository.
It is retired and replaced by two running tests. **That is the work showing.**

**+5 in service:**

1. `a client saved with no colours of their own > is refused, and nothing of K2 Syndicalia reaches it`
2. `… > never lends K2 Syndicalia's colours to anyone, whatever the route`
3. `writing a client file > happens in exactly one function`
4. `writing a client file > always passes through the colours check first`
5. `writing a client file > never copies the template client's palette`

1421 passed + 5 = 1426, and the 1 skipped became the 2 in items 1–2 — which is
why the total moved 1422 → 1426 rather than 1421 → 1426.

**+1 in panel:** `setting up a client > sends all four once they are set`. The
other two colour tests were rewritten in place, so they add nothing.

**The skip line moved 37 → 36 across 13 → 12 files**, because `no-colours.test.ts`
no longer contains a skip.

**Five panel runs, each with its exit status:** 271 passed, 2 skipped (273),
exit 0 — five times.

**Part 0, as found at both ends:**

| | at start | at end |
|---|---|---|
| After Effects instances | 1 | 1 |
| `aerender` processes | 0 | 0 |
| **ledger lines** | **165** | **165** |
| **ledger sha256** | **`786497a5f371d179…`** | **`786497a5f371d179…`** |
| `templates/library.aep` | `4b0cf05a8f5d4775…` | `4b0cf05a8f5d4775…` |
| **`modes/dr-loubna-kfafi.json`** | **`f60749f5629b2ced…`** | **`f60749f5629b2ced…`** |
| **`modes/k2-syndicalia.json`** | **`c600905c5e36ecbc…`** | **`c600905c5e36ecbc…`** |
| `modes/.gitkeep` | `e3b0c44298fc1c14…` | same |
| `assets/client-pictures/` | 0 files | 0 files |

**Both real clients are byte-identical, and both were measured to hold all four
colours before it was assumed** — `k2-syndicalia` and `dr-loubna-kfafi`, all four
present. Neither was touched.

The ledger was re-checked after both `npm run check` runs and after
`npm run golden`: 165 lines, `786497a5f371d179…`, unchanged at every one.

**The extensions folder, byte-identical**, timestamps included:
`com.framopia.studio -> /Volumes/T7 Shield/INSEA/Projects/framopia-studio/panel`,
Aug 27 19:06.

**`.local/` at the start:** `audio` 27 · `bench-audio` 5 · `build` 70 · `cache`
159 · `cv` 2234 · `deleted-clients` 0 · `doctor` 1 · `evidence` 3 ·
`ground-truth` 10 · `plans` 66 · `quarantine-session51` 363 ·
`quarantine-session53` 139 · `quarantine-session54` 1 · `quarantine-session69` 3
· `quarantine-session71` 0 · `transcripts` 1.

After Effects was driven only by `npm run golden`, through `DoScript` into the
already-running instance. It was never launched and never quit. No `.aep` was
written and Mohamed's own project was never saved.

## 9. Money

**No ledger lines added.** 165 lines and the same sha256 at the start, after both
gates, after golden, and at the end. Nothing here could bill: a refusal, a
screen that asks first, and test fixtures given colours of their own.
