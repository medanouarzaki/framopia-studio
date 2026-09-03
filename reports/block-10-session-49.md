# Block 10 session 49 — her colours cannot be put on one reel

**Status: PROBLEM — the product has no way to give one reel a different palette,
so nothing was run and nothing was spent.**

## The three answers

1. **There is no `.aep`.** Nothing was built.
2. **It cost $0.00.** The ledger is untouched at 145 lines; **about $11.19
   remains.**
3. **Her colours could not be applied at all** — not to the cards and not to the
   pictures.

## Why

The four colours can only reach a reel through a **mode file**. Every writer of
a plan's pinned snapshot derives it from one — `analysis/job.ts:237` and `:429`,
`server.ts:671` and `:710`, and the snapshot migration — and each calls
`snapshotOfMode(loadMode(id))`. `loadMode` takes an **id**, `modePathFor`
resolves it to `modes/<id>.json`, and `MODES_DIR` is a hard-coded constant.

**There is no palette flag, no per-plan override, and no way to point a run at a
mode outside `modes/`.** I checked every CLI that takes `--mode`, every route,
and all 58 npm scripts.

So her palette needs one of two things, and the brief forbids both:

- **editing `modes/k2-syndicalia.json`** — explicitly ruled out, and it would
  move every other reel that is not already pinned;
- **a new file in `modes/`** — which is creating a client, because `listModes`
  reads every `.json` in that folder and it would appear in the client picker.

The brief said to say so plainly and stop rather than edit K2's file. That is
what this is.

## Why it was not run under K2's colours anyway

Because the palette decides what the **pictures** look like, not just the cards.
K2's style prompt carries it into every image request:

> the brighter end of the palette leads: `{{palette.accent}}` and
> `{{palette.light}}` carry the subject, with `{{palette.primary}}` for depth and
> `{{palette.background}}` kept to the ground behind it

`renderStylePrompt` substitutes the four hexes at slot-planning time
(`slot-select.ts:266`), the result is frozen onto the plan as `slot.prompt`, and
generation sends that string verbatim (`generate.ts:247`).

Run under K2, the eight pictures would be lit for **#C9A96E gold on #820000 and
#1A0000 dark red** — her brand is **#E8873A orange on #123448 and #1C1210**.
They would be tonally wrong for her and almost certainly rebought. **The
pictures are $1.21 of the $1.36 projection**, so that is most of the run spent
twice. Cheap to avoid tonight, expensive to undo tomorrow.

## What was confirmed, free

**The file is new.** `619b8eaecae46b0da6f3c8cc9f9b08636a348a1d2ecef40bcdaa7e8cac2c4b67`
— it matches no plan and no cache directory. The `sora.mov` the project knows is
`344265a0…`, 40.54 s, in `September Content/Exports/Work in Progress/`. Nothing
is cached for this one, so every stage would bill.

**The reel:** 2160 × 3840, 29.97 fps, **13.514 s**, 1,487,661,174 bytes. Read
only; nothing was written into his client folder.

**The projection, from config** — `IMAGE_SLOTS_PER_30S` 8 over a 30 s window:

| | |
|---|---:|
| 13.514 s → 3.60, rounds to **4 slots** → 8 images at 2 candidates | |
| pictures, 8 × $0.1512 measured | **$1.2096** |
| transcription + keywords + slots, scaled from the measured 40.5 s run | **$0.1492** |
| **projected total** | **~$1.36** |

Under the $2.50 ceiling and close to his own $1.20 estimate. **The money was
never the blocker.**

## The decision that unblocks it

Either is one command away, and the run is ~$1.36 whichever he picks:

1. **Make her a client** with K2's three faces for now — Inter SemiBold,
   Cormorant Garamond Italic, Almarai Bold — and her four colours. Her fonts get
   chosen later; changing them afterwards is `POST /clients/palette`'s sibling
   problem, and today only the palette can be edited after creation. This pins
   K2's faces to the reel, which is what "run it under k2-syndicalia" means
   anyway.
2. **Accept K2's colours for tonight**, get the comp, and rebuy the pictures
   when her client exists — about $1.21 spent twice.
3. **Or the product grows a per-reel palette override**, which is a session, not
   a command.

Nothing here is a guess about which he wants: option 1 creates a client, which
he ruled out tonight; option 2 spends his money twice. Both are his call.

## Repo state

Nothing changed but this report. **Ledger 145 lines /
`d4fe2de37f5eb0c8553423b744bc5010be80738a611cd6cb065a008104b14ab1`** at both
ends — no line added. `templates/library.aep` `4b0cf05a8f5d4775…` and
`modes/k2-syndicalia.json` `c600905c5e36ecbc…` byte-identical at both ends.
`modes/` holds only `k2-syndicalia.json`; `.local/plans/` only `sora-995f2d27`;
the cache is still 6 videos. No plan was created for the new file. Branch `main`,
tree clean, one After Effects instance running and never touched. His footage
was hashed and probed, never written.

`npm run check` was not run — no code was changed. `npm run golden` was not run,
as instructed.

## Suggested next step

Rule on the three options above. If it is option 1, making her client with K2's
three faces and her four colours takes a minute, and the reel then runs and
builds in one pass for about $1.36 with her look on both the cards and the
pictures.
