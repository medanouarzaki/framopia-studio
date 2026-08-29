import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { isMaterialised } from './destination.js';

/*
 * Google Drive streams by default: a file in the mount can be a name whose
 * bytes live only on Google's servers. This is the check that says whether a
 * copy is really here, and it was measured on the mount rather than reasoned
 * about — an undownloaded Drive file reports zero blocks against a 6,298,543
 * byte size and carries macOS's `dataless` flag, while a file written into the
 * same folder reports 3912 blocks for 2,000,000 bytes.
 */
describe('whether a file’s bytes are on this machine', () => {
  it('says yes for an ordinary local file', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-mat-'));
    const file = path.join(dir, 'a.bin');
    writeFileSync(file, Buffer.alloc(200_000, 7));
    expect(isMaterialised(file)).toBe(true);
  });

  it('says yes for an empty file, which has no bytes to be anywhere', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-mat-'));
    const file = path.join(dir, 'empty');
    writeFileSync(file, '');
    expect(isMaterialised(file)).toBe(true);
  });

  /*
   * The real case, skipped on a machine with no Drive: a file the account has
   * never downloaded. Without this the check could pass everywhere and still be
   * unable to detect the thing it exists for.
   */
  const drive = path.join(homedir(), 'Library', 'CloudStorage');
  const cloudOnly = (): string | null => {
    if (!existsSync(drive)) return null;
    for (const account of readdirSync(drive)) {
      const myDrive = path.join(drive, account, 'My Drive');
      if (!existsSync(myDrive)) continue;
      for (const name of readdirSync(myDrive)) {
        const file = path.join(myDrive, name);
        try {
          const s = statSync(file);
          if (s.isFile() && s.size > 4096 && s.blocks === 0) return file;
        } catch {
          continue;
        }
      }
    }
    return null;
  };

  it.skipIf(cloudOnly() === null)('says no for a file that is only in the cloud', () => {
    const file = cloudOnly() as string;
    expect(isMaterialised(file)).toBe(false);
  });
});
