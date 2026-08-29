Status: OK

Session 45, the last of Block 8. HEAD at the time of writing `7346fac`; this
report's own commit follows. Ledger **108 lines**, sha
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at both ends
— and unchanged through all thirty-five sessions of part 2. **$0.00 — no API
call, no pipeline run, no build, and After Effects was not contacted.** One After
Effects instance, zero `aerender`, no stray `-r` at session start; unchanged at
the end. Working tree clean at start. **Pushed**: `4b960a6..7346fac`, 566
commits, `main` level with `origin/main`.

## Done

### Goal 1 — the path field is gone

Session 44 established that this host has CEP's own dialog, so the field beside
it was the fallback for a case that does not arise here. **Refresh and Browse…,
and nothing else.** Browse now opens the video directly rather than filling a
box for him to press Open on.

**The fallback is kept for a host without a dialog** — Block 10's second machine
may be one — but as a sentence rather than a control:

> This copy of After Effects offers no file dialog, so videos can only come from
> a client's folder. Set the folder on the client, or put the video in one that
> is already set.

The two tests for the removed control were rewritten in the same change: one now
asserts that a dialogue-less host gets that sentence and **no** path field, the
other that a host with a dialog shows exactly `['Refresh', 'Browse…']`.

### Goal 2 — the handoff

`handoffs/block-8.md`, 481 lines, covering sessions 11–45 and pointing at
`handoffs/block-8-part-1.md` for the rest. Written from all thirty-four reports.

**It states the definition of done as one half met and one half not, as a fact:**

- **"UI passes the user's eye" — met.** He has used every part and ruled on it.
- **"Video-in → built comp entirely from the panel with no terminal" — not
  met.** Frame analysis is reported, never driven, so a video that has never
  been through the sidecar cannot be taken end to end from the panel. Since
  session 39 it refuses and names the command rather than silently building a
  wrong comp, but **refusing is not driving.**

It carries the twenty-four rulings with their dates, their reasons and what each
superseded; the twenty-eight chosen-not-measured constants with where they live;
what is irreplaceable and where the backup put it; the money; and the nine open
items in the order they should be picked up.

**The section worth reading on its own is §5**, the four defect shapes:

| shape | the one that cost most |
|---|---|
| a check that cannot fail | `placementIsSafe` answered "clears the face" with no face, so a 2030 px picture landed across the speaker and the check approved it |
| a number typed rather than measured | a test count carried from a brief for two sessions; a defect document quoting three different cache entries for a block |
| a claim about the host from a test engine | a container query that was dead text in Chromium 99 while four headless assertions passed |
| an input whose absence produced a plausible wrong output | six of them, found by walking the builder |

**What they share is the finding:** every one of them *reported success*. None
threw, none logged, and a green suite stood behind each. The common cause is a
default standing in for an absent fact — null read as "fine", a version carried
forward, a stub standing in for a host, a missing file read as "nothing to do".

### Goal 3 — the record, and what was stale

**Two whole sections of `CLAUDE.md` described a panel that no longer exists.**
Session 42 made the panel one screen and added a section saying so, but left
"The panel is a five-step view over the plan, never a wizard" and "The panel is
laid out by a measured width, not a container query" standing — 4,105 characters
describing the rail, `resumeAt`, the remembered step and a `PANEL_TWO_COLUMN_PX`
whose module was deleted three sessions ago. Replaced with a short section
saying both are retired, keeping the three host lessons that outlive the layout.

**`docs/PROJECT_SPEC.md`**: §5's watermark carried a `TODO (Block 7 start)` for
codec, alpha interpretation and duration — all three measured in Block 7 session
1 and never written back. Closed with the measured facts. SFX gained the hits'
removal, the peak anchor and the mix headroom; Client modes gained the whole
session-43 model; §6 gained the one-screen panel.

**`docs/BLOCKS.md`**: Block 8 now records 45 sessions against a planned 5–7, and
the exact split of its definition of done.

**Checked and found correct:** every `npm run …` named in a user-facing message
is a real script (pinned by `core/src/messages.test.ts`), and the one command
`CLAUDE.md` names that does not exist — `npm run top-left` — appears only in the
sentence saying what replaced it.

### Goal 4 — handed back

`npm run service:build` and `npm run panel:build` both ran; the panel changed
and the service was rebuilt so the pair on disk match.

## Deviations

**None.** Goals 1, 2 and 3 are in three separate commits, plus this report.

One thing worth recording rather than deviating: **`npm run backup` refused
while this was written**, because Google Drive is not running. That is session
40's fix working — 94 files went into a folder macOS had left behind from an
uninstall the first night, and nothing was syncing it. The backup was not run;
it is the first item in the handoff's next steps.

## Failures & open problems

**None from this session.** `npm run check` passes.

Block 8 closes with nine open items, listed in order in `handoffs/block-8.md`
§9. The first three:

1. **Frame analysis is not driven from the panel** — the unmet half of the DoD.
   $0.00, one session.
2. **`dialogueLufs` reaches a plan only through a migration.** $0.00, small.
3. **The image prompt's three defects**, tested together because a prompt change
   is a billable regeneration. ~$1.24 for `test-1`'s eight images.

## Repo state

HEAD `7346fac`, working tree clean, pushed. Three commits this session plus this
report:

- `91a2a09 feat: browse for a video, and nothing to paste into`
- `a54d751 docs: bring the record up to what is true`
- `7346fac docs: hand off block 8`
- (this report's commit follows)

`npm run check` **passes**, counts measured per workspace: core **469**, service
**1079**, benchmarks **166**, panel **154 passed / 2 skipped** — **1868
TypeScript tests** — plus **149 pytest**, the mode validator, the panel manifest
parse, the template validator and both pinned model checksums. The Chromium 99
capability denylist passes against the built `panel/dist`.

`templates/library.aep`, `align.ts`, `correction.ts`, every hand-made reference,
`footage.json`, every plan, cache entry, mask and image are untouched. Nothing
was staged with `git add -A`. `git log` carries no AI attribution.

## Suggested next step

**Block 8 is closed.** Reload once more and it is yours:

```
pkill -f "service/dist/service.js"
```

Then close and reopen the panel in After Effects.

**What you can do with it today, in plain words.**

Open the panel. Pick a client — you will see their colours, their type and your
note about them. Pick one of their videos, or press **Browse…** and choose any
file. Look at what a run would cost; it will often be nothing, because most of
the work is already paid for. Press **Run pipeline** and wait. Then press
**Build the composition**, and After Effects builds it — subtitles, emphasised
words, pictures, sounds and your watermark — and saves it for you to open when
you are ready. Nothing is rendered and nothing is sent anywhere you did not ask.

Watch it. If one thing bothers you, come back and press **Words**, **Emphasis**
or **Pictures**, change that one thing, and Build again. That is the whole
loop, and it is the loop the panel was rebuilt around.

**Two things it still cannot do on its own**, and both need a terminal:

- A video the tool has never looked at needs its frames sampled first —
  `npm run frames -- --reel <name>` then `npm run segment -- --reel <name>`.
  The Build step tells you so and names the commands rather than building
  something wrong. Closing that gap is the first job of the next block.
- `npm run backup` before anything else. **Google Drive was not running when I
  checked**, so nothing has been backed up since the 29th — open Drive, let it
  sign in, and run it. It refuses rather than pretending, which is why you can
  trust it when it says it worked.

**One thing to keep somewhere safe yourself:** `.local/config.json`, 187 bytes,
holding your two API keys. It is deliberately the one file the backup leaves
out, because a shared cloud folder is a different risk from a dead disk.

**For the next conversation:** it opens on Block 9, and its first job is to
collect K2 Syndicalia's fonts and visual identity — the spec has reserved those
for you since the beginning and forbids anyone inventing them. Have the font
names to hand.
