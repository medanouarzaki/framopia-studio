# Framopia Studio — Darija Orthography Guide (v1.0.1)

Status: **v1.0.1 — frozen**. All §9 questions are resolved: the freeze list was extended from the four hand-written ground-truth transcripts, closing the last one. This document is injected verbatim into every Gemini transcription/correction prompt, so it is written as rules, not prose. **Consistency across videos matters more than any single "correct" spelling.**

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
- The definite article is **always attached** to its noun, no space and no hyphen: `lkhdma`, `lmochkil`, `ddar`, `chchi`.
- Digits are used **only** for 3/7/9. Never `5` for خ (use `kh`), never `2` for hamza, never `6`/`8`.
- Doubled consonants (shadda) are written doubled when pronounced: `d7akkni`, `hbbal`.

## 3. Vowels

- Short, barely-pronounced schwas are dropped the way Moroccans type: `khdma` not `khedema`, `mzyan` not `meziane` — unless dropping creates an unreadable cluster, then insert `e`.
- Long vowels: `a`, `i`, `ou` (`ou` for /uː/, French habit): `so9`, `bousa`.
- Word-final /a/ from ة: `a` (`khedma`? no — `khdma`; `mdina`).

## 4. High-frequency words — fixed spellings (freeze list)

One spelling per word, always. Where the ground truth spelled a word more than one way, the majority spelling won.

`wach` (question marker) · `chno` (what) · `3lach` (why) · `kifach` (how) · `fin` (where) · `daba` (now) · `ghadi` / prefix `gha-` (future) · `bghit` / `bghiti` (I/you want) · `kayn` / `kayna` (there is) · `machi` (not) · `walou` (nothing) · `bzaf` (a lot) · `chwiya` (a little) · `mzyan` (good) · `hadchi` (this thing) · `f` (in) · `m3a` / `m3aya` (with/with me) · `7ta` (until/even) · `wakha` (okay) · `yallah` (let's go) · `nchaalah` (God willing) · `khassk` (you must) · `3ndi` / `3ndk` / `3ndhom` (I/you/they have) · `rah` / `raha` (indeed/it is)

Added in v1.0.1, from the four ground-truth reels:

`dial` / `diali` / `dialk` (of/mine/yours — the possessive takes its pronoun suffix attached, `dialha`, `dialo`, `dialna`) · `li` (which/who) · `houa` (he/it) · `joj` (two) · `wa7d` (one, also the indefinite article) · `7essa` / `7essass` (session / sessions) · `mabin` (between) · `tal` (up to, until) · `mn` (from) · `3la` (about, on) · `fa` (so, then) · `lyoma` (today) · `yom` (day) · `nhdr` (I talk) · `lik` / `likom` (to you sg/pl) · `lkher` (the end) · `tb3i` (follow — f. imperative) · `kat7taji` (you need — f.) · `kidom` (it lasts)

v1.0.1 replaced `dyal`/`dyali` with `dial`/`diali`: the ground truth wrote `dial` eleven times and `dyal` never, and §4's own rule is that the user's habit wins.

Variants seen in the ground truth and deliberately **not** frozen, because the majority form above supersedes them: `dl`/`dla` (reduced `dial`), `main` (a typo for `mabin`, and it collides with French `les mains`), `ta` (reduced `tal`), `yawm` (→ `yom`), `7sessa` (→ `7essa`). Apostrophes are always straight (`l'ADN`, `l'effet`), never curly.

Verb prefixes attach without hyphen: `kan-` (present, 1sg/1pl per context), `kat-`, `kay-`, `gha-`: `kanakol`, `kaykhdem`, `ghanmchiw`.

## 5. Code-switch boundaries

- French/English words keep their standard spelling, **accents included** (`déjà`, `donc`, `par exemple`, `français`), even mid-Darija-sentence: `kanbossti had l'contenu` → write `kan-` verb + French noun as spoken: `kanposter had le contenu` (spelling of the French word wins).
- Darija-ized French verbs (French root + Darija morphology) are written Arabizi with the French root recognizable: `kanposti`, `tconnecta`.
- Proper nouns, brand names, product names: exactly as the client writes them (client-mode vocabulary list is authoritative and overrides everything).

## 6. Latin vs Arabic script — the decision rule

Write in **Arabic script** in two cases.

**(a) Aesthetic and medical procedure/treatment terms**, even mid-Darija — this is how the terms are actually written and read in the clinic register, and it holds regardless of surrounding language: `شد طبيعي للوجه`, `محفزات الكولاجين`, `الإبرة الحريرية`, `حمض الهيالورونيك`, `ترطيب عميق للبشرة`, `نتائج جد فعالة`. Branded product names and French technical terms are **not** covered by this rule and keep their Latin spelling (`le profhilo`, `les polynucléotides`, `faiblement réticulé`, `la mésothérapie`).

**(b) Genuinely MSA/classical register as spoken:** religious formulas (`بسم الله`, `إن شاء الله` when uttered formally — but casual "nchaalah" in flowing Darija stays Latin: `nchaalah`), Quran/hadith quotes, formal citations, deliberate formal-register switches. Everything conversational stays Latin, even MSA-origin vocabulary used casually. When unsure, prefer Latin and lower the word's confidence so the editor reviews it. The per-word script decision is always editable in the review UI.

## 7. Cleaning rules (applied as flags, never deletion)

Mark as removed (they won't display, but remain in the Edit Plan):
- Fillers: `euh`, `eh`, standalone repeated `ya3ni`/`za3ma` used as hesitation (kept when meaningful: "ya3ni…" introducing an actual explanation stays).
- Immediate stutters/repetitions: `l- l- lmochkil` → `lmochkil`.
- Abandoned false starts replaced by a restart.
Never remove content words. Never reorder. Never "improve" grammar.

## 8. Punctuation & casing in subtitles

- Groups of 1–2 words carry no terminal punctuation. Question marks allowed on the final group of a clear question. No commas, no ellipses.
- Lowercase by default; capitalize proper nouns and brand names as the client writes them. Arabic script has no casing — never mix scripts inside one word.

## 9. Resolved decisions and remaining work

1. **Resolved — `9` vs `q` for ق.** Always `9`, never `q` (§2).
2. **Resolved — definite article.** Always attached, no space, no hyphen: `lkhdma`, `lmochkil` (§2).
3. **Resolved — frozen spellings.** `nchaalah` (not `nchallah`/`inchallah`) and `bzaf` (not `bzzaf`/`bezzaf`) (§4).
4. **Resolved — the §4 freeze list was extended** from the four hand-written ground-truth reels in v1.0.1: every Darija word occurring at least twice and not already frozen was added, one spelling per word. See the v1.0.1 block in §4, including the one entry it overrode.
5. **Resolved — French-influenced spellings.** §5 stands as written: French and English words keep proper spelling with accents (`déjà`, `donc`, `par exemple`); only French roots carrying Darija morphology are written Arabizi (`kanposti`, `tconnecta`).
