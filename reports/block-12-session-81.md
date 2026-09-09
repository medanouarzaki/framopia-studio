Status: OK

# Block 12, session 81 — find videos in the subfolders too

## 1. What the list looked at, and what it found in her folder

`listFolder` in `service/src/clients/videos.ts`, reached from `listClientVideos`
and through `listVideosFor` in `catalogue.ts`. It called `readdirSync` **once**,
on the declared folder, and line 74 was `if (entry.isDirectory()) continue;` —
directories were not descended into, they were skipped outright. **Exactly one
level.**

Against her real folder, `/Volumes/T7 Shield/Framopia/Clients/Dr Loubna Kfafi`:

| | |
|---|---|
| videos it found | **0** |
| videos actually under it | **25** |
| directories in her tree | 40 |
| files in her tree | 136 |
| shallowest video | 3 levels down (`Framopia Studio Inputs/Footages/sora.mov`) |

Hence the sentence he saw. Nothing was wrong with his declaration: sessions 77,
79 and 80 all told him to declare the client root so the wrong-client rule could
resolve both her videos, and the root is where none of her footage sits.

**Three of her files are called `sora.mov`**, in three different sub-folders,
with sizes 1487.7 MB, 2402.1 MB and 4455.6 MB. That is the collision case, real
and on his disk.

## 2. Anything else with the same assumption — reported, not fixed

**Nothing else reads a client's folder at all.** `listFolder` is the only walker
over `videoFolder`; its only caller is `listClientVideos`, whose only caller is
`listVideosFor`. The other readers of `videoFolder` are the schema
(`core/src/mode.ts`), the two panel screens that set it, and session 80's
`videosLeftOutside`, which reads plans rather than the disk. A client's
photographs and their logo arrive through the native file chooser, not a scan.

The other one-level `readdirSync` calls in `service/src` are the migration CLIs
over `.local/plans/` and the footage directory — the tool's own flat
directories, not a person's folders. Not the same assumption, and untouched.

**Two things found that are not the video list, and are not fixed here:**

- **`assets/client-pictures/` is not gitignored.** Mohamed added 14 of Dr
  Loubna's photographs through the panel — 29 MB — and they are untracked in a
  tracked directory. One `git add -A` would commit them, against the standing
  rule that a client's photographs are nobody's to carry. Every commit in this
  session named its paths explicitly for that reason; the images are still
  untracked at the end.
- **The two folder rules disagree about `sora-995f2d27`.** Session 80's too-deep
  warning now says of K2 Syndicalia: *"3 videos already set up as this client's
  sit outside this folder…"*. One of those three is `sora-995f2d27`, which the
  wrong-client rule simultaneously says is attached to the wrong client — so it
  is counted as evidence that K2's folder is too narrow when the honest reading
  is that the reel is mis-attached. The other two are the temp-directory test
  plans. "A folder further up would take them in" is poor advice for all three.
  Reported, not changed: part 3 is read-only.

## 3. What stops the search wandering

- **No depth limit at all.** I could not justify a depth number without measuring
  his tree, and fitting a rule to his disk is what session 76 refused. A tree of
  any shape is allowed; only the total work is bounded.
- **Two seconds.** The real guard, and it is a fact about a person waiting: the
  panel draws nothing until this answers.
- **2000 directories read.** Belt to that pair of braces — on a fast local disk
  two seconds is long enough to enumerate an enormous tree, so the count bounds
  the work when the clock does not.
- **Links are never followed.** A symlink is the one way a tree of folders can be
  a circle, so nothing can make this loop.
- **Hidden entries, and packages, are not entered**: `.app`, `.bundle`,
  `.framework`, `.pkg`, `.photoslibrary`, `.imovielibrary`, `.tvlibrary`,
  `.aplibrary`, `.fcpbundle`, `.pproj`, `.prproj`, `.lrdata`. A package is one
  opaque thing holding thousands of files, and an editing library holds its own
  copies of media that are not deliverables. Matched by extension — what makes a
  package a package — not by any name read off this machine.
- **Breadth first**, so if a budget is ever reached the shallowest videos are the
  ones already found rather than the ones lost.
- **It says when it stopped early**: with videos found, *"There may be more
  videos further inside this folder than are listed here."*; with none, it says
  the search had to stop and that a folder closer to them finds them. Neither
  names a command nor asks him to leave the panel.

Her whole folder is read in **12 ms**, so on his machine none of these bind.

## 4. Her videos, as the panel shows them

25 found, 25 offered to the picker, **25 distinct labels**.

```
August content/Exports/Deliverables          Eyes-Mesotherapy           79.7 MB
August content/Exports/Work in Progress      sora                     2402.1 MB
August content/Exports/Work in Progress      test                       40.2 MB
August content/Footage/Video                 MVI_9460                  821.5 MB
Framopia Studio Inputs/Footages              sora                     1487.7 MB
September Content/Exports/Deliverables       presentative              152.9 MB
September Content/Exports/Deliverables       presentative-horizontal   145.2 MB
September Content/Exports/Deliverables       vid-2                      51.1 MB
September Content/Exports/Deliverables       vid-2-2                    51.1 MB
September Content/Exports/Deliverables       vid-2-3                    51.1 MB
September Content/Exports/Work in Progress   sora                     4455.6 MB
September Content/Footage/Video              MVI_9499 … MVI_9520   (14 files)
```

**How the three `sora`s stay apart.** The panel keys its picker by label and
looks the chosen reel back up with `reels.find((r) => r.label === reelLabel)`, so
three reels labelled `sora` would be the same option key three times and whichever
he picked would silently resolve to the first. The label a video reaches the
picker under now carries the folder it was found in —
`September Content/Exports/Work in Progress/sora` — **always, not only when two
clash**, so a label cannot change under him because some other video appeared.
Two files cannot share a name inside one folder, so the labels are unique by
construction. Underneath, everything per-video is still keyed on the video's
sha256 through `video-identity.ts`; this is the screen's half of the same rule.

11 files were named as skipped, all of them After Effects projects and
auto-saves (`Loubna current.aep`, `1-presentative-horizontal auto-save 10.aep`
and so on) — listed rather than silently dropped, which is what that field is for.

## 5. Both rules agree on one declaration

With her real declaration — the client root — the wrong-client sweep is
**identical to session 80's**, run again after the change:

| plan | attached to | whose folder the video is in | verdict |
|---|---|---|---|
| the five temp-directory plans | K2 Syndicalia ×2, clients gone ×3 | cannot tell | silent |
| **sora-6a60ced1** | Dr Loubna Kfafi | Dr Loubna Kfafi | **silent** |
| **sora-995f2d27** | K2 Syndicalia | Dr Loubna Kfafi | **WARNS** |

> This video is in Dr Loubna Kfafi's folder, but it is set up as K2 Syndicalia.
> It will be built in K2 Syndicalia's colours and type unless you change it.

**1 warns, 6 silent, of 7 — unchanged.** So the same declaration now serves both:
the list finds all 25 of her videos, and the rule still resolves both of the ones
that have plans.

The too-deep warning says **nothing** about Dr Loubna, which is right — her root
holds every video of hers. What it says about K2 Syndicalia is in part 2, and it
is the one thing this session found that is worse than it looks.

## 6. Every new assertion, red then green

**Nine in `service/src/clients/videos.test.ts`.** Red with the walk cut back to
one level, restored from a saved byte copy, never with git:

```
 × videos inside the subfolders > finds one several levels down, and says where it was
   → expected [] to have a length of 1 but got +0
 × videos inside the subfolders > finds them at every depth at once, shallowest first
   → expected [ 'top' ] to deeply equal [ 'top', 'a', 'deep' ]
 × videos inside the subfolders > keeps videos of the same name in different folders apart
   → expected [] to have a length of 3 but got +0
 × videos inside the subfolders > lists the rest when a folder cannot be read, and names the one it could not
   → expected [] to deeply equal [ 'fine' ]
 × videos inside the subfolders > does not walk into an editing library or an application
   → expected [] to deeply equal [ 'keeper' ]
 × videos inside the subfolders > still ignores hidden folders and hidden files
   → expected [] to deeply equal [ 'seen' ]
 × videos inside the subfolders > does not follow a link that points back up the tree
   → expected [] to deeply equal [ 'keeper' ]
```

**Four in `service/src/catalogue-folder.test.ts`.** Red with the folder dropped
from the label:

```
 × the labels the video picker is given > gives one label per video, all of them different
   → expected 1 to be 3 // Object.is equality
 × the labels the video picker is given > leads every label with the folder it was found in
   → expected 'sora' to be 'September/Work in Progress/sora' // Object.is equality
   Tests  2 failed | 6 passed (8)
```

Both restored: `Tests  24 passed (24)`.

The thirteen by name — videos: `finds one several levels down, and says where it
was`; `finds them at every depth at once, shallowest first`; `keeps videos of the
same name in different folders apart`; `lists the rest when a folder cannot be
read, and names the one it could not`; `does not walk into an editing library or
an application`; `still ignores hidden folders and hidden files`; `does not follow
a link that points back up the tree`; `says there is nothing in it or in any
folder inside it`; `still names a file it will not offer`. Catalogue: `gives one
label per video, all of them different`; `leads every label with the folder it was
found in`; `leaves a video at the top of the folder named as it always was`;
`points each label at its own file`.

## 7. Gates, and part 0 at both ends

| gate | result |
|---|---|
| `npm run golden` | **PASS** — 4 of 4, **17,174 fields**, ledger 165 lines `786497a5f371d179` |
| `npm run check` | **exit 0**, run alone, after committing |
| panel suite ×5 | exit **0, 0, 0, 0, 0** — 285 passed + 2 skipped, five times |

| package | session 80 | now | difference |
|---|---|---|---|
| core | 832 / 0 / 832 | 832 / 0 / 832 | — |
| service | 1450 / 0 / 1450 | **1463** / 0 / 1463 | **+13**, the thirteen named above |
| benchmarks | 173 / 0 / 173 | 173 / 0 / 173 | — |
| panel | 285 / 2 / 287 | 285 / 2 / 287 | — |
| tools/cv (pytest) | 149 | 149 | — |

**The first gate run failed, and the failure was the gate's own guard being
wrong.** `check-store-empty.mjs` demanded `assets/client-pictures/` be empty
after the tests, and Mohamed's 14 photographs are in it — the product doing
exactly what Block 11 session 62 built it to do. Emptiness was never the
invariant; *the tests leaving nothing behind* is. The gate now records what is
there before the suites and the guard reports what is there afterwards and was
not before, so a real client's photographs can sit there for years and say
nothing. Proved three ways: a planted file fails it by name, removing it passes,
and a run with **no** record fails rather than passing on nothing to compare
against — the green-that-checked-nothing shape this project keeps finding.

### Part 0, at both ends

| measurement | start | end |
|---|---|---|
| ledger | 165 lines, `786497a5f371d179` | 165 lines, `786497a5f371d179` |
| `templates/library.aep` | `4b0cf05a8f5d4775` | `4b0cf05a8f5d4775` |
| `modes/dr-loubna-kfafi.json` | `bbda3d30daa1ae3e`, Sep 9 23:22:51 | `bbda3d30daa1ae3e`, Sep 9 23:22:51 |
| `modes/k2-syndicalia.json` | `572e99bf890ceefb`, Sep 9 21:58:19 | `572e99bf890ceefb`, Sep 9 21:58:19 |
| services | one: pid 65179, started Sep 9 23:29:30, ports 45871 and 60972, **is** the handshake pid | identical, untouched |
| `assets/client-pictures/` | **14 files, 29 MB** — not empty, and not ignored | 14 files, unchanged |
| extensions folder | one symlink, Aug 27 19:06:47 | one symlink, Aug 27 19:06:47 |
| After Effects | 1 instance, 0 `aerender` | 1 instance, 0 `aerender` |
| working tree | her mode file modified; `assets/client-pictures/` untracked | clean but for the untracked photographs |
| `origin/main..main` | 0 | 0 |

`.local/` unchanged at both ends: audio 27 · bench-audio 5 · build 71 · cache 159
· cv 2234 · deleted-clients 0 · doctor 1 · evidence 3 · ground-truth 10 · plans 66
· quarantine-session51 363 · quarantine-session53 139 · quarantine-session54 1 ·
quarantine-session69 3 · quarantine-session71 0 · transcripts 1. The gate's new
record is a single gitignored file at `.local/client-pictures-before.json`.

**The preamble's "`assets/client-pictures/` empty" did not hold at the start**, and
it is listed as found rather than made to hold. Her mode file also arrived
modified — 14 photographs with labels, added through the panel — and was
committed exactly as found, in its own commit, before any of this session's work.
**Nothing wrote to either client file**, and both are byte-identical at both ends.
No service Mohamed started was stopped.

## 8. Ledger lines added

**None.** 165 lines at the start, 165 at the end, `786497a5f371d179` at every
check — before the work, at both `npm run golden` runs, and at the end. Expected
spend $0.00, actual $0.00.

## What is open

- **`assets/client-pictures/` is not gitignored**, and holds 29 MB of a client's
  photographs one `git add -A` from the repository.
- **The too-deep warning counts a mis-attached reel as evidence**, so K2
  Syndicalia is told three videos sit outside its folder when one of them is the
  reel the other rule says belongs to Dr Loubna.
- **The too-deep warning only knows footage already made into a reel** — from
  session 80, unchanged.
- A machine that cannot bind loopback starts unguarded, from session 79; the real
  sidecar's abort remains unproven-fixed, from session 78.
