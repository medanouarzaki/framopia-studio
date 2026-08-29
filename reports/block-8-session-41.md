Status: OK

Session 41. HEAD at the time of writing `3f330e1`; this report's own commit
follows. Ledger **108 lines**, sha
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at both ends.
**$0.00 — no API call, no pipeline run, no build, and After Effects was not
contacted.** One After Effects instance and zero `aerender` at session start;
unchanged at the end. Working tree clean at start.

## Done

### Goal 1 — the inventory

**194 user-visible strings** across the panel's 14 non-test source files,
extracted mechanically (comments stripped first, so doc prose is not counted):

| file | strings | what they are |
|---|---:|---|
| App.tsx | 68 | the reel step, the service block, the cost block, the run |
| Images.tsx | 26 | the picture picker |
| host.ts | 19 | what is missing when the panel cannot start |
| Build.tsx | 15 | what a build will do and what it did |
| service.ts | 14 | what went wrong talking to the companion service |
| Transcript.tsx | 14 | the word editor and the three questions |
| run-gate.ts | 10 | why Run pipeline is off |
| steps.ts, Keywords.tsx | 9 each | the five step promises; the keyword picker |
| the rest | 10 | index, node-match, types, spend, picture |

**The question each answers** is the column that decided the pass. Most already
answer a real one — "how big is this picture", "what will this cost", "which
service answered" — and those were kept and reworded at most. The ones that
answered nothing he could act on were deleted rather than reworded, and they are
listed below.

### Goal 2 — the rewrite

**Deleted, because they answer no question he can act on:**

| was | why it went |
|---|---|
| `stage` / `retryable: yes` in the service block | Two of the words he named. The cause above already says what happened, and the button says what to do. The retryable fact became a sentence: "This usually clears on its own. Press Try again." |
| `From analysis prompt v4, mode auto, stage done — analysis-590f79bed5eed690 (compatible).` | Five facts, four of them names from the code, including `cacheProvenance`. Replaced by whether the words were chosen for him or are waiting on him. |
| `k001`, `g022`, `kw_slam`, `kw_slam_ar` on every keyword row | Names from the code and the template library. The script is what he can see, so the row says Arabic or Latin. |
| `correction prompt v4` in the service block | Ours, not his. The service version stays. |

**Reworded, with the evidence kept:**

| was | is |
|---|---|
| `img003` heading | `Picture 3 of 5` |
| `Builds with img003-c1 — first candidate, nothing chosen.` | `You have not picked one, so the first goes in the comp.` |
| `Overrides the gate: …` | dropped; "the gate" is our word and the override is already visible |
| `HTTP 404 from /images?reel=vitasilk` | `there is nothing here for this reel yet` |
| `HTTP 401/403 …` | `the panel and the companion service are out of step — close the panel and open it again` |
| `/reels did not return a list` | `the list of videos came back unreadable` |
| `health returned HTTP 500` | `the companion service answered, but not with its status` |
| `skipped, already on the plan` | `already done` |
| `cached, older guide` | `free, reusing an earlier run` |
| `cached` | `free, already paid for` |
| `to run, about $1.63` | `will run, about $1.63` |
| `This plan records no client; a build needs --mode.` | `No client saved for this reel yet. Run the pipeline and it is saved for you.` |
| `Built for k2-syndicalia v5, recorded on the plan.` | `Made for k2-syndicalia.` |
| `No image slots on this plan. Analysis plans them; it has not run for this reel.` | `No pictures for this reel yet. Run the pipeline on step 1 and it works out where they go and makes them.` |
| `Nothing generated for this slot.` | `Nothing made for this one yet.` |
| `The dry run did not price generating it.` | `The cost of making it could not be worked out.` |
| `No reels found on this machine` / `No modes in modes/` | `No videos found` / `No clients set up yet` |
| `hold clipped` | `very short`, with "Too short to hold: it appears and goes." on hover |
| `lang unknown · latin` on hover | `Latin script` |
| `Retry` | `Try again` |
| `{stage}: {cause} (worth retrying)` on a failed run | the cause, then `It is worth trying again.` |

**The five step promises**, which described the code rather than the screen —
one of them promised "regenerate with a tweak", which does not exist:

| step | is now |
|---|---|
| Reel | Pick the video and the client, and see what a run would cost before it runs. |
| Transcript | Fix any word that came out wrong, and set how long each one stays on screen. |
| Keywords | Choose which words are emphasised on screen. |
| Images | Look at the pictures made for this reel and pick the one you want. |
| Build | Build the composition in After Effects. |

**Kept deliberately, and this is the half that could have been lost:** sizes in
pixels, costs in dollars, which service answered and since when, the file a build
wrote, the fonts a build will use, every buildability issue by name, and the
per-reel and corpus counts on the three transcript questions. Losing those in
the name of friendliness would undo a dozen sessions.

**Not changed, because he has ruled on them:** Run pipeline is still the one red
control and nothing else uses the accent; "Pick a video." still attaches to the
control it explains; the two pickers stay separate; the service fact list
(ffmpeg, ffprobe, CV sidecar, node, templates) and the section headings are as
they were. I read his "the service block stays" as covering that fact list and
its layout, and still removed `stage` and `retryable` from the *unreachable*
state, because he named both — said here so he can overrule it.

**Not changed, because it would change behaviour:** `alpha_edge_noise`,
`hole_ratio` and `edge_halo` are not on screen any more — session 31 scoped the
cutout verdict and the picker already says "background came away cleanly". His
screenshot predates that. `gate rejected` / `gate passed` are likewise gone; the
word "gate" survived only in `Overrides the gate`, which this session removed.

**15 tests asserted the old strings and were rewritten in the same change**, not
left green — including four that asserted a stage id was on screen and two that
asserted `kw_slam` and `kw_slam_ar` were. Three now assert the **absence** of the
ids, so a future change cannot quietly put them back.

### Goal 3 — a dead sync folder is refused

**Nothing on the filesystem separates a live cloud folder from a leftover, and
that was measured rather than assumed.** A live Drive folder and the local home
directory report the **same device id** (16777229 on this machine), the same
filesystem in `df`, and permissions persist on a leftover so the account root is
`dr-x------` either way. `st_dev` looked like the answer and is not — checking it
would have been a false check.

**The only observable difference is outside the filesystem: whether a process is
there to serve it.** `checkSyncClient` reads the app out of the folder name —
macOS names these `<Provider>-<account>`, so `GoogleDrive-…` names Google Drive,
`OneDrive-Personal` names OneDrive, `Dropbox` names Dropbox, and
`~/Library/Mobile Documents` is iCloud, served by `bird`. It then looks for a
running process from an app bundle of that name. **A cloud copy is refused unless
one is running**, with a sentence that says what would otherwise happen:

> Google Drive is not running, so nothing is syncing this folder. Files copied
> here would sit on this machine looking like a backup and never reach the
> cloud. Open Google Drive, wait for it to finish signing in, then run this
> again.

**What the check cannot tell you**, stated in the code and on screen: whether
*this exact folder* is the one being served — a second, stale
`GoogleDrive-someone-else@…` would pass while syncing nothing — whether the
account is signed in, whether syncing is paused, or whether the upload has
finished. It is the check that would have caught the failure it exists for, and
no more than that.

**Seven tests pin it**, including the dead case, Dropbox and OneDrive by the same
rule, a folder whose name attributes it to no app, and one that reads the running
apps off this machine. Verified live against the now-installed Drive: `Google
Drive is running, so this folder is being synced.` **The backup was not run** —
it had already run successfully; the no-op re-run above only confirmed the check.

### Goal 4 — handed back

`npm run service:build` and `npm run panel:build` both ran. The service changed
(the sync check) and the panel changed throughout.

## Deviations

**None.** Goals 2 and 3 are in separate commits, plus one for `CLAUDE.md`. The
check was read before each commit this time, which session 40 did not do.

## Failures & open problems

**None from this session.** `npm run check` passes.

Two things worth naming rather than fixing here:

- **The string count is still 194.** The pass rewrote and deleted rather than
  adding, and a few deletions were balanced by sentences replacing fact rows.
  The number is not the measure; which questions they answer is.
- **`host.ts` carries 19 strings** about a panel that cannot start at all. They
  are already written for a person ("cep_node is not available" was fixed in
  session 6), and none appears unless CEP is broken, so they were read and left.

Unchanged and still open: frame analysis is reported rather than driven, so
Block 8's definition of done is not met; `dialogueLufs` reaches a plan only
through a migration; the image prompt is Block 9; `IMPACT_THRESHOLD` is
unresolved and the 17 SFX events remain 8 frames late.

## Repo state

HEAD `3f330e1`, working tree clean. Three commits this session:

- `5e75ca0 feat: refuse a cloud backup nothing is syncing`
- `7dcc165 feat: write the panel in his words, not the code's`
- `3f330e1 docs: record the language rules and the dead-sync-folder refusal`
- (this report's commit follows)

`npm run check` **passes**, counts measured per workspace: core **466**, service
**1057**, benchmarks **166**, panel **167 passed / 2 skipped** — **1856
TypeScript tests** — plus **149 pytest**, the mode validator, the panel manifest
parse, the template validator and both model checksums. The Chromium 99
capability denylist passes against the built `panel/dist`.

Nothing was staged with `git add -A`. `templates/library.aep`, `align.ts`,
`correction.ts` and every hand-made reference file are untouched. No plan was
written and no behaviour changed. `git log` carries no AI attribution.

## Suggested next step

**Read the panel, do not test it.** Reload first:

```
pkill -f "service/dist/service.js"
```

Then in After Effects, close the Framopia Studio panel and open it again from
Window → Extensions → Framopia Studio. It starts a fresh service itself.

Walk all five steps on `vitasilk` in order and read every screen as a person,
not as someone checking a feature. **The only question is whether any word makes
you stop and wonder what it means.** If one does, tell me the exact words and
which screen — that is a defect, not a preference.

A few places worth a second look, because they are where I made a judgement you
may not share:

1. **Step 3.** The line under the keywords now says only whether they were
   chosen for you. The cache entry, the prompt version and `cacheProvenance` are
   gone. If you ever needed one of them, say which.
2. **Step 4.** Pictures are numbered "Picture 3 of 5" instead of `img003`, and
   the options are still shown side by side. The size in pixels stayed, because
   it is the number behind "make them bigger".
3. **The service block on step 1.** Its fact list is untouched, as you ruled —
   but `stage` and `retryable` are gone from the failure state, since you named
   both. Say if you want them back.

Separately: **the backup now refuses to write into a cloud folder nothing is
syncing.** If Google Drive is ever closed or signed out when you run
`npm run backup`, it stops and tells you to open it, instead of writing 53 MB
into a folder that goes nowhere — which is what happened last night.
