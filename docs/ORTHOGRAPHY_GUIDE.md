# Framopia Studio — Darija Orthography Guide (v1.0)

Status: **v1.0 — frozen for Block 1**. The §9 open questions were resolved with the user; only the freeze-list extension remains, and it lands as v1.0.1 once the ground-truth transcript exists. This document is injected verbatim into every Gemini transcription/correction prompt, so it is written as rules, not prose. **Consistency across videos matters more than any single "correct" spelling.**

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

One spelling per word, always. Starter list (extend in Block 1 from real transcripts):

`wach` (question marker) · `chno` (what) · `3lach` (why) · `kifach` (how) · `fin` (where) · `daba` (now) · `ghadi` / prefix `gha-` (future) · `bghit` (I want) · `kayn` / `kayna` (there is) · `machi` (not) · `walou` (nothing) · `bzaf` (a lot) · `chwiya` (a little) · `mzyan` (good) · `hadchi` (this thing) · `dyal` / `dyali` (of/mine) · `f` (in) · `m3a` (with) · `7ta` (until/even) · `wakha` (okay) · `yallah` (let's go) · `nchaalah` (God willing) · `khassk` (you must) · `3ndi` (I have) · `rah` / `raha` (indeed/it is)

Verb prefixes attach without hyphen: `kan-` (present, 1sg/1pl per context), `kat-`, `kay-`, `gha-`: `kanakol`, `kaykhdem`, `ghanmchiw`.

## 5. Code-switch boundaries

- French/English words keep their standard spelling, **accents included** (`déjà`, `donc`, `par exemple`, `français`), even mid-Darija-sentence: `kanbossti had l'contenu` → write `kan-` verb + French noun as spoken: `kanposter had le contenu` (spelling of the French word wins).
- Darija-ized French verbs (French root + Darija morphology) are written Arabizi with the French root recognizable: `kanposti`, `tconnecta`.
- Proper nouns, brand names, product names: exactly as the client writes them (client-mode vocabulary list is authoritative and overrides everything).

## 6. Latin vs Arabic script — the decision rule

Write in **Arabic script** only when the word/phrase is genuinely MSA/classical register as spoken: religious formulas (`بسم الله`, `إن شاء الله` when uttered formally — but casual "nchaalah" in flowing Darija stays Latin: `nchaalah`), Quran/hadith quotes, formal citations, deliberate formal-register switches. Everything conversational stays Latin, even MSA-origin vocabulary used casually. When unsure, prefer Latin and lower the word's confidence so the editor reviews it. The per-word script decision is always editable in the review UI.

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
4. **Open — extend the §4 freeze list from the ground-truth transcript.** This is the only thing left before the guide is fully closed; it ships as **v1.0.1**. Until then, v1.0 is binding for Block 1 benchmarking.
5. **Resolved — French-influenced spellings.** §5 stands as written: French and English words keep proper spelling with accents (`déjà`, `donc`, `par exemple`); only French roots carrying Darija morphology are written Arabizi (`kanposti`, `tconnecta`).
