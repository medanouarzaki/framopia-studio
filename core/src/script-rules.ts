/**
 * Scribe returns Arabic in Arabic script, so every Gemini pass has to be told
 * explicitly which script each kind of word ends up in. Shared by the Gemini
 * transcription prompt and the hybrid correction prompt so the two cannot drift
 * apart.
 *
 * **These are ORTHOGRAPHY_GUIDE's rules restated, and they must track it.** The
 * guide is injected verbatim into the same prompt; this block exists because a
 * rule stated once inside a long reference document is followed by chance, and
 * these are the ones a draft gets wrong. Nothing in the transcription
 * fingerprint covers this text — it keys on the guide's version — so a change
 * here that the guide does not carry would be invisible to the cache. Change
 * the guide and this together, or neither.
 *
 * Rewritten at guide v2.0.0: until then it instructed the opposite, that Darija
 * be transliterated into Latin Arabizi and that Arabic script was reserved for a
 * named medical domain.
 */
export const SCRIPT_RULES = `Script rules, applied per word:
- Arabic — Darija, MSA, any register — is written in Arabic letters. If the
  draft hands you Arabizi, convert it: 3 to ع, 7 to ح, 9 to ق, 5 or kh to خ,
  2 to ء, ch to ش, gh to غ. 3ndk becomes عندك, 7essa becomes حصة, chno
  becomes شنو. Never write Darija in Latin letters.
- Write the Darija word that was spoken, in Arabic letters. Do not rewrite it
  into Modern Standard Arabic: كنقولو, not نقول. دابا, not الآن. Rewriting
  Darija as MSA is a translation, and translation is forbidden.
- No vocalisation. Harakat are not written, except inside a religious
  quotation.
- French and English keep their own spelling, with accents: la vidéo,
  les cernes pigmentés, faiblement réticulé, serum. Straight apostrophes only
  (l'ADN, never l'ADN with a curly mark).
- A borrowed word takes the script of the language it is being spoken as. With
  Arabic grammar it is Arabic (النورمال, الفيتامينات, كنبوسطي); with a French
  or English article or plural it is Latin (le normal, la vidéo, les cernes).
  When neither is clear, write it in Latin.
- Brand and product names are written exactly as their owner writes them, in
  whatever script that is: Profhilo, RRS Eyes, Vita Silk. Never transliterate
  a brand.
- Numbers are digits, and Western digits 0-9 rather than ٠-٩: write 15 يوم,
  never خمستاشر يوم and never ١٥. Inside an Arabizi draft word 3/7/9 are
  letters to convert; a digit standing alone is a number.
- Never join two words into one token, and never let a single token mix Arabic
  and Latin script — split at the boundary instead.`;
