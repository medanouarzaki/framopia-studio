Status: OK

# Block 8 session 32 — the panel was newer than its service

**Spent $0.00; no API was called.** `.local/costs.jsonl` byte-identical at both
ends: **108 lines, sha256
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593`.**

**After Effects: 1 instance and 0 `aerender` at session start, unchanged at the
end. AE was not contacted.** No image, cutout or plan was written, moved or
deleted.

## Done

### Goal 1 — the three columns, before touching anything

**They agree. All ten.**

| slot | builder places | `renderedPath` | on disk |
|---|---|---|---|
| img001-c1 | `…/images-699c0a38a9c512ff/image.jpg` | same | present |
| img001-c2 | *(not the one selected)* | `…/images-ac0e7b6fee0743c4/image.jpg` | present |
| img002-c1 | `…/cutouts/img002-c1.cutout.png` | same | present |
| img002-c2 | *(not the one selected)* | `…/cutouts/img002-c2.cutout.png` | present |
| img003-c1 | `…/images-2982dc2a1f55bea1/image.jpg` | same | present |
| img003-c2 | *(not the one selected)* | `…/images-10ca07d38e3f608b/image.jpg` | present |
| img004-c1 | `…/images-e9fad12565d42c6e/image.jpg` | same | present |
| img004-c2 | *(not the one selected)* | `…/images-400cd405f9caaadb/image.jpg` | present |
| img005-c1 | `…/images-309682651217f6c7/image.jpg` | same | present |
| img005-c2 | *(not the one selected)* | `…/images-666271d7c6ae5e33/image.jpg` | present |

All twenty files — ten generated pictures and ten cutouts — are on the disk.
Every path is absolute. `renderedExists` computes `true` for all ten. **The path
derivation was never wrong, and none of the divergences the brief listed as
candidates is what happened.**

**So the defect is between the service and the screen, and I asked the service
the panel is actually talking to.** Over its own port and token from
`.local/service.json`:

    renderedPath     <<< NOT SENT >>>
    renderedExists   <<< NOT SENT >>>
    qualityApplies   <<< NOT SENT >>>
    slot.rendersAsCutout    <<< NOT SENT >>>
    slot.nothingIsMeasured  <<< NOT SENT >>>

**The running service is older than the panel.** It is pid 95358, started
`2026-08-28T20:57:36Z`, and `service/dist/image-view.js` was built at 22:14 —
session 31's build landed after that process started, and nobody restarted it.
The panel bundle *was* session 31's, so it read `candidate.renderedExists` as
`undefined`, took the else-branch, and printed **"this picture is missing from
the disk"** for every candidate, uniformly, which is exactly the symptom.

**The real defect is that the panel assumed the service was as new as itself.**
The bundle is reloaded from `panel/dist`; the service is a long-running process
the user started earlier. A bundle can always be newer than the service it talks
to, and reading a field the service does not send as a fact about the disk
breaks the panel's own standing rule — it is a view over the service and
degrades rather than concluding.

### Goal 2 — fixed, and the message says what is true

`pictureFor` in `panel/src/picture.ts` is the one rule:

- **`renderedPath` when the service sends it** — the service's own answer, preferred.
- **Otherwise the builder's rule applied to the older reply**: the cut-out on a
  cutout slot, the generated picture otherwise. Session 31's intent is kept —
  the primary image is what the build will place — without requiring a service
  that knows the word.
- Slot shape is tolerated too: `rendersAsCutout ?? presentation === 'cutout'`.

**Three facts, three sentences**, where there had been one:

| state | on screen |
|---|---|
| the service says the file is gone | *this picture is no longer on the disk* |
| the panel was given no path | *the panel could not work out which picture this is — restart the service* |
| the file is there and the image failed to load | *this picture is on the disk but the panel could not display it* |

The second blames the tool, which is what it is. The third comes from the
image's own `onError`, so a picture that is present but unreadable stops being
reported as data loss.

**`fileUrl` encodes the path.** Every cutout lives under
`my files/test videos/cutouts/`, so a space in a directory name is the normal
case here, and a raw space is not legal in a URL. This was latent — the same
unencoded form is used by the keyword picker's audio — and is now correct at
least for the pictures.

### Goal 3 — a check that could have caught it

**141 panel tests passed while nothing rendered**, because every one drives a
fixture shaped like the service's reply. A fixture always has its files.
Guidelines §3 in its general form: a test environment more capable than the host
proves nothing about the host, and a fixture is more capable than a disk.

`service/src/image-files.test.ts` walks the reels that really have generated
images and, for every candidate, checks the path the picker would render:
**exists, is a file, is readable, is not empty** — and that the picker names the
**same file the builder would place**. It also asserts the corpus really does
contain a path with a space in it, so the URL encoding has something to do, and
refuses to be vacuous: a first test fails if there is no reel with candidates at
all. It is in the service tests because they already read the real plans; a
browser test cannot see the filesystem.

**The browser tests now reproduce the defect as well.** One strips session 31's
fields from the payload — a service older than the panel — and asserts the
pictures still appear; two more separate "gone" from "no path given". Verified
against the shipped code: **four of them fail** on session 31's `Images.tsx` and
pass on the fix.

**What else in the panel is asserted only against a fixture**, named and not
fixed:

- **The keyword picker's SFX preview** played audio from `file://` with the same
  unencoded path. It is gone from the panel since session 27, but the pattern
  was identical and no test ever loaded a real file.
- **`Transcript`, `Keywords` and the pipeline runner** are driven entirely by
  `window.__transcript`, `window.__keywords`, `window.__job` and `window.__run`.
  None of their figures is ever compared against a plan on disk; the service
  tests do that separately, so a divergence between the two shapes would show up
  the way this one did.
- **`window.__repo` and `window.__files`** stand in for the repository root and
  the service binary's presence — both real filesystem facts, both stubbed.
  Session 8 already found one defect of exactly that kind (`realpathSync('')`
  returning the process cwd) and closed it with an integration test rather than
  a browser one.
- **The step rail** is driven by a `/steps` fixture; `stepsFor` is tested
  against real plans separately, so the two can drift as `/images` did.

## Deviations

None. Nothing was generated, no plan or image was touched, AE was not contacted,
and the fix waited until the three columns were in front of me.

**One test was extended rather than added**: the browser fixture gained the
stripped-payload cases in the same file as the picker's other tests, because
splitting them from the harness they share would have duplicated it.

## Failures & open problems

- **The user must restart the service**, not only reload the panel. The fix
  makes the old service work; the new fields — the plain-language verdicts from
  session 31 — need the new one.
- **The `file://` encoding is fixed for pictures only.** Nothing else in the
  panel loads a file by URL today, but the next thing that does will need it.
- **No test loads a real image in a browser.** The service test proves the file
  is there and readable; whether Chromium 99 inside CEP renders it from a
  `file://` page is still only established by the user looking at it.
- **The fidelity defect from session 31 stands**: nothing checks whether a
  picture shows what its idea asked for. Block 9.

## Repo state

Branch `main`, HEAD **`aceb22c`** at the time of writing; this report's own
commit follows.

    aceb22c docs: record session 32 in the operating memory
    62b5540 test: check every picture the picker shows against the real disk
    2456c10 fix: show the picture when the service is older than the panel

`npm run service:build` and `npm run panel:build` both ran.

`npm run check` **passes, exit 0**, read from the exit status:

| workspace | tests |
|---|---:|
| `@framopia/core` | 445 |
| `framopia-service` | 978 |
| `framopia-benchmarks` | 166 |
| `framopia-panel` | 153 passed, 2 skipped |
| **TypeScript total** | **1742** |
| pytest (sidecar) | **166** |

Session 31 closed at 1725 TS and 166 pytest.

**The capability denylist passes against the built bundle**: no CSS feature
Chromium 99 would drop, no JavaScript API it lacks, no container query, and the
bundle is built from the current source.

## Suggested next step

**Nothing was lost. All ten pictures are on the disk and always were** — the
panel was reading a field the service it was talking to had never heard of, and
saying "missing from the disk" about it.

**Restart the service, then reload the panel.** The service is the part that
matters this time:

    npm run service

Then in After Effects: **Window → Extensions → Framopia Studio**, close it and
open it again.

The picker will work either way now — that is the fix — but the plain-language
verdicts from last session need the new service.

**What to look at:** every candidate should show its picture again, the whole
framed picture on four slots and the cut-out subject on `img002`. If any one of
them still says something instead of showing a picture, the sentence now tells
you which of three things happened, and only one of them is about the disk.
