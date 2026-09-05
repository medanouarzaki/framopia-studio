Status: OK

# Block 11 session 61 — a photograph's path now survives a different machine

**Expected spend $0.00. No paid call of any kind, no picture generated, no video
transcribed. The ledger is unmoved at 165 lines and the same sha256 at both
ends. Golden did not move: 17,174 fields, 4 of 4.**

---

## 1. Session 60's three open questions

**Where the client from part 2 went, and whether anything was written into
`modes/`.** Yes, briefly, and that is what `createClient` does: it writes
`modes/<id>.json`, which is the real route and the reason the test uses it.
`photograph-warning.test.ts` removes each in `afterEach`, and the part-3 scratch
client `build-warning-session-60` was removed in session 60's own cleanup.
**`modes/` holds exactly `k2-syndicalia.json`, `dr-loubna-kfafi.json` and the
tracked `.gitkeep` — measured at the start of this session.** Nothing was left
behind and nothing needed moving aside.

**Where the `.aep` went, and whether Mohamed's project was saved.**
`.local/build/build-warning-session-60-full.aep`, removed in session 60's
cleanup; `.local/build/` holds 13 `.aep` files and none of them is it.

**His own project was never saved, and the build said so itself.** Both session
60 builds reported:

```
"savedOwnOutput": null,
"emptiedUntitled": false,
```

`build-reel.jsx` will save exactly one thing — a project whose file is already
inside `.local/build/`, i.e. the build's own previous output — and it names it
in `savedOwnOutput` when it does. It was `null` on both runs, so nothing was
saved at all.

**The fingerprints.** All byte-identical, measured at both ends of this session:
`templates/library.aep` `4b0cf05a8f5d4775…`, `modes/k2-syndicalia.json`
`c600905c5e36ecbc…`, `modes/dr-loubna-kfafi.json` `f60749f5629b2ced…`, ledger
165 lines at `786497a5f371d179…`.

---

## 2. Every place a picture path is written and read

| written | covered by |
|---|---|
| `service/src/clients/create.ts:126` — `buildClient`, on create | read-time resolution in `parseMode` |
| `service/src/clients/create.ts:209` — `addPicture`, afterwards | the same |
| `service/src/video-pictures.ts:65` — `addVideoPicture`, onto the plan | read-time resolution in `resolvePlanPaths` |

**Nothing was changed about writing.** A path is stored exactly as it was given,
which is provenance — the same choice the plans have made since session 10.

| read | covered by |
|---|---|
| `core/src/mode.ts` `parseMode` → **`resolveModePaths`** (new) | `mode.pictures[].path` and `mode.logoPath` |
| `service/src/editplan/io.ts` `resolvePlanPaths` (extended) | `plan.pictures[].path` |
| `service/src/build/client-picture.ts:46, 71` | reads the resolved values above |
| `service/src/image-view.ts:234` | the same |
| `service/src/catalogue.ts` `listModes` | the same — and now reports reachability |
| `panel/src/ClientPictures.tsx:95`, `panel/src/Images.tsx:254, 333` | draws what it is handed |
| `service/src/build/preflight.ts` | still refuses a file that is not there |

**Both gaps session 60 named are closed**, and every downstream reader inherits
the fix because both go through the one door each: `parseMode` is how every
reader loads a client, and `readEditPlan` is how every reader loads a plan.

**It is `resolveStoredPath` and not a second mechanism.** Its four cases already
say the right thing about a photograph, in its own words: *"Genuinely outside any
repository — returned unchanged. It is not the repo's to move: a client's own
photograph lives where its owner put it."*

**Nothing is copied and nothing is sent.** The file is untouched; only the string
that names it is resolved, at read time.

---

## 3. The migration: there isn't one, and that is the point

**A path stored the old absolute way keeps working, and nobody re-attaches a
photograph.**

Resolution happens **at read time** and the stored value is never rewritten, so
there is no schema change, no new field, no validator to migrate through, and no
file on disk to update. A client written a month ago and a client written today
are the same file, and both resolve.

Proved by three of the six new core tests:

- a path **inside a repository** on another machine → re-rooted onto this one;
- a path **outside any repository** → returned exactly as stored;
- a path **already on this machine**, stored the old way → returned untouched.

The two real client files are byte-identical at both ends of this session, which
is the same statement measured from the other side.

---

## 4. The sentence

Shown beside the photograph on the client card:

> **This photo is on a drive this Mac cannot see, so it cannot be used here yet.
> Plug that drive in, or add the photo again from where it is now.**

No path, no error code, no jargon. It names which photograph by sitting beside
it, in the words he described it in. **It does not refuse and it does not
forget** — both pictures stay listed and the client is unchanged. It sends
nobody to a terminal; `leave-the-panel.test.ts` passes.

---

## 5. Every new assertion, proved to fire

### The fix — re-rooting

**Red 1 — `parseMode` stops resolving**, which is exactly the state session 60
measured:

```
× a photograph written on another machine > is applied by parseMode, which is how every reader loads a client
  → expected '/Volumes/Someone Elses Drive/work/fra…' to be '/Volumes/T7 Shield/INSEA/Projects/fra…' // Object.is equality
Tests  1 failed | 5 passed (6)
```

**Red 2 — a photograph outside the project gets moved anyway**, the failure mode
that would break the never-moved rule:

```
× a photograph written on another machine > resolves to the right picture where the drive does not exist
  → expected '/Volumes/T7 Shield/INSEA/Projects/fra…' to be '/Volumes/T7 Shield/INSEA/Projects/fra…' // Object.is equality
× a photograph written on another machine > leaves a photograph that lives outside the project exactly where it is
  → expected '/Volumes/T7 Shield/INSEA/Projects/fra…' to be '/Volumes/Some Other Drive/clients/k2/…' // Object.is equality
× a photograph written on another machine > leaves a path stored the old way, on this machine, untouched
  → expected '/Volumes/T7 Shield/INSEA/Projects/fra…' to be '/Volumes/T7 Shield/INSEA/Projects/fra…' // Object.is equality
```

### The honesty — saying the bytes are not there

**Red 3 — the service stops saying whether the file is there:**

```
× whether a photograph is on this machine > says so for one that is, and for one that is not
  → expected [ 'pic001: true', 'pic002: true' ] to deeply equal [ 'pic001: true', 'pic002: false' ]
```

**Red 4 — the panel never says it:**

```
× a client already saved > says a photograph is on a drive this Mac cannot see
  → expected 'Their own photographsPhotographs they…' to contain 'on a drive this Mac cannot see'
```

**Red 5 — the panel says it on every picture:**

```
× a client already saved > says nothing about photographs that are all here
  → expected 'Their own photographsPhotographs they…' not to contain 'on a drive this Mac cannot see'
```

### The two never-copied assertions still fire

**Red 6 — the image graph names a client's pictures:**

```
× a client’s own picture never leaves the machine > is not read by anything that can call the image model
  → expected 'job.ts: true' to be 'job.ts: false' // Object.is equality
```

**Red 7 — the module that owns pictures learns to write a file:**

```
× a client’s own picture never leaves the machine > is not copied anywhere: the module that owns it writes nothing
  → expected 'copyFile: true' to be 'copyFile: false' // Object.is equality
```

**All seven restored, and green again**: `Tests 15 passed (15)` on
`pictures.test.ts`, `Tests 6 passed (6)` on `mode-paths.test.ts`,
`Tests 6 passed (6)` on `photograph-warning.test.ts`,
`Tests 14 passed (14)` on `client-editing.browser.test.ts`.

Every panel assertion reads extracted values — element counts and text — and
never a live Playwright handle.

---

## 6. The rehearsal clone, before and after

`~/Documents/framopia-second-machine-rehearsal/from-github-2/framopia-studio`,
with a **copy** of `k2-syndicalia.json` under a probe id. The real client files
were never touched and the probe was deleted after each run.

**Before — the clone at `728ada0`, session 60's code**, given a photograph kept
inside the project and written on the T7 Shield:

```
  path the clone resolves: /Volumes/T7 Shield/INSEA/Projects/framopia-studio/panel/fixtures/client-photo-small.png
  is it inside the clone?  false
  does the file exist?     true
```

**It reached back into our drive.** The file "exists" only because the T7 Shield
is plugged into this same Mac. On the partner's machine that path is nothing,
and nothing would have said so until a build refused.

**After — the clone at `b764258`**, the same probe plus a second photograph on a
drive that genuinely is not there:

```
  pic001  /Users/mohamedanouarzaki/Documents/framopia-second-machine-rehearsal/from-github-2/framopia-studio/panel/fixtures/client-photo-small.png
       inside this clone: true   exists: true
  pic002  /Volumes/Some Other Drive/clients/k2/clinic.png
       inside this clone: false   exists: false
  panel is told: [{"id":"pic001","onThisMachine":true},{"id":"pic002","onThisMachine":false}]
```

**The first now resolves inside the clone and the bytes are there.** The second
is left exactly where its owner put it — it is not the project's to move — and
the panel is told the truth about it instead of drawing a blank.

---

## 7. Gates, arithmetic and fingerprints

**`npm run check` — PASS, exit 0.** Measured:

| workspace | before | measured | change |
|---|---|---|---|
| core | 777 | **783** | **+6** |
| service | 1374 (+1 skipped) | **1376** (+1 skipped) | **+2** |
| benchmarks | 173 | **173** | none |
| panel | 240 (2 skipped) | **242** (2 skipped) | **+2** |

**+6 in core** — all in the new `core/src/mode-paths.test.ts`:
1. resolves to the right picture where the drive does not exist
2. leaves a photograph that lives outside the project exactly where it is
3. leaves a path stored the old way, on this machine, untouched
4. re-roots the logo by the same rule
5. says nothing about a client with no pictures and no logo
6. is applied by parseMode, which is how every reader loads a client

**+2 in service** — added to `service/src/clients/photograph-warning.test.ts`:
7. says so for one that is, and for one that is not
8. keeps the picture on the client either way

**+2 in panel** — added to `panel/src/client-editing.browser.test.ts`:
9. says a photograph is on a drive this Mac cannot see
10. says nothing about photographs that are all here

6 + 2 + 2 = 10. Nothing removed or renamed. The arithmetic closes exactly.

**Five panel runs, each one:**

| run | result |
|---|---|
| 1 | 242 passed, 2 skipped (244) |
| 2 | 242 passed, 2 skipped (244) |
| 3 | 242 passed, 2 skipped (244) |
| 4 | 242 passed, 2 skipped (244) |
| 5 | 242 passed, 2 skipped (244) |

No test failed on any of the five.

**`npm run golden` — PASS**, 4 of 4 field for field: test-1 4415, test-2 4280,
test-3 3709, vitasilk 4770 — **17,174 fields**, reference unchanged. Resolution
happens at read time and writes nothing, so there is no field to reconcile.

**`modes/`** holds exactly `.gitkeep`, `dr-loubna-kfafi.json` and
`k2-syndicalia.json`, at both ends.

| | at start | at end |
|---|---|---|
| ledger lines | **165** | **165** |
| ledger sha256 | `786497a5f371d179…` | `786497a5f371d179…` |
| `templates/library.aep` | `4b0cf05a8f5d4775…` | `4b0cf05a8f5d4775…` |
| `modes/k2-syndicalia.json` | `c600905c5e36ecbc…` | `c600905c5e36ecbc…` |
| `modes/dr-loubna-kfafi.json` | `f60749f5629b2ced…` | `f60749f5629b2ced…` |
| `.local/quarantine-session51/` | present | present |
| `.local/quarantine-session53/` | present | present |
| After Effects instances | 1 | 1 |
| `aerender` processes | 0 | 0 |

**No build was run this session** — part 3 did not need one, because the check
sits in the catalogue and the panel and both are testable without After Effects.
**No `.aep` was written.** After Effects was driven only by `npm run golden`,
through `DoScript` into the already-running instance.

---

## 8. Money

**No ledger lines added.** 165 lines at both ends, byte-identical by sha256.
Nothing here could bill: a path resolved at read time, a file-existence check,
and a sentence.
