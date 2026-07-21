# Understanding & Segmentation Prompt — spec §11.3

You are given:
- A corrected transcript (JSON-encoded segments with text, start/end times, and script hints)
- A word list (JSON array of `{word, script, start, end, segment_index}` objects with global indices 0…N-1)
- An operator brief for domain context (brand names, product names, campaign intent)

Your task: produce a JSON object with:

## 1. `summary` (string)
One paragraph summarising the core message of the reel. Write as a producer briefing a video editor — concise, punchy, audience-aware.

## 2. `segments` (array)
Break the transcript into semantic segments at clause or sentence boundaries. For each segment output:

- `index` (int): segment index starting at 0, incrementing by 1
- `text` (string): the segment's text, copied verbatim from the transcript
- `start` (float): start time in seconds (from the word timings of the first word in this segment)
- `end` (float): end time in seconds (from the word timings of the last word in this segment)
- `visual_intent` (string): What the viewer should SEE during this segment. Write a short noun phrase describing a concept, product, or data point to illustrate (e.g. "show product packaging", "display 300 dirham price text", "close-up of coffee cup"). If nothing should illustrate this moment — speaker is talking without a visual hook — write exactly: `"speaker only"`
- `emphasis_word_indices` (array of int): Global indices (into the provided word list) of the EMPHASIS words in this segment. Emphasis words are: **NOUNS**, **NUMBERS**, **BRAND AND PRODUCT NAMES**, and **PUNCHY VERBS**. Choose indices only from real words in the word list — do not invent indices outside the range 0…N-1.

## Rules

- `visual_intent` must NEVER be empty or null. If no visual is appropriate, use exactly `"speaker only"`.
- `emphasis_word_indices` must only contain real indices from the word list you were given (0-based, 0 to N-1). Do not include filler words, conjunctions, articles, or prepositions as emphasis.
- Focus emphasis on NOUNS, NUMBERS, BRAND AND PRODUCT NAMES, and PUNCHY VERBS — not on particles, connectors, or repeated function words.
- Segments should cover meaningful speech units (clause or sentence level), not single words.
- If a word is both a noun and a brand name, include it once.

## Output format

Respond with ONLY the JSON object — no markdown fences, no explanatory text, no preamble.

```
{
  "summary": "One paragraph summary of the reel message.",
  "segments": [
    {
      "index": 0,
      "text": "...",
      "start": 0.0,
      "end": 1.5,
      "visual_intent": "show product packaging",
      "emphasis_word_indices": [0, 2, 5]
    },
    {
      "index": 1,
      "text": "...",
      "start": 1.5,
      "end": 3.0,
      "visual_intent": "speaker only",
      "emphasis_word_indices": [6]
    }
  ]
}
```
