# Block 10 session 51 — her reel is built

**Status: OK.**

## The three answers

1. **`.local/build/sora-6a60ced1-full.aep`**
2. **$1.551460 tonight for this run**, $2.557712 across sessions 50 and 51.
   **About $8.63 remains.** All-time $18.832129.
3. **Every card falls inside the 13.514 s** — 0 of 31 layers end past it, the
   latest out point is 13.219 s, and the colours are hers with **no K2 colour on
   any layer**.

## The comp

37 layers: **27 cards, 4 pictures, 4 sounds, 1 watermark** (medium, top-right).

| slot | in | out | gap to next | px | starts on |
|---|---:|---:|---:|---:|---|
| img001 | 0.259 | 3.359 | **0.000** | 989 | `Botox` |
| img002 | 3.359 | 6.440 | **0.000** | 1017 | `جوج` |
| img003 | 6.440 | 10.760 | **0.000** | 1013 | `Skinbooster` |
| img004 | 10.760 | 13.219 | — | 1017 | `Regenera` |

Largest gap anywhere: **0.00e+0**. Every layer `stretch = 100`. Every picture is
clear of her at every frame of its life — the build asserts it per frame and
refuses otherwise, and it exited 0 with no refusal. Each picture starts on the
word that names it.

**The colours on the text layers**, read out of the comp:

| | count | |
|---|---:|---|
| `#123448` | 27 | hers — the shadow behind every word |
| `#FFF4E8` | 25 | hers — ordinary words |
| `#E8873A` | 2 | hers — the emphasised words |

**K2 colours found: none.** All four of her hexes are in the image prompt and
none of K2's, so the four pictures were lit for her brand.

Type: 27 cards, 25 on one line at full size, 0 broken onto two, **2 shrunk**
(smallest ×0.7412) — shrink-to-fit doing its job, not a fault.

## The transcript

> Botox كنديروه مرة كل 6 شهور Sculptra كنديرو جوج الحصص فالسنة Radiesse مرة
> فالسنة Skinbooster جوج الحصص تال 3 فالسنة polynucléotides جوج الحصص فالسنة
> Regenera مرة فسنتين

27 words, last ending at **13.219 s** inside a 13.5135 s video. Darija in Arabic
letters; the treatment names left in Latin. **Keywords:** `Botox` (0.26–0.64 s),
`فسنتين` (12.78–13.22 s).

**Picture ideas:** a Botox vial beside a cosmetic syringe · a yearly planner with
two dates circled · a close-up of intensely hydrated skin · the Regenera Activa
device.

## What was wrong, and what fixed it

**The extracted audio was named from the video's filename.** Two videos called
`sora.mov` shared one wav, so session 50 transcribed 40.5 s of the other reel
and paid $1.01 for a transcript ending 25 seconds past the end of this video.

`extractedAudioPath` now names it from the video's **sha256**, which is already
computed before the call because it keys the cache — `sora-619b8eaecae4.wav`.
The readable name is kept so `.local/audio/` is still legible. And `extractAudio`
now **checks an existing extraction against the video's own duration** before
handing it to a paid call; a mismatch is re-extracted and logged. The name should
make that unreachable, but the thing it guards is money.

**The six existing plans do not re-bill.** On their next run the new hashed name
does not exist, so the transcription cache restores `audio.wav` into it — no
ffmpeg, no API call — and transcription then hits its own entry. Every one of the
six was checked and has both a transcription entry and its `audio.wav`. `npm run
golden` was not run because nothing a plan records moved.

**The transcription cache key was never the problem.** The entry lives at
`<videoSha256>/transcription-<config>/`, so it is already scoped by video; the
fingerprint is prompt version, model, guide version and keyterms. The wrong
transcript landed under her hash because the *audio* was wrong, not the key.

**A test that fails if two same-named videos share an extraction** —
`audio-path.test.ts`, six cases, two of them making real files of different
lengths with the same name and running the real ffmpeg. Proved by restoring the
defect: **three went red**, including the end-to-end one reporting 4.0 s where
1 s was expected. Restored and confirmed clean.

`job.test.ts` stubbed `extractAudio` with a hard-coded `vitasilk.wav`; those
stubs now derive the path the way production does, so they no longer pin the
collision. **`npm run check`: PASS, exit 0** — core 758, service 1293,
benchmarks 173, panel 220 (2 skipped). It failed once first, on those three
stubs, which is the change being caught rather than a fault.

## The second collision, found on the way

**`.local/cv/` is keyed by basename too**, and it had already done damage.
`reelMasksDir` and `reelFramesDir` (`frames/segment.ts:68`, `frames/sample.ts:79`)
both use `path.basename`, so both reels shared `.local/cv/sora/`.

Session 50's run re-sampled **her** 28 frames into it but the masks were never
regenerated: **every face mask was dated 1 September** — 81 frames of the *old*
40.5 s reel. The zones stage then skipped this run with *"already done: 28
frames, 18 zones"*, because a frames manifest and a zones file were there.

**Building on that would have placed her pictures against the wrong recording's
face positions** — the same defect as the audio, in the part that decides where a
picture goes. It was caught before the build.

The mixed directory was quarantined and frame analysis re-run for her alone:
**28 frames, 27 face masks, all dated 00:54, 18 zones**, and it cost **$0.00**
because frame analysis is local. Her placement is from her own footage.

**The code fix was not extended to `.local/cv/`**, deliberately. Renaming those
directories moves where all six reels' masks live, which would make golden's four
reels re-analyse and could move image sizes — not a change to make at one in the
morning on production work. **It is still latent: rebuilding the old 40.5 s reel
would write to `.local/cv/sora/` again and clobber hers.**

## What was moved aside, and nothing deleted

| what | where it went | why |
|---|---|---|
| `.local/audio/sora.wav`, 40.5405 s | `.local/audio/sora-344265a03251.wav` | it is the old reel's, and that is exactly the name the fixed code now derives for it |
| `.local/cache/619b8eae…/transcription-f7223549eba265e7/` | `.local/quarantine-session51/her-hash--transcription-…` | the wrong transcript under her hash, marked `exact` |
| `.local/cv/sora/` | `.local/quarantine-session51/cv-sora-mixed-old40s-masks-and-her28-frames` | her frames with the old reel's masks |
| her old plan | `.local/quarantine-session51/sora-6a60ced1.editplan.json` | wrong transcript, keywords and slots |

**The old reel's own plan and cache are untouched** — `sora-995f2d27` and all 26
entries under `344265a032…`, including its transcription.

**The four pictures session 50 paid for could not survive** and were rebought.
The image cache fingerprint includes the composed prompt, which contains the idea,
which comes from the transcript — a new transcript is a new fingerprint. That was
established before spending. They are still on disk under her hash.

## The money

Ledger **153 → 165 lines**, `caed8af4e3ebceab…` → `786497a5f371d179…`, **twelve
lines, $1.551460**:

```
{"stage":"transcribe-scribe","model":"scribe_v2","unit":"run","usd":0.0008258250000000001,"timestamp":"2026-09-03T23:44:46.668Z"}
{"stage":"transcribe-gemini-correction","model":"gemini-3.1-pro-preview","unit":"run","usd":0.134806,"timestamp":"2026-09-03T23:44:46.669Z"}
{"stage":"analysis-keywords","model":"gemini-3.1-pro-preview","unit":"run","usd":0.084386,"timestamp":"2026-09-03T23:45:27.944Z"}
{"stage":"analysis-slots","model":"gemini-3.1-pro-preview","unit":"run","usd":0.101918,"timestamp":"2026-09-03T23:46:17.027Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.14781,"timestamp":"2026-09-03T23:46:38.591Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.15141,"timestamp":"2026-09-03T23:47:01.526Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.163762,"timestamp":"2026-09-03T23:47:24.042Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.158602,"timestamp":"2026-09-03T23:47:44.027Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.150702,"timestamp":"2026-09-03T23:48:05.005Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.14794200000000002,"timestamp":"2026-09-03T23:48:28.838Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.153808,"timestamp":"2026-09-03T23:48:49.134Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.15548800000000002,"timestamp":"2026-09-03T23:49:11.350Z"}
```

**It came to $1.55, not the $1.00 estimated.** The correct transcript yields
**4 slots, so 8 pictures**, where session 50's wrong 40-second transcript yielded
2 slots and 4. Under this session's $2.00 ceiling; the estimate was low because it
was built on the wrong transcript's slot count. Frame analysis and the re-run of
it cost nothing.

## Repo state

Branch `main`, tree clean. `templates/library.aep` `4b0cf05a8f5d4775…`,
`modes/k2-syndicalia.json` `c600905c5e36ecbc…` and `modes/dr-loubna-kfafi.json`
`f60749f5629b2ced…` all byte-identical at both ends — her client was not
recreated or edited. The old reel's plan `54dd97fce4708eeb…` unchanged. His
footage was hashed and probed, never written; nothing was written into his client
folder. One After Effects instance throughout, never driven except by the build,
and no project of his was saved. The service was restarted with `--force` so it
ran the fixed build.

## Suggested next step

Extend the fix to `.local/cv/`, with golden run alongside it. Until then,
rebuilding the old 40.5-second `sora.mov` will overwrite her masks and the next
build of her reel would place pictures against his footage — the same fault, one
directory over.
