import path from 'node:path';

/**
 * A path the user typed, resolved against the directory they typed it in.
 *
 * npm runs a workspace script with the **workspace** as its working directory,
 * so `my files/test videos/vitasilk.editplan.json` typed at the repository root
 * arrives at `service/` and does not exist. The quoting is not the problem —
 * an argument with spaces survives both levels of `npm run … --` intact — the
 * working directory is.
 *
 * `INIT_CWD` is npm's own record of where the command was run, which is exactly
 * the question. Outside npm it is absent and the process's own directory is the
 * same thing.
 */
export function resolveUserPath(input: string): string {
  if (path.isAbsolute(input)) return input;
  return path.resolve(process.env['INIT_CWD'] ?? process.cwd(), input);
}
