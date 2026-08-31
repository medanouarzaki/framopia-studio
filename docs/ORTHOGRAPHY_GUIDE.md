# Framopia Studio — Orthography Guide (v2.0.0)

Status: **v2.0.0 — in force from 2026-08-31.** This version reverses the rule every earlier version was built on. Versions v1.0.0 through v1.0.8 wrote Moroccan Darija in **Latin letters (Arabizi)** and reserved Arabic script for a named medical domain and for formal MSA; v2.0.0 writes **all Arabic in Arabic letters** and keeps Latin for the languages that use it. The user ruled it on 2026-08-31, for a product aimed at Arabic content creators whose speech is mostly Arabic with some English, where Arabizi was a Moroccan-agency habit rather than a property of the audience. Everything already transcribed under v1.0.x stays as it is — see §10. This document is injected verbatim into every Gemini transcription/correction prompt, so it is written as rules, not prose. **Consistency across videos matters more than any single "correct" spelling.**

## 1. The rule

**Arabic is written in Arabic letters. French and English are written as they are.**

That is the whole of it. There is no judgement to make about whether a word is
technical enough, formal enough, or medical enough — those were v1.0.x's
questions and they are gone.

- Arabic — Moroccan Darija, Modern Standard Arabic, Gulf, Egyptian, Levantine —
  → **Arabic script**. `3ndk` → `عندك`. `sana` → `سنة`. `yom` → `يوم`.
  `l7essass` → `الحصص`.
- French → **French spelling, with its accents**. `les cernes pigmentés`,
  `alors`, `la vidéo`, `déjà`, `mésothérapie`.
- English → **English spelling**. `serum`, `booster`, `skincare`.
- **Never translate. Never paraphrase. Never turn Darija into Modern Standard
  Arabic** — see §3.
- The script of a word is decided by **the word**, never by the words around it.

## 2. Deciding the script, word by word

Ask one question of each word: **what language is it?**

| the word is | write it | example |
|---|---|---|
| an Arabic word, in any register | Arabic script | `دابا`, `البشرة`, `إن شاء الله` |
| a French word | French spelling | `la vidéo`, `polynucléotides` |
| an English word | English spelling | `serum`, `filler` |
| a foreign root that has taken Arabic grammar | Arabic script | `النورمال`, `الفيتامينات` |
| a proper noun or brand | as its owner writes it (§6) | `Profhilo`, `Vita Silk` |
| a number | digits (§5) | `15`, `26` |

**A token never mixes scripts.** If two scripts meet, they are two tokens with a
space between them. Splitting at the boundary is always the right answer.

## 3. Writing Arabic

- **Write the word that was spoken.** Darija stays Darija in Arabic letters:
  `كنقولو`, not `نقول`. `دابا`, not `الآن`. `بزاف`, not `كثيرا`. Rewriting Darija
  into Modern Standard Arabic is a translation, and translation is forbidden.
  This is the single most likely error in Arabic-script output and the one to
  guard hardest.
- **No vocalisation.** Harakat are not written — `الكولاجين`, never
  `الكُولاجين` — except inside a religious quotation, where they may be written
  if that is how the phrase is set.
- **Standard Arabic letters and standard spelling**: `ة` for a final feminine
  `t`, `ى` where standard, hamza written as standard Arabic writes it (`أ`, `إ`,
  `ء`, `ئ`, `ؤ`).
- **Proclitics attach**, as Arabic writes them: the definite article
  (`البشرة`), the conjunction `و` (`ونضارة`), and the prepositions `ل`, `ب`,
  `ف`, `ك` (`للبشرة`, `بزاف`, `فالدار`). A standalone `و` before an Arabic word
  is a spelling error.
- **Doubling** is not marked; shadda is a haraka and §3 does not write harakat.
- **One spelling per word.** Where a Darija word can plausibly be spelled more
  than one way, use §4's list. Consistency across a reel matters more than any
  single defensible choice.

## 3a. Converting Arabizi input

The first-pass transcription and any draft you are handed may contain Arabizi.
**It is input to be converted, never output to be produced.** Inside a word:

| Arabizi | Arabic letter | example |
|---|---|---|
| `3` | ع | `3ndk` → `عندك` |
| `7` | ح | `7essa` → `حصة` |
| `9` | ق | `9elbi` → `قلبي` |
| `5` or `kh` | خ | `khdma` → `خدمة` |
| `2` | ء / أ | `2ana` → `أنا` |
| `ch` | ش | `chno` → `شنو` |
| `gh` | غ | `ghadi` → `غادي` |
| `ou` | و | `nour` → `نور` |

A digit standing alone as its own token is **a number**, not a letter (§5):
`3 حصص` is three sessions.

## 4. High-frequency Darija words — one spelling each

Darija has no single standard orthography, so these are fixed. Use them exactly.

`واش` (question marker) · `شنو` (what) · `علاش` (why) · `كيفاش` (how) ·
`فين` (where) · `دابا` (now) · `غادي` (going to) · `بغيت` / `بغيتي` (I/you want) ·
`كاين` / `كاينة` (there is) · `ماشي` (not) · `والو` (nothing) · `بزاف` (a lot) ·
`شوية` (a little) · `مزيان` (good) · `هادشي` (this thing) · `مع` / `معايا` (with) ·
`حتى` (until, even) · `واخا` (okay) · `يالله` (let's go) · `إن شاء الله` ·
`خاصك` (you must) · `عندي` / `عندك` / `عندهم` (I/you/they have) · `راه` / `راها` ·
`ديال` / `ديالي` / `ديالك` (of/mine/yours) · `لي` (which, who) · `هو` (he, it) ·
`جوج` (two) · `واحد` (one) · `حصة` / `حصص` (session/sessions) · `مابين` (between) ·
`تال` (up to) · `من` (from) · `على` (about, on) · `فا` (so, then) ·
`اليوما` (today) · `يوم` (day) · `باش` (so that) · `يعني` (that is)

**`ديال` is written separate** from the word it governs — `ديال الحلول`,
`ديال الحصص` — and its pronoun suffixes stay attached: `ديالي`, `ديالك`,
`ديالها`, `ديالو`, `ديالنا`.

**Verb prefixes attach**, as Arabic writes them: `كنقولو`, `كتخدم`, `كيخدم`,
`غانمشيو`.

## 5. Numbers, dates and measurements

- **Digits, never spelled out**: `15 يوم`, not `خمستاشر يوم`. This holds
  whatever the surrounding language is, and for ordinals read as numbers.
- **Western digits `0-9`, never Arabic-Indic `٠-٩`.** *A decision, not a
  convention*: every measurement, template and downstream check in this project
  is built on ASCII digits, a reel mixing the two numeral systems reads as
  careless, and `26` is legible to every audience this tool serves. Reversible
  if the user prefers `٢٦`, and it would be one rule here plus a sweep of
  everything that counts characters.
- **Dates and times as spoken**, in digits: `15 تال 20 يوم`, `5 دقائق`.
- **Units keep the language they were spoken in**: `20 ml`, `2 mm`, `50 غرام`.

## 6. Words that belong to two languages

**A borrowed word is written in the script of the language it is being spoken
as.** The test is grammar, not origin.

- **It carries Arabic grammar → Arabic script.** An Arabic article, an Arabic
  plural, an Arabic verb prefix, an Arabic possessive: `النورمال`,
  `الفيتامينات`, `كنبوسطي`, `تكونيكتا`. A French root inside an Arabic word is
  still an Arabic word.
- **It carries French or English grammar → Latin.** A French article, a French
  plural, an English possessive: `le normal`, `la vidéo`, `les cernes`,
  `the serum`.
- **Neither is clear → write it Latin and lower the word's confidence**, so the
  editor sees it. A borrowed word left in Latin is readable to both audiences;
  an Arabic spelling invented for a word nobody writes in Arabic is not.

**A one-letter Arabic proclitic before a Latin-script word does not attach**,
because a token may not mix scripts. It is written in Arabic letters as its own
token, with a space: `و l'effet`, `ديال les cernes`, `ف la clinique`. Before an
Arabic word it attaches as normal: `ونضارة`, `للبشرة`.

**Brand, product and proper names are written exactly as their owner writes
them**, in whatever script that is, with their own casing: `Profhilo`,
`RRS Eyes`, `Vita Silk`. The client's vocabulary list is authoritative and
overrides every rule here. **A brand is never transliterated**, in either
direction.

## 7. Terms

A **term** is a phrase that names one thing and is spoken as one unit — a
procedure, an anatomical region, a substance, an outcome phrase:
`محفزات الكولاجين`, `المنطقة حول العينين`, `ترطيب عميق للبشرة`,
`l'acide hyaluronique`, `les polynucléotides`.

- **A term may be Arabic, French, English, or a mixture**, and each of its words
  follows §2. A term is not forced into one script: `مادة la caféine` is what
  was said and is what is written. Where a substance has both an Arabic name and
  a French technical one, write the one actually spoken.
- **A term is never broken in the subtitle track.** It is written whole and
  correctly spelled, however many tokens it runs to. Nothing in the pipeline may
  split it, re-spell it, or drop part of it.
- **The keyword emphasis layer is a separate matter.** Keyword templates hold
  one or two short words (TEMPLATE_LIBRARY_GUIDE §4), so a term of three or more
  tokens cannot be emphasized whole. The emphasis layer **selects a subset** —
  `تحفيز طبيعي` out of `تحفيز طبيعي للكولاجين` — and that subset is what
  animates. **This does not alter the term**: the subtitle track still renders it
  whole. A narrowed keyword is a pointer into a term, not a spelling of one.

**The language tag follows the word, not its neighbours.** `script` is read off
the characters; `lang` is a property of the word. An Arabic word in a French
sentence is `darija` or `msa` by what it is, and a French word in an Arabic
sentence is `fr`. Tagging a word by the language around it is the same mistake
as choosing its script that way.

## 8. Cleaning rules (applied as flags, never deletion)

Mark as removed — they will not display, but stay in the Edit Plan:

- Fillers: `اه`, `euh`, `eh`, and standalone repeated `يعني` / `زعما` used as
  hesitation. Kept when meaningful: `يعني…` introducing an actual explanation
  stays.
- Immediate stutters and repetitions: `ل- ل- المشكل` → `المشكل`.
- Abandoned false starts replaced by a restart.

Never remove content words. Never reorder. Never "improve" grammar.

## 9. Punctuation and casing in subtitles

- Groups of one or two words carry no terminal punctuation. A question mark is
  allowed on the final group of a clear question — `؟` after Arabic, `?` after
  Latin. No commas, no ellipses.
- Latin text is lowercase by default; proper nouns and brands keep the casing
  their owner uses. Arabic has no casing.
- **Never mix scripts inside one word.** Where two scripts meet, split into two
  tokens (§2, §6).
- Apostrophes in Latin words are always straight (`l'ADN`, `l'effet`), never
  curly.

## 10. The corpus predates this guide

**Every reel already transcribed in this repository was written under v1.0.x and
is Arabizi.** That is not a defect and must not be read as one:

- the five Edit Plans in `my files/test videos/` — 343 words, 13.1% of them in
  Arabic script;
- the cached transcriptions behind them;
- the four hand-written ground-truth transcripts in `.local/ground-truth/`,
  which carry a `# reference-version:` header naming the v1.0.x rules they were
  written under;
- the two hand-made alignment references in `benchmarks/references/align/`;
- the golden reference in `benchmarks/references/golden/`, and the four comps it
  describes.

**None of them is rewritten.** They are hand-made or expensively made records of
what was measured, and the system never regenerates one. The orthography
conformance scorer in `benchmarks/src/orthography.ts` scores the **v1.0.x**
rules, because those are the rules those four transcripts were written under,
and it is pinned to that version rather than to whatever the guide currently
says.

An existing reel does not re-transcribe because this guide changed: its cached
entry is reused as *compatible* — same prompt version, older guide — and costs
nothing. What that means in practice is that **nothing already made moves to the
new orthography, and a reel transcribed under v1.0.x stays Arabizi until someone
deliberately re-transcribes it.**

## 11. Version history

- **v2.0.0 (2026-08-31)** — Arabic is written in Arabic letters; French and
  English are written as they are. Reverses §1 of every earlier version. The
  Arabizi conventions become a conversion table (§3a) rather than an output
  format; the domain-based script rule of the old §6 is gone, because there is
  no longer a domain to decide; the old §4 freeze list is replaced by §4's
  Arabic one; the numeral system is settled as Western digits (§5); the
  proclitic-before-a-Latin-word case is decided (§6); terms keep their contract
  and lose their script rule (§7).
- v1.0.8 (2026-08-25) — the conjunction before an Arabic-script term attaches in
  Arabic script as a proclitic. Superseded in form by v2.0.0 §3, which keeps the
  same behaviour for all Arabic words.
- v1.0.7 (2026-08-25) — the conjunction `w` attaches; a French noun keeps its
  French article; a term is never broken in the subtitle track. The first two
  are Arabizi rules and are retired; the third survives as v2.0.0 §7.
- v1.0.6 (2026-08-25) — the language of an Arabic-script term is `msa`. Survives
  as v2.0.0 §7's rule that the tag follows the word.
- v1.0.5 (2026-08-25) — `dial` is written separate. Survives as `ديال` in §4.
- v1.0.4 (2026-08-24) — `bach` added to the freeze list; now `باش` in §4.
- v1.0.3 (2026-08-24) — the script switch is term-level. Retired: there is no
  switch to make.
- v1.0.2 (2026-08-24) — the numeral rule, and the medical domain in Arabic
  script. The numeral rule survives as §5; the domain rule is retired.
- v1.0.0 to v1.0.1 (2026-08-24) — the original Arabizi conventions and the
  freeze list built from the four ground-truth reels.
