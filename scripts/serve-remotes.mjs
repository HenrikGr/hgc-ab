
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const remoteRoot = path.resolve(scriptDirectory, '../tests/remotes');
const port = 5002;

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

const server = createServer(async (request, response) => {
    const url = new URL(request.url, `http://localhost:${port}`);

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405);
        response.end('Method not allowed');
        return;
    }

    let decodedPath;

    try {
        decodedPath = decodeURIComponent(url.pathname);
    } catch {
        response.writeHead(400);
        response.end('Invalid URL path');
        return;
    }

    const relativePath = decodedPath.replace(/^\/+/, '');
    const filePath = path.resolve(remoteRoot, relativePath);

    if (
        filePath !== remoteRoot &&
        !filePath.startsWith(remoteRoot + path.sep)
    ) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
    }

    try {
        await access(filePath);
        const fileStats = await stat(filePath);

        if (!fileStats.isFile()) {
            response.writeHead(404);
            response.end('Not found');
            return;
        }

        response.writeHead(200, {
            'Content-Type':
                contentTypes[path.extname(filePath).toLowerCase()] ??
                'application/octet-stream',
            'Content-Length': fileStats.size,
            'Access-Control-Allow-Origin': 'http://localhost:5000',
            'Cache-Control': 'no-store',
        });

        if (request.method === 'HEAD') {
            response.end();
            return;
        }

        createReadStream(filePath).pipe(response);
    } catch {
        response.writeHead(404);
        response.end('Not found');
    }
});

server.listen(port, '127.0.0.1', () => {
    console.log(`Remote artifact server listening on http://localhost:${port}`);
    console.log(`Serving files from ${remoteRoot}`);
});
