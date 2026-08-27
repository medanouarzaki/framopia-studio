/**
 * What CEP's browser engine can actually do.
 *
 * **CEP 12, as shipped with After Effects 2026, runs Chromium 99.0.4844.84.**
 * Read off the machine, twice: the running `CEPHtmlEngine` process carries
 * `--user-agent-product=Chrome/99.0.4844.84`, and the bundled
 * `Chromium Embedded Framework.framework` declares
 * `CFBundleShortVersionString = 99.2.15.0`.
 *
 * That is roughly three years behind the Chromium a current Playwright ships,
 * so **the headless check is more capable than production**. It certified a
 * container-query layout that CEP silently ignored, and the panel rendered one
 * column at 1572 px. The denylist below is asserted against the built bundle so
 * the gate is the thing that decides, not anyone's memory of a feature table.
 *
 * A feature belongs here when the panel could plausibly reach for it and CEP
 * would not honour it. It is a denylist rather than an allowlist because the
 * web platform is open-ended: enumerating everything Chromium 99 *can* do would
 * be a bigger claim than this file can support, while each entry below is a
 * specific, checkable fact.
 */
export const CEP_CHROMIUM_VERSION = '99.0.4844.84';
export const CEP_CHROMIUM_MAJOR = 99;

export interface UnsupportedFeature {
  /** What to look for in the built output. */
  pattern: RegExp;
  name: string;
  /** The Chrome version it shipped in, which is later than CEP's. */
  shippedIn: number;
  /** What CEP does when it meets it. */
  behaviour: 'ignored silently' | 'throws' | 'wrong result';
  where: 'css' | 'js';
}

/**
 * CSS first, because it is the dangerous half: an unknown property or at-rule
 * is **dropped without a word**, which looks exactly like a layout bug.
 * JavaScript at least tends to throw.
 */
export const CEP_UNSUPPORTED: UnsupportedFeature[] = [
  { pattern: /@container\b/, name: 'CSS container queries (@container)', shippedIn: 105, behaviour: 'ignored silently', where: 'css' },
  { pattern: /container-type\s*:/, name: 'CSS container-type', shippedIn: 105, behaviour: 'ignored silently', where: 'css' },
  { pattern: /container-name\s*:/, name: 'CSS container-name', shippedIn: 105, behaviour: 'ignored silently', where: 'css' },
  { pattern: /:has\(/, name: 'CSS :has()', shippedIn: 105, behaviour: 'ignored silently', where: 'css' },
  { pattern: /@scope\b/, name: 'CSS @scope', shippedIn: 118, behaviour: 'ignored silently', where: 'css' },
  { pattern: /color-mix\(/, name: 'CSS color-mix()', shippedIn: 111, behaviour: 'ignored silently', where: 'css' },
  { pattern: /text-wrap\s*:\s*(balance|pretty)/, name: 'CSS text-wrap: balance', shippedIn: 114, behaviour: 'ignored silently', where: 'css' },
  { pattern: /\bObject\.groupBy\b/, name: 'Object.groupBy', shippedIn: 117, behaviour: 'throws', where: 'js' },
  { pattern: /\bArray\.fromAsync\b/, name: 'Array.fromAsync', shippedIn: 121, behaviour: 'throws', where: 'js' },
  { pattern: /\.toSorted\(/, name: 'Array.prototype.toSorted', shippedIn: 110, behaviour: 'throws', where: 'js' },
  { pattern: /\.toReversed\(/, name: 'Array.prototype.toReversed', shippedIn: 110, behaviour: 'throws', where: 'js' },
  { pattern: /\.toSpliced\(/, name: 'Array.prototype.toSpliced', shippedIn: 110, behaviour: 'throws', where: 'js' },
  { pattern: /\bAbortSignal\.timeout\b/, name: 'AbortSignal.timeout', shippedIn: 103, behaviour: 'throws', where: 'js' },
  { pattern: /\bnavigator\.getAutoplayPolicy\b/, name: 'navigator.getAutoplayPolicy', shippedIn: 110, behaviour: 'throws', where: 'js' },
  { pattern: /\bURL\.canParse\b/, name: 'URL.canParse', shippedIn: 120, behaviour: 'throws', where: 'js' },
];

/**
 * Comments are stripped before scanning. This file's own explanation names
 * `@container`, and so does the stylesheet's — a gate that flagged the note
 * describing why the feature was removed would be unusable.
 */
export function stripComments(source: string, where: 'css' | 'js'): string {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return where === 'js' ? withoutBlocks.replace(/^\s*\/\/.*$/gm, '') : withoutBlocks;
}

export interface CapabilityFinding {
  name: string;
  shippedIn: number;
  behaviour: string;
  line: number;
}

export function findUnsupported(source: string, where: 'css' | 'js'): CapabilityFinding[] {
  const text = stripComments(source, where);
  const findings: CapabilityFinding[] = [];
  for (const feature of CEP_UNSUPPORTED) {
    if (feature.where !== where) continue;
    const match = feature.pattern.exec(text);
    if (match === null) continue;
    findings.push({
      name: feature.name,
      shippedIn: feature.shippedIn,
      behaviour: feature.behaviour,
      line: text.slice(0, match.index).split('\n').length,
    });
  }
  return findings;
}
