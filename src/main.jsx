import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerRemotes } from '@module-federation/enhanced/runtime';
import App from './App.jsx';

/**
 * Bootstrap
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
    if (!config.remoteApp) {
      throw new Error('Runtime config is missing remoteApp');
    }

    registerRemotes([{
      name: 'remoteApp',
      entry: config.remoteApp,
      type: 'module' // Load as esm module
    }]);

  } catch (error) {
    console.error('[Host platform] Could not initialize Remote config', error);
    root.render(<main><h1>Host PoC</h1><p role="alert">Runtime configuration could not be loaded. Check the console.</p></main>); return;
  }
  root.render(<App />);
}
bootstrap();
