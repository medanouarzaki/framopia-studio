Status: OK

# Block 12 session 75 — a green gate on the partner's machine now means something

**Expected spend $0.00. No paid call of any kind, no picture generated, no video
transcribed. The ledger is unmoved at 165 lines and the same sha256 at every
check — start, after `npm run check`, after `npm run golden`, and at the end.**
Golden did not move: 17,174 fields, 4 of 4. `npm run check` passed whole.

**A delivered reel was built in another client's colours.** It is not the one-off
defect and it is not this session's to fix. §1.

---

## 1. Did a one-off ever wear another client's colours?

### How a one-off is identified: it is not

**A one-off carries no marker on disk.** Reading `panel/src/NewClient.tsx`, the
form sends `videoFolder`, `logoPath`, `videoShape`, `subtitleBaselineY`,
`palette` and `pictures` **only when `permanent`** — so a one-off client file is
distinguishable from a permanent one solely by what it lacks, and a permanent
client who filled nothing in looks the same. **Any rule for telling them apart
would be a guess**, so this reports what can actually be established instead.

### Every client file, and what palette it holds

K2 Syndicalia's four are `#1A0000 #820000 #C9A96E #F8F6F2`.

| file | palette |
|---|---|
| `modes/k2-syndicalia.json` | is K2 |
| `modes/dr-loubna-kfafi.json` | **her own** — `#123448 #E8873A #FFF4E8 …` |
| `.local/deleted-clients/` | **empty** |
| `quarantine-session53/a-scratch-client-for-session-53.json` | matches K2 |
| `quarantine-session69/a-client-with-its-own-pictures-test.json` | matches K2 |
| `quarantine-session69/a-client-with-no-pictures-test.json` | matches K2 |
| `quarantine-session69/a-second-client-for-the-new-video-test.json` | own |
| `quarantine-session54/delete-safety-test-…json` | own |

**No real client wears K2's palette.** The three that match are all quarantined
**test scratch**, written by suites in sessions 53 and 69.

### The plain answer: yes, one delivered reel wore the wrong brand

| plan | client it was built as | palette | built |
|---|---|---|---|
| test 1, test 2, test 3, vitasilk, ground truth | k2-syndicalia | K2's | correct — they are K2's own footage |
| **sora-995f2d27** | **k2-syndicalia** | **K2's** | **built 2026-09-04 18:18:41** |
| sora-6a60ced1 | dr-loubna-kfafi | her own | built 2026-09-04 18:18:17 |

**`sora-995f2d27` is Dr Loubna Kfafi's footage** —
`…/Clients/Dr Loubna Kfafi/September Content/Exports/Work in Progress/sora.mov` —
**and it was built wearing K2 Syndicalia's four colours.** The `.aep` is still on
disk at `.local/build/sora-995f2d27-full.aep`. Twenty-four seconds earlier her
*other* video was built correctly under her own client.

**It is not the one-off defect, and attributing it to that would be wrong.** The
dates settle the mechanism:

| | |
|---|---|
| plan created | **2026-08-31** 23:03 |
| Dr Loubna's client file created | **2026-09-04** 00:06 |
| plan built | **2026-09-04** 18:18 |

The plan pinned `clientMode: k2-syndicalia` (version 12) when it was created —
**four days before her client existed** — and was never re-attached. Session 74's
inheritance defect would have produced a *client file* holding K2's colours; this
is a *plan* holding a snapshot of the client it was attached to at the time.

**Whether that reel was delivered, this repository cannot say.** It records that
it was built, not what was sent.

**Nothing was changed, moved or deleted.** A wrongly-branded reel is a taste
matter Mohamed judges by eye, and the decision is his.

## 2. What the gate now says, from a real run

On this Mac, which has everything:

```
check: nothing was skipped for want of anything on this Mac
check: PASS
```

On a Mac without the videos — the state `docs/SECOND_MACHINE.md` sets up:

```
check: 2 thing(s) could not be checked on this Mac.
       This is not a failure. It is what was not looked at:

  - the checks that look at the real pictures
      because the picture tools are not installed
      Framopia can still make videos; nothing here checks the colours in a frame.
  - the checks that run a whole video through, end to end
      because the test videos, ffmpeg or the picture tools are not all here
      Expected on a Mac set up without the test videos. Nothing is wrong.
```

**Plain words, no condition names, no variables.** It prints **immediately above
`check: PASS`**, so it is what is still on screen when the gate finishes rather
than something scrolled past several thousand lines earlier. **It never fails** —
a Mac without ffmpeg is not a broken Mac, and saying a setup is wrong when it is
merely incomplete is how a real failure later gets ignored.

Each thing is looked for the way the test looks for it, so the line cannot report
*present* about something a test then finds absent.

## 3. All five proved by making the thing absent

**Nothing was uninstalled.** Each was made genuinely absent by pointing the check
at somewhere that has not got it.

**The picture tools and the end-to-end run** — run from a root with no
`tools/cv/.venv` and no `my files/`:

```
check: 2 thing(s) could not be checked on this Mac.
  - the checks that look at the real pictures
      because the picture tools are not installed
  - the checks that run a whole video through, end to end
      because the test videos, ffmpeg or the picture tools are not all here
```

**ffmpeg** — the fixed probe path redirected and `PATH` emptied:

```
check: 3 thing(s) could not be checked on this Mac.
  - the checks that pull the sound out of a video
      because ffmpeg is not installed
      Framopia cannot transcribe anything without it, so this one is worth fixing.
```

**The browser and the cloud-only file** — `HOME` pointed at an empty directory,
which is where both are looked for:

```
check: 2 thing(s) could not be checked on this Mac.
  - the checks that open a real browser window
      because the test browser has not been downloaded
  - the check for a file kept only in the cloud
      because this Mac has no Google Drive file that is not downloaded
```

**Each named itself and no other**, which is the part that matters: a reporter
that says everything is missing whenever anything is would be useless.

**Nothing is reported `unproven`.** All five were made absent without damaging
this machine. The sixth condition session 74 listed — the second chromium
`skipIf` — is the same `launchFailure` as the first and is covered by the browser
check, so there are five things to look for, not six.

**A defect this proof exposed, in my own script.** Running it with a stripped
`PATH` printed a Node deprecation warning into the gate's output —
`execFileSync` with `shell` is deprecated in Node 24. Changed to `execSync`
before it was committed, so the gate stays clean.

## 4. What the document now says

A new section in `docs/SECOND_MACHINE.md`, immediately after the `check: PASS`
instruction: **"A green run that skipped things is still a green run."** It shows
the list as it really prints, then divides what he may see into three:

- **expected on a Mac set up by this document** — the end-to-end checks, because
  §11 deliberately copies the Edit Plans and not the videos. Nothing to do.
- **worth telling us about** — ffmpeg missing (which stops transcription
  entirely, so it matters), the picture tools not installed, the test browser not
  fetched.
- **harmless wherever it appears** — the cloud-only file, which needs a Google
  Drive file in that exact state to look at.

**Every line comes from §3's measurement**, and the section says so with its
date, rather than from expectation.

## 5. Every new assertion, and what proved it

This session added no test. **The protection is a report, not an assertion**, and
a report is proved by making the world it describes and reading what it says —
which is §3, five times over, each restored afterwards and verified green.

`leave-the-panel.test.ts` passes unchanged: the new line names no command and
sends nobody out of the panel. **`npm run check` is green with the line present,
and the line is what a green now carries.**

## 6. Gates, arithmetic and fingerprints

**`npm run check`: PASS**, exit 0, run after committing. **`npm run golden`:
PASS** — 4415 + 4280 + 3709 + 4770 = **17,174**, field for field.

```
check: 5 compiled artefacts present before the tests run
check: counted with 5/5 corpus Edit Plans and 5/5 reels (11.93 GB) on this disk …
check: 36 skip conditions across 12 test files …
check: nothing was skipped for want of anything on this Mac
```

| suite | passed | skipped | total | session 74 |
|---|---|---|---|---|
| core | **813** | 0 | **813** | 813 — unchanged |
| service | **1426** | 0 | **1426** | 1426 — unchanged |
| benchmarks | **173** | 0 | **173** | 173 — unchanged |
| panel | **271** | 2 | **273** | 273 — unchanged |

**No test was added and no count moved**, which is correct: nothing about what
the suites check changed. The two panel skips are session 73's inverse guards,
which skip because the bundle *is* built.

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
| `modes/.gitkeep` | `e3b0c44298fc1c14…` | same |
| `modes/dr-loubna-kfafi.json` | `f60749f5629b2ced…` | same |
| `modes/k2-syndicalia.json` | `c600905c5e36ecbc…` | same |
| `assets/client-pictures/` | 0 files | 0 files |

The ledger was re-checked after `npm run check` and after `npm run golden`: 165
lines, `786497a5f371d179…`, unchanged at both.

**The extensions folder, byte-identical**, timestamps included:
`com.framopia.studio -> /Volumes/T7 Shield/INSEA/Projects/framopia-studio/panel`,
Aug 27 19:06.

**`.local/` at the start:** `audio` 27 · `bench-audio` 5 · `build` 70 · `cache`
159 · `cv` 2234 · `deleted-clients` 0 · `doctor` 1 · `evidence` 3 ·
`ground-truth` 10 · `plans` 66 · `quarantine-session51` 363 ·
`quarantine-session53` 139 · `quarantine-session54` 1 · `quarantine-session69` 3
· `quarantine-session71` 0 · `transcripts` 1. **Every file read in §1 was read
and not written**; the quarantines are exactly as they were.

After Effects was driven only by `npm run golden`, through `DoScript` into the
already-running instance. It was never launched and never quit. No `.aep` was
written and Mohamed's own project was never saved.

## 7. Money

**No ledger lines added.** 165 lines and the same sha256 at the start, after the
gate, after golden, and at the end. Nothing here could bill: reading plans and
client files, and a line the gate prints.
