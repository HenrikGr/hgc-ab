import React from 'react';
import { createRoot } from 'react-dom/client';
import { configureRemote, resolveRemoteAssetUrl } from './remoteLoader.js';
import App from './App.jsx';

async function fetchJson(url, label) {
  const resolvedUrl = resolveRemoteAssetUrl(url);
  const response = await fetch(resolvedUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`${label} request failed: ${response.status} (${resolvedUrl})`);
  }
  return response.json();
}

/**
 * Bootstrap the host from its small runtime config and each Remote's manifest.
 */
async function bootstrap() {
  const root = createRoot(document.getElementById('root'));

  try {
    const config = await fetchJson('/microfrontends.json', 'Runtime config');
    const remotes = Object.entries(config.remotes ?? {});
    if (remotes.length === 0) {
      throw new Error('Runtime config does not define any remotes');
    }

    for (const [key, remoteConfig] of remotes) {
      if (!remoteConfig.manifestUrl) {
        throw new Error(`Remote "${key}" has no manifestUrl`);
      }
      const manifest = await fetchJson(remoteConfig.manifestUrl, `Remote "${key}" manifest`);
      configureRemote(key, manifest);
    }
  } catch (error) {
    console.error('[hgc-ab] Could not initialize remote configuration', error);
    root.render(
      <main>
        <h1>hgc-ab</h1>
        <p role="alert">Runtime configuration could not be loaded. Check the console.</p>
      </main>,
    );
    return;
  }

  root.render(<App />);
}

bootstrap();
