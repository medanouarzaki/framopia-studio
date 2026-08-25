import { verifyAllReferences, stampReference, REFERENCE_REELS } from './verify-references.js';

const write = process.argv.includes('--write');
const verdicts = write
  ? REFERENCE_REELS.map((reel) => stampReference(reel))
  : verifyAllReferences();

let failed = 0;
for (const v of verdicts) {
  if (v.issues.length === 0) {
    console.log(`  ok    ${v.reel.padEnd(14)} ${v.headerVersion}`);
    continue;
  }
  failed += 1;
  console.error(`  FAIL  ${v.reel}`);
  for (const issue of v.issues) console.error(`          ${issue}`);
}

if (failed > 0) {
  console.error(
    `\n${failed} reference file(s) do not match their declared version. ` +
      'Correct the text, then re-stamp with `npm run bench:verify-refs -- --write`. ' +
      'Never hand-edit the header (CLAUDE_CODE_GUIDELINES §3).',
  );
  process.exit(1);
}
console.log('references: PASS');
