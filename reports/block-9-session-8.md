Status: PROBLEM — the style pass added a second text layer, and the one the build fills is now the shadow

# Block 9 session 8 — his pass changed the shape of the templates

**Spent $0.00. No API was called.** After Effects was driven over AppleScript
`DoScript` into the already-running instance; it was never launched, never quit,
no `aerender`, no `-r` process. **`templates/library.aep` was opened read-only
and never written** — its sha256 is identical at both ends of this session.

**Steps 2 to 5 were not attempted.** They all rest on a stroke that is not
there, and on a template the build can fill correctly. Neither holds.

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
| `library.aep` at start | `1d265d1ffce75efd11bdfa6b937570998a0161be086d2537949366cd5a51b3f3` |
| `library.aep` at end | **identical** — read, audited, never written |

It differs from session 7's `dac234ce…` because of his pass, which is expected.
The file grew from 432,197 to 551,409 bytes.

## 2. What his pass changed, comp by comp

The audit was re-run against the edited file and compared field by field with
the previous one.

**`img_float` and `img_slide_left`: no change to any audited field.** They carry
no type and were not part of the pass.

**All four text comps gained a second text layer, `TXT_MAIN 2`**, and nothing
else that the previous audit recorded moved.

| comp | layer 1 (top) | layer 2 (below) |
|---|---|---|
| `sub_pop` | `TXT_MAIN 2` — `kan9olo`, Inter-SemiBold 343, fill **`#F4F4F4`** | `TXT_MAIN` — `kan9olo`, fill **`#820000`**, plus a Transform effect |
| `sub_pop_ar` | `TXT_MAIN 2` — `المنطقة`, Almarai-Bold 367, fill `#F4F4F4` | `TXT_MAIN` — `المنطقة`, fill `#820000`, plus a Transform effect |
| `kw_slam` | `TXT_MAIN 2` — `Booster`, Inter-SemiBold 425, fill `#F4F4F4` | `TXT_MAIN` — `Booster`, fill `#820000`, plus a Transform effect |
| `kw_slam_ar` | `TXT_MAIN 2` — `شد طبيعي`, Almarai-Bold 455, fill `#F4F4F4` | `TXT_MAIN` — `شد طبيعي`, fill `#820000`, plus a Transform effect |

**The shadow is a duplicated layer, not an effect.** `TXT_MAIN` now carries a
Transform effect with Anchor Point `[1080, 550]` and Position `[1088, 565]` —
an offset of **+8 across and +15 down** — and is filled in **`#820000`**, which
is Rouge K2 from the client's own palette. The light copy sits on top of it. It
is a perfectly ordinary way to make a shadow by hand.

**There is no stroke anywhere.** `applyStroke` is **false** on all eight text
layers; `strokeWidth` reads its default 0.5 and no stroke colour is set. Nothing
in any comp has a contour.

### The verification list

Everything the brief asked me to check is intact:

- **Comp names and `TXT_MAIN`: unchanged.** All six comps present under their
  own names, and a layer called exactly `TXT_MAIN` in each of the four.
- **Comp settings: unchanged.** All four still 2160 × 1100, 29.97 fps, 2.0020 s.
- **Type size: unchanged.** 343, 367, 425, 455 — and `TXT_MAIN 2` carries the
  same size as the layer it was copied from.
- **Keyframes: unchanged.** Every animated property still has 2 keys at 0 and
  0.4004004004004 s, with the same values and the same easing (influence 66/14,
  the same speeds). **The impact frame re-derives to 4.06 frames on all six
  comps**, exactly as before, so no sound moves.
- **A stroke and a shadow present:** a shadow, yes, made as described. **A
  stroke, no** — in none of the four.

**One thing that looks like a change and is not.** The diff showed `sub_pop`'s
`TXT_MAIN.position.value` moving from `[1080, 750, 0]` to
`[1080, 700.358…, 0]` and its opacity from 0 to 99.28. Those are `value`, which
After Effects reports **at wherever the current time indicator happens to sit**,
not at any time the audit chose. `valueAtSampleTime` — the figure everything
downstream reads — is `[1080, 700, 0]` and `100` in both audits. This is the
trap Block 7 session 3 lost 50 px of baseline to, and the audit records both
fields so it can be seen for what it is.

## 3. Why this is a stop

**The build fills `TXT_MAIN` and only `TXT_MAIN`.** `findLayer` in
`build-reel.jsx` matches on an exact name:

```js
function findLayer(comp, name) {
    for (var i = 1; i <= comp.numLayers; i++) {
        if (comp.layer(i).name === name) return comp.layer(i);
    }
    return null;
}
```

So `TXT_MAIN 2` is never found and never filled. Building on these templates
today would produce, on **every card of every reel**:

- the **placeholder word** — `kan9olo`, `Booster`, `المنطقة`, `شد طبيعي` — drawn
  in `#F4F4F4` on top, because that is what `TXT_MAIN 2` holds and nothing
  replaces it;
- the **real word** drawn underneath in whatever the build sets, offset +8/+15,
  because the layer the build fills is now the shadow.

**The build would also destroy the shadow while doing it.** It sets the fill
colour on `TXT_MAIN` — crème for ordinary words, gold for emphasized ones — so
the red offset copy would be recoloured, and for a Latin keyword it would also
be re-set in Cormorant at 494.742 while the visible layer above stayed
Inter-SemiBold at 425.

**The roles are inverted from what the build expects.** `TXT_MAIN` was the
visible text; it is now the shadow. That is not a defect in his work — it is a
reasonable way to draw a shadow, and `docs/TEMPLATE_STYLE_PASS.md` did not say
the layer must stay the topmost or the only text layer. **The doc is what was
incomplete.** It said not to rename `TXT_MAIN` and not to move it, and both were
honoured; it never said the build fills exactly one layer by that name and that
a copy of it would be left holding placeholder text.

I have changed nothing to accommodate this, per the standing rule that a session
which is blocked stops rather than adapting the thing that blocked it.

## 4. What was not done, and why

- **Step 2, teach the audit to read the stroke.** Deliberately not done. There
  is no stroke on any layer, so the audit would record `applyStroke: false` and
  a default width of 0.5 everywhere, and I would be shipping a reader with
  nothing to read and no way to know it works. It should be written against a
  file that has a stroke in it.
- **Step 3, widen the band.** The stroke term would be zero, so the "prove it
  can fail" demonstration would be the only thing exercising it. The other half
  — putting Cormorant's extents into the derivation — is real and independent of
  his pass, and is still open.
- **Step 4, the two client fields.** The shadow colour is knowable —
  `#820000` — but the contour colour is not, because there is no contour. Adding
  one field and guessing the other is how a wrong default gets into every client.
- **Step 5, rebuild.** Refused on my own account: a build now puts placeholder
  words on screen.

## 5. Deviations

- **The audit was re-run and is committed**, which is the one thing this session
  changed. Step 1 asked for it, it is the evidence for everything above, and
  without it `validate:templates` would report the record as stale against the
  edited file. It is stamped with the current sha256 and `npm run check` passes.
- **His edited `library.aep` is committed too.** It was sitting modified and
  uncommitted in the working tree; recording it is not the same as endorsing it,
  and leaving a modified binary untracked is how a hand pass gets lost.

## 6. Failures and open problems

- **`library.aep` is currently open in After Effects**, left there by the
  read-only inspection, clean and unmodified. I did not close it, because
  closing a project is not something this session is entitled to do. **While it
  is open, an accidental edit and save would change the source of truth.**
- **Nothing was lost.** No cache entry, plan, reference, ledger line or template
  content changed. His pass is intact and is now in git.
- **`SUBTITLE_BAND` still knows only Inter and Almarai**, and still nothing
  about Cormorant. That gap predates this session and is untouched.
- **The audit still does not record stroke or shadow.** So a future pass could
  add a stroke and nothing would notice its width — the same class of gap that
  made this session necessary, still open.
- **Nothing checks that every text layer in a template gets filled.** That is
  the specific hole his pass fell through, and it is why a wrong reel was one
  build away. There is no guard for it.

## 7. Repo state

- Branch **`main`**, one commit ahead of `ce10195`, nothing force-pushed.
- HEAD: **`2480fa0 chore: take in the hand style pass and re-stamp the audit`**
  (plus this report).
- Working tree clean apart from this report.
- **`npm run check`: PASS**, measured from this session's final run:

| workspace | test files | tests |
|---|---:|---:|
| `@framopia/core` | 36 | **521** |
| `framopia-service` | 89 | **1128** |
| `framopia-benchmarks` | 16 | **166** |
| `framopia-panel` | 6 | **159 passed, 2 skipped (161)** |
| `tools/cv` pytest | — | **149 passed in 7.62 s** |

Tail of that run:

```
> @framopia/core@0.1.0 validate:modes
mode k2-syndicalia v9: ok (fonts set)
templates: 6 entries, ok
extendscript: 11 .jsx file(s) ok
validate-templates: 6 template(s) ok, audited against library.aep
validate:panel: panel/CSXS/manifest.xml ok

> framopia-benchmarks@0.1.0 verify-refs
  ok    ground-truth   v1.0.8-conformant
  ok    test-1         v1.0.8-conformant
  ok    test-2         v1.0.8-conformant
  ok    test-3         v1.0.8-conformant
references: PASS
149 passed in 7.62s
models: birefnet-general ok
models: selfie-multiclass-256x256 ok
check: PASS
```

**The check passing is not a contradiction of `Status: PROBLEM`.** Nothing in
the suite looks at whether every text layer in a template gets filled, which is
exactly the hole this session found.

## 8. Suggested next step

The templates need one small change in After Effects and it is his to make:
**in each of `sub_pop`, `sub_pop_ar`, `kw_slam` and `kw_slam_ar`, the layer that
shows the word must be the one called `TXT_MAIN`, and the offset copy behind it
must be called something else** — swapping the two names is enough, and the
shadow keeps working exactly as he drew it. The contour he wanted is still
missing and can go on in the same sitting.

Once that is done, a session can take the rest in one pass: teach the audit to
read the stroke and the shadow against a file that has both, put Cormorant's
extents and the stroke width into `SUBTITLE_BAND`, add the two client colour
fields with his `#820000` in one of them, and rebuild. **It should also add the
guard this session did without**: every text layer in a template comp must
either be a declared placeholder the build fills, or be something the build
knows is not text it owns — so that a duplicated layer holding `kan9olo` can
never reach a reel again.
