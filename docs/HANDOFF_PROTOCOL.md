# Framopia Studio — Conversation & Handoff Protocol

Version: 1.0. Mandatory for every conversation in this project.

## 1. Roles

- **Foundation conversation** (done): Claude Fable 5. Produced the docs in `docs/`.
- **Block conversations**: Claude Opus, one per block from BLOCKS.md. A block may span two conversations only if context runs out — the handoff makes the split safe.
- **Executor**: Claude Code on the user's machine, bypassed permission confirmations. Claude Code has no memory between sessions; the repo, `CLAUDE.md`, and the prompt are its only memory.
- **User**: pastes prompts and reports, answers only questions that genuinely need his judgment (style, footage, client knowledge, anything hands-on in AE). Everything else the conversation decides itself.

## 2. Lifecycle of a block conversation

1. **Start.** Read all project knowledge: the 7 foundation docs, all prior handoffs, any amendments. Identify the block, restate its DoD in one paragraph, list any user inputs needed for this block (collect them now, not mid-block), then produce Claude Code prompt #1.
2. **Loop.** User runs the prompt in Claude Code, pastes back the report (`reports/block-N-session-M.md`). The conversation **verifies the report against the plan**: check claimed deliverables against the prompt, question discrepancies and suspicious successes, never rubber-stamp. Then issue the next prompt (fixes first, then forward progress). Repeat until DoD is met.
3. **End.** Produce (a) the handoff document → user saves to project knowledge and commits to `handoffs/`; (b) the opening prompt for the next conversation, ready to paste.

## 3. Claude Code prompt requirements

Every prompt is self-contained and exhaustive:
- Context header: project one-liner, current block, what exists in the repo already (assume nothing remembered).
- Exact goals for the session; exact files to create/modify; exact commands to run; tests to write **and run**; expected outcomes.
- The report file to produce: `reports/block-N-session-M.md` with sections: **Done / Deviations (what and why) / Failures & open problems / Repo state (branch, key commits) / Suggested next step**.
- The no-AI-fingerprint rules restated verbatim (short form): no AI attribution or co-author trailers; conventional commits, small and human-reading; comments only where a human would write them; no emoji/boilerplate READMEs. Reference CLAUDE_CODE_GUIDELINES.md.
- Requirement to update `CLAUDE.md` when reality changes (new commands, structure, decisions).
- From Block 2 on: run the current regression check (`npm run check`, later `npm run golden`) at session end and include the result in the report.

## 4. Handoff document template

File: `handoffs/block-N.md` (or `block-N-part-2.md` for splits).

```markdown
# Handoff — Block N: <name>
Date: … · Conversation model: … · Sessions run: M

## Status vs BLOCKS.md
DoD met: yes/no (itemized). If no: what remains and why the conversation ended.

## Decisions made (and why)
Numbered. Include "your-call" resolutions, frozen configs, chosen thresholds.

## Amendments proposed to plan/docs
Exact doc + section + new text. (The next conversation applies them; docs are versioned, not sacred.)

## Repo state
Branch/main HEAD, notable commits, new/changed top-level paths, regression check result.

## Known issues & risks
Honest list, including anything the reports glossed over.

## Exact next steps
Ordered. First item = what the next conversation's prompt #1 should do.

## User inputs collected this block
(fonts, footage, keys, screenshots…) and where they were recorded.
```

## 5. Next-conversation opening prompt template

```markdown
You are running Block N+1 of Framopia Studio on Claude Opus. Before anything else, read the
project knowledge files: all docs in docs/, all handoffs in handoffs/ (most recent last).
They are binding. This conversation follows docs/HANDOFF_PROTOCOL.md exactly.

Block: N+1 — <name> (see BLOCKS.md). DoD: <copied verbatim>.
Carry-over from Block N handoff: <2–5 bullets: applied amendments, open issues that gate this block>.
User inputs needed this block: <list or "none">.

Start by confirming your reading of the block in one paragraph, collect the user inputs,
then produce Claude Code prompt #1.
```

## 6. Divergence rule

If reality diverges from BLOCKS.md or any locked decision: say so explicitly in-conversation the moment it's noticed, record it in the handoff's Amendments section with proposed new text, and proceed only on the amended basis. Never silently drift.
