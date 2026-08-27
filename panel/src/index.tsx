import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { createHost, loadModes, loadReels, logoPath, repoRoot } from './host.js';

/**
 * CEP entry point. Everything host-dependent is resolved here and injected, so
 * `App` itself renders anywhere.
 */
interface CSInterfaceLike {
  getSystemPath: (type: string) => string;
}

const root = document.getElementById('root');
if (root === null) throw new Error('index.html has no #root');

const csInterface = (globalThis as { __adobe_cep__?: unknown; CSInterface?: new () => CSInterfaceLike })
  .CSInterface;
const extensionPath =
  csInterface === undefined ? '' : new csInterface().getSystemPath('extension');
const repo = repoRoot(extensionPath);

createRoot(root).render(
  <App
    host={createHost(repo)}
    loadReels={() => Promise.resolve(loadReels(repo))}
    loadModes={() => Promise.resolve(loadModes(repo))}
    logoSrc={logoPath(repo)}
  />,
);
