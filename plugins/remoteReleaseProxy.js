const REMOTE_RELEASE_PREFIX = 'https://github.com/HenrikGr/consulting-opportunities/releases/';
const LOCAL_PROXY_PREFIX = '/__remote_assets/releases/';
const PROXY_PATH_PREFIX = '/__remote_assets';
const UPSTREAM_REPOSITORY_PATH = '/HenrikGr/consulting-opportunities';

async function handleRequest(req, res, next) {
  const requestUrl = new URL(req.url ?? '/', 'http://localhost');
  if (!requestUrl.pathname.startsWith(LOCAL_PROXY_PREFIX)) {
    next();
    return;
  }

  const upstreamPath = requestUrl.pathname.slice(PROXY_PATH_PREFIX.length);
  const upstreamUrl = new URL(
    `${UPSTREAM_REPOSITORY_PATH}${upstreamPath}${requestUrl.search}`,
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

    if (contentType.includes('javascript') || contentType.includes('json') ||
        upstreamUrl.pathname.endsWith('.js') || upstreamUrl.pathname.endsWith('.json')) {
      body = Buffer.from(
        body.toString('utf8').replaceAll(REMOTE_RELEASE_PREFIX, LOCAL_PROXY_PREFIX),
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
    res.end(`Remote release proxy failed: ${error.message}`);
  }
}

/** Vite dev/preview proxy for assets published in the Remote's GitHub Releases. */
export function remoteReleaseProxy() {
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
