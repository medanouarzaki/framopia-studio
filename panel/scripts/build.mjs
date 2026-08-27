/**
 * esbuild, not Vite: CEP loads the panel from a file:// URL inside its own
 * Chromium, so there is no dev server to attach to and no module graph the
 * host will resolve. What is needed is one IIFE bundle and one stylesheet on
 * disk, which is esbuild's default output and Vite's special case. It is also
 * a single dependency with no config file and a watch that rebuilds in
 * milliseconds, which matters when the reload is "close and reopen a panel in
 * After Effects".
 */
import { context, build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PANEL = path.resolve(HERE, '..');
const OUT = path.join(PANEL, 'dist');
const watch = process.argv.includes('--watch');

mkdirSync(OUT, { recursive: true });

const options = {
  entryPoints: [path.join(PANEL, 'src', 'index.tsx')],
  bundle: true,
  format: 'iife',
  target: ['chrome99'],
  outfile: path.join(OUT, 'panel.js'),
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  logLevel: 'info',
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
};

function copyStatic() {
  copyFileSync(path.join(PANEL, 'index.html'), path.join(OUT, 'index.html'));
  copyFileSync(path.join(PANEL, 'src', 'panel.css'), path.join(OUT, 'panel.css'));
}

copyStatic();

if (watch) {
  const ctx = await context({
    ...options,
    plugins: [
      {
        name: 'copy-static',
        setup(b) {
          b.onEnd(copyStatic);
        },
      },
    ],
  });
  await ctx.watch();
  console.log('panel: watching src/, writing to panel/dist');
} else {
  await build(options);
  console.log('panel: built to panel/dist');
}
