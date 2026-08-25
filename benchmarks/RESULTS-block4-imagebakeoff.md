# Model bake-off — six images, both arms complete

Session 2 halted this at image 1 because the client sent no `aspectRatio` and
the API served 2752x1536. **That fix is verified: all six images came back
2048x2048.** The comparison corpus exists.

It also cost more than it should have. A cache-eviction defect made the
verification run regenerate images that were already on disk, and session
spend reached **$1.326673 against a $1.00 ceiling**. The defect and the
overrun are in `reports/block-4-session-3.md`; this file is the measurement.

**No quality verdict. Nobody has looked at the images.**

## The slot

`img002` of `vitasilk`, 6.259s–8.86s, second of five, word ids
`w0018`–`w0027`. Prompts recomposed against mode **v3** with no model call.

### Prompt, verbatim

```
A cosmetic bottle of hair serum on a presentation podium. a single clear idea, readable at a glance. one subject, centred and unobstructed. dominant colour palette of #1A0000, #820000 and #C9A96E. lit against #1A0000, with #F8F6F2 reserved for highlights. seen from slightly below, looking up. close, the subject filling most of the height. flat frontal light, no modelling.
```

### Negative prompt, verbatim

```
no extraneous objects, no background clutter, no incidental detail, nothing in frame that is not carrying the idea, no busy or competing composition, no text, no watermark, no logo
```

**The self-contradiction session 2 reported is gone.** That prompt read
`one subject, centred and unobstructed` and `subject off-centre with open
space to one side` in the same breath. The varying half now draws camera
angle, framing tightness and lighting, none of which can contradict a
placement the invariant half fixes — and `validateMode` rejects a mode where
they could.

## The six images

Every one **2048x2048**, exactly as requested. Every one `image/jpeg` — neither
model returned PNG for either arm.

| model | idx | dims | estimate | actual | over | wall | bytes |
|---|---|---|---|---|---|---|---|
| `gemini-3.1-flash-image` | 0 | 2048x2048 | $0.1010 | $0.119712 | +18.5% | 21.7s | 1,752,462 |
| `gemini-3.1-flash-image` | 1 | 2048x2048 | $0.1010 | $0.123252 | +22.0% | 20.5s | 1,469,250 |
| `gemini-3.1-flash-image` | 2 | 2048x2048 | $0.1010 | $0.118092 | +16.9% | 23.0s | 1,406,430 |
| `gemini-3-pro-image` | 0 | 2048x2048 | $0.1340 | $0.151246 | +12.9% | 215.0s | 1,862,566 |
| `gemini-3-pro-image` | 1 | 2048x2048 | $0.1340 | $0.150766 | +12.5% | 33.1s | 1,922,200 |
| `gemini-3-pro-image` | 2 | 2048x2048 | $0.1340 | $0.149086 | +11.3% | 72.3s | 1,692,813 |

Corpus cost **$0.812154**. Files are in
`benchmarks/results/latest-imagebakeoff/` with `candidates.json` recording each
one's size and sha256 prefix.

The flash files are the **second** run's and the pro files the **first**
run's, because the eviction defect made the second run regenerate the flash
arm and overwrite those three review copies. All six are the same model, same
prompt, same resolution and same aspect ratio, so the comparison is intact;
the manifest was rebuilt to describe the files actually on disk rather than the
run that first produced them.

### No model returned any text

Six responses, zero text parts. The `Avoid:` phrasing — the negatives are
appended as prose because these models take no negative-prompt field — drew no
conversational reply from either model.

**That is all this establishes.** Whether the negatives were *obeyed* is a
question about the pictures, and nobody has looked at them.

### Wall clock

Flash is consistent: 20.5–23.0s. Pro is not: 33.1s, 72.3s, 215.0s for three
identical requests. The 215s call was the arm's first, so a cold start is the
obvious guess and three calls cannot confirm it. On these numbers pro is
between 1.4x and 10x slower per image, and the spread is wider than the gap.

## The price table under-predicts even at the correct shape

Session 2 found a 21.4% overage and traced it to a served shape that matched
no published (size, aspect) pair. **That explanation was necessary but not
sufficient.** Every one of these six images was served at exactly the
requested 2K 1:1 — a published pair — and every one still billed over:

| model | published per-image | mean actual | mean over |
|---|---|---|---|
| `gemini-3.1-flash-image` | $0.1010 | $0.120352 | **+19.2%** |
| `gemini-3-pro-image` | $0.1340 | $0.150366 | **+12.2%** |

Working back from the flash figures at $60/M output gives roughly 1,930–2,050
output tokens against the **1,680** Google publishes for 2K.

So the published per-image rate is a **floor, not a price**, even for an exact
published pair. The overage is smaller and steadier at the correct shape
(11–22%) than at the wrong one, which is worth something — but any budget
built from the table needs a margin, and the ledger must keep taking its
figures from `usageMetadata`.

## Per-reel arithmetic

From the published rates, which the table above shows are floors.

**2K** (both arms were run at 2K):

| candidates/slot | flash, 4-slot | flash, 5-slot | pro, 4-slot | pro, 5-slot |
|---|---|---|---|---|
| 2 | $0.808 | $1.010 | $1.072 | $1.340 |
| 3 | $1.212 | $1.515 | $1.608 | $2.010 |
| 4 | $1.616 | $2.020 | $2.144 | $2.680 |

**1K**, where pro is priced identically and flash drops to $0.067:

| candidates/slot | flash, 4-slot | flash, 5-slot | pro, 4-slot | pro, 5-slot |
|---|---|---|---|---|
| 2 | $0.536 | $0.670 | $1.072 | $1.340 |
| 3 | $0.804 | $1.005 | $1.608 | $2.010 |
| 4 | $1.072 | $1.340 | $2.144 | $2.680 |

Applying the measured overage — +19.2% flash, +12.2% pro — a 5-slot reel at 3
candidates costs about **$1.81 on flash at 2K**, **$1.20 on flash at 1K** and
**$2.26 on pro at either**. Pro prices 1K and 2K the same, so there is no
reason to run pro below 2K.

## Cache

**The cache-hit verification failed and is the reason this session is a
PROBLEM.** A second invocation regenerated instead of hitting, at a cost of
$0.51.

The cause was not the fingerprint, which was correct and stable. The image
stage sized its eviction budget from **one call's** image count, so the pro
arm's eviction deleted the three entries the flash arm had just written. Any
run that calls twice over one video destroyed its own cache.

Fixed: `evictStaleEntries` takes a protect list it never removes, and the
image budget is a per-video constant. The two-arm scenario is now a test that
fails against the old eviction and passes against the new one.

**The fix is verified against the fake client only.** No live re-verification
was run, because the session was already over its ceiling and confirming a
cache hit with real calls would have meant spending more to prove that
spending had stopped.

## What this does not say

No model was chosen. No image was judged. Flash is cheaper and faster and
that is a fact about the invoice, not about the pictures. The corpus is six
files at 2048x2048 from one slot of one reel, waiting to be looked at.
