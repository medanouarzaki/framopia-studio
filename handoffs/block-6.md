# Handoff — Block 6: Template library
Date: 2026-08-26 · Conversation model: Claude Opus · Sessions run: 8

## Status vs BLOCKS.md

DoD met: **yes**, itemized:

- **Validation passes on the committed AEP** — yes. `npm run validate:templates` reports `6 template(s) ok, audited against library.aep` and runs inside `npm run check`. `templates/library.aep` is committed at 432,197 bytes, sha256 `dac234ce443ec581d75ac7a5c497075b7a618e1d603109901a72d3872fa238fa`.
- **A deliberately broken copy fails loudly with a precise message** — yes. Seven fixtures, all exiting 1; four of them are real broken `.aep` files produced by scripting AE to open the library, break one thing and save elsewhere, then audited through the same path as the real one. The user reviewed all seven messages; six were judged precise on first reading and the seventh was rewritten in session 8.
- **User builds 1 subtitle, 1 keyword, 2 image styles** — exceeded: **six comps**, because the text templates were doubled into Latin and Arabic variants (decision 4).
- **manifest.json filled** — yes, six entries, `stub: false`.
- **Arabic subtitle font collected and recorded** — yes, **Almarai Bold**, in `core/src/typography.ts` and PROJECT_SPEC §5 by amendment.
- Regression rule active: `npm run check` green, exit 0, **928 TypeScript tests** (core 145, service 617, benchmarks 166) and **141 pytest**, with `validate-templates` and `validate:modes` both inside the gate.

**Block 6 spend: $0.412818**, all of it in session 5, across 3 ledger lines. Seven of eight sessions spent nothing. All-time **$10.968590** over 108 entries; Gemini account ≈ **$8.04**.

**Caveat qualifying all of it: nothing has retimed a comp.** The validator proves the six comps match the manifest. No instance has been placed, stretched, populated or rendered. `outroS: 0`, the 29.97 fps timeline and the baseline anchor at y 2480.4 are all assertions, not observations. One placed `sub_pop` instance settles all three.

## Decisions made (and why)

1. **Arabic companion font: Almarai Bold, at 1.07× the Latin size.** The user's first candidate, KO Media, needed **1.61×** the Inter size for an optical match — a gap that large means the two faces fight each other on every downstream measurement. Almarai needs 1.07× and carries real weights (Light/Regular/Bold/ExtraBold), so Bold is a chosen match to Inter Semi-Bold rather than the only option. Installed on both machines, verified. The ratio is an optical match measured by the user's eye, not derived from metrics.

2. **The subtitle anchor is x 1080, y 2480.4, and y is the baseline.** Read off a delivered reel: both the subtitle layer and the keyword layer sat at exactly the same position, so a keyword replaces a subtitle in place and the solver's `KEYWORDS_ARE_INSIDE_SUBTITLE_BAND` assumption holds without an offset. The layer anchor point is 0,0, which makes the position value the text baseline rather than a bounding-box centre — glyphs extend upward and descenders hang below. The user's x read 1088.56; he confirmed the 8.56 px was a drag error and it is locked at 1080.

3. **Type sizes: subtitle 343, keyword 425, line spacing 323, authored at 100% scale.** The user's own comp read 381.1 / 472.1 / 359 at 90% layer scale; these are the same type at 100%. Authoring at 100% matters because intro animations key on scale, and a base value of 90% makes those keyframes fight it.

4. **Six comps, not four: the text templates are doubled into Latin and Arabic variants.** A single text layer cannot hold both scripts — different font, different size, different paragraph direction — and flipping direction at build time through the AE scripting API is fragile and possibly unavailable. `sub_pop`/`sub_pop_ar` and `kw_slam`/`kw_slam_ar` are matched pairs: same timing, same motion, same footprint. Block 7's ExtendScript selects by the group's `script` value and never inspects the string or switches fonts per character.

5. **A subtitle card never mixes scripts** (user ruling, session 6). Session 1's script scan found 10 groups holding a Latin word and an Arabic-script word together — one in eighteen — which no single-script template can render. Grouping is now script-aware in the analysis-stage re-grouping pass; mixed groups went **10 → 0**. The cost is one keyword: test-1's `k003` "jawdat البشرة" straddles a script boundary and is dropped with the new reason `span-is-mixed-script`, leaving that reel with two of the three keywords `keywordCountFor` asked for. Dropped rather than narrowed, because which half of a mixed span carries the emphasis is not that pass's judgement.

6. **Whole-term grouping is deliberately not implemented, and eleven §6 terms currently split across cards.** ORTHOGRAPHY_GUIDE §6c requires a multi-word Arabic domain term to render whole. Implementing it needs term boundaries, and session 5 established the model cannot supply them reliably: **three cache-bypassed calls on test-2 returned three different term sets, only one matching the guide**, while keyword spans stayed identical across the same three calls. The rejected fix was pasting §6's example list into the prompt — it would produce correct answers on the eight terms in that list and tell us nothing about the terms that are not, on a corpus of five reels of one client. Revisited in Block 7 with the user's eye on a built comp, where the violation is finally visible. **`Transcript.terms`, `terms.ts`, analysis prompt version 4 and the validator rules are all live and all unread by grouping** — groundwork for the revisit, recorded in three places so it is not mistaken for an oversight and deleted.

7. **The animation budget is 4 frames total, spent entirely on the entrance.** `introS` 0.13, `outroS` **0**, `minHoldS` 0.10 on all six comps. The user built and rejected a 2-frames-in/2-frames-out structure as too fast, and chose instead to spend the whole budget on the intro and hard-cut into the next card — the fast-reel convention, and the correct trade, since an outro fades out something the next card is about to replace. Same total, so it costs nothing: **7 of 190 subtitle groups unbuildable**, the sweep's loosest cell.

8. **`SUBTITLE_BAND` is measured, in two stages, and the second stage refuted the hope behind it.** Session 3 built it from OS/2 usWin metrics — the font's maximum possible ink reach — giving a band 603 px higher at the top and **1.72× taller** than Block 5's provisional guess, which had left the entire first-line ascent unprotected. Session 4 re-measured from real glyph outlines over the repertoire the orthography can actually produce (81 distinct characters across nine sources, **zero Arabic diacritics anywhere**, exactly as §1 predicts). It shrank **1.50%**. Both readings are recorded in the constant's comment alongside the provisional value.

9. **Automatic torso zone derivation is retired** (user ruling, option A). Block 5's torso capability needs a strip between the head mask's lowest pixel and the subtitle band; the measured anchor leaves **71–295 px where `MIN_PLACED_SHORT_EDGE` requires 324**. Session 4 established the band was never the cause: for test-1's torso to hold the minimum square the band top would need a maximum ascent of 659 Almarai units against the font's real 1100. **29 torso zones across four reels went to zero.** The `torso` kind stays in the schema, `assertPlaceable` still accepts it, manual torso zones still round-trip, and `torso_rect` is kept and documented as retired — the ruling turns on the anchor position, and moving the anchor makes it callable again in one edit. It cost no placement: zero of nine ever used one.

10. **Comps are 29.97 fps, not 30.** TEMPLATE_LIBRARY_GUIDE §3 called 30 mandatory. Every source reel is 30000/1001, and PROJECT_SPEC's "30 fps" predates anyone reading a file header. The validator now requires 29.97 and rejects 30.

11. **Text comps are 2160×1100, not 2160×600.** The guide's example band height cannot hold a two-line keyword: session 4 measured the worst case at **1017.4 px** from ascent top to descender bottom.

12. **Reading the AEP is split into two commands, and nothing parses the binary.** `npm run audit:templates` drives a running After Effects over AppleScript `DoScript` and stamps `templates/library.audit.json` with the AEP's sha256; `npm run validate:templates` checks the manifest against that dump with no AE involved, and that is what runs in `npm run check`. A stale audit fails **as stale** rather than being validated against an out-of-date picture of itself. Cold-launch `-r` does not work on this machine — a script whose entire body is `app.quit()` left AE running for 120 s, so the file is never reached.

13. **The pipeline is 4K-only, and this is recorded rather than fixed** (user ruling). PROJECT_SPEC §4 locks 2160×3840, and `FRAME_WIDTH`/`FRAME_HEIGHT` in `service/src/placement/constants.ts` duplicate `SOURCE_WIDTH`/`SOURCE_HEIGHT` in `service/src/frames/zones.ts`, both hardcoded and able to drift today. The user does not deliver HD now and may with future clients. Session 7 scoped it: six constant groups need converting, everything already expressed as a frame fraction scales on its own, and **the comps themselves are the hard half**. Block 10.

## Amendments proposed to plan/docs

Applied in-repo this block; the project-knowledge copies should be replaced with the repo versions.

- **TEMPLATE_LIBRARY_GUIDE.md §3 (frame rate)** — 30 fps → **29.97 (30000/1001)**, with the reason: every reel is 30000/1001 and Block 5's frame sampling reads real presentation timestamps that diverge from a nominal 30 fps grid from the second frame onward.
- **TEMPLATE_LIBRARY_GUIDE.md §3 (comp size)** — subtitle/keyword comps 2160×600 → **2160×1100**, with the 1017.4 px worst-case measurement.
- **TEMPLATE_LIBRARY_GUIDE.md §5 (intro/hold/outro)** — two bullets: `outroS` may be 0 and validation must accept it as a declared value rather than a missing one, so the structure is intro + hold; and the first template set declares `outroS: 0` on all six comps as a convention the user chose, **not a rule** — a later template may declare a non-zero `outroS` within the same 0.13 s total.
- **PROJECT_SPEC.md §5 (Subtitles)** — `TBD_ARABIC_FONT` → **Almarai Bold at 1.07× the Latin size**; the subtitle anchor at x 1080, y 2480.4 with y as the baseline; sizes 343 (subtitle) and 425 (keyword); line spacing 323; both tracks may wrap to two lines and no further, rendering downward. All values have their single declaration in `core/src/typography.ts`.
- **PROJECT_SPEC.md §4 (Input)** — **still says 30 fps and was not amended.** After this block's guide amendment it is the last document carrying the wrong figure. **Amend before Block 7 reads it.**
- **PROJECT_SPEC.md §5 (Important words)**, add: a keyword span that straddles a script boundary is dropped rather than narrowed, with reason `span-is-mixed-script`. It happens after selection, so nothing reports the resulting shortfall against `keywordCountFor`.
- **ARCHITECTURE.md §3**, record: `Transcript.terms?: TermSpan[]`, optional with default — absent means the analysis pass has not run, explicitly **not** that every Arabic run is one term.
- **ARCHITECTURE.md §5.5**, record the retirement of automatic torso derivation with decision 9's reason, keeping the kind valid for manual zones.
- **ARCHITECTURE.md §6**, add: the **image** fingerprint keys on `modeVersion` while analysis keys on a content hash. This is the over-invalidation session 4 fixed for analysis and never extended to images. See Known issues.
- **CLAUDE_CODE_GUIDELINES.md §3**, add: an error message must not carry the same number twice with two different meanings. Session 8's over-budget message read `the measured budget is 0.13s (introS 0.13 + outroS 0.15)` and could be misread as the intro alone having overrun.

## Repo state

- `main` @ origin, both at **`4608f84`**, clean tree, everything pushed. 30 commits from `10790a7`. No AI attribution or co-author trailer anywhere in the block's history.
- New top-level paths this block: `templates/library.aep`, `templates/library.audit.json`, `templates/manifest.json` (real, `stub: false`), `tools/validate-templates/` (`audit.jsx`, `cli.ts`), `core/src/typography.ts`, `service/src/analysis/timing-budget*.ts`, `service/src/analysis/terms.ts`, `docs/TEMPLATE_BUILD_SPEC.md`, three `benchmarks/RESULTS-block6-*.md`, `handoffs/block-5.md`, eight session reports.
- **The manifest**, all six at `introS` 0.13 / `outroS` 0 / `minHoldS` 0.10 / `anchor: center` / `sfx: []`:

| id | type | placeholder | presentation |
|---|---|---|---|
| `sub_pop` | subtitle | `TXT_MAIN` | null |
| `sub_pop_ar` | subtitle | `TXT_MAIN` | null |
| `kw_slam` | keyword | `TXT_MAIN` | null |
| `kw_slam_ar` | keyword | `TXT_MAIN` | null |
| `img_slide_left` | image | `IMG_MAIN` | `cutout` |
| `img_float` | image | `IMG_MAIN` | `card` |

- `npm run check` green, exit 0: **928 TS tests, 141 pytest**, `mode k2-syndicalia v6: ok (fonts tbd)`, `validate-templates: 6 template(s) ok`.
- Ledger `.local/costs.jsonl`: sha256 `50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`, **108 lines**, all-time $10.968590.

## Known issues & risks

- **Nothing has retimed a comp.** The block's largest gap. `outroS: 0`, the 29.97 fps timeline, the baseline anchor and whether a solid `IMG_MAIN` accepts a replaced source are all unobserved. One placed instance settles all four.
- **Eleven §6 terms render split across cards.** The accepted violation of decision 6, and the largest known-wrong thing in the pipeline. Worst case is test-1's `شد طبيعي للوجه` across three cards. Each is named in `benchmarks/RESULTS-block6-script-grouping.md` §5. **Term identity there was judged by eye against the guide's example list**, and `شد خفيف للبشرة` is not in that list — it is called a term on its identical construction to `شد طبيعي للوجه`. A term nobody recognised would not appear in the count at all, so eleven is what we can identify, not a total.
- **The mode bump stranded 14 cached images, ~$1.55 to regenerate.** The image fingerprint keys on `modeVersion`, so adding two template ids that no image call ever reads invalidated them. Nothing was re-run and the image files are still on disk, so the cost is not yet real — but **a font landing at Block 9 will strand every cached image on every reel.** Fix before Block 9; it is a small change now.
- **`assertRenderable` no longer guards.** Dropping `stub: true` was correct — the manifest describes real comps — but that flag was also what kept a build away from a stub SFX index, and `assets/sfx/sfx.json` is still a stub with **no audio files**. Nothing checks that before a build. **Block 7 collects the audio.**
- **`npm run validate-plan` reports 11 where `npm run timing-budget` reports 7.** They are not comparable: validate-plan reads stored display timing that no plan carries and skips groups with no `templateId`, so three of five reels are not duration-checked by it at all. **7 is the number.**
- **`IMG_MAIN` is a solid, not the placeholder still §4 suggests.** The validator accepts solid or footage and rejects text, because requiring a PNG would fail a working build — but *a solid accepts a replaced source* is a claim about AE's API this pipeline has not demonstrated.
- **The AE audit path is machine-specific and undiscovered.** `tools/validate-templates/cli.ts` names `Adobe After Effects 2026` in its AppleScript, and `-r` is known not to work here. A different machine or version needs that string changed by hand. **Block 10's DoD is a golden run green on both machines.**
- **Two of the seven unbuildable groups are degenerate word timings**, not animation problems: vitasilk `mn` at 0.000 s and test-1 `tb3i m3aya` at 0.030 s. Alignment artifacts, unexamined since session 1, and no intro/outro choice rescues them. A Block 2 question worth an hour before anyone concludes the animation budget is at fault.
- **Grouping is script-aware only in the analysis pass.** `groupWordsIntoSubtitles` still pairs across scripts, so a freshly transcribed reel carries mixed groups until analysis runs. Everything on disk has been through the analysis pass, so nothing is currently mixed.
- **Five of the seven validator messages carry no numbers and were judged clean by reading, not by test.** Only the over-budget message has assertions pinning its wording.
- **The 1.07 font ratio is an optical match by eye**, on one word pair, at one size. It is a locked constant resting on a single judgement.
- **The evidence base is unchanged: five reels, one client, two speakers.** The character repertoire is missing eleven Arabic letters that plainly can occur; the band was measured over every permitted glyph rather than the corpus for exactly that reason.
- **Session count:** BLOCKS.md estimated 2–3 and this ran 8. Sessions are estimates, not quotas. The extra went on two blocked sessions (term boundaries), the two-stage band measurement, and the script-grouping work the plan did not anticipate.
- **External-SSD dependency:** any session without the T7 mounted stops immediately (`Status: PROBLEM`).

## Exact next steps

1. **Block 7 prompt #1:** amend PROJECT_SPEC §4's "30 fps" — the last document carrying the wrong figure — and fix the image cache's `modeVersion` keying, both cheap now and expensive later. Then collect the watermark file details (BLOCKS.md marks this a block-start task: exact codec, alpha interpretation straight vs premultiplied, duration) and the ~5 SFX audio files.
2. **Then the smallest useful build:** place one `sub_pop` instance on one reel and look at it. It settles `outroS: 0` retiming with no outro phase, a 29.97 fps comp on a 29.97 fps timeline, the baseline anchor putting type where session 3's arithmetic says, and a solid `IMG_MAIN` accepting a replaced source. Drive it over `DoScript` into a running After Effects — `-r` is known not to work here, and that constraint should shape the builder rather than be rediscovered inside it.
3. Then per BLOCKS.md Block 7: the build plan schema, the `.jsx` builder (import, duplicate, populate, retime, position, SFX layers, watermark at t=0, save), structured JSON error reporting, and the headless test runner against the Block 6 AEP.
4. **On the built comp, the user judges three things this project has been deferring:** whether the eleven split §6 terms actually read badly (decision 6's revisit); whether a 324 px image reads as a stamp (`MIN_ZONE_SHORT_EDGE`, deferred from Block 5); and whether five images in one reel read as designed or batched.
5. Apply the amendments above to the project-knowledge docs.

## User inputs collected this block

- **Arabic companion font: Almarai Bold**, installed on both machines. KO Media was tested first and rejected on the 1.61× size gap.
- **Optical size ratio 1.07**, judged by eye on a matched word pair.
- **The subtitle anchor and geometry**, read off a delivered reel: x 1080 (1088.56 confirmed as a drag error), y 2480.4, anchor point 0,0 so y is the baseline; sizes 381.1 / 472.1 / 359 at 90% scale, recorded as 343 / 425 / 323 at 100%.
- **Ruling — a long keyword wraps to a second line** at the same size rather than shrinking, and the second line renders below the first (confirmed by hand in AE, not inferred).
- **Ruling — subtitle text is centre-aligned on the anchor**, not left, so a short and a long card sit the same way.
- **Ruling — one script per subtitle card**, accepting the dropped mixed keyword.
- **Ruling — torso option A**: automatic derivation retired, manual zones kept.
- **Ruling — whole-term grouping deferred** to Block 7 rather than paid for with an unreliable model answer.
- **Ruling — 4 frames of intro, no outro**, after building and rejecting a 2/2 split as too fast.
- **The animation itself**: Fast Box Blur 30 → 0, position y 750 → 700, opacity 0 → 100, all landing on frame 4, Easy Ease with 75% incoming influence. The keyword comps carry the same animation at the larger size; the user judged the size difference sufficient to carry the emphasis.
- **Six hand-built comps** in `templates/library.aep`.
- **Ruling — HD is not needed now.** 4K-only is recorded as a limitation for Block 10.
- **Confirmation that six of seven validator messages are precise enough to act on**, and identification of the seventh.
- **Not collected: the SFX audio files.** Still to be sourced. Block 7.
