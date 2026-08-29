Status: OK

# Block 9 session 5 — the type is measured, and I drove After Effects to do it

**Spent $0.00. No API was called.** No transcription, correction, analysis or
image generation ran.

**After Effects was driven, for the first time in this project's history from a
session rather than by hand** — AppleScript `DoScript` into the already-running
instance. It was never launched, never quit, no project was closed, no `aerender`
and no `-r` process existed at any point, and nothing was saved.

## 1. Stop conditions

| | |
|---|---|
| mount | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio`, `git rev-parse --show-toplevel` agrees |
| ledger at start | **108 lines**, `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, same sha256 — byte-identical |
| cache at start | **36 entries** — 11 transcription, 7 analysis, 4 imageslots, 14 images |
| cache at end | **36 entries, census identical** |
| After Effects at start | **1 instance, pid 79146, started Thu Aug 27 21:00:05** |
| After Effects at end | **1 instance, pid 79146, started Thu Aug 27 21:00:05** — same process |
| `aerender` at start / end | **0 / 0** |
| stray `-r` process | **0** at both ends |

**His project, before and after:**

| | before | after |
|---|---|---|
| name | `(never saved)`, `project.file` is null | `(never saved)` |
| items | 0 | **0** |
| comps | 0 | **0** |
| `framopia_font_probe` present | no | **no** |
| modified | **false** | **true** |

The comp count returned to what it was and the temporary comp is gone.

**His project is now marked modified, and that cannot be undone from a script.**
After Effects sets the flag the moment anything is added, and it is read-only to
scripting — I did not try to clear it. **The project is empty and was never
saved; close it without saving, or undo once.** Nothing of his was in it.

## 2. The AppleScript

For the measurement, verbatim:

```
osascript -e 'tell application "Adobe After Effects 2026" to DoScript "var framopiaDriven = true; $.evalFile(\"/Volumes/T7 Shield/INSEA/Projects/framopia-studio/tools/ae/measure-fonts.jsx\"); framopiaMeasureFonts(true);"'
```

The read-only project probes before and after used the same form with
`framopiaProbeProject`.

**Two things about `DoScript` worth recording**, both measured:

- **It returns a status, not the script's value.** `DoScript "2+2"` gives `0`,
  not `4`. `0` is success, `1` is failure. That is why the established pattern
  in `service/src/build/drive.ts` writes a result file and reads that back.
- **It is synchronous.** `$.sleep(4000)` inside made the call take **4.87 s**.

**And it was blocked when the session began.** The first calls — the project
probe, a trivial file write, `app.version`, `2+2` — all returned `1` and did
nothing at all, with no file written, for several minutes. Then, with nothing
changed on this side, `DoScript "1"` returned `0` and everything worked from
then on. **I do not know why**, and I am not going to invent a reason; the most
likely is that the application was busy or something modal was up and was
dismissed. The operational lesson is in `CLAUDE.md`: **a `DoScript` that returns
`1` did nothing — retry, and conclude nothing about the script.**

## 3. The measurement

`.local/build/font-measurements.json`, whole, from the run that produced the
numbers below:

```json
{
  "ok": true,
  "measuredAt": "Sat Aug 29 2026 23:40:25 GMT+0100",
  "aeVersion": "26.0x67",
  "subtitleSize": 343,
  "keywordSize": 425,
  "installed": {
    "available": true,
    "reason": null,
    "installedCount": 1200,
    "families": [
      {
        "role": "latin",
        "asked": "Inter",
        "found": [
          {
            "postScriptName": "Inter-Thin",
            "base": "Inter",
            "suffix": "Thin"
          },
          {
            "postScriptName": "Inter-ExtraLight",
            "base": "Inter",
            "suffix": "ExtraLight"
          },
          {
            "postScriptName": "Inter-Light",
            "base": "Inter",
            "suffix": "Light"
          },
          {
            "postScriptName": "Inter-Regular",
            "base": "Inter",
            "suffix": "Regular"
          },
          {
            "postScriptName": "Inter-Medium",
            "base": "Inter",
            "suffix": "Medium"
          },
          {
            "postScriptName": "Inter-SemiBold",
            "base": "Inter",
            "suffix": "SemiBold"
          },
          {
            "postScriptName": "Inter-Bold",
            "base": "Inter",
            "suffix": "Bold"
          },
          {
            "postScriptName": "Inter-ExtraBold",
            "base": "Inter",
            "suffix": "ExtraBold"
          },
          {
            "postScriptName": "Inter-Black",
            "base": "Inter",
            "suffix": "Black"
          },
          {
            "postScriptName": "InterItalic-ThinItalic",
            "base": "InterItalic",
            "suffix": "ThinItalic"
          },
          {
            "postScriptName": "InterItalic-ExtraLightItalic",
            "base": "InterItalic",
            "suffix": "ExtraLightItalic"
          },
          {
            "postScriptName": "InterItalic-LightItalic",
            "base": "InterItalic",
            "suffix": "LightItalic"
          },
          {
            "postScriptName": "Inter-Italic",
            "base": "Inter",
            "suffix": "Italic"
          },
          {
            "postScriptName": "InterItalic-MediumItalic",
            "base": "InterItalic",
            "suffix": "MediumItalic"
          },
          {
            "postScriptName": "InterItalic-SemiBoldItalic",
            "base": "InterItalic",
            "suffix": "SemiBoldItalic"
          },
          {
            "postScriptName": "InterItalic-BoldItalic",
            "base": "InterItalic",
            "suffix": "BoldItalic"
          },
          {
            "postScriptName": "InterItalic-ExtraBoldItalic",
            "base": "InterItalic",
            "suffix": "ExtraBoldItalic"
          },
          {
            "postScriptName": "InterItalic-BlackItalic",
            "base": "InterItalic",
            "suffix": "BlackItalic"
          },
          {
            "postScriptName": "InterTight-Thin",
            "base": "InterTight",
            "suffix": "Thin"
          },
          {
            "postScriptName": "InterTight-ExtraLight",
            "base": "InterTight",
            "suffix": "ExtraLight"
          },
          {
            "postScriptName": "InterTight-Light",
            "base": "InterTight",
            "suffix": "Light"
          },
          {
            "postScriptName": "InterTight-Regular",
            "base": "InterTight",
            "suffix": "Regular"
          },
          {
            "postScriptName": "InterTight-Medium",
            "base": "InterTight",
            "suffix": "Medium"
          },
          {
            "postScriptName": "InterTight-SemiBold",
            "base": "InterTight",
            "suffix": "SemiBold"
          },
          {
            "postScriptName": "InterTight-Bold",
            "base": "InterTight",
            "suffix": "Bold"
          },
          {
            "postScriptName": "InterTight-ExtraBold",
            "base": "InterTight",
            "suffix": "ExtraBold"
          },
          {
            "postScriptName": "InterTight-Black",
            "base": "InterTight",
            "suffix": "Black"
          }
        ]
      },
      {
        "role": "emphasis",
        "asked": "Cormorant Garamond",
        "found": [
          {
            "postScriptName": "CormorantGaramond-Light",
            "base": "CormorantGaramond",
            "suffix": "Light"
          },
          {
            "postScriptName": "CormorantGaramond-Regular",
            "base": "CormorantGaramond",
            "suffix": "Regular"
          },
          {
            "postScriptName": "CormorantGaramond-Medium",
            "base": "CormorantGaramond",
            "suffix": "Medium"
          },
          {
            "postScriptName": "CormorantGaramond-SemiBold",
            "base": "CormorantGaramond",
            "suffix": "SemiBold"
          },
          {
            "postScriptName": "CormorantGaramond-Bold",
            "base": "CormorantGaramond",
            "suffix": "Bold"
          },
          {
            "postScriptName": "CormorantGaramond-LightItalic",
            "base": "CormorantGaramond",
            "suffix": "LightItalic"
          },
          {
            "postScriptName": "CormorantGaramondItalic-Italic",
            "base": "CormorantGaramondItalic",
            "suffix": "Italic"
          },
          {
            "postScriptName": "CormorantGaramondItalic-MediumItalic",
            "base": "CormorantGaramondItalic",
            "suffix": "MediumItalic"
          },
          {
            "postScriptName": "CormorantGaramondItalic-SemiBoldItalic",
            "base": "CormorantGaramondItalic",
            "suffix": "SemiBoldItalic"
          },
          {
            "postScriptName": "CormorantGaramondItalic-BoldItalic",
            "base": "CormorantGaramondItalic",
            "suffix": "BoldItalic"
          },
          {
            "postScriptName": "CormorantGaramond-SemiBoldItalic",
            "base": "CormorantGaramond",
            "suffix": "SemiBoldItalic"
          }
        ]
      },
      {
        "role": "arabic",
        "asked": "Almarai",
        "found": [
          {
            "postScriptName": "Almarai-Light",
            "base": "Almarai",
            "suffix": "Light"
          },
          {
            "postScriptName": "Almarai-Regular",
            "base": "Almarai",
            "suffix": "Regular"
          },
          {
            "postScriptName": "Almarai-Bold",
            "base": "Almarai",
            "suffix": "Bold"
          },
          {
            "postScriptName": "Almarai-ExtraBold",
            "base": "Almarai",
            "suffix": "ExtraBold"
          }
        ]
      }
    ]
  },
  "naming": [
    {
      "role": "latin",
      "family": "Inter",
      "style": "Semi Bold",
      "tried": [
        {
          "asked": "Inter-SemiBold",
          "readBack": "Inter-SemiBold",
          "roundTripped": true,
          "threw": null,
          "installed": true
        },
        {
          "asked": "InterTight-SemiBold",
          "readBack": "InterTight-SemiBold",
          "roundTripped": true,
          "threw": null,
          "installed": true
        },
        {
          "asked": "Inter-SemiBold",
          "readBack": "Inter-SemiBold",
          "roundTripped": true,
          "threw": null,
          "installed": true
        },
        {
          "asked": "Inter Semi-Bold",
          "readBack": null,
          "roundTripped": false,
          "threw": "Error: After Effects error: Unable to set “font”. Contains invalid character 32.",
          "installed": false
        }
      ]
    },
    {
      "role": "emphasis",
      "family": "Cormorant Garamond",
      "style": "SemiBold Italic",
      "tried": [
        {
          "asked": "CormorantGaramondItalic-SemiBoldItalic",
          "readBack": "CormorantGaramondItalic-SemiBoldItalic",
          "roundTripped": true,
          "threw": null,
          "installed": true
        },
        {
          "asked": "CormorantGaramond-SemiBoldItalic",
          "readBack": "CormorantGaramond-SemiBoldItalic",
          "roundTripped": true,
          "threw": null,
          "installed": true
        },
        {
          "asked": "CormorantGaramond-SemiBoldItalic",
          "readBack": "CormorantGaramond-SemiBoldItalic",
          "roundTripped": true,
          "threw": null,
          "installed": true
        },
        {
          "asked": "Cormorant Garamond SemiBold Italic",
          "readBack": null,
          "roundTripped": false,
          "threw": "Error: After Effects error: Unable to set “font”. Contains invalid character 32.",
          "installed": false
        }
      ]
    },
    {
      "role": "arabic",
      "family": "Almarai",
      "style": "Bold",
      "tried": [
        {
          "asked": "Almarai-Bold",
          "readBack": "Almarai-Bold",
          "roundTripped": true,
          "threw": null,
          "installed": true
        },
        {
          "asked": "Almarai-Bold",
          "readBack": "Almarai-Bold",
          "roundTripped": true,
          "threw": null,
          "installed": true
        },
        {
          "asked": "Almarai Bold",
          "readBack": null,
          "roundTripped": false,
          "threw": "Error: After Effects error: Unable to set “font”. Contains invalid character 32.",
          "installed": false
        }
      ]
    }
  ],
  "unresolvable": {
    "asked": "FramopiaNoSuchFaceZZQX",
    "readBack": "FramopiaNoSuchFaceZZQX",
    "roundTripped": true,
    "threw": null,
    "installed": true,
    "fontBeforeTheAttempt": "Almarai-Bold",
    "verdict": "After Effects accepted a name it does not have and reported it back unchanged"
  },
  "measurements": [
    {
      "role": "latin",
      "fontUsed": "Inter-SemiBold",
      "resolved": true,
      "subtitle": {
        "size": 343,
        "capHeight": 249.5458984375,
        "xHeight": 187.2431640625,
        "oneWordText": "glow",
        "oneWordAdvance": 773.59228515625,
        "oneWordRect": {
          "width": 773.59228515625,
          "height": 323.572265625,
          "top": -249.5458984375,
          "left": -383.02001953125
        },
        "phraseText": "dernière génération",
        "phraseAdvance": 3228.18603515625,
        "phraseRect": {
          "width": 3228.18603515625,
          "height": 336.46826171875,
          "top": -262.44189453125,
          "left": -1618.212890625
        }
      },
      "keyword": {
        "size": 425,
        "capHeight": 309.2041015625,
        "xHeight": 232.0068359375,
        "oneWordText": "glow",
        "oneWordAdvance": 958.53271484375,
        "oneWordRect": {
          "width": 958.53271484375,
          "height": 400.927734375,
          "top": -309.2041015625,
          "left": -474.60498046875
        },
        "phraseText": "dernière génération",
        "phraseAdvance": 3999.93896484375,
        "phraseRect": {
          "width": 3999.93896484375,
          "height": 416.90673828125,
          "top": -325.18310546875,
          "left": -2005.037109375
        }
      }
    },
    {
      "role": "emphasis",
      "fontUsed": "CormorantGaramondItalic-SemiBoldItalic",
      "resolved": true,
      "subtitle": {
        "size": 343,
        "capHeight": 214.375,
        "xHeight": 138.915003922768,
        "oneWordText": "glow",
        "oneWordAdvance": 570.403633181006,
        "oneWordRect": {
          "width": 570.403633181006,
          "height": 345.513556361198,
          "top": -249.130550146103,
          "left": -299.020578566939
        },
        "phraseText": "dernière génération",
        "phraseAdvance": 2351.26504891738,
        "phraseRect": {
          "width": 2351.26504891738,
          "height": 348.027112722397,
          "top": -251.644106507301,
          "left": -1175.3954618834
        }
      },
      "keyword": {
        "size": 425,
        "capHeight": 265.625,
        "xHeight": 172.125004860573,
        "oneWordText": "glow",
        "oneWordAdvance": 706.768399175256,
        "oneWordRect": {
          "width": 706.768399175256,
          "height": 428.114464879036,
          "top": -308.689457178116,
          "left": -370.502009209245
        },
        "phraseText": "dernière génération",
        "phraseAdvance": 2913.37520510331,
        "phraseRect": {
          "width": 2913.37520510331,
          "height": 431.228929758072,
          "top": -311.803922057152,
          "left": -1456.39616695419
        }
      }
    },
    {
      "role": "arabic",
      "fontUsed": "Almarai-Bold",
      "resolved": true,
      "subtitle": {
        "size": 343,
        "capHeight": 245.588007032871,
        "xHeight": 181.790010631084,
        "oneWordText": "شنو",
        "oneWordAdvance": 639.695032186806,
        "oneWordRect": {
          "width": 639.695032186806,
          "height": 356.377006664872,
          "top": -274.400004088879,
          "left": -322.084510393441
        },
        "phraseText": "ترطيب عميق للبشرة",
        "phraseAdvance": 2962.83401819691,
        "phraseRect": {
          "width": 2962.83401819691,
          "height": 356.377006664872,
          "top": -274.400004088879,
          "left": -1483.80894901976
        }
      },
      "keyword": {
        "size": 425,
        "capHeight": 304.300008714199,
        "xHeight": 225.250013172626,
        "oneWordText": "شنو",
        "oneWordAdvance": 792.625030450523,
        "oneWordRect": {
          "width": 792.625030450523,
          "height": 441.575008258224,
          "top": -340.000005066395,
          "left": -399.074999265373
        },
        "phraseText": "ترطيب عميق للبشرة",
        "phraseAdvance": 3671.15014604107,
        "phraseRect": {
          "width": 3671.15014604107,
          "height": 441.575008258224,
          "top": -340.000005066395,
          "left": -1838.52514502779
        }
      }
    }
  ],
  "note": "Ratios are not computed here. The next session applies them with the user looking at a build; this file is the measurement."
}
```

## 4. What was written, and what was not

### 4.1 The ratios — the consistency gate passed

| | subtitle 343 | keyword 425 |
|---|---:|---:|
| cap height, Inter ÷ Cormorant | 1.16406 | 1.16406 |
| x-height, Inter ÷ Cormorant | 1.34790 | 1.34790 |
| advance, one word (`glow`) | 1.35622 | 1.35622 |
| advance, phrase (`dernière génération`) | 1.37296 | 1.37296 |

**The gate: one word 1.35622 against phrase 1.37296 — 1.234% apart, against a
3% limit. Passed.** The ratios are also identical at 343 and at 425 to five
decimal places, so what was measured is a property of the faces and not of a
size.

**`EMPHASIS_SIZE_RATIO` is now 1.3479**, derived from the **x-height proxy**,
with `CHOSEN, NOT MEASURED` replaced by what was measured, when and on which
host.

**Why x-height.** The three quantities disagree, and choosing between them is a
judgement about what the eye reads as "the same size". The corpus is
lowercase — one Arabizi or French word per card — and apparent size in lowercase
text is governed by the x-height, not the capitals. Advance width, an
independent measure of the same thing, lands within 1.2% of it. Cap height is
the outlier at 1.1641, and it is low because Cormorant is an old-style face
whose capitals are large against its lowercase. **Two measures agreeing against
one is the reason**, and the code says so, along with 1.1641 as the number to
try if an emphasized word reads too large.

### 4.2 `ARABIC_SIZE_RATIO` was deliberately **not** overwritten

The metrics do not reproduce 1.07:

| | ratio |
|---|---:|
| cap height, Inter ÷ Almarai | **1.0161** |
| x-height, Inter ÷ Almarai | **1.0300** |
| in force | **1.07** |

**It stays 1.07, and the measurement is recorded beside it.** Block 6 records
that figure as *"measured by the user, not derived from the metrics: it is a
judgement about how the two faces read side by side."* A metric ratio is not
evidence his eye was wrong, and applying 1.0161 would shrink every Arabic word
on every build by about 4% without him having seen it. That is his call.

**Cormorant does not change what the Arabic companion is sized against**, which
was the specific question. Subtitles pair Inter with Almarai; an Arabic keyword
takes `kw_slam_ar`, which is Almarai again. **The emphasis face never sits
beside Arabic**, so adding it leaves this ratio's reference exactly where it
was.

### 4.3 The name form

**After Effects rejects any font name containing a space.** Writing
`Inter Semi-Bold` to `TextDocument.font` throws `Unable to set "font". Contains
invalid character 32` — three times over, once per face. So the
family-and-style strings this repo stores **cannot reach a text layer at all**.

| role | family and style (kept) | what After Effects takes |
|---|---|---|
| ordinary | Inter Semi-Bold | **`Inter-SemiBold`** |
| emphasis | Cormorant Garamond SemiBold Italic | **`CormorantGaramondItalic-SemiBoldItalic`** |
| Arabic | Almarai Bold | **`Almarai-Bold`** |

**The emphasis family is `CormorantGaramondItalic`, not `CormorantGaramond`** —
a separate family on this machine. `CormorantGaramond-SemiBoldItalic`, the
obvious construction, **does not exist**, and the first run of the script tried
exactly that and nothing else. All three names above were confirmed present in
a listing taken **before anything was written**, which matters for the reason in
§5.

`fonts.postScriptNames` on `modes/k2-syndicalia.json`, **optional with a
default**. The mode is at **version 9**; the family-and-style strings are
untouched.

**The bump invalidates no cache**, checked the same way session 2 checked it:
`keywordModeContentHash` `7756f1e7883417fc`, `slotModeContentHash`
`a654c324f198ed37`, `compositionContentHash` `c5b43f23a3bd4b0b` — all three
unchanged, and a test pins them.

## 5. What an unresolvable name did

**It substituted silently. It did not throw.**

```json
{
  "asked": "FramopiaNoSuchFaceZZQX",
  "readBack": "FramopiaNoSuchFaceZZQX",
  "roundTripped": true,
  "threw": null,
  "fontBeforeTheAttempt": "Almarai-Bold",
  "verdict": "After Effects accepted a name it does not have and reported it back unchanged"
}
```

A name that exists nowhere was accepted, stored, and read back **unchanged**.
Nothing downstream can tell a face that was set from one that was silently
replaced: a comp built with a missing face looks built and is set in the wrong
type.

**Two things follow, and both are done.**

**Round-tripping is not evidence a face resolved.** The script's own rule was
"first candidate that comes back unchanged wins", and by that rule it declared
`CormorantGaramond-SemiBoldItalic` resolved — a face this machine does not have.
The rule is now "round-trips **and** is in `app.fonts.allFonts`".

**The guard is added**, because the brief's first branch is what happened.
`panel/jsx/fonts.jsx` lists the installed faces; `build-reel.jsx` gains a
**`check-fonts` stage before anything is imported or placed**, refusing with the
missing names and telling the user to install them;
`service/src/build/required-fonts.ts` decides what to check, from the client
snapshot's PostScript names. It is the same shape as the absent face masks and
the absent watermark measurement — an input whose absence produces a plausible
wrong output.

**It is inert until a build names its faces**, which is next session: nothing
sets `TextDocument.font` yet, type comes from the template comps. On the three
pinned reels `requiredFonts` returns the three names; on the two with no client
it returns nothing, and an empty list checks nothing.

## 6. Deviations

- **The script was fixed three times mid-session, and re-run each time.** The
  first run returned `ok: true` with zero faces found for all three families and
  Cormorant unresolved — a *partial* measurement, which the brief rightly says
  is not a measurement. Rather than stop, I fixed the instrument and re-ran,
  because the defects were mine and each run told me what was wrong:
  `app.fonts.allFonts` is not an array of font objects; the space rule made
  every family-and-style candidate throw; and the nonsense name had a space in
  it, so it was answering the space question rather than the missing-face
  question. **The numbers in §4 come from the third run**, which resolved all
  three faces.
- **`measure-fonts.jsx` gained a `quiet` argument.** `DoScript` is synchronous
  and the script ended in `alert()`, which would have blocked After Effects until
  someone walked to the machine. A person running it from File > Scripts still
  gets the message box; a session sets `framopiaDriven` and calls the function
  itself.
- **`ARABIC_SIZE_RATIO` was not written**, against a literal reading of "derive
  both and write them in". Reasons in §4.2: it is a human judgement, not a
  placeholder, and overwriting it would change every build unseen. The
  measurement is recorded beside it.
- **The three pinned plans were moved to the client's v9 snapshot.** The mode
  bump made them `behind`, which is the snapshot system working; two tests
  correctly went red. I re-pinned rather than adjusting the tests, having first
  confirmed the change is **purely additive** — `palette`, all three
  family-and-style strings, `textColours` and `imageScale` are byte-identical
  between the v8 and v9 snapshots, so no reel builds differently. Without it the
  new guard would be inert on his reels, because it reads the names off the
  snapshot.

## 7. Failures and open problems

- **The emphasis ratio is a judgement wearing a measurement's clothes.** 1.3479
  is honestly derived, but cap height would give 1.1641 and the two differ by
  16%. Nothing here proves which one his eye wants; **it needs a build**.
- **At 1.3479 an emphasized keyword sets at 425 × 1.3479 = 573 px**, and
  **`SUBTITLE_BAND` does not know about the emphasis face at all**.
  `worstCaseExtent` is built from Inter and Almarai only, from the font files'
  own metrics rather than from `sourceRectAtTime`. A 573 px Cormorant may reach
  outside the band the whole placement system is derived from. **Not
  investigated and not fixed** — it is the first thing next session must check,
  and mixing this session's rendered measurements with `FONT_METRICS`' file
  metrics would be unsound without care.
- **`app.fonts.allFonts` is polluted by writing.** A name that is set but not
  installed is added to the list and stays for the rest of the application
  session — `FramopiaNoSuchFaceZZQX` reported itself *installed* on the run
  after it was first written. The listing is therefore only trustworthy before
  anything sets a font, or after a fresh launch. **His After Effects now has two
  phantom names in its font list** (`FramopiaNoSuchFaceZZQX` and
  `CormorantGaramond-SemiBoldItalic`) until he restarts it. Nothing renders
  differently; no file was changed.
- **The `check-fonts` guard has never fired.** It is unit-tested at the
  TypeScript boundary and the ExtendScript half is gated for syntax, but no
  build has run since it was added, so the refusal path is unobserved. The same
  caveat as every other ExtendScript stage.
- **`DoScript` was blocked for the first several minutes and I cannot say why.**
  If it happens again the symptom is a return of `1` with nothing written.
- **The measurement is one host, one day.** Block 10's golden run is two
  machines, and the partner's may not have Cormorant at all — which is exactly
  what the guard is for.
- Nothing was lost. No cache entry, reference or ledger line changed; his
  project had nothing in it and has nothing in it now.

## 8. Repo state

- Branch **`main`**, five commits ahead of `6778cdc`, nothing force-pushed.
- HEAD: **`fdf6427 docs: record the new rule and what the type measured`**.
- Working tree clean apart from this report.
- **`npm run check`: PASS**, measured from this session's final run:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 35 | **510** |
| `framopia-service` | 88 | **1118** |
| `framopia-benchmarks` | 16 | **166** |
| `framopia-panel` | 6 | **159 passed, 2 skipped (161)** |
| `tools/cv` pytest | — | **149 passed in 7.64 s** |

Tail of that run:

```
> @framopia/core@0.1.0 validate:modes
mode k2-syndicalia v9: ok (fonts set)
templates: 6 entries, ok
extendscript: 10 .jsx file(s) ok
validate-templates: 6 template(s) ok, audited against library.aep
validate:panel: panel/CSXS/manifest.xml ok

> framopia-benchmarks@0.1.0 verify-refs
  ok    ground-truth   v1.0.8-conformant
  ok    test-1         v1.0.8-conformant
  ok    test-2         v1.0.8-conformant
  ok    test-3         v1.0.8-conformant
references: PASS
149 passed in 7.64s
models: birefnet-general ok
models: selfie-multiclass-256x256 ok
check: PASS
```

## 9. Suggested next step

Set the font and the colour on the placeholder text layer, and build `vitasilk`
so he can look at it — that is the only thing that can settle whether 1.3479 or
1.1641 is the emphasis ratio his eye wants, and it is the last step between K2's
recorded identity and a comp that shows it. **Check the subtitle band first**:
an emphasized keyword at 573 px may not fit inside a band derived from Inter and
Almarai alone, and if it does not, either the band or the ratio has to move
before anything is drawn. The four files that change are the ones session 3 §4.2
scoped — `reel-plan.ts` carries the face and colour per element,
`build-reel-cli.ts` fills them from the snapshot and `resolveTextColours`,
`text-fit.jsx` sets `doc.font`, `doc.fillColor` and `doc.applyFill` in the same
`setValue`, and `build-reel.jsx` reads back what After Effects took — and the
`check-fonts` guard added this session is what stops that build placing a card
in a face this machine does not have.
