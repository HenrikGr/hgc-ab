import { test, expect } from '@playwright/test';

const entryUrl = (version) =>
    `http://127.0.0.1:5000/__remotes/consultingOpportunities/${version}/consultingOpportunitiesEntry.js`;

const remoteManifest = (currentVersion = '1.0.4', fallbackVersion = '1.0.3') => ({
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
        entryUrl: entryUrl(currentVersion),
    },
    fallbackVersion: fallbackVersion ? {
        version: fallbackVersion,
        tag: `v${fallbackVersion}`,
        entryUrl: entryUrl(fallbackVersion),
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

test('Host loads the current Remote version from its manifest', async ({ page }) => {
    await mockRemoteManifest(page);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'hgc-ab' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Remote feature area' })).toBeVisible();
    await expect(page.getByRole('button').first()).toContainText('1.0.4');
});

test('Host retries with the manifest fallback when the current entry fails', async ({ page }) => {
    await mockRemoteManifest(page, remoteManifest('1.0.4', '1.0.3'));
    await page.route('**/consultingOpportunities/1.0.4/consultingOpportunitiesEntry.js', async (route) => {
        await route.abort('failed');
    });

    await page.goto('/');

    await expect(page.getByRole('button').first()).toContainText('1.0.3');
    await expect(page.getByRole('heading', { name: 'hgc-ab' })).toBeVisible();
});

test('Host remains available when current and fallback Remote entries both fail', async ({ page }) => {
    await mockRemoteManifest(page, remoteManifest('1.0.4', '1.0.3'));
    await page.route('**/consultingOpportunitiesEntry.js', async (route) => {
        await route.abort('failed');
    });

    await page.goto('/');

    await expect(page.getByRole('alert')).toContainText('Remote feature unavailable.');
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
