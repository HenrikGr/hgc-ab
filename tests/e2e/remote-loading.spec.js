import { test, expect } from '@playwright/test';

/**
 * Observe the real manifest response without replacing it. The Host still
 * fetches the manifest through its normal runtime-config and Vite-proxy path.
 */
async function observePublishedManifest(page) {
    let manifest;

    await page.route('**/latest/download/remote-manifest.json', async (route) => {
        const response = await route.fetch();
        const body = await response.text();

        if (response.ok()) {
            manifest = JSON.parse(body);
        }

        await route.fulfill({ response, body });
    });

    return {
        get value() {
            return manifest;
        },
    };
}

function entryPath(entryUrl) {
    return new URL(entryUrl, 'http://localhost').pathname;
}

/**
 * Fail selected real entry requests while allowing the Host's normal loader
 * and the Vite release proxy to handle all other requests.
 */
async function interceptEntryFailures(page, observedManifest, { current = false, fallback = false }) {
    const failedEntries = new Set();

    await page.route('**/consultingOpportunitiesEntry.js', async (route) => {
        const manifest = observedManifest.value;
        const requestPath = new URL(route.request().url()).pathname;

        if (!manifest) {
            await route.continue();
            return;
        }

        const currentPath = entryPath(manifest.currentVersion.entryUrl);
        const fallbackPath = manifest.fallbackVersion?.entryUrl
            ? entryPath(manifest.fallbackVersion.entryUrl)
            : null;

        if (current && requestPath === currentPath) {
            failedEntries.add('current');
            await route.abort('failed');
            return;
        }

        if (fallback && fallbackPath && requestPath === fallbackPath) {
            failedEntries.add('fallback');
            await route.abort('failed');
            return;
        }

        await route.continue();
    });

    return failedEntries;
}

test('Host loads the current Remote release from its published manifest', async ({ page }) => {
    const publishedManifest = await observePublishedManifest(page);

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'hgc-ab' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Remote feature area' })).toBeVisible();
    expect(publishedManifest.value?.currentVersion?.version).toBeTruthy();
    await expect(page.getByRole('button').first()).toContainText(
        publishedManifest.value.currentVersion.version,
    );
});

test('Host loads the published fallback when the current entry fails', async ({ page }) => {
    const publishedManifest = await observePublishedManifest(page);
    const failedEntries = await interceptEntryFailures(page, publishedManifest, {
        current: true,
    });

    await page.goto('/');

    const manifest = publishedManifest.value;
    expect(manifest?.currentVersion?.entryUrl).toBeTruthy();
    expect(manifest?.fallbackVersion?.entryUrl).toBeTruthy();

    await expect(page.getByRole('button').first()).toContainText(
        manifest.fallbackVersion.version,
    );
    await expect(page.getByRole('heading', { name: 'hgc-ab' })).toBeVisible();
    expect(failedEntries.has('current')).toBe(true);
});

test('Host remains available when both published Remote versions fail', async ({ page }) => {
    const publishedManifest = await observePublishedManifest(page);
    const failedEntries = await interceptEntryFailures(page, publishedManifest, {
        current: true,
        fallback: true,
    });

    await page.goto('/');

    expect(publishedManifest.value?.currentVersion?.entryUrl).toBeTruthy();
    expect(publishedManifest.value?.fallbackVersion?.entryUrl).toBeTruthy();
    await expect(page.getByRole('alert')).toContainText('Remote feature unavailable.');
    await expect(page.getByRole('alert')).toContainText('Host remains available');
    await expect(page.getByRole('heading', { name: 'hgc-ab' })).toBeVisible();
    expect(failedEntries.has('current')).toBe(true);
    expect(failedEntries.has('fallback')).toBe(true);
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
    await observePublishedManifest(page);
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
