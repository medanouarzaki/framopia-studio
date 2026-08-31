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
it writes, 52 of them across the five videos, and every one was written on
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

The download is small — about 254 KB — because the videos and the caches are
deliberately not in it. They come in §10 and §11.

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

**You should see:** a few lines ending in something like `added 400 packages`.
It takes a minute or two. About 164 MB.

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

---

## 7. The fonts

Three typefaces have to be installed on the Mac, not just in the project:

- **Inter Semi-Bold** — ordinary subtitle words
- **Almarai Bold** — Arabic words
- **Cormorant Garamond SemiBold Italic** — emphasised words

Install all three the normal way, by double-clicking the font files and pressing
*Install Font*. Then **quit After Effects and open it again** — it only reads
the font list when it starts.

**Why this matters more than it looks:** if a typeface is missing, After Effects
does not complain. It quietly substitutes a different one, and the finished
composition looks built and is set in the wrong type. `npm run doctor` checks
the three by name, and that check is the only thing standing between a missing
font and a comp nobody notices is wrong.

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

The file is `.local/config.json` and it never leaves the machine: it is excluded
from the repository, and `npm run backup` refuses to copy it into cloud storage.

---

## 11. The videos

The five test reels are the agency's own footage. They are not in the repository
— together they are about **11.9 GB**.

Copy all five `.mov` files into:

```
<repo>/my files/test videos/
```

`benchmarks/footage.json` lists them, with the exact size and fingerprint of
each, and a note saying where they come from. `npm run doctor -- --hash-footage`
checks each file against its fingerprint — worth doing once, because a slightly
different copy of a video looks identical and behaves completely differently.

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

Run it as many times as you like. **When it stops printing "this machine cannot
run the pipeline until these are fixed", the setup is done.**

To also check the videos are byte-for-byte the right ones:

```
npm run doctor -- --hash-footage
```

That takes about twenty seconds.

And to confirm the code itself is healthy:

```
npm run check
```

**You should see:** a lot of test output ending in `check: PASS`.

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
