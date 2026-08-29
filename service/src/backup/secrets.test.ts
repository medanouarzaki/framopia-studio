import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { classifyFile } from './secrets.js';
import { classifyDestination } from './destination.js';
import { surveyGroups } from './set.js';

const write = (name: string, content: string): string => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'framopia-sec-')), name);
  writeFileSync(file, content, 'utf8');
  return file;
};

describe('deciding what holds a credential', () => {
  it('reads the bytes, not the name', () => {
    const innocent = write('config.json', JSON.stringify({ machineLabel: 'mac' }));
    expect(classifyFile(innocent).secret).toBe(false);
    const guilty = write('notes.txt', JSON.stringify({ googleApiKey: 'AIza0123456789abcdefghij' }));
    expect(classifyFile(guilty).secret).toBe(true);
  });

  /*
   * A first draft matched any field whose name contained "token", and the
   * hand-made alignment references carry `draftTokenText` — so the most
   * irreplaceable file in the set was classified as a secret and would have
   * been left out of the cloud copy. The name has to end with the credential
   * word and the value has to look like one.
   */
  it('does not call the alignment references a secret', () => {
    const reference = path.join(REPO_ROOT, 'benchmarks', 'references', 'align', 'vitasilk.json');
    expect(classifyFile(reference).secret).toBe(false);
    const draftToken = write('r.json', JSON.stringify({ draftTokenText: 'دقائق.', wordId: 'w0001' }));
    expect(classifyFile(draftToken).secret).toBe(false);
  });

  it('catches a key by its own shape, whatever the field is called', () => {
    expect(classifyFile(write('x.txt', 'export K=AIzaSyA0123456789abcdefghijkl')).secret).toBe(true);
    expect(classifyFile(write('y.txt', '-----BEGIN RSA PRIVATE KEY-----')).secret).toBe(true);
  });

  it('does not scan a binary, and says as much by leaving it alone', () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'framopia-sec-')), 'a.bin');
    writeFileSync(file, Buffer.from([0x00, 0x01, 0x02, ...Buffer.from('googleApiKey":"AIza0123456789abcdefghij"')]));
    expect(classifyFile(file).secret).toBe(false);
  });

  it('names what it matched and never the value', () => {
    const verdict = classifyFile(write('c.json', JSON.stringify({ apiKey: 'AIza0123456789abcdefghij' })));
    expect(verdict.reason).toBe('a credential-shaped value in a field named like a credential');
    expect(verdict.reason).not.toContain('AIza');
  });
});

/*
 * Which items in the real set are secret, so the answer is measured rather than
 * asserted from the filename anyone could change.
 */
describe('the set as it stands on this machine', () => {
  it('has exactly one file a cloud destination would refuse', () => {
    const secret = surveyGroups()
      .flatMap((g) => g.paths)
      .filter((f) => classifyFile(f).secret)
      .map((f) => path.relative(REPO_ROOT, f));
    expect(secret).toEqual([path.join('.local', 'config.json')]);
  });
});

describe('telling a cloud folder from a disk', () => {
  it('knows the macOS sync roots', () => {
    const home = process.env['HOME'] as string;
    expect(classifyDestination(path.join(home, 'Library', 'CloudStorage', 'GoogleDrive-x', 'My Drive'))).toBe('cloud');
    expect(classifyDestination(path.join(home, 'Library', 'Mobile Documents', 'x'))).toBe('cloud');
    expect(classifyDestination(path.join(home, 'Dropbox', 'x'))).toBe('cloud');
  });

  it('treats a real volume as local', () => {
    expect(classifyDestination('/Volumes/T7 Shield/backups')).toBe('local');
  });

  /*
   * The honest third answer. `df` reports Google Drive as the machine's own
   * data volume, so there is no filesystem fact that separates a sync folder
   * from a plain one before writing — and guessing "local" would copy an API
   * key into a shared folder.
   */
  it('refuses to guess about anything else', () => {
    expect(classifyDestination('/tmp/somewhere')).toBe('unknown');
    expect(classifyDestination(path.join(process.env['HOME'] as string, 'Desktop'))).toBe('unknown');
  });
});
