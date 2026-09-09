Status: OK

# Block 12, session 80 — the notice, with real folders on real clients

## 1. The folders landed

**Verified before anything else, and this time the premise holds.** Sessions 77
and 78 were briefed on it and found it false; session 80 finds it true.

| file | sha256 | mtime | `videoFolder` |
|---|---|---|---|
| `modes/dr-loubna-kfafi.json` | `51659decc1fe75c328a6a40e0e6836071100f47c375c775e6360ca8d287ced18` | 2026-09-09 21:57:36 | `"/Volumes/T7 Shield/Framopia/Clients/Dr Loubna Kfafi"` |
| `modes/k2-syndicalia.json` | `572e99bf890ceefb3cd4e1cf870bd99ae7aabed94f876ff8a6872f09d452669f` | 2026-09-09 21:58:19 | `"/Volumes/T7 Shield/Framopia/Clients/K2 Syndicalia"` |

Both differ from session 79's figures, as expected. Dr Loubna's is the **client
root**, not either of the two sub-trees her footage sits in — which is what
session 79 said to pick, and it is why the rule below resolves both her videos.

Both files arrived uncommitted. They are tracked content, so they were committed
exactly as found, in their own commit, before any of this session's work; nothing
here wrote to either, and both are byte-identical at both ends.

## 2. Every plan through the rule

Both clients' declared folders as read from their files:

- Dr Loubna Kfafi — `/Volumes/T7 Shield/Framopia/Clients/Dr Loubna Kfafi`
- K2 Syndicalia — `/Volumes/T7 Shield/Framopia/Clients/K2 Syndicalia`

| plan | attached to | whose folder the video is in | verdict |
|---|---|---|---|
| a third video whose pictures run into each other-34b6d02a | K2 Syndicalia | cannot tell | silent |
| a video this tool has never seen-3678b7a4 | (client gone) | cannot tell | silent |
| a video whose client has no pictures at all-ef3d1ca9 | (client gone) | cannot tell | silent |
| a video whose client has pictures of his own-7a133407 | (client gone) | cannot tell | silent |
| another video with its pictures far apart-fd2b30ee | K2 Syndicalia | cannot tell | silent |
| **sora-6a60ced1** | **Dr Loubna Kfafi** | **Dr Loubna Kfafi** | **silent** |
| **sora-995f2d27** | **K2 Syndicalia** | **Dr Loubna Kfafi** | **WARNS** |

**1 warns, 6 silent, of 7.** The sentence, with names resolved from the client
files as `dry-run.ts` resolves them:

> This video is in Dr Loubna Kfafi's folder, but it is set up as K2 Syndicalia.
> It will be built in K2 Syndicalia's colours and type unless you change it.

**Yes — this run shows the rule discriminating**, and it is the first that could.
`sora-6a60ced1` and `sora-995f2d27` both have an owner *resolved* to Dr Loubna
Kfafi: one is attached to her and says nothing, the other is attached to K2 and
warns. That is a silent reel and a warning reel decided by the same rule from the
same resolved owner, which is exactly what session 77 said was missing when every
answer was *cannot tell*.

**Two corrections to the brief's expectations**, both measured:

- **There are 7 plans, not 12.** Session 77's "twelve" was its count of *videos*
  in `.local/videos.json`, not of plans; `.local/plans/` holds 7 `.json` files
  and one `cutouts/` directory.
- **The five silent ones are not the corpus reels.** Their videos are in the
  operating system's temporary directory
  (`/var/folders/…/framopia-new-video-Ne0MU8/`), left by the new-video tests —
  two attached to `k2-syndicalia` and three to test clients that no longer exist.
  None sits under any declared folder, so *cannot tell* is right for all five, and
  none warns.

**My first table was wrong and is not the one above.** It read `plan.videoPath`,
which no plan has — the path is `plan.source.videoPath` — so every row came back
*cannot tell* for my reason rather than the rule's. Caught by `sora-995f2d27`
failing to warn when it should have, and re-run against the right field.

Read only: nothing was changed and nothing re-attached.

## 3. The notice on screen, with the crutch gone

Session 77's harness lent Dr Loubna a folder in memory, because neither client
had declared one and the rule could therefore find no owner for any video.
**That loan is removed.** `realMismatch()` now reads both clients exactly as they
are on disk, and produces:

```
{ "attachedTo": { "id": "k2-syndicalia", "name": "K2 Syndicalia" },
  "looksLike":  { "id": "dr-loubna-kfafi", "name": "Dr Loubna Kfafi" },
  "says":  "This video is in Dr Loubna Kfafi's folder, but it is set up as K2 Syndicalia. …",
  "offer": "Use Dr Loubna Kfafi instead — their colours, their type, …" }
```

Every value there — both names, the folder, the ownership — comes from the two
real client files. Nothing was written to them; no copy was needed, because
nothing needed to be changed to make the rule fire.

All six browser assertions still pass with the loan gone, in a real Chromium
against the real bundle. They read extracted values, use `checkVisibility()`, and
hold no live Playwright handle. One of the six asserts the mismatch exists at all
rather than skipping on it, so if the rule stopped finding an owner the file would
go red instead of green-by-absence.

## 4. Warning when a folder is declared too deep

**Built, and it rests only on what the tool wrote down itself:** a reel's plan
records which client it was set up as and where its video is. Given a client and
the folder declared for them, it names the videos already set up as theirs that
the folder does not contain.

**What it refuses to do.** The brief's literal shape — a video under the declared
folder's *parent* — is too narrow for the real case: Dr Loubna's two sub-trees
diverge several levels up, so the parent of `Framopia Studio Inputs/Footages` does
not contain `September Content/…` either. Walking further up would be session 76's
refused path-name rule in a different costume — it would sweep in whatever else
happened to sit nearby, and could not be justified on a machine that has never
seen this project. Nothing is read out of the shape or wording of a path. **A
machine that has made no reels has no evidence and says nothing**, which is the
right answer rather than a gap.

Proved both ways against her real declaration, using the plans on this machine:

| folder declared | left outside | said |
|---|---|---|
| her folder (what he chose) | 0 | nothing |
| `…/Framopia Studio Inputs/Footages` | 0 | nothing |
| `…/September Content/Exports/Work in Progress` | 1 | the sentence below |

> One video already set up as this client's sits outside this folder, so the tool
> will not recognise it as theirs. A folder further up would take it in. Nothing
> has been changed.

No path, no command, nothing about leaving the panel; `leave-the-panel.test.ts`
passes. It appears on the client card, under the folder field, for the folder as
saved — so it cannot contradict a choice made in the editor and not yet kept. **It
changes nothing.**

**An honest limit, visible in the middle row.** Declaring `Footages` warns about
nothing, because Dr Loubna's only reel *is* there — the other file in
`September Content` is set up as K2 Syndicalia, which is the mismatch the other
rule warns about, not evidence about her folder. The rule only knows videos that
have been made into reels for that client. Footage she owns that has never been
built is invisible to it, and inventing more would be guessing from his disk.

## 5. Every new assertion, red then green

**Nine in `core/src/whose-video.test.ts`.** Red with the containment filter
neutered, restored from a saved byte copy, never with git:

```
 × videos a declared folder leaves out > finds the sibling footage when the folder is declared too deep
   → expected [] to deeply equal [ Array(1) ]
 × videos a declared folder leaves out > counts only videos set up as this client
   → expected [] to deeply equal [ Array(1) ]
 × videos a declared folder leaves out > names the same video once however many reels used it
   → expected [] to deeply equal [ '/Clients/Loubna/September/two.mov' ]
   Tests  3 failed | 16 passed (19)
```

Green restored: `Tests  19 passed (19)`.

**Four in `service/src/catalogue-folder.test.ts`**, the wire to the card. Red with
the evidence cut off at the catalogue:

```
 × the sentence the card gets about a declared folder > says what is left out when the folder is declared too deep
   → expected '' to contain 'One video already set up as this clie…'
 × the sentence the card gets about a declared folder > still lists the clients when a plan is unreadable
   → the given combination of arguments (null and string) is invalid for this assertion…
   Tests  2 failed | 2 passed (4)
```

Green restored: `Tests  4 passed (4)`.

The thirteen by name — core: `finds none when the folder is the client's own
root`; `finds the sibling footage when the folder is declared too deep`; `counts
only videos set up as this client`; `says nothing when no folder has been
declared`; `says nothing on a machine that has made no reels`; `names the same
video once however many reels used it`; `says nothing at all when nothing is left
out`; `says it once for one, and counts the rest`; `says the folder was not
changed, and names no path or command`. Service: `is nothing when the folder holds
every video of theirs`; `says what is left out when the folder is declared too
deep`; `still lists the clients when a plan is unreadable`; `is nothing when this
machine has made no reels`.

**One red that was the test's fault, not the code's**: a curly apostrophe in the
expectation against a straight one in the sentence. The sentence shown beside it
on the same screen — `mismatchSentence` — uses the straight one, so the
expectation was changed to match rather than the product's wording.

## 6. Gates, and part 0 at both ends

| gate | result |
|---|---|
| `npm run golden` | **PASS** — 4 of 4, **17,174 fields**, ledger 165 lines `786497a5f371d179` |
| `npm run check` | **exit 0**, run alone, after committing |
| panel suite ×5 | exit **0, 0, 0, 0, 0** — 285 passed + 2 skipped, five times |

**Golden did not move although both client files changed**, which answers the
question the brief raised: `videoFolder` does **not** reach a built comp. It is
not in the pinned snapshot and no field of the 17,174 depends on it — consistent
with correcting a folder never restyling a reel already made.

| package | session 79 | now | difference |
|---|---|---|---|
| core | 823 / 0 / 823 | **832** / 0 / 832 | **+9** |
| service | 1446 / 0 / 1446 | **1450** / 0 / 1450 | **+4** |
| benchmarks | 173 / 0 / 173 | 173 / 0 / 173 | — |
| panel | 285 / 2 / 287 | 285 / 2 / 287 | — |
| tools/cv (pytest) | 149 | 149 | — |

**The first gate run failed, and it found two real defects — both mine.**

1. **Session 79's guard broke five integration tests whenever a service is
   running.** `spawn.integration.test.ts` timed out five times against
   `a service is already running as pid 79387 on port 59485`, which is Mohamed's
   own service. The guard keyed on `SERVICE_JSON_PATH`, but inside a process
   given `FRAMOPIA_SERVICE_JSON` that constant *is* the override, so a test
   service looked exactly like the machine's one and tried to claim the place.
   Session 79's gate passed only because no service was running at that moment —
   a green that meant less than it appeared to. It now keys on the built-in
   default path.
2. **Four tests were pinning the state of Mohamed's own client.**
   `client-defaults.test.ts` asserted `mode.videoFolder` undefined,
   `create.test.ts` that k2-syndicalia carried no client-detail field at all, and
   two in `clients/videos.test.ts` used k2-syndicalia as a stand-in for "has
   declared no folder". Setting a folder through the panel — the intended action —
   turned all four red for a premise about his data rather than for the behaviour
   under test. Each was rewritten to assert what it was for: the schema rule now
   holds for whichever fields he has left unset, and the folderless case gets a
   client of the test's own. None was deleted and none had its condition removed.

### Part 0, at both ends

| measurement | start | end |
|---|---|---|
| ledger | 165 lines, `786497a5f371d179` | 165 lines, `786497a5f371d179` |
| `templates/library.aep` | `4b0cf05a8f5d4775` | `4b0cf05a8f5d4775` |
| `modes/dr-loubna-kfafi.json` | `51659decc1fe75c3`, Sep 9 21:57:36 | `51659decc1fe75c3`, Sep 9 21:57:36 |
| `modes/k2-syndicalia.json` | `572e99bf890ceefb`, Sep 9 21:58:19 | `572e99bf890ceefb`, Sep 9 21:58:19 |
| services listening | one: pid 79387, started Sep 9 21:57:18, ports 45871 and 59485, **is** the handshake pid | identical, untouched |
| `assets/client-pictures/` | empty | empty |
| extensions folder | one symlink, Aug 27 19:06:47 | one symlink, Aug 27 19:06:47 |
| After Effects | 1 instance, 0 `aerender` | 1 instance, 0 `aerender` |
| working tree | his two client files modified | clean |
| `origin/main..main` | 0 | 0 |

`.local/` unchanged at both ends: audio 27 · bench-audio 5 · build 71 · cache 159
· cv 2234 · deleted-clients 0 · doctor 1 · evidence 3 · ground-truth 10 · plans 66
· quarantine-session51 363 · quarantine-session53 139 · quarantine-session54 1 ·
quarantine-session69 3 · quarantine-session71 0 · transcripts 1.

**No service Mohamed started was stopped.** Pid 79387 is the same process at both
ends, and it holds both the guard port and its data port — session 79's guard
running in production, doing its job.

## 7. Ledger lines added

**None.** 165 lines at the start, 165 at the end, `786497a5f371d179` at every
check — before the work, at both `npm run golden` runs, and at the end. Expected
spend $0.00, actual $0.00.

## What is open

- **The too-deep warning only knows footage already made into a reel.** A video a
  client owns that has never been built is invisible to it. Stated rather than
  guessed around.
- **The five temp-directory plans** point at videos in
  `/var/folders/…`, left by the new-video tests, three of them attached to clients
  that no longer exist. They are harmless but they are not reels.
- **A machine that cannot bind loopback starts unguarded**, deliberately, and
  nothing yet says on screen that the guard was not taken. From session 79.
- The real sidecar's abort remains unproven-fixed, from session 78.
