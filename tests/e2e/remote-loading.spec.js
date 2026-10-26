import { test, expect } from '@playwright/test';

const releaseEntryUrl = (version) =>
    `https://github.com/HenrikGr/consulting-opportunities/releases/download/v${version}/consultingOpportunitiesEntry.js`;

const remoteManifest = (currentVersion = '1.0.6', fallbackVersion = '1.0.5') => ({
    schemaVersion: 1,
    remote: {
        key: 'consultingOpportunities',
        repository: 'HenrikGr/consulting-opportunities',
        federationName: 'consultingOpportunities',
        exposes: ['./FeatureButton'],
    },
    currentVersion: {
        version: currentVersion,
        tag: `v${currentVersion}`,
        entryUrl: releaseEntryUrl(currentVersion),
    },
    fallbackVersion: fallbackVersion ? {
        version: fallbackVersion,
        tag: `v${fallbackVersion}`,
        entryUrl: releaseEntryUrl(fallbackVersion),
    } : null,
});

async function mockRemoteManifest(page, manifest = remoteManifest()) {
    await page.route('**/microfrontends.json', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                remotes: {
                    consultingOpportunities: {
                        manifestUrl: 'https://test.local/remote-manifest.json',
                    },
                },
            }),
        });
    });
    await page.route('https://test.local/remote-manifest.json', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(manifest),
        });
    });
}

test('Host loads current Remote release 1.0.6 from its manifest', async ({ page }) => {
    await mockRemoteManifest(page);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'hgc-ab' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Remote feature area' })).toBeVisible();
    await expect(page.getByRole('button').first()).toContainText('1.0.6');
});

test('Host loads fallback release 1.0.5 when current release 1.0.6 fails', async ({ page }) => {
    await mockRemoteManifest(page, remoteManifest('1.0.6', '1.0.5'));
    let currentEntryRequested = false;
    let fallbackEntryRequested = false;

    await page.route(releaseEntryUrl('1.0.6'), async (route) => {
        currentEntryRequested = true;
        await route.abort('failed');
    });
    await page.route(releaseEntryUrl('1.0.5'), async (route) => {
        fallbackEntryRequested = true;
        await route.continue();
    });

    await page.goto('/');

    await expect(page.getByRole('button').first()).toContainText('1.0.5');
    await expect(page.getByRole('heading', { name: 'hgc-ab' })).toBeVisible();
    expect(currentEntryRequested).toBe(true);
    expect(fallbackEntryRequested).toBe(true);
});

test('Host remains available and explains the error when both releases fail', async ({ page }) => {
    await mockRemoteManifest(page, remoteManifest('1.0.6', '1.0.5'));
    await page.route('**/releases/download/v1.0.6/consultingOpportunitiesEntry.js', async (route) => {
        await route.abort('failed');
    });
    await page.route('**/releases/download/v1.0.5/consultingOpportunitiesEntry.js', async (route) => {
        await route.abort('failed');
    });

    await page.goto('/');

    await expect(page.getByRole('alert')).toContainText('Remote feature unavailable.');
    await expect(page.getByRole('alert')).toContainText('Host remains available');
    await expect(page.getByRole('heading', { name: 'hgc-ab' })).toBeVisible();
});

test('Host displays a configuration error when no remotes are configured', async ({ page }) => {
    await page.route('**/microfrontends.json', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({}),
        });
    });

    await page.goto('/');
    await expect(page.getByRole('alert')).toContainText(
        'Runtime configuration could not be loaded.',
    );
});

test('Remote feature button dispatches its click event', async ({ page }) => {
    await mockRemoteManifest(page);
    await page.addInitScript(() => {
        window.__remotePocClicked = false;
        window.addEventListener('consulting-opportunities:clicked', () => {
            window.__remotePocClicked = true;
        });
    });

    await page.goto('/');
    await page.getByRole('button').first().click();
    await expect.poll(() => page.evaluate(() => window.__remotePocClicked)).toBe(true);
});
