# Handoff — Block 9: Client modes + K2 Syndicalia
Date: 2026-08-30 · Conversation model: Claude Opus · Sessions run: 13

Read this with `handoffs/block-8.md`. Nothing here refers to a conversation; it
states what is on disk and why.

## Status vs BLOCKS.md

Block 9's DoD: *switching modes changes fonts/palette/image style/template
variants end-to-end on the fixture; second-machine sharing doc reviewed by the
user.*

| item | met | evidence |
|---|---|---|
| mode JSON schema, loader, validation | **yes** | pre-existing; extended this block with fonts, colour roles, snapshot |
| K2 mode built with the identity the user provides | **yes** | `modes/k2-syndicalia.json` v12, three real faces, locked palette |
| fonts/palette/image style/template variants change end-to-end | **yes** | `vitasilk` and `test-2` built and read back: three faces on screen, crème and gold, red shadow, `_ar` variants by script |
| mode vocabulary → keyterm wiring verified | **no** | `vocabulary` is deliberately still `[]` — see decision 9 |
| second-machine sharing doc | **no** | not written. It belongs with Block 10's install-and-run on machine #2, which is the only thing that can test it |

**Block 8's DoD was also closed here** (session 13): a video now goes from picked
in the panel to a built comp with no terminal step. That was the one item Block 8
left open.

## What Block 9 built, session by session

1. **Frame analysis driven.** The `zones` stage samples, segments and derives
   zones itself through the same functions the three CLIs call. Measured: all
   1180 frame and mask PNGs byte-identical to what was already on disk.
2. **K2 Syndicalia became a real client.** Three faces, colour roles, and
   `plan.clientSnapshot` — a copy of the client's look taken when the video was
   attached.
3. **Build stamps.** A staleness banner that compared process start times was
   replaced by a content hash over every compiled or evaluated source file.
4. **An ExtendScript syntax gate.** `scripts/check-extendscript.mjs` parses every
   `.jsx` in the repo, inside `npm run check`.
5. **Fonts measured inside After Effects.** What AE accepts as a font name, and
   what it silently does with one it does not have.
6. **The ratio reconciled**, and the build began setting face, size and colour on
   the placeholder.
7. **The emphasis ratio ruled**, and `docs/TEMPLATE_STYLE_PASS.md` written for the
   user's hand pass.
8. **Stopped:** his pass had duplicated a text layer.
9. **Stopped:** one renamed layer carried a trailing space.
10. **Stopped:** a measurement script of mine imported the library into itself.
11. **The shadow filled and proven** by reading built files: 71 and 67 text comps,
    no placeholder word surviving.
12. **The image prompt.** Darkness fixed and measured; $1.2207 spent on `test-1`'s
    eight images.
13. **Framing tightened; Block 8's DoD closed.** The two build measurements are
    driven from the pipeline.

## Decisions made (and why)

### The user's rulings

1. **Three faces, recorded family-and-style *and* PostScript.** Inter Semi-Bold
   for ordinary words, **Cormorant Garamond SemiBold Italic** for emphasized ones,
   **Almarai Bold** for Arabic. **After Effects cannot be given a font name
   containing a space** — `TextDocument.font = 'Inter Semi-Bold'` throws *invalid
   character 32* — so the mode carries both forms: the family-and-style strings he
   gave, and `fonts.postScriptNames`, which is what a build writes.
   Measured on his machine, and **the obvious construction is wrong**: the
   emphasis family is `CormorantGaramondItalic`, so the name is
   `CormorantGaramondItalic-SemiBoldItalic` and `CormorantGaramond-SemiBoldItalic`
   does not exist.
2. **Crème on ordinary words, gold on emphasis.** `#F8F6F2` and `#C9A96E`, his
   brand chart stated literally, in `textColours` as palette **roles** rather than
   hexes so a second client does not inherit K2's.
3. **`EMPHASIS_SIZE_RATIO = 1.1641`, from cap height.** He was built `vitasilk`
   twice from one plan, differing only in this number, and chose the smaller.
   **The derivation preferred 1.3479** — x-height, corroborated to within 0.6% by
   advance width, two independent measures against one — and cap height is a
   16.5% outlier the gate refuses on the numbers alone. **His eye decides where a
   measurement and his eye disagree**, the same principle that settled
   `IMPACT_THRESHOLD`. `RULED_EMPHASIS_QUANTITY` is the named way past the gate
   and nothing else has one.
4. **Two text layers per card, and no stroke.** `TXT_MAIN` in pale `#F4F4F4` over
   `TXT_MAIN_SHADOW` in **Rouge K2 `#820000`, offset +8 across and +15 down** by a
   Transform effect with a Fast Box Blur animating **30 → 0** across the entrance.
   It does the work of a contour and a shadow at once. **There is no stroke and
   none is wanted** — measured first, because a stroke of width *w* makes a word
   2*w* wider and taller and would have moved the layout, while a drop shadow
   changed `sourceRectAtTime` by nothing.
5. **The framing axis stops offering `wide`.** A picture is placed at a fixed size
   in the top-left corner, 801–917 px on a 2160 px frame, so a wide shot is
   unreadable there. `test-1`'s `img002` is the evidence: one candidate a whole
   doctor showing nothing, the other her from the chest with the vial large in
   frame. Medium is the loosest value left; close and macro lead.
6. **Hold the remaining budget rather than test the prompt changes.** About
   **$6.82** remains and Block 10's golden runs on two machines come out of the
   same pot. Both prompt changes stay applied and unobserved — see *What is
   applied and unobserved*.

### The conversation's rulings

7. **A client mode is a snapshot, not a pointer.** `plan.clientSnapshot` carries
   the palette, faces, colour roles and `imageScale` as they stood when the video
   was attached, and a build reads that copy. A reel approved in March must
   rebuild in June as approved; of the two possible failures, a rebuild that
   silently disagrees with what was approved cannot be noticed, while one
   deliberately out of date can be. **Moving a reel forward is a control someone
   presses, never automatic.** `resolveClientIdentity` is the one declaration of
   which look a build uses.
   **A reel is behind when the *look* differs, not when the version number does**
   (session 13): `snapshotsAgree` excludes the version, because two sessions of
   image-prompt edits marked every pinned reel as behind while its look was
   byte-identical, and a warning that fires when nothing changed trains the reader
   to ignore the one that matters. The version is still recorded as provenance.
8. **Nothing in this system renders.** The deliverable is the saved `.aep`, and
   the panel naming the file is the last step of the product — which is why the
   build reporting its own save path (session 14) is not cosmetic.
9. **`vocabulary` stays `[]`.** The brand document is full of terms — Loi 18-00,
   CNDP, copropriété, syndic, assemblée générale, recouvrement — and they key the
   keyword cache **and** reach Scribe as keyterms, so adding them is a billable
   decision, not a data-entry one.
10. **Sessions drive After Effects, and only one way.** Permitted: AppleScript
    `DoScript` into the **already-running** instance. Forbidden, each because it
    has gone wrong: **never launch it** (not running is a stop), **never quit
    it**, **never `aerender` and never a resident `-r` process** (one was observed
    executing its body a session later and quitting the application on the user),
    **never save the user's own project**, **never modify `templates/library.aep`**,
    and **never import a project into itself**.

## Amendments applied to docs

- **`docs/ARCHITECTURE.md` §6** — said a cache key includes the mode version. It
  does not, and the code stopped keying on it twice, both times after a bump
  stranded paid work (Block 4 session 4, Block 7 session 1). §6 now lists what
  each stage actually keys on and states the rule: **key on what the call sends,
  never on a number that moves for unrelated reasons.** K2 went v10 → v12 during
  this block and no cached entry moved.
- **`docs/PROJECT_SPEC.md` §5** — the emphasis face and its ratio, the colour
  roles, the framing ruling.
- **`docs/DECISION-image-config.md`** — three amendments this block: the palette
  and lighting fragments applied and what they bought, the framing axis, and the
  record that two prompt changes are applied and unobserved.
- **`docs/TEMPLATE_STYLE_PASS.md`** — new, and now describes what he actually did.

## The defect shapes this block cost a session to

Six, in the spirit of `handoffs/block-8.md` §5. **Every one of them reported
success, or passed a check, while it was wrong.** That is the shape to look for.

### A hand edit the machine could not see

His style pass duplicated `TXT_MAIN`, and the copy kept the template's
placeholder word. The build fills by exact name, so it filled one layer and left
`kan9olo` visible on the other — **one build away from a placeholder word on
every card of every reel**. Nothing failed: the build reported success.

*While it was happening:* a build that says it wrote 71 text comps, and a comp
with two layers where one is right.

**Fixed by making silence illegal.** Every text layer in a template is now a
declared **placeholder**, a declared **shadow**, or a declared **decorative**
layer; an undeclared one fails validation by name. Silence used to mean two
different things — "the build fills this" and "the build ignores this" — and a
layer nobody had decided about looked exactly like one somebody had.

### One character

`kw_slam`'s visible layer was named `"TXT_MAIN "`. Everything read correctly to
the eye and nothing matched in code.

*While it was happening:* a rename that is right in three comps and wrong in the
fourth, and a validator failing with a message that looks like a lie.

**Not fixed by trimming whitespace in the matcher.** Trimming would have made the
name inexact and hidden the next one; the guard is narrowed by a ruling, never by
a session that wants to keep going.

### A script that had never been parsed

`tools/ae/measure-fonts.jsx` was written with `{ short: …, long: … }` and handed
to the user. **`short` and `long` are reserved words in ExtendScript** — Java's
list, not JavaScript's — so it failed at the parse: **not one statement ran,
nothing was measured, nothing was written.**

*While it was happening:* a session that believes it delivered a measurement
tool, and a user who runs it and gets nothing.

A syntax error needs no After Effects to catch, and nothing was looking: `.jsx`
is not TypeScript, eslint is pointed at `src`, and no test opened these files.
**`npm run check` now parses every `.jsx` in the repository** — Node's parser,
the reserved-word list, and post-ES3 syntax — and all pre-existing files passed,
so the only file it caught was the new one.

### A gate that tested a different quantity than the one written

Session 5 wrote `EMPHASIS_SIZE_RATIO = 1.3479` and reported its two samples as
**1.35622** and **1.37296** — the written value lies outside both, because those
are **advance widths** and the value is an **x-height**. The consistency check
passed and had tested nothing about the number beside it.

*While it was happening:* a report whose own figures do not contain its
conclusion, and a green check.

`chooseRatio` now tests **the quantity that is actually written**: the same at
both sizes, and an independent quantity agreeing within 3%.

### A measurement that destroyed its own footing

Session 10's shadow measurement imported `templates/library.aep` while that file
was the open project. **After Effects does it without complaint**: the result was
a project holding two of every comp, dirty, and both the audit and the build then
correctly refused it — which cost the session.

*While it was happening:* a script that runs, returns a result, and leaves the
next four commands refusing for reasons that look unrelated.

`panel/jsx/library-guard.jsx` is the one check, called by all four drivers before
they open anything. It compares `fsName`, so a relative path or a symlink cannot
slip past.

### Unit tests doing real work

Session 13 added two measurements to the transcription stage without injecting
them, so `pipeline.test.ts` ran **real ffmpeg over two real 2.4 GB videos on
every run**. All 1146 tests were green.

*While it was happening:* a test suite that is slower than it was and nobody
notices, writing to real plans.

Found by looking at the disk, not by a failing test. Both hooks are injectable
now and every `runPipeline` call in that file passes fakes.

**What they share:** each was invisible to the thing that should have caught it,
and each left a green signal behind. The countermeasure that keeps working is the
one Block 8 named — *whatever asserts a property is emitted by the thing that
verifies it* — plus its sibling from this block: **make silence illegal**, so an
undeclared layer, an unparsed file or an untested quantity cannot pass as
approved.

## What is applied and unobserved

**Two prompt changes are in force and neither has been through a generation.**
This is recorded so a later session does not assume they work.

| change | applied | what would test it |
|---|---|---|
| **literal or atmospheric** — `slotPrompt`, `ACTIVE_SLOT_PROMPT_VERSION` 2 | session 12 | the first reel to plan slots fresh |
| **framing tightness** — `imageVariation`, mode v12 | session 13 | the same run |

Both were deliberate. The literalness rule governs which *ideas* get written and
session 12 reused `test-1`'s existing four; re-planning them yields **six slots,
not four** at `IMAGE_SLOTS_PER_30S` 8, which exceeded that run's authorised
ceiling. The framing rule changes what a slot draws, so testing it means
regenerating, and the user ruled against spending.

**`ground-truth` and `test-3` are the two reels whose analysis has never run**, so
whichever goes first exercises both at once.

## What was never reached

**The three subtitle rulings of Block 8 session 20 are still two-thirds
unimplemented.** Ruling 2 — a card stays tight to its word — was already
satisfied by Block 7's entrance compression. The other two are Block 10:

1. **A multi-word §6 term should occupy one card together.** `MAX_WORDS_PER_CARD`
   is 1 and a term overrides it. **Unimplemented, and blocked on a term source
   the project does not have**: the detector flags every run of consecutive
   Arabic-script words while §6 defines a term semantically, and three identical
   analysis calls returned three different term sets, two of which broke a term
   the guide names verbatim. `Transcript.terms`, `service/src/analysis/terms.ts`
   and `ACTIVE_ANALYSIS_PROMPT_VERSION` 4 all exist and are **deliberately unread
   by grouping**. A trustworthy source is a hand-made reference of term spans —
   the same shape and the same cost in his time as the alignment references.
2. **An overlong word should shrink to fit**, never clip and never wrap.
   Unimplemented.

**And the corpus already contradicts ruling 3 today.** Measured in After Effects
this session, every keyword at the face and size the build would set it in,
against `SUBTITLE_SAFE_WIDTH` 1940:

| keyword | face | width | verdict |
|---|---|---:|---|
| `test-1` k002 `محفزات الكولاجين` | Almarai-Bold 455 | **3471.2 px** | **overflows — the builder wraps it to two lines** |
| `test-2` k002 `ترطيب عميق` | Almarai-Bold 455 | **2449.7 px** | **overflows — wrapped** |
| `test-2` k003 `شد خفيف` | Almarai-Bold 455 | 1921.0 px | fits, by **19 px** |
| `vitasilk` k001 `filler glow` | Cormorant 494.742 | 1816.0 px | fits |
| `vitasilk` k002 `Vita Silk` | Cormorant 494.742 | 1547.4 px | fits |
| the other three | | 673–1405 px | fit |

**Two keywords in the corpus overflow one line and the builder wraps them**,
which is not what ruling 3 says should happen — it says shrink. Both are
two-word Arabic keyword spans. A third sits 19 px under the bound, so a slightly
longer Arabic term joins them.

**`OVERLONG_WORD_CHARS = 11` is a character-count proxy** for a width only After
Effects can measure, and **a third face made it worse**: it was calibrated when
two faces were drawn, and Cormorant at 1.1641 sets very differently from Inter
while Almarai has no relation to either. It still agrees with the measured set on
this corpus, and that is luck rather than design.

## The budget

| | |
|---|---|
| all-time ledger | **$12.189250** over 116 entries |
| spent this block | **$1.220660**, all in session 12 |
| **remaining Gemini credit** | **about $6.82** |

A **fresh reel costs $2.35**: $0.18 for keywords and image slots, plus **$2.17**
budgeted for images — six slots at `IMAGE_SLOTS_PER_30S` 8, twelve candidates, at
`IMAGE_COST_MULTIPLIER` 1.35 over published. Measured by the dry run, not
estimated here.

So the two unanalysed reels are **$4.70 of the $6.82**, and **Block 10's golden
runs on two machines draw on the same pot.** That is the whole of the money and
it does not stretch to both a full second reel and a generous golden run.

The three reels that are done — `test-1`, `test-2`, `vitasilk` — all read $0.00
on a dry run: a re-run bills nothing.

## Known issues & risks, especially for a second machine

1. **`DoScript` refused for several minutes in session 5 and it has never been
   explained.** The first calls returned `1` and did nothing at all, for minutes,
   then began working with nothing changed on this side. **A `DoScript` that
   returns `1` did nothing; retry rather than concluding anything about the
   script.** This is the single largest risk to a golden run that drives After
   Effects.
2. **`.local/build/watermark.json` is gitignored, so a second machine starts
   without one.** It matters less than it did — the pipeline now measures it
   itself, by spawning the same tool a terminal runs — but a machine that has
   never run the pipeline has no watermark facts, and the build refuses without
   them. Block 10 will exercise exactly that path for the first time.
3. **A font name After Effects does not have is accepted silently.** It throws
   nothing and reads back unchanged, so a missing face produces a comp that looks
   built and is set in the wrong type. `build-reel.jsx`'s `check-fonts` stage
   refuses by name before anything is placed. **And writing one pollutes
   `app.fonts.allFonts` for the rest of the application session** — a name set
   but not installed is added to the list and reports itself installed on the
   next run. **Only a restart clears it**, so a font check that passes suspiciously
   on a second run is suspect.
4. **Headless building does not work here.** Every AE operation goes through
   `DoScript` into a running instance, so a golden run needs After Effects open
   and a person to have opened it.
5. **`.local/` is gitignored and holds everything irreplaceable.** `npm run
   backup` is the answer and it verifies every byte after writing; the run of
   record goes to Google Drive and refuses to copy `.local/config.json`, which
   holds the API key, into a cloud folder.
6. **The corpus is pinned at ORTHOGRAPHY_GUIDE v1.0.7** while the guide file is
   v1.0.8. Re-transcribing is not reproducible and would invalidate the
   hand-made alignment references, which cannot be regenerated at any price.
7. **`vocabulary` is empty**, so the mode-vocabulary-to-keyterm wiring is
   implemented and unexercised on real data.
8. **The second-machine sharing doc does not exist.** It is Block 10's first
   deliverable and the only thing that can test it is doing it.

## Repo state

- Branch **`main`**, HEAD at the close of this block: **`docs: report block 9
  session 14`**.
- `npm run check` passes, including the ExtendScript gate, the template
  validator and the Chromium 99 denylist against the built `panel/dist`.
- New top-level paths this block: `tools/font-metrics/`, `tools/image-luminance/`,
  `panel/jsx/library-guard.jsx`, `docs/TEMPLATE_STYLE_PASS.md`,
  `core/src/loudness.ts`, `service/src/build/measurements.ts`.
- `modes/k2-syndicalia.json` is at **v12**.
- `templates/library.aep` sha256
  `1d7553e894e10f82051131e8c1b37305fa8ad14a1d6843df4a40415d2bc4a5d8`, unchanged
  since the user's own style pass.

## Exact next steps

1. **Write the second-machine install-and-setup doc, then execute it for real on
   machine #2.** It is a Block 10 deliverable and it has never been done; the
   partner's machine has never run this software.
2. **Build the golden run** — pinned inputs, expected artifact shapes, `npm run
   golden` — against a reel that cache-hits, so the harness itself costs nothing
   to develop.
3. **Decide whether to spend $2.35 on `ground-truth` or `test-3`.** It is the only
   thing that tests the two unobserved prompt changes, and it is a third of the
   remaining credit.
4. **The two subtitle rulings**, in this order: shrink-to-fit for an overlong
   word, which needs only `sourceRectAtTime` and the fonts that now exist; then
   whole-term grouping, which needs a hand-made term reference first.

## User inputs collected this block

| input | where it is recorded |
|---|---|
| the K2 brand document — palette names, three faces, colour roles | `modes/k2-syndicalia.json`, and `docs/PROJECT_SPEC.md` §5 |
| the emphasis ratio, chosen by eye from two builds | `EMPHASIS_SIZE_RATIO` in `core/src/typography.ts` |
| the template style pass, done by hand in After Effects | `templates/library.aep` and its audit |
| the framing ruling | `modes/k2-syndicalia.json`'s `imageVariation.note` |
| approval of the eight regenerated `test-1` images | `docs/DECISION-image-config.md` |
