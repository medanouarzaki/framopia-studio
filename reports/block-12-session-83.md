Status: OK

# Block 12, session 83 — the photographs go to GitHub

## 1. All 14, looked at before they left

The repository is public and the push is permanent, so every file was opened and
seen rather than inferred from its name. **All 14 are product images. No person
appears in any of them.** Each is a package, vial, syringe or device on a dark
studio gradient — what Mohamed described is what is there.

| file | id | label | bytes | dimensions | what it is |
|---|---|---|---|---|---|
| pic001.jpeg | pic001 | `ejal40` | 1,736,268 | 2048×2048 | Ejal40 carton and pre-filled syringe |
| pic002.jpeg | pic002 | `gana` | 1,998,903 | 2048×2048 | GANA X carton and amber vial |
| pic003.jpeg | pic003 | `gouri` | 1,798,623 | 2048×2048 | Gouri carton |
| pic004.jpeg | pic004 | `hyalift` | 1,987,272 | 2048×2048 | RRS Hyalift 35 carton and vial |
| pic005.jpeg | pic005 | `lola` | 1,839,301 | 2048×2048 | RRS HA Long Lasting carton and syringe |
| pic006.jpeg | pic006 | `neauvia, stimulate` | 1,705,234 | 2048×2048 | Neauvia SXT Stimulate carton |
| pic007.jpeg | pic007 | `opera` | 1,996,379 | 2048×2048 | K Surgery Opéra carton and syringe |
| pic008.jpeg | pic008 | `planiti` | 1,811,429 | 2048×2048 | PLANITI carton and vial |
| pic009.jpeg | pic009 | `structura` | 1,773,741 | 2048×2048 | Profhilo Structura carton and syringe |
| pic010.jpeg | pic010 | `profhilo` | 1,787,665 | 2048×2048 | Profhilo carton and syringe |
| pic011.jpeg | pic011 | `radiesse` | 1,760,883 | 2048×2048 | Radiesse carton and syringe |
| pic012.jpeg | pic012 | `regenera` | 1,523,889 | 2048×2048 | Rigenera handpiece, a device |
| pic013.jpeg | pic013 | `restylane` | 1,928,092 | 2048×2048 | Restylane Skinboosters Vital Light carton |
| pic014.jpeg | pic014 | `sculptra` | 1,851,718 | 2048×2048 | Sculptra carton and vial |

**Total: 25,499,397 bytes, 25.5 MB**, all JPEG. Every label travels with its
image and is also now public; each is a product or brand name and none names a
person or a patient.

The repository's public status was measured rather than taken on trust: an
unauthenticated call to the GitHub API returns `200`, `private: False`,
`visibility: public`.

## 2. Every guard, test, comment and document reversed

| what | before | now |
|---|---|---|
| `.gitignore` | `assets/client-pictures/` ignored | the entry is gone, and a note in its place records the reversal, its date and the three grounds |
| `scripts/check-no-photographs-staged.mjs` | failed the gate on a staged photograph | deleted |
| `scripts/check.sh` | ran that guard | the line and its comment are gone |
| `CLAUDE.md` standing rule | "A client's own photographs never enter the repository" | "A client's own photographs go to GitHub, and never to a model" — with what does *not* change spelled out |
| `core/src/client-pictures.ts`, rule 3 | "the **private** GitHub repository the only backup a photograph has" | records that the repository is public, that this sentence was wrong on its own terms, and Mohamed's ruling of 2026-09-10 with its grounds |
| `core/src/client-pictures.ts`, rule 1 | "never sent anywhere" | "never sent **to a model or over any network call**" — and says explicitly that the ruling does not relax it |
| `service/src/clients/pictures.test.ts` | `describe('a client's own picture never leaves the machine')` | `describe('a client's own picture is never sent to a model')`, with a comment saying the old title is now false and why the assertions did not need to change |
| `service/src/backup/photographs.test.ts` | premise: private repo is the only backup | records the public repository and that the Google Drive exclusion is untouched |

**Nothing was simply deleted.** Every reversal leaves a note saying what changed,
when, and on what grounds, so a future session finds the decision rather than
silence.

## 3. The rule that does not change, proved still firing

*A client's picture is never sent to a model or over any network call.*
Asserted against the source of the image-generation graph itself, because a
comment cannot hold that property.

Mutation: one file in `service/src/images/` made to mention `clientPictures`.

```
 × a client’s own picture is never sent to a model > is not read by anything that can call the image model
   → expected 'generate.ts: true' to be 'generate.ts: false' // Object.is equality
   Tests  1 failed | 19 passed (20)
```

Restored from a saved byte copy: `Tests  20 passed (20)`.

## 4. The Google Drive exclusion still holds

Session 62's other half stands — he has not ruled on it — and it is now asserted
against the **real** store rather than only a scratch client, because being in
git is exactly the condition under which someone might assume the backup had
picked them up too.

All nine backup groups were surveyed and their file lists read: 205 files, and
**0 photographs**. `withoutExcluded` on the real 14 returns `[]`.

Mutation, with `withoutExcluded` returning its input unfiltered:

```
 × what a backup would copy > is what keeps a photograph out when a group does walk the repository
   → expected [ …(2) ] to deeply equal [ Array(1) ]
 × what a backup would copy > leaves out every photograph really in the store, tracked or not
   → expected [ …(14) ] to deeply equal []
   Tests  2 failed | 3 passed (5)
```

The count rose to 14 — every photograph would have gone to Google Drive.
Restored: `Tests  5 passed (5)`.

## 5. The push, proved by fresh clone

The 14 were added **explicitly by path**, one `git add` per file. No `git add -A`
and no `git add .` was run at any point in this session, whatever the ignore says
— that rule is about a file nobody looked at going up, and it does not depend on
the ignore.

- `git rev-list --count origin/main..main` = **0** after a fetch.
- Cloned fresh into the scratch directory: clone HEAD `5a894af`, matching this
  machine's HEAD; **14 photographs tracked** in the clone.
- **Compared all 14 by sha256: 14 identical, 0 different.**

The scratch clone was deleted afterwards, and its absence confirmed.

## 6. What a fresh machine gets now

Measured in the rehearsal clone at
`~/Documents/framopia-second-machine-rehearsal/from-github-2/`, pulled to this
commit. **Its HEAD is `5a894af`.**

- **14 tracked, 14 present on disk, 25,499,397 bytes** — the same byte count as
  this machine.
- **All 14 resolve to a file that exists there, 0 missing.** The client file
  stores them under this machine's T7 path; session 61's read-time re-rooting
  reads the first as
  `/Users/…/from-github-2/framopia-studio/assets/client-pictures/dr-loubna-kfafi/pic001.jpeg`.

**A reel that used one still could not be rebuilt there, and the pictures are no
longer the reason.** Present in the clone: the client file, `templates/library.aep`,
the six SFX, the watermark, `.local/config.json`. Absent: `.local/plans/` — every
Edit Plan, and `.local/` is gitignored — and the source video, which lives on the
T7 and which `.gitignore` excludes by extension. Those two are what
`npm run backup` carries, and a photograph is deliberately not in that set.

`docs/SECOND_MACHINE.md` now says this, every statement from the measurements
above rather than from expectation.

## 7. Every assertion added and removed

**One test added**, in `service/src/backup/photographs.test.ts`: `leaves out
every photograph really in the store, tracked or not`. Red verbatim in part 4.

**No test was removed.** Session 82's staged-photograph guard was a gate script,
not a suite — session 82 recorded deliberately that it had no unit test, because
it asks git a question about the real index and the honest proof is staging a
file and watching it fail. Deleting the script therefore removes a gate step and
no assertion, which is why the suite count rises rather than falls. The brief
expected a fall; the reconciliation is exact and it is +1, not −n.

One `describe` was **renamed**, not removed — `a client's own picture never
leaves the machine` → `a client's own picture is never sent to a model` — and its
two assertions are untouched, so no count moves.

## 8. Gates, and part 0 at both ends

| gate | result |
|---|---|
| `npm run golden` | **PASS** — 4 of 4, **17,174 fields**, ledger 165 lines `786497a5f371d179` |
| `npm run check` | **exit 0**, run alone, after committing, first time |
| panel suite ×5 | exit **0, 0, 0, 0, 0** — 285 passed + 2 skipped, five times |

| package | session 82 | now | difference |
|---|---|---|---|
| core | 839 / 0 / 839 | 839 / 0 / 839 | — |
| service | 1463 / 0 / 1463 | **1464** / 0 / 1464 | **+1**, the one named above |
| benchmarks | 173 / 0 / 173 | 173 / 0 / 173 | — |
| panel | 285 / 2 / 287 | 285 / 2 / 287 | — |
| tools/cv (pytest) | 149 | 149 | — |

The store guard from session 81 still runs and still reports:
`check: the tests left nothing in assets/client-pictures/; 14 photograph(s) were
there before and still are` — untouched by this session, because it is about the
tests leaving nothing behind and that is as true now as it was.

### Part 0, at both ends

| measurement | start | end |
|---|---|---|
| ledger | 165 lines, `786497a5f371d179` | 165 lines, `786497a5f371d179` |
| `templates/library.aep` | `4b0cf05a8f5d4775` | `4b0cf05a8f5d4775` |
| `modes/dr-loubna-kfafi.json` | `bbda3d30daa1ae3e`, Sep 9 23:22:51 | `bbda3d30daa1ae3e`, Sep 9 23:22:51 |
| `modes/k2-syndicalia.json` | `572e99bf890ceefb`, Sep 9 21:58:19 | `572e99bf890ceefb`, Sep 9 21:58:19 |
| `assets/client-pictures/` | 14 files, 25,499,397 bytes, **0 tracked** | 14 files, 25,499,397 bytes, **14 tracked** |
| services | one: pid 65179, started Sep 9 23:29:30, **is** the handshake pid | identical, untouched |
| extensions folder | one symlink, Aug 27 19:06:47 | one symlink, Aug 27 19:06:47 |
| After Effects | 1 instance, 0 `aerender` | 1 instance, 0 `aerender` |
| working tree | `assets/client-pictures/` untracked | clean |
| `origin/main..main` | 0 | 0 |

`.local/` unchanged at both ends: audio 27 · bench-audio 5 · build 71 · cache 159
· cv 2234 · deleted-clients 0 · doctor 1 · evidence 3 · ground-truth 10 · plans 66
· quarantine-session51 363 · quarantine-session53 139 · quarantine-session54 1 ·
quarantine-session69 3 · quarantine-session71 0 · transcripts 1.

Neither client file was written to; both byte-identical at both ends. **No
photograph was deleted or moved** — the same 14 files, the same 25,499,397 bytes,
at the same paths. No service Mohamed started was stopped.

## 9. Ledger lines added

**None.** 165 lines at the start, 165 at the end, `786497a5f371d179` at every
check — before the work, at both `npm run golden` runs, and at the end. Expected
spend $0.00, actual $0.00.

## What is open

- **The push is permanent and public.** 25.5 MB of product mockups are in a
  public history and deleting them later will not remove them from it. That was
  the ruling; it is recorded here as a fact about the repository from now on.
- **A reel still cannot be rebuilt from a clone alone** — the Edit Plans and the
  source video are outside the repository, and the plans exist on one disk.
- **The too-deep warning only knows footage already made into a reel** — from
  session 80, unchanged.
- A machine that cannot bind loopback starts unguarded, from session 79; the real
  sidecar's abort remains unproven-fixed, from session 78.
