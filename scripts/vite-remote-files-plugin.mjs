import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';

const contentTypes = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function normalizeBasePath(value) {
  const trimmed = (value || '/__remotes').trim();
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '') || '/';
}

export function remoteFilesPlugin({ remoteRoot, basePath = '/__remotes' }) {
  const routePrefix = normalizeBasePath(basePath);

  return {
    name: 'local-remote-files',
    apply: 'serve',

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        let pathname;

        try {
          pathname = new URL(req.url || '/', 'http://localhost').pathname;
        } catch {
          res.statusCode = 400;
          res.end('Invalid URL');
          return;
        }

        if (pathname !== routePrefix && !pathname.startsWith(`${routePrefix}/`)) {
          next();
          return;
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        let relativePath;
        try {
          relativePath = decodeURIComponent(pathname.slice(routePrefix.length))
            .replace(/^\/+/, '');
        } catch {
          res.statusCode = 400;
          res.end('Invalid URL path');
          return;
        }

        const filePath = path.resolve(remoteRoot, relativePath);
        if (
          !relativePath ||
          filePath === remoteRoot ||
          !filePath.startsWith(remoteRoot + path.sep)
        ) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        try {
          await access(filePath);
          const fileStats = await stat(filePath);

          if (!fileStats.isFile()) {
            res.statusCode = 404;
            res.end('Not found');
            return;
          }

          res.writeHead(200, {
            'Content-Type':
              contentTypes[path.extname(filePath).toLowerCase()] ??
              'application/octet-stream',
            'Content-Length': fileStats.size,
            'Cache-Control': 'no-store',
          });

          if (req.method === 'HEAD') {
            res.end();
            return;
          }

          const stream = createReadStream(filePath);
          stream.on('error', (error) => {
            if (!res.headersSent) res.statusCode = 500;
            res.destroy(error);
          });
          stream.pipe(res);
        } catch {
          res.statusCode = 404;
          res.end('Not found');
        }
      });
    },
  };
}
