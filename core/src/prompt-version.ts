/**
 * Identity of the correction prompt, and part of the transcription cache
 * fingerprint per ARCHITECTURE §6 — a change here must invalidate every cached
 * correction.
 *
 * It lives in core because three workspaces now need it: the correction pass
 * that sends the prompt, the diagnostic tools that have to say which cached
 * configuration they read, and `tools/align-review`, which may not import
 * `correction.ts` at all — that module pulls in `@google/genai`, and the
 * review sheet is pinned as unable to reach the network.
 *
 * The prose reasoning for each version stays with the prompts themselves in
 * `service/src/transcription/correction.ts`, which re-exports both of these so
 * every existing import keeps working. Switching is this constant and nothing
 * else.
 *
 * **Version 4 is active.** Frozen for the remainder of Block 8: changing it
 * changes the corrected words, which changes the pairings under review, which
 * invalidates every hand-made reference under `benchmarks/references/align/`.
 */
export type PromptVersion = 1 | 2 | 3 | 4;

export const ACTIVE_PROMPT_VERSION: PromptVersion = 4;
