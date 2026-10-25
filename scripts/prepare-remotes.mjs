import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
   access,
   cp,
   mkdir,
   mkdtemp,
   readdir,
   readFile,
   rm,
   writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, '..');
const manifestPath = path.join(projectDirectory, 'tests', 'remote-manifest.json');
const token = process.env.GH_TOKEN;

const headers = {
   Accept: 'application/vnd.github+json',
   ...(token ? { Authorization: `Bearer ${token}` } : {}),
   'X-GitHub-Api-Version': '2022-11-28',
};

async function githubJson(url) {
   const response = await fetch(url, { headers });

   if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status} for ${url}`);
   }

   return response.json();
}

async function listAll(url) {
   const items = [];

   for (let page = 1; ; page += 1) {
      const separator = url.includes('?') ? '&' : '?';
      const pageItems = await githubJson(`${url}${separator}per_page=100&page=${page}`);
      if (!Array.isArray(pageItems) || pageItems.length === 0) {
         break;
      }

      items.push(...pageItems);
      if (pageItems.length < 100) {
         break;
      }
   }

   return items;
}

function parseStableVersion(tagName) {
   const match = tagName.match(/^v?(0|[1-9]\d*)\\.(0|[1-9]\d*)\\.(0|[1-9]\d*)$/);
   return match ? match.slice(1).map(Number) : null;
}

function compareVersions(left, right) {
   const a = parseStableVersion(left);
   const b = parseStableVersion(right);

   for (let index = 0; index < 3; index += 1) {
      if (a[index] !== b[index]) {
         return b[index] - a[index];
      }
   }

   return 0;
}

async function findArtifact(repository, version) {
   const expectedName = `remote-${version.replace(/^v/, '')}`;
   const artifacts = [];

   for (let page = 1; ; page += 1) {
      const data = await githubJson(
         `https://api.github.com/repos/${repository}/actions/artifacts?per_page=100&page=${page}`,
      );
      const pageArtifacts = data.artifacts ?? [];
      artifacts.push(...pageArtifacts);

      if (pageArtifacts.length < 100) {
         break;
      }
   }

   return artifacts
      .filter((artifact) => artifact.name === expectedName && !artifact.expired)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

async function downloadArtifact(repository, artifact, destination) {
   const url = `https://api.github.com/repos/${repository}/actions/artifacts/${artifact.id}/zip`;
   const response = await fetch(url, { headers });

   if (!response.ok) {
      throw new Error(`Artifact download returned ${response.status} for ${artifact.name}`);
   }

   await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

async function findFiles(directory, predicate, results = []) {
   const entries = await readdir(directory, { withFileTypes: true });

   for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
         await findFiles(fullPath, predicate, results);
      } else if (predicate(entry.name)) {
         results.push(fullPath);
      }
   }

   return results;
}

async function installVersion(remoteKey, remote, versionInfo) {
   const version = versionInfo.tag;
   if (!version) {
      versionInfo.status = 'missing';
      versionInfo.error = 'No matching stable Git tag was found.';
      return;
   }

   const repository = remote.repository;
   let temporaryDirectory;

   try {
      if (!token) {
         throw new Error('GH_TOKEN is required to download private GitHub Actions artifacts.');
      }

      const artifact = await findArtifact(repository, version);
      if (!artifact) {
         throw new Error(`No unexpired Actions artifact named "remote-${version.replace(/^v/, '')}" was found.`);
      }

      temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'prepare-remote-'));
      const artifactZip = path.join(temporaryDirectory, 'actions-artifact.zip');
      const artifactContents = path.join(temporaryDirectory, 'artifact');
      const extractedContents = path.join(temporaryDirectory, 'extracted');

      await downloadArtifact(repository, artifact, artifactZip);
      await mkdir(artifactContents, { recursive: true });
      await execFileAsync('unzip', ['-q', artifactZip, '-d', artifactContents]);

      const nestedZips = await findFiles(artifactContents, (name) => name.endsWith('.zip'));
      if (nestedZips.length === 0) {
         throw new Error('The Actions artifact did not contain a remote ZIP archive.');
      }

      await mkdir(extractedContents, { recursive: true });
      for (const [index, zipFile] of nestedZips.entries()) {
         const destination = path.join(extractedContents, String(index));
         await mkdir(destination, { recursive: true });
         await execFileAsync('unzip', ['-q', zipFile, '-d', destination]);
      }

      const entryFileName = `${remote.federationName}Entry.js`;
      const entryFiles = await findFiles(
         extractedContents,
         (name) => name === entryFileName,
      );
      if (entryFiles.length === 0) {
         throw new Error(`Expected federation entry "${entryFileName}" was not found in the downloaded artifact.`);
      }

      const entryFile = entryFiles[0];
      const sourceDirectory = path.dirname(entryFile);
      const relativeDestination = path.join(
         'remotes',
         remoteKey,
         version.replace(/^v/, ''),
      );
      const destinationDirectory = path.join(projectDirectory, 'tests', relativeDestination);

      await rm(destinationDirectory, { recursive: true, force: true });
      await mkdir(path.dirname(destinationDirectory), { recursive: true });
      await cp(sourceDirectory, destinationDirectory, { recursive: true });

      // Verify the entry file remains present after installation.
      await access(path.join(destinationDirectory, entryFileName));

      versionInfo.status = 'available';
      versionInfo.artifactPath = path.relative(projectDirectory, destinationDirectory).split(path.sep).join('/');
      versionInfo.error = null;
      console.log(`Prepared ${remoteKey}@${version} in ${versionInfo.artifactPath}`);
   } catch (error) {
      versionInfo.status = 'download_failed';
      versionInfo.artifactPath = null;
      versionInfo.error = error instanceof Error ? error.message : String(error);
      console.error(`Could not prepare ${remoteKey}@${version}: ${versionInfo.error}`);
   } finally {
      if (temporaryDirectory) {
         await rm(temporaryDirectory, { recursive: true, force: true });
      }
   }
}

async function prepareRemote(remoteKey, remote, errors) {
   remote.currentVersion = {
      tag: null,
      status: 'unavailable',
      artifactPath: null,
      error: null,
   };
   remote.fallbackVersion = {
      tag: null,
      status: 'missing',
      artifactPath: null,
      error: null,
   };

   let tags;
   try {
      tags = await listAll(`https://api.github.com/repos/${remote.repository}/tags`);
   } catch (error) {
      remote.currentVersion.error = error instanceof Error ? error.message : String(error);
      remote.fallbackVersion.error = 'Version discovery failed; no fallback version could be selected.';
      errors.push({
         remote: remoteKey,
         code: 'TAG_LOOKUP_FAILED',
         message: remote.currentVersion.error,
      });
      return;
   }

   const versions = tags
      .map((tag) => tag.name)
      .filter((tag) => parseStableVersion(tag))
      .sort(compareVersions);

   if (versions.length === 0) {
      remote.currentVersion.status = 'missing';
      remote.currentVersion.error = 'No stable semantic-version Git tags were found.';
      remote.fallbackVersion.error = 'No fallback version can be selected without stable tags.';
      errors.push({
         remote: remoteKey,
         code: 'NO_STABLE_TAGS',
         message: remote.currentVersion.error,
      });
      return;
   }

   remote.currentVersion.tag = versions[0].replace(/^v/, '');
   remote.currentVersion.status = 'pending';
   remote.fallbackVersion.tag = versions[1] ? versions[1].replace(/^v/, '') : null;
   remote.fallbackVersion.status = versions[1] ? 'pending' : 'missing';
   if (!versions[1]) {
      remote.fallbackVersion.error = 'No older stable Git tag is available as a fallback.';
      errors.push({
         remote: remoteKey,
         code: 'FALLBACK_NOT_FOUND',
         message: remote.fallbackVersion.error,
      });
   }

   await installVersion(remoteKey, remote, remote.currentVersion);
   if (remote.fallbackVersion.tag) {
      await installVersion(remoteKey, remote, remote.fallbackVersion);
   }

   for (const [versionName, versionInfo] of [
      ['currentVersion', remote.currentVersion],
      ['fallbackVersion', remote.fallbackVersion],
   ]) {
      if (versionInfo.status !== 'available') {
         errors.push({
            remote: remoteKey,
            code: versionInfo.status === 'missing' ? 'VERSION_NOT_FOUND' : 'ARTIFACT_UNAVAILABLE',
            versionField: versionName,
            tag: versionInfo.tag,
            message: versionInfo.error,
         });
      }
   }
}

async function main() {
   let manifest;
   try {
      manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
   } catch (error) {
      console.error(`Could not read manifest at ${manifestPath}: ${error.message}`);
      process.exitCode = 1;
      return;
   }

   const errors = [];
   for (const [remoteKey, remote] of Object.entries(manifest.remotes ?? {})) {
      await prepareRemote(remoteKey, remote, errors);
   }

   manifest.prepareStatus = errors.length === 0
      ? 'ready'
      : Object.values(manifest.remotes ?? {}).some((remote) =>
         remote.currentVersion?.status === 'available' ||
         remote.fallbackVersion?.status === 'available')
         ? 'partial'
         : 'failed';
   manifest.errors = errors;
   manifest.preparedAt = new Date().toISOString();

   await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
   console.log(`Updated manifest: ${path.relative(projectDirectory, manifestPath)} (${manifest.prepareStatus})`);

   if (manifest.prepareStatus !== 'ready') {
      process.exitCode = 1;
   }
}

await main();
