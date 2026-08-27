import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './paths.js';

/**
 * A message naming a path or a command is a claim, and a claim nobody checked
 * is how the panel came to tell the user to run `npm run service:build` about
 * a file at `/service/dist/service.js` that could never have existed.
 *
 * This cannot verify a path computed at runtime — that is the code's job, at
 * the moment it displays it. What it can verify is the fixed half: every
 * `npm run …` a user-facing message tells someone to type must be a script
 * that exists.
 */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

const scripts = Object.keys(
  (JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  }).scripts,
);

describe('every command named in a message exists', () => {
  const files = [
    ...sourceFiles(path.join(REPO_ROOT, 'panel', 'src')),
    ...sourceFiles(path.join(REPO_ROOT, 'core', 'src')),
    ...sourceFiles(path.join(REPO_ROOT, 'service', 'src')),
  ];

  const named = new Map<string, string[]>();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/npm run ([a-z0-9:-]+)/g)) {
      const script = m[1] as string;
      named.set(script, [...(named.get(script) ?? []), path.relative(REPO_ROOT, file)]);
    }
  }

  it('found some to check', () => {
    expect(named.size).toBeGreaterThan(0);
  });

  it.each([...named.entries()])('npm run %s is a real script (%s)', (script) => {
    expect(scripts).toContain(script);
  });
});

describe('the node help is written once', () => {
  it('is not retyped in the panel', () => {
    const service = readFileSync(path.join(REPO_ROOT, 'panel', 'src', 'service.ts'), 'utf8');
    expect(service).toContain('NODE_NOT_FOUND_HELP');
    expect(service).not.toContain('No Node interpreter could be found');
  });
});

describe('the sidecar help names a script that is there', () => {
  it('tools/cv/setup.sh exists', () => {
    expect(existsSync(path.join(REPO_ROOT, 'tools', 'cv', 'setup.sh'))).toBe(true);
  });
});
