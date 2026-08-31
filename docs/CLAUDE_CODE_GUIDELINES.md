# Framopia Studio — Claude Code Guidelines

Version: 1.0. Binding for every Claude Code session. Restated in short form in every prompt; this file is the full reference and lives in the repo.

## 1. No AI fingerprints (hard requirement)

The repository must read as the work of a competent human developer. Concretely:

**Commits**
- Never add "Generated with Claude Code", "Co-Authored-By: Claude", or any AI attribution, tool banner, or link in commit messages, PRs, or anywhere else. If the tooling injects a trailer, remove it before committing (configure it off; verify with `git log` before pushing).
- Conventional-commit style: `feat: …`, `fix: …`, `chore: …`, `docs: …`, `refactor: …`, `test: …`. Lowercase after the colon, imperative, ≤72-char subject, body only when it adds information.
- Small, coherent commits — one logical change each. No "WIP", no mega-commits, no commit that mixes formatting with logic.

**Code & comments**
- Comments only where a human would write one: non-obvious decisions, gotchas, protocol quirks (ES3! CEP! alpha interpretation!). Never narrate the obvious ("// loop over the words"), never leave "Here we…" / "As an AI…" / "Note that…" filler, never over-doc-comment trivial functions.
- No decorative section banners, no emoji in code or docs, no TODO litter (a TODO must carry a reason and land in the session report too).
- Naming and structure follow the surrounding code; consistency over personal style.

**A comment must not break the file it documents**
- Before writing a comment, know what the file's syntax forbids inside one. In **XML, `--` is illegal anywhere inside a comment** — name flags without their leading hyphens (`enable-nodejs`), or put the explanation outside the comment entirely.
- This is not pedantry. A comment above `<CEFCommandLine>` explaining `--enable-nodejs` and `--mixed-context` made `panel/CSXS/manifest.xml` unparseable; After Effects dropped the extension, it vanished from the Extensions menu, and the only evidence was `XPATH Double hyphen within comment` in a CEP log. Every test in the repo passed. `npm run validate:panel` now parses the manifest so it cannot happen twice.

**Docs**
- README.md: short, plain, factual. Setup, commands, structure. No marketing tone, no badges wall, no emoji headers.
- All repo docs in the same sober voice as `docs/`.

## 2. Stack conventions

- **TypeScript (panel + service):** strict mode on; ESLint + Prettier configured once in Block 1 and never fought; no `any` except at genuinely untyped boundaries (annotated with a one-line reason); Node built-ins over dependencies where reasonable — every new dependency needs a reason in the session report.
- **ExtendScript:** ES3 only — no `const`/`let`/arrow functions/`JSON` global (ship a bundled json2 shim), `var` and prototypes; every AE-DOM mutation wrapped so failures return structured `{ok:false, stage, message}` JSON strings to the panel; no logic that could live in the service.
- **Python sidecar:** 3.11+, pinned `requirements.txt`, pure stdin-JSON → stdout-JSON per invocation, no prints outside the JSON contract (logs to stderr).
- **Secrets:** never committed, never logged. Keys live only in `.local/config.json` (gitignored); `config.example.json` documents the shape.

## 3. Testing expectations

- Unit tests for all pure logic: alignment merge, grouping, cleaning rules, placement solver, cache keys, manifest validation. Vitest (service/panel logic), pytest (sidecar).
- Fixture-based tests for pipeline stages (recorded API responses; no live API calls in tests).
- `npm run check` = typecheck + lint + all unit tests + template validation (once it exists). It must pass before every session's final commit; from Block 2 on it runs at session end and its result goes in the report. From Block 10, `npm run golden` joins it per BLOCKS.md.
- Live-API smoke scripts exist but are manual, cost-labeled, and never part of `check`.

### A conformance claim is written by the checker, never by hand

A `# reference-version:` header in `.local/ground-truth/*.txt` is a machine
assertion that the file passes the orthography conformance scorer clean
against that guide version. It is written **only** by
`npm run bench:verify-refs -- --write`, and only after a clean pass. Never
hand-edit it, and never bump it as part of "also updating the header" while
editing the text.

`npm run check` verifies every reference against its declared version and
fails the build on a mismatch. Do not remove that step to get a commit
through: correct the text and re-stamp.

The rule exists because `ground-truth` asserted `v1.0.7-conformant` for an
entire block while violating v1.0.7 — the header was bumped by hand in the
same session that was supposed to make it true, and nothing looked afterwards.
`test-3` then carried two standalone conjunctions past three separate
hand-written token lists, each of which disagreed with the other two.

The general form, which applies past this one file: **anything that asserts a
property is verified must be emitted by the thing that verifies it.** A claim
a human can type is a claim nobody checks. When a document states that a
checker enforces a rule, confirm the checker actually implements it — §2 of
the orthography guide said the scorer flagged a standalone `w` for a full
version before that was true.

### Never leave a test asserting retired behaviour

A test is a statement that something is true. When a rule changes, a test that
still asserts the old one is a false statement the build reports as passing, and
it is worse than no test: the next person reads it as the current contract and
reasons from it.

Rewrite or delete it in the same change that retires the rule. A test kept for
the record needs its name and its comment to say that is what it is.

Block 7 session 11 found four of them at once, after the entrance-compression
rule stopped splitting its budget evenly between intro and outro. One was named
"only the sum is ever compared" — a rule that had been true, was no longer, and
was still green.

### A rule shared by more than one tool is pinned by a test

The repo already does this for a constant mirrored between TypeScript and the
Python sidecar: a test reads both and fails when they drift. **The same applies
to a rule with more than one implementation**, which is easier to miss, because
the second copy is arithmetic rather than a named value.

Session 11 reconciled the reporting tools with the builder by pointing them at
`cardMinimumDurationS`, ran the figures, and found them still disagreeing:
`sweepTemplate` in `timing-budget.ts` held its own copy of how the budget splits
between intro and outro, which had been harmless while the split did not matter
and became a second source of truth the moment it did. Six possible homes of the
arithmetic were searched before the right one was found, and only because the
numbers still disagreed after the first fix.

If a rule cannot be reduced to one declaration, the test that pins the copies
together is the next best thing. A comment saying "keep this in sync" is not.

### A test environment more capable than the host proves nothing about the host

The panel runs inside After Effects, in **CEP 12's Chromium 99**. The headless
check runs whatever Chromium Playwright ships — roughly three years newer. Every
capability the test environment has and the host lacks is a way for a green
suite to certify something that cannot work.

It has happened twice, in two different shapes:

- **A stub supplied what the host does not.** The tests defined
  `globalThis.CSInterface` themselves; CEP never provides it, because no CEP
  library is loaded. `getSystemPath` was therefore never called, the extension
  path was the empty string, and the panel was broken in After Effects while
  the pickers and the logo were reported as fixed.
- **The test browser honoured what the host ignores.** A container-query layout
  passed at four widths in Playwright. Chromium 99 does not implement
  `container-type` — `getComputedStyle(el).containerType` is `undefined` in the
  running panel — so the whole `@container` block was dead text and the panel
  rendered one column at 1572 px with the breakpoint at 830.

The second is the worse kind, because CSS an engine does not recognise is
**dropped without a word**. Nothing throws, nothing logs, and the result looks
exactly like a layout bug.

So: **know the host's engine version, and gate against it explicitly.** The
version belongs in code, read off the machine rather than from documentation;
the features it lacks belong in a list asserted against the **built bundle**,
not the source, because the bundler sits between them. Do not assume the build
tool will catch it: esbuild at `--target=chrome99` passes a container query
through without a word.

### A stub asserts a claim about the real environment, and that claim needs evidence

A stub is not neutral scaffolding. Writing `window.CSInterface = …` in a test
asserts that the host provides `CSInterface`, and every assertion downstream
inherits that claim. **A stub shaped by what the code expects, rather than by
what the host actually provides, makes the test prove only that the code agrees
with itself.**

So: for each stub, know what real thing it stands in for and what establishes
the match — the host's own documentation, a working extension on the same
machine, or an observation from inside the host. Where nothing establishes it,
say so in the report rather than letting a green suite imply it.

Block 8 session 7 reported the reel picker, the mode picker and the logo as
fixed. The headless check defined `globalThis.CSInterface` itself, and CEP
never provides it — no library is loaded — so `getSystemPath` was never called,
the extension path was the empty string, and the panel was broken in After
Effects while every test passed. Session 8 found it and the claim was
retracted.

Two habits follow. Prefer a stub of something the *platform* guarantees over
something the *host* might inject — the panel now resolves its own location
from `window.location`, which the browser guarantees, rather than from a CEP
API that may be absent. And do not stub methods the code never calls: a stub
offering more than it is asked for suggests it models more than it does.

### A tool that can write to the plan is not a diagnostic

A diagnostic reads and reports; if it is wrong, a document is wrong and
someone re-runs it. A tool with a write path changes the artifact the rest of
the pipeline is built on, and if it is wrong it corrupts state that nothing
downstream will question. The two are not the same kind of thing and must not
be built to the same standard.

**Any tool carrying a write path resolves its inputs by the same declared
rules as production code, and is tested as production code.** Never by
`readdir` order, never by "the first one that looks right", never by a rule
invented in the file itself.

`repair-source-text-cli.ts` sat among the diagnostics and picked its
transcription cache entry the way the two beside it did — the first
`transcription-*` directory the listing returned. Unlike them it carried
`--apply`. On `vitasilk` that listing returns the prompt v1 entry, so Block 7
session 7 wrote nine `sourceText` values from a configuration the plan was not
built from, into a committed plan, and reported `343/343 correct` while doing
it. The other four reels were untouched only because their listings happened
to return the pinned entry first.

Two things follow. A tool is classified by its write path, not by where it
lives or what it is called. And a tool that reports a success count is
reporting against whatever it read: `343/343` was true of the draft it had,
which was the wrong draft.

### A tool names the inputs it selected, in the artifact and not only on stdout

This is the sibling of the rule above about verified properties: that one says
a claim must be emitted by the thing that checks it, this one says a figure
must carry what produced it. **Every tool that selects among several possible
inputs prints what it selected and writes it into whatever artifact it
produces.** An entry id, a version, a sha — enough that a reader a month later
can reproduce the figure or discover they cannot.

`docs/DEFECT-alignment-script-mismatch.md` carried its figures for an entire
block before anyone noticed they were drawn from three different transcription
cache entries. Nothing was fabricated and no arithmetic was wrong; the
document simply never said which configuration each number described, and by
the time the question was asked the answer had to be recovered by re-deriving
every figure against every entry on disk. One figure could not be attributed
at all and is still open.

Terminal output does not satisfy this. It scrolls away, it is not committed,
and the artifact outlives the session that produced it.

## 4. Session report (mandatory, every session)

### A defect report names the state it destroyed

When a defect corrupts or deletes state — cache entries, generated files, a
plan, a ledger line — the report records **what was lost**, not only that the
defect happened and was fixed. Name the entries, the files, the count.

The next session starts from the report. If it says "the fix is unverified"
but not "and two cache entries are gone", that session plans a verification
run it cannot afford and discovers the gap only by probing. Block 4 session 3
reported its eviction fix as unverified and did not record that two image
entries had been deleted; session 4's first instruction was therefore
unrunnable, and finding that out consumed the opening of the session.

The same applies to state a fix cannot restore. Say so explicitly: an entry
that will never come back is a permanent change to what the repo can
reproduce, and it belongs in **Failures & open problems**, not only in a
narrative of what went wrong.

File: `reports/block-N-session-M.md`, committed. Sections, in order:
1. **Done** — deliverables actually completed, with file paths.
2. **Deviations** — anything done differently than the prompt, and why.
3. **Failures & open problems** — honest, including flaky tests and untested paths.
4. **Repo state** — branch, HEAD subject line, `npm run check` result.
5. **Suggested next step** — one paragraph.

Never claim success for anything not actually run. If a command wasn't executed, say so.

## 5. CLAUDE.md is orientation, and has a size limit

`CLAUDE.md` is read at the start of **every** session, before any work, so its
size is a cost paid every time. It is not the project's memory — the documents
in `docs/` and the reports in `reports/` are. It is the map that gets a session
to them.

**It grew to 530,588 characters over 142 commits** — 10,009 lines added and 579
removed — because the instruction above this one used to read *"keep it current
in the same session as the change"* and named *active conventions* and *current
pipeline status* as its contents, with no boundary. Twenty-seven sessions each
added what they had learned and none removed anything. At three and a half times
the size at which the tool reads it whole it was being silently truncated, and
nobody could say which part survived. Block 10 session 28 moved all of it out,
verbatim; `reports/operating-memory-archive.md` and `git show 1c8c850:CLAUDE.md`
are what it held.

**`npm run check` runs `scripts/check-claude-md.mjs` and fails past
`CLAUDE_MD_MAX_CHARS` = 20,000**, naming the size and the limit. That figure is
**CHOSEN, NOT MEASURED**: roughly twice what the file needs, and far enough under
the tool's own 150,000-character warning that the warning can never fire again.
The 150,000 is recorded as the outer bound and not used as the limit, because it
comes from the warning text and could not be confirmed from the installed CLI.

**What belongs in it**, and nothing else:

- what the project is, in a paragraph;
- the repo map — one line per directory;
- the handful of commands an ordinary session runs, pointing at
  `docs/COMMANDS.md` for the rest;
- the standing rules that must never be violated, in their shortest form, with
  the full statement in this file;
- where the project stands, in a few lines, pointing at `reports/latest.md`;
- an index of `docs/` saying what each file holds.

**What does not, and where it goes instead:**

| what you learned | where it goes |
|---|---|
| what happened this session | `reports/block-N-session-M.md` — nowhere else |
| how the system works, and why | `docs/ARCHITECTURE.md` |
| something the user ruled | `docs/PROJECT_SPEC.md`, with the date |
| a rule about how to work here | this file |
| a command | `docs/COMMANDS.md` |
| a fact about the templates | `docs/TEMPLATE_LIBRARY_GUIDE.md` |
| something the machine must have | `docs/MACHINE_REQUIREMENTS.md` |
| a measurement | the results file or report that took it |

**A session updates `CLAUDE.md` only when the map changed** — a new directory, a
new document, a block finishing, a standing rule added or retired. Everything
else it learned goes in the document that owns it, and the session report
records that it went there. If nothing on that list moved, `CLAUDE.md` is left
alone, and that is the normal case.

It must never describe a state the repo isn't in.

## 6. Safety rails

- Work on `main` unless a prompt says otherwise (two trusted users, no PR ceremony) — but never force-push, never rewrite pushed history.
- Never delete user assets (footage, templates, mode files) — even when asked to "clean up".
- Anything touching billable APIs prints an estimated cost before running and records actuals to the cost ledger.


## 7. Working rules, moved here from CLAUDE.md

The sections below were written one session at a time in `CLAUDE.md`, which
grew to 530,588 characters — three and a half times the size at which it is
read whole. Block 10 session 28 moved them here **verbatim**, wording and
figures untouched, so that a session looking for how something works finds it
in the document it would already open. Nothing was summarised and nothing was
dropped; `git show 1c8c850:CLAUDE.md` is the file as it stood before the move.

Some of these restate a rule §1–§6 already carries; where they do, they are
the fuller statement with the measurement that produced it.

### A schema addition is optional with a default

**SCHEMA FRAGILITY RULE, standing.** `readEditPlan` validates on read, so a
required schema addition makes every previously written plan unopenable —
including for migration. Session 5 hit this and had to move a check out of
structural validation. Every schema addition is now **optional with a
default**, or ships with a migration path that does not read through the new
validator.


### A tool that can write to the plan is not a diagnostic

**Any tool carrying a write path resolves its inputs by the same declared rules
as production code, and is tested as production code.** A diagnostic that is
wrong makes a document wrong; a tool with `--apply` corrupts the artifact
everything downstream is built on. `repair-source-text-cli.ts` sat among the
diagnostics, picked its cache entry by `readdir` order like the two beside it,
and wrote nine `sourceText` values from the wrong draft into a committed plan
while reporting `343/343 correct`. A tool is classified by its write path, not
by where it lives. Full statement in `docs/CLAUDE_CODE_GUIDELINES.md` §3.

### A tool names the inputs it selected, in the artifact and not only on stdout

**Every tool that selects among several possible inputs prints what it selected
and writes it into whatever artifact it produces** — entry id, version, sha,
enough to reproduce the figure or discover you cannot. Terminal output does not
count: it scrolls away, it is not committed, and the artifact outlives the
session. `docs/DEFECT-alignment-script-mismatch.md` carried figures from three
different cache entries for a whole block because no artifact said which
produced which, and one of them is still unattributable. The sibling of §3's
rule that a verified property must be emitted by the thing that verifies it.

### Never leave a test asserting retired behaviour

Rewrite or delete it in the same change that retires the rule; a test kept for
the record says so in its name. Block 7 session 11 found four at once, one
named "only the sum is ever compared", green and false. Full statement in
`docs/CLAUDE_CODE_GUIDELINES.md` §3.

### A rule shared by more than one tool is pinned by a test

As a mirrored constant already is. Session 11's first reconciliation of the
reporting tools with the builder was insufficient because `sweepTemplate` held
a second copy of how the entrance budget splits — arithmetic rather than a
named value, which is why it was missed. A comment saying "keep in sync" is
not a pin.

### ExtendScript's reserved words are Java's, and every .jsx is parsed

**`short` and `long` are reserved in ExtendScript** — so are `class`, `char`,
`int`, `byte`, `float`, `double`, `boolean`, `final`, `enum`, `export`,
`import`, `synchronized`, `throws`, `transient`, `volatile`, `abstract`,
`native`, `goto`, `implements`, `interface`, `package`, `private`, `protected`,
`public`, `static` and `super`. They are rejected as identifiers, as property
names after a dot, and as unquoted object-literal keys.

`tools/ae/measure-fonts.jsx` was written with `{ short: …, long: … }` and
handed to the user. **It failed at the parse: not one statement ran, nothing was
measured, nothing was written.** A syntax error needs no After Effects to catch,
and nothing here was looking — `.jsx` is not TypeScript, eslint is pointed at
`src`, and no test opened these files.

**`npm run check` runs `scripts/check-extendscript.mjs` over every `.jsx` in the
repository**, and it is the gate that would have caught it. Three checks: Node's
own parser for structural errors, the reserved-word list above, and post-ES3
syntax (`const`, `let`, arrow functions, `class`, template literals, spread,
`async`/`await`, `for…of`). Comments and string literals are stripped first —
keeping newlines so line numbers stay true — so **any bare occurrence of a
reserved word is an error**, while a quoted key is legal and survives as a
string. The `/` ambiguity between a regex literal and division is resolved the
usual way, on what precedes it, and a test pins that the stripper does not lose
its place in a regex.

**It deliberately does not check runtime methods.** `JSON.stringify` is absent
from ExtendScript and present in every one of these files, because
`panel/jsx/json2.jsx` installs it; flagging that would be wrong about the only
thing the gate can see.

**All eight pre-existing `.jsx` files pass** — the six in `panel/jsx/`,
`tools/validate-templates/audit.jsx` and `json2.jsx`. Nothing in production was
found wanting; the only file that failed was the new one.

**A file delivered to the user is parsed first.** The gate is the mechanism, not
a reminder: `core/src/extendscript.test.ts` pins it, including that it catches
the exact two words that broke this one.

### A comment must not break the file it documents

**In XML, `--` is illegal anywhere inside a comment.** Name flags without their
leading hyphens, or keep the explanation outside the comment. A comment above
`<CEFCommandLine>` naming `--enable-nodejs` made the manifest unparseable and
After Effects dropped the extension with nothing on screen to say why.
`npm run validate:panel` parses it now. Full statement in
`docs/CLAUDE_CODE_GUIDELINES.md` §1.

### The review sheet writes every displayed row, or nothing

A downloaded reference carries **one entry per displayed row**, in display
order, an unmarked row written with `verdict: null` rather than omitted, plus
`rowCount` and `markedCount` **computed by the same walk that writes the
entries**. The download refuses loudly rather than write a partial file.

Marks are keyed by **word id**. They were keyed by `data-i`, the corrected-word
index, while the download walked positions `0..n-1`: on the main sheet every
corrected word is a row so the two coincide, but a re-review sheet holds only
the rows a change moved — indices `0,1,2,28…54` against positions `0..16` — so
a mark survived only where a row's index equalled its own position. **Seventeen
hand-made judgements went in and three came out.** Reference schema is **3**;
versions 1 and 2 stay readable, and `scoreAlignment` ignores a null verdict
rather than counting an unreviewed row as judged.

`localStorage` is keyed by variant, reel, sha **and a fingerprint of the row
set**, so one change's marks cannot be restored onto another change's rows. A
sheet with nothing under its own key migrates once from the pre-fix key, mapping
the old index keys onto word ids, and shows what it restored.

### A stub is a claim about the host, and needs evidence

Writing `window.CSInterface = …` in a test asserts the host provides it. CEP
does not — no library is loaded — and session 7's pickers-and-logo fix passed
its tests while the panel was broken in After Effects. Prefer stubbing what the
**platform** guarantees (`window.location`) over what the **host** might inject,
and never stub a method the code does not call. Full statement in
`docs/CLAUDE_CODE_GUIDELINES.md` §3.

### The gate counts the hand-made references, and says what it counted

**A hand-made reference is a file a person authored that nothing can
regenerate.** Six of them: four transcripts in `.local/ground-truth/*.txt` and
two alignment references in `benchmarks/references/align/`.
`core/src/references.ts` is the one declaration — `REFERENCE_FILES`, each entry
naming what reads it so a failure says what stops working.

**A README in a reference directory is documentation, not a reference**, and the
gate prints `REFERENCE_SET_DEFINITION` beside its count so the number cannot mean
two things in two reports again. It already had: Block 10 session 10 measured
"3 alignment references" by walking the directory, session 11 said "6" by
excluding the README, and session 12 found seven files against six references —
all true of different sets, none saying which.

**Before session 13 the gate could not see a lost reference.** A deleted
transcript failed `npm run check` only as an uncaught `ENOENT` from
`verify-references.ts`'s unguarded `readFileSync`; a deleted **alignment**
reference failed nothing at all, because nothing in the gate read those files.
`benchmarks/src/reference-set.ts` now checks every declared file is present,
readable and parses — an alignment reference through `parseAlignReference`, a
transcript for having text under its header — and names the file, the problem
and what reads it. The version check stays separate: **absent is a lost file,
non-conformant is a text to correct**, and a reader has to be able to tell them
apart.

**The declaration cannot fall behind the disk.** A hand-made file sitting in a
reference directory that `REFERENCE_FILES` does not declare fails the gate —
the same shape as `REPO_ANCHORS` pinned against `readdirSync`. Documentation is
excluded by name, never by extension; the tagged `.local/ground-truth/*.json`
are excluded because `npm run bench:tag` rebuilds them.

**Every failure has been watched, and no real reference was touched to watch
it.** `FRAMOPIA_REFERENCE_ROOT` re-roots the declared set onto a scratch tree
(`referenceFilesRootedAt`), so an absence is simulated by never creating a file
rather than by removing one. Six absences, an unreadable file, three
unparseable shapes and an undeclared file were each exercised; all exit 1 and
name the path.

### CEP runs Chromium 99, and the bundle is gated against it

**CEP 12, in After Effects 2026, runs Chromium 99.0.4844.84** — read off the
machine twice: the running `CEPHtmlEngine` process carries
`--user-agent-product=Chrome/99.0.4844.84`, and the bundled
`Chromium Embedded Framework.framework` declares `99.2.15.0`. That is roughly
three years behind the Chromium Playwright ships, so **the headless check is
more capable than production** and has certified something CEP could not do.

`core/src/cep-capabilities.ts` holds the version and the features it lacks;
`panel/src/capabilities.test.ts` asserts them against **`panel/dist`**, not
`panel/src`, because the bundler sits between the two. **The build cannot be
the gate**: esbuild at `--target=chrome99` passes a container query through
without a word. Comments are stripped before scanning, so a note explaining why
a feature was removed does not trip it.

Not available in Chromium 99, and on the denylist: CSS container queries
(`@container`, `container-type`, `container-name`, Chrome 105), `:has()` (105),
`@scope` (118), `color-mix()` (111), `text-wrap: balance` (114),
`Object.groupBy` (117), `Array.fromAsync` (121), `toSorted`/`toReversed`/
`toSpliced` (110), `AbortSignal.timeout` (103), `URL.canParse` (120).
**Available and used**: `ResizeObserver` (64), `AbortController` (66), grid and
flex `gap` (84), `overflow-wrap: anywhere` (80), custom properties (49).

### Sessions drive After Effects, and here is the whole of what that permits

**User ruling, 2026-08-29 (Block 9 session 5).** He does not want to run things
by hand. A session drives After Effects itself, through **AppleScript
`DoScript` into the already-running instance** — the project's established
mechanism, `service/src/build/drive.ts`.

Everything else is forbidden, and each prohibition is a thing that has gone
wrong or would:

- **Never launch it.** Not running is a `Status: PROBLEM` and the session stops.
- **Never quit it**, never close its project, never close a panel.
- **Never `aerender`, never a resident `-r` process.** A `-r` process was
  observed executing its body a session later and quitting the application on
  the user; `handoffs/block-8.md` §9 item 8 is the record.
- **Never save the user's project.** A script that adds a temporary comp leaves
  the project **marked modified** — the flag is read-only from a script and
  cannot be cleared. Leave it. Say so and let him close without saving.
- **Never modify `templates/library.aep`**, and never open it for writing.

**`DoScript` returns a status, not the script's value.** `DoScript "2+2"` gives
`0`, not `4`; `0` is success and `1` is failure. So a driven script writes its
result to a file and the caller reads that, which is why `runJsx` does.

**It is synchronous**: `$.sleep(4000)` inside made the `osascript` call take
4.87 s, measured. **But it can be blocked**: the first calls this session
returned `1` and did nothing at all, for minutes, then began working with
nothing changed on this side. Cause unknown — most likely the application was
busy or something modal was up. **A `DoScript` that returns `1` did nothing;
retry rather than concluding anything about the script.**

**A script a session drives must not open a dialog.** `DoScript` is synchronous,
so a modal `alert()` blocks After Effects until someone walks to the machine.
`measure-fonts.jsx` takes a `quiet` argument and a session sets
`framopiaDriven` before evaluating the file, so a person running it from
File > Scripts still gets their message box.

### Never import a project into itself

Block 9 session 10 imported `templates/library.aep` while that same file was the
open project. **After Effects does it without complaint**: the result was a
project holding two of every comp, dirty, and both the audit and the build then
correctly refused it — which cost a session. The file on disk was never in
danger and nothing said so at the time.

`panel/jsx/library-guard.jsx` is the one check, loaded by both drivers, called
by `build-reel.jsx`, `build.jsx`, `measure-survey.jsx` and `audit.jsx` **before**
they open anything. It compares `fsName`, After Effects' own absolute path, so a
relative path or a symlink cannot slip past; a project with no file is let
through, because a never-saved project cannot be the file being imported.
Demonstrated firing, and pinned by reading the sources the way the unsaved-work
refusal is.

### An empty untitled project holds no work

`build-reel.jsx` refuses to replace a project with unsaved changes, and **any
script that adds a temporary comp and removes it leaves the project modified** —
the flag is read-only from a script and cannot be put back. Session 6's own font
measurement put the user's empty project in that state and then could not build
into it.

So a project that is **dirty, has never been written to disk, and has
`numItems === 0`** is proceeded past. This is not the "unreadable dirty counts
as dirty" case: `numItems` is read, and an unreadable count is `-1`, which the
condition cannot satisfy. One item, or a file on disk, keeps the refusal.
`core/src/audit-safety.test.ts` pins it.

### No script the host evaluates may discard unsaved work

Session 22 fixed this in the audit. **Three more scripts had it and nobody had
looked**: `panel/jsx/build.jsx`, `panel/jsx/build-reel.jsx` and
`panel/jsx/measure-survey.jsx` each called
`app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES)` before starting their own
project. All three refuse now, with the same sentence and the same rule — an
unreadable `dirty` counts as dirty, because refusing costs a re-run and guessing
costs the user's work. Pinned for all three by
`core/src/audit-safety.test.ts`.

**This is why `vitasilk` was not rebuilt in session 23**: building drives the
user's open instance, and until he has run the guarded build himself nothing in
this project has been heard.

### The audit never closes a project it did not open

`tools/validate-templates/audit.jsx` called
`app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES)` unconditionally — it
destroyed unsaved work in whatever the user had open, and it cost Block 8
session 21 its second half, because taking the measurement would have thrown his
project away. **A diagnostic that mutates the host is the same class of mistake
as a diagnostic that writes to the plan.**

`refuseIfUnsafe` runs before anything opens: a project with unsaved changes is a
**refusal with a sentence**, not a prompt. An unreadable `dirty` is treated as
dirty — refusing costs a re-run, guessing costs the user's work. A *saved*
project that is not the library is closed, and the fact is announced in the
output rather than done silently.

**The CLI had the same defect one layer up**: it wrote whatever the script
returned into `library.audit.json`, so a refusal would have replaced a working
measurement with an error message. It now throws and leaves the file untouched.

### A remedy sentence is verified by running it, or it is a guess

Three in a row were wrong this session, each found only by doing it:

- **`npm run service` exits 1 while a service is running.** The lock is live and
  `service.ts` refuses rather than taking over. The old banner told the user to
  run exactly that, in the one situation where it cannot work.
- **`npm run service -- --force` did not forward `--force`.** The root script
  ended `npm run service --workspace framopia-service`, so npm attached the
  caller's arguments to the *inner npm invocation* instead of to node, and the
  service still printed "pass --force to take it over". The root script ends
  with `--` now.
- **`--force` takes the lock but does not stop the old process.** Two services
  then run, and stopping the old one **deleted the live one's handshake** —
  `clearHandshake` removed the file unconditionally. It takes an optional pid
  and leaves a handshake naming another process alone.

`REBUILD_COMMAND` is declared once beside the rule, so the sentence on screen
and the sentence in the tests cannot drift.

### A count names its scope, or it is the wrong number

The transcript editor's three ruling counts read **1, 5 and 0** on `vitasilk`
while session 18's report said **7, 23 and 13**. Both were right — one per reel,
one over the corpus — and nothing on the button or in the report said which. The
user could not rule on any of them, correctly.

Per reel, and pinned by a test for all five reels:

| reel | overlong | clipped | split terms |
|---|---:|---:|---:|
| ground-truth | 2 | 8 | 2 |
| test-1 | 0 | 5 | 6 |
| test-2 | 1 | 3 | 1 |
| test-3 | 3 | 2 | 4 |
| vitasilk | 1 | 5 | 0 |
| **corpus** | **7** | **23** | **13** |

**`vitasilk`'s zero is real, not a broken detector.** All 73 of its words are
`script: latin` — the correction pass transliterates Darija to Arabizi — so no
Arabic run exists to be split. The Arabic on that reel is in `sourceText`, which
is the raw Scribe draft and never gets built. 39 of its words have an Arabic
`sourceText` and none has an Arabic `text`.

**The clipped breakdown recorded in `handoffs/block-8-part-1.md` is 9/7/4/3/5 =
28 and is pre-migration.** Block 8 session 14's alignment migration took the
corpus from 28 to 23; the per-reel figures today are 8/5/3/2/5. `vitasilk` is 5
either way, which is why the screen and the old record agreed by accident.

Both scopes are now on the button, and **a proxy says it is one**: the overlong
count is a character count at `OVERLONG_WORD_CHARS = 11` standing in for
`sourceRectAtTime` in After Effects.
