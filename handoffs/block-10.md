# Block 10 — handoff

You are picking up **Framopia Studio** at the end of Block 10. This conversation follows
`docs/HANDOFF_PROTOCOL.md`: you produce self-contained Claude Code prompts, I run them and
paste back the session reports, you verify each report against the plan — question
discrepancies, never rubber-stamp — and issue the next prompt.

---

## 1. How I want to work with you

Explain everything in **simple language**. I am a motion designer, not an engineer.

- Put every Claude Code prompt in **one copyable markdown block, whole, never in parts**.
- Give me **terminal commands for everything**, including opening files. I don't open
  anything by hand.
- Anything Claude Code can do itself, it does. It drives After Effects through AppleScript
  `DoScript` into my already-running instance.
- Only bring me in when it genuinely needs **my hands or my eye**.
- **Technical decisions are yours.** Choose, tell me what you chose and why, and I can
  overrule you.
- **Taste decisions are mine**, and I answer them by looking at something on screen. Put
  things in front of me rather than describing them.
- If there is a decision to take, **take what you recommend** rather than asking me.
- **Ask me one thing at a time.** If I answer "yes" to a question with two options, ask
  again with numbers.

---

## 2. The two rules that matter most

These came out of Block 10 the hard way and they govern everything.

### Everything you solve is solved for all videos and all clients

**Never fit a fix to the reel or the client in front of you.**

Nine defects in one night shared one cause: something fitted to the five corpus reels that a
new video never got, or got wrongly. The corpus accumulated its state over months of
sessions; a new video gets only what the pipeline actually produces.

**A value that can only be justified by pointing at an existing reel must not be chosen.**
Say so and stop. Session 38 refused to invent an opening-quality threshold on exactly these
grounds, and it was right — no cut on the available signal separated the picture I rejected
from the two I accepted.

### Run the product, don't read it

Session 20's audit read the code, found real things, and **passed while a real client video
could not get through the door**. Session 43's audit ran eight videos that had never existed
and found the watermark switch that did nothing, four dead settings, and a palette that was
collected and never sent.

**A test that has only been seen passing has not been tested.** Prove every assertion fires
by breaking the rule and watching it go red, then restoring. Sessions 41, 44, 47, 51 and 53
each caught their own tests passing vacuously by doing this.

---

## 3. What the tool does now

A video goes from a file on my disk to a finished After Effects composition, **entirely from
the panel, with no terminal**. The panel starts its own background service and repairs
itself when its code and the service's disagree.

My own 13-second client reel built correctly on 4 September:
**27 subtitle cards, 2 keywords, 4 pictures, 4 sounds, 1 watermark** — every card inside the
video's length, every picture clear of the speaker at every frame, no gaps between pictures,
each starting on the word that names it, all in that client's own brand colours with no
trace of the other client's.

**Both gates green:** `npm run check` exits 0, `npm run golden` passes 4 of 4 reels at
**17,174 fields**.

---

## 4. Everything I ruled during Block 10

### Subtitles and type

- **A card too wide breaks onto two lines at full size.** Only a card with nothing to break
  — a single word — shrinks. I overruled an earlier one-line-only rule after seeing a
  keyword come out at 56% of its neighbours.
- **A card must fit its comp in both directions.** The height check did not exist at all
  until session 21; a two-line Arabic keyword was being cut by 96.7 px.
- **The shadow behind every word takes the client's own deeper colour**, not the template's.
  It matched K2 by coincidence of the brand for months.
- **Card comps are 1300 px tall with the first baseline at 700.** I edited
  `templates/library.aep` myself three times to get there.
- **Arabic sets at 1.07× the Latin size.** The emphasis ratio is 1.1641 from cap height.

### Pictures

- **Each picture is drawn as large as its own corner allows**, not one shared size for the
  reel. The old rule took the reel's minimum, so a longer reel was a smaller-pictured reel
  by construction.
- **A picture holds until the next one arrives.** No gaps. **Cut, not dissolve.**
- **A picture starts on the word that names what it shows**, not at the start of its
  sentence. The model is now asked which word its picture is about.
- **A picture must be clear of the speaker at every frame of its life**, not just when it
  appears.
- **Framing is close, medium or macro. Never wide.**
- **A client's own picture is used instead of a generated one** when a word spoken is in
  that picture's label. **Strict — the word must be the word.** Anything less generates.

### Everything else

- **The watermark is always at the top, never the bottom.** It was landing at the bottom in
  93 of 200 seeded draws until session 24.
- **Orthography is Arabic-first**: Arabic in Arabic letters, French and English left as they
  are. One rule, no judgement about whether a French word is technical enough.
- **A client has three faces**: a Latin sans, a Latin serif for emphasis, and an Arabic.
- **A client mode is a snapshot, not a pointer.** A reel built at a version rebuilds at that
  version forever; moving one forward is a control someone presses.
- **Nothing renders.** The deliverable is the saved `.aep` and the panel saying where it is.

---

## 5. Where things stand

### Clients

| | |
|---|---|
| **k2-syndicalia** | Noir Abyssal `#1A0000` · Blanc Cassé `#F8F6F2` · Or Signature `#C9A96E` · Rouge K2 `#820000` |
| **dr-loubna-kfafi** | `#1C1210` ground · `#FFF4E8` words · `#E8873A` emphasis · `#123448` shadow |

Both use **Inter-SemiBold**, **CormorantGaramondItalic-SemiBoldItalic** and **Almarai-Bold**.
**Dr Loubna Kfafi's three faces are borrowed from K2 and marked pending my choice** — I have
not decided hers yet.

### Reels

`ground-truth`, `test-1`, `test-2`, `test-3`, `vitasilk` are the corpus. Two client reels
exist: `sora-995f2d27` (40.5 s) and `sora-6a60ced1` (13.5 s, the one I actually delivered
from). **Both source files are called `sora.mov`** — that collision cost three sessions and
$1.01 and is now closed.

### Money

- All-time API spend **$18.832129**, ledger at **165 lines**.
- About **$8.63** of Google credit.
- Including the ElevenLabs subscription and top-ups, roughly **$23.40 + $20** paid in.
- **A reel costs about $0.09 per second of footage**, almost all of it pictures. 13 seconds
  ≈ $1.23. 40 seconds ≈ $3.82.
- **65% of everything spent went into building the tool**, not using it.

### Fingerprints to assert

```
ledger                        165 lines / 786497a5f371d179…
templates/library.aep         4b0cf05a8f5d4775c03e8ebd86f713f0e7eb985d80e46f3874cb28eca6c22aba
modes/k2-syndicalia.json      c600905c5e36ecbc…
modes/dr-loubna-kfafi.json    f60749f5629b2ced…
golden reference              74436a960706fecd  ·  17,174 fields, 4 reels
npm run check                 core 777 · service 1333 · benchmarks 173 · panel 220 (2 skipped)
```

`.local/quarantine-session51/` and `.local/quarantine-session53/` hold things moved aside,
never deleted. Leave them.

---

## 6. What is open, in the order that matters

1. **The panel work of session 54** — a label field beside each picture, adding and removing
   pictures, editing and deleting a client, pictures attached to one video, and replacing
   "Run pipeline" with two plainly named buttons: one that makes the subtitles, one that
   makes the pictures. **Session 53 built the whole matching engine and nothing in the panel
   can write a label**, so the feature is unreachable. If session 54 did not complete, this
   is the first thing.
2. **My partner's machine has never run any of this.** `docs/SECOND_MACHINE.md` is written
   and **not one of its steps has ever been executed**. `npm run doctor` checks 24
   requirements; three of them have never been seen failing. **This was Block 10's original
   question and it is still unanswered.**
3. **`ground-truth` cannot be built** — its six image slots were never generated, about
   $2.17.
4. **A picture too small for its corner is scaled up without limit** — a 200 px file drew at
   500% and nothing warns.
5. **Client photographs are not in the backup set.**
6. **The panel's image-picker tests pass by winning a race** with fixtures naming files that
   moved into per-reel folders months ago.
7. **A client saved with no colours still inherits K2's four.**
8. **`test-1` holds one picture motionless for 6.78 s** on a sparse reel. The answer is more
   pictures, not a cap.
9. **`benchmarks/src/audio.ts:37`** is the last path keyed by a filename. Corpus-only,
   cannot collide today.

---

## 7. Standing rules for every Claude Code prompt

Every session begins with a **mount check** on
`/Volumes/T7 Shield/INSEA/Projects/framopia-studio` as a hard stop — a stale copy may exist
under `~/dev` and must never be read, written or entered. It counts After Effects instances
and `aerender` processes, and asserts the **ledger** and the **template library sha** at both
ends.

**After Effects**
- `DoScript` into the **already-running** instance only. Never launch it, never quit it,
  never `aerender`, never a resident `-r`, **never save my own project**.
- `templates/library.aep` is read-only; its keyframes are never edited and it is never
  imported into itself. Call `library-guard.jsx` before opening anything.
- **A `DoScript` that returns `1` did nothing** and says nothing about the script. Retry up
  to 5 times, 30 s apart, then stop.
- **ES3 only** in `.jsx` — `var`, no arrow functions, no `JSON` global; `short` and `long`
  are reserved words. Everything passes `scripts/check-extendscript.mjs` before it runs.
- **Never set a `TextDocument.font` to a name not already in `app.fonts.allFonts`.**

**Money and data**
- **`appendCost` fires only at the point of spend**, never in a wrapper.
- Every prompt **states its expected spend and its ceiling**, and reports every added ledger
  line verbatim.
- Schema additions are **optional-with-default** or ship a migration that does not read
  through the new validator.
- **Never delete a user asset** — footage, templates, modes, references, generated images.
  Move it aside and report where it went.
- **Two clients' or two videos' data must never collide.** Four filename collisions cost
  three sessions and $1.01; everything per-video is now keyed by the video's sha256 through
  `service/src/video-identity.ts`.
- **A client's own photograph is never sent anywhere and never copied into a cache.** Two
  tests assert it and they are never weakened.

**Discipline**
- **Never leave a test asserting retired behaviour.**
- **Never claim success for anything not actually run**, and never report a count without
  looking at what it counts.
- **No message may tell me to leave the panel** — no command, no terminal, no restart.
  `leave-the-panel.test.ts` exists because five such messages were found.
- **No AI fingerprints anywhere** in the repo, commits, code or documentation. A frozen list
  of 14 historical commits is frozen and nothing may be added to it.
- `main` only. Never force-push, never rewrite pushed history.

**Reporting, mandatory in every prompt**
- `reports/latest.md` overwritten — **the only file I read** — plus
  `reports/block-N-session-M.md`.
- First line exactly `Status: OK` or `Status: PROBLEM — <one-line cause>`.
- `npm run check` at every session end with per-workspace counts **measured, not carried
  from the brief**.
- **Stop conditions are literal.** A session that correctly stops at a blocker is better
  than one that reasons past it.
- **Nothing in the report is addressed to me as a task.** I don't run commands.

---

## 8. Defect shapes this project keeps producing

Watch for these by name. Each cost at least one session.

- **A stage reports success and produces nothing.** "Looking at the video: done" while
  nothing was saved. A sidecar crash whose exit status was never read.
- **A check that measures a different quantity than the one it claims.** The build asked
  whether masks existed under the plan's name while everything wrote them under the video's.
  The picture-size rule computed `max(min beside, min above)` where the answer is
  `min over frames of max(beside, above)` — provably always smaller.
- **A number that means two things.** The panel promised 73 cards and built 68. The
  reference count meant three different things in three reports. Two font figures — 445
  families and 1198 face names — were reported under one heading.
- **A control that exists, looks right, and has never been used.** The colour hex field had
  no text input at all. Four client settings were collected, validated, echoed back, and
  read by nothing.
- **A test that passes for the wrong reason.** Fixtures naming files that moved; assertions
  reading a URL string rather than whether an image loaded.
- **Something fitted to the corpus.** The commonest of all. Ask of every value: where does a
  video the tool has never seen get this?

---

## 9. Start here

Confirm your reading of this in one paragraph. Then tell me what you recommend next and
produce the first Claude Code prompt.

If I have just given you a session 54 report, verify it first.
