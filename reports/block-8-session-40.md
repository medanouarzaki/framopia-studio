Status: OK

Session 40. HEAD at the time of writing `6a0a860`; this report's own commit
follows. Ledger **108 lines**, sha
`50ec3f57bacb3f32054ae190d3a7652dea5e55c68d71a494fa85b2347a417593` at both ends.
**$0.00 — no API call, no pipeline run, no build, and After Effects was not
contacted.** One After Effects instance and zero `aerender` at session start;
unchanged at the end. Working tree clean at start.

**The backup ran. 94 files, 53.3 MB, every hash verified, every file confirmed
present on this machine. One file was deliberately left out and it is named
below.**

## Done

### Goal 1 — secrets never go to the cloud

**Classification is by bytes, not by name.** `.local/config.json` is not special
because of what it is called — it is special because there is a Gemini key
inside it, and deciding by filename would also miss the next file someone drops
a key into. A file is secret when its first 64 KB, read only if they are valid
UTF-8, contain either:

- a field whose name **ends** with `apiKey`, `api_key`, `token`, `secret`,
  `password` or `credential`, **and** whose value is 16 or more unbroken
  characters of a credential alphabet; or
- a value in a shape a provider publishes — `AIza…`, `sk_…` hex, `sk-…`, or a
  `-----BEGIN … PRIVATE KEY-----` block.

**Both halves are needed, and the first draft proved it.** Matching any field
whose name merely *contained* `token` flagged
`benchmarks/references/align/vitasilk.json`, which carries `draftTokenText` —
**the most irreplaceable file in the whole set would have been left out of the
cloud copy.** Requiring the name to end with the word and the value to look like
a credential fixes it: `draftTokenText: "دقائق."` is not one.

**Measured against the real set: exactly one file is secret**, `.local/config.json`,
and a test asserts that list rather than describing it. Binary files are not
scanned, so a key hidden past the first 64 KB of one would be missed — stated
rather than glossed.

**A cloud destination refuses to receive it and says so on screen**, naming the
file and what was matched (never the value). A local destination still takes
everything, as before.

**How it knows a destination is cloud, and the limit.** It is a path heuristic,
and the honest reason is that nothing better exists: **`df` reports
`~/Library/CloudStorage/GoogleDrive-…` as `/dev/disk3s1`, the machine's own data
volume**, exactly as it reports an ordinary folder, because a macOS FileProvider
is not a mount. So no filesystem fact separates the two before writing.

| destination | verdict |
|---|---|
| `~/Library/CloudStorage`, `~/Library/Mobile Documents`, `~/Dropbox`, `~/Google Drive`, `~/OneDrive` | **cloud** |
| under `/Volumes` | **local** (a network share here would be misread) |
| anything else | **unknown — it refuses and asks for `--cloud` or `--local`** |

Guessing "local" once copies an API key into a shared folder, so there is no
default. `/tmp/x` and `~/Desktop` both refuse, asserted by test.

**What the user must keep safe himself: `.local/config.json`, which holds his
ElevenLabs and Gemini keys.** It is the one thing not in the Drive copy.

### Goal 2 — a cloud copy that is actually a copy

**The mount is streaming, and that was measured rather than inferred.** An
existing Drive file that has never been downloaded:

```
size=6298543  blocks=0   flags=1073741920   compressed,dataless
```

`0x40000000` is macOS's `SF_DATALESS`. A 2 MB file written into the same folder
came back with **3912 blocks and no flag** — 3912 × 512 = 2,002,944 bytes, which
is the file. So block count discriminates on this mount, Node exposes it as
`stats.blocks`, and no shelling out is needed. The probe was written into a
directory of my own and removed; nothing of his was touched.

`isMaterialised` is that check, and **the run fails if any copied file's bytes
are not on this machine.** A test asserts it against a real cloud-only file
found on this account — not a stub — and skips on a machine with no Drive.

**Two things it cannot tell you, both stated in the output and in `CLAUDE.md`:**

1. **Whether the bytes will stay.** Drive evicts local copies to reclaim space.
   This verifies the file is here now.
2. **Whether Google has finished uploading.** That is asynchronous and there is
   no reliable filesystem signal for it. To confirm, the user should watch the
   Drive icon in the menu bar settle, or open drive.google.com and look for
   `framopia-studio`.

**The writable folder is found, not assumed.** Drive's account root is
`dr-x------`; the tool looks inside it for a writable directory, uses it when
there is exactly one, names the candidates when there is more than one, and
fails with a plain sentence when there is none. On this account it found
`My Drive` — the name is never hardcoded, because it is different on an account
in another language.

**Speed:** 53.3 MB in **0.2 s of copying**, inside a **1.7 s** run including the
survey and every hash. It is not slower than a local disk, because Drive
accepts the write locally and uploads afterwards.

### Goal 3 — it ran

```
/Users/mohamedanouarzaki/Library/CloudStorage/GoogleDrive-zakimohammedanouar@gmail.com/My Drive/framopia-studio/
```

| | |
|---|---|
| files copied | **94** |
| bytes | **53.3 MB**, about 240 MB/s |
| time | 0.2 s copying, 1.7 s total |
| hash mismatches | **0** — every file re-read from Drive and matched |
| not present locally | **0** — every file's bytes confirmed on this machine |
| skipped | **1** — `.local/config.json`, a credential-shaped value in a field named like a credential |
| deleted at the destination | **0** |

**Verified independently of the tool's own report**, by walking the destination
afterwards: 94 files, `.local` 70 (cache 61, ground-truth 8, ledger 1),
`benchmarks` 3, `my files` 21; **no `config.json` anywhere in it**; **zero files
carrying the `dataless` flag**.

`backupDir` in `.local/config.json` is now the Drive account root, so **`npm run
backup` with no arguments repeats it** — confirmed by running it: it found
`My Drive` inside the read-only root, treated it as cloud, copied 0 and found
all 94 already there and identical.

## Deviations

**I committed goal 1 on a red check and had to amend it.** The check's exit
status was printed but the commit ran in the same chained command, so `&&`
carried it through — three unused imports from splitting the two goals apart. It
was found immediately, fixed, and the commit amended onto a green check, so
nothing red is in the history. It is still the constraint being broken rather
than followed: the exit status has to be read *before* the commit is written,
not beside it.

**Goals 1 and 2 both touch `backup-cli.ts`**, which cannot be split across two
commits by file. They were written and committed in sequence — the cloud-copy
verification was held aside, goal 1 committed, then goal 2 restored and
committed — so each commit is coherent on its own and each was checked.

## Failures & open problems

**None from this session.** `npm run check` passes.

Two limits carried forward rather than solved, both above and both in
`CLAUDE.md`: Drive may evict the local bytes later, and the upload itself cannot
be confirmed from the filesystem.

Unchanged and still open: frame analysis is reported rather than driven, so
Block 8's definition of done is not met; `dialogueLufs` reaches a plan only
through a migration; the image prompt is Block 9; `IMPACT_THRESHOLD` is
unresolved and the 17 SFX events remain 8 frames late.

## Repo state

HEAD `6a0a860`, working tree clean. Three commits this session:

- `5dcd179 feat: keep credentials out of a cloud backup`
- `9f5b4a3 feat: verify a cloud copy is really on this machine`
- `6a0a860 docs: record the cloud backup rules and the run of record`
- (this report's commit follows)

`npm run check` **passes**, counts measured per workspace: core **466**, service
**1051**, benchmarks **166**, panel **167 passed / 2 skipped** — **1850
TypeScript tests** — plus **149 pytest**, the mode validator, the panel manifest
parse, the template validator and both model checksums.

`.local/config.json` gained `backupDir` and nothing else; it is gitignored.
Nothing was staged with `git add -A`. No cache entry, reference, plan, mask or
image was touched. `git log` carries no AI attribution.

## Suggested next step

**Nothing to run. Two things to know and one to do.**

**In your Drive now**, under `My Drive/framopia-studio/`: the transcription cache
entries, which are the only copy of the transcript both hand-made references
describe; the four ground-truth transcripts you wrote by ear, which until today
existed only on the T7; the cost ledger; your Edit Plans with your choices on
them; the alignment references; and the 20 generated images with their cutouts.
94 files, 53 MB.

**Not in your Drive, on purpose:** `.local/config.json`, which holds your
ElevenLabs and Gemini keys. A shared cloud folder is a different risk from a
dead disk, and a key can be reissued while the transcripts cannot. **Put a copy
of that one file wherever you keep passwords** — it is 187 bytes.

**Not included either:** the 11.9 GB of source video. Add `--with-video` if you
want it there too, but check your Drive quota first.

**To do:** watch the Drive icon in the menu bar until it stops syncing, or open
drive.google.com and confirm `framopia-studio` is there. The tool proved the
files are on this machine and byte-for-byte correct; whether Google has finished
receiving them is the one thing it cannot see.

**To run it again**, any time, from anywhere in the repo:

```
npm run backup
```

It copies only what has changed, re-reads and hashes everything it finds, and
deletes nothing.
