import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REMOTE_ASSET_PROXY_PREFIX } from '../src/app/remote-loading/constants.js';

function getConfiguredRepositories() {
  const configPath = resolve(process.cwd(), 'public/microfrontends.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const repositories = new Set();

  for (const [key, remote] of Object.entries(config.remotes ?? {})) {
    let manifestUrl;

    try {
      manifestUrl = new URL(remote.manifestUrl);
    } catch {
      throw new Error('Remote "' + key + '" has an invalid manifestUrl in microfrontends.json');
    }

    const match = manifestUrl.pathname.match(/^\/([^/]+)\/([^/]+)\/releases\//);
    if (manifestUrl.hostname !== 'github.com' || !match) {
      throw new Error('Remote "' + key + '" manifestUrl must point to a GitHub Releases URL');
    }

    repositories.add(match[1] + '/' + match[2]);
  }

  return repositories;
}

async function handleRequest(req, res, next, allowedRepositories) {
  const requestUrl = new URL(req.url ?? '/', 'http://localhost');
  if (!requestUrl.pathname.startsWith(REMOTE_ASSET_PROXY_PREFIX)) {
    next();
    return;
  }

  const relativePath = requestUrl.pathname.slice(REMOTE_ASSET_PROXY_PREFIX.length);
  const match = relativePath.match(/^([^/]+)\/([^/]+)\/releases\/(.+)$/);
  if (!match) {
    res.statusCode = 400;
    res.end('Invalid Remote release asset path');
    return;
  }

  const [, owner, repository, releasePath] = match;
  const repositoryPath = owner + '/' + repository;
  if (!allowedRepositories.has(repositoryPath)) {
    res.statusCode = 403;
    res.end('Remote repository is not configured in microfrontends.json');
    return;
  }

  if (
    releasePath.split('/').some((segment) =>
      !segment ||
      segment === '.' ||
      segment === '..' ||
      /%2f|%5c/i.test(segment)
    )
  ) {
    res.statusCode = 400;
    res.end('Invalid Remote release asset path');
    return;
  }

  const upstreamUrl = new URL(
    '/' + repositoryPath + '/releases/' + releasePath + requestUrl.search,
    'https://github.com',
  );

  try {
    // Follow GitHub's redirect to the release asset host on the server.
    const upstream = await fetch(upstreamUrl, {
      headers: { accept: req.headers.accept ?? '*/*' },
      redirect: 'follow',
    });
    const upstreamContentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
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
      body = Buffer.from(
        body.toString('utf8').replace(
          /https:\/\/github\.com\/([^/]+\/[^/]+\/releases\/)/g,
          REMOTE_ASSET_PROXY_PREFIX + '$1',
        ),
        'utf8',
      );
    }

    res.statusCode = upstream.status;
    res.setHeader('content-type', contentType);
    res.setHeader('cache-control', 'no-store');
    res.end(body);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('Remote release proxy failed: ' + error.message);
  }
}

/**
 * Vite dev/preview proxy for GitHub Release assets.
 * Allowed repositories are derived from public/microfrontends.json.
 */
export function remoteReleaseProxy() {
  const allowedRepositories = getConfiguredRepositories();
  const middleware = (req, res, next) =>
    handleRequest(req, res, next, allowedRepositories);

  return {
    name: 'remote-release-proxy',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
