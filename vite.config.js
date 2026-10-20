import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
export default defineConfig({ plugins: [react(), federation({ name: 'hostApp', remotes: {}, shared: { react: { singleton: true }, 'react-dom': { singleton: true } } })], build: { target: 'esnext' }, server: { port: 5000, strictPort: true }, preview: { port: 5000, strictPort: true } });
