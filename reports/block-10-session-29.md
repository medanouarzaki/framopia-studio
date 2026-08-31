Status: OK

# Block 10 session 29 — Arabic in Arabic letters

**Spent $0.00. No API was called, nothing was transcribed, analysed or
generated.** Ledger **118 lines, `3f657131…`, byte-identical at both ends**.
`templates/library.aep` `d2bbb6b7…`, never opened. **The six hand-made
references are byte-identical at both ends** and none was rewritten. The cache
is unchanged — 46 entries, 80 files, 54,256 KB. After Effects one instance, 0
`aerender`, nothing saved. Free space **307 GiB**.

**`npm run check` PASS; `npm run golden` PASS, 4 of 4 reels, 17,174 fields.**

---

## The new rule

`docs/ORTHOGRAPHY_GUIDE.md` is **v2.0.0**, rewritten rather than appended to,
and it says one thing:

> **Arabic is written in Arabic letters. French and English are written as they
> are.**

`3ndk` → `عندك`. `sana` → `سنة`. `l7essass` → `الحصص`. `les cernes pigmentés`
stays Latin. `alors` and `la vidéo` stay Latin because they are French. There is
no judgement about whether a word is technical, medical or formal enough —
those were v1.0.x's questions and they are gone with it. The script of a word is
decided by the word, never by the words around it.

Everything already transcribed stays Arabizi, costs nothing, and re-bills
nothing. That was the thing most at risk and it is measured, not argued: §3.

## The hard cases, and what each was decided as

These are the ones the model will meet, and an ambiguity left here becomes an
inconsistency in every transcription.

**A French or English word carrying Arabic grammar.** *Each word keeps its own
script, and a one-letter Arabic proclitic cannot attach to Latin letters* —
a token may never mix scripts. So it stands alone, in Arabic letters, with a
space: **`و l'effet`**, **`ديال les cernes`**, **`ف la clinique`**. Before an
Arabic word it attaches as Arabic always writes it: `ونضارة`, `للبشرة`. The old
`wl'effet` was only possible because the conjunction was a Latin `w`.

**A word that exists in both — `normal` / `نورمال`.** *Decided by grammar, not
by origin.* Arabic article, Arabic plural, Arabic verb prefix → Arabic:
`النورمال`, `الفيتامينات`, `كنبوسطي`. French or English article or plural →
Latin: `le normal`, `la vidéo`, `the serum`. **When neither is clear, write it
Latin and lower the word's confidence** so the editor sees it — a borrowed word
in Latin is readable to both audiences, while an Arabic spelling invented for a
word nobody writes in Arabic is not.

**Brand and product names.** *Exactly as their owner writes them*, in whatever
script that is, with their own casing: `Profhilo`, `RRS Eyes`, `Vita Silk`.
**Never transliterated, in either direction.** The client's vocabulary list
overrides every rule in the guide.

**Numbers, dates and measurements.** Digits, never spelled out — `15 يوم`, not
`خمستاشر يوم` — and **Western digits `0-9`, never Arabic-Indic `٠-٩`**. That
second half is *a decision and the guide says so*: every measurement, template
and character-counting check in this project is built on ASCII digits, a reel
mixing the two systems reads as careless, and `26` is legible to every audience
this tool serves. It is reversible — one rule here plus a sweep of everything
that counts characters. Units keep the language they were spoken in: `20 ml`,
`50 غرام`.

**A term that is half Arabic and half French.** *Each word follows the same
rule; the term is not forced into one script.* `مادة la caféine` is what was
said and is what is written. Where a substance has both an Arabic name and a
French technical one, write the one actually spoken. A term is still one unit
for the subtitle track (§7) — that has nothing to do with script.

**The Arabizi numerals `3`, `7`, `9`, `2`, `5`.** *Input to be converted, never
output to be produced.* §3a is the conversion table — `3`→ع, `7`→ح, `9`→ق,
`5`/`kh`→خ, `2`→ء, `ch`→ش, `gh`→غ, `ou`→و — which is the old §2's production
table read backwards. **A digit standing alone is still a number**: `3 حصص` is
three sessions, and that distinction is kept because it was already load-bearing.

**Three more the guide decides, because a draft will meet them too.** Darija is
written in Arabic letters **as Darija** — `كنقولو`, not `نقول`; `دابا`, not
`الآن` — because turning Darija into MSA is a translation and translation is
forbidden; this is the likeliest failure of Arabic-script output and the guide
guards it hardest. **No vocalisation**, except inside a religious quotation.
And §4 replaces the old freeze list with **an Arabic one** — `واش`, `شنو`,
`علاش`, `دابا`, `بزاف`, `ديال`, `باش` and thirty more — because Darija has no
standard orthography and one spelling per word is what makes a reel look
deliberate.

---

## Done

### 1. What the change touched

**The guide's Latin-first machinery, by section.** §1's scope line
(*"Moroccan Darija → Latin script (Arabizi)"*); §2's whole character table and
its five notes; §3's Arabizi vowel rules; §3a's digit-versus-letter split;
§4's 60-word Latin freeze list; §5's code-switch rules; **§6 in its entirety** —
the medical-domain rule, the term-level switch, the `msa` tagging rule and §6c;
and §8's mixed-script clause. Nine of §9's ten resolved decisions were about
which Latin form to write. **v2.0.0 rewrites all of it**; what survives is
listed in the guide's own §11.

**Where it reaches the model** — `buildCorrectionPrompt` in
`service/src/transcription/correction.ts:78`, which reads
`docs/ORTHOGRAPHY_GUIDE.md` **from disk on every call** and puts it at the head
of the prompt. Prompt version **4**, active. Also in that prompt: the Scribe
draft, the correction instruction, `SCRIPT_RULES`, the version-4
`spellingRules` block, the `lang` response shape, and the keyterms line.

**Two orthography instructions live in code, not in the guide, and both said
the opposite of the ruling.** This is the case the brief anticipated, and it is
fixed in the same commit (§2 below): `SCRIPT_RULES` in
`core/src/script-rules.ts` (*"Darija: Latin Arabizi… If the audio makes you
think in Arabic script, transliterate it to Arabizi — Darija in Arabic script
is wrong here"*), and `spellingRules` in `correction.ts` (*write `w7essa`*,
*`dial la vidéo`, not `dial lvidéo`*).

**Downstream, everything that would behave differently**, none of which this
session changed:

| path | what it does | how it changes |
|---|---|---|
| `assignTemplates` (`analysis/assign.ts:159`) | draws `_ar` variants per script | most cards become `sub_pop_ar` |
| `ARABIC_SIZE_RATIO` 1.07 (`typography.ts:40`) | Almarai against Inter | applies to most cards |
| `OVERLONG_WORD_CHARS` 11 (`transcript-view.ts:112`) | character proxy for "too wide" | **breaks first — §4** |
| `splitArabicRuns` (`transcript-view.ts:146`) | flags consecutive Arabic words as a possible term | fires on nearly every card |
| `transcript.terms` (`analysis/terms.ts:81`) | filters `script === 'arabic'` | its candidate set becomes the whole reel |
| `alignCorrectedOntoDraft` + `transliterate.ts` | pays a reduced cost for a cross-script pair | **improves** — see §4 |
| `SUBTITLE_BAND` (`placement/constants.ts`) | derived from Almarai's ink extents | unchanged: it already assumes the Arabic face is the tall one |
| `deriveLang`'s lexicons | French/English spelling cues | unaffected; they never read Arabic |
| RTL | per-token `dir`, never on a container | unaffected |
| image prompts | composed from slot ideas | unaffected; the idea is written by the model, not copied from the words |

### 2. The rewrite

**`docs/ORTHOGRAPHY_GUIDE.md` v2.0.0**, eleven sections: the rule; the per-word
decision; how Arabic is written; the Arabizi conversion table; the Arabic freeze
list; numbers; borrowed words, proclitics and brands; terms; cleaning;
punctuation; the corpus; the version history. **It is shorter than what it
replaced — 13,326 characters against 17,119.**

**§7 keeps the term contract and drops its script rule.** A term is still one
unit that is never broken in the subtitle track, and the keyword layer still
selects a subset of a long one — `تحفيز طبيعي` out of `تحفيز طبيعي للكولاجين` —
without that subset being a spelling of the term. What is gone is the part that
decided *which words* went into Arabic, because there is no longer a decision to
make.

**§10 says plainly that the corpus predates the guide**, names all six kinds of
pinned artifact, and states that a reel transcribed under v1.0.x stays Arabizi
until somebody deliberately re-transcribes it. Nobody reading a mismatch should
take it for a defect.

**The prompt's structure is unchanged and its two hardcoded rule blocks are
rewritten**, named here because the brief asks for it:

- `core/src/script-rules.ts` — now says Arabic goes in Arabic letters, carries
  the conversion table, forbids MSA-ising Darija, and states the borrowed-word,
  brand and numeral rules.
- `correction.ts`'s `spellingRules` — now states the proclitic rule in Arabic
  letters, including the case where it cannot attach, and the borrowed-word rule
  with both legal forms.
- `correction.test.ts` — two tests asserted the retired Arabizi forms and are
  **rewritten**, not deleted; they guard the same behaviour against the current
  rules. A third is added: **the prompt instructs no Arabizi anywhere**, pinned
  by name against `w7essa`, `Wki3tewna`, `dial lvidéo` and `dial lvitaminat`.
  **Proven to fail** by putting `Darija: Latin Arabizi. Write w7essa` back into
  `SCRIPT_RULES`, which turns it red; restoring the file turns all 23 green.

**Nothing in the transcription fingerprint covers the prompt's text** — it keys
on the guide's *version* — so these two blocks must move with the guide or not
at all. That is written at both of them and in the decision record, and the new
test is the mechanism.

### 3. Nothing already made changed, and the money question

**The loud sentence, and it is good news.** `guideVersion` *is* one of the five
transcription fingerprint inputs (`fingerprint.ts:57`), so the bump does move
every reel's fingerprint and the exact-hit entry misses. **But
`resolveTranscriptionEntry` resolves `compatible` — same prompt version, older
guide — and reuses the entry without billing.** Run against the real cache after
the bump:

| reel | provenance | entry | entry's guide |
|---|---|---|---|
| ground truth | **compatible** | `transcription-758a3924d090d1b5` | v1.0.7 |
| test 1 | **compatible** | same | v1.0.7 |
| test 2 | **compatible** | same | v1.0.7 |
| test 3 | **compatible** | same | v1.0.7 |
| vitasilk | **compatible** | same | v1.0.7 |

And the dry run, per reel: transcription **skip** on all five; totals
`$0.0000` for four of them and `$2.3508` for `test-3`, unchanged from before the
bump. **No reel silently re-bills.**

Two conditions hold that up and both were checked: `ACTIVE_PROMPT_VERSION` stays
**4**, because `compatible` requires the prompt versions to match; and `2.0.0`
was added to `GUIDE_VERSION_HISTORY`, without which the resolver cannot recover
an entry's own guide version and answers `none`.

**Nothing was re-transcribed and no cache entry was touched** — 46 entries, 80
files, 54,256 KB at both ends.

**The four hand-written transcripts and the two alignment references are
byte-identical**, and the check that would have forced them to move is fixed
rather than obeyed. `npm run check` compared each reference's header against
*whatever version the guide currently carries*; under v2.0.0 all four failed
with `header says v1.0.8-conformant but the guide is at v2.0.0-conformant`. The
two ways out were re-stamping them — which would assert that four Arabizi files
conform to an Arabic-first guide, exactly the false claim the header rule exists
to prevent — or asking the question that can be answered. **They are pinned:
`REFERENCE_ORTHOGRAPHY_VERSION = '1.0.8'` in
`benchmarks/src/verify-references.ts`**, and the check now asks whether they
still conform to the rules they were written under. The conformance scorer is
untouched for the same reason: it scores the v1.0.x rules.

**Which tests are records and which were rules.** Rewritten because they
asserted the *rule*: the two in `correction.test.ts`, and the reference check's
comparison against the live guide. Left alone because they are a record of the
*corpus*: `transcript-view.test.ts`'s *"vitasilk is Arabizi, so no Arabic run
exists to be split"*, `tagging.test.ts`'s *"treats Arabizi as Latin"* (a fact
about the character classifier, still true), `orthography.test.ts` in full,
`align.test.ts`'s cross-script pairing case, and `span.test.ts`.

### 4. What a fresh run would cost, and what would break

**A correction to the brief's premise, and it matters for the plan.** `test-3`
**has been transcribed** — 58 words on its plan, a cache entry at prompt v4. It
is the reel that has never been **analysed**. Its `$2.3508` is `$0.18` of
analysis plus `$2.1708` of images, **and `$0.00` of transcription, because the
run would skip it and reuse the Arabizi transcript.** Running `test-3` therefore
tests the new orthography on nothing at all.

**To see a v2.0.0 transcription, something has to actually transcribe**: a video
this repository has never seen, or `npm run transcribe -- --no-cache` on one it
has. From the ledger, production transcription has cost **$1.780490 over 12
reel-runs** — `transcribe-scribe` $0.017128 and `transcribe-gemini-correction`
$1.763362 — a mean of **$0.148 a reel**, and the dry run's own pessimistic
figure is $0.17.

**Does the guide's length change the correction call's cost?** Measured by
building the real prompt both ways over a 340-word draft: **21,502 characters
under v1.0.8, 18,325 under v2.0.0** — 3,177 fewer, about 15% smaller. At the
text input rate of $2 per million tokens that is roughly a fifth of a cent
*saved* per call. **The direction is down, and the caveat is that this measures
input.** Thinking tokens bill at the output rate of $12 per million, and nothing
here predicts how hard the model thinks when it has to convert a whole reel out
of Arabizi. That is unmeasurable without spending.

**What breaks first at 90% Arabic, in order.** Measured against the 338 real
card widths in `reports/block-10-card-widths.json`:

1. **`OVERLONG_WORD_CHARS` — a character count — goes blind.** It has flagged
   **zero Arabic cards ever**, and **both** cards in the corpus that overflow
   and it misses are Arabic: `محفزات الكولاجين` at 3471 px and `ترطيب عميق` at
   2450 px, against a 1940 px bound. It has no false alarms, so it is not
   miscalibrated — it counts characters in a *word* while the rule is about a
   *card*, and Almarai sets 176.2 px per character against Inter's 168.4 while
   Arabic words are far shorter in characters. At 90% Arabic the transcript
   editor would tell the user there is nothing to rule on.
2. **Cards get wider.** The Arabic median card is **1045 px against Latin's
   780** — 34% wider — so many more cards would break or shrink. Both mechanisms
   exist and work; what changes is that they stop being exceptional.
3. **The split-term count stops meaning anything.** `splitArabicRuns` flags
   consecutive Arabic words as a possible §7 term; there are **13** such runs in
   the corpus today (2 / 6 / 1 / 4 / 0 by reel). At 90% Arabic almost every card
   is in one, and the editor's ruling-1 count becomes noise.
4. **Two-line height gets tighter.** The corpus's only two two-line cards are
   both Arabic `kw_slam_ar`, reaching 1198.8 px in a 1250 px comp with **53.3 px
   spare**. More Arabic keywords means more two-line cards near that ceiling.

**And one thing gets better.** `docs/DEFECT-alignment-script-mismatch.md`
records **208 of 343 words sitting in a cross-script substitution run**, where
Levenshtein has no signal because Scribe writes Arabic and the corrected text
was Arabizi. Under v2.0.0 both sides are Arabic and those runs largely
disappear. The transliteration cost model stays — it is what makes the remaining
mixed cases cheap — but the defect it was written for should mostly stop
occurring.

**Whether the Arabic paths are exercised enough to trust — they are not, and
here is exactly how thin.** Measured across the five plans and the golden
census:

| path | examples in the whole corpus |
|---|---|
| Arabic words | 45 of 343 (**13.1%**), confirming session 20 |
| `sub_pop_ar` cards | 45, over four reels; **`vitasilk` has none** |
| `kw_slam_ar` keywords | **5** — `الإبرة الحريرية`, `شد`, `محفزات الكولاجين`, `ترطيب عميق`, `شد خفيف` |
| Almarai text layers in a built comp | 80 of 542, split 39 / 17 / 24 / **0** |
| Arabic runs of 2+ words | 13, split 2 / 6 / 1 / 4 / **0** |
| Arabic card that had to **break** to fit | **2** — `test-1 k002`, `test-2 k002`, both `kw_slam_ar` |
| Arabic card that had to **shrink** to fit | **0** — it has never happened |
| `transcript.terms` populated | **1 reel** — `ground truth`, 3 terms; absent on the other four |

Three of those are paths with two examples or fewer, and they are named above
rather than left as a percentage.

**How a v2.0.0 run would be judged — nothing that exists can score it.**
`ground-truth`'s hand-written transcript is Arabizi, so WER against it would
measure the orthography change rather than the transcription. And **the
conformance scorer cannot judge a v2.0.0 transcript either**: run over a wholly
Arabic sentence it fires no rule and reports a conformance of **NaN**, because
its denominator is Arabizi tokens and there are none. It is not that it passes
everything — it has nothing to say. What could judge a run: a new hand-written
reference in the new orthography for one reel, which costs the user the same
evening the originals cost; a v2.0.0 conformance scorer, which does not exist;
or the user's own eye on a built comp, which is how every other ruling in this
project has been made.

---

## Deviations

**`benchmarks/src/verify-references.ts` was changed, which is a check rather
than the guide.** The brief scopes this session to what the model is told to
write, and this file decides nothing about that — but bumping the guide turned
all four references red, and the only alternatives were re-stamping four
hand-made files with a claim that is false or leaving `npm run check` broken.
The change is one pinned constant and the failure message that names it.

**`core/src/entry-resolve.ts` gained one line** — `'2.0.0'` in
`GUIDE_VERSION_HISTORY`. Without it the resolver cannot recognise the current
version and every reel resolves `none`, which is the re-billing this session
exists to avoid.

**`CLAUDE.md`'s one-line description of the guide was updated**, since it
described the guide as *"how Darija is written"*. That is a map change, which is
what session 28's §5 says the file is for; it is 8,625 of its 20,000 characters.

**No hand-made reference, plan, cache entry, mode file, template, generated
image or golden reference was touched**, and no downstream constant was moved —
`ARABIC_SIZE_RATIO`, `OVERLONG_WORD_CHARS` and template selection are all as
they were.

## Failures & open problems

**Unproven, by name:**

- **No reel has ever been transcribed under v2.0.0.** Everything here says the
  configuration is consistent and free to adopt; nothing says the new rules
  produce a better transcript, or that the model obeys them. The guide's own
  §11 is a claim about what the rules are, not about what comes back.
- **The hard cases are decided but untested.** `و l'effet`, `النورمال` versus
  `le normal`, `مادة la caféine` — every one is a rule written for a model that
  has not yet been asked. The first real run is where they are judged.
- **The Western-digit decision is mine to state and the user's to overrule.**
  The guide says so at the rule and gives the reason.
- **The prompt's two hardcoded rule blocks are not covered by any cache key.**
  The new test stops an Arabizi instruction returning; it cannot notice a rule
  that drifts from the guide in some other direction.
- **The old `w`-attachment and French-article rules were retired without a
  replacement being measured.** They existed because the corpus got those two
  wrong; whether the two that replaced them are the two a v2.0.0 draft gets
  wrong is a guess until a run happens.

**Open, and untouched as the brief required:** everything downstream of the
transcript — the character proxy, template selection, the 1.07× ratio;
`preflight.ts` not checking a client picture's file; the client photographs
missing from the backup set; `ground-truth`'s unbuildability; the three
false-premise tests; `build-reel.jsx`'s guard. **The panel's image-picker tests
did not flake** in either full `npm run check` run.

## Repo state

| | |
|---|---|
| branch | `main`, clean |
| HEAD | `5025988` *docs: record the Arabic-first ruling* (this report follows) |
| ledger | **118 lines**, `3f657131e5cda5c903acaf6db1ca34cddd478789042d07b636499fb36559a58c` — identical at both ends |
| `templates/library.aep` | `d2bbb6b727f819078b5e8dec08a59722b018dc6c0d1d77c123476f8241c84d9c`, never opened |
| cache | **46 entries / 80 files / 54,256 KB** at both ends |
| orthography guide | v1.0.8 → **v2.0.0**, 17,119 → 13,326 characters |
| After Effects | one instance, 0 `aerender`; nothing saved |
| free space | **307 GiB** |
| credit remaining | **about $6.64**, unchanged |

**Hand-made references, sha256, identical at both ends — none rewritten:**

```
1fbbe2190d734db8a2d37581acc6368b37a98e99ec107d9df1fbaff35d22f22a  .local/ground-truth/ground-truth.txt
b59a6270c3f704bcbec1c139e9014e41b8896c477d75bdba13cd53305095ddd0  .local/ground-truth/test-1.txt
9ceea1c47ee94a8ca42f9f5d6f5e73db7be4558a6762a52c828b59232b36de12  .local/ground-truth/test-2.txt
b5413c215ff32fec27fd321d7de8b824eee840c8aa3e6cc26733c1520696dbf6  .local/ground-truth/test-3.txt
f32e12dcfad558994388866198fe9138c703c55eddb43a9951960359359c60b2  benchmarks/references/align/vitasilk.json
10a2e5c2971ed27f950459933d8559264918bd9507b28822c4af07144db830ee  benchmarks/references/align/vitasilk.rereview.json
```

**Edit Plans, sha256.** `ground truth` is unchanged; the other four moved for
one reason only — `npm run golden` builds all four and each build writes a fresh
`builtAt`. Nothing this session touched a plan. (The plans are gitignored, so
the field-level diff session 25 took when it added the build record is the
evidence for *which* field moves, not a diff taken here.)

```
start                                                             end
0712e412…  ground truth   →  0712e412…  (unchanged)
cba10e18…  test 1         →  77ae4a26…  (golden's builtAt)
e6d3a423…  test 2         →  403e942f…  (golden's builtAt)
1b05174b…  test 3         →  9515b3f6…  (golden's builtAt)
27a6d376…  vitasilk       →  7563523d…  (golden's builtAt)
```

**`npm run check`: PASS** (exit 0), read from the run's own output:

| workspace / gate | before | after |
|---|---:|---:|
| core | 751 | 751 |
| service | 1208 | **1209** |
| benchmarks | 173 | 173 |
| panel | 204 + 2 skipped | 204 + 2 skipped |
| pytest | 149 | 149 |
| modes | `mode k2-syndicalia v12: ok (fonts set)` | unchanged |
| ExtendScript | 15 `.jsx` ok | unchanged |
| claude-md | `8,497 of 20,000 characters` | **`8,625 of 20,000 characters`** |
| templates | `6 template(s) ok, audited against library.aep` | unchanged |
| panel manifest | `panel/CSXS/manifest.xml ok` | unchanged |
| references | `6 hand-made reference file(s): 4 transcript, 2 alignment` · `PASS` | unchanged, all four still `v1.0.8-conformant` |
| attribution | `PASS` | `772 tracked text file(s), 739 commit message(s)` · `PASS` |

Service **+1**: two tests in `correction.test.ts` were rewritten in place and
one added — the Arabizi pin.

**`npm run golden`: PASS** — 4 of 4 reels matched, field for field: test-1 4415,
test-2 4280, test-3 3709, vitasilk 4770, **17,174 fields**, against the
reference recorded 2026-08-31, After Effects 26.0x67, 1198 font names. The
reference was **not re-recorded**.

## Suggested next step

**Transcribe one short new video and read it, before anything else is built on
the new rules.** It has to be a video this repository has never seen — running
`test-3`'s pipeline would skip transcription and test nothing — and at roughly
**$0.15 to $0.17** it is the cheapest thing in this project that can answer the
question the guide cannot: whether the model actually writes what §1 to §7 tell
it to. Read the words themselves rather than any score; nothing here can score
them.

The two things to look for first are the two most likely to be wrong: whether
Darija comes back as Darija in Arabic letters or quietly as MSA, and what
happens where an Arabic proclitic meets a French word. If both hold, the
downstream work has a foundation; if the first fails, §3's warning needs to
become something stronger than a warning.

## Commits

| | |
|---|---|
| `8cfecc9` | `docs: rewrite the orthography guide for Arabic in Arabic letters` |
| `2592af7` | `fix: stop the correction prompt instructing Arabizi` |
| `c65ab50` | `fix: score the references against the orthography they were written in` |
| `5025988` | `docs: record the Arabic-first ruling` |
| this one | these reports |
