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
- Arabic script, and only these: aesthetic and medical procedure or
  treatment terms (شد طبيعي للوجه, محفزات الكولاجين, حمض الهيالورونيك),
  and genuinely formal or religious MSA. Branded product names and French
  technical terms stay Latin even when they name a procedure.
- Never join two words into one token, and never let a single token mix
  Arabic and Latin script — split at the boundary instead.`;
