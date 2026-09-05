Status: OK

# Block 11 session 62 — the photograph is kept, and kept out of the backup

**Expected spend $0.00. No paid call of any kind, no picture generated, no
video transcribed. The ledger is unmoved at 165 lines and the same sha256 at
both ends. Golden did not move: 17,174 fields, 4 of 4. `npm run check` passed
whole.**

**Two process failures of mine are reported in §9. Both destroyed or invalidated
work in ways I had to detect rather than being told about, and neither is a
footnote.**

---

## 1. The rule, rewritten before the code that breaks it

`core/src/client-pictures.ts` carried two non-negotiable properties. It now
carries three, and the third is written as an allow-list rather than as the
removal of the second.

1. **Never sent anywhere.** Unchanged, and named the strongest of the three.
   Nothing in `service/src/images/` reads the module and a test asserts the
   image-generation graph never imports it.
2. **Never put in a cache.** Unchanged. `.local/cache/` is for what the tool
   made and can make again; a photograph is neither, and an eviction pass that
   deleted one would be deleting the client's own material.
3. **Copied into this project, into exactly one place inside it.** Mohamed's
   ruling of 2026-09-05, with what he accepted recorded beside it: **the private
   GitHub repository is now the only backup a photograph has.**

`clientPictureStorePath` is the single answer to where a photograph may be
written. It is under `assets/`, which `REPO_ANCHORS` already knows, so session
61's re-rooting carries it to another machine with nothing further to do.

Two owners cannot collide by construction rather than by hoping: the owner is
either a client's id — the mode filename stem, which `createClient` refuses to
duplicate — or a video's `videoDirName`, which carries the video's own sha256
because two of the client's files are both called `sora.mov`.

## 2. All three proved to fire

Each mutation was applied, measured, and reverted **from a saved copy, not with
`git checkout`** — see §9.

| # | the rule broken | what went red |
|---|---|---|
| 1 | the image graph names client pictures | `generate.ts: true` |
| 2 | the module that owns pictures writes a file | `writeFile: true` |
| 3 | a second module copies a photograph | the list gained `service/src/clients/create.ts` |
| 4 | the store writes somewhere of its own | 3 red |
| 5 | the store moves instead of copying | 3 ENOENT |
| 6 | the store overwrites silently | 2 red |
| 7 | the backup exclusion deleted | 1 red — **only after §3 was fixed** |

Neither existing test was weakened. Both still assert what they asserted.

## 3. The backup exclusion was inert, and my test for it was vacuous

RED 7 deleted the exclusion and **nothing went red.** No backup group walks
`assets/` today, so photographs were absent by accident — which is the exact
accident the rule was written to prevent, and my first two tests passed with the
rule deleted.

Fixed by exporting `withoutExcluded()` and testing it with the file list a group
that *did* walk the repository would produce:

```
× what a backup would copy > is what keeps a photograph out
  Tests  1 failed | 29 passed (30)     ← rule deleted
  Tests  30 passed (30)                ← restored
```

Measured on the real backup set: attaching a photograph leaves it at **205
files**, and the photograph is not among them.

## 4. Two tests asserted the behaviour this retires

Rewritten in the same change, per the standing rule — not weakened, not deleted.

- `create.test.ts` required `path` to come back exactly as given. It now checks
  the id numbering as before, and additionally that the stored path is inside
  the store, is not the chosen path, and that **the original still exists**.
- `video-pictures.test.ts` was *named* for the retired rule: *"and the file is
  not copied"*. Now *"and is copied into the project"*, asserting the copy is
  filed under the video's sha256 and that his own file is untouched.

A third comment in `stored-path.test.ts` said a photograph is *"not the repo's
to move"*. Half of that is still true — nothing moves one, and there is no
migration — and the comment now says only that half.

## 5. Test suites were writing into the tracked project store

Creating a client in a test now copies a photograph into `assets/`, and three
suites left 14 files behind in a **tracked** directory. All three now clean up
their copies alongside their mode files. `video-pictures.test.ts` derives the
directory with `videoDirName(videoOf(plan.source))` — the call production uses —
rather than spelling the name out, so a change to how a video is filed cannot
silently orphan copies.

**A full `npm run check` now leaves `assets/client-pictures/` empty.**

## 6. The sentence names no cause

Session 61 said *"This photo is on a drive this Mac cannot see"*. That is true of
an external disk and **false** of `/Users/someone/Desktop/logo.png`, which is
missing because the home folder differs — a cause the panel has no way to tell
apart. It now says:

> This photo is not on this Mac, so it cannot be used yet. Add it again from
> wherever it is now and it will be kept with the client.

The second sentence is a real fix now rather than advice: adding it again copies
the bytes in. The test asserts the wording **and** `expect(text).not.toContain('drive')`.

## 7. The rehearsal clone

Pulled from GitHub at `ddf0922`, running the pushed code, on a scratch client of
its own — neither real client file was opened.

| case | result |
|---|---|
| a photograph from outside the project | kept at `assets/client-pictures/session-sixty-two-rehearsal/pic001.png`, byte for byte, **original untouched** |
| the original is gone | source deleted; the client still resolves and the picture is there |
| attached the old way, inside a repository | `/Volumes/T7 Shield/…/assets/brand/.gitkeep` re-roots onto the clone and is present |
| attached the old way, outside any repository | `/Users/someoneelse/Pictures/…` returned unchanged, not present, so the panel is told `onThisMachine === false` |

**No migration, and none needed.** Both real clients hold 0 pictures and all
seven plans hold 0 `plan.pictures`, measured before any code was written.

## 8. Gates, arithmetic and fingerprints

**`npm run check`: PASS**, exit 0, on a clean run with nothing else touching the
tree. **`npm run golden`: PASS** — 4415 + 4280 + 3709 + 4770 = **17,174**, field
for field.

| suite | brief expects | measured | difference |
|---|---|---|---|
| core | 783 | **785** | +1 the brief is stale, +1 mine |
| service | 1376 (+1 skipped) | **1392** (+1 skipped) | +16, all mine |
| benchmarks | 173 | **173** | — |
| panel | 242 (+2 skipped) | **242** (+2 skipped) | — |

Reconciled by name, not by hope:

- **core +2.** One is the brief's figure being stale: HEAD itself measures 784,
  verified by stashing only my two core source files and re-counting. The other
  is mine — the `assets/client-pictures/…` case added to the re-rooting list.
- **service +16.** `picture-store.test.ts` 7 · `photographs.test.ts` 4 ·
  `pictures.test.ts` 15 → 20. Exactly 16.

**Panel ×5, individually: 242 passed, 2 skipped, five times.** The reworded
sentence's test ran in a real browser rather than being skipped, confirmed by
name.

Fingerprints, both ends identical: ledger `.local/costs.jsonl` 165 lines
`786497a5f371d179…` · `templates/library.aep` `4b0cf05a8f5d4775…` · `modes/` =
`.gitkeep`, `dr-loubna-kfafi.json`, `k2-syndicalia.json` · three quarantines
present · AE 1 instance · aerender 0 · `origin/main..main` = 0 after push.

`handoffs/block-10-opening-prompt.md` → `handoffs/block-10.md` is Mohamed's own
uncommitted rename. It was left out of the commit and is still uncommitted.

## 9. What I did wrong

**I destroyed my own uncommitted work.** Undoing mutation 3 with
`git checkout service/src/clients/create.ts` reverted the whole session's
wiring, because nothing had been committed yet. I did not notice at the time. It
surfaced as mutation 7 failing for the wrong reason, and I nearly recorded that
failure as a proof. Every later mutation saved a copy first and restored from it.

**I invalidated a running gate.** I ran `npm run build --workspace @framopia/core`
while an `npm run check` was in flight, which can change what that run is
testing underneath it. That run was discarded rather than reported, and the
gate was re-run with nothing else touching the tree.

Both are the same error — mutating shared state while something else depends on
it — and both were caught by me rather than reported to me, which is not a
defence.

## 10. Money

**No ledger lines added.** 165 lines at both ends, byte-identical by sha256.
Nothing here could bill: a file copy, a path filter, and a sentence.
