# Block 10 session 53 — a client's own pictures, chosen by a word

**Status: OK.**

## How a picture gets chosen

Beside each picture a client gives us, he can write a **label** — a few words,
whatever they are: a product name, a device, a place. When the tool plans a
reel's pictures, it looks at the words actually spoken in the moment each
picture illustrates, and **if one of those words is on a label, that picture is
used and nothing is generated for that slot**. The word has to be the word:
`Botox` matches `Botox,` and `BOTOX`, and it does not match `Botoxes`, `Bot` or
`بوتوكس`. Anything less generates, exactly as it does today. A picture with no
label is still there in the picture editor to be chosen by hand, and a client
with no pictures behaves as though none of this existed.

## What it would have saved

Nobody has labelled a picture yet, so on the reels that already exist it has so
far saved nothing. What it *would* save is measured, not estimated: the matcher
was run over all five reels' real plans with a label list made of the Latin
product names those reels actually speak — `Botox Sculptra Radiesse Skinbooster
polynucleotides Regenera Vita Silk AquaDerm`.

| reel | slots | would fill | what that slot cost | which word |
|---|---:|---:|---:|---|
| sora, 13.5 s | 4 | **3** | **$0.9072** | `Botox`, `Skinbooster`, `Regenera` |
| vitasilk | 5 | **2** | $0.0000 recorded | `Vita`, `Vita` |
| sora, 40.5 s | 11 | 0 | — | — |
| test-1 | 4 | 0 | — | — |
| ground-truth | 6 | 0 | — | — |

**Her thirteen-second reel is the case that justifies it: three of its four
pictures, $0.91 of the $1.23 it cost — 74% of that reel's picture bill.**
`vitasilk`'s two read $0.00 because its candidates were generated before the
ledger recorded a per-candidate cost; at today's rate those two slots are $0.61.
The other three reels fill nothing, and that is the honest shape of the feature:
**it saves money exactly where the client names a thing he owns**, and nowhere
else. A slot costs about **$0.307** — two candidates at $0.1535 — so each label
that fires is worth that much, every time the reel is re-run.

## Done

### 1. What already existed

| what | where |
|---|---|
| schema | `core/src/mode.ts:289` `ClientPicture { id, path, description }` |
| validation | `core/src/mode.ts:818` — absolute path, unique id, non-empty description |
| helpers | `core/src/client-pictures.ts` — `clientPictures`, `clientPictureById`, `fitByLongEdge` |
| add / remove | `service/src/clients/create.ts:157` `addPicture`, ids `pic001` upward |
| routes | `service/src/server.ts` `POST`/`DELETE /clients/pictures` |
| offered in the editor | `service/src/image-view.ts:239`, `panel/src/Images.tsx:204` |
| chosen onto the plan | `service/src/image-view.ts:329`, plan field `chosenClientPictureId` |
| beats a candidate at build | `service/src/build/build-reel-cli.ts:115` |
| reported to a re-run | `service/src/editplan/merge.ts:66` |

**Where the files live: nowhere this tool owns.** Nothing is copied. The only
record is the entry in `modes/<client>.json`, and the bytes stay in the client's
own folder.

**Two clients' pictures cannot collide by path or by directory** — there is no
directory. **They could collide by id, and did.** Every client numbers from
`pic001`, and the build resolved an id against `flag('mode') ?? plan.clientMode?.id`,
so `--mode another-client` would have shown another client's photograph under
this reel's id. Closed this session.

### 2. The two tests that hold the never-sent rule — untouched, still passing

`service/src/clients/pictures.test.ts` (7 tests):

- *"is not read by anything that can call the image model"* — reads every
  non-test `.ts` in `service/src/images/` and fails if one contains
  `clientPictures`, `chosenClientPictureId` or `client-pictures`.
- *"is not copied anywhere: the module that owns it writes nothing"* — reads
  `core/src/client-pictures.ts` with comments stripped and fails on `copyFile`,
  `writeFile`, `node:fs`, `cacheEntryDir` or `.local`.

`core/src/outgoing-text.test.ts` guards the same rule where a path could
actually leave, and `generate.test.ts` proves the request is refused.

**Neither is weakened by anything here.** `git diff` over both is empty, both
pass, and the design is built around them: the image stage still cannot name a
client's pictures, so it asks the general question `slotNeedsGenerating` and is
told yes or no without being told why.

### 3. Session 43's two findings

- **A chosen client picture was not checked by pre-flight** — confirmed still
  true, and **fixed**. `build-reel-cli.ts` built its ref list from
  `slot.candidates[0]` and `continue`d past a slot that had none, which is
  every slot a client's picture fills. Proved by moving a picture file aside and
  rebuilding: `MissingBuildInputsError: 1 file(s) the plan references are not on
  disk … image (the client's own) img001`, exit 1, before After Effects. The
  file was moved back.
- **Client photographs are not in the backup set** — confirmed still true, and
  **not fixed**: no group in `BACKUP_GROUPS` sweeps a still outside `cutouts/`.
  Left as it was, because whether a client's originals belong in a backup he may
  already keep elsewhere is his decision, not this session's.

### 4. The match, and where it happens

**A new optional `label` on a picture**, separate from `description` on purpose:
a description is prose for telling two pictures apart in a list — *"the clinic
exterior"* — and matching on it would fire on *the* and *exterior*. A label is a
deliberate list, written as free text and split on anything that is not a letter
or a digit, so `Skin Booster`, `Botox, Sculptra` and `Botox/Sculptra` all read as
words. An empty label is refused by the validator: absent is how a picture says
it is chosen by hand.

**Across scripts, through `normalizeToken`** — the rule this project already
uses to decide whether two words are the same word. Normalised: edge
punctuation, in both scripts, and Latin case. **Deliberately not normalised:**
Arabic letter forms and diacritics are not folded (`العياده` does not match
`العيادة`), Latin and Arabic are never transliterated into each other, and there
is no stemming, no plural, no synonym, no edit distance and no model. Each is a
test that would pass if the rule were loosened.

**Where it runs: when slots are planned** — `analysis/client-picture-slots.ts`,
called from the analysis job. That is the last free moment before money can
move. Deciding at build time would mean paying for a square and then not using
it; deciding inside `service/src/images/` would mean that directory reading a
client's photographs, which it must never be able to do.

**A slot filled this way is never generated.** `editplan/slot-fill.ts`'s
`slotNeedsGenerating` is the one declaration, read by the image stage and by the
cost screen. It also closes an existing money defect: a picture chosen **by
hand** in the editor was generated anyway, because the image stage was handed
every slot on the plan.

**Two pictures that both match**: there is no honest way to prefer one picture a
client labelled over another he labelled for the same word, so none is invented.
The **first in his own list** wins — the order he added them, the only order he
can see — and the plan records `chosenClientPictureWord`, so the comp can say
why the photograph is there rather than looking like a decision nobody made.
The naming word is tried before the rest of the span, because it is the one word
the model says the picture is about.

**A choice a person made is never revised**: a slot that already names a picture,
or whose candidate was chosen by hand, is left exactly as it is.

### 5. General, not fitted

Nothing is keyed to a client's name, language or domain: there is no word list,
no medical case, no Arabic-only or Latin-only path. The matcher takes pictures
and words and compares them. It was exercised on:

| client | pictures | what it proves |
|---|---|---|
| `a-client-with-its-own-pictures-test` | **50**, one label matching | the picture is used and the slot is not bought |
| `a-second-client-for-the-new-video-test` | 2, labels that never fire | generates exactly as before |
| `a-client-with-no-pictures-test` | **none** | generates exactly as before |
| `a-scratch-client-for-session-53` | 4, three labelled | reaches a built comp |

**Both scratch clients label a picture with the same word `Zephyrine`, and both
number from `pic001`** — so a rule that resolved an id without knowing whose it
was would land on the wrong file. The reel made for the picture client resolves
`pic007`, and it is asserted by id.

**No request left the machine, by construction and by count.** Every billable
call is a substitute passed in as an argument, and on top of that
`globalThis.fetch` is replaced by a recorder that throws. **Attempts recorded: 0**,
asserted at the end of every one of the five runs and again in the scratch build.
The real ledger is byte-identical at both ends.

### 6. A client's picture in a built comp

A scratch client with four pictures — one 3000x1000, one 1000x3000, one 200x200
and one unlabelled — and a twelve-second throwaway reel, taken through the whole
pipeline with every billable call stubbed, then built for real in After Effects.

```
slots: img001 uses the client's own picture pic001 — its label holds the spoken word "Zephyrine"
slots: img002 uses the client's own picture pic003 — its label holds the spoken word "Tiny"
images: 2 slot(s) are already filled and are not generated
0 slots x 2 candidates = 0 images
estimated cost: $0.0000
```

**Read out of the comp itself**, not out of the build's own log: the two image
comps' layers name `/private/tmp/framopia-s53-…/wide.png` and `small.png` — the
client's own files at the client's own paths. `tall.png` (label never spoken)
and `plain.png` (no label) are absent, and so is any generated square.

Every rule a generated picture obeys, measured:

| rule | img001 | img002 |
|---|---|---|
| arrives at the word that names it | in **3.2000 s**, `Zephyrine` starts 3.2000 | in **9.4000 s**, `Tiny` starts 9.4000 |
| no gap to the next picture | hand-over gap **0.00e+0** | last picture |
| sized to its own corner | **837 px** | **897 px** |
| clear of the speaker at every frame | the build checks frame by frame and exits 1 otherwise; it exited **0** | same |
| stretch, and inside the reel | 100, ends 9.4000 s of 12.012 | 100, ends 11.2000 s |
| pre-flight | `6 referenced files all present` | included |

**Its shape and size are the client's.** A picture is fitted by its **long
edge**, so the whole of it lands inside the box whatever its shape and nothing
is cropped — cropping a photograph a client chose is the tool deciding which
half of it matters. Measured in this build: the **wide** 3000x1000 scales to
33.33% and draws **1000x333** inside the 1000 px solid; the **small** 200x200
scales to **500%** and draws 1000x1000. So **a picture too small for its corner
is scaled up — not left small, not refused.** That is what the build does, and a
200 px picture blown to 1000 px will be soft; it is listed as an open problem
rather than changed, because the size rule is not this session's to touch.

**No cut-out is made from a client's picture.** Cutouts are produced in the image
stage from generated candidates, and that stage never sees these files. So it is
placed as a **card**: the whole picture on the card, with the frame colour
derived from the picture's own edge luminance exactly as for a generated one —
`the picture's own edge measures 0.0874 -> frame light at 7.08:1`.

**The file stayed where the client put it.** The comp references the original
path; nothing was copied into `.local/cache/`, and both never-sent tests pass.

## Deviations

**One thing beyond the brief's list was extracted rather than added.** The
resolution of a picture id lived only in `build-reel-cli.ts`, and the first end
-to-end run failed on `image img002: no candidate file on disk` because
`new-video.test.ts` had its own copy of the rule that knew nothing about client
pictures. Two copies of one rule is what lost four of five images in session 4,
so it became one module, `build/client-picture.ts`, used by the build, by
pre-flight and by the test. The failure is what found it.

Nothing else. **$0.00 spent**, ledger unmoved.

## Failures & open problems

- **A picture too small for its corner is scaled up without limit** — a 200x200
  file drew at 500%. Nothing refuses it and nothing warns. Measured, reported,
  not changed.
- **Client photographs are still not in the backup set** — session 27's finding,
  unchanged and deliberately so.
- **A label matches a whole word only.** A two-word product name is written as
  its two words and either fires, so a label word that is also an ordinary word
  will fire often. That is the strict rule behaving as chosen; the report says
  it so the widening, if it ever happens, happens on evidence.
- **Nothing in the panel writes a label yet.** A label can only be put on a
  client by editing the JSON, which is the next session's work.
- **`npm run check` is about four minutes slower**: two more shapes in
  `new-video.test.ts`, each a real pipeline run on a video that has never
  existed.
- Everything else open at session 52 is untouched and still open.

## Repo state

- `npm run golden` **PASS** — 4 of 4 reels field for field, **17,174 fields**
  (test-1 4415, test-2 4280, test-3 3709, vitasilk 4770). Reference
  `74436a960706fecd`, **not re-recorded**. No client has a labelled picture, and
  nothing moved.
- `npm run check` **PASS, exit 0** — core **777**, service **1333**, benchmarks
  **173**, panel **220** with 2 skipped. Up 19 and 21 on session 52's 758 and
  1312: 19 in `client-picture-match.test.ts`, 9 in `client-picture-slots.test.ts`,
  6 in `client-picture.test.ts`, 5 in `reel-shape.test.ts`, 1 new shape each in
  `new-video.test.ts`. One earlier run failed on an unused import and is
  reported rather than hidden.
- **Ledger unmoved**: 165 lines, `786497a5f371d179…` at both ends.
- `templates/library.aep` `4b0cf05a8f5d4775…`, `modes/k2-syndicalia.json`
  `c600905c5e36ecbc…`, `modes/dr-loubna-kfafi.json` `f60749f5629b2ced…` — all
  byte-identical at both ends. **Neither real client was edited.**
- **`.local/quarantine-session51/` intact**, all three entries.
- Every scratch client, plan, picture, comp and cv directory this session made
  was moved to **`.local/quarantine-session53/`** — 11 entries, nothing deleted.
  Four stale plans left by earlier test runs went there too. `modes/` holds the
  two real clients and nothing else.
- Branch `main`, tree clean. Four commits: the match, the placement, the tests,
  and this report.

## Suggested next step

The panel: a label field beside each picture on the client screen, so a label
can be written without editing JSON. Everything under it is in place and tested,
and until that exists the feature is reachable only by hand.
