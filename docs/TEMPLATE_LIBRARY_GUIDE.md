# Framopia Studio — Template Library Guide

Written for the motion designer. You animate however you like — this guide only defines the **contract** that makes your animation usable by the build system. If a template follows these rules, the tool can duplicate it, swap the content, retime it, and place it anywhere, without ever touching your keyframes.

## 1. The one big idea

The system **never edits your animation**. It duplicates your template comp, replaces the content of clearly named placeholder layers, moves the duplicate in time, and positions it in the frame. That's all. So the entire contract is: predictable comp settings, predictable placeholder names, predictable in/out structure, and a manifest entry that tells the system what your template is.

## 2. Where templates live

- All template comps in `templates/library.aep` (we may split into several AEPs later; the manifest tracks which file each comp lives in).
- The machine-readable index: `templates/manifest.json`. A template does not exist for the system until it has a manifest entry, and the validation script (`tools/validate-templates`) must pass before the AEP is committed.

## 3. Comp conventions

- **Naming:** `type_style` — `sub_pop`, `sub_slide`, `kw_slam`, `kw_glitch`, `img_slide_left`, `img_float`. Lowercase, underscores, no spaces. The comp name is the template id.
- **Settings:** **29.97 fps** (30000/1001 — matches footage, mandatory). Square-pixel. Duration: at least intro + 2 s hold + outro; longer is fine, the system trims. The "30 fps" this section carried until Block 6 predates anyone reading a file header: every reel the project has handled is 30000/1001, and Block 5's frame sampling reads real presentation timestamps that diverge from a nominal 30 fps grid from the second frame onward. `npm run validate:templates` requires 29.97 and rejects 30.
- **Size:** subtitle/keyword comps: **2160×1100** — the comp is placed as a unit, so its size defines its footprint. The 2160×600 band this section suggested until Block 6 cannot hold a two-line keyword: Block 6 session 4 measured the worst case, two lines at the keyword size in the Arabic face, at **1017.4 px** from the top of the ascent to the bottom of the descender. Image comps: 1200×1200 default working size (the system scales the instance to the target zone; build big, scale down).
- **Background:** transparent. Nothing in the comp that isn't part of the element (no reference footage, no guides left visible — use guide layers, they're ignored on render but turn them off anyway).

## 4. Placeholder layers

- Exact names, all caps: `TXT_MAIN` (the text layer whose Source Text gets replaced), `IMG_MAIN` (the layer whose footage source gets swapped for the generated image). One template can have decorative extra layers with any names — only placeholders are touched.
- `TXT_MAIN` must be a real editable text layer (not pre-composed, not converted to shapes). Set its font/size/paragraph how you want the *default* to look; the mode's font/palette is applied on the instance.
- **Variable-length text:** anchor the text layer where the animation pivots (usually center). Animate position/scale/rotation of the *layer*, not per-character positions that assume a word width. If your design needs the text to always fit a card, parent a background shape to the text or use a text-box sized generously — the system does not auto-shrink text (Block 6 may add a scale-to-fit expression as a shared utility; until then design for 1–2 short words, our real case).
- `IMG_MAIN`: a placeholder still (any PNG) with **anchor point centered** and layer scaled to taste inside the comp. The system replaces the footage source; your transforms/keyframes survive. Design assuming roughly square-ish content; generated images arrive close to the working aspect.

## 5. Intro / hold / outro structure (this is what makes retiming work)

Structure every template as three phases on the timeline:

```
|── intro (fixed) ──|───────── hold (stretchable) ─────────|── outro (fixed) ──|
0                  inS                                   outS               end
```

- All *entrance* keyframes finish by `inS`. All *exit* keyframes start at `outS`. Between them: either nothing animated, or **loopable/idle** motion only (a float, a shimmer) that looks fine cut at any point.
- The manifest records `introS` and `outroS`. At build time the system stretches the hold by splitting the layer time: it places the instance so the intro ends when the element should be fully on, and shifts the outro so it starts `outroS` before the element should be gone. Never put one-shot animation in the hold — it would be cut arbitrarily.
- Keep intros/outros short for subtitles (≈4–8 frames) — groups can be as short as ~0.3 s.
- **`outroS` may be 0, and validation must accept it as a declared value rather than a missing one.** With no fixed outro phase the structure is intro + hold, the element hard-cuts at the end of its window, and the whole budget goes to the entrance. `introS + minHoldS + outroS` is still what has to fit inside the element's duration.
- **The first template set declares `outroS: 0` on all six comps.** That is a convention the user chose for fast-reel subtitles — a card cuts straight into the next one — and not an oversight. It is also not a rule: a later template may legitimately declare a non-zero `outroS`, provided `introS + outroS` stays inside the same total. Block 6 measured that total at **0.13 s, 4 frames at 29.97 fps**, from what the corpus can actually carry; `docs/TEMPLATE_BUILD_SPEC.md` §4 records the measurement and what a longer budget costs.

## 6. Anchor & placement behavior

Each template declares in its manifest how it should be positioned:
- `anchor`: `"center" | "bottom-center" | "top-center"` — which point of the comp footprint the placement solver aligns to the target position/zone.
- Subtitle templates are always placed at the global subtitle position (fixed, same for all clients). Keyword templates place at the emphasized word's subtitle position or a declared offset from it. Image templates place inside a negative zone; the solver sets position and uniform scale, nothing else.

## 7. SFX binding (deterministic)

Sound is not decided at runtime by any AI. Your manifest entry declares it: which SFX id (from `assets/sfx/sfx.json`), at which frame offset **relative to the instance's intro start**, at what gain. One template may declare zero or several SFX events. If you re-animate an intro, update the offset — validation can't catch a musical mismatch, only a missing file.

## 8. Manifest entry — the schema

`templates/manifest.json`:

```jsonc
{
  "schemaVersion": 1,
  "templates": [
    {
      "id": "kw_slam",                  // must equal the comp name
      "file": "library.aep",
      "type": "keyword",                // "subtitle" | "keyword" | "image"
      "placeholders": ["TXT_MAIN"],     // exact layer names present in the comp
      "introS": 0.20,
      "outroS": 0.15,
      "minHoldS": 0.30,                 // shortest usable hold; solver respects it
      "anchor": "center",
      "imagePresentation": null,        // image templates: "cutout" | "card"
      "sfx": [ { "sfxId": "hit_01", "offsetS": 0.10, "gainDb": -6 } ],
      "notes": "hard slam, best on 1 word"
    }
  ]
}
```

## 9. Validation (run it every time)

`tools/validate-templates` opens the manifest and the AEP (via an ExtendScript audit run) and fails loudly if: a manifest id has no matching comp (or vice versa for `sub_/kw_/img_`-prefixed comps); a declared placeholder layer is missing, misnamed, or the wrong kind (text vs footage); comp fps ≠ 29.97 (30 is rejected — see §3); `introS + minHoldS + outroS` exceeds comp duration; an `sfxId` isn't in `sfx.json`. Green validation is required before committing an AEP change.

## 10. Worked example — building `sub_pop`

1. New comp `sub_pop`, 2160×1100, 29.97 fps, 2 s, transparent.
2. Text layer, rename **exactly** `TXT_MAIN`, type a dummy word ("kan9olo"), font Inter Semi-Bold, anchor centered on the text, layer centered in comp.
3. Intro (frames 0–6): scale 0%→104%→100% with easing; opacity 0→100 over 2 frames. Nothing animated after frame 6.
4. Outro: at 6 frames before comp end, opacity 100→0 and scale to 96% with easing.
5. Manifest entry: `{"id":"sub_pop","file":"library.aep","type":"subtitle","placeholders":["TXT_MAIN"],"introS":0.2,"outroS":0.2,"minHoldS":0.2,"anchor":"center","sfx":[],"notes":"default subtitle pop"}` (subtitles usually carry no SFX — too frequent).
6. Run validation. Green → commit AEP + manifest together in one commit.

First set to build in Block 6: `sub_pop` (subtitle), one keyword style, two image styles (one for cutouts, one card-framed for the fallback presentation).

## SFX placement — measured, 2026-08-28

**A sound's impact is not at its first sample, and nothing had ever measured
where it is.** SFX placement put the file's start at the card's start plus
0.13 s — an offset chosen in Block 5 and never measured — which assumes the
transient is at sample zero. `npm run sfx:measure` reads every file and writes
what it finds into `assets/sfx/sfx.json`; the numbers are emitted by the tool,
never typed in.

| id | codec | container | rate | duration | peak offset | peak | head delay | first audible | shape |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| `hit_01` | mp3 | mp3 | 48000 | 5.856 s / 175.5 f | **2.0525 s / 61.51 f** | −0.72 dBFS | 0.000000 s | 0.0478 s | middle |
| `hit_02` | pcm_s24le | wav | 96000 | 6.000 s / 179.8 f | 0.5433 s / 16.28 f | −0.03 dBFS | 0.000000 s | 0.5007 s | head |
| `whoosh_01` | pcm_s16le | wav | 96000 | 1.951 s / 58.5 f | 0.6913 s / 20.72 f | −1.23 dBFS | 0.000000 s | 0.3493 s | middle |
| `whoosh_02` | mp3 | mp3 | 44100 | 1.202 s / 36.0 f | 0.5581 s / 16.73 f | −8.39 dBFS | 0.000000 s | 0.1275 s | middle |

**`hit_01` is the file bound to every keyword, and its peak is 61.5 frames into
it.** Against a 0.13 s (3.9 frame) offset, every hit's impact has been landing
about **2.05 s after the card it belongs to** — on a corpus whose median card is
0.30 s long, that is not late, it is unrelated.

**The mp3 padding hypothesis is not what is wrong.** Container delay measures
**0.000000 s** on both mp3s, so the head padding the user reasoned about is
either absent or already compensated by the demuxer. Head delay and the sound's
own quiet opening are recorded separately for that reason: adding them would put
an error back rather than remove one. `hit_01` is audible from 47.8 ms and peaks
at 2.05 s — a long file whose loudest point is in its middle.

**Every file is the container its name claims.** 24-bit PCM inside a `.wav` is a
wav; the extension names the container, not the codec.

### The placement rule

`placeSfx` in `core/src/sfx-placement.ts`: **the file's measured peak lands on
the template's measured impact frame**, and the layer's in-point is derived from
those two — never authored.

- **Snapped to the frame grid at 29.97, ties rounding down** (earlier). A sound
  a fraction early reads as part of the impact; a fraction late reads as a
  separate event. Half a frame is 16.7 ms, so the direction only matters at the
  tie and it is spent on being early.
- **A peak later than the impact needs a negative in-point**, which a
  composition cannot have. The layer is clamped to the comp's start and
  `clamped` / `clampedByS` say how late the peak then lands. Reported, never
  absorbed: a hit late by a known amount is a decision, and one late invisibly
  is the defect this replaces.
- Whooshes stay bound to images, hits to keywords, subtitles silent. Gains stay
  −20 dB and −24 dB.

### What is still unmeasured

**The template's impact frame.** `impactFrameOf` derives it from the last
entrance keyframe among Position, Scale and Opacity — and the audit on disk
records keyframe **counts without times**, so it returns null with a reason for
all six comps. `audit.jsx` now emits every key's time and value; the audit has
**not been re-run**, because it closes the open After Effects project without
saving and the user's instance is open. **Until `npm run audit:templates` is
re-run, the placement rule has one measured input and one missing one, and the
0.13 s offset stays in force.**

### The rule in force — measured, 2026-08-28

Session 21 measured the sounds and could not measure the templates. The user ran
`npm run audit:templates`, and **every one of the six comps settles at
0.4004 s = 12.00 frames**, from its last entrance keyframe:

| comp | impact | derived from |
|---|---:|---|
| `sub_pop` | 0.4004 s / 12.00 f | Transform/Position |
| `sub_pop_ar` | 0.4004 s / 12.00 f | Transform/Position |
| `kw_slam` | 0.4004 s / 12.00 f | Transform/Position |
| `kw_slam_ar` | 0.4004 s / 12.00 f | Transform/Position |
| `img_slide_left` | 0.4004 s / 12.00 f | Transform/Position |
| `img_float` | 0.4004 s / 12.00 f | Transform/Opacity |

**What the 0.13 s offset turned out to be: wrong by 53.4 frames for a hit.** The
old rule put the file's *start* at the element's start plus 0.13 s. The measured
rule puts `hit_01`'s anchor — 2.0525 s into the file — on the impact at
0.4004 s, so the layer starts **1.6521 s before** the element. For a whoosh the
correction is smaller: `whoosh_01`'s anchor is 0.6913 s, the image binding's
offset was 0, so the layer moves 0.2909 s earlier — **8.7 frames**.

`introS` in the manifest is **0.13 s** while the comps animate over **0.4004 s**.
Those are different claims about the same templates and only the second is
measured. SFX placement uses the measured one. Buildability, display timing and
the short-card rule still use `introS`; **nothing in this session changed
them**, and the disagreement is recorded rather than resolved.

### Each sound declares its anchor

`anchor` is a field per file in `assets/sfx/sfx.json`, emitted by
`npm run sfx:measure` and never hardcoded in the placement code.

- **`onset`** — the first audible sample lands on the impact. A dry percussive
  hit.
- **`peak`** — the loudest sample lands on the impact. A riser that sweeps into
  a slam.

Defaulted from the measured shape — energy in the head means the attack is the
event — and `anchorSource` records `derived` or `declared`, so a deliberate
choice is never mistaken for a default. Setting `anchor` by hand in the manifest
overrides it.

### Gain is derived, not typed

The user's ruling stands — hits at −20 dB, whooshes at −24 dB — but those are
now **targets that are reached**, not attenuations that are applied.
`whoosh_02` peaks 8.39 dB below full scale, so the same −24 dB left it 8 dB
quieter than `whoosh_01`. Each file's gain is `target − measured peak`:

| id | peak | target | derived gain | was | moves |
|---|---:|---:|---:|---:|---:|
| `hit_01` | −0.72 dBFS | −20 | **−19.28 dB** | −20 | +0.72 |
| `hit_02` | −0.03 dBFS | −20 | **−19.97 dB** | −20 | +0.03 |
| `whoosh_01` | −1.23 dBFS | −24 | **−22.77 dB** | −24 | +1.23 |
| `whoosh_02` | −8.39 dBFS | −24 | **−15.61 dB** | −24 | **+8.39** |

Three files move by about a decibel and `whoosh_02` by 8.4, which is the
mismatch the flat figures could not express. `whoosh_02` is bound to nothing
today, so no built comp changes because of it.

### What the corpus did

17 events across five plans, **all 17 moved**, re-derived by
`npm run migrate:sfx-placement`:

| reel | events | moved | clamped |
|---|---:|---:|---:|
| ground-truth | 0 | 0 | 0 |
| test-1 | 6 | 6 | 2 |
| test-2 | 3 | 3 | 0 |
| test-3 | 0 | 0 | 0 |
| vitasilk | 8 | 8 | 1 |

Hits move about **53 frames earlier**, whooshes about **8.7**. Three events
**clamp** at the composition start, because their derived in-point is negative:
`test-1` `img001` (anchor 0.200 s late), `test-1` `k001` (**1.268 s late**), and
`vitasilk` `img001` (0.200 s late). A clamped event carries `clamped` and
`clampedByS` so the lateness is a stated figure rather than an invisible one.

**`k001` on `test-1` is the case worth looking at**: a keyword 0.529 s into the
reel, needing a layer that starts 1.27 s before the comp does. Its hit cannot
land on the impact at any placement, and that is a property of a 5.9 s file
whose anchor is 2 s in — not of this rule.

### The impact frame is not the settle frame — 2026-08-28

Session 22 placed sound on **0.4004 s / 12 frames**, the last entrance keyframe.
The user, who built these templates by hand, has settled what that figure is:
**the easing front-loads the motion, so the word has visually landed by frame 4
and frames 4 to 12 are the tail settling.** The animation is not changing; the
measurement was reading the wrong moment.

Both earlier figures were right about different things and **neither was the
impact**:

- `introS = 0.13 s` is **4 frames** and correctly describes when the word lands.
- `impactFrameOf`'s last-key figure is **12 frames** and correctly describes when
  the settle ends.

**Consequence: the 17 events session 22 moved are 8 frames late.** Hits went
from about 2 s wrong to about 0.27 s wrong — better, still wrong, and they have
**not been corrected**, because the correction cannot be measured yet.

**The impact is where an animated property first reaches `IMPACT_THRESHOLD` of
its final value.** `IMPACT_THRESHOLD = 0.95` in `core/src/impact-frame.ts` —
**CHOSEN, NOT MEASURED**: far enough that the remaining travel is a settle
rather than a move, near enough to land inside the front-loaded part of an
ease-out.

**It cannot be computed from the audit as it stands.** The audit recorded
`index`, `time`, `value` and `unreadable` per keyframe — two endpoints and a
duration, which do not say when the value arrives between them. On `kw_slam`'s
Position the same two keys give **11.40 frames if the interpolation is linear**
and the user's eye says **4**, which is 33.3% of the span. The difference is
entirely the easing.

**What was missing, and what now records it.** `audit.jsx` asks for, per key and
per side: `keyInInterpolationType` / `keyOutInterpolationType` (LINEAR, BEZIER or
HOLD) and `keyInTemporalEase` / `keyOutTemporalEase`, whose `influence` and
`speed` per dimension define the bezier. Emitted as AE reports them; a property
AE refuses emits **null**, never a zero that would read as "no easing".
`AuditKeyframe` carries them **optional with a default**, so an audit taken
before this session parses and reads as *not recorded* rather than as linear.

**`impactFrameOf` is renamed in its documentation, not its behaviour.** It
measures the settle, it says so, and nothing may read it as the impact again.
The corrected derivation waits on one more audit run.

### The impact frame, computed from the curve — 2026-08-28

Session 23 added keyframe easing to the audit and could not use it. The user
re-ran the audit; every key now carries its interpolation type and temporal
ease, and the crossing is computable.

**After Effects' convention, and why this matches it.** Between two keys
spanning `d` seconds with a value delta `Δ`, the timing is a cubic bezier in
(time, value) space. `influence` is the fraction of `d` a handle spans
horizontally; `speed` is the value rate at the key, so the handle's vertical
extent is `speed × (influence/100 × d)`:

    P0 = (0, 0)
    P1 = (i_out·d,        s_out · i_out·d)
    P2 = (d − i_in·d,  Δ − s_in  · i_in·d)
    P3 = (d, Δ)

That is exactly how the graph editor parameterises a handle. It checks out on
these templates: every property's out-handle has `speed × influence × d` equal
to the **whole** delta — `hit`-side numbers like Position's 891.964 × 0.14 ×
0.4004 = 50.0, Opacity's 1783.929 × 0.056056 = 100.0 — which is what a handle
drawn to the top of the graph means.

**A spatial property reports one ease for all three dimensions** (AE eases along
the path, so the value axis is the magnitude); **a non-spatial multi-dimensional
property reports one per dimension**. Comparing a 3-D magnitude against
dimension zero's speed is a units error and put `img_float`'s Scale at 7.27
frames where everything else gave 5.25.

**Every comp and every entrance property crosses at the same frame**, which is
what one shared easing preset should produce:

| comp | property | 95% crossing | last key (settle) | linear, for comparison |
|---|---|---:|---:|---:|
| `sub_pop` | Position, Opacity | **5.25 f** | 12.00 f | 11.40 f |
| `sub_pop_ar` | Position, Opacity | **5.25 f** | 12.00 f | 11.40 f |
| `kw_slam` | Position, Opacity | **5.25 f** | 12.00 f | 11.40 f |
| `kw_slam_ar` | Position, Opacity | **5.25 f** | 12.00 f | 11.40 f |
| `img_slide_left` | Position, Opacity | **5.25 f** | 12.00 f | 11.40 f |
| `img_float` | Scale, Opacity | **5.25 f** | 12.00 f | 11.40 f |

**The check against the user's eye does not pass, and the number was not
shipped.** He built these templates and says `kw_slam`'s word lands at **frame
4**. The curve says **5.25** — 1.25 frames, 42 ms, later.

**The convention is not what is wrong.** Six comps agree exactly; the figure is
nowhere near linear's 11.40 or the settle's 12.00; and the threshold-to-frame
mapping is smooth and well behaved:

| threshold | crossing |
|---:|---:|
| 0.85 | 3.33 f |
| **0.8966** | **4.00 f** — the user's eye |
| 0.90 | 4.06 f |
| 0.92 | 4.45 f |
| **0.95** | **5.25 f** — `IMPACT_THRESHOLD` as chosen |
| 0.98 | 6.67 f |

**`IMPACT_THRESHOLD` is what disagrees.** It was recorded CHOSEN, NOT MEASURED,
and the user's frame 4 corresponds to **0.8966** — in round terms, 90% rather
than 95%. That is a judgement about when a motion reads as arrived, and it
belongs to the person who drew the curve. **Nothing was migrated onto 5.25**,
and the 17 SFX events remain where session 22 left them.

### SFX level is measured against the dialogue — 2026-08-28

**The −20 dB and −24 dB figures are superseded.** They were chosen in Block 5
before any composition existed, were never heard, and are **absolute**: a level
below full scale says nothing about the voice it sits under. The user built
`vitasilk`, played it with spacebar preview, and could not hear the hits at all.

**Measured, `npm run loudness:measure`:**

| reel | integrated | LRA | true peak |
|---|---:|---:|---:|
| ground-truth | −13.9 LUFS | 1.9 LU | 0.1 dBFS |
| test-1 | −14.0 LUFS | 2.1 LU | 0.1 dBFS |
| vitasilk | −14.4 LUFS | 1.2 LU | 0.0 dBFS |
| test-2 | −14.6 LUFS | 1.3 LU | 0.2 dBFS |
| test-3 | −14.6 LUFS | 1.5 LU | 0.1 dBFS |

Every reel is mastered loud with no headroom. **A hit peaking at −20 dBFS sat
5.6 dB below `vitasilk`'s *average* speech level and about 20 dB below its
peaks**, which is why a short transient vanished under continuous speech.

**The rule is now an offset from the reel's own integrated loudness**, so a
quiet reel and a loud one both come out right without anyone listening:

    target peak = reel integrated loudness + offset
    layer gain  = target peak − the file's own measured peak

`SFX_TARGET_OFFSET_DB` in `core/src/sfx-level.ts` — **CHOSEN, NOT MEASURED**,
and to be judged by ear:

- **hits +6 dB.** A transient accent must peak above the average speech level to
  read as an accent, because a short transient is perceptually far quieter than
  a continuous signal at the same peak.
- **whooshes 0 dB.** A bed under a moving image, not an accent, so it sits at
  the dialogue's own level and reads as texture.

Integrated loudness is the anchor rather than true peak: these reels are all
pinned at 0.0 dBFS peak and differ only in loudness.

**On `vitasilk`:**

| sound | gain was | gain now | peak now | against speech |
|---|---:|---:|---:|---|
| `hit_01` | −19.28 dB | **−7.68 dB** | −8.4 dBFS | 6 dB above −14.4 LUFS |
| `whoosh_01` | −22.77 dB | **−13.17 dB** | −14.4 dBFS | level with the dialogue |

**+11.6 dB on the hits and +9.6 dB on the whooshes.** Placement is untouched:
`IMPACT_THRESHOLD` is unresolved and all 17 events keep their in-points, still
8 frames late.

The reel's loudness is stored on the plan as `source.dialogueLufs` — schema
addition, optional with a default. Absent means unmeasured, and the sfx then
fall back to the file's absolute gain rather than to a guessed loudness.

### The mix has headroom now, and the sound is placed on the crossing — 2026-08-28

The user rebuilt `vitasilk` and listened. **The hits clipped and the whooshes
were inaudible** — the two offsets wrong in opposite directions — **three
consecutive hits read as mechanical**, and the sounds did not land on the word.

**Why the hits clipped, and why no gain could have fixed it.** Every reel is
delivered with a true peak of 0.0–0.2 dBFS. Measured per event against the
dialogue under it, **all 17 events summed past 0 dBFS** somewhere in the window
they played, 7 of them even on a tight window around their own peak, by up to
+2.91 dB. With the voice already on full scale, `20·log10(1 + 10^(s/20))`
exceeds 0 dBFS for **every** finite sfx peak: a hit at −40 dBFS still puts the
sum over. The constraint cannot be met by choosing an sfx level.

**So the mix makes room.** `MIX_CEILING_DBFS = -1.0` — **CHOSEN, NOT
MEASURED** — and `dialogueAttenuationDb` is **derived**: the dialogue's peak and
the sfx target both move with the attenuation, so the smallest one that works is
exactly how far the un-attenuated sum overshoots the ceiling. The whole mix comes
down together, so the balance the offsets describe is untouched. It lands at
**3.80–4.01 dB** across the corpus, and the builder applies it to the reel's own
audio layer. Re-measured after: **0 of 17 events over the ceiling, worst sum
−1.00 dBFS**, which is the ceiling exactly.

**The whooshes go from dialogue +0 to +3 dB.** CHOSEN, judged by ear: a bed
belongs below the hit's +6 and above the voice it has to be heard through. In
absolute terms `whoosh_01` moves −14.40 → −15.20 dBFS on `vitasilk` and is
**3 dB louder against the voice**, which moved 3.8 dB further. There is room to
go louder — the whooshes sum to −1.7 to −3.0 dBFS — and what limits it is the
hit at +6, which is what sets the attenuation for the whole reel.

**Consecutive hits are thinned and varied.** `MIN_SFX_SPACING_S = 1.50` and
`SFX_VARIATION_WINDOW_S = 3.00`, both **CHOSEN, NOT MEASURED**, in
`core/src/sfx-variation.ts`. Spacing first — there is no point varying an event
about to be dropped — then a repeat inside the window takes the next file of the
same kind, cycling. Both are applied to the events **in time order**, which has
to be established rather than assumed: `plan.keywords.items` is in selection
order, and on `vitasilk` k003 plays first. Deterministic with no seed.

Across the corpus: **2 hits dropped** (`vitasilk` k002 and `test-2` k003, each
1.259 s after the previous) and **1 varied** (`vitasilk` k001 to `hit_02`, which
had been bound to nothing). `vitasilk` goes from three identical hits to two
different ones. **No whoosh is dropped or varied anywhere** — the closest two
images in the corpus are 3.07 s apart, so neither rule fires on them.

**Every image slot carries a sound**, enforced rather than observed:
`SilentImageSlotError` refuses the derivation naming the slots. It was already
true of the corpus, but only because both image templates happen to bind a
whoosh. An image's sound is also never the one the spacing rule drops.

**`IMPACT_THRESHOLD` is 0.90, and placement reads the crossing.**
`templateImpacts` now calls `impactCrossingOf`, not `impactFrameOf` — the latter
measures the **settle**, and sound placed there was the 8-frame error the user
heard. All six comps cross at **4.06 frames** against the settle's 12.00 and a
linear reading's 10.80. The user puts `kw_slam`'s arrival at frame 4, which is a
threshold of 0.8966; 0.90 is his figure to within a sixteenth of a frame and is a
round number rather than one fitted to a single comp's curve. **Where a
measurement and the author of the animation disagree by less than two frames,
the author decides.** **12 of 15 events moved 8.00 frames earlier**; 3 clamp at
the composition start and their anchors are later than before, because a nearer
impact needs an earlier start. Full table:
`benchmarks/RESULTS-block8-sfx-placement.md`.

### The hits are removed — user ruling, 2026-08-29

**No SFX event is bound to a keyword.** The user built `vitasilk`, heard the
hits, and ruled them out: **the sound fights the animation rather than
supporting it.** A product decision, not a defect — `kw_slam` and `kw_slam_ar`
declare `sfx: []`, and `hit_01` and `hit_02` are bound to nothing.

**The files and their measurements stay** in `assets/sfx/sfx.json`. They are
measured facts — peak offset, first audible sample, anchor, derived gain — and a
later block may want them; nothing about them is deleted.

**The machinery that existed only for them is gone**, not left behind a flag:
the hit spacing rule, the hit variation rule (`core/src/sfx-variation.ts`), and
the keyword picker's sound row along with the explanation it showed when a hit
had been thinned out. A keyword now has no sound to have or to lack, so the
panel says nothing in either direction.

**Events across the corpus, before and after:**

| reel | before | after | what went |
|---|---:|---:|---|
| ground-truth | 0 | 0 | — |
| test-1 | 6 | **4** | 2 hits |
| test-2 | 2 | **0** | 2 hits; it has keywords and no image slots |
| test-3 | 0 | 0 | — |
| vitasilk | 7 | **5** | 2 hits |
| **corpus** | **15** | **9** | **6 hits** |

**The mix is attenuated less, because the loudest bound sound changed.**
`dialogueAttenuationDb` exists to keep the loudest sound under the ceiling, and
it was computing against the hits' +6 dB offset while nothing binds a hit.
`loudestBoundOffsetDb` reads the offsets the manifest actually binds, so the
figure now follows the whooshes' +3: `vitasilk` goes **3.80 → 3.07 dB** and the
whoosh gain **−13.97 → −13.24 dB**. The balance is unchanged — the whoosh still
sits 3 dB above the dialogue as heard — and the whole reel is 0.73 dB louder
than it needed to be turned down.

### A sound that cannot reach its impact is not placed — 2026-08-29

The user heard the whooshes arrive after the image, "clearly separate". Measured:
**7 of 9 whooshes land exactly on the impact frame and 2 are 14 frames late** —
both `img001`, the first image in the reel, on `test-1` and `vitasilk`. Full
evidence, including the two candidates it ruled out, is in
`benchmarks/RESULTS-block8-whoosh-late.md`.

**The cause is the file's lead-in, not the placement rule.** `whoosh_01`'s
anchor is 0.6913 s into the file and the impact is 0.1354 s after the element,
so the layer must start **0.5558 s (16.66 frames) before** the image. `img001`
sits at 0.0990 s. The in-point clamped to the composition start and the peak
arrived half a second behind the picture.

**Neither file in the index fits**, so there is nothing to substitute:

| file | anchor | needs before the element | on an image at 0.099 s |
|---|---:|---:|---|
| `whoosh_01` | 0.6913 s | 0.5558 s | 13.69 f late |
| `whoosh_02` | 0.5581 s | 0.4227 s | 9.70 f late |

**So the sound is dropped rather than played late.** `deriveSfxDetail` reports
it in `unplaceable` with the element, the file and how late it would have been,
and `npm run migrate:sfx-placement` prints a `NO SOUND` line for each. **A sound
that is audibly wrong is worse than no sound** — the ruling that removed the
hits, applied here.

**Nothing in the corpus clamps any more.** Every surviving event lands its
anchor on the impact frame; `test-1` goes 4 whooshes to 3 and `vitasilk` 5 to 4,
and the first image of each reel is silent.

**Every image still gets a sound wherever one can reach it.**
`SilentImageSlotError` is unchanged for the case it was built for — a template
that binds nothing — and an image refused for want of room is a reported
decision rather than a silent omission.

**The alternative that was not taken, and why.** After Effects allows a layer to
start before the composition, so the whoosh could keep its lead-in and simply
begin part-way through, with the peak landing on time. That is very likely the
better fix, and it was not made because **verifying it means driving After
Effects**, which this session may not do — and a build where AE silently clamped
a negative `startTime` back to zero would reintroduce exactly the defect being
removed, inaudibly. It is the first thing to try if the user wants that first
image to have sound.

### A sound may start before the composition — observed, 2026-08-29

**After Effects honours a negative `startTime`.** Asked for −0.4671 s it reports
−0.4671 s; asked for −1.5 s it reports −1.5 s. Read back from the running
application by `npm run probe:audio-start`, in sessions 28 and 29:

| case | asked start | AE reports | in-point | out | peak lands |
|---|---:|---:|---:|---:|---:|
| control, positive | 1.0000 | 1.0000 | 1.0000 | 2.95 | 1.6913 |
| **the case in question** | **−0.4671** | **−0.4671** | −0.4671 | 1.48 | **0.2241** |
| same, in-point pinned to 0 | −0.4671 | −0.4671 | **0.0000** | 1.48 | 0.2241 |
| deep negative | −1.5000 | −1.5000 | −1.5000 | 0.45 | −0.8087 |

**`startTime` and `inPoint` move independently**, which is the mechanism: the
layer's own time zero can sit before the composition while the portion that
plays begins at frame zero. The builder sets both — `startTime` to the derived
in-point, and `inPoint` to 0 when that is negative — so the active range is
exactly the composition rather than inherited.

**So `placeSfx` no longer clamps.** The peak lands on the impact frame for every
sound, whatever its lead-in, and `beforeCompS` reports how much of the file
falls outside the composition. `SfxPlacement.clamped` and `clampedByS` are gone,
as are `SfxEvent.clamped` and `clampedByS` — no plan carried them — and the
`unplaceable` refusal path session 27 added is **retired**, because no case can
reach it any more.

`checkBuildability` no longer reports a negative `sfx.events` time as an issue.
That rule was true while the placement clamped and false the moment it stopped.

**The corpus: 7 events → 9, and not one of the 7 moved.**

| reel | element | before | after |
|---|---|---:|---:|
| test-1 | img001 | — | **−0.467** |
| test-1 | img002 | 4.037 | 4.037 |
| test-1 | img003 | 10.377 | 10.377 |
| test-1 | img004 | 19.152 | 19.152 |
| vitasilk | img001 | — | **−0.467** |
| vitasilk | img002 | 5.706 | 5.706 |
| vitasilk | img003 | 11.078 | 11.078 |
| vitasilk | img004 | 16.383 | 16.383 |
| vitasilk | img005 | 19.453 | 19.453 |

**Every image in the corpus has a sound again**, and the guarantee is
unconditional: `SilentImageSlotError` is unchanged for the case it was built
for — a template that binds nothing.

**What the lead-in outside the composition costs** is measured in
`benchmarks/RESULTS-block8-lead-in-cost.md`: 0.4671 s of `whoosh_01` falls
before frame zero on `img001`, of which 0.1178 s is past the file's own first
audible sample — but the sound is **31.2 dB below its own peak** there, roughly
26 dB under the dialogue, so no transient is lost. The peak lands **0.31 frames
early**, which is the frame grid rounding early by design and below what the
timeline can express.

### The watermark inset is per axis — 2026-08-29

`WATERMARK_MARGIN` was one number used for both axes, and the vertical
placement **multiplied** it by the frame's aspect ratio where it should divide:
the mark sits **64.8 px from the side and 204.8 px from the top**. It is now
`WATERMARK_MARGIN_X` (a fraction of frame width) and `WATERMARK_MARGIN_Y` (of
frame height), with the second defined as exactly what the single constant
produced — **nothing moved.** The candidate insets the user rules from are in
`benchmarks/RESULTS-block8-watermark-inset.md`.

### The frame contrasts with what actually meets it — 2026-08-29

Session 25 derived the card frame's colour from **the raw generated picture's
outer ring**. Every raw picture is dark, because every prompt carries the mode's
dark palette, so it always chose the palette's lightest colour — and for a
cut-out it was measuring a picture that is not the one on screen.

**A cut-out has no ring.** Measured across the corpus, every cutout's outer 2%
is **alpha 0** — fully transparent. Converting it to RGB makes it black, which
is why the measurement read 0.0000 and reported an 18.6:1 frame. What actually
shows behind the subject is the card itself, so the thing that has to be told
apart from the frame is **the subject**.

**And a subject is read by its lit surfaces.** `vitasilk`'s `img002-c1` runs
from luminance 0.006 to 0.891 across its own pixels — deep shadow and bright
highlight in one bottle — so **no frame colour contrasts with all of it**.
Judging by the median picks a frame the lit half disappears into, which is what
the user saw. `SUBJECT_LIT_PERCENTILE` is the **75th**, **CHOSEN, NOT
MEASURED**.

`frameReferenceLuminance` in `core/src/image-border.ts` is the one rule: the
picture's own edge when the whole picture is shown, the lit part of the subject
when it is cut out. WCAG 2.1's 3:1 minimum for a non-text boundary is unchanged,
and so is `cardFrameColour`.

**All ten candidates on `vitasilk`, before and after:**

| candidate | renders | measured before | frame | measured after | frame |
|---|---|---:|---|---:|---|
| img001-c1 | whole | 0.0066 | light | 0.0066 | light |
| img001-c2 | whole | 0.0027 | light | 0.0027 | light |
| **img002-c1** | **cut out** | **0.0000** | **light** | **0.4640** | **background** |
| img002-c2 | cut out | 0.0126 | light | 0.0389 | light |
| img003-c1 | whole | 0.0266 | light | 0.0266 | light |
| img003-c2 | whole | 0.0053 | light | 0.0053 | light |
| img004-c1 | whole | 0.0019 | light | 0.0019 | light |
| img004-c2 | whole | 0.0083 | light | 0.0083 | light |
| img005-c1 | whole | 0.0257 | light | 0.0257 | light |
| img005-c2 | whole | 0.0101 | light | 0.0101 | light |

**One candidate changes, and it is the one that is built.** `img002-c1` goes
from a frame worth **1.03:1** against what is on screen to **9.85:1**.
`img002-c2`'s subject is dark enough that a light frame is still right for it,
which is the rule being per-image rather than per-slot.

