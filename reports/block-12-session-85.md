Status: OK

# Block 12, session 85 — when she says a thing, that thing appears

## 1. Every card, and what it got — before

`sora-1` is one sentence said five times: *ila bghiti [a result], khaskek [a
product]*.

| card | time | text | picture |
|---|---|---|---|
| g001–g003 | 0.08–0.74 | يلا بغيتي شد | — |
| g004–g005 | 1.00–1.84 | خاصك **Sculptra** | img001, her pic014 |
| g006–g007 | 1.94–2.58 | ولا **Lanluma** | — |
| g008–g010 | 2.70–3.56 | يلا بغيتي إشراقة | — |
| g011–g012 | 3.74–4.44 | خاصك **Pluryal** | img002, generated |
| g013–g015 | 4.52–5.40 | يلا بغيتي ترطيب | — |
| g016–g017 | 5.48–6.26 | خاصك **Profhilo** | **—** |
| g018–g020 | 6.36–7.16 | يلا بغيتي تحديد | — |
| g021–g022 | 7.32–8.40 | خاصك **Radiesse** | img003, her pic011 |
| g023–g025 | 8.44–9.30 | يلا بغيتي volume | — |
| g026–g027 | 9.36–10.04 | خاصك **filler** | — |

**27 cards, 3 pictures.** Six things named, three shown.

The four he asked about:

| product | in the transcript | a label matched | what happened |
|---|---|---|---|
| **Sculptra** | `Sculptra` | `pic014` | placed |
| **Planiti** | **`Lanluma`** | none — the word was never there | nothing looked for |
| **Pluryal** | `Pluryal` | no label | generated, and he is happy with it |
| **Profhilo** | `Profhilo` | `pic010` | **nothing at all** |

## 2. Where Profhilo was lost, exactly

The word **was** transcribed, correctly, at 5.80 s. The label **does** exist —
`pic010`, labelled `profhilo`. Neither was the problem.

`fillSlotsFromClientPictures` fills slots that already exist. It is handed
`slots`, and slots come from the model's selection capped by
`imageSlotCountFor`. **No slot ever spanned word `w0016`**, so the matcher was
never asked about Profhilo. Session 53's rule was not wrong and did not
misfire — it was never given the word.

That is also why nothing was generated for it: a card with no slot has no idea,
no prompt and no candidate. One decision upstream of both paths removed it from
each.

## 3. What decides which cards get a picture

**`IMAGE_SLOTS_PER_30S = 8`**, in `service/src/analysis/count.ts`. For a 10.2 s
reel: `(10.2 / 30) × 8 = 2.72`, rounded to **3**.

The number is **Mohamed's ruling of 2026-08-29**, amending PROJECT_SPEC §5's band
of 5–6: he watched a built reel and asked for more. It is a *density* — pictures
per second of clock — and a client may override it with `imageSlotsPer30s`.

**I have not changed it, and could not justify changing it without pointing at
this video.** It is the right rule for what it was made for: generated pictures
cost money and a reel that flashes one every second is unwatchable. It is the
wrong rule for a picture the client has already given us, and that is the
distinction this session acts on rather than the number.

## 4. The transcript, before and after the labels

Scribe's own output, before correction, with 15 keyterms:

> Ila bghiti shed khaskek sculptra **wela planiti**. Ila bghiti ishraqa khaskek
> pluri-al. Ila bghiti tartib khaskek profhilo. Ila bghiti tahdid khaskek
> radiesse. Ila bghiti volume khaskek filler

**Before** (no keyterms):

> يلا | بغيتي | شد | خاصك | Sculptra | ولا | **Lanluma** | يلا | بغيتي | إشراقة | خاصك | Pluryal | يلا | بغيتي | ترطيب | خاصك | Profhilo | يلا | بغيتي | تحديد | خاصك | Radiesse | يلا | بغيتي | volume | خاصك | filler

**After** (15 keyterms from her labels):

> إيلا | بغيتي | شد | خاصك | Sculptra | ولا | **Planiti** | إيلا | بغيتي | إشراقة | خاصك | Pluryal | إيلا | بغيتي | ترطيب | خاصك | Profhilo | إيلا | بغيتي | تحديد | خاصك | Radiesse | إيلا | بغيتي | volume | خاصك | filler

Every difference: `Lanluma → Planiti`, and `يلا → إيلا` five times, a spelling of
the same word.

**The mechanism already existed and had never worked.** `keyterms` was reachable
only from `npm run transcribe --keyterms <file>`, a file kept by hand, and the
first run ever to pass any got this back:

```
All keywords must be less than 50 characters.
```

Fifteen words of four to nine characters, refused for being one string of a
hundred and thirty: the form field carried `JSON.stringify(keyterms)`, so the API
read the whole list as a single keyword. One field per keyterm now.

**What it costs:** the scribe call carries a 20% surcharge with keyterms —
$0.000624 → $0.000749, **+$0.000125** for this reel. The Gemini correction is
unchanged. The keyterms are part of the cache fingerprint, so this reel was
re-transcribed rather than reused, which is why the transcription lines are in
§11.

## 5. What stops a label being put in her mouth

Three things, and the third is measured:

1. **Scribe treats keyterms as a bias, not a substitution** — a term that is not
   said does not appear.
2. **The correction prompt says so in words**: `Keyterms to recognize accurately
   **if spoken**`. That sentence is now pinned by a test, because it is the whole
   of the instruction.
3. **Measured on this reel: 15 keyterms went in, 4 came out.** `sculptra`,
   `planiti`, `profhilo` and `radiesse` are in the transcript because she says
   them. `ejal40`, `gana`, `gouri`, `hyalift`, `lola`, `neauvia`, `stimulate`,
   `opera`, `structura`, `regenera` and `restylane` are **not**, and none was
   inserted anywhere.

`measureTokenDrift` still watches the whole rewrite on top of that.

## 6. The rebuild

Priced at $1.4354 before starting, against a $4.00 ceiling. **Actual: $0.512445.**

| | session 84 | now |
|---|---|---|
| subtitle cards | 27 | 27 |
| cards naming something a label matches | 3 | **4** |
| pictures | 3 | **5** |
| from her own store | 2 | **4** |
| generated | 1 | 1 |
| sounds | 3 | 5 |

| product | session 84 | now |
|---|---|---|
| **Sculptra** | her pic014 | her pic014 |
| **Planiti** | heard as "Lanluma", nothing | **her pic008** |
| **Pluryal** | generated | generated, the same picture he approved |
| **Profhilo** | **nothing** | **her pic010** |

The five, in order, with no overlaps:

```
img001  0.98- 2.18  her pic014   خاصك Sculptra ولا Planiti
img005  2.18- 2.58  her pic008   Planiti
img002  3.74- 4.44  generated    خاصك Pluryal
img004  5.82- 6.30  her pic010   Profhilo
img003  7.32- 8.40  her pic011   خاصك Radiesse
```

Built in **Dr Loubna Kfafi's** own colours, from her pinned snapshot.

**Two fixes were needed, not one.** Profhilo needed a slot the clock had no room
for. Planiti needed something else: the word fell *inside* img001, which was
showing Sculptra — spanning a word is not the same as showing its picture. A
covering slot now settles a word only when it already shows what that word names,
and otherwise gives up the time from that word onward.

**Three refusals along the way, all of them the tool being careful**, and each is
reported rather than smoothed over:

- The transcript changed, so it refused to discard two chosen pictures. `force`
  existed on `transcribeVideo` and `RunPipelineOptions` had no way to express it,
  so the refusal said *"Re-run with --force"* — a flag reachable only from a
  terminal, which the panel cannot pass. It can now.
- Re-planning would have discarded the two generated Pluryal candidates and
  re-billed for them. **I did not force that**: he said he is happy with that
  picture, and re-requesting the idea would have returned a different one. The
  split was applied to the plan that exists, through the same function the
  pipeline calls, at no cost.
- The build then refused: `image img005: no templateId`. That one was mine —
  applying the post-processing by hand skipped the template and SFX derivation
  that follows it inside `job.ts`. Running those two steps as well, from the same
  functions, produced five templates and five SFX events, and the build went
  through. It is a real gap that the post-processing cannot be re-applied without
  re-planning, and it is listed as open.

## 7. Where the `.aep` is

**`/Volumes/T7 Shield/INSEA/Projects/framopia-studio/.local/build/sora-1-8bcbfc38-full.aep`**
— 4,240,507 bytes, written 2026-09-10 19:33:59.

## 8. The picture-vs-speaker rule — session 84 was wrong

**It is applied, to every reel the panel builds, and it is a hard stop.** My own
session-84 report said it was off, and that was wrong.

`zoneId` is a separate, older field for manually-placed zones. Nothing in the
build reads it, which is what I measured and then misread. Placement is computed
in `build-reel-cli.ts` from the reel's own face masks — *"the largest square in
the free band around the speaker's face, preferring the one above it"* — and
checked frame by frame:

> `img00N: this picture would cover the speaker's face in N of M frames of its
> life, so nothing was built` — then `process.exit(1)`.

So a build that finishes is a build in which every picture cleared her face in
every frame of its life. Session 84's build finished; **this session's build
finished with five pictures**, two of them new.

Across every plan on this machine: `test 1` (4 of 4) and `vitasilk` (5 of 5)
carry `zoneId`s from the manual placement CLIs; **every other plan carries none,
including the corpus reel `ground truth` (0 of 6)**. So the unused field is not
"off for new videos only" — it is unused everywhere, and it is not the rule.

Nothing was changed here.

## 9. Every new assertion, red then green

**Seven added to `service/src/analysis/client-picture-slots.test.ts`.** Red with
the word loop emptied:

```
 × adds a slot for a word no planned slot covers
   → expected [] to deeply equal [ { slotId: 'img001', …(2) } ]
 × places a picture once however often the word is said
   → expected [] to have a length of 1 but got +0
 × gives every added slot a picture and no prompt
   → expected [] to have a length of 2 but got +0
 × keeps the slots in the order they are spoken
   → expected [] to deeply equal [ 'pic014', 'pic010' ]
   Tests  4 failed | 12 passed (16)
```

**Six added to `core/src/client-picture-match.test.ts`.** Red with the label
words not gathered:

```
 × are every word on every label, once each
   → expected [] to deeply equal [ 'profhilo', 'neauvia', 'stimulate' ]
 × does not repeat a word two pictures share
   → expected [] to deeply equal [ 'profhilo', 'structura' ]
 × puts a reel’s own pictures before the client’s
   → expected [] to deeply equal [ 'planiti', 'profhilo' ]
   Tests  3 failed | 22 passed (25)
```

**One rewritten into two.** `leaves a word a planned slot already covers alone`
asserted the behaviour this session deliberately changed — under the new rule a
slot that spans a word without showing its picture gives it up. It is now
`leaves a word alone when its slot already shows its picture` and `gives a word
its own slot when the covering slot shows something else`, plus `ends the
covering slot where the new one starts, so nothing overlaps`.

**Two rewritten in the gate, both red for the tool working.** The money banner
renders six decimals and the test compared two with `toContain`: `$18.83` is a
prefix of `$18.832129`, so it passed by luck, and `$19.95` is a prefix of nothing
in `$19.946952`. And grouping the ledger asserted two sums were the same float;
`sumUsd` rounds once at the end, so 178 values grouped differently differ by a
millionth of a dollar. Both now assert the property, and `puts every charge in
exactly one group of each kind` was added, which no arithmetic can fudge.

## 10. Gates, and part 0 at both ends

| gate | result |
|---|---|
| `npm run golden` | **PASS** — 4 of 4, **17,174 fields**, unmoved |
| `npm run check` | **exit 0**, run alone, after committing |
| panel suite ×5 | exit **0, 0, 0, 0, 0** — 285 passed + 2 skipped |

| package | session 84 | now | difference |
|---|---|---|---|
| core | 840 / 0 / 840 | **847** / 0 / 847 | **+7** (6 keyterm + 1 grouping) |
| service | 1474 / 0 / 1474 | **1483** / 0 / 1483 | **+9** (7 added, 1 rewritten into 3) |
| benchmarks | 173 / 0 / 173 | 173 / 0 / 173 | — |
| panel | 285 / 2 / 287 | 285 / 2 / 287 | — (one assertion changed, none added) |
| tools/cv (pytest) | 149 | 149 | — |

Golden did not move: the matcher change adds slots only where a client's label
matches a spoken word, and no corpus reel's client has a labelled picture.

### Part 0, at both ends

| measurement | start | end |
|---|---|---|
| ledger | 172 lines, `fd47e5532815df71` | **178 lines, `72afc73f3506ca46`** |
| `templates/library.aep` | `4b0cf05a8f5d4775c03e…` | `4b0cf05a8f5d4775c03e…` |
| `modes/dr-loubna-kfafi.json` | `bbda3d30daa1ae3e`, Sep 9 23:22:51 | unchanged |
| `modes/k2-syndicalia.json` | `572e99bf890ceefb`, Sep 9 21:58:19 | unchanged |
| `assets/client-pictures/` | 14 files, 25,499,397 bytes | unchanged |
| services | pid 32736, is the handshake pid | identical, untouched |
| After Effects | 1 instance, 0 `aerender` | 1 instance, 0 `aerender` |
| extensions folder | one symlink, Aug 27 19:06:47 | unchanged |
| working tree | clean | clean |

`.local/cache` 168 → 176, where the new transcript and analysis entries landed.
Everything else unchanged. Neither client file was written to;
`templates/library.aep` did not move; no service Mohamed started was stopped;
After Effects was neither launched nor quit.

## 11. Every ledger line added, verbatim

```
{"stage":"transcribe-scribe","model":"scribe_v2","unit":"run","usd":0.0007511949133333334,"video":"725db503fc521e738889c57babf2befbc348cf956476a16dc57afbae479e3402","purpose":"client-work","timestamp":"2026-09-10T18:26:12.105Z"}
{"stage":"transcribe-gemini-correction","model":"gemini-3.1-pro-preview","unit":"run","usd":0.057558000000000005,"video":"725db503fc521e738889c57babf2befbc348cf956476a16dc57afbae479e3402","purpose":"client-work","timestamp":"2026-09-10T18:26:12.107Z"}
{"stage":"analysis-keywords","model":"gemini-3.1-pro-preview","unit":"run","usd":0.06691,"client":"dr-loubna-kfafi","video":"725db503fc521e738889c57babf2befbc348cf956476a16dc57afbae479e3402","purpose":"client-work","timestamp":"2026-09-10T18:28:15.327Z"}
{"stage":"analysis-slots","model":"gemini-3.1-pro-preview","unit":"run","usd":0.082742,"client":"dr-loubna-kfafi","video":"725db503fc521e738889c57babf2befbc348cf956476a16dc57afbae479e3402","purpose":"client-work","timestamp":"2026-09-10T18:29:05.392Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.149602,"client":"dr-loubna-kfafi","video":"725db503fc521e738889c57babf2befbc348cf956476a16dc57afbae479e3402","purpose":"client-work","timestamp":"2026-09-10T18:29:26.076Z"}
{"stage":"images-generate","model":"gemini-3-pro-image","unit":"image","usd":0.154882,"client":"dr-loubna-kfafi","video":"725db503fc521e738889c57babf2befbc348cf956476a16dc57afbae479e3402","purpose":"client-work","timestamp":"2026-09-10T18:29:46.596Z"}
```

**Six lines, $0.512445**, against an expected $3.00 and a ceiling of $4.00.
Ledger 172 → 178, `fd47e5532815df71` → `72afc73f3506ca46`; total $19.434507 →
$19.946952, and the difference is $0.512445 exactly.

**Re-paid deliberately, and why:** the transcription, because the keyterms are
part of the cache fingerprint and the point of the session was to hear "Planiti";
the analysis, because it keys on the transcript, which changed. **Not re-paid:**
the Pluryal picture he approved — the split was applied without re-planning
precisely so it would survive. The second and third runs cost $0 on cache hits.

## What is open

- **Cards naming something with no label still get nothing** — `filler`,
  `volume`, and the five result words. They need *generated* pictures, which the
  density rule governs, and that number is Mohamed's ruling. Six things named,
  five shown; the sixth, `filler`, has no label.
- **Slot post-processing cannot be re-applied without re-planning**, which would
  re-request ideas from the model and re-bill. This session went around it by
  running the same functions over the existing plan; the pipeline itself cannot.
- **A stage that threw is still marked `done`** with nothing on the plan — from
  session 84, unfixed.
- The too-deep folder warning still only knows footage already made into a reel
  (80); a machine that cannot bind loopback starts unguarded (79); the real
  sidecar's abort is unproven-fixed (78).
