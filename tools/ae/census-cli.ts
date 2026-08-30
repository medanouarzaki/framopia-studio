/**
 * Reads a built .aep back out of After Effects and writes what is really in it.
 *
 * A build reports its own success. This asks After Effects instead, so a comp
 * with a stale layer and a comp that is correct stop looking alike from the
 * outside — the shape of every defect Block 9 lost a session to.
 *
 * **Strictly read-only.** It opens no project, sets nothing and saves nothing,
 * and it never writes a font name. The .aep it describes must already be open
 * in After Effects; if a different project is open it refuses and says which,
 * because opening one would replace whatever the user had on screen.
 *
 *   npm run census:comp -- --aep <abs path> [--out <path.json>] [--mode <id>]
 *                          [--plan <abs path.editplan.json>]
 *
 * With `--plan` it also compares every card's string against what the Edit Plan
 * says, resolved through the **builder's own** `buildReel` rather than a second
 * copy of the rule. Two consecutive sessions made that comparison by hand;
 * whatever asserts a property is emitted by the thing that verifies it.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REPO_ROOT,
  loadMode,
  loadTemplateManifest,
  resolveUserPath,
  shapeCensus,
  type RawCensus,
} from '@framopia/core';
import { readEditPlan } from '../../service/src/editplan/io.js';
import { buildReel, type AuditComp } from '../../service/src/build/reel-plan.js';
import { resolveClientIdentity } from '../../service/src/build/client-identity.js';
import { textStyleFor } from '../../service/src/build/text-style.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AE_APPLICATION = 'Adobe After Effects 2026';

/**
 * The word each template comp ships with on its placeholder, so a layer the
 * build never reached is recognisable rather than merely different.
 *
 * Read off the library by the user's own style pass and recorded here because
 * `templates/library.audit.json` does not carry a layer's text; if a template's
 * placeholder word is ever changed this list has to change with it, and a word
 * missing from it makes the census quieter rather than wrong.
 */
const PLACEHOLDER_WORDS = ['kan9olo', 'Booster', 'المنطقة', 'شد طبيعي'];

function flag(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

function sha256Of(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const aepFlag = flag('aep');
if (aepFlag === undefined) {
  fail('usage: npm run census:comp -- --aep <abs path to a built .aep> [--out <path>] [--mode <id>]');
}
const aepPath = resolveUserPath(aepFlag);
if (!existsSync(aepPath)) fail(`there is no file at ${aepPath}`);

const outPath =
  flag('out') === undefined
    ? path.join(REPO_ROOT, 'reports', `${path.basename(aepPath, '.aep')}.census.json`)
    : resolveUserPath(flag('out') as string);

/**
 * What every card should read, from the build's own resolution.
 *
 * `buildReel` is the function `build-reel-cli.ts` calls; the image and audio
 * resolvers are stubbed because only the text is wanted here and `buildReel`
 * derives a card's text, template and style without consulting either.
 */
async function expectedTextsFor(planPath: string): Promise<Record<string, string>> {
  const plan = await readEditPlan(planPath);
  const audit = (
    JSON.parse(readFileSync(path.join(REPO_ROOT, 'templates', 'library.audit.json'), 'utf8')) as {
      comps?: AuditComp[];
    }
  ).comps ?? [];
  const entries = new Map(loadTemplateManifest().templates.map((t) => [t.id, t]));
  const identity = resolveClientIdentity(plan);
  const built = buildReel({
    plan,
    audit,
    topLeftFor: () => undefined,
    cardTemplateId: 'img_float',
    introFor: (id) => entries.get(id)?.introS ?? 0,
    minHoldFor: (id) => entries.get(id)?.minHoldS ?? 0,
    sfxFileFor: (id) => id,
    candidateFileFor: () => null,
    shadowLayersFor: (templateId) => entries.get(templateId)?.shadowLayers ?? [],
    textStyleFor: (card) => {
      if (identity.snapshot === null) return undefined;
      const size = audit
        .find((x) => x.name === card.templateId)
        ?.layers.find((l) => l.name === 'TXT_MAIN')?.text?.fontSize;
      if (size === undefined) return undefined;
      return (
        textStyleFor({
          kind: card.kind,
          templateId: card.templateId,
          templateFontSize: size,
          snapshot: identity.snapshot,
        }) ?? undefined
      );
    },
  });
  const texts: Record<string, string> = {};
  for (const e of built.elements) {
    if (e.kind === 'image' || e.text === undefined) continue;
    texts[e.id] = e.text;
  }
  return texts;
}

async function main(): Promise<void> {
  const planFlag = flag('plan');
  const planPath = planFlag === undefined ? undefined : resolveUserPath(planFlag);
  if (planPath !== undefined && !existsSync(planPath)) fail(`there is no Edit Plan at ${planPath}`);
  const expectedTexts = planPath === undefined ? undefined : await expectedTextsFor(planPath);

  const modeId = flag('mode');
  const expectedFonts =
    modeId === undefined
      ? undefined
      : (() => {
          const mode = loadMode(modeId);
          if (mode.fonts.status !== 'set') return undefined;
          const names = mode.fonts.postScriptNames;
          if (names === undefined) return undefined;
          return [...new Set([names.latin, names.arabic, names.emphasis])].filter(
            (n): n is string => typeof n === 'string' && n.length > 0,
          );
        })();

  const runDir = path.join(REPO_ROOT, '.local', 'build');
  mkdirSync(runDir, { recursive: true });
  const optionsPath = path.join(runDir, '.census-options.json');
  const resultPath = path.join(runDir, '.census-result.json');
  writeFileSync(optionsPath, JSON.stringify({ aepPath }), 'utf8');
  if (existsSync(resultPath)) unlinkSync(resultPath);

  const script = [
    `$.evalFile("${path.join(REPO_ROOT, 'panel', 'jsx', 'json2.jsx')}");`,
    `$.evalFile("${path.join(REPO_ROOT, 'panel', 'jsx', 'fonts.jsx')}");`,
    `$.evalFile("${path.join(HERE, 'census.jsx')}");`,
    `framopiaCensus("${optionsPath}", "${resultPath}");`,
  ]
    .join(' ')
    .replace(/"/g, '\\"');

  console.log('driving After Effects (it must already be running, with that project open)...');
  execFileSync('osascript', ['-e', `tell application "${AE_APPLICATION}" to DoScript "${script}"`], {
    stdio: 'ignore',
  });

  if (!existsSync(resultPath)) {
    fail(
      'After Effects wrote no census. It has to be running, and a DoScript that returns 1 ' +
        'did nothing at all — retry before concluding anything about the script.',
    );
  }
  const raw = JSON.parse(readFileSync(resultPath, 'utf8')) as RawCensus;
  unlinkSync(resultPath);

  const manifest = loadTemplateManifest();
  const census = shapeCensus({
    raw,
    aepPath,
    aepSha256: sha256Of(aepPath),
    measuredAt: new Date().toISOString(),
    templates: manifest.templates,
    placeholderWords: PLACEHOLDER_WORDS,
    ...(expectedFonts === undefined ? {} : { expectedFonts }),
    ...(expectedTexts === undefined ? {} : { expectedTexts }),
  });

  writeFileSync(outPath, `${JSON.stringify(census, null, 2)}\n`);

  const s = census.summary;
  console.log(`\n${path.relative(REPO_ROOT, aepPath)} — ${census.aeVersion}, sha256 ${census.aepSha256.slice(0, 16)}`);
  for (const m of census.masters) {
    console.log(
      `  ${m.name}: ${m.width}x${m.height}, ${m.duration.toFixed(6)}s @ ${m.frameRate.toFixed(7)}, ` +
        `${m.numLayers} layers (${Object.entries(m.roleCounts)
          .filter(([, n]) => n > 0)
          .map(([k, n]) => `${n} ${k}`)
          .join(', ')})`,
    );
  }
  console.log(
    `  ${s.compCount} comps: ${s.masterCount} master, ${s.elementCompCount} built, ` +
      `${s.libraryCompCount} library`,
  );
  console.log(`  ${s.textCompCount} text comps, ${s.textLayersChecked} text layers`);
  console.log(`  placeholder words surviving: ${s.placeholderWordsSurviving}`);
  console.log(`  comps missing a declared layer: ${s.compsWithMissingDeclaredLayer}`);
  console.log(`  comps with an undeclared text layer: ${s.compsWithUndeclaredTextLayer}`);
  console.log(`  comps where placeholder and shadow differ: ${s.compsWherePlaceholderAndShadowDiffer}`);
  console.log(
    `  comps where placeholder and shadow sizes differ: ${s.compsWherePlaceholderAndShadowSizesDiffer}`,
  );
  console.log(
    `  cards at full size: ${s.cardsAtFullSize}, shrunk: ${s.cardsShrunk}` +
      (s.smallestSizeFactor === null ? '' : ` (smallest x${s.smallestSizeFactor.toFixed(4)})`),
  );
  for (const g of census.sizeGroups) {
    console.log(
      `    ${g.templateId} / ${g.font ?? 'the template’s own face'} at ${g.fullSizePx}: ` +
        `${g.cards} cards, ${g.shrunkCards} shrunk`,
    );
  }
  console.log(
    s.textCompsComparedAgainstPlan === null
      ? '  against the plan: not compared (no --plan given)'
      : `  against the plan: ${s.textCompsComparedAgainstPlan} compared, ` +
        `${s.textMismatchesAgainstPlan} mismatched`,
  );
  for (const t of census.textComps.filter((x) => x.textMatchesPlan === false)) {
    console.log(`    ${t.compName}: reads ${JSON.stringify(t.layers[0]?.text)}, plan says ${JSON.stringify(t.expectedText)}`);
  }
  console.log(`  fonts: ${s.fontsSeen.join(', ') || 'none'}`);
  if (expectedFonts !== undefined) {
    console.log(`  fonts outside ${modeId}: ${s.unexpectedFonts.join(', ') || 'none'}`);
  }
  console.log(`\nwrote ${path.relative(REPO_ROOT, outPath)}`);
}

void main();
