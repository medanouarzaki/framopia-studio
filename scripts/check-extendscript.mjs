/**
 * Every `.jsx` in this repository, parsed before it can reach After Effects.
 *
 * `tools/ae/measure-fonts.jsx` was handed to the user with `short` and `long`
 * as object keys. ExtendScript rejects them — its reserved-word list is Java's,
 * not modern JavaScript's — so the script died at the parse and measured
 * nothing. **A syntax error needs no After Effects to catch**, and nothing in
 * this repo was looking: `.jsx` is not TypeScript, eslint is pointed at `src`,
 * and no test opens these files.
 *
 * Three checks, in the order a parser would hit them:
 *
 * 1. **Syntax**, through Node's own parser. This catches unbalanced braces and
 *    the like. It is deliberately not the whole answer — Node accepts far more
 *    than ExtendScript does, which is exactly how the reserved words got past.
 * 2. **ExtendScript's reserved words**, which are illegal as identifiers, as
 *    property names after a dot, and as unquoted object keys. Since strings and
 *    comments are stripped first, *any* bare occurrence is an error; a quoted
 *    key is legal and survives stripping as a string.
 * 3. **Post-ES3 syntax**, because ExtendScript is ES3: `const`, `let`, arrow
 *    functions, `class`, template literals, spread, `async`/`await`, `for…of`.
 *
 * What it deliberately does **not** check is runtime methods. `JSON.stringify`
 * is absent from ExtendScript and present in every one of these files, because
 * `panel/jsx/json2.jsx` installs it; a gate that flagged that would be wrong
 * about the only thing it could see.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.venv', '.local']);

/**
 * ExtendScript inherits Java's reserved words on top of JavaScript's. Every one
 * of these is rejected as an identifier, and `short` and `long` are the two
 * that read most like ordinary field names — which is how they were written.
 */
export const EXTENDSCRIPT_RESERVED = [
  'abstract', 'boolean', 'byte', 'char', 'class', 'double', 'enum', 'export',
  'extends', 'final', 'float', 'goto', 'implements', 'import', 'int',
  'interface', 'long', 'native', 'package', 'private', 'protected', 'public',
  'short', 'static', 'super', 'synchronized', 'throws', 'transient',
  'volatile',
];

const POST_ES3 = [
  { re: /\bconst\s+[A-Za-z_$]/, what: 'const' },
  { re: /\blet\s+[A-Za-z_$]/, what: 'let' },
  { re: /=>/, what: 'arrow function' },
  { re: /`/, what: 'template literal' },
  { re: /\.\.\./, what: 'spread or rest' },
  { re: /\basync\s+function\b/, what: 'async function' },
  { re: /\bawait\s+/, what: 'await' },
  { re: /\bfor\s*\([^;)]*\bof\b/, what: 'for…of' },
];

/**
 * Comments and string literals replaced by spaces, keeping every byte offset so
 * a line number stays true.
 *
 * The `/` ambiguity is the usual one: a regex literal and a division share a
 * character, and the only way to tell without parsing is what came before it.
 * After a value — an identifier, a number, a closing bracket — it divides;
 * anywhere else it opens a regex.
 */
export function stripCommentsAndStrings(source) {
  let out = '';
  let i = 0;
  let lastSignificant = '';
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];

    if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      out += blank(source.slice(i, stop));
      i = stop;
      continue;
    }
    if (c === '/' && next === '/') {
      let stop = source.indexOf('\n', i);
      if (stop === -1) stop = source.length;
      out += blank(source.slice(i, stop));
      i = stop;
      continue;
    }
    if (c === '"' || c === "'") {
      const stop = endOfString(source, i, c);
      out += blank(source.slice(i, stop));
      i = stop;
      lastSignificant = 'x';
      continue;
    }
    if (c === '/' && !/[A-Za-z0-9_$)\]]/.test(lastSignificant)) {
      const stop = endOfRegex(source, i);
      if (stop > i) {
        out += blank(source.slice(i, stop));
        i = stop;
        lastSignificant = 'x';
        continue;
      }
    }
    out += c;
    if (!/\s/.test(c)) lastSignificant = c;
    i += 1;
  }
  return out;
}

/** Newlines survive so line numbers do; everything else becomes a space. */
function blank(text) {
  return text.replace(/[^\n]/g, ' ');
}

function endOfString(source, start, quote) {
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source[i] === quote) return i + 1;
    if (source[i] === '\n') return i;
    i += 1;
  }
  return source.length;
}

function endOfRegex(source, start) {
  let i = start + 1;
  let inClass = false;
  while (i < source.length) {
    const c = source[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '\n') return start;
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) {
      i += 1;
      while (i < source.length && /[a-z]/.test(source[i])) i += 1;
      return i;
    }
    i += 1;
  }
  return start;
}

export function findProblems(source) {
  const problems = [];

  try {
    // Node's parser, not ExtendScript's. It catches structural errors; the
    // reserved-word scan below catches what it is happy to accept.
    new Function(source);
  } catch (error) {
    problems.push({ line: null, what: 'syntax', detail: String(error.message) });
  }

  const stripped = stripCommentsAndStrings(source);
  const lines = stripped.split('\n');
  const reserved = new RegExp(`\\b(${EXTENDSCRIPT_RESERVED.join('|')})\\b`, 'g');

  lines.forEach((line, index) => {
    let match;
    reserved.lastIndex = 0;
    while ((match = reserved.exec(line)) !== null) {
      problems.push({
        line: index + 1,
        what: 'reserved word',
        detail: `"${match[1]}" is reserved in ExtendScript and cannot be an identifier, a property name after a dot, or an unquoted object key`,
      });
    }
    for (const rule of POST_ES3) {
      if (rule.re.test(line)) {
        problems.push({
          line: index + 1,
          what: 'not ES3',
          detail: `${rule.what} — ExtendScript is ES3`,
        });
      }
    }
  });

  return problems;
}

function jsxFiles(dir, found) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) jsxFiles(full, found);
    else if (entry.name.endsWith('.jsx') && statSync(full).isFile()) found.push(full);
  }
  return found;
}

export function checkAll(root = REPO_ROOT) {
  const files = jsxFiles(root, []).sort();
  const failures = [];
  for (const file of files) {
    const problems = findProblems(readFileSync(file, 'utf8'));
    if (problems.length > 0) failures.push({ file: path.relative(root, file), problems });
  }
  return { files: files.map((f) => path.relative(root, f)), failures };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const only = process.argv[2];
  const { files, failures } = only
    ? (() => {
        const problems = findProblems(readFileSync(only, 'utf8'));
        return {
          files: [only],
          failures: problems.length > 0 ? [{ file: only, problems }] : [],
        };
      })()
    : checkAll();

  for (const failure of failures) {
    for (const problem of failure.problems) {
      console.error(
        `${failure.file}:${problem.line ?? '?'}: ${problem.what}: ${problem.detail}`,
      );
    }
  }
  if (failures.length > 0) {
    console.error(`extendscript: ${failures.length} of ${files.length} file(s) would not parse`);
    process.exit(1);
  }
  console.log(`extendscript: ${files.length} .jsx file(s) ok`);
}
