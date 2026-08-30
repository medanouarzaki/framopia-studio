/**
 * TEMPLATE_LIBRARY_GUIDE §9. Audits templates/library.aep against
 * templates/manifest.json and fails loudly, naming the comp and the layer.
 *
 * Two modes, and the split is the point:
 *
 *   --audit   drives After Effects to dump what is really in the .aep, and
 *             writes templates/library.audit.json with the .aep's sha256.
 *   (default) validates the manifest against that dump. Fast, no AE, and this
 *             is what `npm run check` runs.
 *
 * The dump carries the hash of the file it was taken from, so a .aep edited
 * after its audit fails as stale rather than being validated against a stale
 * picture of itself. **Nothing here parses the binary .aep.** A validator that
 * guessed at the format would certify comps it had never read.
 */
import { createHash } from 'node:crypto';
import { validateTemplates, type Audit } from '@framopia/core';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function sha256Of(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

function runAudit(aepPath: string, auditPath: string): void {
  const jsx = path.join(HERE, 'audit.jsx');
  // The self-import guard lives with the other ExtendScript the build drives.
  const guard = path.join(REPO_ROOT, 'panel', 'jsx', 'library-guard.jsx');
  const tmp = path.join(HERE, '.audit-raw.json');
  if (existsSync(tmp)) unlinkSync(tmp);

  const script =
    `$.evalFile("${guard}"); $.evalFile("${jsx}"); framopiaAudit("${aepPath}", "${tmp}");`.replace(
      /"/g,
      '\\"',
    );
  console.log('driving After Effects (it must already be running)...');
  execFileSync('osascript', ['-e', `tell application "Adobe After Effects 2026" to DoScript "${script}"`], {
    stdio: 'inherit',
  });

  if (!existsSync(tmp)) {
    throw new Error(
      'After Effects wrote no audit. It has to be running and its project closable; ' +
        'launching it with -r does not work on this machine.',
    );
  }
  const raw = JSON.parse(readFileSync(tmp, 'utf8')) as Audit & {
    refused?: boolean;
    error?: string;
    closedProject?: string;
  };
  unlinkSync(tmp);

  /*
   * A refusal must not be written over a good audit. The script declines when
   * the open project has unsaved changes, and writing that refusal into
   * library.audit.json would replace a working measurement with an error
   * message — losing the very thing the refusal exists to protect.
   */
  if (raw.refused === true || raw.ok !== true) {
    throw new Error(
      `After Effects did not audit: ${raw.error ?? 'no reason given'}\n` +
        `${path.relative(REPO_ROOT, auditPath)} is unchanged.`,
    );
  }

  if (raw.closedProject !== undefined) {
    console.log(`closed the saved project that was open: ${raw.closedProject}`);
  }
  raw.aepSha256 = sha256Of(aepPath);
  writeFileSync(auditPath, `${JSON.stringify(raw, null, 2)}\n`);
  console.log(`wrote ${path.relative(REPO_ROOT, auditPath)} (${raw.comps?.length ?? 0} comps)`);
}

const argv = process.argv.slice(2);
const at = (flag: string, fallback: string) => {
  const i = argv.indexOf(flag);
  return i === -1 ? fallback : (argv[i + 1] as string);
};
const AEP = at('--aep', path.join(REPO_ROOT, 'templates', 'library.aep'));
const MANIFEST = at('--manifest', path.join(REPO_ROOT, 'templates', 'manifest.json'));
const AUDIT = at('--audit-file', path.join(REPO_ROOT, 'templates', 'library.audit.json'));
const SFX = at('--sfx', path.join(REPO_ROOT, 'assets', 'sfx', 'sfx.json'));

if (argv.includes('--audit')) {
  runAudit(AEP, AUDIT);
  process.exit(0);
}

if (!existsSync(AUDIT)) {
  console.error(
    `validate-templates: ${path.relative(REPO_ROOT, AUDIT)} does not exist. ` +
      'Run: npm run audit:templates (After Effects must be open)',
  );
  process.exit(1);
}

const audit = JSON.parse(readFileSync(AUDIT, 'utf8')) as Audit;
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
  stub: boolean;
  templates: Record<string, unknown>[];
};
const sfxIndex = JSON.parse(readFileSync(SFX, 'utf8')) as { sfx: { id: string }[] };

const problems = validateTemplates({
  audit,
  manifest,
  sfxIds: new Set(sfxIndex.sfx.map((s) => s.id)),
  aepSha256: sha256Of(AEP),
});

if (problems.length > 0) {
  console.error(`validate-templates: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`validate-templates: ${manifest.templates.length} template(s) ok, audited against ${path.basename(AEP)}`);
