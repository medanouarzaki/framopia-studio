# What the builder decides without the plan

Written 2026-08-28. The user saw a watermark on his built reel while the plan
recorded nothing about one. That was true, it is fixed, and this is the sweep
for anything else shaped the same way.

## The watermark, fixed

`build-reel-cli.ts` read `if (watermarkFacts !== null && existsSync(WATERMARK_PATH))`
— the measurement file and the asset, both properties of the repository. Every
reel therefore got a mark, and no reel could refuse one.

It reads `plan.watermark` now. **`Watermark.enabled` is a schema addition,
optional with a default of true**, so no plan is migrated and no reel silently
loses its mark: absent means nobody has said otherwise, not no. The Build step
carries a per-reel checkbox writing it through `POST /watermark`, and the dry
run reports the current answer.

### Its inset, unchanged

Reported as asked and **not touched**:

| | fraction | px on 2160 × 3840 |
|---|---|---:|
| width | `WATERMARK_WIDTH_FRACTION` 0.10 of frame width | **216** wide, 242 tall |
| horizontal inset | `WATERMARK_MARGIN` 0.03 of frame width | **65** |
| vertical inset | the same 0.03, converted through the frame aspect | **205** |

**The two insets are not equal**, and that is the margin constant being carried
into a 16:9-times-taller axis rather than a decision anyone made. On the built
`vitasilk` the mark sits at x 1987.2, y 325.7 at 11.2266% — 64.8 px from the
right edge and 204.7 px from the top, which agrees. Left as it is.

## The rest of the sweep

| what | where it comes from | on the plan? | verdict |
|---|---|---|---|
| **client mode** | `--mode`, or `plan.clientMode` | **null on all five plans** | **the same defect.** The image stage composed every prompt from a mode the plan does not name, and the frame colour added this session needs one too. It falls back to the flag and says so, but a plan cannot state which client it was built for. |
| image template | forced to `img_float` in the builder | `slots[].templateId` is set and ignored | **deliberate**, Block 7 session 9: every image is framed. The plan's value is stale rather than consulted. |
| image placement | `topLeftPlacement` from the face masks | `slots[].position` / `.scale` are stored | **deliberate**, same ruling: the stored placements are Block 5 solver output and the corner rule replaced them. |
| SFX gain | derived from the manifest and the file's peak | `sfx.events[].gainDb` is stored | **derived every build**, and correctly — the stored values were stale for two blocks. The derivation now also reads `source.dialogueLufs`, which *is* on the plan. |
| watermark duration | `.local/build/watermark.json`, then `WATERMARK_DURATION_S` | `watermark.durationS` | measured from the asset; the plan's field has never been filled. Harmless while there is one asset. |
| fonts | `buildFonts`, global fallback | `clientMode.fonts` | **stated at Build**, Block 8 session 9. Not silent. |
| frame size | `FRAME_WIDTH` / `FRAME_HEIGHT` constants | `source.width` / `.height` | known 4K-only limitation, Block 6 session 7. |

**One further instance of the reported defect: `plan.clientMode` is null on
every plan in the corpus.** Nothing was changed about it here — it is a
transcription-stage question, and the flag makes it visible rather than silent.
