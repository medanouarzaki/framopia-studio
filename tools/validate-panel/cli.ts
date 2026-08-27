/**
 * `npm run validate:panel` — the CEP manifest must parse.
 *
 * It runs inside `npm run check` because the failure it catches is invisible
 * everywhere else: After Effects drops a malformed extension at launch and
 * says so only in a log.
 */
import path from 'node:path';
import { checkManifest, PANEL_MANIFEST_PATH } from '@framopia/core';

const result = checkManifest();

if (!result.parsedWithXmllint) {
  console.log('validate:panel: SKIPPING the full XML parse — xmllint is not on PATH');
}

if (result.ok) {
  console.log(
    `validate:panel: ${path.relative(process.cwd(), PANEL_MANIFEST_PATH)} ok` +
      (result.parsedWithXmllint ? '' : ' (double-hyphen rule only)'),
  );
} else {
  for (const issue of result.issues) {
    console.error(
      `validate:panel: ${issue.line === null ? '' : `line ${issue.line}: `}${issue.message}`,
    );
  }
  process.exit(1);
}
