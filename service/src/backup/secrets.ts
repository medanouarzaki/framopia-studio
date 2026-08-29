import { openSync, readSync, closeSync } from 'node:fs';

/**
 * Whether a file holds a credential, decided from its **bytes** rather than its
 * name.
 *
 * A filename is something anyone can change, and `.local/config.json` is not
 * special because of what it is called — it is special because there is a
 * Gemini key inside it. Deciding by name would also miss the next file someone
 * drops a key into.
 *
 * **Two limits, stated rather than glossed.** Only the first
 * `SCAN_BYTES` are read, and only files that are valid UTF-8 text are scanned
 * at all: a JPEG is not a credential store, and treating one as scannable would
 * mean regexing 45 MB of images for nothing. A key hidden past the first 64 KB
 * of a binary file would not be found.
 */
const SCAN_BYTES = 64 * 1024;

/**
 * What a credential looks like. Two kinds: a field that announces itself, and a
 * value in a shape a provider publishes. Neither is exhaustive and neither
 * needs to be — this decides whether a file may leave the machine, so the cost
 * of a false positive is one file the user copies himself.
 */
const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  /*
   * A named field **and** a value shaped like a credential. The name alone is
   * not enough: the hand-made alignment references carry `draftTokenText`, and
   * a first draft of this flagged the most irreplaceable file in the set as a
   * secret and would have left it out of the cloud copy. So the name has to
   * *end* with the credential word, and the value has to be long, unbroken and
   * drawn from a credential alphabet — which `draftTokenText: "دقائق."` is not.
   */
  {
    name: 'a credential-shaped value in a field named like a credential',
    re: /"[A-Za-z0-9_]*(?:apikey|api_key|token|secret|password|credential)"\s*:\s*"[A-Za-z0-9_\-.+/=]{16,}"/i,
  },
  { name: 'a Google API key', re: /\bAIza[0-9A-Za-z_-]{20,}/ },
  { name: 'an ElevenLabs key', re: /\bsk_[0-9a-f]{32,}/ },
  { name: 'an OpenAI-style key', re: /\bsk-[A-Za-z0-9]{20,}/ },
  { name: 'a private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

export interface SecretVerdict {
  secret: boolean;
  /** What was matched, for the report. **Never the value itself.** */
  reason: string | null;
}

export function classifyFile(file: string): SecretVerdict {
  let fd: number | null = null;
  try {
    fd = openSync(file, 'r');
    const buffer = Buffer.alloc(SCAN_BYTES);
    const read = readSync(fd, buffer, 0, SCAN_BYTES, 0);
    const head = buffer.subarray(0, read);
    // A NUL byte in the first block is the cheap, reliable test for "not text".
    if (head.includes(0)) return { secret: false, reason: null };
    const text = head.toString('utf8');
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.re.test(text)) return { secret: true, reason: pattern.name };
    }
    return { secret: false, reason: null };
  } catch {
    // Unreadable is not proof of innocence, and a file that cannot be read
    // cannot be backed up either — the copy will fail loudly on its own.
    return { secret: false, reason: null };
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

export const SECRET_SCAN_BYTES = SCAN_BYTES;
