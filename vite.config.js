import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { remoteReleaseProxy } from './plugins/remoteReleaseProxy.js';

function requiredEnv(env, name) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const hostPortValue = requiredEnv(env, 'HOST_PORT');
  const hostPort = Number(hostPortValue);

  if (!Number.isInteger(hostPort) || hostPort < 1 || hostPort > 65535) {
    throw new Error(`HOST_PORT must be an integer between 1 and 65535; received "${hostPortValue}"`);
  }

  const remoteReleasePrefix = requiredEnv(env, 'VITE_REMOTE_RELEASE_PREFIX');
  const remoteAssetProxyPrefix = requiredEnv(env, 'VITE_REMOTE_ASSET_PROXY_PREFIX');
  const remoteRepositoryPath = requiredEnv(env, 'REMOTE_REPOSITORY_PATH');

  return {
    plugins: [
      react(),
      federation({
        name: 'hgcAb',
        remotes: {},
        shared: {
          react: { singleton: true },
          'react-dom': { singleton: true },
        },
      }),
      remoteReleaseProxy({
        remoteReleasePrefix,
        remoteAssetProxyPrefix,
        remoteRepositoryPath,
      }),
    ],
    build: { target: 'esnext' },
    server: { port: hostPort, strictPort: true },
    preview: { port: hostPort, strictPort: true },
  };
});
