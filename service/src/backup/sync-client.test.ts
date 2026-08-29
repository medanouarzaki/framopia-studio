import { describe, expect, it } from 'vitest';
import { homedir } from 'node:os';
import path from 'node:path';
import { checkSyncClient, providerFor, runningAppNames } from './sync-client.js';

const cloud = (folder: string): string =>
  path.join(homedir(), 'Library', 'CloudStorage', folder, 'My Drive');

/*
 * A backup was written into a folder nothing was serving and reported as a
 * success: 94 files, every hash verified, every byte on the machine — all true,
 * and none of it a backup, because Google Drive was not installed and macOS had
 * left the mount point behind. Nothing on the filesystem separates a live
 * provider folder from that leftover: both report the same device id as the
 * home directory and the same filesystem in `df`. Only a process does.
 */
describe('whether anything is syncing a cloud folder', () => {
  it('refuses when the app that owns the folder is not running', () => {
    const check = checkSyncClient(cloud('GoogleDrive-someone@gmail.com'), ['Finder', 'Safari']);
    expect(check.running).toBe(false);
    expect(check.detail).toContain('Google Drive is not running');
    expect(check.detail).toContain('never reach the cloud');
    expect(check.detail).toContain('run this again');
  });

  it('accepts when it is', () => {
    const check = checkSyncClient(cloud('GoogleDrive-someone@gmail.com'), ['Google Drive']);
    expect(check.running).toBe(true);
    expect(check.detail).toBe('Google Drive is running');
  });

  it('reads the app out of the folder name, however the provider spells it', () => {
    expect(providerFor(cloud('GoogleDrive-a@b.com'))).toBe('GoogleDrive');
    expect(providerFor(cloud('OneDrive-Personal'))).toBe('OneDrive');
    expect(providerFor(cloud('Dropbox'))).toBe('Dropbox');
    expect(providerFor(path.join(homedir(), 'Library', 'Mobile Documents', 'x'))).toBe('iCloud');
    expect(providerFor('/Volumes/T7 Shield')).toBeNull();
  });

  it('matches Dropbox and OneDrive by the same rule', () => {
    expect(checkSyncClient(cloud('Dropbox'), ['Dropbox']).running).toBe(true);
    expect(checkSyncClient(cloud('OneDrive-Personal'), ['OneDrive']).running).toBe(true);
    expect(checkSyncClient(cloud('OneDrive-Personal'), ['Dropbox']).running).toBe(false);
  });

  /* A folder whose name says nothing is refused rather than assumed working. */
  it('refuses a cloud folder it cannot attribute to an app', () => {
    const check = checkSyncClient('/tmp/some-folder', ['Google Drive']);
    expect(check.running).toBe(false);
    expect(check.provider).toBeNull();
    expect(check.detail).toContain('cannot be checked');
  });

  it('reads the running apps off this machine', () => {
    const names = runningAppNames();
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => typeof n === 'string' && n.length > 0)).toBe(true);
  });
});
