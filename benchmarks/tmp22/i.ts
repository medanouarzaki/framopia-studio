import { readFileSync } from 'node:fs';
import path from 'node:path';
import { impactFrameOf, REPO_ROOT } from '@framopia/core';
const audit = JSON.parse(readFileSync(path.join(REPO_ROOT, 'templates', 'library.audit.json'), 'utf8'));
const FPS = 30000 / 1001;
for (const comp of audit.comps) {
  const r = impactFrameOf(comp, FPS);
  console.log(comp.name.padEnd(16), r.impactS === null ? 'NULL — ' + r.unreadable : `${r.impactS.toFixed(4)}s = ${(r.impactFrames ?? 0).toFixed(2)}f  from ${r.from}`);
}
