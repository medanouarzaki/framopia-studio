import { readFileSync } from 'node:fs';
import { ROOT_PACKAGE_JSON } from './paths.js';

/**
 * Read from the root package.json rather than passed in by a caller, so
 * `meta.appVersion` in an Edit Plan is always the version that produced it.
 */
export function appVersion(packageJsonPath = ROOT_PACKAGE_JSON): string {
  const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: unknown };
  if (typeof parsed.version !== 'string' || parsed.version.length === 0) {
    throw new Error(`${packageJsonPath} has no version field`);
  }
  return parsed.version;
}
