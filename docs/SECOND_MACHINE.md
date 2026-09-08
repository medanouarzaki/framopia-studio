# Setting up Framopia Studio on a second Mac

This walks you through getting the tool working on a Mac that has never run it.
Follow it top to bottom. Paste each command into Terminal and press return.

**It finishes when one command says everything is in place**, so you never have
to judge whether a step worked:

```
npm run doctor
```

Run that whenever you want. It checks 24 things and tells you what is missing
and what to do about it. When it prints nothing under *"cannot run the pipeline
until these are fixed"*, you are done.

---

## What you are receiving

Written from measurement on the first Mac, not from optimism. Read it before
the steps, so nothing below surprises you.

**You do not need the videos.** The five test videos are 11.93 GB and they are
**not part of this setup**. What you need instead is five small files — the Edit
Plans, 297 KB in total, §11 — which are small enough to send in a message.
Everything below was measured on 2026-09-07 on a fresh copy with **no video on
disk at all**.

**What you will have when you finish.** A working panel in After Effects, and
with it: creating a client, correcting any of their details, giving them a
photograph, giving them their brand colours, removing a client, and attaching
pictures to one video. All of it measured on a copy holding no video, no saved
API answers and no cost ledger. The panel's own test suite — 244 checks — passes
in full in that state.

**What you cannot do until you have your own key.** Anything that costs money:
transcribing a video, working out its keywords, and generating pictures. §10 is
where your key goes. **Nothing else in this document is blocked by it.**

**One thing to know about the key.** If you forget to replace the example values
in §10, the tool will not notice at startup — it starts normally and fails at
the first paid call. `npm run doctor` does notice, and says so plainly, which is
why §14 asks you to run it before you begin work.

**What does not build, and is not your fault.** The fifth video, `ground-truth`,
**will refuse to build** if you ever get as far as trying. Its six pictures were
never bought: the image service has been answering with a capacity error
(`503 … currently experiencing high demand`) for three sessions running, so the
pictures do not exist and there is nothing to place. **That is the tool being
careful, not your setup being wrong.** It would rather refuse than hand you a
composition with holes in it. Do not spend anything trying to fix it: buying
those six pictures costs about $2.17 and is a decision for us.

**What is unverified, and what your run is for.** Every fix-it instruction in
this document is a first attempt written from the code — see *Read this first*
below — and three of the doctor's checks have never been seen failing on any
machine. **Your Mac is the first real test of all of it.** A step that behaves
differently from what is written here is the most useful thing you can send
back.

**What you have to measure yourself, and cannot copy over.** Two things are
measurements *of your machine's own copies of the files*, so copying ours would
be recording the wrong thing: the **watermark measurement** and the **loudness
records**. Both are taken automatically the first time a video runs through the
pipeline; there is nothing for you to do beyond letting it happen once.

**What must never travel, in either direction.** The **API key** — yours is
yours, and §10 sets it up — and the **cost ledger**, the running record of money
spent, which each machine keeps from zero. Neither is in the copy you were sent,
and neither should ever be put there.

### Do this first, and send this back

**First:** work through §1 to §11, then run `npm run doctor`. It will report the
source reels missing: that is expected and you can ignore it — nothing else
should be listed. **Do not run `npm run golden`**, and do not copy any video
across; that is the optional section at the very end and only when we ask.

**Send back:** the table in §12, filled in — especially any line where what you
saw differs from what this document says. That is the only thing we need.

---

## Read this first

**None of the fix-it steps below has ever been run on a fresh machine.** They
are written from the code — from what the tool actually looks for — and every
one of them is a first attempt. `npm run doctor` marks each of its own
suggestions *(unverified remedy)* for the same reason. **Your run is what turns
them from a guess into a fact**, so §12 asks you to write down what you
actually saw. If a command does something different from what this says, that is
worth more to us than a clean run.

**Three of the checks have never been seen failing at all** — the ones for the
repository, for Node, and for the installed dependencies. On the machine this
was written on they cannot be made to fail without breaking that machine. **Your
Mac is the first real test of those three.** The repository check has since been
run from two different folders and reported each correctly, which is not the
same as having seen it fail.

**Put the repository wherever you like.** Your home folder, an external drive,
a projects folder — anywhere this account can read and write.

It did have to be at one exact path, and that is worth knowing because you may
see the old rule quoted somewhere: the tool stores full paths inside the files
it writes, 52 of them across the five video plans, and every one was written on
another Mac. **They are re-rooted when they are read**, onto whatever copy of
the repository is running, so a path written on the other machine resolves to
the matching file on yours. Proven by running the whole set of videos from a
second copy at a different path — every measured figure came out identical.

Whatever path you choose, **use it everywhere below**. This document writes
`<repo>` for it, and every command that starts with `cd` means *the folder you
cloned into*.

---

## 1. The repository

Choose a folder and clone into it:

```
git clone <the repository URL> framopia-studio
cd framopia-studio
pwd
```

**You should see:** the full path of the folder you just made. Write it down —
that is `<repo>` for the rest of this document.

If someone has already put the folder on a drive for you, plug the drive in and
`cd` into it instead.

**How big it is**, measured by cloning it from GitHub on 2026-09-05: about
**22 MB** to download, **53 MB** on disk once checked out. It grows to about
**262 MB** after §4 and §6. The videos and the caches are deliberately not in it
— the Edit Plans come in §11 and the saved answers in §12. (An earlier version
of this document said 254 KB.
That was the size of the tracked text alone and it was wrong.)

---

## 2. Homebrew

Homebrew installs the other tools. Check whether you have it:

```
brew --version
```

**You should see:** something like `Homebrew 4.x.x`

If instead it says `command not found`, install it:

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

That prints instructions at the end about adding it to your path. Follow them,
then close Terminal, open it again, and run `brew --version` to confirm.

---

## 3. Node

Node is what the tool runs on. The version matters — the project pins one.

```
cat .nvmrc
```

**You should see:** `24`

Install Node with nvm, which lets you have several versions:

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

Close Terminal, open it again, then:

```
cd "<repo>"
nvm install
node --version
```

**You should see:** `v24.something`

---

## 4. The project's dependencies

```
cd "<repo>"
npm install
```

**You should see:** a few lines about packages, possibly followed by a block of
`npm audit` warnings. **The warnings are expected and are not your problem** —
they are about packages the project only uses while it is being developed.

Measured on the rehearsal, cloning from GitHub on 2026-09-05:

```
added 219 packages, and audited 224 packages in 3s
```

**165 entries in `node_modules`, 168 MB.**

---

## 5. ffmpeg

ffmpeg reads the video and pulls the audio out of it.

```
brew install ffmpeg
ffmpeg -version
```

**You should see:** a first line like `ffmpeg version 8.0.1`

One thing to know: **After Effects cannot see your Terminal's settings.** If
ffmpeg ends up somewhere unusual, the tool will not find it even though Terminal
does. `npm run doctor` checks for exactly this and, if it happens, tells you to
put the full path into a settings file. It will give you the path.

---

## 6. The picture tools

These find you in the frame so a generated picture is never placed over your
face, and they cut backgrounds out of pictures.

```
cd "<repo>"
tools/cv/setup.sh
```

**You should see:** it creating a Python environment and downloading two model
files. **One of them is about 930 MB, so this needs a decent connection and a
few minutes.**

Check they arrived and are the right files:

```
tools/cv/verify-models.sh
```

**You should see:** both models reported as ok.

**Rehearsed on 2026-09-05 from a fresh clone and it worked as written**, with no
step missing: the script made the environment, fetched both models and finished
with `sidecar: ready`, and `verify-models.sh` then reported
`birefnet-general ok` and `selfie-multiclass-256x256 ok`. This is the longest
step — most of the 930 MB is one file.

---

## 7. The fonts

Three typefaces have to be installed on the Mac, not just in the project:

- **Inter Semi-Bold** — ordinary subtitle words
- **Almarai Bold** — Arabic words
- **Cormorant Garamond SemiBold Italic** — emphasised words

Install all three the normal way, by double-clicking the font files and pressing
*Install Font*. Then **quit After Effects and open it again** — it only reads
the font list when it starts.

These are ordinary font files. None of them comes from Creative Cloud or Adobe
Fonts, so there is nothing to subscribe to and nothing to sync — double-clicking
is genuinely all it takes. That was measured on the first Mac rather than
assumed.

**Why this matters more than it looks:** if a typeface is missing, After Effects
does not complain. It quietly substitutes a different one, and the finished
composition looks built and is set in the wrong type. `npm run doctor` checks
the three by name, and that check is the only thing standing between a missing
font and a comp nobody notices is wrong.

**Expect the name in Font Book to look wrong. It is not.** After Effects and
macOS disagree about what two of these three faces are called — the system says
`Inter-Regular_SemiBold` and `CormorantGaramond-SemiBoldItalic`, and After
Effects says `Inter-SemiBold` and `CormorantGaramondItalic-SemiBoldItalic`. Both
are describing the same file. The names the tool uses are After Effects' names,
and they were measured inside After Effects on the first Mac; the names your
system shows are not the same thing and do not need to match.

**So if a build ever refuses because of a font name, do not try to fix it by
renaming or reinstalling anything.** It is possible that your After Effects
builds those names slightly differently from the first Mac's, and if so that is
something for us to change in the tool, not for you to work around. `npm run
doctor` prints both lists when it disagrees — the name it wanted and the names
your After Effects offered for the same family. **Send that, and stop there.**

---

## 8. Let After Effects write files

**This is the one most likely to catch you out, because it is switched off on
every fresh install of After Effects.**

In After Effects:

> **Preferences → Scripting & Expressions → Allow Scripts to Write Files and
> Access Network** — turn it on.

**Why:** the tool builds your composition by sending instructions to After
Effects and then reading back a small file that says what happened. With this
switched off, After Effects does the work and cannot report it, and the build
appears to fail for no reason.

`npm run doctor` can now tell this apart from After Effects simply not being
open. If it says *"ran a script to completion but no result file appeared"*, this
setting is the cause.

---

## 9. The panel

The panel is the window inside After Effects that you actually use.

```
cd "<repo>"
npm run panel:install
npm run panel:build
```

**You should see:** `panel:install` reporting what it set, and `panel:build`
finishing with a file size.

`panel:install` does two things: it links the panel into the folder After
Effects reads, and it switches on the setting that lets After Effects load a
panel that is not signed by Adobe. Without that second part the panel is
installed and simply refuses to appear.

**Then quit After Effects and open it again**, because it only reads that folder
when it starts. The panel is under **Window → Extensions → Framopia Studio**.

### If something goes wrong, in the order to check it

Two things go wrong here more than anything else. Both have a first thing to
check and a second thing to run, in that order.

#### The panel does not appear in After Effects

Window → Extensions is empty, or Framopia Studio is not in the list.

**First, check what the install actually did.** Run it again — it is safe to run
as often as you like, and it says what it finds before it changes anything:

```
cd "<repo>"
npm run panel:install
```

**You should see** three lines telling you where the extensions folder is, what
it points at, and what it would point at. If the second and third are the same,
the link is right and the problem is elsewhere — go to the next check.

**If it says `REFUSED — this folder already points somewhere else`**, another
copy of this project is installed and After Effects is loading that one. It will
name both. If the one you want is this folder, run:

```
npm run panel:install -- --repoint
```

**Second, check After Effects has read the folder.** It only reads it when it
starts, so if the link was made while After Effects was open, it has not seen it
yet. Quit After Effects and open it again.

**If it is still not there**, run `npm run doctor` and send us what it says about
*the panel* and *PlayerDebugMode*. Those two are what make an unsigned panel
appear at all.

#### The panel says it is showing older code

You may see: *"This panel is showing older code than the rest of the tool, so
what you see here may not match what it does. Nothing you have made is
affected."*

**This is normal right after `git pull`** and nothing is broken. The panel is a
file that gets built, and pulling new code does not rebuild it.

```
cd "<repo>"
npm run panel:build
```

Then close the panel and open it again — Window → Extensions → Framopia Studio.
The line should be gone.

**If instead it mentions the background service**, the panel is already fixing
that by itself; give it a few seconds. If the line is still there after that,
send us what it says rather than trying anything else.

---

## 10. Your API keys

The tool talks to two paid services. **You need your own keys — never copy
anyone else's, and they are not in the repository or in any backup.**

Make the settings file:

```
cd "<repo>"
mkdir -p .local
cp config.example.json .local/config.json
open -e .local/config.json
```

That opens it in TextEdit. Replace the two placeholder values with your own
keys, and set `machineLabel` to something that identifies this Mac. Save and
close.

> **Do not skip the editing, and do not trust the check here.**
>
> Measured on 2026-09-05: if you copy the example across and run `npm run
> doctor` **without editing it**, the doctor reports
>
> ```
>   ok    the API keys, by presence
>         googleApiKey present (value not shown), elevenLabsApiKey present (value not shown)
> ```
>
> It is looking for keys *being there*, not for them being real — the file it
> found contains `AIzaYourGoogleKey` and `sk_your_elevenlabs_key`. So a green
> line here does not mean your keys work. You find that out at the first paid
> call, which fails as not authorised.
>
> The example also ships `machineLabel` set to `mohameds-macbook`. Change it, or
> your machine's reports will be filed under his name.

The file is `.local/config.json` and it never leaves the machine: it is excluded
from the repository, and `npm run backup` refuses to copy it into cloud storage.

---

## 11. The Edit Plans — 297 KB, and this is all you need

Copy these five files into `<repo>/my files/test videos/`:

| file | size |
|---|---|
| `ground truth.editplan.json` | 59 KB |
| `test 1.editplan.json` | 64 KB |
| `test 2.editplan.json` | 50 KB |
| `test 3.editplan.json` | 39 KB |
| `vitasilk.editplan.json` | 85 KB |
| **total** | **297 KB** |

They are small enough to send in a message. Put them here:

```
mkdir -p "<repo>/my files/test videos"
```

Then copy the five files into that folder, and check they arrived:

```
ls -la "<repo>/my files/test videos/"
```

**You should see:** five files ending `.editplan.json`, and nothing else.

**The videos themselves are not needed for any of this**, and are not part of
this setup. Together they are 11.93 GB, and the only thing that wants them is
the optional last section at the end of this document. Skip them for now.

**Why these five matter.** An Edit Plan is everything the tool worked out about
a video — every word, every timing, every picture and where it goes. The test
suites read them, and without them a great deal is not exercised: measured on
2026-09-07 on a fresh copy, the panel's own test suite runs 122 tests without
them and **244 with them**, because one test file cannot even start without
`vitasilk.editplan.json`.

---

## 12. The saved work, so nothing costs money twice

Everything the tool has already paid for is saved so it never has to be bought
again. **Copy these three folders across from the first machine**, into the same
places *inside the repository* — the repository itself can be anywhere:

| what | where | size |
|---|---|---|
| the saved answers from the paid services | `.local/cache/` | 53 MB |
| the cut-out pictures | `my files/test videos/cutouts/` | 53 MB |
| the five video plans | `my files/test videos/*.editplan.json` | 308 KB |

**Do not copy these:**

- **`.local/config.json`** — that is the first machine's keys. Yours are §10.
- **`.local/costs.jsonl`** — the running record of money spent. It only ever has
  lines added, and this Mac keeps its own from zero.
- **`.local/build/watermark.json`** and **`.local/build/loudness/`** — these are
  measurements *of this machine's copies of the files*, and have to be taken
  here. §13.
- **any of the client's own photographs** — a client's own picture is never sent
  anywhere and never copied into a cache. Two automatic checks enforce that.

---

## 13. The two measurements only this Mac can make

You do not have to do anything for these. The tool takes them itself the first
time you run a video through, and it takes a few seconds:

- the watermark's exact size, length and transparency
- how loud the speaking is in each reel, so the sound effects sit under it
  properly rather than on top of it

They are missing on a new machine and that is expected, not a fault.
`npm run doctor` says so where it reports them.

---

## 14. Check everything

```
cd "<repo>"
npm run doctor
```

**You should see:** a list of 24 lines, then a summary. Anything marked `MISS`
comes with the command that fixes it. Anything marked `????` means the check
could not tell either way — usually because After Effects is not open — and it
says which.

Open After Effects first and run it again, because five of the checks need it.

**If you run this before §4, it tells you so.** `npm run doctor` checks a couple
of things on plain Node before it needs anything installed, so running it on a
clone you have just made says:

```
This project is not set up yet, so nothing else will run.

  The project's packages have not been installed yet.
  Run this, from this folder:

      npm install

Then try again. docs/SECOND_MACHINE.md has the whole setup in order.
```

**What a fresh clone actually reports**, measured on 2026-09-05 by cloning from
GitHub and following §1 to §10 with After Effects open: **18 present, 6 absent,
0 could not be determined**. Every one of the six is expected at this point:

| what it says is missing | why, and what fixes it |
|---|---|
| the API keys | you copied the example in §10 and have not put your own keys in yet |
| the panel bundle | §9's `npm run panel:build` has not run yet |
| the watermark measurement | §13 — taken on the first video you run |
| the dialogue loudness records | §13 — the same |
| the API cache | §12 — copy it, or let it fill as stages run |
| the cost ledger | it is written by the first billable call; a new Mac starts its own at zero |

Only one thing is listed under *"this machine cannot run the pipeline until these
are fixed"* on a fresh clone, and it is the API keys.

Run it as many times as you like. **When it stops printing "this machine cannot
run the pipeline until these are fixed", the setup is done.**

**The doctor will say the source reels are missing.** That is correct and
expected: you do not have them and you do not need them. It is the one blocker
you can ignore, and the only thing it stops is the optional section at the very
end of this document.

To confirm the code itself is healthy:

```
npm run check
```

**You should see:** a lot of test output ending in `check: PASS`.

### A green run that skipped things is still a green run

Just above `check: PASS` there is a short list of anything the check **could not
look at on your Mac**. It looks like this:

```
check: 2 thing(s) could not be checked on this Mac.
       This is not a failure. It is what was not looked at:

  - the checks that run a whole video through, end to end
      because the test videos, ffmpeg or the picture tools are not all here
      Expected on a Mac set up without the test videos. Nothing is wrong.
```

**That list is normal and the run is still good.** It is there so a green run
that looked at everything and a green run that skipped half of it do not look
identical.

**On a Mac set up by this document, expect to see one of them:**

| what it says | why | anything to do |
|---|---|---|
| *the checks that run a whole video through, end to end* | you have the Edit Plans but not the videos, which is exactly what §11 asks for | **no** — this is the normal state |

**These three should not appear, and are worth telling us about if they do:**

| what it says | what it means |
|---|---|
| *the checks that pull the sound out of a video* | **ffmpeg is missing.** Framopia cannot transcribe anything without it, so this one matters. §5 installs it. |
| *the checks that look at the real pictures* | the picture tools did not install. §6 sets them up. |
| *the checks that open a real browser window* | `npm install` did not finish fetching the test browser. Running §4 again usually settles it. |

**And one is harmless whenever it appears:**

| what it says | why |
|---|---|
| *the check for a file kept only in the cloud* | it needs a Google Drive file that has not been downloaded to your Mac, to look at. Most Macs do not have one sitting there. Nothing is wrong. |

**Measured on 2026-09-08**, by making each thing genuinely absent and watching
the check name that one and no other. Nothing was uninstalled to find out.

---

## Optional, and only when we ask: does your Mac build the same thing ours does

**You do not need this to work.** Everything above gives you a working panel and
everything a day's work needs. This section is the one thing that needs the
videos, and it exists to answer a single question: *does your Mac build
byte-for-byte what ours builds?* Until someone asks you that question, skip it.

**What it costs to be able to run it.** Four of the five videos, **9.51 GB**:

| video | size | needed here |
|---|---|---|
| `test 1.mov` | 2.29 GB | yes |
| `test 2.mov` | 2.31 GB | yes |
| `test 3.mov` | 2.24 GB | yes |
| `vitasilk.mov` | 2.68 GB | yes |
| `ground truth.mov` | 2.42 GB | **no — never needed** |

`ground truth.mov` is not in the set this checks and nothing else asks for it,
so there is no reason to copy it at all. The four go in the same folder as the
Edit Plans, `<repo>/my files/test videos/`, and `benchmarks/footage.json` records
the exact size and fingerprint of each.

Once they are there, check they are the right copies — a slightly different cut
of a video looks identical and behaves completely differently:

```
npm run doctor -- --hash-footage
```

That takes about twenty seconds.

Then:

Once `npm run doctor` has stopped printing blockers, this is the step that
answers the question the whole exercise is for.

```
cd "<repo>"
npm run golden
```

**It costs nothing.** It builds four of the videos — `test-1`, `test-2`,
`test-3` and `vitasilk` — exactly as the tool normally would, then measures
about **17,000 details** of what came out: every word on every card, the
typeface and size each was set in, which words had to be made smaller to fit,
where every picture sits and how big it is, which picture file each one used,
how loud every sound is, and how many layers each composition ended up with.
Then it compares all of that against a recording made on the first Mac.

It takes about half a minute. **After Effects has to be open.**

**You should see:** four lines reading `ok`, then

```
golden: 4 of 4 reels matched, field for field
golden: PASS
```

### If it does not say PASS

**Send us the output and stop there.** Do not change anything, do not rebuild,
do not reinstall. A difference is exactly the thing this was built to find, and
it is a finding rather than a fault — it is far more useful to us than a clean
run.

The output names every detail that differed, what we recorded and what your Mac
produced, so it tells us what happened without any guesswork. The three likeliest
explanations, none of which is anything you did wrong:

- **A different version of After Effects.** Ours is 26.0x67, and the run prints
  both versions side by side. A newer one may lay text out very slightly
  differently.
- **A typeface that resolved differently.** See §7 — After Effects makes up its
  own name for some fonts, and yours may make up a slightly different one.
- **Saved work that did not copy across completely.** If a picture file from §12
  is missing, the tool will place a different one, and this will say which.

**`ground-truth`, the fifth video, is deliberately not in this check.** Its
pictures were never bought, so it cannot be built at all — see *What you are
receiving* at the top. Four videos is a stronger test than one, and adding the
fifth would only add a failure we already know about.

---

## What is not in the repository, and where each thing comes from

Measured on 2026-09-05 by cloning this repository from GitHub into a folder that
had never held it and listing what was missing. Git carries the code, the documents, the
**template library**, the **client files**, the **sound effects**, the
**watermark video** and the **brand logo** — all of that arrives with the clone
and none of it needs fetching. What does not:

| what | how big | where you get it |
|---|---|---|
| **the five video plans** — `my files/test videos/*.editplan.json` | **297 KB** | Mohamed. **§11 — this is the one you need.** |
| **the four source videos** — `my files/test videos/*.mov` | 9.51 GB | Mohamed, on a drive. **Only for the optional last section**, and `ground truth.mov` (2.42 GB) is never needed at all. |
| **your API keys** — `.local/config.json` | tiny | **Accounts of your own**, at Google and ElevenLabs. Never copy anyone else's. §10. |
| **the saved answers** — `.local/cache/` | 53 MB | Mohamed. Without it every stage is bought again. §12. |
| **the cut-out pictures** — `my files/test videos/cutouts/` | 53 MB | Mohamed. §12. |
| **the installed packages** — `node_modules/` | 168 MB | `npm install`, §4. |
| **the picture tools and their two models** — `tools/cv/.venv/`, `~/.rembg/` | ~1 GB | `tools/cv/setup.sh`, §6. Downloads them itself. |
| **the panel bundle** — `panel/dist/panel.js` | 237 KB | `npm run panel:build`, §9. |
| **the three typefaces** | small | Font files, installed on the Mac itself. §7. |
| **the watermark measurement and the loudness records** | tiny | **Nothing to fetch** — this Mac measures its own copies. §13. |
| **the cost ledger** — `.local/costs.jsonl` | tiny | **Nothing to fetch** — yours starts at zero. |
| **any client photograph** | — | **Never copied.** A client's own picture stays where they put it and is never sent anywhere. |

## The steps nobody can do for you

Everything else in this document is a command. These are not:

| step | why it needs you |
|---|---|
| **§2, Homebrew** | Its installer asks for your Mac password. |
| **§7, the three fonts** | Font files are installed by double-clicking, and After Effects has to be restarted afterwards to notice. |
| **§8, the scripting preference** | It is a checkbox inside After Effects' Preferences, off on every fresh install. Nothing outside the application may set it. |
| **§9, restarting After Effects** | It reads the extensions folder only when it starts. |
| **§10, the API keys** | They come from accounts in your name, and the doctor cannot tell a real key from the placeholder. |
| **§11, the five Edit Plans** | 297 KB that only Mohamed has. Small enough to send in a message. |
| **§12, the saved answers** | About 106 MB that only Mohamed has, and only saves money. |
| **the optional last section** | The four videos, 9.51 GB, and After Effects open — only a person can open it. Skip until asked. |

## How much of this has been rehearsed, and how much has not

Rehearsed twice on 2026-09-05, the second time **by cloning this repository from
GitHub** into a folder that had never held it and following this document from
the top. Everything below is what happened, not what was expected to happen.

**Run, and worked as written:**

| step | what was measured |
|---|---|
| §1 the clone | 22 MB downloaded, 53 MB checked out |
| §3 Node | `.nvmrc` says `24`, `node --version` says `v24.14.1` |
| §4 `npm install` | `added 219 packages, and audited 224 packages in 3s` — 165 entries, 168 MB |
| §6 the picture tools | built the environment, fetched both models, ended `sidecar: ready`; `verify-models.sh` then reported both `ok` |
| §10 the settings file | copied, and the doctor then **correctly refused it** until the keys were replaced |
| §14 `npm run doctor` | 18 present, 6 absent, 0 could not be determined |

**Not run, and why:** §2 Homebrew and §5 ffmpeg were already installed on the
rehearsal Mac, so a fresh install of either is still unrehearsed. §7 the fonts
and §8 the scripting preference were already set. §9 `npm run panel:install`
was **deliberately not run**, because it rewrites the one folder After Effects
reads and would have pointed the working panel at the rehearsal copy.

### Rehearsed again on 2026-09-07, this time without any video

The document was rewritten around a measurement, and then followed again on the
same clone with **no video on disk at all**.

| step | what was measured |
|---|---|
| §9 `npm run panel:build` | built in 97 ms, 232 KB |
| §11 the five Edit Plans | 297 KB copied in; nothing else |
| §14 `npm run doctor` | 18 present, 6 absent — the two blockers being the API keys, which are still the example's, and the source reels, which are correctly reported missing |
| the panel's own test suite | **242 passed, 2 skipped, 244 in total, exit 0** |
| creating, correcting, photographing and removing a client | all worked, on a copy with no video, no saved answers and no ledger |

**Where it stopped, and what would have come next.** At §14. The next step is
§10 — putting a real API key in — which cannot be rehearsed, because the only
key available is Mohamed's and it must never be copied into a second checkout.
Everything after that point needs money to exercise.

### What the recovery steps above have and have not been run against

**Run, on 2026-09-07:**

| step | how it was exercised |
|---|---|
| `npm run panel:install`, first time | against a temporary folder standing in for the extensions folder — it made the link and reported all three lines |
| `npm run panel:install`, run twice | reported *already points at* and changed nothing |
| the `REFUSED` message | a link pointed at another checkout: it refused, exited non-zero, and left the link exactly as it was |
| `npm run panel:install -- --repoint` | repointed, and said it was because `--repoint` was given |
| `npm run panel:build` | run on a fresh clone, 97 ms |
| the *older code* message | proved against a genuinely stale build stamp |

**Not run, and why.** None of the install steps has ever been run against **the
real extensions folder**, on any machine. There is one of it per Mac, and
running it here would have taken the panel away from the copy Mohamed uses —
which is the whole reason the step went unexercised for eleven sessions. So
**the first time it touches a real extensions folder will be on your Mac.** The
guard above exists exactly for that: if anything is already installed, it stops
and tells you rather than replacing it.

For the same reason, nobody has watched the panel appear in After Effects from a
fresh install, or watched the *older code* line appear on screen — only the rule
behind it has been tested. If either behaves differently from what is written
here, that is the most useful thing you can send back.

**One thing worth knowing that the rehearsal found.** If you pull new code, run
`npm run panel:build` again before anything else. The panel bundle records which
build of the service it was made from, and a bundle made before a code change
will make the panel say the service is a different build. Rebuilding takes under
a second and fixes it.

**So the steps most likely still to surprise you are §2, §5, §7, §8, §9's
`panel:install` and §10** — they are the ones written from the code rather than
from watching them happen.

---

## What happened on your machine

Please fill this in as you go. What you actually saw matters more than a tick.

| step | worked | what you actually saw |
|---|---|---|
| 1. drive and repository | | |
| 2. Homebrew | | |
| 3. Node | | |
| 4. dependencies (`npm install`) | | |
| 5. ffmpeg | | |
| 6. picture tools and models | | |
| 7. the three fonts | | |
| 8. After Effects scripting setting | | |
| 9. panel install and build | | |
| 10. API keys | | |
| 11. the videos | | |
| 12. the saved work | | |
| 14. `npm run doctor` | | |
| 14. `npm run check` | | |

**Anything that went wrong, in your own words:**

**Anything this document said that turned out to be untrue:**

**How long the whole thing took:**


## What you can and cannot do without a terminal

Recorded 2026-08-31, after the panel learned to start and repair the background
service itself.

### The whole of making a video needs no terminal

Open After Effects, open the panel, and everything below is a control on screen:
choosing a client, setting a new client up (their colours, fonts, logo, subtitle
height and their own photographs), adding or forgetting a photograph on a client
who already exists, choosing a video, running the pipeline, editing the words,
changing which words are emphasised, choosing between the generated pictures,
turning the watermark on or off and picking its size, and building the
composition. **The background service starts itself when the panel opens**, and if
it is ever out of step with the panel it prepares and restarts itself, saying so
afterwards.

**Their own photographs are on the client screen since 2026-08-31**, which was the
last gap in ordinary use. Choose the photo, say what it is, and it is offered for
every picture in every video of theirs. Forgetting one leaves the file where it is.

Two measurements that used to be terminal commands — the watermark's timing and
the loudness of the speech — are taken by the pipeline as it runs, so they are not
in the list below.

### What still needs someone at a terminal

**Setting the machine up, once.** None of this is part of using the product; it is
part of installing it, and `docs/MACHINE_REQUIREMENTS.md` lists all of it. In
short: install Node, ffmpeg, the three fonts and After Effects; run `npm install`;
run `tools/cv/setup.sh` for the picture tools; run `npm run panel:install` once so
After Effects can see the panel. After that, opening the panel is enough.

**Checking a machine is set up right** — `npm run doctor`. It reports what is
missing and never repairs anything.

**Backing up what cannot be regenerated** — `npm run backup`. Transcriptions, the
hand-written ground truth, the alignment references, the generated pictures and the
cost ledger.

**Re-measuring the templates after editing `templates/library.aep`** —
`npm run audit:templates`, then `npm run golden` to confirm nothing moved. Only
whoever edits the templates needs this.

**Everything else in `package.json` is a developer's tool**: the benchmarks, the
diagnostics, the one-shot migrations and the report generators. None of them is
needed to make a video, and none of them should be run by someone who has not read
what it does.
