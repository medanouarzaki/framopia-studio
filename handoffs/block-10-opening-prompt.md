You are running **Block 10 of Framopia Studio** on Claude Opus. Before anything else, read
the project knowledge files: all docs in `docs/`, all handoffs in `handoffs/` (most recent
last — `block-9.md` is the one that matters most). They are binding. This conversation
follows `docs/HANDOFF_PROTOCOL.md` exactly.

## The project, in one paragraph

Framopia Studio is an internal After Effects automation tool for a two-person Moroccan
video agency. A finished talking-head reel goes in; a fully built AE composition comes out
for human review — animated subtitles, emphasized keywords, AI-generated contextual
images, SFX and a watermark. **It never renders.** The deliverable is the saved `.aep`,
and the panel naming that file is the last step of the product. The repo lives on an
external SSD at `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`; the drive has to be
mounted before anything works.

## Block: 10 — Hardening & golden sample

**DoD, verbatim from BLOCKS.md:** *golden run green on both machines; a second real reel
processed by the partner without developer help.*

**Deliverables, verbatim:** one real reel processed end-to-end committed as the permanent
regression fixture (golden sample: pinned inputs, expected artifact shapes/checks —
footage itself stays out of git, referenced by hash + a fetch note); `npm run golden`
executing the full pipeline against it with assertions; error handling + bounded retries
audited across stages; per-reel cost report surfaced; second-MacBook install/setup doc
written and executed for real on machine #2.

**This is the final validation block.** Everything before it built the thing; this one
establishes that it works on a machine that is not the one it was written on.

## What a golden run has to prove, and what it may not assume

A golden run is not "the tests pass". It is: **this reel, on this machine, produces the
artifacts we expect, and the differences from the other machine are only the ones we have
decided are allowed.**

**Must be identical between the two machines**, or the run is not green:
- the transcript — word ids, texts, timings — from the same cache entry
- keyword and image-slot selections, and every span
- the composed image prompts, byte for byte
- zones, placements and their derived sizes
- SFX events: which sound, at which time, at which gain
- the built comp's shape: layer counts per master, comp sizes, frame rate, in/out points
- every constant a build reads: the band, the ratios, the safe width

**May legitimately differ**, and the harness must say so rather than fail:
- absolute paths, and therefore anything embedding one
- timestamps, `measuredAt`, `capturedAt`, wall-clock durations
- the resolved ffmpeg/ffprobe/Node paths and their versions
- the After Effects patch version, and float32 frame-rate storage (`29.9700317382812`
  against `29.9700012207031` — two comps in this project already disagree and it changes
  nothing at this length)
- which cache entries exist, as long as the *selected* one matches
- generated image **bytes**, if anything ever regenerates — the model is not
  reproducible, which is why the golden reel must be one that cache-hits

**The partner's machine has never run this software.** Not the repo, not the venv, not the
models, not After Effects configured for it, not the CEP panel installed, not an API key.
Assume nothing is present. The install doc is written by doing it, and the first honest
output of this block is the list of things that were missing.

## Carry-over from Block 9 that gates this block

- **`DoScript` refused for several minutes in session 5 and it has never been explained.**
  It returned `1` and did nothing, then began working with nothing changed. A `DoScript`
  returning `1` did nothing — retry rather than concluding anything about the script.
  **This is the largest risk to a golden run that drives After Effects.**
- **`.local/build/watermark.json` is gitignored**, so machine #2 starts without it. The
  pipeline measures it itself now, by spawning the same tool a terminal runs, but that
  path has never run on a machine that lacked the file. It will, for the first time, here.
- **A font name After Effects does not have is accepted silently** and read back
  unchanged, so a missing face builds a comp that looks right and is set in the wrong
  type. `build-reel.jsx`'s `check-fonts` stage refuses by name. **Writing an unknown name
  pollutes `app.fonts.allFonts` until the application restarts**, so a font check that
  passes suspiciously on a second run is suspect. Machine #2 must genuinely have Inter
  Semi-Bold, Cormorant Garamond SemiBold Italic and Almarai Bold installed.
- **Headless building does not work.** Every AE operation is `DoScript` into a running
  instance, so a golden run needs After Effects open and a person to have opened it. If
  the golden run is to be scriptable, that is a problem to solve here or to accept and
  document.
- **Two prompt changes are applied and have never been observed working**: the
  literal-versus-feeling rule (`ACTIVE_SLOT_PROMPT_VERSION` 2) and the tighter framing
  axis (mode v12). The first reel to plan slots fresh exercises both. `ground-truth` and
  `test-3` are the only two reels whose analysis has never run.
- **The corpus is pinned at ORTHOGRAPHY_GUIDE v1.0.7** while the guide file is v1.0.8.
  Re-transcribing is not reproducible and would invalidate the hand-made alignment
  references, which cannot be regenerated at any price. **Do not re-transcribe.**
- **The second-machine sharing doc does not exist.** It is this block's first deliverable.

## The two unfinished subtitle rulings — Block 10 work, not afterthoughts

The user ruled on three subtitle questions in Block 8 and **two are unimplemented**. They
are listed here as work, not as notes.

1. **An overlong word shrinks to fit** — never clipped, never wrapped to a second line;
   the type scales down for that word on its own card. This needs `sourceRectAtTime`
   against `SUBTITLE_SAFE_WIDTH` and the three faces, all of which now exist, and it
   touches `service/src/build/` and the template contract (`TXT_MAIN`'s scale becomes a
   per-instance value). **The system never edits a template's keyframes**, so the scale
   is set on the instance.
   **The corpus already contradicts this today, measured:** two keywords overflow one line
   and the builder **wraps** them — `test-1` k002 `محفزات الكولاجين` at 3471.2 px and
   `test-2` k002 `ترطيب عميق` at 2449.7 px, both against a 1940 px bound — and a third,
   `test-2` k003 at 1921.0 px, fits by 19 px. Also: **`OVERLONG_WORD_CHARS = 11` is a
   character-count proxy** for a width only After Effects can measure, and a third face
   made it worse.
2. **A multi-word §6 term occupies one card together**, overriding
   `MAX_WORDS_PER_CARD = 1`. **Blocked on a term source the project does not have**: the
   detector flags every run of consecutive Arabic-script words while §6 defines a term
   semantically, and three identical analysis calls returned three different term sets,
   two of which broke a term the guide names verbatim. `Transcript.terms`,
   `service/src/analysis/terms.ts` and `ACTIVE_ANALYSIS_PROMPT_VERSION` 4 exist and are
   deliberately unread by grouping. The trustworthy source is a hand-made reference of
   term spans — the same shape and the same cost in the user's time as the alignment
   references. **Collect that decision early if it is to happen at all.**

## The budget — read before planning any run

| | |
|---|---|
| all-time ledger | **$12.189250** over 116 entries |
| **remaining Gemini credit** | **about $6.82** |
| a fresh reel | **$2.35** — $0.18 analysis plus $2.17 budgeted for images |
| reels that cost $0.00 to re-run | `test-1`, `test-2`, `vitasilk` |
| reels never analysed | `ground-truth`, `test-3` |

**The golden run must be built against a reel that cache-hits**, so developing the harness
costs nothing. The two unanalysed reels are **$4.70 of the $6.82** between them, and the
partner processing "a second real reel" also draws on the same pot. **There is not enough
money for both a full second reel and a generous golden run — decide which, and say so.**

## Standing rules — binding, and each one is a thing that has gone wrong

**After Effects.** Sessions drive it. **Permitted:** AppleScript `DoScript` into the
**already-running** instance. **Forbidden:** launching it; quitting it; `aerender`; any
resident `-r` process (one was observed executing its body a session later and quitting
the application on the user); saving the user's own project; modifying
`templates/library.aep`, which is read-only; importing a project into itself.

**Money.** No billable call without the user's explicit go-ahead in conversation, an
estimate printed before spending, and a ceiling that aborts rather than truncates.
`appendCost` fires only at the point of spend, never in a wrapper.

**Never touch** `.local/ground-truth/`, and never regenerate a hand-made reference.

**Schema.** Every Edit Plan addition is optional-with-default, or ships a migration that
does not read through the new validator.

**No AI fingerprints anywhere.** No "Generated with Claude Code", no "Co-Authored-By:
Claude", no AI attribution or tool banner in commits, code, docs or anywhere. Conventional
commits, lowercase after the colon, imperative, ≤72-char subject, small and coherent.
Comments only where a human would write one. No emoji, no decorative banners, no TODO
without a reason that also appears in the report.

**Never leave a test asserting retired behaviour.**

## How each Claude Code session is run

Every prompt is self-contained and assumes nothing is remembered. It carries: hard stop
conditions checked first and in order (mount; ledger line count and sha256 byte-identical
at both ends unless a spend was authorised; cache census; After Effects pid unchanged and
`aerender` 0; `templates/library.aep` sha256 unchanged); exact goals; the tests to write
**and run**; `npm run check` at the end with **measured** per-workspace counts pasted from
that run, never copied from the prompt.

Each session writes two identical files: **`reports/latest.md`** — overwritten, and the
only file the user reads — and `reports/block-10-session-N.md`. First line exactly
`Status: OK` or `Status: PROBLEM — <cause>`. **The user does not run commands**; write
nothing addressed to him as a task, except one line under *Suggested next step* naming a
file to open, or one sentence if something genuinely needs his hands.

**Never claim success for anything that was not actually run.**

## Start here

Confirm your reading of Block 10 in one paragraph. Then collect the user inputs this block
needs before any work begins — at minimum: **physical access to the partner's machine and
when**, whether the partner's After Effects is installed and at what version, whether the
three K2 fonts are on it, whether there is a second API key or the same one is shared, and
**his decision on where the remaining $6.82 goes**. Then produce Claude Code prompt #1.
