Status: OK

# Block 13, session 93 — the partner's first setup, walked once by hand

**Nothing this session ran was capable of billing, and the ledger still moved: 16
lines, $2.198982, all of them Mohamed's own work on a video this session never
touched, while the session was in progress.** Section 8 accounts for every one.

## 1. Every step walked again, and where it stops

The rehearsal clone was **39 commits behind** — `5a894af`, session 83-era. Pulled
to `cf152bb` and every step run as written. In that time the setup document had
moved by **16 lines** while the tool moved by 39 commits, which is most of why
the figures below had drifted.

| step | what it does now | verdict |
|---|---|---|
| §1 the clone | 65 MB of files, 49 MB of `.git`, **1.1 GB once §4 and §6 are done** | **wrong** — said 53 MB checked out, 262 MB after |
| §2 Homebrew | `Homebrew 6.0.22` | stale — said `4.x.x` |
| §3 Node | `.nvmrc` says `24`; `node --version` says `v24.14.1` | **correct** |
| §4 `npm install` | 165 entries, 168 MB | **correct, exactly** |
| §5 ffmpeg | `ffmpeg version 8.0.1` | **correct** |
| §6 the picture tools | `birefnet-general ok`, `selfie-multiclass-256x256 ok`; the venv is **822 MB** | **correct**, but see §1 |
| §7 the fonts | not exercisable — installed system-wide already | not run |
| §8 the scripting preference | not exercisable — a checkbox inside After Effects | not run |
| §9 `npm run panel:install` | **deliberately not run** | not run |
| §10 the keys | the doctor now **names the placeholders** | **better than described** |
| §11 the Edit Plans | **308 KB**, five files | said 297 KB |
| §14 `npm run doctor` | **17 present, 7 absent, 0 undetermined, of 24**; **three** blockers | **wrong** — said 18/6 and one blocker |
| §14 `npm run check` | **98 tests failed** | **wrong** — promised `check: PASS` |

### Where it stops

**It no longer stops at §10.** Every rehearsal before this one stopped there,
because the step needs a key and the only key available is Mohamed's. It still
cannot be *completed* — the placeholders stay in — but the walk now continues
past it, because §11 to §14 need no key.

**It stops at §14, on `npm run check`.** The document says *"You should see: a lot
of test output ending in `check: PASS`."* What a machine without the corpus
actually gets is **98 failures**: 2 in `core`, 93 in `service`, 3 in `panel`, the
run stopping at the first failing workspace.

**The next step would have been the skip report** — the section titled *"A green
run that skipped things is still a green run"*, which describes a tidy list of
what could not be looked at. That list is printed at the *end* of a run and **a
failing run never reaches it**: the rehearsal printed no skip report at all.

### Why those 98 fail, measured rather than guessed

Every one needs something only the first Mac has — the 11.93 GB of test video, a
cost ledger with real spending, or `.local/ground-truth`:

```
   × the money view > reads the real ledger and reconciles to the cent
     → ENOENT: no such file or directory, open '.../.local/costs.jsonl'
   × the hand-made reference declaration > every declared reference is on this disk
     → expected [ …(4) ] to deeply equal []
   × which reels are his > lists only reels that were really paid for
     → expected 4 to be greater than or equal to 6
```

**The skip mechanism exists and was never applied to them.** `describe.runIf` is
used by exactly two suites in the whole service — the sidecar integration test
and one image-dimensions test. `money.test.ts`, `pipeline.test.ts` and
`steps.test.ts` have **zero** guards between them.

The gate says as much about itself, in the passing run on this Mac:

> `check: counted with 5/5 corpus Edit Plans and 5/5 reels (11.93 GB) on this
> disk — the suite sizes depend on both, so this signature belongs to this
> machine, not to the commit`

**I did not fix this, and I am saying so rather than leaving it implied.** It is
around twenty test files, each needing a decision between standing aside and
carrying a fixture, and doing that hastily at the end of a session is how a gate
stops meaning anything. It is the single largest thing standing between the
partner and a setup that reports honestly, and it is a block of work, not a
afternoon. The document now tells him plainly not to run it and to go by
`npm run doctor` instead.

## 2. The shared-account facts, measured

**Spending is shared.** One Google credit, one ElevenLabs subscription. What he
generates comes out of the same balance Mohamed's does, and nothing in the tool
tells either of them.

**Each machine's cost screen shows only that machine's spending — measured, not
assumed:**

- `COSTS_PATH` is `LOCAL_DIR/costs.jsonl`, beside the checkout it belongs to;
- `.local/` is ignored at **line 1** of `.gitignore` — `git check-ignore -v`
  confirms it;
- the file has been committed **0 times** in the project's entire history;
- the rehearsal clone's doctor reports it absent, with *"a fresh machine starts
  its own"*.

So the two records are genuinely separate and neither is wrong — each is a true
account of one Mac. **What neither is, is the total.** The only place the real
remaining balance exists is the provider's own account page. The document now
says this, in §10a, with the practical consequence: quote your own figure, and
the two of you add them up by talking.

**A key is a password to a billing account.** §10 used to say *"You need your own
keys — never copy anyone else's"*, which is now factually wrong: they share the
accounts. Rewritten to say he gets it from the account page himself, signed in,
and types it into `.local/config.json` — **never asked for or accepted in a
message**, because a key that has been in a chat lives in that chat's backups on
both phones forever.

## 3. What a clone gives him, and what Mohamed must hand him

**The clone — 65 MB, 929 files, nothing else to do:**

| what | size |
|---|---|
| **the 15 product pictures**, `assets/client-pictures/` | **26.2 MB** |
| the rest of `assets/` — brand, sound effects, watermark video | 26 MB |
| the code — `service/`, `panel/`, `core/`, `tools/` | 5.4 MB |
| session reports and handoffs | 4.5 MB |
| the benchmark harness and its results | 1.4 MB |
| the **template library** and its manifest | 0.6 MB |
| the documents | 0.5 MB |
| the **client files**, `modes/` | 40 KB |

The document said *fourteen* pictures at 25.5 MB; a fifteenth was added on
2026-09-11. It also said *"any client photograph — never copied"*, which has been
untrue since 2026-09-10 and is now corrected.

**What Mohamed must hand him, and why git does not carry it:**

| what | size | why not in git |
|---|---|---|
| the five Edit Plans | **308 KB** | gitignored with the footage they describe |
| the five source videos | **11.93 GB** | far too large, never committed — optional section only |
| the API key | tiny | it is a password; §10 |
| the saved answers, `.local/cache/` | **271 MB** | machine-local, gitignored |
| the cut-out pictures | **51 MB** | derived, and free to re-derive |

## 4. What he can do once set up, and what he cannot

**He can make a whole video from the panel** — open one of his own recordings,
transcribe it, read and fix the words, generate the pictures, build the
composition — **for any client, including one he adds himself**. What he cannot
do is reproduce the four reference reels or run `npm run golden`, which need the
11.93 GB he was not given; and he cannot see anything Mohamed has spent.

## 5. The three things most likely to stop him

**1. He runs out of disk.** `npm run doctor` will say:

```
  MISS  free disk space, at least 19 GB
        17.4 GB free on the volume holding the repo
```

and list it as a blocker. The rehearsal Mac failed this. The 19 GB is not for the
setup — the setup is 1.1 GB — it is what running whole videos needs. **Check it
before starting, not at §14.**

**2. His first `npm run check` fails, 98 tests deep**, naming ledgers and videos
he does not have. The document promised `check: PASS`. Nothing is wrong with his
setup; the gate belongs to this machine.

**3. The panel shows the wrong build after his first `git pull`**, and he will
see exactly this:

> This panel is showing older code than the rest of the tool, so what you see
> here may not match what it does. Nothing you have made is affected. To put it
> right, run `npm run panel:build` in a terminal, then close this panel and open
> it again from Window → Extensions.

It will happen every time he pulls. Doing what it says fixes it. This is the one
message in the tool allowed to name a command — Mohamed's ruling of 2026-09-07 —
because the panel cannot rebuild the file it is running from.

## 6. Every step marked as not exercised, and why

| step | why not |
|---|---|
| §2 Homebrew, §5 ffmpeg | already installed; a genuinely fresh install of either is still unrehearsed |
| §7 the three fonts | installed system-wide; passing here says nothing about a Mac without them |
| §8 the scripting preference | already on, and a checkbox nothing outside After Effects may set |
| §9 `npm run panel:install` | **forbidden this session** — it rewrites the one folder After Effects reads and would have repointed Mohamed's working panel at the rehearsal copy |
| §10, actually using a key | **deliberately not done** — the only key available is Mohamed's and it must never enter a second checkout. Every paid step below is therefore unverified |
| §12, §13 | need a key and a real run |
| the optional last section | needs the 11.93 GB the rehearsal Mac does not hold in that folder |

**And a caution the document now carries.** Six of the doctor's 24 checks — After
Effects running, the scripting preference, the fonts, the extensions folder, the
panel bundle, PlayerDebugMode — read the **machine**, not the checkout. They
passed on the rehearsal because Mohamed's After Effects and Mohamed's installed
panel are on this Mac. **On a Mac that has never had this tool they would not**,
and nothing here has tested that. A rehearsal on the first Mac cannot prove the
second Mac's hardest steps.

## 7. Gates

`npm run check`, run alone, after committing: **exit 0, `check: PASS`.**

It **failed once before that, and passed on the immediate re-run.** The failing
run was concurrent with Mohamed's own pipeline work (section 8) — the sidecar and
the image stage competing for the same machine. I did not capture its failures,
having redirected the output, so I can say only that it failed and then passed
cleanly; I am not claiming to know which tests, because I did not look.

| suite | passed | skipped | total |
|---|---|---|---|
| core | 846 | 0 | 846 |
| service | 1548 | 0 | 1548 |
| benchmarks | 173 | 0 | 173 |
| panel | 288 | 2 | 290 |
| pytest (CV sidecar) | 149 | 0 | 149 |

Measured from the passing run, not carried. The gate also reported `38 skip
conditions across 14 test files` and `nothing was skipped for want of anything on
this Mac`.

**Arithmetic by name: 0 tests added, 0 removed.** This session changed one file,
`docs/SECOND_MACHINE.md`, and no test file. `git diff HEAD~1 -- '*.test.ts'` is
empty, and the four suite totals are unchanged from session 92's measurement.

`npm run golden`: **PASS, 4 of 4 reels matched, field for field.** 4415 + 4280 +
3709 + 4770 = **17,174**.

**Panel suite, five times: exit 0, 0, 0, 0, 0.**

### Part 0, at both ends

| measurement | at start | at end |
|---|---|---|
| ledger records | 242 | **258** |
| ledger sha256 | `533ad6b2…33a00522` | **`2feaa404…5ead040d`** |
| `templates/library.aep` | `4b0cf05a…eca6c22aba` | unchanged |
| `modes/dr-loubna-kfafi.json` | `97ece86d…`, 2026-09-11T01:19:45 | unchanged |
| `modes/k2-syndicalia.json` | `572e99bf…`, 2026-09-09T21:58:19 | unchanged |
| `.local/` directories | 16 | 16 |
| `assets/client-pictures/` | 15 files, 26M | 15 files, 26M |
| CEP extensions | `com.framopia.studio` | `com.framopia.studio` |
| After Effects | 1 (pid 39825) | 1 (pid 39825), never launched or quit |
| `aerender` | 0 | 0 |
| listening service | pid **40282** | pid **27950** |
| `origin/main..main` after fetch | 0 | 0 after push |

**The service changed underneath the session.** pid 40282 is gone and pid 27950
holds the port. **Nothing here stopped it** — no command in this session touches a
service — and the change is consistent with Mohamed restarting his own panel
during his run. It is reported because the rule is to report it, not because
anything acted on it.

The rehearsal clone also moved, by design: `5a894af` → `cf152bb`, and
`npm install` was run inside it. Nothing was written to Mohamed's own checkout
except `docs/SECOND_MACHINE.md`.

## 8. Every ledger line added

**16 lines, $2.198982 — and none of it is this session's.**

Every one carries `"purpose":"client-work"` and the same video,
`491f5c7fe22286a2bd3e81972782091da8e6cc6a393ba7e313af5ce336a93dc4`, which this
session never opened, planned, built or named. They run 18:58:38 to 19:11:31 and
are one complete pipeline: transcription, the correction pass, keywords, slots,
then nine images.

| time | stage | usd |
|---|---|---|
| 18:58:38 | transcribe-scribe | 0.001652 |
| 18:58:38 | transcribe-gemini-correction | 0.119592 |
| 19:00:07 | analysis-keywords | 0.153992 |
| 19:01:04 | analysis-slots | 0.097630 |
| 19:05:06 – 19:11:31 | images-generate ×12 | 1.826116 |

**Why none of it can be mine.** This session ran, in total: `git pull`,
`npm install`, `npm run doctor` and `npm run check` inside the rehearsal clone —
whose config holds only the example's placeholders, so a paid call there fails
unauthorised and never reaches `appendCost`, and which writes to its own ledger
in any case — plus `npm run check` and `npm run golden` on this checkout, neither
of which bills. No transcription, analysis or image command was issued.

The shape of it — a whole reel, on a client, through a running service, ending in
nine generated pictures — is Mohamed working in his panel while the session ran.
It is the same fact section 2 is about: **his spending and the partner's will
land in two different files, and only one of them is ever the whole story.**

**One thing I could not account for.** Successive reads of the file returned 254,
255, 257 and 258 lines at points well after 19:11:31, its newest timestamp. All
258 lines are unique and in timestamp order, and the 16 added are the 16 above. I
am recording the discrepancy rather than explaining it away.

## What is open

- **`npm run check` cannot pass on a machine without the corpus** — 98 failures,
  around 20 test files, no guards. The largest thing between the partner and an
  honest setup, and a block of work rather than a session.
- **The hardest steps remain unrehearsed** — §7 fonts, §8 the scripting
  preference, §9 `panel:install` — and cannot be rehearsed on a Mac that already
  has them. Only the partner's own machine will exercise them.
- **§10 is still unverified end to end**, because verifying it means a real key
  and the only one available is Mohamed's.
- **No installer yet, deliberately.** The path is now walked and written down;
  wrapping it is the next question, not this one.
