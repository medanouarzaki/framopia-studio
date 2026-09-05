# CLAUDE.md

Orientation for Claude Code sessions on this repo. **Short on purpose** — see
*Where the knowledge lives* below, and `docs/CLAUDE_CODE_GUIDELINES.md` §5 for
what belongs in this file and what does not. `npm run check` fails if it grows
past its limit.

The repo lives on the external SSD at
`/Volumes/T7 Shield/INSEA/Projects/framopia-studio`; the drive has to be
mounted before anything works. Test footage sits inside it under
`my files/test videos/` and is gitignored — never commit video or audio.

## What this is

Framopia Studio: an internal After Effects automation tool for a two-person
Moroccan video agency. It turns a finished talking-head reel into an AE
composition with animated subtitles, emphasized keywords, AI-generated
contextual images, SFX and a watermark. **Nothing renders** — the deliverable is
a saved `.aep` for a human to review. Full spec in `docs/PROJECT_SPEC.md`.

## Repo map

- `docs/` — the specification, the architecture, the rulings, the guides. This
  is where knowledge lives; see the index below.
- `reports/` — one report per session. `reports/latest.md` is the most recent.
  `reports/operating-memory-archive.md` is what this file used to carry.
- `handoffs/` — per-block handoff documents.
- `panel/` — the After Effects CEP panel. `panel/src/` is React + TypeScript
  (strict), bundled by esbuild to `panel/dist`; `CSXS/manifest.xml` declares it
  against host **AEFT 26.0** at manifest schema **6.0**. `panel/jsx/` holds the
  ExtendScript the service drives. **ES3 only.**
- `core/` — `@framopia/core`, the shared workspace package: config, the cost
  ledger, pricing and the model pins, typography, the aligner, the mode schema.
  Anything both `service/` and `benchmarks/` need lives here.
- `service/` — the Node/TypeScript companion service: transcription, analysis,
  images, placement, the build, and the HTTP layer the panel talks to.
- `benchmarks/` — the transcription benchmark harness and the results files.
- `tools/` — the Python CV sidecar (`tools/cv/`), the template audit and
  validator, the alignment review sheet, the doctor, and the AE probes.
- `templates/` — `library.aep` and its manifest. **Read-only to every session.**
- `modes/` — one file per client. `k2-syndicalia.json` is the real one.
- `assets/` — brand, SFX and the watermark.
- `.local/` — machine-local config, secrets, caches, run state. Gitignored.
  `videos.json` is every video opened through Browse; `plans/` holds the Edit
  Plan for each, because a client's own footage never gets a file written
  beside it. **Everything a video owns is filed under its content**, not its
  name — `cv/sora-619b8eaecae4/`, `audio/sora-619b8eaecae4.wav` — because two
  of the client's files are both called `sora.mov`.

## Everyday commands

Every command, with what it costs and what it touches, is in
**`docs/COMMANDS.md`**. The ones an ordinary session uses:

- `npm run check` — the regression gate. **Read its exit status, never its
  output**; it prints `check: PASS` only on success.
- `npm run golden` — builds the four golden reels and compares ~17,000 fields
  against `benchmarks/references/golden/census.json`. Needs After Effects open.
- `npm run service` — builds and starts the companion service. The panel starts
  it by itself; run this by hand only when diagnosing one that cannot be reached.
- `npm run panel:build` / `npm run panel:install` — build the panel bundle;
  install it into After Effects' extensions folder once.
- `npm run doctor` — what this machine is missing. Reports, never repairs.
- `npm run backup -- --to <dir>` — copy what cannot be regenerated.

**Anything that spends money says so in `docs/COMMANDS.md`** and prints an
estimate before it runs. `npm run images`, `npm run bakeoff`, `npm run analyse`
and `npm run transcribe` are the billable ones.

## Standing rules — never violated

Stated in full in `docs/CLAUDE_CODE_GUIDELINES.md`; these are the ones that
have cost this project a session each when broken.

- **No AI fingerprints anywhere** — not in a commit message, a file, or a doc.
  `npm run check` gates it. Conventional commits, lowercase after the colon,
  imperative, subject ≤72 chars.
- **ES3 only in `.jsx`.** No `const`/`let`/arrow functions, and ExtendScript's
  reserved words are Java's — `short` and `long` included. `npm run check`
  parses every `.jsx`.
- **After Effects is driven by AppleScript `DoScript` into the already-running
  instance.** Never launch it, never quit it, never `aerender`, never a
  resident `-r` process.
- **Never save the user's project**, and never discard unsaved work. A script
  that adds a temporary comp leaves the project modified; leave it that way and
  say so.
- **`templates/library.aep` is never opened for writing** and never imported
  into itself.
- **`appendCost` fires at the point of spend**, once per billable call, never
  in a wrapper and never on a cache hit.
- **Every schema addition is optional with a default**, or ships with a
  migration path that does not read through the new validator. `readEditPlan`
  validates on read, so a required addition makes every existing plan
  unopenable.
- **Never leave a test asserting retired behaviour.** Rewrite or delete it in
  the same change that retires the rule.
- **A claim that something is verified is emitted by the thing that verifies
  it** — never typed by hand.
- **Secrets live only in `.local/`.** Never logged, never printed, never copied
  to a cloud destination.
- Comments only where a competent human would write one. No decorative banners,
  no emoji, no TODO litter.

## Where the project stands

**Blocks 1 to 9 are complete. Block 10 — hardening and the golden sample — is
in progress.** `docs/BLOCKS.md` is the plan; `reports/latest.md` is the detail
of where the last session left it.

What works end to end today: a reel goes through transcription, keyword and
image-slot analysis, image generation, frame analysis and placement, and comes
out as a built `.aep` with subtitles, keywords, pictures, SFX and the
watermark. **The whole of making a video is driven from the panel** and needs no
terminal. `npm run golden` is green — **17,174 fields** across four reels, with
the four text card comps at **2160x1300**. `npm run check` passed whole at
sessions 39 through 45 and again at 52, panel included, but see the
image-picker tests below before reading that as settled.

Since session 52 **two videos of the same name can coexist**: frames, masks,
zones, the loudness record and the extracted audio are all keyed on the video's
sha256 through `videoDirName`, and `npm run migrate:cv-dirs` moved what was
already on disk without recomputing any of it.

Since session 53 **a client's own picture is used instead of a generated one
when a word she says is in that picture's label** — the user's strict ruling —
decided when slots are planned so the slot is never bought, and a picture id is
resolved against the client on the plan so two clients' pictures cannot meet.
Since session 54 **that label is written in the panel**, beside the photograph
on both client screens; **a video can have pictures of its own**, searched
before the client's; **every field of a client can be corrected and a client can
be taken off the list** (their file is moved to `.local/deleted-clients/`, and a
reel already made builds to exactly the same thing); a client has **three
faces**; and the run screen is **Make the subtitles** then **Make the
pictures**, both priced, the second refused until the subtitles exist.

What is open, in one line each: `ground-truth` cannot build until its six image
slots are generated; a client's photograph is not in the backup set; the image prompt's fidelity, darkness
and literalness fixes are applied but two have never been seen in a generated
picture; the panel's image-picker browser tests are flaky rather than fixed —
their cutout fixtures name files that moved into per-reel subdirectories, and the
`onError` race that causes goes either way from run to run; **a reel's opening
still gets a picture whether or not it earns one**; **only `sora` has been
through slot prompt v3** — the corpus plans still start every picture at the
first word of its span, and moving them means one billable call each; **a sparse
reel holds one picture motionless for a long time** — `test-1` for 6.8 s,
because the hold is exactly the gap the planner left; **a client saved without setting any
colours still inherits K2's four**, because `createClient` copies the template
client's palette and the templates themselves carry K2's Rouge as their authored
shadow; **a client's video shape
and language are recorded and read by nothing that builds a reel**, and the
client card says so rather than claiming otherwise; **taking a client off the
list leaves any slot that had chosen one of their photographs unresolvable**,
and the build refuses at pre-flight until the choice is cleared by hand. Since 2026-09-03 a client's **four brand colours can be typed or pasted as
codes** — the fields were a swatch and a `<code>` label, so a colour could only
be set by dragging inside the OS picker — and they **reach the built comp** — they
were collected and never sent — and **a saved client's colours can be corrected**
(`POST /clients/palette`), which no reel already built feels. A client's colours
now travel whether or not their faces have been measured; they used to go with
the fonts, so every client without measured faces was drawn in the templates'
own K2 red. Since 2026-09-02 a client's **watermark setting and subtitle baseline
reach the build**, pinned on the reel's snapshot. Since 2026-09-01 every picture **arrives
at the word the model says it is about** (slot prompt v3, `nameWordId`), is drawn
**as large as its own corner allows**, is sized against **every frame of its
own life** rather than against their union, and **stays until the next picture
appears**, all the user's rulings.
Every one of these is stated with its evidence in the report that found it.

## Where the knowledge lives

A session looking for something opens the document, not this file.

| document | what it holds |
|---|---|
| `docs/PROJECT_SPEC.md` | The locked product decisions and **every ruling the user has made** — the format, the subtitle rules, the client's identity, what the panel says, where pictures go. |
| `docs/ARCHITECTURE.md` | **How the system works**: the stages, the Edit Plan schema, the caches and what each keys on, the panel and the service, placement, SFX, the build, error philosophy, and the operating knowledge each of those rests on. |
| `docs/CLAUDE_CODE_GUIDELINES.md` | **How to work in this repo**: conventions, testing expectations, what a session report must contain, the rules about driving After Effects, and what belongs in this file. |
| `docs/COMMANDS.md` | Every command, what it costs, what it reads and writes. |
| `docs/TEMPLATE_LIBRARY_GUIDE.md` | The template contract, the manifest schema, SFX binding, and what has been measured inside the comps. |
| `docs/TEMPLATE_BUILD_SPEC.md` | What the six comps were built against. |
| `docs/TEMPLATE_STYLE_PASS.md` | The style pass the user works from. |
| `docs/ORTHOGRAPHY_GUIDE.md` | How speech is written down — **v2.0.0: Arabic in Arabic letters, French and English as they are.** Versioned; the transcription cache keys on its version, and an older entry is reused rather than re-billed. |
| `docs/MACHINE_REQUIREMENTS.md` | Everything a machine must have, with the file and line that needs it. |
| `docs/SECOND_MACHINE.md` | Setting up the partner's machine, and what still needs a terminal. |
| `docs/BLOCKS.md` | The block plan and its dependency sketch. |
| `docs/HANDOFF_PROTOCOL.md` | What a block handoff contains. |
| `docs/DECISION-transcription-config.md` | The frozen transcription config and its evidence. |
| `docs/DECISION-image-config.md` | The frozen image config, and the three open image defects. |
| `docs/DEFECT-alignment-script-mismatch.md` | The alignment defect, its measurements and what is superseded. |
| `docs/BLOCK4-AMENDMENTS.md` | Block 4's amendment sweep. |
| `reports/latest.md` | What the last session did, and what it left open. |
| `reports/operating-memory-archive.md` | What this file used to carry, session by session, verbatim. |
