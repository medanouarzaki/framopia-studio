# Cutout gate and text detection on the Block 4 corpus

The six bake-off images run through the CV sidecar. **Nothing was generated**
and nothing was billed: the ledger held 95 entries and $9.005328 at both ends
of the session, byte-identical.

Two questions were on the table. Does background removal survive a dark
subject on a dark ground, which is what all six images are? And does anything
catch the legible English text one of them carries, given the negative prompt
did not?

## Thresholds, declared before the corpus was measured

Set from what each metric means, not from what these six score. Six images
from one prompt on one slot is not a tuning set, and a threshold fitted to it
would be wrong on every other reel. **All provisional**, in the code comment
and here.

| threshold | value | why |
|---|---|---|
| `MAX_ALPHA_EDGE_NOISE` | 0.02 | A matte 2% composed of scattered fragments is visibly dirty against a flat card. Below that the fragments are dust compositing hides. |
| `MAX_HOLE_RATIO` | 0.01 | Above 1% of the subject punched through is a hole a viewer sees. Enclosed gaps at or under 1% are usually real — the space inside a handle. |
| `MIN_FOREGROUND_AREA` | 0.05 | Below 5% the remover found essentially nothing and the cutout is empty. |
| `MAX_FOREGROUND_AREA` | 0.92 | Above 92% it kept almost the whole frame. **This is the one this corpus is most exposed to** — a dark subject on a dark ground is exactly where a remover can return the input unchanged and call it a subject. The bound most likely to be wrong. |
| `MAX_EDGE_HALO` | 0.10 | Mean alpha in the ring beyond the soft edge. A clean matte has decayed to zero there; 0.10 allows a soft boundary without allowing a rim of old background. |

## What the metrics count

All four read the **alpha channel alone**. None looks at colour, so a dark
subject scores the same as a light one — which matters when every image in the
corpus is dark on dark.

- **alpha edge noise** — solid-foreground pixels not belonging to the largest
  connected component, over all solid foreground. A clean cutout is one blob
  and scores 0. Deliberately a connectivity measure, not a gradient one: a
  gradient measure cannot tell a legitimately soft edge from speckle, and the
  soft edge is wanted.
- **hole ratio** — background fully enclosed by subject, over the
  hole-filled subject. A notch at the subject's edge is not a hole.
- **foreground area** — fraction of the frame the subject occupies. Judged
  against a band, because both ends are failures.
- **edge halo** — mean alpha in the ring from 2 to 5 pixels **outside** the
  solid subject. The 2-pixel skip is the whole point: hair and motion blur
  ramp to clear across a couple of pixels, and measuring from the edge with no
  skip scores a genuinely soft matte identically to a rim of old background.

## The post-processing finding

**rembg's `post_process_mask` silently disables three of the four metrics.**
It thresholds the matte to hard edges and returns an alpha channel with
**literally zero partial values** — measured across all six cutouts, not
inferred. Edge noise, holes and halo all measure the transition band it has
just destroyed, so all three read 0.0000 and the gate passes everything.

Same image, both ways:

| | partial alpha | edge halo | gate |
|---|---|---|---|
| `post_process_mask=True` | 0.000000 | 0.0000 | cutout |
| `post_process_mask=False` | 0.002361 | **0.0749** | cutout |

The default is now **off**. The first corpus run was done with it on, produced
six perfect zeros, and those numbers are not in the table below because they
measure nothing.

## Per image

`birefnet-general`, `alphaMatting=false`, `postProcessMask=false`.

| image | edge noise | hole ratio | fg area | edge halo | gate | text |
|---|---|---|---|---|---|---|
| `gemini-3-pro-image-1` | 0.00000 | 0.00000 | 0.1228 | 0.0749 | **cutout** | **yes** |
| `gemini-3-pro-image-2` | 0.00000 | 0.00000 | 0.1121 | 0.0966 | **cutout** | no |
| `gemini-3-pro-image-3` | 0.00000 | 0.00000 | 0.2239 | 0.0435 | **cutout** | no |
| `gemini-3.1-flash-image-1` | 0.00000 | 0.00000 | 0.1400 | 0.0619 | **cutout** | no |
| `gemini-3.1-flash-image-2` | 0.00000 | 0.00000 | 0.2231 | 0.0965 | **cutout** | no |
| `gemini-3.1-flash-image-3` | 0.00000 | 0.00000 | 0.1251 | 0.0607 | **cutout** | no |

**All six pass.** Background removal survives dark-on-dark on this corpus —
every matte is a single connected blob with no holes, and foreground area sits
between 11% and 22%, nowhere near either bound. The failure the 0.92 ceiling
was written for did not occur once.

**Two images sit within 0.004 of the halo threshold** — pro-2 at 0.0966 and
flash-2 at 0.0965 against 0.10. They pass, but a threshold declared blind
landing that close to two of six is worth knowing: a small change in the
threshold, the model or the prompt flips them to `card`. Nothing was moved to
accommodate them.

### Resolved: the near-misses are rim light, not retained background

The user compared the originals against the cutouts. **The bright edge is
present in the original image** — it is rim lighting the model rendered, not
background the matte failed to remove. The two near-misses are therefore
correct renders scoring high on a metric that cannot distinguish a lit edge
from a retained one, and not the gate about to cut into good mattes.

**No threshold was changed.** `MAX_EDGE_HALO` stays at 0.10 and now carries
this check at its definition. It remains provisional — six images, one prompt,
one slot — but it is no longer unexamined, and the reason it was not moved is
recorded rather than implied.

This is also a stated limit of the metric: `edge_halo` measures alpha outside
the subject and has no way to tell a rim the model drew from a rim the remover
left. On footage where the mode's lighting axis calls for rim light, expect it
to run high by construction.

### Per arm

Three images each. **This is a split, not a result** — three against three,
from one prompt on one slot, with a spread wider than the gap on every metric.

| metric | pro mean | flash mean |
|---|---|---|
| alpha edge noise | 0.00000 | 0.00000 |
| hole ratio | 0.00000 | 0.00000 |
| foreground area | 0.15292 | 0.16272 |
| edge halo | 0.07163 | 0.07303 |

**Edge noise and hole ratio did not vary at all**, on either arm. Both are
exercised only by the synthetic tests; nothing in this corpus has ever made
either fire, so neither is validated against real data.

## Text detection

RapidOCR, local and offline. The labelled test set is the six images: one
carries legible English, five do not.

| image | flagged | detections |
|---|---|---|
| `gemini-3-pro-image-1` | **yes** | `HAIR` (0.984), `SERUM` (0.958) |
| the other five | no | — |

**One true positive, five true negatives, no false positives.** The detection
is exactly the text on the product label, at high confidence, on the one image
that has it.

The flag is advisory and recorded on the candidate as `detectedText`. Nothing
deletes on its say-so: a false positive on a texture that reads like lettering
must not silently drop a good image, and the editor is the one who decides.

Worth stating plainly: **the negative prompt containing `no text, no
watermark, no logo` did not prevent this**, which is why the check exists.

## Review page

`benchmarks/results/latest-cutouts/index.html` — per image, the original, the
cutout on a checkerboard, and the cutout composited on the mode's `light`
(`#F8F6F2`) and `background` (`#1A0000`) colours. Four views because a matte
flaw is invisible on the wrong backdrop, and a halo is invisible on a ground
its own colour. Gitignored; regenerate with `npm run cutouts`.

## What this does not say

No model was picked. Nothing here judges whether an image is *good*, only
whether its matte is usable and whether it carries text. The gate passing all
six means the gate did not have to reject anything on this corpus, which is a
weaker statement than the gate working — nothing here has produced a `card`
fallback on real data, and until something does, that path is exercised only
by the synthetic tests.
