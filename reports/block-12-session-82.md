Status: OK

# Block 12, session 82 — a client's photographs, and a warning that blamed the wrong thing

## 1. What was at risk

| | |
|---|---|
| photographs in `assets/client-pictures/` | **14**, all Dr Loubna Kfafi's |
| total size | **25,499,397 bytes (25.5 MB)** |
| tracked in the index today | **0** |
| commits touching that path, on any branch | **0** |
| objects under that path anywhere in history | **0** |

**None is in the history, so nothing here is a decision about rewriting pushed
history.** That was the stop condition and it does not apply.

Session 81 reported 29 MB. That was `du -sh`, which counts allocated blocks; the
content is 25.5 MB. The figure above is the sum of the file sizes.

## 2. What would have carried them up

Measured with `--dry-run`, which stages nothing:

- **`git add -A`** — `add 'assets/client-pictures/dr-loubna-kfafi/pic001.jpeg'` …
  **14 of 14 paths.**
- **`git add .`** — the same 14.
- **`git commit -a`** would not have, because they were untracked — but only until
  the first `add -A`, after which every later commit would carry their changes.
- **Any editor or client offering "stage all"** does one of the two above:
  VS Code's `+` on the Changes group, a JetBrains commit dialog with everything
  ticked, `gh` or a GUI's "commit all".
- `git check-ignore` confirmed the store was **not ignored** by any rule.

## 3. What protects them now

**The store is gitignored**, with the reason and Mohamed's 2026-09-05 ruling
written beside the rule. After it, `git add -A --dry-run` stages **0**
photographs, where it staged 14 before.

**The ignore alone is not the guard.** An ignore file can be edited, `git add -f`
overrides it outright, and a file that is already tracked ignores the ignore
completely. So `scripts/check-no-photographs-staged.mjs` asks git what is
actually staged — `git diff --cached --name-only -z --diff-filter=ACMR`, the
index against HEAD, which is what a commit would really carry — and the gate runs
it. `-z`, because a photograph's name is a client's name and a client's name may
hold anything.

Proved by doing it, forcing past the ignore exactly as `-f` does:

```
### staging one ###
check: FAIL — 1 of a client's photograph(s) are staged.
They are copied into the project so a client's picture survives the drive
it came from, not so they can be published. Committing one puts a real
person's face in a repository with a remote, and pushing it cannot be
undone by deleting it later.
Nothing here is unstaged or deleted for you: they are the client's.

  assets/client-pictures/dr-loubna-kfafi/pic001.jpeg
EXIT=1

### unstaged again ###
check: no client's photograph is staged
EXIT=0
```

**The photograph itself was never touched** — same 1,736,268 bytes, same mtime of
Sep 9 23:18:36, still untracked. Nothing in this session deleted, moved or
committed one. The guard reports and stops: what to do about a staged photograph
is a decision, not a cleanup, and it says so rather than unstaging it.

The rule is now in `CLAUDE.md` among the standing rules, and in the ignore file
and the guard in full.

## 4. Whether a photograph is backed up anywhere at all

**No. Not one of the fourteen is backed up anywhere.**

- **Not in GitHub.** 0 tracked, 0 in any commit, 0 objects in history.
- **Not in the backup set.** `npm run backup` surveys nine groups —
  transcription-cache, analysis-cache, ground-truth, align-references, ledger,
  plans, images, config, footage. Their file lists were read and counted: 205
  files between them, and **0 of them a photograph**. No group walks `assets/`.

So the position recorded at session 62 — that a photograph's only backup would be
GitHub, and that Mohamed accepted that — **describes something that was never
built**. GitHub has none of them. The trade-off he agreed to was never delivered,
and after this session GitHub is a place they deliberately cannot go, which makes
the gap explicit rather than closing it.

**What that means concretely today:** the 25.5 MB exists in exactly one place, the
T7 Shield. If that drive fails, the client files survive in git and still name all
fourteen photographs by absolute path, so every reel that used one becomes
unbuildable and the client card shows fourteen pictures that are not on this Mac.
The originals are the client's own, so re-obtaining them is asking her again.

**Nothing was done about it.** Nothing was pushed, nothing was added to the backup
set, nothing was copied anywhere. That is his ruling to make, and these are the
facts it would rest on.

**Proposed wording, built nowhere, for him to rule on** — on the client card
beside the photographs:

> These pictures are only on this Mac. Nothing else has a copy, so if this disk
> goes they go with it.

## 5. The too-deep warning, fixed

Session 81: K2 Syndicalia was told *"3 videos already set up as this client's sit
outside this folder…"*. Two changes, both exclusions:

**The wrong-client rule answers first.** A video `whoseVideo` says belongs to a
different client is not evidence about this one's folder. `sora-995f2d27` is Dr
Loubna's footage attached to K2; the two rules were reading one fact and drawing
opposite conclusions from it — one that the reel is on the wrong client, the
other that K2's folder is too narrow to hold it. Only the first is true, and
widening K2's folder to take in Dr Loubna's would be the worst answer available.
So the rules are **ordered rather than balanced**, and whatever the wrong-client
rule claims is left out of this one.

**The sentence promises a folder further up, so there has to be one.** The other
two are reels whose videos sit in the operating system's temporary directory. The
first thing those paths share with a client folder on an external disk is the root
of the filesystem — there is no folder further up that would take them in, so the
advice would simply be false. A video counts only when it and the declared folder
meet somewhere that is a folder rather than a disk: `/` does not count, and on
macOS neither does `/Volumes`, where every external disk meets. **Yes, they should
not count, and they no longer do.**

Both are facts about paths, not about his disk; neither needed his tree measured.

Proved both ways on the real data:

| | counted | says |
|---|---|---|
| Dr Loubna, her real declaration (the root) | 0 | nothing |
| **Dr Loubna, declared too deep** — `September Content/Exports/Work in Progress` | **1** | the full sentence, naming her sibling footage |
| K2 Syndicalia, its real declaration | **0** (was 3) | nothing |

The case the warning exists for is untouched: declare a folder too deep and it
still says so. Dr Loubna stays silent on her root, exactly as session 80
measured.

## 6. Every new assertion, red then green

**Seven in `core/src/whose-video.test.ts`**, in two groups. Restored from a saved
byte copy each time, never with git.

Red with the wrong-client rule no longer answering first:

```
 × a video that looks like another client’s > is not counted against the client it is attached to
   → expected [ Array(1) ] to deeply equal []
   Tests  1 failed | 25 passed (26)
```

Red with no shared folder required:

```
 × a video nowhere near the declared folder > is not counted when the two meet only at the root
   → expected [ Array(1) ] to deeply equal []
 × a video nowhere near the declared folder > is not counted when the two meet only at the disks
   → expected [ Array(1) ] to deeply equal []
   Tests  2 failed | 24 passed (26)
```

Green restored: `Tests  26 passed (26)`.

The seven by name — `is not counted against the client it is attached to`; `is
counted when no client folders are given to ask`; `still counts a video no client
claims`; `is not counted when the two meet only at the root`; `is not counted when
the two meet only at the disks`; `is counted when the two share a real folder on
the disk`; `still warns about footage in the client's own tree`.

**One red that was the test's fault**: two fixture paths shared only a single
folder, so the shared-folder rule excluded them and an expectation that they be
counted failed. The fixtures were given a real shared ancestor; the rule was not
changed to suit them.

**The staged-photograph guard has no unit test**, and that is deliberate rather
than an omission: it asks git a question about the real index, and the honest
proof is the one in part 3 — stage one, watch it fail by name, unstage, watch it
pass. That is how session 81's store guard is proved too.

## 7. Gates, and part 0 at both ends

| gate | result |
|---|---|
| `npm run golden` | **PASS** — 4 of 4, **17,174 fields**, ledger 165 lines `786497a5f371d179` |
| `npm run check` | **exit 0**, run alone, after committing, first time |
| panel suite ×5 | exit **0, 0, 0, 0, 0** — 285 passed + 2 skipped, five times |

Both new guards reported in the gate's own output:
`check: the tests left nothing in assets/client-pictures/; 14 photograph(s) were
there before and still are` and `check: no client's photograph is staged`.

| package | session 81 | now | difference |
|---|---|---|---|
| core | 832 / 0 / 832 | **839** / 0 / 839 | **+7**, the seven named above |
| service | 1463 / 0 / 1463 | 1463 / 0 / 1463 | — |
| benchmarks | 173 / 0 / 173 | 173 / 0 / 173 | — |
| panel | 285 / 2 / 287 | 285 / 2 / 287 | — |
| tools/cv (pytest) | 149 | 149 | — |

### Part 0, at both ends

| measurement | start | end |
|---|---|---|
| ledger | 165 lines, `786497a5f371d179` | 165 lines, `786497a5f371d179` |
| `templates/library.aep` | `4b0cf05a8f5d4775` | `4b0cf05a8f5d4775` |
| `modes/dr-loubna-kfafi.json` | `bbda3d30daa1ae3e`, Sep 9 23:22:51 | `bbda3d30daa1ae3e`, Sep 9 23:22:51 |
| `modes/k2-syndicalia.json` | `572e99bf890ceefb`, Sep 9 21:58:19 | `572e99bf890ceefb`, Sep 9 21:58:19 |
| `assets/client-pictures/` | 14 files, 25,499,397 bytes, 0 tracked | 14 files, 25,499,397 bytes, 0 tracked |
| services | one: pid 65179, started Sep 9 23:29:30, **is** the handshake pid | identical, untouched |
| extensions folder | one symlink, Aug 27 19:06:47 | one symlink, Aug 27 19:06:47 |
| After Effects | 1 instance, 0 `aerender` | 1 instance, 0 `aerender` |
| working tree | `assets/client-pictures/` untracked | **clean** — the store is ignored now |
| `origin/main..main` | 0 | 0 |

`.local/` unchanged at both ends: audio 27 · bench-audio 5 · build 71 · cache 159
· cv 2234 · deleted-clients 0 · doctor 1 · evidence 3 · ground-truth 10 · plans 66
· quarantine-session51 363 · quarantine-session53 139 · quarantine-session54 1 ·
quarantine-session69 3 · quarantine-session71 0 · transcripts 1.

Neither client file was written to and both are byte-identical at both ends. No
service Mohamed started was stopped. **Every commit named its paths explicitly**;
no `git add -A` or `git add .` was run at any point, including the two that would
have been safe after the ignore landed.

## 8. Ledger lines added

**None.** 165 lines at the start, 165 at the end, `786497a5f371d179` at every
check — before the work, at both `npm run golden` runs, and at the end. Expected
spend $0.00, actual $0.00.

## What is open

- **The 25.5 MB of photographs exists in one place only**, and after this session
  the one backup they might have had is deliberately closed to them. His ruling;
  the facts are in part 4 and the proposed sentence is built nowhere.
- **A client file in git names photographs that are not**, so a restore from
  GitHub onto a fresh Mac gives fourteen dangling paths and the reels that used
  them cannot be built.
- **The too-deep warning still only knows footage already made into a reel** —
  from session 80, unchanged.
- A machine that cannot bind loopback starts unguarded, from session 79; the real
  sidecar's abort remains unproven-fixed, from session 78.
