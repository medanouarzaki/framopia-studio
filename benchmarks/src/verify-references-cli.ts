import {
  REFERENCE_SET_DEFINITION,
  referenceFilesRootedAt,
  referenceSetSummary,
} from '@framopia/core';
import { verifyAllReferences, stampReference, REFERENCE_REELS } from './verify-references.js';
import { undeclaredReferenceFiles, verifyReferenceSet } from './reference-set.js';

/**
 * `FRAMOPIA_REFERENCE_ROOT` re-roots the declared set onto another directory,
 * so the gate's failures can be watched without moving a real reference. It is
 * the only way to exercise them: these are the files the gate exists to
 * protect, and Block 10 session 12 was spent establishing that none had
 * already been lost.
 */
const rootOverride = process.env['FRAMOPIA_REFERENCE_ROOT'];
const files = rootOverride === undefined ? undefined : referenceFilesRootedAt(rootOverride);

const write = process.argv.includes('--write');

let failed = 0;

// Present, readable and parseable, before anything reads a file's contents for
// meaning. An absent reference is a lost file; a non-conformant one is a text
// that needs correcting, and a reader has to be able to tell them apart.
console.log(`references: ${referenceSetSummary(files)}`);
console.log(`            ${REFERENCE_SET_DEFINITION}`);
for (const v of verifyReferenceSet(files)) {
  if (v.problem === null) {
    console.log(`  ok    ${v.file.id.padEnd(28)} present, readable, parses`);
    continue;
  }
  failed += 1;
  console.error(`  FAIL  ${v.file.id.padEnd(28)} ${v.problem}`);
  console.error(`          ${v.issue}`);
}

for (const stray of undeclaredReferenceFiles(files)) {
  failed += 1;
  console.error(`  FAIL  undeclared reference file`);
  console.error(
    `          ${stray} sits in a reference directory but is not declared in ` +
      'core/src/references.ts, so nothing is guarding it. Declare it or move it out.',
  );
}

// Orthography conformance of the transcripts, which is a different question and
// only askable once the files are known to be there.
if (rootOverride === undefined) {
  const verdicts = write ? REFERENCE_REELS.map((reel) => stampReference(reel)) : verifyAllReferences();
  for (const v of verdicts) {
    if (v.issues.length === 0) {
      console.log(`  ok    ${v.reel.padEnd(28)} ${v.headerVersion}`);
      continue;
    }
    failed += 1;
    console.error(`  FAIL  ${v.reel}`);
    for (const issue of v.issues) console.error(`          ${issue}`);
  }
}

if (failed > 0) {
  console.error(
    `\n${failed} reference problem(s). An absent or unparseable file is a lost ` +
      'hand-made reference: restore it rather than regenerating it, because nothing here can. ' +
      'A version mismatch is a text to correct, then re-stamp with ' +
      '`npm run bench:verify-refs -- --write`. Never hand-edit the header ' +
      '(CLAUDE_CODE_GUIDELINES §3).',
  );
  process.exit(1);
}
console.log('references: PASS');
