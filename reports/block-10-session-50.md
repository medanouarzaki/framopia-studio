# Block 10 session 50 — she exists, but the reel was transcribed from the wrong audio

**Status: PROBLEM — the pipeline transcribed a different video and I refused to
build from it. $1.01 was spent on a transcript that does not belong to this
reel.**

## The three answers

1. **There is no `.aep`.** The run produced a plan whose words are not in this
   video, so building it would have made a comp that looks right and is not.
2. **It cost $1.006252** — projected $1.36, ceiling $2.50. All-time $17.280669.
   **About $10.18 remains.** Every cent of tonight's run is on the wrong
   transcript.
3. **Her colours are correct and proven** — on the cards and in the pictures.
   That part worked; see below.

## What went wrong

**The audio for a video is named after the video's file, not its contents.**

`extractedAudioPath` (`service/src/transcription/media.ts:73–77`) builds the wav
name from the basename alone — `sora.mov` → `.local/audio/sora.wav` — and
`extractAudio` (line 89) returns any existing file at that path without checking
where it came from:

```ts
const outputPath = extractedAudioPath(inputPath, outputDir);
if (existsSync(outputPath)) return outputPath;
```

Her new reel is called `sora.mov`. So is the 40.5-second reel from
`September Content/Exports/Work in Progress/`, transcribed on 1 September.
`.local/audio/sora.wav` already existed, **40.5405 s**, and was handed to Scribe
as if it were hers.

**Measured, on the plan this run wrote:**

| | |
|---|---|
| the video | **13.514 s** — video, audio and data streams all agree |
| the transcript | **94 words ending at 38.579 s** |
| cards falling entirely past the end of the video | **63 of 94** |
| both keywords | 17.96 s and 21.00 s — **past the end** |
| the two pictures | `img001` 7.26–8.22 s inside; `img002` 12.64–13.58 s straddles the end |
| `.local/audio/sora.wav` | **40.5405 s**, dated 1 September |

The transcript is word-for-word the old reel's, down to the last word `جديدة`
ending at 38.579 s in both plans.

**It also mis-stated the cost.** The Scribe line is `$0.000826`, computed from
the plan's 13.5 s, while 40.5 s of audio was actually sent — so even the ledger
understates what ElevenLabs was asked to do.

## The part that is worse than the money

**Her video's cache now holds the wrong transcript, and a retry would serve it
silently and free.**

`.local/cache/619b8eae…/transcription-f7223549eba265e7/audio.wav` is **40.5405 s**,
and that entry has the **same fingerprint id** as the old reel's, because the
transcription key is built from the audio it was given rather than from the video
it belongs to. The plan records `cacheProvenance: "exact"`.

So a plain re-run of this reel would hit that entry, cost nothing, and produce
the same wrong transcript with nothing saying so. **A correct re-run has to
bypass or redo transcription, and the stale `.local/audio/sora.wav` has to be out
of the way first**, or extraction will hand over the same 40 seconds again.

## What did work

**Dr Loubna Kfafi exists** — `modes/dr-loubna-kfafi.json`, and `listModes`
returns her and K2. K2's file is byte-identical (`c600905c5e36ecbc…`).

Read back off disk through the real loader:

| | |
|---|---|
| palette | `light #FFF4E8` · `accent #E8873A` · `primary #123448` · `background #1C1210` |
| faces | Inter-SemiBold · CormorantGaramondItalic-SemiBoldItalic · Almarai-Bold |

**Checked before a cent was spent**, against her pinned snapshot:

```
sub_pop      face=Inter-SemiBold                        fill=#FFF4E8  shadow=#123448
sub_pop_ar   face=Almarai-Bold                          fill=#FFF4E8  shadow=#123448
kw_slam      face=CormorantGaramondItalic-SemiBoldItalic fill=#E8873A  shadow=#123448
```

and the composed image prompt carried **4 of 4 of hers and 0 of 4 of K2's** —
`#E8873A` and `#FFF4E8` carry the subject, `#123448` for depth, `#1C1210` the
ground. The four pictures that were generated were lit for her brand, which is
the thing session 49 stopped to protect. They are also the only part of this run
worth keeping.

`createClient` takes a Latin and an Arabic face and no more, so the emphasis face
and the PostScript names were copied from K2 after it ran — without the
PostScript names After Effects rejects the family strings and her keywords would
have fallen back to the template's own face. `fonts.note` in her file records
that all three are borrowed and pending his choice. **That is the only edit made
outside the route**, and it is in her file alone.

## The transcript, keywords and pictures — of the wrong audio

Reported because they are what was paid for, not because they describe this reel.

> السلام عليكم أنا الدكتورة لبنى كفافي أخصائية في طب التجميل والتغذية ومؤسسة
> ديال مركز cabinet docteur لبنى كفافي بمدينة مكناس …

Darija in Arabic letters with `cabinet docteur` left in Latin, which is the
orthography working. **Keywords:** `الطب التجميلي` (17.96 s), `الجمال الطبيعي`
(21.00 s). **Pictures:** *The historic city of Meknes* (7.26–8.22 s), *A medical
textbook with a stethoscope resting on it* (12.64–13.58 s).

## What a correct run needs

Not run tonight, because it is a second $1.00 of his money on a defect whose fix
belongs in the code, and because §4 says to report a blocker with the
measurement and stop.

1. **Fix the collision** — derive the audio path from the video's sha256, or
   verify an existing extraction's duration against the video before reusing it.
   One is a rename, the other is three lines; both change where every existing
   plan's `audioPath` points, so it is a change to make deliberately.
2. Move `.local/audio/sora.wav` aside so hers extracts fresh.
3. Re-run with transcription redone rather than cached, and check the new
   `audio.wav` is 13.5 s before anything bills.

Cost of the corrected run: about **$1.00** again — the transcript changes, so the
keywords, the slots and the four pictures all change with it.

## Repo state

Branch `main`, tree clean. **Ledger 145 → 153 lines**,
`d4fe2de37f5eb0c8…` → `caed8af4e3ebceab…`, **$1.006252 added**, every line
verbatim:

```
{"stage":"transcribe-scribe","model":"scribe_v2","unit":"run","usd":0.0008258250000000001,"timestamp":"2026-09-03T23:09:15.611Z"}
{"stage":"transcribe-gemini-correction","model":"gemini-3.1-pro-preview","unit":"run","usd":0.134034,"timestamp":"2026-09-03T23:09:15.614Z"}
{"stage":"analysis-keywords","model":"gemini-3.1-pro-preview","unit":"run","usd":0.20201,"timestamp":"2026-09-03T23:11:19.084Z"}
{"stage":"analysis-slots","model":"gemini-3.1-pro-preview","unit":"run","usd":0.052014000000000005,"timestamp":"2026-09-03T23:11:48.822Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.151522,"timestamp":"2026-09-03T23:12:12.315Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.153442,"timestamp":"2026-09-03T23:12:36.522Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.155602,"timestamp":"2026-09-03T23:13:00.668Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.156802,"timestamp":"2026-09-03T23:13:21.997Z"}
```

`templates/library.aep` `4b0cf05a8f5d4775…` and `modes/k2-syndicalia.json`
`c600905c5e36ecbc…` byte-identical at both ends. His footage was hashed and
probed and never written; nothing was written into his client folder. The new
plan is `.local/plans/sora-6a60ced1.editplan.json` and its cache entries are
kept — the four pictures are paid for. One After Effects instance ran throughout
and was never driven, so no project of his was touched. The service already
running on port 61620 was used rather than taken over.

**No code was changed**, so `npm run check` was not run. `npm run golden` was not
run, as instructed.

## Suggested next step

Fix the audio-path collision first — it is the whole of tonight's loss and it
will hit any two client files that share a name, which is normal for a folder of
exports. Then the reel re-runs for about $1.00 and builds, with her colours
already proven to reach both the cards and the pictures.
