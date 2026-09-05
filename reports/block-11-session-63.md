Status: OK

# Block 11 session 63 — the unproven mutations, redone

**Expected spend $0.00. No paid call of any kind, no picture generated, no video
transcribed. The ledger is unmoved at 165 lines and the same sha256 at both
ends. Golden did not move: 17,174 fields, 4 of 4. `npm run check` passed whole.**

**Three of session 62's seven mutation results do not reproduce.** All three are
the ones it ran on the crippled tree. **Session 62's account of the core test
count is also wrong**, and session 61 — which it blamed — was right. Both are
below.

---

## 1. The mutation method

Every file was copied byte-for-byte into a scratchpad directory before being
mutated, and restored with `cp` from that copy. **Nothing in this session used
`git checkout`, `git restore` or `git stash` to undo a mutation**, because
neither the index nor HEAD holds uncommitted work — which is exactly how session
62 destroyed its own.

After every restore the copy was compared with `diff` and the suite re-run to
green **before the next mutation began**. Every restore in this session was
verified byte-identical and green first; none began on an unverified tree.

**One hazard the method does not cover, found the hard way.** Mutation 5 makes
the store *move* rather than copy, and the thing it moved was real files:
`panel/fixtures/client-photo-small.png`, `client-photo-large.png`, and
`service/src/clients/create.test.ts` — that suite passes its own source file as
a stand-in photograph. Saving the bytes of the file you mutate does not protect
the files the mutation destroys *at runtime*. All three were tracked with no
uncommitted changes, so HEAD was authoritative and restoring from it lost
nothing, and green was re-verified before continuing. A mutation that can delete
is worth reading twice before running.

## 2. Mutations 3, 4, 5 and 6 redone, and 1, 2 and 7 confirmed

| # | session 62 recorded | measured now | match |
|---|---|---|---|
| 1 | `generate.ts: true` | `generate.ts: true` | **yes** |
| 2 | `writeFile: true` | `writeFile: true` | **yes** |
| 3 | list gained `create.ts` | list gained `create.ts` | **yes** |
| 4 | 3 red | **6 red** | **no** |
| 5 | 3 ENOENT | **9 red, 4 ENOENT** | **no** |
| 6 | 2 red | **1 red** | **no** |
| 7 | 1 red | 1 red | **yes** |

**The three that differ are exactly the three the brief suspected**, and the
cause is consistent: without the `create.ts` wiring, `createClient` and
`addPicture` never called the store, so every test that reaches it through the
real route stayed green and could not fail. Session 62's reds were smaller than
the truth, not larger — it under-proved rather than over-claimed.

Mutations 1, 2 and 7 were re-run here and reproduce verbatim, so they are
confirmed on an intact tree by measurement rather than by argument from ordering.

**Mutation 3** — a second module copies a photograph:

```
 FAIL  src/clients/pictures.test.ts > is copied by exactly one module in the whole service
AssertionError: expected [ …(2) ] to deeply equal [ Array(1) ]
  Array [
+   "service/src/clients/create.ts",
    "service/src/clients/picture-store.ts",
  ]
```

**Mutation 4** — the store builds its own destination. **6 red, not 3:**

```
   × a client's own picture is copied to one place and no other > takes its destination from the one declaration
   × a client's own photographs, given at setup > numbers them the way adding one to a saved client does
   × keeping a photograph > copies it in and leaves the original exactly where it was
   × attaching a photograph to a client > stores the copy inside the project, not the path he chose
   × what a backup would copy > leaves a client's photograph out, even though it is now in the project
   × what a backup would copy > is what keeps a photograph out when a group does walk the repository
      Tests  6 failed | 110 passed | 1 skipped (117)
```

**Mutation 5** — the store moves instead of copying. **9 red, 4 of them ENOENT,
not 3:**

```
   × keeping a photograph > copies it in and leaves the original exactly where it was
     → ENOENT: no such file or directory, open '…/framopia-elsewhere-wzdYFT/logo.png'
   × keeping a photograph > reuses an identical copy rather than writing again
     → ENOENT: no such file or directory, open '…/framopia-elsewhere-p8i8js/same.png'
   × keeping a photograph > cannot put two owners' pictures in the same file
     → ENOENT: no such file or directory, open '…/framopia-elsewhere-L7sDSh/shared.png'
   × attaching a photograph to a client > stores the copy inside the project, not the path he chose
     → ENOENT: no such file or directory, open '…/framopia-elsewhere-h3UIMm/desktop-logo.png'
      Tests  9 failed | 107 passed | 1 skipped (117)
```

**Mutation 6** — the store overwrites silently. **1 red, not 2:**

```
 FAIL  src/clients/picture-store.test.ts > never overwrites a different picture that already has the name
AssertionError: expected '/var/folders/41/…' not to be '/var/folders/41/…' // Object.is equality
 ❯ src/clients/picture-store.test.ts:85:24
     85|     expect(second).not.toBe(first);
```

**A correction to my own work.** My first attempt at mutation 1 did not fire, and
the test was right to stay green: the guard looks for the strings
`clientPictures`, `chosenClientPictureId` and `client-pictures`, and I had
imported a symbol containing none of them. The mutation was fixed, not the test.

## 3. The 784th core test does not exist, and session 61 was right

**Session 61 did not undercount.** Its final commit `a383d6c` measures core at
exactly **783**, as reported. There is no commit that added a 784th test.

`core/src/messages.test.ts` builds its cases by scanning `panel/src`, `core/src`
and `service/src` **on disk** for `npm run <script>` mentions, one generated test
per distinct script named. Its count therefore follows the working tree,
**including uncommitted and untracked files**.

Session 62's stash experiment stashed only `core/src/client-pictures.ts` and
`core/src/index.ts`, leaving its own modified `service/src/backup/set.ts` in
place. Both had newly introduced the phrase `npm run backup`, which appears
**nowhere** in those three trees at `a383d6c` (`git grep` finds zero). One
mention survived the partial stash, the generated case survived with it, and
session 62 read that as "HEAD itself measures 784".

So session 62's report §8 — *"HEAD itself measures 784, verified by stashing only
my two core source files"* — is wrong, and its attribution of the difference to
a stale brief is wrong. The brief said 783 because 783 was correct.

The true arithmetic is 783 → 785, **+2, both session 62's own**:

| test | how it arrived |
|---|---|
| `resolveStoredPath re-roots assets/client-pictures/dr-loubna-kfafi/pic001.png…` | added deliberately |
| `every command named in a message exists > npm run backup is a real script` | **generated**, because session 62's comments were the first source text anywhere to say `npm run backup` |

Session 62 accounted for the first and not the second. Measured with a detached
worktree at each commit; nothing was changed.

## 4. The gate now refuses test leavings

`scripts/check-store-empty.mjs`, wired into `scripts/check.sh` **after** the
suites, because it is their leavings it is looking for. Proved red then green:

```
check: FAIL — assets/client-pictures/ is not empty after the tests.
1 file(s) are test leavings in a tracked directory, and a
client's photograph must never be committed by accident. The suite that
made them has to remove its copies the way it removes its mode files.
Nothing here is deleted for you: look at them, then move them aside.

  assets/client-pictures/dr-loubna-kfafi/pic001.png
```

It names the directory, says the files are test leavings, moves nothing, and
says nothing about the panel. Removing the file returns it to exit 0.

## 5. Deleting a client takes its photographs with it

They move to `.local/deleted-clients/<id>-<stamp>/`, sharing the stem of the
client's own `.json`, so which photographs belonged to whom stays obvious.
**Moved, never deleted.** Only the copies this project made are moved: a
photograph attached before session 62 lives outside the store, where its owner
put it, and is not ours to touch.

**What makes a collision impossible.** Not the timestamp — a client can be
deleted, made again with the same id and deleted again, and two deletions inside
one millisecond would land on the same name, losing the earlier client's
photographs. `freeStem` claims the `.json` **and** the folder together and probes
for a free stem, so the pair always belongs to itself.

Five tests, each proved to fire:

| mutation | red |
|---|---|
| the photographs are left behind | 4 red |
| deleted instead of moved | 3 red |
| the collision guard removed | 1 red |

```
 FAIL  … > keeps them apart even when the clock does not move
Error: ENOTEMPTY: directory not empty, rename
  '…/assets/client-pictures/deleted-photos-same-instant'
  -> '…/.local/deleted-clients/deleted-photos-same-instant-2026-09-06T10-00-00-000Z'
```

**That mutation also showed the plain "deleted twice" test passes with the guard
removed**, because two deletions milliseconds apart get different stamps anyway.
Both tests were kept and the report says which one carries the weight: the one
with the clock held still.

`delete-is-safe` still holds — a reel built before and after a client is removed
is the same string, field for field.

The panel's wording is unchanged. *"Nothing was thrown away — their details were
kept"* stays true and now covers more; changing it would be a second behaviour
change.

## 6. Gates, arithmetic and fingerprints

**`npm run check`: PASS**, exit 0, run with nothing else touching the tree. **No
workspace was built while a gate was in flight.** **`npm run golden`: PASS** —
4415 + 4280 + 3709 + 4770 = **17,174**, field for field, reference unchanged.

| suite | expected | measured | difference |
|---|---|---|---|
| core | 785 | **785** | — |
| service | 1392 (+1 skipped) | **1397** (+1 skipped) | **+5** |
| benchmarks | 173 | **173** | — |
| panel | 242 (+2 skipped) | **242** (+2 skipped) | — |

**+5 in service**, all in the new `service/src/clients/deleted-photographs.test.ts`:

1. takes them with it, beside the client's own file
2. deletes nothing: the bytes are still there, unchanged
3. leaves a client with no photographs exactly as it was
4. cannot collide with an earlier deletion of the same id
5. keeps them apart even when the clock does not move

Nothing removed or renamed. The arithmetic closes exactly. **Core did not move**:
`scripts/` is not one of the three directories `messages.test.ts` scans, so the
new script generates no case — the mechanism from §3, checked rather than assumed.

**Five panel runs, each one:** 242 passed, 2 skipped (244) — five times, no test
failing on any.

| | at start | at end |
|---|---|---|
| ledger lines | **165** | **165** |
| ledger sha256 | `786497a5f371d179…` | `786497a5f371d179…` |
| `templates/library.aep` | `4b0cf05a8f5d4775…` | `4b0cf05a8f5d4775…` |
| `modes/k2-syndicalia.json` | `c600905c5e36ecbc…` | `c600905c5e36ecbc…` |
| `modes/dr-loubna-kfafi.json` | `f60749f5629b2ced…` | `f60749f5629b2ced…` |
| `modes/` | `.gitkeep`, both clients | unchanged |
| `assets/client-pictures/` | empty | **empty** |
| quarantines 51/53/54 | present | present |
| After Effects instances | 1 | 1 |
| `aerender` processes | 0 | 0 |

After Effects was driven only by `npm run golden`, through `DoScript` into the
already-running instance. No `.aep` was written and Mohamed's own project was
never saved.

`handoffs/block-10-opening-prompt.md` → `handoffs/block-10.md` is Mohamed's own
uncommitted rename, left exactly as it was.

## 7. Money

**No ledger lines added.** 165 lines at both ends, byte-identical by sha256.
Nothing here could bill: mutations of local source, a directory listing, and a
file move.
