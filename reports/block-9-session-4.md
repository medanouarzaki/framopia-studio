Status: OK

# Block 9 session 4 — the script was never parsed before it was handed over

**Spent $0.00. No API was called.** No transcription, correction, analysis or
image generation ran. **After Effects was not contacted**: no `osascript`, no
`DoScript`, no `aerender`, nothing launched and nothing quit.

## 1. Stop conditions

| | |
|---|---|
| mount | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`, `git rev-parse --show-toplevel` agrees |
| ledger at start | **108 lines**, `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, same sha256 — byte-identical |
| cache at start | **36 entries** — 11 transcription, 7 analysis, 4 imageslots, 14 images |
| cache at end | **36 entries, census identical** (sha256 of each entry's file list) |
| After Effects | **1 instance, pid 79146, started Thu Aug 27 21:00:05** — the same process at both ends, untouched |
| `aerender` | **0 / 0** |

Nothing was stopped or started this session. The companion service (pid 23255,
port 59846) was left exactly as session 3 left it.

## 2. What line 61 was

```
 60:     var SAMPLES = {
 61:         latin: { short: 'glow', long: 'dernière génération' },
```

**Two offending tokens on that line, not one: `short` and `long`**, as unquoted
object-literal keys. Both are reserved in ExtendScript, whose word list is
Java's rather than JavaScript's.

**Line 61 was not the only one.** The parser stops at the first, so what it
reported was the first of **twelve occurrences across six lines**:

| line | token | how it was used |
|---:|---|---|
| 61 | `short` | unquoted object key |
| 61 | `long` | unquoted object key |
| 62 | `short` | unquoted object key |
| 62 | `long` | unquoted object key |
| 63 | `short` | unquoted object key |
| 63 | `long` | unquoted object key |
| 303 | `short` | property name after a dot — `sample.short` |
| 304 | `short` | property name after a dot |
| 305 | `short` | property name after a dot |
| 306 | `long` | property name after a dot — `sample.long` |
| 307 | `long` | property name after a dot |
| 308 | `long` | property name after a dot |

Fixing line 61 alone would have moved the failure to line 62, and fixing all
three of those would have moved it to 303. Both of the two spellings the
language forbids — as a key and after a dot — were present, which is why the
sweep was worth more than the fix.

**No other reserved word appears anywhere in the file.** The sweep covered the
full list — `abstract`, `boolean`, `byte`, `char`, `class`, `double`, `enum`,
`export`, `extends`, `final`, `float`, `goto`, `implements`, `import`, `int`,
`interface`, `long`, `native`, `package`, `private`, `protected`, `public`,
`short`, `static`, `super`, `synchronized`, `throws`, `transient`, `volatile` —
and found only `short` and `long`.

**Why it reached him.** Session 3 ran an ES3 scan over the file for `const`,
`let`, arrow functions and `forEach`, and reported it clean. That scan did not
know about ExtendScript's reserved words, and nothing else in the repository
opens a `.jsx` at all: they are not TypeScript, eslint is pointed at `src`, and
no test reads them. **A syntax error needs no After Effects to catch, and this
one had nothing looking for it.**

## 3. The gate

`scripts/check-extendscript.mjs`, run over every `.jsx` in the repository by
`npm run check`. **No new dependency**: Node's own parser plus a scanner.

Three checks, in the order a parser hits them:

1. **Syntax**, through `new Function(source)` — which compiles and does not
   execute, so nothing in an After Effects script runs. This catches structural
   errors. It is deliberately not the whole answer: Node accepts far more than
   ExtendScript, which is exactly how the reserved words got past.
2. **The reserved words.** Comments and string literals are stripped first —
   keeping newlines so line numbers stay true — so **any bare occurrence is an
   error**, while a quoted key is legal and survives as a string. That is what
   catches all three illegal positions at once: identifier, after a dot, and
   unquoted key.
3. **Post-ES3 syntax**: `const`, `let`, arrow functions, `class`, template
   literals, spread, `async`/`await`, `for…of`.

It deliberately does **not** check runtime methods. `JSON.stringify` is absent
from ExtendScript and present in every one of these files because
`panel/jsx/json2.jsx` installs it; a gate that flagged that would be wrong about
the only thing it can see. The report says so rather than the gate guessing.

### 3.1 It fails on the file as delivered

Run against the broken file, before any fix:

```
tools/ae/measure-fonts.jsx:61: reserved word: "short" is reserved in ExtendScript and cannot be an identifier, a property name after a dot, or an unquoted object key
tools/ae/measure-fonts.jsx:61: reserved word: "long" is reserved in ExtendScript and cannot be an identifier, a property name after a dot, or an unquoted object key
tools/ae/measure-fonts.jsx:62: reserved word: "short" …
tools/ae/measure-fonts.jsx:62: reserved word: "long" …
tools/ae/measure-fonts.jsx:63: reserved word: "short" …
tools/ae/measure-fonts.jsx:63: reserved word: "long" …
tools/ae/measure-fonts.jsx:303: reserved word: "short" …
tools/ae/measure-fonts.jsx:304: reserved word: "short" …
tools/ae/measure-fonts.jsx:305: reserved word: "short" …
tools/ae/measure-fonts.jsx:306: reserved word: "long" …
tools/ae/measure-fonts.jsx:307: reserved word: "long" …
tools/ae/measure-fonts.jsx:308: reserved word: "long" …
extendscript: 1 of 1 file(s) would not parse
exit=1
```

It names line 61 and the eleven behind it. **A gate that has never failed is not
a gate**, so that run is the evidence, and it is reproducible: check out
`c7e835c` and run it.

### 3.2 It passes after the fix

```
extendscript: 9 .jsx file(s) ok
exit=0
```

### 3.3 What it found in the production ExtendScript

**Nothing.** All eight pre-existing files pass with no findings:

```
panel/jsx/audio-start-probe.jsx
panel/jsx/build-reel.jsx
panel/jsx/build.jsx
panel/jsx/image-probe.jsx
panel/jsx/json2.jsx
panel/jsx/measure-survey.jsx
panel/jsx/text-fit.jsx
tools/validate-templates/audit.jsx
```

The only file that failed was the one added last session. Nothing in a
production build path needs changing, so nothing in one was changed.

### 3.4 The gate is pinned

`core/src/extendscript.test.ts`, nine tests — in `core` for the same reason
`audit-safety.test.ts` reads `panel/jsx/` from there: it is where repo-wide
rules are pinned. It asserts that the gate catches the exact two words that
broke this file, catches one after a dot, reports the right line, **allows** a
reserved word as a quoted key and inside a string or comment, catches non-ES3
syntax, catches a structural error the word scan would miss, does not lose its
place in a regex literal, that every `.jsx` in the repository passes, and that
the command line exits non-zero on a broken file and zero on a fixed one.

The regex case is not decoration: a regex literal contains characters that look
like a string opening, and a stripper that got it wrong would go blind for the
rest of the file. `/` is resolved the usual way, on what precedes it.

## 4. Done

- **`scripts/check-extendscript.mjs`** — the gate.
- **`scripts/check.sh`** — runs it, before the template audit.
- **`core/src/extendscript.test.ts`** — nine tests pinning it.
- **`tools/ae/measure-fonts.jsx`** — fixed. `short` and `long` are `oneWord` and
  `phrase`, as keys and at every use; the result fields are `oneWordText`,
  `oneWordAdvance`, `oneWordRect`, `phraseText`, `phraseAdvance`, `phraseRect`.
  A comment at the declaration says why, because the obvious names are the wrong
  ones and the next person will reach for them.
- **`CLAUDE.md`** — the reserved words, the gate, what it covers and what it
  deliberately does not.

### The rest of the script, checked

Swept again against ES3 and the guidelines: no `const`, no `let`, no arrow
functions, no template literals, no `Array.forEach`, no `Array.map`, no
`String.trim`, no `Object.keys`, no `JSON.parse`. `var` and prototypes only.
`JSON.stringify` is used and is correct — `json2.jsx` is `$.evalFile`-d at the
top before anything needs it. The one thing my crude sweep flagged,
`.indexOf(` at line 211, is `String.prototype.indexOf`, which is ES1 and has
always been in ExtendScript; it is a false positive and no change was made.

One small correction while in the file: `framopiaMeasureAt` measured the same
two strings three times each. Each call sets the text and re-measures the layer,
so that was twelve redundant round trips through After Effects per run. Measured
once each now.

**The contract is unchanged and still holds**: a temporary comp in the current
project, measured, removed; **never saved**; every failure returns
`{ ok: false, stage, message }` and writes it; one message box; the result at
`.local/build/font-measurements.json`. All three questions are unchanged — the
font strings AE accepts and whether they round-trip, what an unresolvable name
becomes, and cap height, x-height proxy and advance width at 343 and 425 on a
one-word and a phrase sample per script.

**No ratio was written into the code.** `EMPHASIS_SIZE_RATIO` is still 1.0 and
`ARABIC_SIZE_RATIO` still 1.07.

## 5. Deviations

- **The gate lives in `scripts/` and its test in `core/`.** `scripts/` has no
  workspace of its own, and the rule is repo-wide rather than one workspace's,
  so `npm run check` runs the CLI and core's suite pins the logic. That split
  follows `audit-safety.test.ts`, which already reads `panel/jsx/` from core.
- **`extends` is in the reserved list** although the brief's list did not name
  it. It is reserved in ExtendScript for the same reason the rest are, and
  leaving it out would have been a gap the next file could fall into.

## 6. Failures and open problems

- **The script has still never been executed in After Effects.** It parses. That
  is all this session can claim, and it is a much weaker claim than "it works":
  it does not say `app.fonts` exists on his host, that `TextDocument.font`
  accepts any of the strings tried, that `sourceRectAtTime` returns what is
  expected, or that the temporary comp is removed cleanly. Every one of those is
  only answerable by him running it.
- **The gate would not have caught a runtime error**, only a parse error. A
  script that parses and then throws at `app.fonts` on line 1 of its work looks
  identical to this gate. What it now guarantees is that a delivered file gets
  as far as running.
- **`new Function` is not ExtendScript's parser.** It is Node's, and it accepts
  a superset. The reserved-word and ES3 scans cover the known gap between them;
  a construct ExtendScript rejects for some third reason would still get
  through.
- **The scanner is a scanner, not a parser.** It strips strings and comments and
  then matches words. A pathological file could confuse the `/` heuristic — a
  regex immediately after a value where division was meant, or the reverse — and
  the test pins the case that actually occurs in this repo rather than proving
  the heuristic in general.
- Nothing was lost. No cache entry, plan, reference or ledger line changed, and
  no production ExtendScript was touched.

## 7. Repo state

- Branch **`main`**, three commits ahead of `c7e835c`, nothing force-pushed.
- HEAD: **`80221ec docs: record the reserved words and the jsx gate`**.
- Working tree clean apart from this report.
- **`npm run check`: PASS**, measured from this session's final run:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 35 | **508** |
| `framopia-service` | 87 | **1113** |
| `framopia-benchmarks` | 16 | **166** |
| `framopia-panel` | 6 | **159 passed, 2 skipped (161)** |
| `tools/cv` pytest | — | **149 passed in 7.61 s** |

Tail of that run:

```
> @framopia/core@0.1.0 validate:modes
mode k2-syndicalia v8: ok (fonts set)
templates: 6 entries, ok
extendscript: 9 .jsx file(s) ok
validate-templates: 6 template(s) ok, audited against library.aep
validate:panel: panel/CSXS/manifest.xml ok

> framopia-benchmarks@0.1.0 verify-refs
  ok    ground-truth   v1.0.8-conformant
  ok    test-1         v1.0.8-conformant
  ok    test-2         v1.0.8-conformant
  ok    test-3         v1.0.8-conformant
references: PASS
149 passed in 7.61s
models: birefnet-general ok
models: selfie-multiclass-256x256 ok
check: PASS
```

## 8. What you do now

Nothing about the panel changed, so leave it as it is.

**Run the font script again — it will get further this time.**

1. In After Effects: **File → Scripts → Run Script File…**
2. Choose
   **`/Volumes/T7 Shield/INSEA/Projects/framopia-studio/tools/ae/measure-fonts.jsx`**
3. You should see **one message box**, either saying it is done and naming the
   file it wrote, or naming the step it failed at. Either way it writes
   **`/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/build/font-measurements.json`**
   — send me that file whichever happens.
4. **Do not save the project afterwards.** It adds a composition called
   `framopia_font_probe` and removes it again, but After Effects still marks the
   project as modified. Undo once if you like, or close without saving.

**Last time it died before doing anything.** This time it will at least start:
the file parses, proven by a check that fails on the old version and passes on
this one. Whether After Effects can answer the three questions is what running
it finds out — if it stops, the message box names the step and the file holds
the reason.

## 9. Suggested next step

Read `font-measurements.json` and act on all three answers together: set
`EMPHASIS_SIZE_RATIO` from the measured cap heights and advance widths and
re-check `ARABIC_SIZE_RATIO` against Cormorant rather than Inter; record the
name form After Effects accepts beside the family-and-style strings in
`modes/k2-syndicalia.json`; and, only if the unresolvable-name result shows a
bad name substituting silently, add the check that must run before a build
places a card. That last one decides whether setting font and colour on the
placeholder text layer is safe, which is the four-file change session 3 §4.2
scoped and the last thing between K2's recorded identity and a comp that shows
it.
