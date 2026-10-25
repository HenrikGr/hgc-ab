import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import path from 'node:path';
import { remoteFilesPlugin } from './scripts/vite-remote-files-plugin.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const remoteRoot = path.resolve(
    process.cwd(),
    env.REMOTE_ARTIFACTS_DIR || 'tests/remotes',
  );
  const remoteBasePath = env.VITE_REMOTE_BASE_PATH || '/__remotes';
  const port = Number(env.HOST_PORT || 5000);

  return {
    plugins: [
      react(),
      remoteFilesPlugin({
        remoteRoot,
        basePath: remoteBasePath,
      }),
      federation({
        name: 'hgcAb',
        remotes: {},
        shared: {
          react: { singleton: true },
          'react-dom': { singleton: true },
        },
      }),
    ],
    build: { target: 'esnext' },
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
  };
});
