import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { readEditPlan } from '../editplan/io.js';
import type { EditPlan } from '../editplan/types.js';
import {
  INTRO_OUTRO_TOTALS_S,
  MIN_HOLDS_S,
  evaluateBudget,
  groupSilenceGaps,
  groupSpeechDurations,
  shortestGroup,
  spread,
  tallyPercent,
  type BudgetCell,
  type BudgetFailure,
} from './timing-budget.js';

/**
 * The timing budget sweep, written to benchmarks/. Free, local and read-only:
 * no plan is modified and no API is called.
 */
const DEFAULT_FOOTAGE_DIR = path.join(REPO_ROOT, 'my files', 'test videos');
const OUT_PATH = path.join(REPO_ROOT, 'benchmarks', 'RESULTS-block6-timing-budget.md');

const argv = process.argv.slice(2);
const outIndex = argv.indexOf('--out');
const outPath = outIndex === -1 ? OUT_PATH : (argv[outIndex + 1] as string);
// Sweeping a directory of plan copies is how a grouping change is measured
// before it is written to the corpus. Read-only either way.
const footageIndex = argv.indexOf('--footage');
const FOOTAGE_DIR =
  footageIndex === -1 ? DEFAULT_FOOTAGE_DIR : (argv[footageIndex + 1] as string);

interface Loaded {
  reel: string;
  plan: EditPlan;
}

const loaded: Loaded[] = [];
const failed: { reel: string; error: string }[] = [];

for (const file of readdirSync(FOOTAGE_DIR).filter((f) => f.endsWith('.editplan.json')).sort()) {
  const reel = file.replace('.editplan.json', '');
  try {
    loaded.push({ reel, plan: await readEditPlan(path.join(FOOTAGE_DIR, file)) });
  } catch (err) {
    failed.push({ reel, error: `${(err as Error).name}: ${(err as Error).message}` });
  }
}

const withGroups = loaded.filter((l) => l.plan.subtitles.groups.length > 0);
const f2 = (v: number): string => v.toFixed(2);
const f3 = (v: number): string => v.toFixed(3);
const pct = (t: { buildable: number; total: number }): string =>
  t.total === 0 ? '—' : `${t.buildable}/${t.total} (${tallyPercent(t).toFixed(0)}%)`;

const pooledGapEarly = spread(
  loaded.filter((l) => l.plan.subtitles.groups.length > 0).flatMap((l) => groupSilenceGaps(l.plan)),
);

const cells = new Map<string, BudgetCell[]>();
for (const { reel, plan } of withGroups) {
  cells.set(
    reel,
    INTRO_OUTRO_TOTALS_S.flatMap((io) => MIN_HOLDS_S.map((mh) => evaluateBudget(plan, io, mh))),
  );
}

/** A cell is clean when every subtitle group on every reel is buildable. */
function pooledAt(introOutroS: number, minHoldS: number): {
  groups: { buildable: number; total: number };
  failures: (BudgetFailure & { reel: string })[];
} {
  let buildable = 0;
  let total = 0;
  const failures: (BudgetFailure & { reel: string })[] = [];
  for (const { reel } of withGroups) {
    const cell = (cells.get(reel) as BudgetCell[]).find(
      (c) => c.introOutroS === introOutroS && c.minHoldS === minHoldS,
    ) as BudgetCell;
    buildable += cell.groups.buildable;
    total += cell.groups.total;
    for (const f of cell.failures.filter((x) => x.path.startsWith('subtitles.groups'))) {
      failures.push({ reel, ...f });
    }
  }
  return { groups: { buildable, total }, failures };
}

const grid = INTRO_OUTRO_TOTALS_S.flatMap((io) =>
  MIN_HOLDS_S.map((mh) => ({ introOutroS: io, minHoldS: mh, ...pooledAt(io, mh) })),
);
const clean = grid.filter((g) => g.groups.buildable === g.groups.total);
// Largest budget means the largest floor; ties broken by the larger intro+outro,
// which is the half the user is about to hand-animate.
const best = clean.sort(
  (a, b) =>
    b.introOutroS + b.minHoldS - (a.introOutroS + a.minHoldS) || b.introOutroS - a.introOutroS,
)[0];
const fewestFailures = [...grid].sort(
  (a, b) =>
    a.groups.total - a.groups.buildable - (b.groups.total - b.groups.buildable) ||
    b.introOutroS + b.minHoldS - (a.introOutroS + a.minHoldS),
)[0];

const lines: string[] = [];
lines.push('# Block 6 — subtitle timing budget sweep', '');
lines.push(
  'What intro and outro budget the existing content can carry, measured before',
  'any comp is animated. Free, local, read-only: no plan on disk was modified and',
  'no API was called.',
  '',
);

lines.push('## The answer', '');
if (best) {
  lines.push(
    `**Every subtitle group on every reel is buildable at intro+outro ` +
      `${f2(best.introOutroS)} s with minHold ${f2(best.minHoldS)} s** — a floor of ` +
      `${f2(best.introOutroS + best.minHoldS)} s. That is the largest budget in the swept grid ` +
      `at which nothing fails.`,
    '',
  );
} else {
  const missing = fewestFailures as (typeof grid)[number];
  lines.push(
    `**No swept budget makes every subtitle group buildable.** The fewest failures is ` +
      `${missing.groups.total - missing.groups.buildable} of ${missing.groups.total} groups at ` +
      `intro+outro ${f2(missing.introOutroS)} s with minHold ${f2(missing.minHoldS)} s ` +
      `(floor ${f2(missing.introOutroS + missing.minHoldS)} s). The groups that fail there:`,
    '',
  );
  for (const f of missing.failures) {
    lines.push(
      `- **${f.reel}** \`${f.groupId ?? f.path}\` "${f.text ?? ''}" — ` +
        `${f3(f.haveS ?? 0)} s on screen, short by ${f3(f.shortByS)} s`,
    );
  }
  lines.push('');
}
lines.push(
  'The stub manifest currently declares `sub_pop` at intro 0.13 + hold 0.07 + outro',
  '0.13, a floor of 0.33 s. Every figure below is measured from the word timings in',
  'the plans; the grid itself and the 29.97 fps frame equivalences are assumptions.',
  '',
);

// Two structural findings that decide how to read every table below, so they
// are stated before the tables rather than after them.
const totalMerges = withGroups.reduce(
  (n, l) => n + (cells.get(l.reel) as BudgetCell[]).reduce((m, c) => m + c.merges, 0),
  0,
);
const degenerate = withGroups.map((l) => ({
  reel: l.reel,
  n: l.plan.subtitles.groups.filter((g) => g.end - g.start < 0.05).length,
}));

lines.push('## Two things that decide how to read this', '');
const cellsWithMerges = withGroups.reduce(
  (n, l) => n + (cells.get(l.reel) as BudgetCell[]).filter((c) => c.merges > 0).length,
  0,
);
const loosestMerges = withGroups.reduce((n, l) => {
  const c = (cells.get(l.reel) as BudgetCell[]).find(
    (x) => x.introOutroS === INTRO_OUTRO_TOTALS_S[0] && x.minHoldS === MIN_HOLDS_S[0],
  ) as BudgetCell;
  return n + c.merges;
}, 0);

lines.push(
  `**The merge rescue barely fires.** Across ${withGroups.length} reels and ` +
    `${INTRO_OUTRO_TOTALS_S.length * MIN_HOLDS_S.length} grid cells each, the display-timing ` +
    `pass merged ${totalMerges} groups in total, in ${cellsWithMerges} of ` +
    `${withGroups.length * INTRO_OUTRO_TOTALS_S.length * MIN_HOLDS_S.length} reel-cells, and ` +
    `${loosestMerges} at the loosest budget. It merges only when the pair totals two words or ` +
    'fewer, and grouping has already paired words wherever it could, so adjacent single-word ' +
    'groups are rare. Extension into silence is the rescue that does the work.',
  '',
  '**Silence is the scarce resource, not the budget.** Pooled median gap after a group is ' +
    `${f3(pooledGapEarly.median)} s and the tenth percentile is ${f3(pooledGapEarly.p10)} s, ` +
    'so a card can rarely be held more than a few hundredths of a second past its words. What ' +
    'a group can reach is close to what it was spoken in.',
  '',
);
const withDegenerate = degenerate.filter((d) => d.n > 0);
if (withDegenerate.length > 0) {
  lines.push(
    'Groups whose words are under 0.05 s — alignment artifacts `findShortWords` already ' +
      'reports, not display problems: ' +
      withDegenerate.map((d) => `${d.reel} ${d.n}`).join(', ') +
      '. These fail at every budget in the grid and no intro or outro choice rescues them.',
    '',
  );
}

lines.push('## Pooled subtitle groups, every reel', '');
lines.push(
  'The denominator moves between cells because the display-timing pass merges a',
  'group with its neighbour when extension alone cannot reach the floor, and a',
  'merge removes a card. It refuses to merge a group a keyword supersedes.',
  '',
);
lines.push(`| intro+outro | ${MIN_HOLDS_S.map((m) => `minHold ${f2(m)}`).join(' | ')} |`);
lines.push(`|---|${MIN_HOLDS_S.map(() => '---').join('|')}|`);
for (const io of INTRO_OUTRO_TOTALS_S) {
  const row = MIN_HOLDS_S.map((mh) => {
    const g = grid.find((x) => x.introOutroS === io && x.minHoldS === mh) as (typeof grid)[number];
    return pct(g.groups);
  });
  lines.push(`| ${f2(io)} s (${Math.round(io * 29.97)}f) | ${row.join(' | ')} |`);
}
lines.push('');

for (const { reel, plan } of withGroups) {
  const reelCells = cells.get(reel) as BudgetCell[];
  lines.push(`## ${reel}`, '');
  const hasKw = plan.keywords.items.length > 0;
  const hasSlots = plan.images.slots.length > 0;
  lines.push(
    `| intro+outro | minHold | floor | subtitle groups | merges${hasKw ? ' | keywords' : ''}${hasSlots ? ' | image slots' : ''} |`,
  );
  lines.push(`|---|---|---|---|---${hasKw ? '|---' : ''}${hasSlots ? '|---' : ''}|`);
  for (const c of reelCells) {
    const extra =
      (hasKw ? ` | ${pct(c.keywords)}` : '') + (hasSlots ? ` | ${pct(c.slots)}` : '');
    lines.push(
      `| ${f2(c.introOutroS)} | ${f2(c.minHoldS)} | ${f2(c.floorS)} | ${pct(c.groups)} | ${c.merges}${extra} |`,
    );
  }
  lines.push('');

  const durations = spread(groupSpeechDurations(plan));
  const gaps = spread(groupSilenceGaps(plan));
  lines.push(
    `Raw group speech duration, s: min ${f3(durations.min)} · p10 ${f3(durations.p10)} · ` +
      `median ${f3(durations.median)} · max ${f3(durations.max)} (n=${durations.n})`,
    '',
    `Silence after each group, s: min ${f3(gaps.min)} · p10 ${f3(gaps.p10)} · ` +
      `median ${f3(gaps.median)} · max ${f3(gaps.max)} (n=${gaps.n})`,
    '',
  );
  const shortest = shortestGroup(plan);
  if (shortest) {
    lines.push(
      `Shortest group: \`${shortest.id}\` "${shortest.text}" at ${f3(shortest.durationS)} s, ` +
        `with ${f3(shortest.gapAfterS)} s of silence after it.`,
      '',
    );
  }
}

const allDurations = withGroups.flatMap((l) => groupSpeechDurations(l.plan));
const allGaps = withGroups.flatMap((l) => groupSilenceGaps(l.plan));
const pooledDur = spread(allDurations);
const pooledGap = spread(allGaps);
lines.push('## Pooled', '');
lines.push(
  `Raw group speech duration, s: min ${f3(pooledDur.min)} · p10 ${f3(pooledDur.p10)} · ` +
    `median ${f3(pooledDur.median)} · max ${f3(pooledDur.max)} (n=${pooledDur.n})`,
  '',
  `Silence after each group, s: min ${f3(pooledGap.min)} · p10 ${f3(pooledGap.p10)} · ` +
    `median ${f3(pooledGap.median)} · max ${f3(pooledGap.max)} (n=${pooledGap.n})`,
  '',
);

if (failed.length > 0) {
  lines.push('## Plans that would not open', '');
  for (const f of failed) lines.push(`- ${f.reel}: ${f.error}`);
  lines.push('');
}

writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`wrote ${outPath}`);
console.log(`reels swept: ${withGroups.map((l) => l.reel).join(', ')}`);
if (best) {
  console.log(
    `clean at intro+outro ${f2(best.introOutroS)}s minHold ${f2(best.minHoldS)}s ` +
      `(floor ${f2(best.introOutroS + best.minHoldS)}s)`,
  );
} else {
  const m = fewestFailures as (typeof grid)[number];
  console.log(
    `no clean cell; fewest failures ${m.groups.total - m.groups.buildable} at ` +
      `intro+outro ${f2(m.introOutroS)}s minHold ${f2(m.minHoldS)}s`,
  );
}
