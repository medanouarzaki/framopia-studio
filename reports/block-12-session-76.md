Status: OK

# Block 12 session 76 — noticing when a video and its client do not match

**Expected spend $0.00. No paid call of any kind, no picture generated, no video
transcribed. The ledger is unmoved at 165 lines and the same sha256 at every
check — start, after `npm run check`, after `npm run golden`, and at the end.**
Golden did not move: 17,174 fields, 4 of 4. `npm run check` passed whole.

**The rule is sound and portable, and on this disk it is silent about every
plan — including `sora-995f2d27`.** That is measured, not assumed, and §1 says
exactly why and what would switch it on.

---

## 1. The rule, what it rests on, and what it cannot tell

### The evidence is a folder the person declared

A client already carries **`videoFolder`** — the folder that client's videos live
in, chosen with a folder picker and typed by a person. **A video inside it
belongs to them, on any machine, in any arrangement, in any language.**

**What was rejected, and why.** Mohamed's footage sits under
`…/Clients/<name>/…`, and reading a client's name out of a path would have caught
`sora-995f2d27` exactly. It is still the wrong rule: it works on his disk and on
no other, and the partner's Mac will not look like his. A test pins that the rule
reads no meaning from what a folder is called — a client whose folder is
`/srv/z9/2026-q3` is found, and a folder *named* `Clients/Dr Loubna Kfafi` that
another client declared belongs to **that** client, not to her.

**What else was considered and rejected as evidence.** `.local/videos.json`
records every video ever opened — path, duration, fps, dimensions, sha256, label,
when it was opened — and **no client at all**, so it cannot answer the question.
There is nothing else on disk that ties a video to a client except the attachment
itself, which is the thing being questioned.

### Silence is the default, and it is deliberate

The rule answers `null` far more often than it answers a name:

- when **no client has declared a folder**
- when the video is **in none of them**
- when it is **in more than one** — two clients pointed at the same place, or one
  folder nested inside another. Ambiguous is not a finding.
- when **no client is attached** to the plan at all

**A warning that fires on a guess teaches him to ignore warnings, and then the
true one goes unread too.**

### What it cannot tell

- **Nothing at all until a client declares a folder.** Measured below: on this
  disk neither real client has, so it is silent about all twelve plans.
- Nothing about a video outside every declared folder — it may belong to a client
  who has not declared one, and that is not knowable from here.
- **It never says a video does *not* belong to the attached client.** It says only
  that the video sits in a **different** client's own folder. That is evidence,
  not inference.

### How a machine that has never seen this project gets the same answer

It reads the same field. `videoFolder` is part of a client file, travels with the
repository, and is set from the client card with a folder picker — **no terminal
and no knowledge of this project's history**. A fresh Mac with a client who has
declared a folder gets exactly the same answers as this one; a fresh Mac with no
declared folders gets silence, which is what this Mac gets today.

## 2. What Mohamed sees, and what the offer says will change

Quoted from the real functions, with the attached client's name resolved from its
file the way `dry-run.ts` does:

> **This video is in Dr Loubna Kfafi's folder, but it is set up as K2 Syndicalia.
> It will be built in K2 Syndicalia's colours and type unless you change it.**
>
> *Use Dr Loubna Kfafi instead — their colours, their type, and the shadow behind
> the words. Nothing already built changes, and the old setting is kept.*

**Two names and what changes. No path, no version number, no id.** A test asserts
those as **whole words** — `version`, `mode`, `plan`, `snapshot`, `id`, `palette`
— and that the sentence contains no `/`.

The offer names the three things re-attaching moves — the colours, the type and
the shadow behind the words — because that is what it does, and it is not a small
thing to do by accident.

After he presses it:

> This video is now set up as Dr Loubna Kfafi. The way it was set up before was
> kept, so nothing is lost.

**It sits above the buttons that bill**, not after a composition exists — by then
the wrong brand is already in it. A test asserts `<WrongClient>` appears before
`<RunActions>` in `App.tsx`.

## 3. Every plan on disk, run through the rule

**Clients and their declared folders:**

| client | folder |
|---|---|
| `k2-syndicalia` | **(none declared)** |
| `dr-loubna-kfafi` | **(none declared)** |

| plan | attached to | video is in | warns? |
|---|---|---|---|
| ground truth | k2-syndicalia | cannot tell | silent |
| test 1 | k2-syndicalia | cannot tell | silent |
| test 2 | k2-syndicalia | cannot tell | silent |
| test 3 | k2-syndicalia | cannot tell | silent |
| vitasilk | k2-syndicalia | cannot tell | silent |
| a third video whose pictures run… | k2-syndicalia | cannot tell | silent |
| a video this tool has never seen | a-second-client-for… | cannot tell | silent |
| a video whose client has no pictures | a-client-with-no-pic… | cannot tell | silent |
| a video whose client has pictures | a-client-with-its-ow… | cannot tell | silent |
| another video with its pictures far apart | k2-syndicalia | cannot tell | silent |
| sora-6a60ced1 | dr-loubna-kfafi | cannot tell | silent |
| **sora-995f2d27** | **k2-syndicalia** | cannot tell | **silent** |

**0 of 12 warn**, because the evidence the rule needs has not been entered.
**`sora-995f2d27` — the reel this session exists for — does not warn today.**
Reporting otherwise would be reporting a green I had manufactured.

**Proved capable of the case that motivated it.** A read-only simulation, giving
Dr Loubna the folder her footage actually sits in and writing nothing:

```
sora-995f2d27
   This video is in Dr Loubna Kfafi's folder, but it is set up as K2 Syndicalia.
   It will be built in K2 Syndicalia's colours and type unless you change it.
```

**It names that reel and no other** — not `sora-6a60ced1`, which is in the same
folder and correctly attached to her. Her file is byte-identical:
`f60749f5629b2ced…` before and after.

**Nothing was changed, moved or re-attached.** Whether to declare a folder, and
what to do about that reel, are Mohamed's.

## 4. Where a previous attachment goes

`.local/plans/before-reattach/<reel>-<when>.editplan.json` — **the whole plan
file, copied before its client changes**, and the reply says where it went.

**The whole file rather than the two fields**, because the two fields are not the
whole of what changes: `applyClientDefaultsToPlan` may move the watermark too,
and a copy of the file cannot be wrong about what it held.

- **Copied, never moved** — the plan stays where it is, and a test compares both
  byte for byte.
- **Only when the client really changes.** Re-attaching a plan to the client it
  already has writes no copy, because nothing was lost.
- **Never over a copy already made.** A plan re-attached twice keeps both, since
  either might be the one wanted back.

**A leak this caught in its own test.** The first version wrote into the **real**
`.local/plans/` — the directory a client's own plans live in, and exactly the leak
sessions 69 to 71 paid for twice. The directory is now overridable and the test
points at its own; after a full gate run, `.local/plans/before-reattach` **does
not exist**.

## 5. Every new assertion, red then green

**The build is never refused.** Wiring the mismatch into a run button's
`disabled`:

```
 FAIL  src/wrong-client.test.ts > a video whose client does not match > never refuses the build
Expected: "mismatch in "disabled={!enabled || !subtitlesDone || dry?.mismatch != null}": false"
Received: "mismatch in "disabled={!enabled || !subtitlesDone || dry?.mismatch != null}": true"
```

The test reads **every** `disabled=` line in `App.tsx` and requires none to
mention the mismatch — a rendering test could only show that today's values leave
the button alive.

**It never re-attaches by itself.** Adding an effect that attaches on render:

```
 FAIL  src/wrong-client.test.ts > a video whose client does not match > re-attaches only when pressed
AssertionError: expected 'import { useEffect, useState, type JS…' not to contain 'useEffect'
```

The component has **no effect at all**, and the one call that changes a plan sits
inside the click handler.

**An ambiguous owner must not become a finding.** Letting the first of several
folders win:

```
 FAIL  src/whose-video.test.ts > whose video it is > says nothing when two clients could both claim it
AssertionError: expected { id: 'dr-loubna-kfafi', …(2) } to be null
```

**It must stay silent when they agree.** Dropping the same-client check:

```
 FAIL  src/whose-video.test.ts > a video and a client that do not match > is silent when they agree
AssertionError: expected { attachedTo: { …(2) }, …(1) } to be null
```

All restored byte-identical from saved copies, green re-verified between each.

**A test of mine that was wrong, not the code.** The wording test looked for the
substring `id` and found it inside **video**. The sentence was right; the check
was crude. It now tests whole words.

**And a simulation of mine that was wrong.** My first read-only run printed
`k2-syndicalia` rather than `K2 Syndicalia`, because a plan's `clientMode` stores
only id, version and path. The real path resolves the name from the client file —
`dry-run.ts:495`, `attachedTo: { id: mode.id, name: mode.name }` — which I
verified rather than assumed before quoting the sentence in §2.

## 6. Gates, arithmetic and fingerprints

**`npm run check`: PASS**, exit 0, run after committing. **`npm run golden`:
PASS** — 4415 + 4280 + 3709 + 4770 = **17,174**, field for field. **Nothing
warned and golden did not move**, which is what the corpus should do: all five
reels are K2's own footage under `k2-syndicalia`, and no client has declared a
folder for the rule to speak from.

```
check: 5 compiled artefacts present before the tests run
check: counted with 5/5 corpus Edit Plans and 5/5 reels (11.93 GB) on this disk …
check: 36 skip conditions across 12 test files …
check: nothing was skipped for want of anything on this Mac
```

| suite | passed | skipped | total | session 75 |
|---|---|---|---|---|
| core | **823** | 0 | **823** | 813 |
| service | **1428** | 0 | **1428** | 1426 |
| benchmarks | **173** | 0 | **173** | 173 — unchanged |
| panel | **276** | 2 | **278** | 271 passed, 273 total |

**+10 in core**, all in the new `whose-video.test.ts`:

1. `whose video it is > is the client whose own folder holds it`
2. `… > says nothing when no client has declared a folder`
3. `… > says nothing about a video outside every declared folder`
4. `… > says nothing when two clients could both claim it`
5. `… > reads no meaning from what a folder is called`
6. `a video and a client that do not match > is noticed when the plan says one client and the folder says another`
7. `… > is silent when they agree`
8. `… > is silent when the evidence cannot say`
9. `… > is silent when no client is attached at all`
10. `… > says it in his words, naming neither a path nor a version`

**+2 in service**, in the new `reattach.test.ts`:

11. `keeping the previous attachment > copies the plan aside and says where`
12. `… > never writes over a copy it already made`

**+5 in panel**, in the new `wrong-client.test.ts`:

13. `a video whose client does not match > never refuses the build`
14. `… > re-attaches only when pressed`
15. `… > sits above the buttons that spend`
16. `… > shows only what the service worded, never a path of its own`
17. `… > says the previous setting was kept once it has changed`

813 + 10 = 823, 1426 + 2 = 1428, 271 + 5 = 276. Each closes exactly.

**Five panel runs, each with its exit status:** 276 passed, 2 skipped (278),
exit 0 — five times.

**Part 0, as found at both ends:**

| | at start | at end |
|---|---|---|
| After Effects instances | 1 | 1 |
| `aerender` processes | 0 | 0 |
| **ledger lines** | **165** | **165** |
| **ledger sha256** | **`786497a5f371d179…`** | **`786497a5f371d179…`** |
| `templates/library.aep` | `4b0cf05a8f5d4775…` | `4b0cf05a8f5d4775…` |
| `modes/.gitkeep` | `e3b0c44298fc1c14…` | same |
| **`modes/dr-loubna-kfafi.json`** | **`f60749f5629b2ced…`** | **`f60749f5629b2ced…`** |
| **`modes/k2-syndicalia.json`** | **`c600905c5e36ecbc…`** | **`c600905c5e36ecbc…`** |
| `assets/client-pictures/` | 0 files | 0 files |

The ledger was re-checked after `npm run check` and after `npm run golden`: 165
lines, `786497a5f371d179…`, unchanged at both.

**The extensions folder, byte-identical**, timestamps included:
`com.framopia.studio -> /Volumes/T7 Shield/INSEA/Projects/framopia-studio/panel`,
Aug 27 19:06.

**`.local/` at the start:** `audio` 27 · `bench-audio` 5 · `build` 70 · `cache`
159 · `cv` 2234 · `deleted-clients` 0 · `doctor` 1 · `evidence` 3 ·
`ground-truth` 10 · `plans` 66 · `quarantine-session51` 363 ·
`quarantine-session53` 139 · `quarantine-session54` 1 · `quarantine-session69` 3
· `quarantine-session71` 0 · `transcripts` 1. **No plan was edited and none was
re-attached**; `.local/plans/before-reattach/` does not exist.

After Effects was driven only by `npm run golden`, through `DoScript` into the
already-running instance. It was never launched and never quit. No `.aep` was
written and Mohamed's own project was never saved.

## 7. Money

**No ledger lines added.** 165 lines and the same sha256 at the start, after the
gate, after golden, and at the end. Nothing here could bill: a comparison between
two folders, a sentence, and a copied file.
