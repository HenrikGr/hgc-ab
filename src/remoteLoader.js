import { loadRemote, registerRemotes } from '@module-federation/enhanced/runtime';

const remoteManifests = new Map();

function validateManifest(key, manifest) {
  if (
    manifest?.schemaVersion !== 1 ||
    manifest?.remote?.key !== key ||
    !manifest?.remote?.federationName ||
    !manifest?.currentVersion?.entryUrl
  ) {
    throw new Error(`Remote manifest for "${key}" is invalid or missing its current entry URL`);
  }
}

function registerVersion(manifest, version) {
  registerRemotes(
    [{
      name: manifest.remote.federationName,
      entry: version.entryUrl,
      type: 'module',
    }],
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

  const request = `${manifest.remote.federationName}/${(exposedModule.startsWith('./') ? exposedModule.slice(2) : exposedModule)}`;

  try {
    return await loadRemote(request);
  } catch (currentError) {
    const fallback = manifest.fallbackVersion;
    if (!fallback?.entryUrl) {
      throw currentError;
    }

    console.warn(
      `[hgc-ab] Remote "${key}" version ${manifest.currentVersion.version} failed; trying fallback ${fallback.version}.`,
      currentError,
    );

    registerVersion(manifest, fallback);
    return loadRemote(request);
  }
}
