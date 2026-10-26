import { loadRemote, registerRemotes } from '@module-federation/enhanced/runtime';

const remoteManifests = new Map();
const REMOTE_RELEASE_PREFIX =
  'https://github.com/HenrikGr/consulting-opportunities/releases/';

/**
 * In local Host development, route GitHub Release requests through Vite so
 * browser CORS rules remain enabled. Deployed environments keep their URLs.
 */
export function resolveRemoteAssetUrl(url) {
  if (
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    typeof url === 'string' &&
    url.startsWith(REMOTE_RELEASE_PREFIX)
  ) {
    return url.replace(REMOTE_RELEASE_PREFIX, '/__remote_assets/releases/');
  }

  return url;
}

function validateManifest(key, manifest) {
  if (
    manifest?.schemaVersion !== 1 ||
    manifest?.remote?.key !== key ||
    !manifest?.remote?.federationName ||
    !manifest?.currentVersion?.version ||
    !manifest?.currentVersion?.entryUrl
  ) {
    throw new Error(
      `Remote manifest for "${key}" is invalid or missing its current version or entry URL`,
    );
  }

  if (
    manifest.fallbackVersion &&
    (!manifest.fallbackVersion.version || !manifest.fallbackVersion.entryUrl)
  ) {
    throw new Error(
      `Remote manifest for "${key}" contains an incomplete fallback version`,
    );
  }
}

function registerVersion(manifest, version) {
  registerRemotes(
    [
      {
        name: manifest.remote.federationName,
        entry: resolveRemoteAssetUrl(version.entryUrl),
        type: 'module',
      },
    ],
    { force: true },
  );
}

export function configureRemote(key, manifest) {
  validateManifest(key, manifest);
  remoteManifests.set(key, manifest);
  registerVersion(manifest, manifest.currentVersion);
}

export async function loadRemoteWithFallback(key, exposedModule) {
  const manifest = remoteManifests.get(key);
  if (!manifest) {
    throw new Error(`Remote "${key}" was not configured`);
  }

  const moduleName = exposedModule.startsWith('./')
    ? exposedModule.slice(2)
    : exposedModule;
  const request = `${manifest.remote.federationName}/${moduleName}`;

  try {
    return await loadRemote(request);
  } catch (currentError) {
    const fallback = manifest.fallbackVersion;
    if (!fallback?.entryUrl) {
      throw new Error(
        `Remote "${key}" version ${manifest.currentVersion.version} failed to load and no fallback version is configured`,
        { cause: currentError },
      );
    }

    console.warn(
      `[hgc-ab] Remote "${key}" version ${manifest.currentVersion.version} failed; trying fallback ${fallback.version}.`,
      currentError,
    );

    try {
      registerVersion(manifest, fallback);
      return await loadRemote(request);
    } catch (fallbackError) {
      throw new Error(
        `Remote "${key}" could not load current version ${manifest.currentVersion.version} or fallback version ${fallback.version}`,
        { cause: new AggregateError(
          [currentError, fallbackError],
          'Both current and fallback Remote versions failed',
        ) },
      );
    }
  }
}
