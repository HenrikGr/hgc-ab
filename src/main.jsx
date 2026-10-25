import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerRemotes } from '@module-federation/enhanced/runtime';
import App from './App.jsx';

/**
 * Bootstrap the hgc-ab host application.
 * @returns {Promise<void>}
 */
async function bootstrap() {
  const root = createRoot(document.getElementById('root'));
  try {
    const response = await fetch('/microfrontends.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Runtime config request failed: ${response.status}`);
    }

    const config = await response.json();
    const remotes = Object.entries(config.remotes ?? {});
    if (remotes.length === 0) {
      throw new Error('Runtime manifest does not define any remotes');
    }

    const remoteBasePath = (import.meta.env.VITE_REMOTE_BASE_PATH ?? '')
      .replace(/\/+$/, '');
    const baseUrl = `${window.location.origin}${remoteBasePath}`;

    const runtimeRemotes = remotes.map(([key, remote]) => {
      const version = remote.currentVersion;
      if (!version?.tag || version.status !== 'available') {
        throw new Error(`Remote "${key}" has no available current version`);
      }

      const entryFile = `${remote.federationName}Entry.js`;
      const entryPath = `${key}/${version.tag}/${entryFile}`;
      return {
        name: remote.federationName,
        entry: `${baseUrl}/${entryPath}`,
        type: 'module',
      };
    });

    registerRemotes(runtimeRemotes);
  } catch (error) {
    console.error('[hgc-ab] Could not initialize remote configuration', error);
    root.render(
      <main>
        <h1>hgc-ab</h1>
        <p role="alert">Runtime configuration could not be loaded. Check the console.</p>
      </main>
    );
    return;
  }
  root.render(<App />);
}

bootstrap();
