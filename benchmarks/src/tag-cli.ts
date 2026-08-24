import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LOCAL_DIR } from '@framopia/core';
import { parseReferenceVersion, tagTranscript } from './tag-ground-truth.js';

const labels = ['ground-truth', 'test-1', 'test-2', 'test-3'];
for (const label of labels) {
  const dir = path.join(LOCAL_DIR, 'ground-truth');
  const source = readFileSync(path.join(dir, `${label}.txt`), 'utf8');
  const words = tagTranscript(source);
  const version = parseReferenceVersion(source);
  writeFileSync(
    path.join(dir, `${label}.json`),
    JSON.stringify(version === undefined ? { words } : { version, words }, null, 2),
    'utf8',
  );
  const foreign = words.filter((w) => w.lang === 'fr' || w.lang === 'en');
  const arabic = words.filter((w) => w.script === 'arabic');
  console.log(`\n## ${label}: ${words.length} words, ${arabic.length} arabic, ${foreign.length} fr/en`);
  console.log(foreign.map((w) => `${w.text}[${w.lang}]`).join(' '));
}
