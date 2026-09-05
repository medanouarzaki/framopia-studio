Status: OK

# Block 11 session 55 — the second machine rehearsed, and the doctor put to the test

**Expected spend $0.00. No paid call of any kind was made; the ledger is
unmoved at 165 lines and the same sha256 at both ends.**

---

## 1. The test counts, measured

`npm run check`, run three times this session. Final measured counts:

| workspace | measured |
|---|---|
| core | **777** passed |
| service | **1358** passed, **1 skipped** (1359) |
| benchmarks | **173** passed |
| panel | **233** passed, **2 skipped** (235) |

The one skipped service test is the one this session added — part 2 below. It
did not exist when session 54 measured 1358.

### Panel: +13, reconciled exactly

Measured by extracting every `it(` name from each file at `85a08eb` (session
53's last commit) and at `HEAD`, and diffing the two sets.

| file | at session 53 | now | change |
|---|---:|---:|---|
| `App.test.tsx` | 45 | 46 | **+1** |
| `render.browser.test.ts` | 120 | 120 | **0** — one renamed |
| `client-editing.browser.test.ts` | 0 | 12 | **+12** |

**+13.** 220 → 233. It reconciles.

**The one added to `App.test.tsx`:**
- *names the two halves of the work rather than the pipeline*

**The twelve in `client-editing.browser.test.ts`:**
- *is there, or the reason is said out loud*
- *takes three faces and sends all three*
- *takes a labelled picture and sends the label with it*
- *sends no label at all when the box is left empty*
- *says what a label is for without naming a mechanism*
- *writes a label onto a picture that is already there*
- *sends only the fields that were touched*
- *changes a face after the client was made*
- *asks before taking a client off the list, and says what happens*
- *attaches a labelled picture to this reel and to nothing else*
- *says these belong to this video and go before the client's*
- *forgets one without touching the file on the disk*

**The two `expect(await page.$('.partrun')).toBeNull()` assertions: one test was
rewritten and renamed, the other was rewritten and kept its name. Neither was
deleted, and neither assertion form survives anywhere.**

| was | is now |
|---|---|
| *offers nothing when there is nothing left to pay for* → `page.$('.partrun')` is null | **renamed** to *still offers both halves, at nothing, when everything is paid for* → `.partrun button` count is **2**, both priced `$0.00` |
| *offers nothing against a service that does not split the cost* → `page.$('.partrun')` is null | **same name**, assertion rewritten to `.partrun` count is **0** and the single button reads *Make this video* |

That is why the file's total is unchanged at 120: one name in, one name out.
`grep` for `page.$('.partrun')` across the panel returns nothing.

### Service: +25, reconciled exactly

| file | at session 53 | now | change |
|---|---:|---:|---|
| `clients/create.test.ts` | 11 | 11 | 0 — one assertion rewritten inside an existing test |
| `clients/edit.test.ts` | absent | 15 | **+15** |
| `clients/delete-is-safe.test.ts` | absent | 1 | **+1** |
| `video-pictures.test.ts` | absent | 9 | **+9** |

**+25.** 1333 → 1358. It reconciles.

**`clients/edit.test.ts` — 15:**

| test | what it asserts |
|---|---|
| is written when a picture is added with one | a label given on add reaches the client's file |
| is absent, not empty, when nothing was typed | a blank or punctuation-only label writes no key at all |
| can be changed and cleared afterwards, without moving the picture | relabelling keeps the picture's id and path |
| does not move the client's version | a label is not part of the look a reel pins |
| refuses a picture this client does not have | an unknown picture id is an error, not a silent no-op |
| changes only what was sent | one field edited leaves the others as they were |
| leaves a field the client never named untouched | a blank goes on meaning *standard* |
| clears a field with null rather than writing an empty one | the key is removed from the file, not emptied |
| moves the version only when the look moves | folder and language do not bump it; faces and name do |
| never changes the id, whatever the name becomes | the filename and every plan's pointer stay valid |
| gives a client all three faces, and takes them away again | `emphasis` round-trips, and `null` returns the client to *tbd* |
| refuses a name that is nothing, and a language it does not know | three refusals, by message |
| refuses a client that is not there (details) | editing a missing client is an error |
| is gone from the picker and kept on the disk | deletion removes the mode file and the bytes survive elsewhere |
| refuses a client that is not there (delete) | deleting a missing client is an error |

**`clients/delete-is-safe.test.ts` — 1:** *builds to exactly the same thing,
field for field* — a reel pinned to a client is built, the client is deleted, it
is built again, and the two are the same string.

**`video-pictures.test.ts` — 9:**

| test | what it asserts |
|---|---|
| is numbered so it can never be mistaken for a client's | ids are `own001` upward against `pic001` |
| goes onto the plan with its label, and the file is not copied | the path on the plan is the file where he put it |
| refuses a file that is not there, and a picture nobody described | two refusals |
| changes and clears a label without moving the picture | relabelling keeps id and path |
| puts a slot that had chosen it back to being generated | forgetting frees the slot rather than orphaning it |
| is the video's that is used when both labels hold the word | the reel's own wins |
| is the client's when only theirs holds the word | the client's still fires |
| is the same answer the matcher gives for the two lists joined | the preference is search order, not a second rule |
| resolves at build time without needing the client to exist | a reel's own picture survives the client going |

**Nothing is unaccounted for, and no test asserting retired behaviour was found.**

---

## 2. A client saved with no colours — **item 7 is still open**

New test at `service/src/clients/no-colours.test.ts`. It starts the real service,
posts `{"name": "No Colours Scratch Client"}` to `POST /clients` with no palette,
and reads the file back.

**It failed.** All four of K2 Syndicalia's colours came out on the new client:

```
background: #1A0000
primary:    #820000
accent:     #C9A96E
light:      #F8F6F2
```

Every one of the four the test looks for. Not one of them is a default — they are
one client's brand arriving on another client's videos, in the ordinary
subtitle words, the emphasised ones, the shadow, the frame round every picture
and the palette named in every image prompt.

**Not fixed, as instructed.** The test is left in place and **skipped**, with the
reason on it naming the open item: closing it needs somebody to say what a client
with no colours of their own should look like, and that is a decision about taste.
The test is written so the day it is decided the answer is already recorded.

---

## 3. `npm run doctor` — 24 checks, put to the test

Every check was made to fail through the doctor's own environment overrides, a
temporary fixture directory, or a synthetic After Effects state read from a file
— a facility the tool already has, precisely so *"the font check must never
write a name to prove itself"*. **Nothing was uninstalled, no font was removed,
no application was touched, and no result was faked.** All of it ran in the
rehearsal clone, never in the working copy.

| # | check | how it was made to fail | what the doctor said | green again |
|---:|---|---|---|:--:|
| 1 | `repo` | clone root made read-only | `absent` — *…is not writable by this account* | yes |
| 2 | `node` | clone's `.nvmrc` set to `22` | `absent` — *v24.14.1 running* | yes |
| 3 | `dependencies` | **see below — unproven** | — | — |
| 4 | `ffmpeg` | `FRAMOPIA_DOCTOR_PATH=/nonexistent-path` | `absent` — *not in .local/config.json, /opt/homebrew/bin, /usr/local/bin or PATH* | yes |
| 5 | `ffprobe` | same | `absent` — same wording | yes |
| 6 | `cv-venv` | `FRAMOPIA_DOCTOR_VENV=/nonexistent/python` | `absent` — *nothing at /nonexistent/python* | yes |
| 7 | `cv-packages` | a bare `python3 -m venv` with none of the packages | `absent` — *import failed: …* | yes |
| 8 | `model-selfie-multiclass-256x256` | `FRAMOPIA_DOCTOR_MODELS_DIR` at an empty directory | `absent` — *nothing at …* | yes |
| 9 | `model-birefnet-general` | `FRAMOPIA_DOCTOR_REMBG_DIR` at an empty directory | `absent` — *nothing at …* | yes |
| 10 | `templates` | `FRAMOPIA_DOCTOR_TEMPLATES_DIR` at an empty directory | `absent` — *nothing at …* | yes |
| 11 | `after-effects` | synthetic state `{reachable:false}` | `unknown` — *synthetic: not running* | yes |
| 12 | `ae-scripting` | synthetic state, preference off, no result written | `absent` — *ran a script to completion but no result file appeared* | yes |
| 13 | `fonts` | synthetic state listing only `Helvetica` | `absent` — *wanted Inter-SemiBold; After Effects lists nothing under that family…* | yes |
| 14 | `panel-installed` | `FRAMOPIA_DOCTOR_EXTENSIONS_DIR` at an empty directory | `absent` — *nothing at …* | yes |
| 15 | `panel-built` | the fresh clone, before `npm run panel:build` | `absent` — *nothing at …/panel/dist/panel.js* | yes |
| 16 | `cep-debug-mode` | `FRAMOPIA_DOCTOR_PATH` so `defaults` cannot be found | `absent` — *set on CSXS none; unset on 10, 11, 12, 13* | yes |
| 17 | `api-keys` | `FRAMOPIA_DOCTOR_LOCAL_DIR` at an empty directory, and on the fresh clone | `absent` — *nothing at …* | yes |
| 18 | `watermark-facts` | same, and on the fresh clone | `absent` — *nothing at …* | yes |
| 19 | `loudness-records` | same, and on the fresh clone | `absent` — *nothing at …* | yes |
| 20 | `footage` | `FRAMOPIA_DOCTOR_FOOTAGE_DIR` at an empty directory | `absent` — *0 of 5 present … missing: test-1, test-2, test-3, ground-truth, vitasilk* | yes |
| 21 | `cache` | empty `.local`, and on the fresh clone | `absent` — *nothing at …* | yes |
| 22 | `ledger` | same, and on the fresh clone | `absent` — *nothing at …* | yes |
| 23 | `disk` | `FRAMOPIA_DOCTOR_MIN_FREE_GB=99999` | `absent` — *26.1 GB free on the volume holding the repo* | yes |
| 24 | `xmllint` | `FRAMOPIA_DOCTOR_PATH=/nonexistent-path` | `absent` — *not on PATH* | yes |

### Totals

- **proved failing: 23**
- **unproven: 1**
- **did not fail when it should have: 0**

### The one unproven, and why

**`dependencies` — the installed workspace dependencies.** `npm run doctor` is
`npm run build:core && tsx tools/doctor/cli.ts`, and both halves live in
`node_modules`. Moving `node_modules` aside and running the doctor was tried:
npm died inside `build:core` with `command sh -c tsc` and the check never ran.

**So on the machine that has this problem, the check that describes it cannot
execute.** That is not a fault in the check — it is honest about what it looks
at — but it means the doctor can never be the thing that tells you §4 was
skipped. What the partner sees instead is npm's own error, and the rewritten
document now says exactly that and what it means.

### Two things worth recording

- **`after-effects` reports `unknown`, not `absent`, and that is deliberate** —
  *"nothing here may launch After Effects; a build needs a person to open it."*
  It is the requirement being reported as unsatisfied, so it is counted as
  proved, and the state is named here rather than smoothed over.
- **`FRAMOPIA_DOCTOR_PANEL_DIST` is the path to `panel.js`, not to the `dist`
  directory.** Pointed at a directory it reports `present` with the directory's
  own size. That was my misreading, not a defect — the check behaves correctly
  in reality, which is how #15 was proved on the fresh clone.

---

## 4. The second-machine rehearsal

**The clone is at
`/Users/mohamedanouarzaki/Documents/framopia-second-machine-rehearsal/framopia-studio`
and has been left in place.** Beside it is
`framopia-studio-from-github`, the first attempt, also left in place.

### The rehearsal stopped before it began, and that is the finding

`git clone https://github.com/medanouarzaki/framopia-studio.git` — the step the
document opens with — produced a repository at **`d53a70b`, *docs: report block 8
session 45*, 29 August**. That is **271 commits behind** the working copy, and
**it does not contain `docs/SECOND_MACHINE.md` at all.**

A partner following this document from GitHub today gets a version of the tool
without the panel's client screens, without picture labels, without per-video
pictures, without the two run buttons — and without the document telling them
what to do next.

**Recorded and not acted on.** Pushing 271 commits to a shared remote is not
something to do inside a session that was asked to rehearse a setup, and the
brief forbids force-pushing. It is the first line of the rewritten document and
the answer to §7 below.

To learn anything else, the rehearsal continued against a second clone of the
**current** code, made with `git clone` from the working copy — carrying exactly
what git carries and nothing else, which is the fidelity the exercise needs.
Nothing was copied into it by hand.

### Step by step, what actually happened

| step | ran | what happened |
|---|:--:|---|
| §1 clone | yes | works. **The size claim was wrong**: the document said 254 KB, measured 67 MB of history and 104 MB checked out. |
| §2 Homebrew | no | already installed (`Homebrew 6.0.17`). A fresh install is still unrehearsed. |
| §3 Node | yes | `.nvmrc` says `24`, `node --version` says `v24.14.1`. As written. |
| §4 `npm install` | yes | **165 entries, 168 MB**, about a minute. The document promised *"added 400 packages"*; what actually appears is package noise followed by `npm audit` warnings. Corrected. |
| §5 ffmpeg | no | already installed (`ffmpeg version 8.0.1`). Unrehearsed. |
| §6 picture tools | **yes** | **worked exactly as written from a fresh clone** — built the environment, fetched both models, ended `sidecar: ready`; `verify-models.sh` then reported both `ok`. The longest step. |
| §7 the three fonts | no | already installed. Unrehearsed. |
| §8 scripting preference | no | already on. Unrehearsed. |
| §9 panel install | **deliberately not run** | `npm run panel:install` rewrites `~/Library/Application Support/Adobe/CEP/extensions/`, the one folder After Effects reads. Running it would have pointed the working panel at the rehearsal clone. `panel:build` was not run either, which is what left check #15 provable. |
| §10 API keys | yes | **found a defect — see below.** |
| §11 the videos | no | 11.9 GB that only exist on the T7 drive. |
| §12 the saved work | no | same. |
| §13 the two measurements | n/a | nothing to do; both correctly reported missing. |
| §14 `npm run doctor` | **yes** | **19 present, 5 absent, 0 could not be determined, of 24.** |
| §15 `npm run golden` | **stopped here** | it needs the five videos from §11 and an open After Effects. **The next step would have been `npm run golden`, expecting four reels built and `$0.00` spent.** |

### The defect §10 turned up

The document says to copy `config.example.json` to `.local/config.json` and edit
it. Copied verbatim and **not** edited, `npm run doctor` reports:

```
  ok    the API keys, by presence
        googleApiKey present (value not shown), elevenLabsApiKey present (value not shown)
```

The file it is looking at contains `AIzaYourGoogleKey` and
`sk_your_elevenlabs_key`. The check is named *by presence* and is honest about
what it does, but the effect is a **green tick on placeholder keys**: the partner
who forgets to edit sees a clean doctor and finds out at the first paid call.
The example also ships `machineLabel` as `mohameds-macbook`.

Reported, not fixed — it is a change to a check, and this session was to measure
the doctor rather than to alter it. The document now carries the warning.

### One more thing the rehearsal could not see

`footage` reported **`5 of 5 present`** on a clone with no `my files/` directory
at all, because `benchmarks/footage.json` holds absolute paths into
`/Volumes/T7 Shield/…` and that drive is plugged into this same Mac. On the
partner's machine those paths will not resolve and the check will correctly
report absent — but **it means this rehearsal could not observe that check the
way the partner will**, and it is why #20 was proved with an override instead.

### Missing from a fresh clone

Git carries the code, the documents, **`templates/library.aep` and its audit**,
**both client files**, **the sound effects**, **the watermark video** and **the
brand logo** — all of that arrives with the clone. What does not:

| what | how big | where it comes from |
|---|---|---|
| the five source videos (`my files/test videos/*.mov`) | 11.9 GB | **Mohamed by hand**, or a drive |
| API keys (`.local/config.json`) | tiny | **accounts of the partner's own** — never copied |
| the saved answers (`.local/cache/`) | 53 MB | **Mohamed** — without it every stage is bought again |
| the cut-out pictures (`my files/test videos/cutouts/`) | 53 MB | **Mohamed** |
| the five video plans (`*.editplan.json`) | 308 KB | **Mohamed** |
| installed packages (`node_modules/`) | 168 MB | **`npm install`** |
| picture tools and both models (`tools/cv/.venv/`, `~/.rembg/`) | ~1 GB | **`tools/cv/setup.sh`**, which fetches them itself |
| the panel bundle (`panel/dist/panel.js`) | 237 KB | **`npm run panel:build`** |
| the three typefaces | small | **font files, installed on the Mac** |
| watermark measurement, loudness records | tiny | **nothing to fetch** — this Mac measures its own |
| the cost ledger | tiny | **nothing to fetch** — starts at zero |
| any client photograph | — | **never copied anywhere, by design** |

### Steps that need a human

| step | why |
|---|---|
| §1 getting current code | someone must push it or hand over a drive |
| §2 Homebrew | its installer asks for the Mac password |
| §7 the fonts | installed by double-clicking, then After Effects restarted |
| §8 the scripting preference | a checkbox inside After Effects; nothing outside may set it |
| §9 restarting After Effects | it reads the extensions folder only at startup |
| §10 the API keys | accounts in the partner's name, and the doctor cannot tell a real key from the placeholder |
| §11, §12 videos and saved work | about 12 GB only Mohamed has |
| §15 `npm run golden` | After Effects has to be open, and only a person opens it |

---

## 5. The document

`docs/SECOND_MACHINE.md`, 586 → 711 lines. Every change is something this
rehearsal observed: the stale-remote warning at the top of §1, the corrected
clone size, the corrected `npm install` output, §6 confirmed as rehearsed, the
placeholder-key warning in §10, the measured 19-of-24 in §14 and what each
missing item means, the note that `dependencies` cannot be observed failing, both
lists above, and a plain statement of which steps were rehearsed and which were
not. No message in it tells anyone to leave the panel.

---

## 6. Gates and fingerprints

**Measured, both ends.**

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

**`npm run check` — PASS, exit 0.** Measured, not copied:

| workspace | measured |
|---|---|
| core | 777 passed |
| service | 1358 passed, 1 skipped |
| benchmarks | 173 passed |
| panel | 233 passed, 2 skipped |

**`npm run golden` — PASS.** 4 of 4 reels matched field for field:
test-1 4415, test-2 4280, test-3 3709, vitasilk 4770 — **17,174 fields**.
Ledger reported by golden itself: 165 lines, `786497a5f371d179`.

**One earlier `check` run failed** and is reported rather than hidden: *the image
candidate picker > shows the picture the build will place, not the cut-out of
it*, in `render.browser.test.ts`. That is the known flaky test — its cutout
fixtures name files that moved into per-reel folders in session 35, and it passes
by winning a race with the `onError` handler. It passed on re-run and on both
subsequent full runs. Nothing this session touched the panel.

After Effects was not driven at any point by this session. `npm run golden`
drives it, and it was run as the gate the brief asks for.

---

## 7. Money

**No ledger lines added.** The file is 165 lines at both ends, byte-identical by
sha256. Nothing in this session could bill: the doctor reads, the clone
downloads only public packages and two model files, and the one new test is
skipped.

---

## 8. The single most likely thing to stop the partner

**They will clone from GitHub and get code from 29 August with no setup
document in it.**

Everything else in this rehearsal — the fonts, the models, the scripting
preference, the 12 GB of footage — is a step that announces itself. This one does
not. The clone succeeds, the folder looks right, `npm install` works, and the
first thing that goes wrong is that a document they were told to follow is not
there, followed by a panel that does not match anything described to them.

The remote needs the current code pushed to it before the partner is given the
URL.
