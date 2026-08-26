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
