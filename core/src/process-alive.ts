/**
 * Whether a pid names a process that exists.
 *
 * One home, imported by the service's lock and by the panel's CEP host. It was
 * duplicated across the two — four lines each, no test pinning them — which is
 * exactly what CLAUDE_CODE_GUIDELINES §3 forbids: a rule with more than one
 * implementation drifts, and this one decides whether a stale lock is
 * reclaimed or obeyed.
 *
 * No imports, so the panel bundles it without pulling Node into the browser
 * build.
 *
 * `kill(pid, 0)` sends no signal; it only asks whether the process exists and
 * is signallable. **EPERM means it exists and belongs to someone else**, which
 * still counts as running — reading that as dead would let a second service
 * take over a live one's lock.
 */
export interface Killer {
  (pid: number, signal: 0): void;
}

export function processAlive(pid: number, kill?: Killer): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  const send =
    kill ??
    ((globalThis as { process?: { kill?: Killer } }).process?.kill as Killer | undefined);
  // No process global at all — a browser build, or CEP without Node. Nothing
  // can be signalled, so nothing can be claimed alive.
  if (send === undefined) return false;
  try {
    send(pid, 0);
    return true;
  } catch (error) {
    return (error as { code?: string }).code === 'EPERM';
  }
}
