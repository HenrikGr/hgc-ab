async function handleRequest(req, res, next, config) {
  const requestUrl = new URL(req.url ?? '/', 'http://localhost');
  if (!requestUrl.pathname.startsWith(config.remoteAssetProxyPrefix)) {
    next();
    return;
  }

  const upstreamPath = requestUrl.pathname.slice(config.remoteAssetProxyPrefix.length - 1);
  const upstreamUrl = new URL(
    `${config.remoteRepositoryPath}/releases/${upstreamPath.replace(/^releases\//, '')}${requestUrl.search}`,
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
        body.toString('utf8').replaceAll(config.remoteReleasePrefix, config.remoteAssetProxyPrefix),
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
export function remoteReleaseProxy(config) {
  for (const name of ['remoteReleasePrefix', 'remoteAssetProxyPrefix', 'remoteRepositoryPath']) {
    if (typeof config?.[name] !== 'string' || config[name].trim() === '') {
      throw new Error(`Missing required remote release proxy configuration: ${name}`);
    }
  }

  const configured = {
    remoteReleasePrefix: config.remoteReleasePrefix,
    remoteAssetProxyPrefix: config.remoteAssetProxyPrefix,
    remoteRepositoryPath: config.remoteRepositoryPath,
  };

  const middleware = (req, res, next) => handleRequest(req, res, next, configured);

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
