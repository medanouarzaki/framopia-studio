import { readdirSync } from 'node:fs';
import { loadMode, MODES_DIR, ModeValidationError } from './mode.js';
import {
  loadTemplateManifest,
  TEMPLATE_MANIFEST_PATH,
  TemplateManifestError,
  templatesById,
} from './templates.js';

/**
 * Every mode in `modes/` must parse and validate. Wired into the regression
 * gate: a mode is data a build reads, so a broken one has to fail here rather
 * than at render time in front of a client.
 */
const files = readdirSync(MODES_DIR).filter((f) => f.endsWith('.json'));
if (files.length === 0) {
  console.error(`no modes found in ${MODES_DIR}`);
  process.exit(1);
}

let failed = 0;
for (const file of files.sort()) {
  const id = file.replace(/\.json$/, '');
  try {
    const mode = loadMode(id);
    console.log(`mode ${mode.id} v${mode.version}: ok (fonts ${mode.fonts.status})`);
  } catch (err) {
    failed += 1;
    if (err instanceof ModeValidationError) {
      console.error(`mode ${id}: FAILED`);
      for (const issue of err.issues) {
        console.error(`  ${issue.path === '' ? '<root>' : issue.path}: ${issue.message}`);
      }
    } else {
      console.error(`mode ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

let manifest;
try {
  manifest = loadTemplateManifest();
  console.log(
    `templates: ${manifest.templates.length} entries, ok${manifest.stub ? ' (stub — Block 6 replaces it)' : ''}`,
  );
} catch (err) {
  failed += 1;
  if (err instanceof TemplateManifestError) {
    console.error(`${err.manifestPath}: FAILED`);
    for (const issue of err.issues) {
      console.error(`  ${issue.path === '' ? '<root>' : issue.path}: ${issue.message}`);
    }
  } else {
    console.error(err instanceof Error ? err.message : String(err));
  }
}

// Every id a mode allows must exist in the manifest, or the assignment stage
// would hand the builder a template that is not there.
if (manifest !== undefined) {
  const known = templatesById(manifest);
  for (const file of files.sort()) {
    const id = file.replace(/\.json$/, '');
    let mode;
    try {
      mode = loadMode(id);
    } catch {
      continue;
    }
    for (const [kind, ids] of Object.entries(mode.allowedTemplates)) {
      for (const templateId of ids) {
        const entry = known.get(templateId);
        if (entry === undefined) {
          failed += 1;
          console.error(
            `mode ${id}: allowedTemplates.${kind} names ${templateId}, which ${TEMPLATE_MANIFEST_PATH} does not define`,
          );
        } else if (entry.type !== kind) {
          failed += 1;
          console.error(
            `mode ${id}: allowedTemplates.${kind} names ${templateId}, which the manifest types as ${entry.type}`,
          );
        }
      }
    }
  }
}

if (failed > 0) process.exit(1);
