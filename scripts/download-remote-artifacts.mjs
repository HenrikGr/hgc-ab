
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readdir, rm, copyFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, '..');
const outputDirectory = path.join(projectDirectory, 'local-remotes');

const repository = 'HenrikGr/consulting-opportunities';
const token = process.env.GH_TOKEN;

const versions = process.argv.slice(2);

if (!token) {
    console.error('Missing GH_TOKEN environment variable.');
    process.exit(1);
}

if (versions.length === 0) {
    console.error(
        'Usage: node scripts/download-remote-artifacts.mjs 1.0.0 [1.0.1 ...]',
    );
    process.exit(1);
}

for (const version of versions) {
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
        console.error(`Invalid stable SemVer version: ${version}`);
        process.exit(1);
    }
}

async function githubRequest(url) {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });

    if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}: ${url}`);
    }

    return response;
}

async function findArtifact(version) {
    const expectedName = `remote-${version}`;
    const url =
        `https://api.github.com/repos/${repository}/actions/artifacts?per_page=100`;

    const response = await githubRequest(url);
    const data = await response.json();

    const matches = data.artifacts
        .filter((artifact) => artifact.name === expectedName && !artifact.expired)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

    if (matches.length === 0) {
        throw new Error(
            `No unexpired Actions artifact named "${expectedName}" was found.`,
        );
    }

    if (matches.length > 1) {
        console.warn(
            `Found multiple artifacts named ${expectedName}; using the newest one.`,
        );
    }

    return matches[0];
}

async function downloadArtifact(artifact, destination) {
    const url =
        `https://api.github.com/repos/${repository}/actions/artifacts/` +
        `${artifact.id}/zip`;

    const response = await githubRequest(url);
    const buffer = Buffer.from(await response.arrayBuffer());

    await import('node:fs/promises').then(({ writeFile }) =>
        writeFile(destination, buffer),
    );
}

async function unzip(zipFile, destination) {
    await mkdir(destination, { recursive: true });
    await execFileAsync('unzip', ['-q', zipFile, '-d', destination]);
}

async function findZip(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const zipFiles = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.zip'))
        .map((entry) => path.join(directory, entry.name));

    if (zipFiles.length !== 1) {
        throw new Error(
            `Expected exactly one ZIP file in ${directory}, found ${zipFiles.length}.`,
        );
    }

    return zipFiles[0];
}

async function installVersion(version) {
    const artifact = await findArtifact(version);
    const temporaryDirectory = await mkdtemp(
        path.join(os.tmpdir(), `remote-${version}-`),
    );

    try {
        console.log(`Downloading Remote ${version} from GitHub Actions...`);

        const artifactZip = path.join(temporaryDirectory, 'actions-artifact.zip');
        const artifactContents = path.join(temporaryDirectory, 'artifact');
        const releaseContents = path.join(temporaryDirectory, 'release');

        await downloadArtifact(artifact, artifactZip);
        await unzip(artifactZip, artifactContents);

        const remoteZip = await findZip(artifactContents);
        await unzip(remoteZip, releaseContents);

        const sourceDirectory = path.join(
            releaseContents,
            'remotes',
            'remoteApp',
            version,
        );

        const destinationDirectory = path.join(
            outputDirectory,
            'remotes',
            'remoteApp',
            version,
        );

        const { access, stat } = await import('node:fs/promises');

        await access(path.join(sourceDirectory, 'remoteEntry.js'));

        const sourceStats = await stat(sourceDirectory);
        if (!sourceStats.isDirectory()) {
            throw new Error(`Remote artifact path is not a directory: ${sourceDirectory}`);
        }

        await rm(destinationDirectory, { recursive: true, force: true });
        await mkdir(destinationDirectory, { recursive: true });

        const { cp } = await import('node:fs/promises');
        await cp(sourceDirectory, destinationDirectory, { recursive: true });

        console.log(`Installed Remote ${version} at ${destinationDirectory}`);
    } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
    }
}

try {
    for (const version of versions) {
        await installVersion(version);
    }

    console.log('All requested Remote versions are ready.');
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
