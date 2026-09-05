Status: OK

# Block 11 session 56 — the work is off the drive, and the partner's path is real

**Expected spend $0.00. No paid call of any kind. The ledger is unmoved at 165
lines and the same sha256 at both ends.**

All of Block 10 now exists somewhere other than the T7 Shield.

---

## 1. The pre-push scan

278 commits had never left this drive — seven more than session 55 measured,
because sessions 54 and 55 added their own since.

**Fast-forward, confirmed before anything was sent:**

```
ahead  (origin/main..main): 278
behind (main..origin/main): 0
merge-base main origin/main == origin/main: yes
git push --dry-run: d53a70b..661f387  main -> main
```

The second number is `0` and the merge base is the remote's tip, so this was a
fast-forward. No force, no tags, no other branch, no history rewritten.

### What was searched for, and what was found

| searched for | how | found |
|---|---|---|
| the **real key values** from `.local/config.json` | read the live file, tested whether each value appears in the 5.3 MB diff — **never printed** | **0 of 2** |
| `AIza…`, `sk_…`, `sk-…`, `ghp_…`, `xox[baprs]-…`, `AKIA…`, `BEGIN … PRIVATE KEY` | regex over the whole diff | **0 across all seven patterns** |
| anything under `.local/` becoming tracked | `git diff --name-only` filtered on `^\.local/` and `config.json` | **none**; `.gitignore` line 1 is `.local/` |
| client photographs and generated images | every tracked file with an image extension, whole tree | **one: `assets/brand/Framopia_LOGO.png`** — the agency's own logo, intentional. No photograph, no generated picture, no cut-out. `.gitignore` carries `*.cutout.png` and `*.mov`. |
| personal identifiers in added lines | absolute paths and email addresses | `/Users/mohamedanouarzaki` **6 times**, all in session reports and a doctor report, all the repository owner's own home path in his own repository. One email address — see below. |
| **AI attribution**, across all 278 commit messages | `Co-Authored-By`, `Generated with`, `Claude`, `Anthropic`, `AI-generated`, the robot emoji | **0**, with two explained non-hits below |

**The two things that looked like hits and are not:**

- **`noreply@anthropic.com`, once**, in `core/src/attribution.test.ts` — the
  repository's *own* attribution checker asserting that it detects that marker.
  The gate itself states the rule: *a marker inside quotes is this repository
  stating the rule, not attribution.*
- **`Claude`, three times**, all the filename `CLAUDE.md`:
  `75e33b0`, `fd92579`, `87969db`.

**The 14 frozen historical commits are from 2026-07 and sit behind `d53a70b`**,
so none of them was in the pushed range. Nothing was rewritten.

**Size:** 2,064 objects, **254.37 KiB** packed. Oldest in the range
`7efeaef` (29 August), newest `661f387` (5 September).

---

## 2. The push, proved three ways

```
d53a70b..661f387  main -> main
```

| proof | result |
|---|---|
| `git rev-list --count origin/main..main` after `git fetch` | **0** |
| local `main` sha vs remote `main` sha | both `661f387a0fb4f1a4004f0347b607f282fcb56a00` — **identical** |
| `git ls-remote origin refs/heads/main` — asked of GitHub itself | `661f387a0fb4f1a4004f0347b607f282fcb56a00` |

### Proved by clone

Cloned fresh from `https://github.com/medanouarzaki/framopia-studio.git` into
`~/Documents/framopia-second-machine-rehearsal/from-github-2/framopia-studio`,
then compared **every tracked file by sha256** against the working copy.

- working copy: **831** tracked files
- fresh clone: **832** tracked files
- **differences: exactly one**

The one is `handoffs/block-10-opening-prompt.md` — the file whose rename is
deliberately left uncommitted in the working copy, so it is still tracked at
`HEAD` and present in the clone but not on the working copy's disk. **Every one
of the 831 files the two share has an identical sha256.**

**The Block 10 work, confirmed by name in the fresh clone:**

| | |
|---|---|
| `docs/SECOND_MACHINE.md` | present |
| `panel/src/NewClient.tsx`, `ClientCard.tsx`, `ClientPictures.tsx` | present |
| `panel/src/client-editing.browser.test.ts` | present |
| `core/src/client-pictures.ts` | present |
| `service/src/analysis/client-picture-slots.ts`, `build/client-picture.ts` | present |
| `service/src/video-pictures.ts` | present |
| `service/src/clients/no-colours.test.ts` | present |

And by content: the label field (*"Use it when someone says…"*, 3 occurrences),
**Make the subtitles** and **Make the pictures** in `App.tsx`, the client
deletion control, and the per-video pictures section. The one remaining *Run
pipeline* in `App.tsx` is the comment explaining why it was replaced, at line
915 — not a button.

**The stale clone is gone.** `framopia-studio-from-github`, the 29-August copy
session 55 left behind, was deleted so nobody rehearses against it by accident.
The other two clones are in place.

---

## 3. The two doctor defects, fixed and proved

### a. Placeholder credentials no longer pass

`checkConfigKeys` now reads the placeholders **out of `config.example.json`
itself**, so the check cannot drift from the file it compares against, and
refuses a value that is the example's, reads like an example, or is too short to
be a credential. Nothing calls either service — the only way to prove a key works
is to spend money with it.

**Red, verbatim — the example copied and not edited, which is exactly what §10
tells a partner to do:**

```
  MISS  the API keys, by presence and shape
        googleApiKey is still the example's placeholder, not a key; elevenLabsApiKey is still the example's placeholder, not a key
        fix: open .local/config.json and replace the two placeholder values with your own keys — the ones from config.example.json are examples of the shape, not keys  (unverified remedy)
```

**Two more failure modes, also red:**

```
        googleApiKey still reads like an example rather than a key
        googleApiKey is too short to be a key
```

**Green again on the real configuration:**

```
  ok    the API keys, by presence and shape
        googleApiKey present (value not shown), elevenLabsApiKey present (value not shown)
```

**One thing was written, run, and taken back out.** The obvious rule — a Google
key begins `AIza` — was implemented first and **refused a working key**. Measured
without printing it: the key this machine actually bills with is 53 characters,
does **not** begin `AIza`, and carries one character outside `[A-Za-z0-9_-]`. A
check that refuses a key that works is worse than the one it replaced, so the
issuer-prefix rule was removed and only what the evidence supports is asserted.
That reasoning is in the code, so nobody adds it back.

### b. `dependencies` — the requirement is now observable

`scripts/preflight.mjs` runs on plain Node, imports nothing but Node's own
built-ins, and is wired into `npm run doctor` ahead of everything else — so it
executes on a clone where nothing is installed.

**Red, verbatim, on the freshly cloned repository with no `node_modules` at
all** — the documented command, in the state the check describes:

```
> framopia-studio@0.1.0 doctor
> node scripts/preflight.mjs && npm run build:core && tsx tools/doctor/cli.ts --

This project is not set up yet, so nothing else will run.

  The project's packages have not been installed yet.
  Run this, from this folder:

      npm install

Then try again. docs/SECOND_MACHINE.md has the whole setup in order.
```

Exit 1. What a partner used to get in that state was `npm error command sh -c tsc`.

**The node-version arm, also red**, with `.nvmrc` temporarily set to `22`:

```
  Node is v24.14.1, and this project is pinned to 22.
  Run this, from this folder:

      nvm install    (from inside this folder — it reads .nvmrc)
```

**Green again** once restored: `npm run preflight` exits 0 and `npm run doctor`
reports **24 present, 0 absent, 0 could not be determined, of 24**.

**Did `dependencies` move from unproven to proved failing? Half, and the honest
half is worth stating.** The *requirement* is now reported in plain words on the
machine that has the problem — that is what changed and it is what the partner
experiences. **The doctor's own `dependencies` check still cannot execute
without dependencies**, and it never will: `npm run doctor` needs `tsx` and a
built core, and both live in `node_modules`. The preflight does not make that
check run; it makes the requirement visible before that check would have been
reached. Counting it as "proved failing" would be a claim about the wrong thing.

---

## 4. The re-rehearsal, from the real remote

Clone: `~/Documents/framopia-second-machine-rehearsal/from-github-2/framopia-studio`,
`HEAD` `7fd1d5f`, identical to `origin/main`. No key and no `.local/config.json`
was copied into it.

| step | ran | what happened |
|---|:--:|---|
| **before §4** | yes | `npm run doctor` reached the new preflight and said `npm install`, in words |
| §1 clone | yes | **22 MB downloaded, 53 MB checked out** — 262 MB after §4 and §6 |
| §2 Homebrew | no | already installed (`Homebrew 6.0.17`) |
| §3 Node | yes | `.nvmrc` `24`, `node --version` `v24.14.1` |
| §4 `npm install` | yes | `added 219 packages, and audited 224 packages in 3s` — **165 entries, 168 MB** |
| §5 ffmpeg | no | already installed (`ffmpeg version 8.0.1`) |
| §6 picture tools | **yes** | worked from the real remote: environment built, both models fetched, `sidecar: ready`; `verify-models.sh` reported both `ok` |
| §7 fonts | no | already installed |
| §8 scripting preference | no | already on |
| §9 panel install | **deliberately not run** | it rewrites `~/Library/Application Support/Adobe/CEP/extensions/`, the one folder After Effects reads, and would have pointed the working panel at the rehearsal clone |
| §10 API keys | **yes** | copied unedited on purpose — the doctor now refuses, see below |
| §11 the videos | no | 11.9 GB that exist only on the T7 drive |
| §12 the saved work | no | same |
| §13 the two measurements | n/a | nothing to do; both correctly reported missing |
| §14 `npm run doctor` | yes | **18 present, 6 absent, 0 could not be determined, of 24** |
| §15 `npm run golden` | **stopped here** | needs §11's videos and an open After Effects |

**Stopped after §14. The next step would have been §11 — copying the five `.mov`
files into `<repo>/my files/test videos/`.**

### The partner's likely mistake, reproduced

`config.example.json` copied to `.local/config.json` and left unedited, exactly
as §10's commands do it, then `npm run doctor`:

```
  MISS  the API keys, by presence and shape
        googleApiKey is still the example's placeholder, not a key; elevenLabsApiKey is still the example's placeholder, not a key
        fix: open .local/config.json and replace the two placeholder values with your own keys — the ones from config.example.json are examples of the shape, not keys  (unverified remedy)

this machine cannot run the pipeline until these are fixed:
  the API keys, by presence and shape — open .local/config.json and replace the two placeholder values with your own keys — the ones from config.example.json are examples of the shape, not keys
```

**It refuses, and it says why.** Last session the same state produced
`ok  the API keys, by presence`.

### The six a fresh clone reports missing

`api-keys` (the placeholders above), `panel-built`, `watermark-facts`,
`loudness-records`, `cache`, `ledger`. Only `api-keys` is listed under *this
machine cannot run the pipeline*.

### The document

`docs/SECOND_MACHINE.md`, 711 → 721 lines. The stale-remote warning that opened
§1 is **removed**, because it is no longer true. The clone size is corrected from
67 MB to the measured 22 MB downloaded and 53 MB checked out; §4 carries the
line npm actually prints; §14 documents the preflight, the new count of 18 of 24,
and what each of the six means; the *rehearsed / not rehearsed* section is
rewritten as a measured table and now names where the rehearsal stopped and what
came next. Both lists are refreshed against this rehearsal. The row saying the
GitHub copy is 271 commits behind is gone.

`leave-the-panel.test.ts` passes — 2 tests. Nothing in the product tells anyone
to leave the panel.

---

## 5. Gates and fingerprints

| | at start | at end |
|---|---|---|
| ledger lines | **165** | **165** |
| ledger sha256 | `786497a5f371d179…` | `786497a5f371d179…` |
| `templates/library.aep` | `4b0cf05a8f5d4775…` | `4b0cf05a8f5d4775…` |
| `modes/k2-syndicalia.json` | `c600905c5e36ecbc…` | `c600905c5e36ecbc…` |
| `modes/dr-loubna-kfafi.json` | `f60749f5629b2ced…` | `f60749f5629b2ced…` |
| `.local/quarantine-session51/` | present | present |
| `.local/quarantine-session53/` | present | present |
| After Effects instances | 1 | 1 |
| `aerender` processes | 0 | 0 |

**`npm run check`, run three times. Exit 0 every time, identical every time:**

| workspace | run 1 | run 2 | run 3 |
|---|---|---|---|
| core | 777 passed | 777 | 777 |
| service | 1358 passed, 1 skipped | 1358, 1 skipped | 1358, 1 skipped |
| benchmarks | 173 passed | 173 | 173 |
| panel | 233 passed, 2 skipped | 233, 2 skipped | 233, 2 skipped |

**The known flaky image-picker test did not fail on any of the three.** It is
open item 6 and was not touched. It failed once during session 55 and once during
session 54, so it is intermittent rather than fixed; three clean runs is evidence
about these three runs and nothing more.

The signature matches the expected core 777 · service 1358 (+1 skipped) ·
benchmarks 173 · panel 233 (2 skipped) exactly. No count moved, so no test needs
explaining.

**`npm run golden` — PASS.** 4 of 4 matched field for field: test-1 4415,
test-2 4280, test-3 3709, vitasilk 4770 — **17,174 fields**. Ledger as golden
itself reports it: 165 lines, `786497a5f371d179`.

**The remote at the end**, after pushing this session's work:
`origin/main..main` is **0**, and the working tree carries only the handoff
rename, exactly as it was found.

---

## 6. Money

**No ledger lines added.** 165 lines at both ends, byte-identical by sha256.
Nothing in this session could bill: a push, a clone, two checks that read files,
and a preflight that imports nothing.

---

## 7. What is most likely to stop the partner now

**The 11.9 GB of video in §11.**

Everything upstream of it now either works or says what is wrong: the clone is
current, the preflight names missing packages, the picture tools install
themselves, and the doctor refuses placeholder keys instead of waving them
through. §11 is the first step with no command that can fix it — the five reels
exist only on the T7 Shield, and the document simply says *copy all five `.mov`
files into `<repo>/my files/test videos/`* without saying how they get to the
partner's Mac.

Until that transfer happens, the partner reaches §11 with a working machine and
nothing to run through it. `npm run golden`, the step the whole document is
built to end on, cannot be attempted at all.
