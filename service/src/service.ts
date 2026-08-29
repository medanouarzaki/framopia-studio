/**
 * The companion service's entry point: `node service/dist/service.js`.
 *
 * A stable path the panel can spawn. `server.ts` starts itself when run as
 * main, but the panel needs a target that does not move when that file is
 * refactored, and one it can run with a bare Node binary — After Effects does
 * not inherit the user's shell, so `npm` is not on its PATH.
 *
 * Runnable from a terminal on its own, which is what diagnosing a panel that
 * cannot reach the service needs.
 */
import { clearHandshake, inspectLock } from './lock.js';
import { ServiceAlreadyRunningError, startServer } from './server.js';

const force = process.argv.includes('--force');

const lock = inspectLock();
if (lock.state === 'free' && lock.reason === 'lock names a dead process') {
  console.log('framopia-service: reclaiming a stale lock; the pid it names is not running');
}

startServer({ force })
  .then(({ port }) => {
    console.log(`framopia-service listening on 127.0.0.1:${port}`);
    const stop = (): void => {
      // Only if it is still ours: a service that lost the lock to `--force` is
      // still running, and clearing unconditionally deletes the handshake of
      // the service that took over.
      clearHandshake(undefined, process.pid);
      process.exit(0);
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  })
  .catch((error: unknown) => {
    if (error instanceof ServiceAlreadyRunningError) {
      console.error(`framopia-service: ${error.message}; pass --force to take it over`);
      process.exit(1);
    }
    console.error(error);
    process.exit(1);
  });
