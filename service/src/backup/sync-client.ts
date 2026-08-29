import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

/**
 * Whether the app that owns a cloud folder is actually running.
 *
 * **This is here because a backup was written into a folder nothing was serving
 * and reported as a success.** Session 40 copied 94 files into
 * `~/Library/CloudStorage/GoogleDrive-…`, verified every hash, and confirmed
 * every byte was on the machine — all of it true, and none of it a backup.
 * Google Drive was not installed; macOS had left the mount point behind from an
 * earlier install, so the files went into an ordinary directory with a
 * convincing name. The user found out by opening drive.google.com and seeing
 * nothing.
 *
 * **Nothing on the filesystem separates the two, which was measured rather than
 * assumed.** A live provider folder and a leftover directory report the same
 * device id as the home directory (16777229 on this machine), the same
 * filesystem in `df`, and permissions persist on the leftover — so the account
 * root is `dr-x------` either way. The only observable difference is outside the
 * filesystem: whether a process is there to serve it.
 */
export interface SyncClientCheck {
  /** True only when a process that can serve this folder is running. */
  running: boolean;
  /** The app this folder belongs to, as far as the path names it. */
  provider: string | null;
  /** What to say on screen. */
  detail: string;
}

/** Strips spaces, punctuation and case so "Google Drive" meets "GoogleDrive". */
function fold(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The app a cloud path belongs to, from the path itself.
 *
 * macOS names a FileProvider folder `<Provider>-<account>`, so the segment
 * before the first hyphen is the app: `GoogleDrive-someone@gmail.com`,
 * `OneDrive-Personal`, `Dropbox`. The legacy home-directory folders are named
 * for the app outright.
 */
export function providerFor(destination: string): string | null {
  const home = homedir();
  const cloudStorage = path.join(home, 'Library', 'CloudStorage');
  const resolved = path.resolve(destination);

  if (resolved.startsWith(path.join(home, 'Library', 'Mobile Documents'))) return 'iCloud';
  if (resolved.startsWith(cloudStorage)) {
    const folder = path.relative(cloudStorage, resolved).split(path.sep)[0] ?? '';
    const name = folder.split('-')[0] ?? '';
    return name.length > 0 ? name : null;
  }
  for (const legacy of ['Dropbox', 'Google Drive', 'OneDrive']) {
    if (resolved.startsWith(path.join(home, legacy))) return legacy;
  }
  return null;
}

/** Every running app bundle's name, e.g. `Google Drive`. */
export function runningAppNames(): string[] {
  try {
    const out = execFileSync('ps', ['-axo', 'comm='], { encoding: 'utf8' });
    const names = new Set<string>();
    for (const line of out.split('\n')) {
      const match = /\/([^/]+)\.app\/Contents\/MacOS\//.exec(line);
      if (match?.[1] !== undefined) names.add(match[1]);
      // iCloud is served by macOS itself rather than by an app bundle; `bird`
      // is the daemon behind ~/Library/Mobile Documents.
      if (line.trim().endsWith('/bird')) names.add('iCloud');
    }
    return [...names];
  } catch {
    return [];
  }
}

/**
 * **What this cannot tell you.** It matches the folder's name against the names
 * of running apps, so it answers "is Google Drive open" and not "is this exact
 * folder the one Google Drive is serving" — a second, stale
 * `GoogleDrive-someone-else@…` folder would pass while syncing nothing. It also
 * says nothing about whether the account is signed in, whether syncing is
 * paused, or whether the upload has finished. It is the check that would have
 * caught the failure it exists for, and no more than that.
 */
export function checkSyncClient(destination: string, running = runningAppNames()): SyncClientCheck {
  const provider = providerFor(destination);
  if (provider === null) {
    return {
      running: false,
      provider: null,
      detail:
        'this looks like a cloud folder but its name does not say which app owns it, so ' +
        'whether anything is syncing it cannot be checked',
    };
  }
  const wanted = fold(provider);
  const match = running.find((name) => fold(name) === wanted || fold(name).startsWith(wanted));
  if (match !== undefined) {
    return { running: true, provider: match, detail: `${match} is running` };
  }
  // `GoogleDrive` comes from a folder name; a person calls it Google Drive.
  const spoken = provider.replace(/([a-z])([A-Z])/g, '$1 $2');
  return {
    running: false,
    provider: spoken,
    detail:
      `${spoken} is not running, so nothing is syncing this folder. Files copied here would sit ` +
      'on this machine looking like a backup and never reach the cloud. Open ' +
      `${spoken}, wait for it to finish signing in, then run this again.`,
  };
}
