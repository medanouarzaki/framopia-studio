# The money screen

**Written by Block 12 session 68 from measurement, not from expectation.** No
screen was built. This is the shape the next session works from, and every
figure below was measured against the 165 lines on disk.

### The banner, always visible

Two numbers, side by side, in US dollars and never converted — Mohamed's ruling.

**Total spent since the beginning.** The ledger answers this exactly:
**$18.832129** across 165 lines, first 2026-08-24, last 2026-09-03. It reconciles
to the cent with the figure carried in the reports.

**Credit remaining.** **The tool cannot know this and must be told.** Nothing in
the repository records a credit balance. Session 46 found the $6.82 and $2.71
quoted in earlier reports are Mohamed's own Google balance read off a billing
page, not ledger figures, and that carrying one forward by subtracting ledger
spend gave $2.91 against a later-quoted $2.71 — a $0.20 gap the repository could
not explain. So credit is a figure he enters, dated, and the banner shows *what
he entered, when, and what has been spent since*. It never presents a computed
balance as though it were read from an account.

### The filters

Day, month, client, video, stage. **Day, month and stage work over the whole
history**; client and video work over what has been recorded since session 68 and
show everything earlier as *before this was recorded*.

### Cost per second of footage

Per reel, from the plan's own duration and its `costs.spentUsd`. Measured today
for the two reels with a complete run: `sora` at 40.5 s and $3.908683 is
**$0.0965 a second**; `sora-6a60ced1` at $1.551460 is a second run of the same
client's footage. The figure is only as good as the attribution behind it, so a
reel whose spend is partly unattributable shows the share it can account for.

### Where a cap lives, and what it says

Beside the button that is about to spend, before it is pressed, showing the
estimate against what is left. **It warns and never refuses** — Mohamed's ruling,
the same standing as the soft-picture warning: the tool says what it thinks and
the person decides.

### What the screen must never do

**It never writes to the ledger.** Not a line, not a correction, not a tidy-up.
The ledger is append-only evidence of real money and only the point of spend
writes to it — session 65 found a *test* writing a fabricated $0.134 charge into
it and the guard added then now holds every workspace to it.

**It never edits, reformats or migrates the 165 existing lines**, and it never
hides a line it does not understand. A line with a stage the screen has no
category for is shown under its own name, not dropped.

**It never guesses.** A line without a client is not attributed to one by its
timestamp, by the reel that was open at the time, or by anything else.

### What it cannot show for the old lines

**None of the 165 lines says which client or which video.** Measured today: the
cache reconstruction session 46 used now recovers **$10.344745 of $18.832129 —
54.9%**, leaving **$8.487384 (45.1%)** attributable to nothing, and the share
falls with every run because the caches evict. Transcription cache entries carry
no cost at all, so even that route cannot attribute transcription spend.

**So per-client and per-video totals begin at session 68**, and everything before
is one honest bucket labelled *before this was recorded*. The alternative —
back-filling from the cache while it still holds something — would write a guess
into the one record that is supposed to be evidence.

**Estimate against actual cannot be shown for any past run.** The plans carry
`costs.totalUsd` and `costs.spentUsd`, which read like estimate and actual and
are **both actuals**: `totalUsd` is what the most recent run of each stage cost.
The only estimate the tool computes lives in `dry-run.ts`, is shown to the panel
and is never written down.
