# Framopia Studio — Darija Orthography Guide (v1.0.8)

Status: **v1.0.8 — frozen**. All §9 questions are resolved. v1.0.2 (2026-08-24) added the numeral rule in §3a and widened the §6 Arabic-script rule to the whole medical/aesthetic domain; v1.0.3 (2026-08-24) settled that the §6 switch is term-level; v1.0.4 (2026-08-24) added `bach` to the §4 freeze list, because the conformance scorer flagged it as a near-miss of `wach` while both were correctly spelled. v1.0.5 (2026-08-25) requires `dial` to be written separate from the following word: three identical correction calls produced both `dial l7loul` and `dl7loul`, and §4 froze the spelling without ever saying whether it attaches. v1.0.6 (2026-08-25) settles the **language** of an Arabic-script term in §6: it is `msa`. Three identical calls tagged the same six terms `darija` twice and `msa` once, because §6 said which script they take and never which language they are. v1.0.7 (2026-08-25) settles three things the user decided by ear: the conjunction `w` attaches (§2), a French noun spoken with its French article keeps it (§2/§5), and a §6 term is never broken in the subtitle track even when the emphasis layer selects a subset of it (§6c). v1.0.8 (2026-08-25) settles the conjunction before an Arabic-script term: it attaches in Arabic script as a proclitic (`ومادة`), which §2 now states and §6 and §8 cross-reference. A mechanical scan found `w مادة` sitting in the `test-3` reference under a header asserting v1.0.7 conformance, past three separate hand-written token lists; the scorer now flags it. This document is injected verbatim into every Gemini transcription/correction prompt, so it is written as rules, not prose. **Consistency across videos matters more than any single "correct" spelling.**

## 1. Scope

These rules govern how spoken content is written in subtitles:
- Moroccan Darija → **Latin script (Arabizi)** by the conventions below.
- French and English → standard spelling, as spoken, inline.
- Genuinely classical/Modern Standard Arabic (Quranic/religious phrases, formal quotes, fixed formal terms) → **Arabic script**, fully vocalized only for religious quotations.
- Never translate. Never paraphrase.

## 2. Arabizi character conventions (Darija)

| Arabic sound | Write | Example |
|---|---|---|
| ع (ʿayn) | `3` | `3lach` (why), `m3a` (with) |
| ح (ḥ) | `7` | `7it` (because), `mre7ba` |
| ق (qāf) | `9` | `kan9olo` (we say), `9elbi`, `so9` |
| خ (kh) | `kh` | `khdma` (work) |
| ش (sh) | `ch` | `chno` (what) — French-style `ch`, not `sh` |
| غ (gh) | `gh` | `ghadi` (going to) |
| ط، ص، ض، ظ | plain `t`, `s`, `d`, `d` | no capital-letter emphatics, no `9`-digraphs |
| ء (hamza) | omit or `'` only where ambiguity demands | `sa'al` |
| ه | `h` | `houa` |
| و (consonant/vowel) | `w` / `ou` | `wach`, `nour` |
| ي | `y` / `i` | `yallah`, `bghit` |

Notes:
- ق is **always** `9`, never `q` — no exceptions, including words commonly typed with `q` elsewhere (`kan9olo`, `9elbi`, `so9`, `9rib`). `q` never appears in a Darija word.
- The definite article is **always attached** to its noun, no space and no hyphen: `lkhdma`, `lmochkil`, `ddar`, `chchi`. This is the Arabic `l-`, and it governs **Darija** nouns. See the French-article rule below.
- The conjunction **`w` attaches to the word that follows it**, no space and no hyphen — the same way the definite article does, and for the same reason: it is a proclitic, not a word. Written from the four reference reels: `Wki3tewna شد خفيف` (test-1), `Mabin 7essa w7essa 15 yom` (test-3). In Arabic script it is the same rule with the same letter: `إشراقة ونضارة`, never `إشراقة و نضارة`. A standalone `w` is a spelling error, and the conformance scorer treats it as one.
- **The conjunction attaches regardless of the following word's script.** When the next word is written in Arabic script under §6, the conjunction attaches *in Arabic script*, as a proclitic: `ومادة`, never `w مادة` and never `و مادة`.
  - This does not violate §8. §8 forbids mixing scripts **inside one word**, and the fused form is entirely one script — the whole token is Arabic.
  - It does not violate §6's term-level rule either. After fusion there is no separate conjunction word whose script could depend on its neighbours; the letter is a proclitic **on the term**, which is how it is written in Arabic in any case. §6 rejects letting a neighbour decide a *word's* script, and a proclitic is not a word.
- **A French noun spoken with its French article keeps the French article**, and both keep French spelling: `dial la vidéo`, `dial le cabinet`. §2's attached `l-` never reaches it. A French **root** carrying Darija morphology is a Darija noun and does take the attached article: `dial lvitaminat`, `dial lcocktail`. Both forms are legal and the difference is real — write what was spoken.
- Digits are used **only** for 3/7/9. Never `5` for خ (use `kh`), never `2` for hamza, never `6`/`8`.
- Doubled consonants (shadda) are written doubled when pronounced: `d7akkni`, `hbbal`.

## 3. Vowels

- Short, barely-pronounced schwas are dropped the way Moroccans type: `khdma` not `khedema`, `mzyan` not `meziane` — unless dropping creates an unreadable cluster, then insert `e`.
- Long vowels: `a`, `i`, `ou` (`ou` for /uː/, French habit): `so9`, `bousa`.
- Word-final /a/ from ة: `a` (`khedma`? no — `khdma`; `mdina`).

## 3a. Numbers

Numbers are written as **digits**, never spelled out: `4`, `15`, `18`, `20`. Write `mabin 7essa w 7essa 15 yom`, not `khmstachr yom`. This holds whatever the surrounding language is, and it holds for ordinals read as numbers.

This does not conflict with §2. `3`, `7` and `9` are letters when they sit inside a word (`3ndi`, `7essa`, `so9`); a digit standing alone as its own token is a number (`3 dial l7essass` is three sessions). Nothing else in Arabizi produces a standalone digit token, so the two readings never collide.

## 4. High-frequency words — fixed spellings (freeze list)

One spelling per word, always. Where the ground truth spelled a word more than one way, the majority spelling won.

`wach` (question marker) · `chno` (what) · `3lach` (why) · `kifach` (how) · `fin` (where) · `daba` (now) · `ghadi` / prefix `gha-` (future) · `bghit` / `bghiti` (I/you want) · `kayn` / `kayna` (there is) · `machi` (not) · `walou` (nothing) · `bzaf` (a lot) · `chwiya` (a little) · `mzyan` (good) · `hadchi` (this thing) · `f` (in) · `m3a` / `m3aya` (with/with me) · `7ta` (until/even) · `wakha` (okay) · `yallah` (let's go) · `nchaalah` (God willing) · `khassk` (you must) · `3ndi` / `3ndk` / `3ndhom` (I/you/they have) · `rah` / `raha` (indeed/it is)

Added in v1.0.1, from the four ground-truth reels:

`dial` / `diali` / `dialk` (of/mine/yours — the possessive takes its pronoun suffix attached, `dialha`, `dialo`, `dialna`) · `li` (which/who) · `houa` (he/it) · `joj` (two) · `wa7d` (one, also the indefinite article) · `7essa` / `7essass` (session / sessions) · `mabin` (between) · `tal` (up to, until) · `mn` (from) · `3la` (about, on) · `fa` (so, then) · `lyoma` (today) · `yom` (day) · `nhdr` (I talk) · `lik` / `likom` (to you sg/pl) · `lkher` (the end) · `tb3i` (follow — f. imperative) · `kat7taji` (you need — f.) · `kidom` (it lasts)

Added in v1.0.4:

`bach` (so that, in order to — باش)

v1.0.1 replaced `dyal`/`dyali` with `dial`/`diali`: the ground truth wrote `dial` eleven times and `dyal` never, and §4's own rule is that the user's habit wins. Confirmed by the user on 2026-08-24; `dial` is settled.

`dial` is always written **separate** from the word it governs: `dial l7loul`, `dial l7essass`, `dial lvitaminat` — never `dl7loul`, `dl`, or `dla`. Its pronoun suffixes stay attached, as above: `diali`, `dialk`, `dialha`, `dialo`, `dialna`. §2's attachment rule covers the definite article only and never reached this word, and `dl`/`dla` were already listed below as reduced variants that are not frozen; measured instability across identical calls (Block 2 session 4) showed the gap was real, so it is closed here.

Variants seen in the ground truth and deliberately **not** frozen, because the majority form above supersedes them: `dl`/`dla` (reduced `dial`), `main` (a typo for `mabin`, and it collides with French `les mains`), `ta` (reduced `tal`), `yawm` (→ `yom`), `7sessa` (→ `7essa`). Apostrophes are always straight (`l'ADN`, `l'effet`), never curly.

Verb prefixes attach without hyphen: `kan-` (present, 1sg/1pl per context), `kat-`, `kay-`, `gha-`: `kanakol`, `kaykhdem`, `ghanmchiw`.

## 5. Code-switch boundaries

- French/English words keep their standard spelling, **accents included** (`déjà`, `donc`, `par exemple`, `français`), even mid-Darija-sentence: `kanbossti had l'contenu` → write `kan-` verb + French noun as spoken: `kanposter had le contenu` (spelling of the French word wins).
- Darija-ized French verbs (French root + Darija morphology) are written Arabizi with the French root recognizable: `kanposti`, `tconnecta`.
- Proper nouns, brand names, product names: exactly as the client writes them (client-mode vocabulary list is authoritative and overrides everything).
- The article that comes with a borrowed noun belongs to the language the noun is being spoken in. `la vidéo` is French and stays French; `lvitaminat` has taken Darija plural morphology and takes the Darija article. §2 carries the rule; this is the code-switch half of it.

## 6. Latin vs Arabic script — the decision rule

Write in **Arabic script** in two cases.

**(a) The medical and aesthetic domain**, even mid-Darija — this is how the register is actually written and read in the clinic, and it holds regardless of surrounding language. The rule covers the whole domain vocabulary, not just named procedures:

- procedures and treatments: `شد طبيعي للوجه`, `محفزات الكولاجين`, `الإبرة الحريرية`, `ترطيب عميق للبشرة`
- anatomical regions: `المنطقة حول العينين`, `البشرة`, `الوجه`
- substance and material names: `مادة الكافيين`, `حمض الهيالورونيك`, `الكولاجين`
- outcome phrases in the same register: `نتائج جد فعالة`

Branded product names and French technical terms are **not** covered and keep their Latin/French spelling: `le profhilo`, `le RRS eyes`, `les polynucléotides`, `l'acide hyaluronique`, `faiblement réticulé`, `la mésothérapie`. Where the same substance has both a domain Arabic name and a French technical one, write the one actually spoken.

**The switch is term-level, not clause-level.** Only the domain term itself renders in Arabic script; every connective, pronoun, copula, preposition and other function word around it stays Arabizi, even when the whole sentence is about the procedure. Write `محفزات الكولاجين hia 3ibara 3an إبر`, never `محفزات الكولاجين هي عبارة عن إبر`. A term that runs to several words (`المنطقة حول العينين`, `شد طبيعي للوجه`) switches as one unit, because those words are the term. The rejected alternative was clause-level switching — letting one domain term pull the whole surrounding clause into Arabic script — which was dropped because it makes the script of a word depend on its neighbours rather than on the word, and nothing downstream can predict it.

**A conjunction immediately before such a term fuses into it in Arabic script** (`ومادة الكافيين`), per §2. The term-level rule is untouched by this: the proclitic is part of the token it attaches to, not a separate word whose script a neighbour decided.

**The language of an Arabic-script term is `msa`.** A domain term or
religious formula rendered in Arabic script under this section is tagged
`lang: msa`, whatever the surrounding language. `script` is read off the
characters; `lang` is a property of the word itself. Tagging `الكافيين`
`darija` because the words around it are Darija is exactly the clause-level
reasoning this section already rejects for script — it would make a word's
language depend on its neighbours instead of on the word.

**(b) Genuinely MSA/classical register as spoken:** religious formulas (`بسم الله`, `إن شاء الله` when uttered formally — but casual "nchaalah" in flowing Darija stays Latin: `nchaalah`), Quran/hadith quotes, formal citations, deliberate formal-register switches. Everything conversational stays Latin, even MSA-origin vocabulary used casually. When unsure, prefer Latin and lower the word's confidence so the editor reviews it. The per-word script decision is always editable in the review UI.

### 6c. A term is never broken in the subtitle track

An Arabic-script domain term is one unit and is written whole, however many tokens it runs to: `محفزات الكولاجين`, `تحفيز طبيعي للكولاجين`, `المنطقة حول العينين`. Nothing in the pipeline may split it, re-spell it, or drop part of it from the subtitles.

The **keyword emphasis layer** is a separate matter. Keyword templates are built for one or two short words (TEMPLATE_LIBRARY_GUIDE §4, and §8's own manifest note reads "best on 1 word"), so a term of three or more tokens cannot be emphasized whole. The emphasis layer therefore **selects a subset of the term** — `تحفيز طبيعي` out of `تحفيز طبيعي للكولاجين` — and that subset is what animates on screen.

This selection **does not alter the term**. The subtitle track still renders `تحفيز طبيعي للكولاجين` whole and correctly spelled; emphasis draws attention to part of it and nothing more. A reader who sees only the guide should not conclude that a narrowed keyword is a permitted spelling of the term: it is not a spelling at all, it is a pointer into one.

Recorded here because Block 3 session 4 found the tension between this guide and the template contract and resolved it in the template's favour for emphasis only.

## 7. Cleaning rules (applied as flags, never deletion)

Mark as removed (they won't display, but remain in the Edit Plan):
- Fillers: `euh`, `eh`, standalone repeated `ya3ni`/`za3ma` used as hesitation (kept when meaningful: "ya3ni…" introducing an actual explanation stays).
- Immediate stutters/repetitions: `l- l- lmochkil` → `lmochkil`.
- Abandoned false starts replaced by a restart.
Never remove content words. Never reorder. Never "improve" grammar.

## 8. Punctuation & casing in subtitles

- Groups of 1–2 words carry no terminal punctuation. Question marks allowed on the final group of a clear question. No commas, no ellipses.
- Lowercase by default; capitalize proper nouns and brand names as the client writes them. Arabic script has no casing — never mix scripts inside one word.
- The "never mix scripts inside one word" rule bans a token containing both scripts. It does **not** ban the §2 conjunction fusing into an Arabic-script term: `ومادة` is one word in one script.

## 9. Resolved decisions and remaining work

1. **Resolved — `9` vs `q` for ق.** Always `9`, never `q` (§2).
2. **Resolved — definite article.** Always attached, no space, no hyphen: `lkhdma`, `lmochkil` (§2).
3. **Resolved — frozen spellings.** `nchaalah` (not `nchallah`/`inchallah`) and `bzaf` (not `bzzaf`/`bezzaf`) (§4).
4. **Resolved — the §4 freeze list was extended** from the four hand-written ground-truth reels in v1.0.1: every Darija word occurring at least twice and not already frozen was added, one spelling per word. See the v1.0.1 block in §4, including the one entry it overrode.
5. **Resolved — French-influenced spellings.** §5 stands as written: French and English words keep proper spelling with accents (`déjà`, `donc`, `par exemple`); only French roots carrying Darija morphology are written Arabizi (`kanposti`, `tconnecta`).
6. **Resolved (v1.0.7) — the conjunction `w` attaches.** Settled by the user after a listening pass over sixteen flagged tokens in Block 3. Every one was really spoken, and the four references had already been writing the conjunction attached throughout; the transcripts were the side writing it standalone (§2).
7. **Resolved (v1.0.7) — the article on a borrowed noun.** Decided by ear: the token is `dial la vidéo`. A French noun keeps its French article; a French root with Darija morphology takes the attached `l-` (`dial lvitaminat`). §2 and §5 both carry it.
8. **Resolved (v1.0.8) — the conjunction before an Arabic-script term.** It attaches in Arabic script as a proclitic (`ومادة`). Ratified by the user after a mechanical scan found the unfused form in a reference that had been asserting v1.0.7 conformance for a block (§2, cross-referenced from §6 and §8).
9. **Resolved (v1.0.7) — emphasis never breaks a §6 term.** The subtitle track renders the term whole; the keyword layer selects a subset of it because keyword templates hold one or two words (§6c).
