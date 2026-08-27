import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { detectHost } from './host.js';

/**
 * CEP entry point.
 *
 * **Nothing here may throw.** There is no error surface before React mounts, so
 * anything thrown at module load reaches the user as a blank panel.
 *
 * `detectHost` is passed rather than called: Retry re-runs it, so a panel that
 * started before the service was built can recover without being reloaded.
 */
const root = document.getElementById('root');

if (root === null) {
  const fallback = document.createElement('pre');
  fallback.textContent =
    'Framopia Studio could not start: index.html has no #root element. The panel bundle is ' +
    'probably out of date — run `npm run panel:build`.';
  fallback.style.cssText = 'padding:16px;color:#ed1c24;font:12px ui-monospace,monospace';
  document.body.appendChild(fallback);
} else {
  createRoot(root).render(<App detect={detectHost} />);
}
