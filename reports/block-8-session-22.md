Status: OK

Block 8 part 2, session 22. **$0.00 spent, no API was called, the pipeline was
not run, After Effects was not driven.** The audit can no longer destroy the
user's work, every sound's anchor and gain are derived from its own audio, and
the placement rule is in force on all five plans.

## Session preconditions

| check | reading |
|---|---|
| working directory | `/Volumes/T7 Shield/INSEA/Projects/framopia-studio` (T7 mounted; nothing read from `~/dev`) |
| `git status` at start | **only `templates/library.audit.json`**, from the user's audit run — committed on its own as `408877b`, named as his run |
| HEAD at start | `bd01730` |
| ledger at start | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` |
| ledger at end | **108 lines**, sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` — byte-identical |
| After Effects instances at start | **1** |
| `aerender` processes at start | **0** |

`templates/library.aep` is unchanged at sha `dac234ce…`, which is what the fresh
audit records. No template keyframe was written. `align.ts`, `correction.ts` and
both hand-made reference files are untouched.

**The fresh audit resolves all six comps**, so the stop condition did not fire:
every one settles at **0.4004 s = 12.00 frames**.

## Done

### Goal 1 — the audit is safe, permanently

`refuseIfUnsafe` runs **before anything opens**. A project with unsaved changes
is a refusal with a sentence — *"the open After Effects project has unsaved
changes: …. The audit will not close it. Save or close it yourself, then run the
audit again."* — not a prompt and not a close. An unreadable `dirty` flag is
treated as dirty: refusing costs a re-run, guessing costs the user's work. A
*saved* project that is not the library is closed, and that fact is announced in
the output rather than done silently.

**The CLI had the same defect one layer up.** It wrote whatever the script
returned into `library.audit.json`, so a refusal would have replaced a working
measurement with an error message — destroying the thing the refusal exists to
protect. It now throws, names the reason, and says the file is unchanged.

Seven tests assert it against the source, since the behaviour lives inside After
Effects and nothing here can run it: the refusal precedes the open, the single
remaining `close` sits after the dirty guard, an unreadable flag defaults to
dirty, the refusal says what to do, the CLI never overwrites on a refusal, and
the script is still ES3.

### Goal 2 — each sound declares its anchor

`anchor` is a field per file in `assets/sfx/sfx.json`, emitted by
`npm run sfx:measure` and never hardcoded in the placement code.

- **`onset`** — the first audible sample lands on the impact. A dry percussive
  hit.
- **`peak`** — the loudest sample lands on the impact. A riser into a slam.

Defaulted from the measured shape, with `anchorSource` recording `derived` or
`declared` so a deliberate choice is never mistaken for a default:

| id | shape | anchor | source | anchor at |
|---|---|---|---|---:|
| `hit_01` | middle | **peak** | derived | 2.0525 s / 61.51 f |
| `hit_02` | head | **onset** | derived | 0.5007 s / 15.01 f |
| `whoosh_01` | middle | **peak** | derived | 0.6913 s / 20.72 f |
| `whoosh_02` | middle | **peak** | derived | 0.5581 s / 16.73 f |

**`hit_01` defaults to `peak`, which is the case the user asked about.** Its
energy is in the middle, so the shape rule says peak. Setting `anchor: "onset"`
on that entry and re-running `npm run sfx:measure` switches it to its 47.8 ms
attack, and the manifest will then say `declared`. That is a one-field change
and it is his.

### Goal 3 — gain derived from the measured peak

His −20 dB and −24 dB stand — but they are now **targets that are reached**
rather than attenuations that are applied. Each file's gain is
`target − measured peak`.

| id | peak | target | derived gain | was | moves |
|---|---:|---:|---:|---:|---:|
| `hit_01` | −0.72 dBFS | −20 | **−19.28 dB** | −20 | +0.72 |
| `hit_02` | −0.03 dBFS | −20 | **−19.97 dB** | −20 | +0.03 |
| `whoosh_01` | −1.23 dBFS | −24 | **−22.77 dB** | −24 | +1.23 |
| `whoosh_02` | −8.39 dBFS | −24 | **−15.61 dB** | −24 | **+8.39** |

**This does change what his approved figures mean per file, and the intent is
what is preserved.** He approved "hits at −20, whooshes at −24" by ear on
numbers that were attenuations; three files now move by about a decibel, which
is at or below what is audible on a single hearing. `whoosh_02` moves 8.39 dB
and **is bound to nothing today**, so no built comp changes because of it — but
if it is ever bound, it will arrive at the same level as `whoosh_01` instead of
8 dB under it, which is the mismatch a flat figure could not express.

### Goal 4 — the rule in force

**The impact frame, measured from the audit the user ran:**

| comp | impact | derived from |
|---|---:|---|
| `sub_pop`, `sub_pop_ar`, `kw_slam`, `kw_slam_ar`, `img_slide_left` | 0.4004 s / 12.00 f | Transform/Position |
| `img_float` | 0.4004 s / 12.00 f | Transform/Opacity |

**What the 0.13 s offset turned out to be — session 21 could not answer this:
wrong by 53.4 frames for a hit.** The old rule put the file's *start* at the
element's start plus 0.13 s. The measured rule puts `hit_01`'s anchor, 2.0525 s
into the file, on the impact at 0.4004 s — so the layer starts **1.6521 s
before** the element. For a whoosh the correction is 8.7 frames.

**All 17 events moved.** `npm run migrate:sfx-placement -- --apply`, $0.00.

| reel | events | moved | clamped |
|---|---:|---:|---:|
| ground-truth | 0 | 0 | 0 |
| test-1 | 6 | 6 | 2 |
| test-2 | 3 | 3 | 0 |
| test-3 | 0 | 0 | 0 |
| vitasilk | 8 | 8 | 1 |

Every event, before → after:

| reel | event | element | sfx | before | after | moved |
|---|---|---|---|---:|---:|---:|
| test-1 | sfx001 | img001 | whoosh_01 | 0.099 | 0.000 | −2.97 f **clamped** |
| test-1 | sfx002 | k001 | hit_01 | 0.529 | 0.000 | −15.85 f **clamped** |
| test-1 | sfx003 | k002 | hit_01 | 5.869 | 4.071 | −53.89 f |
| test-1 | sfx004 | img002 | whoosh_01 | 4.599 | 4.304 | −8.83 f |
| test-1 | sfx005 | img003 | whoosh_01 | 10.939 | 10.644 | −8.84 f |
| test-1 | sfx006 | img004 | whoosh_01 | 19.719 | 19.419 | −8.98 f |
| test-2 | sfx001 | k001 | hit_01 | 4.729 | 2.936 | −53.73 f |
| test-2 | sfx002 | k002 | hit_01 | 9.090 | 7.307 | −53.43 f |
| test-2 | sfx003 | k003 | hit_01 | 10.349 | 8.575 | −53.16 f |
| vitasilk | sfx001 | img001 | whoosh_01 | 0.099 | 0.000 | −2.97 f **clamped** |
| vitasilk | sfx002 | k003 | hit_01 | 5.550 | 3.770 | −53.33 f |
| vitasilk | sfx003 | k001 | hit_01 | 7.110 | 5.339 | −53.09 f |
| vitasilk | sfx004 | img002 | whoosh_01 | 6.259 | 5.973 | −8.58 f |
| vitasilk | sfx005 | k002 | hit_01 | 8.369 | 6.573 | −53.82 f |
| vitasilk | sfx006 | img003 | whoosh_01 | 11.619 | 11.345 | −8.22 f |
| vitasilk | sfx007 | img004 | whoosh_01 | 16.940 | 16.650 | −8.69 f |
| vitasilk | sfx008 | img005 | whoosh_01 | 20.000 | 19.720 | −8.40 f |

**Three events clamp**, because their derived in-point is before the
composition's start:

| event | element at | anchor late by |
|---|---:|---:|
| test-1 `img001` | 0.099 s | **0.200 s** |
| test-1 `k001` | 0.529 s | **1.268 s** |
| vitasilk `img001` | 0.099 s | **0.200 s** |

`test-1` `k001` is the case worth looking at: a keyword half a second into the
reel needs a layer starting 1.27 s before the comp does, so its hit cannot land
on the impact at any placement. **That is a property of a 5.9 s file whose
anchor is 2 s in, not of this rule** — and it is the argument for either
`anchor: "onset"` on `hit_01` or a different file.

Only `meta` and `sfx` changed on the plans; `transcript`, `keywords` and
`images` are byte-identical, and `keywords.removedWordIds` survives a
re-derivation (tested).

Recorded in `docs/TEMPLATE_LIBRARY_GUIDE.md` and `docs/TEMPLATE_BUILD_SPEC.md`
in the watermark's form, **in the same commits as the changes they document**.

### Goal 5 — handed back

**`npm run service:build` and `npm run panel:build` both ran.** The capability
denylist passes against the built bundle; a raw grep of `panel/dist` returns
zero matches.

**Can he hear or see it without building a comp?** Partly.

- **See it, yes.** The keyword picker shows each sound's binding, and the panel
  reads the plan, so the corrected gains and the new placement are visible
  there now.
- **Hear it, no.** The panel's preview plays the file at its gain; it cannot
  play a sound *against* an animation, because that is the comp. **Only a
  rebuild puts the hit on the impact**, and `vitasilk` is the only reel with a
  built comp — `npm run build:reel -- --plan "<abs path>/vitasilk.editplan.json"`,
  free and local, and **his call, not this session's**.

## Deviations

- **A scratch probe was committed by mistake** in the Goal 1 commit
  (`benchmarks/tmp22/i.ts`) and removed in `0241d6b`. It should never have been
  staged; `git add -A` swept it.
- **Two tests from session 20 asserted the retired flat gain and the 0.13 s
  offset.** Rewritten in the same change that retired them, per guidelines §3,
  rather than left green and false.
- **The `introS` disagreement was found and not resolved.** The manifest
  declares 0.13 s of intro while the comps animate over 0.4004 s. SFX placement
  uses the measured figure; buildability, display timing and the short-card rule
  still use `introS`, and this session changed none of them. Named in Failures.

## Failures & open problems

- **Nothing was lost or destroyed.** Only `meta` and `sfx` changed on the plans.
  No cache entry, ledger line, reference, template, audit or audio file was
  modified. The ledger is byte-identical.
- **`introS` and the measured entrance disagree by 8 frames**, and three rules
  still run on the declared figure. If 0.4004 s is the real entrance, then a
  card shorter than that never completes its animation — and the corpus median
  card is 0.30 s, so **most cards do not**. That is a bigger question than SFX
  and it is untouched.
- **`hit_01` still anchors on its peak**, so any keyword in the first ~1.7 s of
  a reel clamps and its hit lands late by a stated amount. One event in the
  corpus does, by 1.268 s. The fix is a one-field change the user makes.
- **Nothing has been heard.** Every figure here is measured from files and
  keyframes; no comp has been rebuilt and no sound has been listened to in
  place.
- **The audit's safety is asserted against its source**, not by running it — the
  behaviour lives inside After Effects. Only his machine confirms the refusal
  fires.
- **`whoosh_02` is bound to nothing**, so its 8.39 dB correction is untested in
  a build.
- Carried forward: subtitle rulings 1 and 3 are Block 9; headless AE is not met;
  the runner has never run for real; `redo` has no control in the panel.

## Repo state

- Branch **`main`**, worked on `main`. No force-push, no history rewritten.
- HEAD at the time of writing: **`0241d6b` `chore: remove a scratch probe
  committed by mistake`**, preceded by `feat: place sound so its anchor lands on
  the impact frame`, `feat: derive each sound's anchor and gain from its
  measurement`, `fix: never let the audit close a project it did not open`, and
  `chore: re-audit templates with keyframe times` (the user's run), on session
  21's `bd01730`. **This report's own commit follows it.** Goals 1, 3 and 4 are
  in separate commits, each carrying its own documentation.
- `git log` checked for AI attribution and co-author trailers: none.
- `npm run check`: **exit 0, `check: PASS`**, read before committing —
  `@framopia/core` **388** (26 files), `framopia-service` **911** (65 files),
  `framopia-benchmarks` **166** (16 files), `framopia-panel` **131** passed + 2
  skipped (7 files), **1596 TS total** against session 21's 1576; pytest
  **141**, unchanged.
- New: `service/src/analysis/template-impacts.ts`,
  `service/src/analysis/migrate-sfx-placement-cli.ts`,
  `service/src/analysis/sfx-placement.test.ts`, `core/src/audit-safety.test.ts`.
  New command `npm run migrate:sfx-placement`.
- Both `service/dist` and `panel/dist` rebuilt this session.
- Ledger `.local/costs.jsonl`: **108 lines**, sha256
  `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at start
  and end. All-time spend unchanged at **$10.968590**.
- After Effects: **1 instance**, **0** `aerender`, not driven.

## Suggested next step

Settle `hit_01`'s anchor before rebuilding anything, because it decides what the
rebuild sounds like: `peak` is in force and makes one event in the corpus land
1.27 s late, `onset` would put its 47.8 ms attack on the impact and nothing
would clamp. It is one field in `assets/sfx/sfx.json` plus a re-run of
`npm run sfx:measure` and `npm run migrate:sfx-placement`. Then rebuild
`vitasilk` and listen — that is the first time any of this becomes audible, and
the first check on whether 12 frames is the right moment to hit at all. After
that, the `introS` disagreement is the next real thread: 0.13 s declared against
0.4004 s measured, with three timing rules still on the declared figure.

## What the user does next

**Thank you for running the audit — it gave the measurement session 21 could not
take.** Every one of your six templates settles at exactly **12 frames**, which
is a clean number and clearly deliberate.

**Restart the service, then the panel.** Both were rebuilt.

1. In a terminal: `kill 53415` (the service currently registered;
   `cat .local/service.json` names it if it has changed).
2. In After Effects: Window → Extensions → untick **Framopia Studio**, then open
   it again from the same menu. Let the panel start the service, not a terminal.

**The answer to the 0.13 second question: it was out by 53 frames.** Nearly two
seconds, on every hit. All 17 sounds across the five reels have been corrected —
hits move about 53 frames earlier, whooshes about 9.

**The audit can no longer eat your work.** If it finds unsaved changes it now
refuses and tells you to save or close first. It also used to overwrite the good
audit file with its own error message; that is fixed too.

**One decision is yours, and it is one line.** `hit_01` is currently anchored on
its **loudest point**, which is 2 seconds into the file — so its audio layer has
to start 2 seconds before the word. For a keyword early in a reel that is
impossible, and one on `test-1` lands 1.27 s late as a result. The alternative
is anchoring on its **first attack** at 48 ms, which is how a dry percussive hit
is normally placed and would make nothing clamp.

To switch it: add `"anchor": "onset"` to the `hit_01` entry in
`assets/sfx/sfx.json`, then run `npm run sfx:measure` and
`npm run migrate:sfx-placement -- --apply`. Both are free.

**Your −20 and −24 dB still stand**, but they now mean "arrive at this level"
rather than "turn down by this much". Three files shift by about a decibel.
`whoosh_02` shifts by 8 — it was that much quieter than the other whoosh — but
nothing uses it yet, so nothing you have heard changes.

**You cannot hear any of this yet.** The panel can play a sound, but not against
an animation — that only exists in a built comp. When you want to hear it,
rebuild `vitasilk`; it is free and local, and it is the first real test of
whether 12 frames is the right moment to hit.
