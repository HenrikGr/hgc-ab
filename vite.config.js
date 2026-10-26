import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

const REMOTE_RELEASE_PREFIX =
  'https://github.com/HenrikGr/consulting-opportunities/releases/';
const LOCAL_PROXY_PREFIX = '/__remote_assets/releases/';

function remoteReleaseProxy() {
  async function handleRequest(req, res, next) {
    const requestUrl = new URL(req.url ?? '/', 'http://localhost');
    if (!requestUrl.pathname.startsWith('/__remote_assets/releases/')) {
      next();
      return;
    }

    const upstreamPath = requestUrl.pathname.slice('/__remote_assets'.length);
    const upstreamUrl = new URL(
      `/HenrikGr/consulting-opportunities${upstreamPath}${requestUrl.search}`,
      'https://github.com',
    );

    try {
      // Follow GitHub's redirect to release-assets.githubusercontent.com on the server,
      // so the browser only ever requests assets from the Host origin.
      const upstream = await fetch(upstreamUrl, {
        headers: { accept: req.headers.accept ?? '*/*' },
        redirect: 'follow',
      });
      const upstreamContentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
      // GitHub release downloads may be served as application/octet-stream even when
      // the asset is JavaScript. Browsers require a JavaScript MIME type for module scripts.
      const contentType = upstreamUrl.pathname.endsWith('.js')
        ? 'text/javascript; charset=utf-8'
        : upstreamUrl.pathname.endsWith('.json')
          ? 'application/json; charset=utf-8'
          : upstreamContentType;
      let body = Buffer.from(await upstream.arrayBuffer());

      if (
        contentType.includes('javascript') ||
        contentType.includes('json') ||
        upstreamUrl.pathname.endsWith('.js') ||
        upstreamUrl.pathname.endsWith('.json')
      ) {
        const text = body.toString('utf8').replaceAll(
          REMOTE_RELEASE_PREFIX,
          LOCAL_PROXY_PREFIX,
        );
        body = Buffer.from(text, 'utf8');
      }

      res.statusCode = upstream.status;
      res.setHeader('content-type', contentType);
      res.setHeader('cache-control', 'no-store');
      res.end(body);
    } catch (error) {
      res.statusCode = 502;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end(`Remote release proxy failed: ${error.message}`);
    }
  }

  return {
    name: 'remote-release-proxy',
    configureServer(server) {
      server.middlewares.use(handleRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleRequest);
    },
  };
}

export default defineConfig({
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
    remoteReleaseProxy(),
  ],
  build: { target: 'esnext' },
  server: { port: 5000, strictPort: true },
  preview: { port: 5000, strictPort: true },
});
