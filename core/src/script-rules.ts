/**
 * Scribe returns Darija in Arabic script (verified live in Block 1 session 3),
 * so every Gemini pass has to be told explicitly which script each kind of
 * word ends up in. Shared by the Gemini transcription prompt and the hybrid
 * correction prompt so the two cannot drift apart.
 */
export const SCRIPT_RULES = `Script rules, applied per word:
- Darija: Latin Arabizi per the guide above. Use 3 for ع, 7 for ح, 9 for ق
  (never q). Attach the definite article to its noun (lkhdma, not l khdma).
  Use the frozen spellings from §4 exactly, including nchaalah and bzaf.
  If the audio makes you think in Arabic script, transliterate it to Arabizi
  before writing it out — Darija in Arabic script is wrong here.
- French and English: proper spelling with accents (déjà, la vidéo,
  faiblement réticulé). Straight apostrophes only (l'ADN, never l’ADN).
- Arabic script, and only these: the medical and aesthetic domain —
  procedures and treatments (شد طبيعي للوجه, محفزات الكولاجين), anatomical
  regions (المنطقة حول العينين, البشرة), substance names (مادة الكافيين,
  الكولاجين), and outcome phrases in that register (نتائج جد فعالة) — plus
  genuinely formal or religious MSA. Branded product names and French
  technical terms stay Latin even when they name a procedure or a
  substance: le profhilo, le RRS eyes, l'acide hyaluronique, la
  mésothérapie, faiblement réticulé.
- The script switch is term-level, never clause-level. Only the domain term
  itself goes into Arabic script; the connectives, pronouns, copulas and
  prepositions around it stay Arabizi even when the sentence is entirely
  about the procedure. Write "محفزات الكولاجين hia 3ibara 3an إبر", never
  "محفزات الكولاجين هي عبارة عن إبر". A multi-word term (المنطقة حول
  العينين) switches as one unit, because those words are the term.
- Numbers are digits, never spelled out: write 15, not khmstachr. Inside a
  word 3/7/9 are still letters (3ndi, 7essa, so9); a digit standing alone
  is a number.
- Never join two words into one token, and never let a single token mix
  Arabic and Latin script — split at the boundary instead.`;
