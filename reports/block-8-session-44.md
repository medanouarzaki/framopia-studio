Status: OK

Session 44. HEAD at the time of writing `d592084`; this report's own commit
follows. Ledger **108 lines**, sha
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at both ends.
**$0.00 — no API call, no pipeline run, no build.** One After Effects instance,
zero `aerender` and no stray `-r` at session start; unchanged at the end.
**After Effects was not contacted at all**: Goal 1 turned out to need a probe
inside the panel rather than a script, so nothing drove the host. Working tree
clean at start. `footage.json`, every plan, cache entry, mask and image are
untouched.

## Done

### Goal 3 — the message was wrong, and the restart did take

**Established with evidence before anything was changed.** The running service
(pid 75211, started 17:24:45) was queried directly on its own port and token:

```
GET /steps?reel=vitasilk&mode=k2-syndicalia
top-level keys: ['build', 'planPath', 'reel', 'steps']
has build: True
```

**It does send `build`.** The service was not old and the restart took.

**The panel showed the message because nothing had been picked yet.** The Build
pane sits on the main screen always; `plan` comes from `GET /steps`, which the
panel only calls once a video *and* a client are chosen. With neither chosen
there is no plan, so `plan.build` is absent — and the pane read one absent field
as "this service is old" and told him to restart the service he had just
restarted. **Reproduced in a real browser against a healthy, current service**
before the fix, and that test now asserts the new wording.

Three states now, not one:

| | what it says |
|---|---|
| nothing picked yet | *"Choose a client and a video above, and this will say what the composition will contain."* |
| picked, and the service sent nothing | *"The companion service did not say what this build would contain. Quit After Effects and open it again."* |
| the service is behind the panel | the staleness line below |

**Can the panel tell a stale service from a broken one? It could not, and now
it can — partly.** Nothing on the health payload could ever see it:
`serviceVersion` and `appVersion` **both come from the service**, so they agree
with each other by construction and say nothing about the bundle. The one thing
the two sides do not share is *when* each came into being. `build.mjs` now
injects `__PANEL_BUILT_AT__`, and `stalenessOf` compares it against the
service's `process.startedAt` with a minute of slack — because building the
service and starting it are two commands in that order.

That this is a real condition and not a hypothetical: **`service/dist/steps.js`
on this machine is stamped 17:31 and the running service started at 17:24**, so
it is right now running code older than what is on disk.

**What it cannot do**, said plainly: it tells a service that is *behind* from
one that is current, not a behind one from a *broken* one, and it says nothing
at all when either timestamp is missing. A service that has been running since
before the panel was ever built is invisible to it.

### Goal 2 — show the client, do not describe it

**The paragraph was the mode file's `note`**, which has always been the
maintainer's field — "the palette is locked, vocabulary is deliberately empty" —
and session 43 sent it to the panel by mistake.

**Where it belongs: in the file, unread.** `note` stays exactly where it is for
whoever edits the client; **`about` is his line** and is the only text about a
client the panel shows. The form writes `about` now.

**What he sees instead is the client**, in `ClientCard`:

- **Four swatches**, each labelled by what the colour does in a build — "the
  frame around a picture", "behind a cut-out picture" — because `accent` is a
  word from the file and where he will see it is not.
- **Both fonts, set in their own face**, so he reads the type rather than the
  name. A client with none says so and names the standard pair.
- **The logo**, when one is set.
- **One line**: *"Mostly a mix of languages · upright video · your watermark
  on — all standard, nothing set for this client"*, from session 43's
  `clientDefaults`, which already tells his choices from the standard ones.

Four browser tests, including that the four swatches paint the client's real
hex values and that **none of them is the brand accent** — PROJECT_SPEC §6
spends `#ED1C24` on Run pipeline, and a client's palette styles the video, never
the tool.

### Goal 1 — Browse, when the host has a dialog

**Established, not assumed — but the answer still needs his machine.** A browser
`<input type="file">` yields a sandboxed `File` with no path, which is useless
when every stage needs an absolute one. CEP's own
`window.cep.fs.showOpenDialogEx` returns one, and **`window.cep` is injected by
CEP itself — not `CSInterface`, which this extension has never loaded.** That
distinction is why it was worth looking rather than reasoning.

Rather than a script he runs and reports back from, **the panel looks and acts
on what it finds**:

- **Browse… appears only when the call is really there.** A button that opens
  nothing is worse than no button.
- **The path field stays**, so there is always a way through.
- **What the host offered is written in the readiness details either way** —
  *"a file dialog is available"*, *"no file dialog in this host"*, or *"this host
  has cep.fs but no open dialog"* — so if Browse does not appear he can tell me
  which of the three it is in one line.

Seven unit tests cover all three answers plus a cancel, a throw and the file
types offered; three browser tests drive the built bundle with and without a
stubbed host. **Stubbing `window.cep` proves nothing about After Effects**
(guidelines §3) — what is asserted is that the panel looks, and behaves on both
answers. **Only his machine can say which answer it gets.**

`panel/src/video-extensions.ts` mirrors the service's accepted list and a test
pins them equal: a dialog offering a file the folder listing would refuse is a
dialog that hands him an error.

### Goal 4 — handed back

`npm run service:build` and `npm run panel:build` both ran; both changed.

## Deviations

**Goal 1 shipped the probe as the feature rather than as a separate script.**
The brief allowed contacting After Effects for a probe; a probe the panel runs
on every load is strictly better — it decides whether to show the button, it
reports what it found where machine facts already live, and it needs him to
press nothing. After Effects was therefore not contacted at all.

**The image-picker browser tests were left on vitest's 5-second default.** One
timed out in a full check and passed alone — the same class of flake session 42
fixed for three others. They launch a page and navigate like every other browser
test here, so they now carry the same explicit 30-second timeout. The check has
run green twice since.

## Failures & open problems

**None from this session.** `npm run check` passes.

Named rather than fixed:

- **The staleness check cannot see a service that started before the panel was
  ever built**, and cannot tell behind from broken.
- **`videoShape` is still recorded and not acted on** (session 43).
- **Automatic picture matching still waits on the image-prompt defect**
  (Block 9).

Unchanged and still open: frame analysis is reported rather than driven, so
Block 8's definition of done is not met; `dialogueLufs` reaches a plan only
through a migration; `IMPACT_THRESHOLD` is unresolved and the 17 SFX events
remain 8 frames late.

## Repo state

HEAD `d592084`, working tree clean. Four commits this session:

- `c1d79f8 fix: stop blaming the service for a video nobody picked`
- `17e9018 feat: show what a client looks like, not what the file says`
- `dd73c1b feat: browse for a video when the host has a dialog`
- `d592084 docs: record the staleness check, the dialog probe and the client card`
- (this report's commit follows)

`npm run check` **passes**, counts measured per workspace: core **469**, service
**1079**, benchmarks **166**, panel **154 passed / 2 skipped** — **1868
TypeScript tests** — plus **149 pytest**, the mode validator, the panel manifest
parse, the template validator and both model checksums. The Chromium 99
capability denylist passes against the built `panel/dist`.

New: `panel/src/ClientCard.tsx`, `panel/src/staleness.ts`,
`panel/src/file-dialog.ts`, `panel/src/video-extensions.ts`.
`modes/k2-syndicalia.json` was not edited. No plan, cache entry, mask or image
was written. Nothing was staged with `git add -A`. `git log` carries no AI
attribution.

## Suggested next step

Reload — and this time it matters more than usual, because the panel can now
tell you when you have not:

```
pkill -f "service/dist/service.js"
```

Then close and reopen the panel in After Effects.

**Three things to look at, and one to tell me.**

1. **Pick K2 Syndicalia.** You should see four colour swatches labelled by what
   each does, the two font names set in their own type, and one line saying
   everything is standard. The paragraph about PROJECT_SPEC and vocabulary is
   gone for good — it was the note meant for whoever edits the file, and the
   panel should never have shown it. If you want a line about a client, put it
   in the **Note** field when you set one up; that is what appears.

2. **Look at Build before you pick anything.** It should now ask you to choose a
   client and a video, instead of telling you the service is old. That message
   was wrong: I queried the running service directly and it was sending
   everything the panel needed — you had simply not picked a video yet.

3. **This is the one to tell me about.** Next to Refresh there should be a
   **Browse…** button. If it is there, press it: you should get a real macOS
   file dialog filtered to video files, and the path lands in the field beside
   it.

   **If Browse… is not there**, open **Details** on the readiness line at the
   top and read the last line. It says one of three things, and which one tells
   me exactly what your After Effects offers:
   - *"a file dialog is available"* — then it should have appeared, and that is
     a bug I want to know about.
   - *"no file dialog in this host"* — CEP is not injecting `window.cep` here.
   - *"this host has cep.fs but no open dialog"* — it is injecting it, without
     the call.

   Paste me that line either way and I will finish it.

One more thing you may see at the top: **"This panel was rebuilt after the
companion service started."** That is new and it is not an error — it means the
service is running older code than the panel, which has quietly confused four
sessions of ours. If it appears, quitting After Effects and opening it again
clears it.
