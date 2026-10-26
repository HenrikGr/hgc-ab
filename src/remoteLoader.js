import { loadRemote, registerRemotes } from '@module-federation/enhanced/runtime';

const remoteManifests = new Map();

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

/**
 * Force replacement is intentional: the runtime must discard the failed
 * current-version registration and its loaded-module cache before fallback.
 */
function registerVersion(manifest, version) {
  registerRemotes(
    [
      {
        name: manifest.remote.federationName,
        entry: version.entryUrl,
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
